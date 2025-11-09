import { assertSafeText, parseNumeric } from './validation';

const ALLOWED_FUELS = new Set(['diesel', 'bencina', 'electrico']);

const optionalText = (
  value: unknown,
  label: string,
  options: { minLength?: number; maxLength?: number }
): string => {
  if (value === undefined || value === null || value === '') return '';
  const normalized = assertSafeText(value, options);
  if (!normalized) {
    throw new Error(`${label} invalido`);
  }
  return normalized;
};

export function sanitizeEquipmentPayload(raw: Record<string, any> = {}) {
  const code = assertSafeText(raw.code, { minLength: 2, maxLength: 40 });
  if (!code) throw new Error('Codigo invalido');

  const type = assertSafeText(raw.type, { minLength: 2, maxLength: 60 });
  if (!type) throw new Error('Tipo invalido');

  const brand = optionalText(raw.brand, 'Marca', { minLength: 1, maxLength: 60 });
  const model = optionalText(raw.model, 'Modelo', { minLength: 1, maxLength: 60 });
  const plate = optionalText(raw.plate, 'Identificador', { minLength: 1, maxLength: 30 });
  const notes = optionalText(raw.notes, 'Notas', { minLength: 1, maxLength: 280 });

  const hourmeterBase = parseNumeric(raw.hourmeterBase ?? 0, { min: 0, max: 10_000_000 });
  if (hourmeterBase === null) throw new Error('Horometro base invalido');

  const odometerBase = parseNumeric(raw.odometerBase ?? 0, { min: 0, max: 10_000_000 });
  if (odometerBase === null) throw new Error('Kilometraje base invalido');

  const fuel = ALLOWED_FUELS.has(raw.fuel) ? raw.fuel : 'diesel';
  const adblue = Boolean(raw.adblue);

  return {
    code,
    type,
    brand,
    model,
    plate,
    notes,
    fuel,
    adblue,
    hourmeterBase,
    odometerBase
  };
}
