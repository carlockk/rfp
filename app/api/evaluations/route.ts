import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import Checklist from '@/models/Checklist';
import Equipment from '@/models/Equipment';
import EvaluationTemplate from '@/models/EvaluationTemplate';
import Notification from '@/models/Notification';
import PushSubscription from '@/models/PushSubscription';
import User from '@/models/User';
import { broadcastPush, isPushAvailable } from '@/lib/push';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@/lib/authz';
import { logAudit } from '@/lib/audit';
import { sendMail } from '@/lib/mailer';
import {
  TEMPLATE_METRIC_FIELD_MAP,
  TemplateMetricKey,
  TemplateNumericMetrics,
  isTemplateMetricKey
} from '@/lib/templateMetrics';

const VALID_STATUS = new Set(['ok', 'observado', 'critico']);
const FALLBACK_FIELD_KEYS: Record<keyof TemplateNumericMetrics, string[]> = {
  hourmeterCurrent: ['horometro_actual', 'hourmeter_actual', 'hourmeter', 'horometro'],
  odometerCurrent: ['odometro_actual', 'odometro', 'odometer', 'kilometraje'],
  fuelLevelBefore: ['combustible_anterior', 'fuel_level_before', 'nivel_combustible_previo'],
  fuelLevelAfter: ['combustible_actual', 'fuel_level_after', 'nivel_combustible'],
  fuelAddedLiters: ['combustible_cargado', 'litros_cargados', 'fuel_added', 'fuelAddedLiters'],
  energyAddedKwh: ['energia_cargada', 'kwh_cargados', 'energy_added', 'energyAddedKwh'],
  adblueAddedLiters: ['adblue_cargado', 'adblue_litros', 'adblueAddedLiters'],
  batteryLevelBefore: ['bateria_anterior', 'battery_level_before'],
  batteryLevelAfter: ['bateria_actual', 'battery_level_after']
};
const MAX_TEMPLATE_ATTACHMENT_SIZE = 1024 * 1024 * 3;
const MAX_EVIDENCE_ATTACHMENTS = 3;

type TemplateAttachmentPayload = {
  name?: string;
  size?: number;
  type?: string;
  dataUrl?: string;
  url?: string;
};

type TemplateFieldInput = {
  key?: string;
  type?: string;
  metadata?: {
    metricKey?: string;
  };
  children?: TemplateFieldInput[];
};

type TemplatePayload = {
  id?: string;
  name?: string;
  isChecklistMandatory?: boolean;
  maxAttachments?: number;
  fields?: TemplateFieldInput[];
  values?: Record<string, unknown>;
  attachments?: TemplateAttachmentPayload[];
};

type EvaluationPayload = {
  checklistId?: string;
  equipmentId?: string;
  status?: string;
  observations?: string;
  completedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  durationSeconds?: number;
  formData?: Record<string, unknown>;
  checklistVersion?: number;
  responses?: Array<{
    itemKey?: string;
    value?: unknown;
    note?: string;
  }>;
  template?: TemplatePayload;
  skipChecklist?: boolean;
  evidencePhotos?: TemplateAttachmentPayload[];
  anomaly?: boolean;
};

const sanitizeResponses = (responses: EvaluationPayload['responses']) =>
  Array.isArray(responses)
    ? responses
        .map((item) => ({
          itemKey: typeof item?.itemKey === 'string' ? item.itemKey.trim() : '',
          value: item?.value,
          note: typeof item?.note === 'string' ? item.note.trim() : ''
        }))
        .filter((item) => item.itemKey)
    : [];

function flattenTemplateFields(fields: TemplateFieldInput[] = []): TemplateFieldInput[] {
  const result: TemplateFieldInput[] = [];
  fields.forEach((field) => {
    if (!field || typeof field !== 'object') return;
    result.push(field);
    if (Array.isArray(field.children) && field.children.length) {
      result.push(...flattenTemplateFields(field.children));
    }
  });
  return result;
}

function sanitizeTemplateValues(
  fields: TemplateFieldInput[] = [],
  values: TemplatePayload['values']
): Record<string, unknown> {
  if (!values || typeof values !== 'object') return {};
  const allowed = new Set(
    flattenTemplateFields(fields)
      .map((field) => (typeof field?.key === 'string' ? field.key : ''))
      .filter(Boolean)
  );

  return Object.entries(values).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (allowed.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function parseNumericValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function extractTemplateMetrics(
  fields: TemplateFieldInput[] = [],
  values: Record<string, unknown> = {}
): TemplateNumericMetrics {
  const result: TemplateNumericMetrics = {};
  const flattened = flattenTemplateFields(fields);

  flattened.forEach((field) => {
    const key = typeof field?.key === 'string' ? field.key : '';
    if (!key) return;
    const metricKey = field?.metadata?.metricKey;
    if (metricKey && isTemplateMetricKey(metricKey)) {
      const value = parseNumericValue(values[key]);
      if (value !== null) {
        const targetField = TEMPLATE_METRIC_FIELD_MAP[metricKey as TemplateMetricKey];
        if (targetField) {
          result[targetField] = value;
        }
      }
    }
  });

  return result;
}

function sanitizeAttachments(
  attachments: TemplatePayload['attachments'],
  maxAllowed: number
) {
  if (!Array.isArray(attachments) || !attachments.length || maxAllowed <= 0) return [];
  const sanitized: Array<{
    name: string;
    size: number;
    type: string;
    url?: string;
    dataUrl?: string;
  }> = [];

  attachments.forEach((item) => {
    if (!item || sanitized.length >= maxAllowed) return;
    const { name, size, type } = item;
    const url = typeof item?.url === 'string' ? item.url.trim() : '';
    const dataUrl = typeof item?.dataUrl === 'string' ? item.dataUrl : '';

    if (
      typeof name === 'string' &&
      typeof type === 'string' &&
      typeof size === 'number' &&
      size > 0 &&
      size <= MAX_TEMPLATE_ATTACHMENT_SIZE
    ) {
      if (url) {
        sanitized.push({ name, size, type, url });
      } else if (dataUrl && dataUrl.startsWith('data:')) {
        sanitized.push({ name, size, type, dataUrl });
      }
    }
  });

  return sanitized;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!mongoose.isValidObjectId(String(session.id))) {
    return NextResponse.json({ error: 'Sesion invalida' }, { status: 400 });
  }

  let payload: EvaluationPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const equipmentId = typeof payload?.equipmentId === 'string' ? payload.equipmentId : '';
  if (!equipmentId || !mongoose.isValidObjectId(equipmentId)) {
    return NextResponse.json({ error: 'equipmentId invalido' }, { status: 400 });
  }

  const rawChecklistId = typeof payload.checklistId === 'string' ? payload.checklistId : '';
  const hasChecklistId = rawChecklistId && mongoose.isValidObjectId(rawChecklistId);

  await dbConnect();

  const templatePayload = payload.template || {};
  const templateIdRaw = typeof templatePayload.id === 'string' ? templatePayload.id : '';
  let templateDoc: Record<string, any> | null = null;

  if (templateIdRaw) {
    if (!mongoose.isValidObjectId(templateIdRaw)) {
      return NextResponse.json({ error: 'templateId invalido' }, { status: 400 });
    }
    templateDoc = await EvaluationTemplate.findById(templateIdRaw).lean<Record<string, any>>();
  }

  const templateFields = Array.isArray(templateDoc?.fields)
    ? templateDoc.fields
    : Array.isArray(templatePayload.fields)
      ? templatePayload.fields
      : [];

  const templateValues = sanitizeTemplateValues(templateFields, templatePayload.values);
  const templateName =
    typeof (templateDoc?.name ?? templatePayload?.name) === 'string'
      ? String(templateDoc?.name ?? templatePayload?.name).trim()
      : '';

  const templateAllowsSkip =
    templateDoc != null
      ? templateDoc.isChecklistMandatory === false
      : templatePayload.isChecklistMandatory === false;

  const requestedSkip = Boolean(payload.skipChecklist);
  const skipChecklist = templateAllowsSkip && requestedSkip && !hasChecklistId;

  const checklistId = skipChecklist ? '' : hasChecklistId ? rawChecklistId : '';

  if (!skipChecklist && !checklistId) {
    return NextResponse.json({ error: 'checklistId invalido' }, { status: 400 });
  }

  const [checklist, equipment] = await Promise.all([
    checklistId ? Checklist.findById(checklistId).lean<Record<string, any>>() : Promise.resolve(null),
    Equipment.findById(equipmentId).lean<Record<string, any>>()
  ]);

  if (!equipment) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  if (!skipChecklist && !checklist) {
    return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 });
  }

  if (session.role === 'tecnico') {
    const operatorMatches =
      Array.isArray(equipment.operators) &&
      equipment.operators.some(
        (op) =>
          op?.user &&
          op.user.toString() === String(session.id)
      );
    const assignedMatches =
      equipment.assignedTo &&
      equipment.assignedTo.toString() === String(session.id);

    if (!operatorMatches && !assignedMatches) {
      return NextResponse.json({ error: 'No autorizado para este equipo' }, { status: 403 });
    }
  }

  const responses = sanitizeResponses(payload.responses);
  if (!skipChecklist && responses.length === 0) {
    return NextResponse.json({ error: 'Se requieren respuestas' }, { status: 400 });
  }

  const status = VALID_STATUS.has(String(payload.status)) ? String(payload.status) : 'ok';
  const observations =
    typeof payload.observations === 'string' ? payload.observations.trim() : '';

  const startedAtRaw = payload.startedAt || payload.completedAt;
  const startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date();
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: 'Hora de inicio invalida' }, { status: 400 });
  }

  const finishedAtRaw = payload.finishedAt || payload.completedAt;
  const finishedAt = finishedAtRaw ? new Date(finishedAtRaw) : new Date();
  if (Number.isNaN(finishedAt.getTime())) {
    return NextResponse.json({ error: 'Hora de termino invalida' }, { status: 400 });
  }

  const completedAt = finishedAt;

  const durationSeconds =
    typeof payload.durationSeconds === 'number' &&
    Number.isFinite(payload.durationSeconds) &&
    payload.durationSeconds >= 0
      ? Math.round(payload.durationSeconds)
      : Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));

  const formData = payload.formData && typeof payload.formData === 'object' ? payload.formData : {};

  const checklistVersion = skipChecklist
    ? 0
    : typeof payload.checklistVersion === 'number' && payload.checklistVersion > 0
      ? payload.checklistVersion
      : Number(checklist?.version || 1);

  const resolvedMaxAttachments =
    templateDoc != null
      ? Math.max(0, templateDoc.maxAttachments ?? 0)
      : typeof templatePayload.maxAttachments === 'number' && templatePayload.maxAttachments > 0
        ? Math.min(Math.floor(templatePayload.maxAttachments), 10)
        : 0;

  const attachmentsEnabled =
    templateDoc != null ? templateDoc.attachmentsEnabled !== false : resolvedMaxAttachments > 0;

  const effectiveMaxAttachments = attachmentsEnabled ? resolvedMaxAttachments || 3 : 0;

  const templateAttachments = attachmentsEnabled
    ? sanitizeAttachments(templatePayload.attachments, effectiveMaxAttachments)
    : [];

  if (!attachmentsEnabled && Array.isArray(templatePayload.attachments) && templatePayload.attachments.length) {
    return NextResponse.json({ error: 'La plantilla no permite adjuntos' }, { status: 400 });
  }

  const evidencePhotos = sanitizeAttachments(
    Array.isArray(payload.evidencePhotos) ? payload.evidencePhotos : [],
    MAX_EVIDENCE_ATTACHMENTS
  );

  const anomaly = payload.anomaly === true;

  const templateMetrics = extractTemplateMetrics(templateFields, templateValues);

  let previousEvaluation: { hourmeterCurrent?: number | null; odometerCurrent?: number | null } | null = null;
  if (templateMetrics.hourmeterCurrent != null || templateMetrics.odometerCurrent != null) {
    previousEvaluation = await Evaluation.findOne({ equipment: equipment._id })
      .sort({ completedAt: -1 })
      .select('hourmeterCurrent odometerCurrent completedAt')
      .lean();
  }

  const templateRef =
    templateDoc?._id ?? (templateIdRaw && mongoose.isValidObjectId(templateIdRaw) ? templateIdRaw : undefined);

  const evaluationData: Record<string, any> = {
    checklist: skipChecklist ? null : checklist?._id || checklistId || null,
    equipment: equipment._id,
    technician: session.id,
    status,
    anomaly,
    responses,
    observations,
    startedAt,
    finishedAt,
    durationSeconds,
    formData,
    checklistVersion,
    completedAt,
    templateId: templateRef ?? null,
    templateName,
    templateValues,
    templateFields,
    templateAttachments,
    evidencePhotos,
    skipChecklist
  };

  Object.entries(templateMetrics).forEach(([field, value]) => {
    if (value != null) {
      evaluationData[field] = value;
    }
  });

  const responseMap = responses.reduce<Record<string, unknown>>((acc, item) => {
    acc[item.itemKey] = item.value;
    return acc;
  }, {});

  const readFromObject = (source: Record<string, unknown> | undefined, keys: string[]) => {
    if (!source) return null;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const parsed = parseNumericValue(source[key]);
        if (parsed != null) return parsed;
      }
    }
    return null;
  };

  const readFromResponses = (keys: string[]) => {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(responseMap, key)) continue;
      const parsed = parseNumericValue(responseMap[key]);
      if (parsed != null) return parsed;
    }
    return null;
  };

  (Object.keys(FALLBACK_FIELD_KEYS) as Array<keyof TemplateNumericMetrics>).forEach((field) => {
    if (evaluationData[field as string] != null) return;
    const keys = FALLBACK_FIELD_KEYS[field];
    const fallbackValue =
      readFromObject(formData || {}, keys) ??
      readFromObject(templateValues, keys) ??
      readFromResponses(keys);
    if (fallbackValue != null) {
      evaluationData[field as string] = fallbackValue;
    }
  });

  if (templateMetrics.hourmeterCurrent != null && previousEvaluation?.hourmeterCurrent != null) {
    const delta = templateMetrics.hourmeterCurrent - previousEvaluation.hourmeterCurrent;
    if (Number.isFinite(delta) && delta >= 0) {
      evaluationData.hourmeterPrevious = previousEvaluation.hourmeterCurrent;
      evaluationData.hourmeterDelta = delta;
    }
  }

  if (templateMetrics.odometerCurrent != null && previousEvaluation?.odometerCurrent != null) {
    const delta = templateMetrics.odometerCurrent - previousEvaluation.odometerCurrent;
    if (Number.isFinite(delta) && delta >= 0) {
      evaluationData.odometerPrevious = previousEvaluation.odometerCurrent;
      evaluationData.odometerDelta = delta;
    }
  }

  const evaluation = await Evaluation.create(evaluationData);

  const contextName = checklist?.name || templateName || 'Formulario de operador';

  if (status === 'critico') {
    const notification = await Notification.create({
      message: `Falla critica detectada en ${equipment.code}${contextName ? ` (${contextName})` : ''}.`,
      level: 'critical',
      equipment: equipment._id,
      checklist: checklist?._id || null
    });

    if (isPushAvailable()) {
      const adminUsers = await User.find({ role: { $in: ['admin', 'superadmin'] } })
        .select('_id')
        .lean();
      const adminIds = adminUsers.map((item) => item._id.toString());
      if (adminIds.length) {
        const subscriptions = await PushSubscription.find({ user: { $in: adminIds } }).lean<Array<{
          _id: mongoose.Types.ObjectId;
          endpoint: string;
          keys: { p256dh: string; auth: string };
        }>>();
        if (subscriptions.length) {
          await broadcastPush(subscriptions, {
            title: 'Alerta critica detectada',
            body: `${equipment.code}${contextName ? ` - ${contextName}` : ''}`,
            badge: '/log.png',
            icon: '/log.png',
            tag: 'critical-evaluation',
            renotify: true,
            data: {
              url: '/admin/reportes',
              evaluationId: evaluation._id.toString(),
              notificationId: notification._id.toString(),
              equipmentId: equipment._id.toString()
            }
          });
        }
      }
    }
  }

  await logAudit({
    req,
    userId: typeof session.id === 'string' ? session.id : undefined,
    action: 'evaluation.create',
    module: 'evaluations',
    subject: contextName || 'Checklist',
    subjectId: evaluation._id,
    details: {
      evaluationId: evaluation._id.toString(),
      checklistId: checklist?._id?.toString() || null,
      equipmentId: equipment._id.toString(),
      status,
      responseCount: responses.length,
      startedAt,
      finishedAt,
      durationSeconds,
      checklistVersion,
      templateId: templateRef ? String(templateRef) : null,
      templateName,
      skipChecklist,
      hourmeterCurrent: evaluationData.hourmeterCurrent ?? null,
      odometerCurrent: evaluationData.odometerCurrent ?? null,
      fuelAddedLiters: evaluationData.fuelAddedLiters ?? null,
      energyAddedKwh: evaluationData.energyAddedKwh ?? null
    }
  });

  if (anomaly && observations) {
    try {
      const adminUsers = await User.find({ role: { $in: ['admin', 'superadmin'] } })
        .select('email')
        .lean();
      const recipients = adminUsers
        .map((u) => u.email)
        .filter((email) => typeof email === 'string' && email.trim());
      if (recipients.length) {
        const subject = `Anomalía reportada en ${equipment.code}${contextName ? ` (${contextName})` : ''}`;
        const text = [
          `Equipo: ${equipment.code}`,
          `Checklist/plantilla: ${contextName || 'N/D'}`,
          `Técnico: ${session.email || session.id}`,
          `Fecha: ${completedAt.toISOString()}`,
          '',
          'Observación:',
          observations
        ].join('\n');
        await sendMail({ to: recipients.join(','), subject, text, html: undefined });
      }
    } catch (err) {
      console.error('No se pudo enviar alerta de anomalía', err);
    }
  }

  return NextResponse.json(evaluation, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'ver_reporte');
  if (auth instanceof NextResponse) return auth;

  const session = auth;

  await dbConnect();

  const { searchParams } = new URL(req.url);

  const query: Record<string, unknown> = {};

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');
  const equipmentId = searchParams.get('equipmentId');
  const checklistId = searchParams.get('checklistId');
  const technicianIdParam = searchParams.get('technicianId');

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        range.$gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        range.$lte = toDate;
      }
    }
    if (Object.keys(range).length > 0) {
      query.completedAt = range;
    }
  }

  if (status && VALID_STATUS.has(status)) {
    query.status = status;
  }

  if (equipmentId && mongoose.isValidObjectId(equipmentId)) {
    query.equipment = equipmentId;
  }

  if (checklistId && mongoose.isValidObjectId(checklistId)) {
    query.checklist = checklistId;
  }

  let technicianFilter: string | null = null;
  if (session.role === 'tecnico') {
    technicianFilter = String(session.id);
  } else if (technicianIdParam && mongoose.isValidObjectId(technicianIdParam)) {
    technicianFilter = technicianIdParam;
  }

  if (technicianFilter) {
    query.technician = technicianFilter;
  }

  const evaluations = await Evaluation.find(query)
    .sort({ completedAt: -1 })
    .populate('equipment', 'code type brand model plate')
    .populate('technician', 'name email role')
    .populate('checklist', 'name equipmentType')
    .lean();

  return NextResponse.json(evaluations);
}
