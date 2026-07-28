import {
  decryptSensitiveValue,
  encryptSensitiveValue,
} from './data-encryption';

describe('sensitive data encryption', () => {
  const previousKey = process.env.DATA_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  afterAll(() => {
    if (previousKey === undefined) {
      delete process.env.DATA_ENCRYPTION_KEY;
    } else {
      process.env.DATA_ENCRYPTION_KEY = previousKey;
    }
  });

  it('round-trips a sensitive value without exposing plaintext', () => {
    const encrypted = encryptSensitiveValue('TOP-SECRET');
    expect(encrypted).not.toContain('TOP-SECRET');
    expect(decryptSensitiveValue(encrypted)).toBe('TOP-SECRET');
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSensitiveValue('TOP-SECRET');
    const [version, initializationVector, authenticationTag, encodedCiphertext] =
      encrypted.split(':');
    const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
    ciphertext[0] ^= 1;
    const tampered = [
      version,
      initializationVector,
      authenticationTag,
      ciphertext.toString('base64url'),
    ].join(':');

    expect(() => decryptSensitiveValue(tampered)).toThrow();
  });
});
