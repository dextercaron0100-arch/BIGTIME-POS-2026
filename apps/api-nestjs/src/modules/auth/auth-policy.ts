export const DEFAULT_AUTH_MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const DEFAULT_AUTH_LOCKOUT_MINUTES = 30;
export const DEFAULT_AUTH_PIN_MAX_AGE_DAYS = 30;

export function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function normalizeIsoDate(value?: string | null) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

export function computePinExpiresAt(
  pinUpdatedAt: string | null,
  maxAgeDays: number,
) {
  const normalized = normalizeIsoDate(pinUpdatedAt);
  if (!normalized) {
    return null;
  }

  const updatedAtMs = Date.parse(normalized);
  const expiresAtMs = updatedAtMs + maxAgeDays * 24 * 60 * 60 * 1000;
  return new Date(expiresAtMs).toISOString();
}

export function isPinExpired(pinUpdatedAt: string | null, maxAgeDays: number) {
  const expiresAt = computePinExpiresAt(pinUpdatedAt, maxAgeDays);
  if (!expiresAt) {
    return false;
  }

  return Date.parse(expiresAt) <= Date.now();
}
