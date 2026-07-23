import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const encryptionVersion = 'v1';
const encryptionContext = Buffer.from('bigtime-pos:sensitive-data:v1');

function resolveEncryptionKey() {
  const configuredKey = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    const decodedKey = Buffer.from(configuredKey, 'base64');
    if (decodedKey.length !== 32) {
      throw new Error(
        'DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
      );
    }
    return decodedKey;
  }

  if (process.env.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('DATA_ENCRYPTION_KEY is required in production.');
  }

  const developmentSeed =
    process.env.JWT_SECRET?.trim() || 'bigtime-pos-local-development-only';
  return createHash('sha256')
    .update(`${developmentSeed}:data-encryption:development-only`)
    .digest();
}

export function validateConfiguredEncryptionKey() {
  return resolveEncryptionKey();
}

export function encryptSensitiveValue(value: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    resolveEncryptionKey(),
    initializationVector,
  );
  cipher.setAAD(encryptionContext);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    encryptionVersion,
    initializationVector.toString('base64url'),
    authenticationTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSensitiveValue(encryptedValue: string) {
  const [version, initializationVector, authenticationTag, ciphertext] =
    encryptedValue.split(':');
  if (
    version !== encryptionVersion ||
    !initializationVector ||
    !authenticationTag ||
    !ciphertext
  ) {
    throw new Error('Encrypted value has an unsupported format.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    resolveEncryptionKey(),
    Buffer.from(initializationVector, 'base64url'),
  );
  decipher.setAAD(encryptionContext);
  decipher.setAuthTag(Buffer.from(authenticationTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
