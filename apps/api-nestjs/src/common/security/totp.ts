import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(value: Buffer) {
  let bits = 0;
  let accumulator = 0;
  let output = '';

  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += base32Alphabet[(accumulator << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(value: string) {
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of value.toUpperCase().replace(/=|\s|-/g, '')) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) {
      throw new Error('TOTP secret contains invalid Base32 characters.');
    }
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function generateTotpCode(
  secret: string,
  timeMs = Date.now(),
  digits = 6,
  periodSeconds = 30,
) {
  const counter = Math.floor(timeMs / 1000 / periodSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binaryCode =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);

  return String(binaryCode % 10 ** digits).padStart(digits, '0');
}

export function verifyTotpCode(
  secret: string,
  candidate: string,
  timeMs = Date.now(),
  window = 1,
) {
  const normalizedCandidate = candidate.trim();
  if (!/^\d{6}$/.test(normalizedCandidate)) {
    return false;
  }

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, timeMs + offset * 30_000);
    if (
      timingSafeEqual(Buffer.from(normalizedCandidate), Buffer.from(expected))
    ) {
      return true;
    }
  }
  return false;
}

export function buildTotpUri(options: {
  secret: string;
  accountName: string;
  issuer?: string;
}) {
  const issuer = options.issuer ?? 'BIGTIME POS';
  const label = encodeURIComponent(`${issuer}:${options.accountName}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(options.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
