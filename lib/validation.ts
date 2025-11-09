const SAFE_TEXT_REGEX = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\s.,:;@#'"\/\-()&+%]+$/;

export const SAFE_TEXT_PATTERN = "[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .,:;@#'\"/\\-()&+%]+";

type TextOptions = {
  minLength?: number;
  maxLength?: number;
};

type NumericOptions = {
  min?: number;
  max?: number;
  integer?: boolean;
};

export function normalizeText(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

export function assertSafeText(
  value: unknown,
  { minLength = 1, maxLength = 120 }: TextOptions = {}
): string | null {
  const normalized = normalizeText(value, maxLength);
  if (!normalized) return null;
  if (normalized.length < minLength || normalized.length > maxLength) return null;
  if (!SAFE_TEXT_REGEX.test(normalized)) return null;
  return normalized;
}

export function sanitizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): boolean {
  const email = sanitizeEmail(value);
  if (!email || email.length > 120) return false;
  return EMAIL_REGEX.test(email);
}

export function isValidPassword(
  value: unknown,
  { minLength = 6, maxLength = 120 }: TextOptions = {}
): boolean {
  if (typeof value !== 'string') return false;
  const length = value.length;
  if (length < (minLength ?? 6) || length > (maxLength ?? 120)) return false;
  return true;
}

export function parseNumeric(
  value: unknown,
  { min, max, integer = false }: NumericOptions = {}
): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (integer && !Number.isInteger(num)) return null;
  if (typeof min === 'number' && num < min) return null;
  if (typeof max === 'number' && num > max) return null;
  return num;
}
