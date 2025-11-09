export const OPERATOR_PROFILE_LABELS: Record<string, string> = {
  externo: 'Operador RFP',
  candelaria: 'Operador Candelaria',
  todos: 'Operadores'
};

export const getOperatorProfileLabel = (key?: string | null) =>
  key ? OPERATOR_PROFILE_LABELS[key] || 'Operador' : 'Operador';
