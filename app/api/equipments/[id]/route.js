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
  const timestamp = new Date();
  return ids.map((id, index) => ({
    user: new mongoose.Types.ObjectId(id),
    assignedAt: new Date(timestamp.getTime() + index)
  }));
};

const populateEquipment = (query) =>
  query
    .populate('operators.user', 'name email role techProfile')
    .populate('documents.uploadedBy', 'name email')
    .lean();

export async function GET(_req, { params }) {
  await dbConnect();
  const item = await populateEquipment(
    Equipment.findOne({ _id: params.id })
  );
  if (!item) return new Response('Not found', { status: 404 });
  return Response.json(item);
}

export async function PUT(req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });
  await dbConnect();
  const data = await req.json();

  const payload = { ...data, updatedAt: data.updatedAt ?? new Date() };

  if (Array.isArray(data.operators)) {
    const operators = normalizeOperators(data.operators);
    payload.operators = operators;
    if (operators.length) {
      payload.assignedTo = operators[0].user;
      payload.assignedAt = operators[0].assignedAt;
    } else {
      payload.assignedTo = null;
      payload.assignedAt = null;
    }
  }

  const updated = await populateEquipment(
    Equipment.findOneAndUpdate(
      { _id: params.id },
      payload,
      { new: true, runValidators: true }
    )
  );
  if (!updated) return new Response('Not found', { status: 404 });

  await logAudit({
    userId: typeof ses.id === 'string' ? ses.id : undefined,
    req,
    action: 'equipment.update',
    module: 'equipment',
    subject: updated.code,
    subjectId: updated._id,
    details: {
      equipmentId: updated._id.toString(),
      updates: Object.keys(payload)
    }
  });

  return Response.json(updated);
}

export async function DELETE(req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });
  await dbConnect();
  const updated = await populateEquipment(
    Equipment.findOneAndUpdate(
      { _id: params.id },
      { isActive: false, deletedAt: new Date(), assignedTo: null, assignedAt: null, operators: [] },
      { new: true }
    )
  );
  if (!updated) return new Response('Not found', { status: 404 });

  await logAudit({
    userId: typeof ses.id === 'string' ? ses.id : undefined,
    req,
    action: 'equipment.delete',
    module: 'equipment',
    subject: updated.code,
    subjectId: updated._id,
    details: {
      equipmentId: updated._id.toString(),
      deletedAt: updated.deletedAt
    }
  });

  return Response.json({ ok: true });
}
