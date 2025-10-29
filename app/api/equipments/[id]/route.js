import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { requireRole } from '@/lib/auth';

export async function GET(_req, { params }) {
  await dbConnect();
  const item = await Equipment.findById(params.id).lean();
  if (!item) return new Response('Not found', { status: 404 });
  return Response.json(item);
}

export async function PUT(req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });
  await dbConnect();
  const data = await req.json();
  const payload = { ...data, updatedAt: data.updatedAt ?? new Date() };
  const updated = await Equipment.findByIdAndUpdate(params.id, payload, { new: true, runValidators: true });
  return Response.json(updated);
}

export async function DELETE(_req, { params }) {
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status: 403 });
  await dbConnect();
  await Equipment.findByIdAndDelete(params.id);
  return Response.json({ ok: true });
}
