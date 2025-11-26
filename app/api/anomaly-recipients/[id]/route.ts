import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { requirePermission } from '@/lib/authz';
import AnomalyRecipient from '@/models/AnomalyRecipient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, 'editar_checklist');
  if (auth instanceof NextResponse) return auth;

  const id = params?.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  }

  let payload: { name?: string; email?: string; active?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof payload?.name === 'string' && payload.name.trim()) {
    update.name = payload.name.trim();
  }
  if (typeof payload?.email === 'string' && payload.email.trim()) {
    const email = payload.email.trim();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
    }
    update.email = email.toLowerCase();
  }
  if (typeof payload?.active === 'boolean') {
    update.active = payload.active;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  await dbConnect();

  if (update.email) {
    const existing = await AnomalyRecipient.findOne({
      email: update.email,
      _id: { $ne: id }
    }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Correo ya utilizado' }, { status: 409 });
    }
  }

  const doc = await AnomalyRecipient.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true }
  ).lean();

  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    active: Boolean(doc.active),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, 'editar_checklist');
  if (auth instanceof NextResponse) return auth;

  const id = params?.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'id invalido' }, { status: 400 });
  }

  await dbConnect();
  const result = await AnomalyRecipient.findByIdAndDelete(id).lean();
  if (!result) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
