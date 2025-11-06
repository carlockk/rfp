export type TemplateMetricOption = {
  value: string;
  label: string;
};

export const TEMPLATE_METRIC_OPTIONS: readonly TemplateMetricOption[] = [
  { value: '', label: 'Sin metrica' },
  { value: 'hourmeterCurrent', label: 'Horometro actual (horas)' },
  { value: 'odometerCurrent', label: 'Odometro actual (km)' },
  { value: 'fuelLevelBefore', label: 'Nivel combustible antes (%)' },
  { value: 'fuelLevelAfter', label: 'Nivel combustible despues (%)' },
  { value: 'fuelAddedLiters', label: 'Litros cargados' },
  { value: 'energyAddedKwh', label: 'Energia cargada (kWh)' },
  { value: 'adblueAddedLiters', label: 'AdBlue litros' },
  { value: 'batteryLevelBefore', label: 'Bateria antes (%)' },
  { value: 'batteryLevelAfter', label: 'Bateria despues (%)' }
] as const;

const METRIC_VALUES = TEMPLATE_METRIC_OPTIONS.map((item) => item.value).filter(Boolean) as string[];

export type TemplateMetricKey = (typeof METRIC_VALUES)[number];

export const TEMPLATE_METRIC_KEY_SET = new Set<TemplateMetricKey>(METRIC_VALUES as TemplateMetricKey[]);

export type TemplateNumericMetrics = {
  hourmeterCurrent?: number | null;
  odometerCurrent?: number | null;
  fuelLevelBefore?: number | null;
  fuelLevelAfter?: number | null;
  fuelAddedLiters?: number | null;
  energyAddedKwh?: number | null;
  adblueAddedLiters?: number | null;
  batteryLevelBefore?: number | null;
  batteryLevelAfter?: number | null;
};

export const TEMPLATE_METRIC_FIELD_MAP: Record<TemplateMetricKey, keyof TemplateNumericMetrics> = {
  hourmeterCurrent: 'hourmeterCurrent',
  odometerCurrent: 'odometerCurrent',
  fuelLevelBefore: 'fuelLevelBefore',
  fuelLevelAfter: 'fuelLevelAfter',
  fuelAddedLiters: 'fuelAddedLiters',
  energyAddedKwh: 'energyAddedKwh',
  adblueAddedLiters: 'adblueAddedLiters',
  batteryLevelBefore: 'batteryLevelBefore',
  batteryLevelAfter: 'batteryLevelAfter'
};

export function isTemplateMetricKey(value: unknown): value is TemplateMetricKey {
  return typeof value === 'string' && TEMPLATE_METRIC_KEY_SET.has(value as TemplateMetricKey);
}
