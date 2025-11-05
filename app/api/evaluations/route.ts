import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import Checklist from '@/models/Checklist';
import Equipment from '@/models/Equipment';
import Notification from '@/models/Notification';
import PushSubscription from '@/models/PushSubscription';
import User from '@/models/User';
import { broadcastPush, isPushAvailable } from '@/lib/push';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@/lib/authz';
import { logAudit } from '@/lib/audit';

const VALID_STATUS = new Set(['ok', 'observado', 'critico']);

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

  const { checklistId, equipmentId } = payload || {};

  if (!checklistId || !mongoose.isValidObjectId(checklistId)) {
    return NextResponse.json({ error: 'checklistId invalido' }, { status: 400 });
  }

  if (!equipmentId || !mongoose.isValidObjectId(equipmentId)) {
    return NextResponse.json({ error: 'equipmentId invalido' }, { status: 400 });
  }

  await dbConnect();

  const [checklist, equipment] = await Promise.all([
    Checklist.findById(checklistId).lean<Record<string, any>>(),
    Equipment.findById(equipmentId).lean<Record<string, any>>()
  ]);

  if (!checklist) {
    return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 });
  }

  if (!equipment) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  if (session.role === 'tecnico') {
    const assignedTo = equipment.assignedTo?.toString();
    if (assignedTo !== String(session.id)) {
      return NextResponse.json({ error: 'No autorizado para este equipo' }, { status: 403 });
    }
  }

  const responses = sanitizeResponses(payload.responses);
  if (responses.length === 0) {
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
    typeof payload.durationSeconds === 'number' && Number.isFinite(payload.durationSeconds) && payload.durationSeconds >= 0
      ? Math.round(payload.durationSeconds)
      : Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));

  const formData = payload.formData && typeof payload.formData === 'object' ? payload.formData : {};

  const checklistVersion =
    typeof payload.checklistVersion === 'number' && payload.checklistVersion > 0
      ? payload.checklistVersion
      : Number(checklist.version || 1);

  if (Number.isNaN(completedAt.getTime())) {
    return NextResponse.json({ error: 'Fecha invalida' }, { status: 400 });
  }

  const evaluation = await Evaluation.create({
    checklist: checklist._id,
    equipment: equipment._id,
    technician: session.id,
    status,
    observations,
    responses,
    startedAt,
    finishedAt,
    durationSeconds,
    formData,
    checklistVersion,
    completedAt
  });

  if (status === 'critico') {
    const notification = await Notification.create({
      message: `Falla critica detectada en ${equipment.code} (${checklist.name}).`,
      type: 'alert',
      level: 'high',
      audience: 'admin',
      metadata: {
        evaluationId: evaluation._id.toString(),
        checklistId: checklist._id.toString(),
        equipmentId: equipment._id.toString(),
        technicianId: session.id
      }
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
            body: `${equipment.code} - ${checklist.name}` ,
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
    subject: checklist.name || 'Checklist',
    subjectId: evaluation._id,
    details: {
      evaluationId: evaluation._id.toString(),
      checklistId: checklist._id.toString(),
      equipmentId: equipment._id.toString(),
      status,
      responseCount: responses.length,
      startedAt,
      finishedAt,
      durationSeconds,
      checklistVersion
    }
  });

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



