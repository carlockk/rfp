import { randomUUID } from 'crypto';

export type ChecklistOption = {
  key: string;
  label: string;
};

export type ChecklistNode = {
  key: string;
  title: string;
  description: string;
  inputType: 'section' | 'select' | 'text' | 'number' | 'checkbox' | 'textarea';
  required: boolean;
  allowMultiple: boolean;
  options?: ChecklistOption[];
  children: ChecklistNode[];
};

export type RawChecklistNode = {
  key?: string;
  title?: string;
  description?: string;
  inputType?: string;
  required?: boolean;
  allowMultiple?: boolean;
  options?: Array<{ key?: string; label?: string }>;
  children?: RawChecklistNode[];
};

const INPUT_TYPES = new Set(['section', 'select', 'text', 'number', 'checkbox', 'textarea']);
const MAX_DEPTH = 8;

const legacyItemsToNodes = (items: any[]): ChecklistNode[] =>
  Array.isArray(items)
    ? items.map((item, index) => {
        const key = normalizeChecklistKey(item?.key || item?.label || `legacy-${index}`);
        const type = item?.type || 'select';
        let inputType: ChecklistNode['inputType'] = 'select';
        if (type === 'number') inputType = 'number';
        else if (type === 'text') inputType = 'text';
        else if (type === 'boolean' || type === 'select') inputType = 'select';
        else if (INPUT_TYPES.has(type)) inputType = type as ChecklistNode['inputType'];
        const options =
          inputType === 'select'
            ? (Array.isArray(item?.options) && item.options.length
                ? item.options
                : [
                    { key: 'cumple', label: 'Cumple' },
                    { key: 'no-cumple', label: 'No cumple' },
                    { key: 'no-aplica', label: 'No aplica' }
                  ]).map((opt: any, idx: number) => ({
                    key: normalizeChecklistKey(opt?.key || `${key}-opt-${idx}`),
                    label: typeof opt?.label === 'string' && opt.label.trim()
                      ? opt.label.trim()
                      : `Opción ${idx + 1}`
                  }))
            : undefined;
        return {
          key,
          title: typeof item?.label === 'string' && item.label.trim()
            ? item.label.trim()
            : `Pregunta ${index + 1}`,
          description: '',
          inputType,
          required: Boolean(item?.required),
          allowMultiple: false,
          options,
          children: []
        };
      })
    : [];

export function normalizeChecklistKey(value?: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return randomUUID();
  }
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function normalizeChecklistNodes(
  nodes: RawChecklistNode[],
  depth = 0,
  path = 'root',
  keys = new Set<string>()
): ChecklistNode[] {
  if (!Array.isArray(nodes)) return [];
  if (depth > MAX_DEPTH) {
    throw new Error(`Profundidad maxima de ${MAX_DEPTH} niveles superada en ${path}`);
  }
  return nodes.map((node, index) => {
    const location = `${path}.${index}`;
    const key = normalizeChecklistKey(node.key || node.title);
    if (keys.has(key)) {
      throw new Error(`Clave duplicada "${key}" detectada en ${location}`);
    }
    keys.add(key);

    const title = typeof node.title === 'string' && node.title.trim()
      ? node.title.trim()
      : null;
    if (!title) {
      throw new Error(`Titulo requerido en ${location}`);
    }

    const inputType = INPUT_TYPES.has(node.inputType || '')
      ? (node.inputType as ChecklistNode['inputType'])
      : node.children && node.children.length
        ? 'section'
        : 'select';

    let options: ChecklistOption[] | undefined;
    if (inputType === 'select') {
      const opts = Array.isArray(node.options) && node.options.length
        ? node.options
        : [
            { key: 'cumple', label: 'Cumple' },
            { key: 'no-cumple', label: 'No cumple' },
            { key: 'no-aplica', label: 'No aplica' }
          ];
      options = opts.map((opt, optIndex) => {
        const optKey = normalizeChecklistKey(opt.key || `${key}-option-${optIndex}`);
        return {
          key: optKey,
          label: typeof opt.label === 'string' && opt.label.trim()
            ? opt.label.trim()
            : `Opcion ${optIndex + 1}`
        };
      });
    }

    const children = normalizeChecklistNodes(
      node.children || [],
      depth + 1,
      `${location}.children`,
      keys
    );

    return {
      key,
      title,
      description: typeof node.description === 'string' ? node.description.trim() : '',
      inputType,
      required: Boolean(node.required),
      allowMultiple: Boolean(node.allowMultiple),
      options,
      children
    };
  });
}

export function serializeChecklist(record: any, includeStructure: boolean, version?: number) {
  const safe = record || {};
  const targetVersion = version || safe.currentVersion || 1;
  let versionsArray = Array.isArray(safe.versions) ? safe.versions : [];

  if (!versionsArray.length && Array.isArray(safe.items) && safe.items.length) {
    versionsArray = [
      {
        version: safe.version || safe.currentVersion || 1,
        title: safe.name,
        summary: safe.description,
        notes: '',
        nodes: legacyItemsToNodes(safe.items),
        createdAt: safe.updatedAt || safe.createdAt || new Date(),
        createdBy: null
      }
    ];
  }

  const fallbackVersion = versionsArray[versionsArray.length - 1] || null;
  const versionEntry =
    versionsArray.find((v: any) => v.version === targetVersion) ||
    (targetVersion ? fallbackVersion : null);

  return {
    id: safe._id?.toString?.() || '',
    name: safe.name,
    description: safe.description,
    equipmentType: safe.equipmentType,
    tags: safe.tags || [],
    isActive: safe.isActive !== false,
    deletedAt: safe.deletedAt || null,
    currentVersion: safe.currentVersion || versionEntry?.version || 1,
    versions: includeStructure
      ? versionsArray.map((v: any) => ({
          version: v.version,
          title: v.title,
          summary: v.summary,
          notes: v.notes,
          createdAt: v.createdAt,
          createdBy: v.createdBy?.toString?.() || null,
          nodes: v.nodes || []
        }))
      : undefined,
    structure: includeStructure ? versionEntry?.nodes || [] : undefined,
    currentVersionNotes: includeStructure ? versionEntry?.notes || '' : undefined,
    currentVersionTitle: includeStructure ? versionEntry?.title || safe.name : undefined,
    updatedAt: safe.updatedAt,
    createdAt: safe.createdAt
  };
}
