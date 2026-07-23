import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { config as loadDotEnv } from 'dotenv';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { validateConfiguredEncryptionKey } from './common/security/data-encryption';

const trueEnvValues = new Set(['1', 'true', 'yes', 'on']);
const falseEnvValues = new Set(['0', 'false', 'no', 'off']);
const bytesInKb = 1024;
const bytesInMb = bytesInKb * 1024;

function loadRuntimeEnvironment() {
  const cwd = process.cwd();
  const environmentFiles = [
    join(cwd, '.env.local'),
    join(cwd, '.env'),
    join(cwd, 'apps/api-nestjs/.env.local'),
    join(cwd, 'apps/api-nestjs/.env'),
  ];

  for (const path of environmentFiles) {
    loadDotEnv({ path, override: false, quiet: true });
  }
}

loadRuntimeEnvironment();

function parseRequestBodyLimitBytes(limit: string): number | null {
  const match = limit
    .trim()
    .toLowerCase()
    .match(/^(\d+)\s*(b|kb|mb)$/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unit = match[2];
  switch (unit) {
    case 'b':
      return value;
    case 'kb':
      return value * bytesInKb;
    case 'mb':
      return value * bytesInMb;
    default:
      return null;
  }
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) {
    return fallback;
  }

  if (trueEnvValues.has(rawValue)) {
    return true;
  }

  if (falseEnvValues.has(rawValue)) {
    return false;
  }

  throw new Error(
    `${name} must be one of: ${Array.from(trueEnvValues).join(', ')} or ${Array.from(falseEnvValues).join(', ')}.`,
  );
}

function validateCorsOrigins(origins: string[]) {
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `CORS_ORIGINS contains an invalid origin: "${origin}". Use full origins like "https://dashboard.example.com".`,
      );
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(
        `CORS_ORIGINS contains an unsupported protocol: "${origin}". Only http and https are allowed.`,
      );
    }

    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(
        `CORS_ORIGINS must not include paths, query strings, or fragments: "${origin}".`,
      );
    }
  }
}

function assertProductionEnvSafety(logger: Logger) {
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (
    jwtSecret.length < 32 ||
    jwtSecret === 'apex-pos-dev-secret' ||
    jwtSecret === 'replace-with-at-least-32-characters'
  ) {
    throw new Error(
      'JWT_SECRET must be set to a unique secret with at least 32 characters in production.',
    );
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim() ?? '';
  if (refreshSecret.length < 32 || refreshSecret === jwtSecret) {
    throw new Error(
      'JWT_REFRESH_SECRET must be a unique secret of at least 32 characters in production.',
    );
  }

  const encryptionKey = validateConfiguredEncryptionKey();
  const jwtKey = Buffer.from(jwtSecret);
  const refreshKey = Buffer.from(refreshSecret);
  if (encryptionKey.equals(jwtKey) || encryptionKey.equals(refreshKey)) {
    throw new Error(
      'DATA_ENCRYPTION_KEY must be different from JWT signing secrets.',
    );
  }

  assertProductionTransportSafety();

  if (readBooleanEnv('AUTH_ALLOW_DEMO_USERS', false)) {
    throw new Error('AUTH_ALLOW_DEMO_USERS must be disabled in production.');
  }

  if (readBooleanEnv('EIS_ALLOW_SIMULATION', false)) {
    throw new Error('EIS_ALLOW_SIMULATION must be disabled in production.');
  }

  const signingSecret = process.env.EIS_SIGNING_SECRET?.trim() ?? '';
  if (
    signingSecret.length < 32 ||
    signingSecret === 'eis-local-dev-secret' ||
    signingSecret === 'replace-with-strong-secret'
  ) {
    throw new Error(
      'EIS_SIGNING_SECRET must be set to a unique secret with at least 32 characters in production.',
    );
  }

  const hasLiveEndpoint =
    (process.env.EIS_ENDPOINT_URL?.trim() ?? '').length > 0;
  if (!hasLiveEndpoint) {
    logger.warn(
      'EIS_ENDPOINT_URL is empty in production. EIS live filing is disabled until this is configured.',
    );
  }
}

function assertProductionTransportSafety() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in production.');
  }
  const parsedDatabaseUrl = new URL(databaseUrl);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const sslMode = parsedDatabaseUrl.searchParams.get('sslmode')?.toLowerCase();
  if (
    !localHosts.has(parsedDatabaseUrl.hostname) &&
    !['require', 'verify-ca', 'verify-full'].includes(sslMode ?? '')
  ) {
    throw new Error(
      'Remote DATABASE_URL connections must require TLS using sslmode=require or stronger.',
    );
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL is required in production.');
  }
  const parsedRedisUrl = new URL(redisUrl);
  const isLocalRedis = localHosts.has(parsedRedisUrl.hostname);
  if (!isLocalRedis && parsedRedisUrl.protocol !== 'rediss:') {
    throw new Error('Remote REDIS_URL connections must use TLS (rediss://).');
  }
  if (!isLocalRedis && !parsedRedisUrl.password) {
    throw new Error('Remote Redis connections must use authentication.');
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction =
    process.env.NODE_ENV?.trim().toLowerCase() === 'production';
  const host = process.env.APP_HOST?.trim() || '127.0.0.1';
  const requestBodyLimit = process.env.REQUEST_BODY_LIMIT ?? '10mb';
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const requestBodyLimitBytes = parseRequestBodyLimitBytes(requestBodyLimit);

  if (requestBodyLimitBytes === null) {
    throw new Error(
      'REQUEST_BODY_LIMIT must be a positive value like "512kb" or "10mb".',
    );
  }

  if (requestBodyLimitBytes > 100 * bytesInMb) {
    throw new Error('REQUEST_BODY_LIMIT must not exceed 100mb for API safety.');
  }

  validateCorsOrigins(allowedOrigins);

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS is required in production. Provide a comma-separated allowlist.',
    );
  }

  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
    if (jwtSecret.length < 32 || jwtSecret === 'apex-pos-dev-secret') {
      throw new Error(
        'A strong JWT_SECRET is required whenever APP_HOST exposes the API beyond loopback.',
      );
    }
    if (allowedOrigins.length === 0) {
      throw new Error(
        'CORS_ORIGINS is required whenever APP_HOST exposes the API beyond loopback.',
      );
    }
    if (readBooleanEnv('AUTH_ALLOW_DEMO_USERS', false)) {
      throw new Error(
        'Demo users cannot be enabled when the API is exposed beyond loopback.',
      );
    }
  }

  if (isProduction) {
    assertProductionEnvSafety(logger);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      credentials: true,
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.length === 0 && !isProduction) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin is not allowed: ${origin}`), false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
    },
  });

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(json({ limit: requestBodyLimit }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: isProduction,
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const enableSwagger = !isProduction && readBooleanEnv('ENABLE_SWAGGER', true);

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BIGTIME POS API')
      .setDescription(
        'Offline-first POS backend with BIR reporting, inventory, and dashboard services.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  } else {
    logger.log('Swagger is disabled for production hardening.');
  }

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      'PORT must be a valid TCP port number between 1 and 65535.',
    );
  }

  await app.listen(port, host);
}

void bootstrap();
