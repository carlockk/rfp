
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { getSession, requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sanitizeEquipmentPayload } from '@/lib/equipmentPayload';

const uniqueObjectIds = (ids = []) => {
  const seen = new Set();
  return ids
    .map((raw) => (typeof raw === 'string' ? raw.trim() : ''))
    .filter((value) => value && mongoose.isValidObjectId(value))
    .reduce((acc, value) => {
      if (!seen.has(value)) {
        seen.add(value);
        acc.push(value);
      }
      return acc;
    }, []);
};

const normalizeOperators = (rawOperators = []) => {
  const ids = uniqueObjectIds(rawOperators);
  return ids.map((id) => ({
    user: new mongoose.Types.ObjectId(id),
    assignedAt: new Date()
  }));
};

export async function GET(){
  const session = await getSession();
  if (!session?.id) {
    return new Response('No autenticado', { status: 401 });
  }

  await dbConnect();

  const baseQuery = { isActive: true };
  let query = baseQuery;
  let projection = null;

  if (session.role === 'admin' || session.role === 'superadmin') {
    // Admins ven todos los equipos y sus documentos.
    query = baseQuery;
  } else if (session.role === 'tecnico') {
    const userId = mongoose.Types.ObjectId.isValid(session.id)
      ? new mongoose.Types.ObjectId(session.id)
      : null;
    if (!userId) {
      return new Response('Sesion invalida', { status: 400 });
    }
    query = {
      ...baseQuery,
      $or: [
        { assignedTo: userId },
        { operators: { $elemMatch: { user: userId } } }
      ]
    };
    projection = 'code type brand model plate fuel adblue notes hourmeterBase odometerBase assignedTo assignedAt operators createdAt updatedAt';
  } else {
    return new Response('No autorizado', { status: 403 });
  }

  const findQuery = Equipment.find(query)
    .sort({ createdAt: -1 });

  if (projection) {
    findQuery.select(projection);
  } else {
    findQuery
      .populate('operators.user','name email role techProfile')
      .populate('documents.uploadedBy','name email');
  }

  const items = await findQuery.lean();
  return Response.json(items);
}

export async function POST(req){
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status:403 });

  let data;
  try {
    data = await req.json();
  } catch {
    return new Response('Payload invalido', { status: 400 });
  }

  let sanitized;
  try {
    sanitized = sanitizeEquipmentPayload(data);
  } catch (err) {
    return new Response(err.message || 'Datos invalidos', { status: 400 });
  }

  await dbConnect();

  const operators = normalizeOperators(data.operators || []);
  const payload = {
    ...sanitized,
    operators
  };
  if (operators.length) {
    payload.assignedTo = operators[0].user;
    payload.assignedAt = operators[0].assignedAt;
  } else {
    payload.assignedTo = null;
    payload.assignedAt = null;
  }

  const created = await Equipment.create(payload);

  await logAudit({
    req,
    userId: typeof ses.id === 'string' ? ses.id : undefined,
    action: 'equipment.create',
    module: 'equipment',
    subject: created.code,
    subjectId: created._id,
    details: {
      equipmentId: created._id.toString(),
      type: created.type,
      fuel: created.fuel,
      operatorCount: operators.length
    }
  });

  const populated = await Equipment.findById(created._id)
    .populate('operators.user','name email role techProfile')
    .lean();

  return Response.json(populated);
}
