import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(_req, { params }) {
  await dbConnect();
  const item = await Equipment.findOne({ _id: params.id, isActive: true }).lean();
  if (!item) return new Response('Not found', { status: 404 });
  return Response.json(item);
}

export async function PUT(req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });
  await dbConnect();
  const data = await req.json();
  const payload = { ...data, updatedAt: data.updatedAt ?? new Date() };
  const updated = await Equipment.findOneAndUpdate(
    { _id: params.id, isActive: true },
    payload,
    { new: true, runValidators: true }
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
  const updated = await Equipment.findOneAndUpdate(
    { _id: params.id, isActive: true },
    { isActive: false, deletedAt: new Date(), assignedTo: null, assignedAt: null },
    { new: true }
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
