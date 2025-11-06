export type TemplateFieldDefinition = {
  key?: string;
  label?: string;
  type?: string;
  required?: boolean;
  helpText?: string;
  unit?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  metadata?: Record<string, unknown>;
  children?: TemplateFieldDefinition[];
};

export type EvaluationTemplateSummary = {
  id: string;
  name: string;
  techProfile: string;
  equipmentTypes: string[];
  equipmentIds: string[];
  isChecklistMandatory: boolean;
  attachmentsEnabled: boolean;
  maxAttachments: number;
  fields: TemplateFieldDefinition[];
  updatedAt?: string;
};

export type EquipmentSummary = {
  id: string;
  type?: string;
};

const toLower = (value: string | undefined | null) =>
  typeof value === 'string' ? value.toLowerCase() : '';

export function normalizeTemplateDoc(doc: Record<string, any>): EvaluationTemplateSummary {
  return {
    id: doc._id ? doc._id.toString() : String(doc.id),
    name: doc.name || '',
    techProfile: doc.techProfile || 'todos',
    equipmentTypes: Array.isArray(doc.equipmentTypes)
      ? doc.equipmentTypes.filter(Boolean)
      : [],
    equipmentIds: Array.isArray(doc.equipmentIds)
      ? doc.equipmentIds.map((id: unknown) => (typeof id === 'string' ? id : String(id)))
      : [],
    isChecklistMandatory: doc.isChecklistMandatory !== false,
    attachmentsEnabled: doc.attachmentsEnabled !== false,
    maxAttachments:
      typeof doc.maxAttachments === 'number' && doc.maxAttachments > 0
        ? Math.min(Math.floor(doc.maxAttachments), 10)
        : 0,
    fields: Array.isArray(doc.fields) ? doc.fields : [],
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt).toISOString?.() || doc.updatedAt
      : undefined
  };
}

export function matchTemplateForEquipment(
  templates: EvaluationTemplateSummary[],
  equipment: EquipmentSummary | null | undefined,
  techProfile?: string | null
): EvaluationTemplateSummary | null {
  if (!equipment) return null;
  const normalizedProfile = toLower(techProfile) || 'externo';
  const equipmentType = toLower(equipment.type);
  let best: EvaluationTemplateSummary | null = null;
  let bestScore = -1;
  let bestUpdated = -1;

  templates.forEach((template) => {
    const profile = toLower(template.techProfile) || 'todos';
    if (profile !== 'todos' && profile !== normalizedProfile) {
      return;
    }

    const idList = Array.isArray(template.equipmentIds) ? template.equipmentIds : [];
    const typeList = Array.isArray(template.equipmentTypes) ? template.equipmentTypes : [];
    const idMatch = idList.includes(equipment.id);
    const typeMatch =
      Boolean(equipmentType) &&
      typeList.map((item) => item.toLowerCase()).includes(equipmentType);
    const score = idMatch
      ? 3
      : typeMatch
        ? 2
        : idList.length === 0 && typeList.length === 0
          ? 1
          : 0;
    if (score === 0) return;

    const updatedAt = template.updatedAt ? new Date(template.updatedAt).getTime() : 0;

    if (
      score > bestScore ||
      (score === bestScore && updatedAt > bestUpdated)
    ) {
      best = template;
      bestScore = score;
      bestUpdated = updatedAt;
    }
  });

  return best;
}
