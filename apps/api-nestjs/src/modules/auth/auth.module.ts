import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccountModule } from '../account/account.module';
import { EmployeesModule } from '../employees/employees.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionsModule } from './auth-sessions.module';

@Module({
  imports: [
    ConfigModule,
    AuthSessionsModule,
    AccountModule,
    EmployeesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: (() => {
          const nodeEnv = configService
            .get<string>('NODE_ENV')
            ?.trim()
            .toLowerCase();
          const isProduction = nodeEnv === 'production';
          const jwtSecret = configService.get<string>('JWT_SECRET')?.trim();

          if (!jwtSecret) {
            if (isProduction) {
              throw new Error(
                'JWT_SECRET is required in production and must be at least 32 characters.',
              );
            }

            return 'apex-pos-dev-secret';
          }

          if (
            isProduction &&
            (jwtSecret === 'apex-pos-dev-secret' || jwtSecret.length < 32)
          ) {
            throw new Error(
              'JWT_SECRET in production must not use defaults and must be at least 32 characters.',
            );
          }

          return jwtSecret;
        })(),
        signOptions: {
          expiresIn: '12h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService, AuthSessionsModule],
})
export class AuthModule {}
