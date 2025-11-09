
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
  await dbConnect();
  const items = await Equipment.find({ isActive: true })
    .sort({createdAt:-1})
    .populate('operators.user','name email role techProfile')
    .populate('documents.uploadedBy','name email')
    .lean();
  return Response.json(items);
}

export async function POST(req){
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status:403 });
  const data = await req.json();
  await dbConnect();

  const operators = normalizeOperators(data.operators || []);
  const payload = {
    ...data,
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
