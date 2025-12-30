const SAFE_TEXT_REGEX = /^[A-Za-z0-9\s.,:;@#'"\/\-()&+%]+$/;

export const SAFE_TEXT_PATTERN = "[A-Za-z0-9 .,:;@#'\"/\\-()&+%]+";

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
const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,119}$/;

export function isValidEmail(value: unknown): boolean {
  const email = sanitizeEmail(value);
  if (!email || email.length > 120) return false;
  return EMAIL_REGEX.test(email);
}

export function sanitizeLoginId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function isValidLoginId(value: unknown): boolean {
  const loginId = sanitizeLoginId(value);
  if (!loginId || loginId.length > 120) return false;
  if (EMAIL_REGEX.test(loginId)) return true;
  return USERNAME_REGEX.test(loginId);
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

export function sanitizePhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function isValidPhone(
  value: unknown,
  { minLength = 8, maxLength = 20 }: TextOptions = {}
): boolean {
  if (typeof value !== 'string') return false;
  const normalized = sanitizePhone(value);
  if (!normalized || normalized.length < minLength || normalized.length > maxLength) return false;
  const digits = normalized.replace(/[^0-9+]/g, '');
  return digits.length >= minLength && digits.length <= maxLength;
}
