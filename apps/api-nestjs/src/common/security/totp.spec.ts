import { generateTotpCode, verifyTotpCode } from './totp';

describe('TOTP', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches the RFC 6238 SHA-1 test vector', () => {
    expect(generateTotpCode(rfcSecret, 59_000, 8)).toBe('94287082');
  });

  it('accepts only six-digit codes inside the configured time window', () => {
    const code = generateTotpCode(rfcSecret, 60_000);
    expect(verifyTotpCode(rfcSecret, code, 90_000, 1)).toBe(true);
    expect(verifyTotpCode(rfcSecret, '000000', 90_000, 0)).toBe(false);
    expect(verifyTotpCode(rfcSecret, 'not-a-code', 90_000, 1)).toBe(false);
  });
});
