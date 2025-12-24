import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { requirePermission } from '@/lib/authz';
import { getSession } from '@/lib/auth';
import AnomalyRecipient from '@/models/AnomalyRecipient';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export async function GET(req: NextRequest) {
  const session = await getSession();
  const role =
    session && typeof session === 'object' && 'role' in session
      ? String((session as { role?: string }).role || '')
      : '';
  if (!role || !['tecnico', 'admin', 'superadmin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const recipients = await AnomalyRecipient.find(includeInactive ? {} : { active: true })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(
    recipients.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      email: item.email,
      active: Boolean(item.active),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  );
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'editar_checklist');
  if (auth instanceof NextResponse) return auth;

  let payload: { name?: string; email?: string; active?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const active = payload?.active !== false;

  if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
  }

  await dbConnect();

  const exists = await AnomalyRecipient.exists({ email: email.toLowerCase() });
  if (exists) {
    return NextResponse.json({ error: 'Ya existe un destinatario con ese correo' }, { status: 409 });
  }

  const doc = await AnomalyRecipient.create({
    name,
    email: email.toLowerCase(),
    active
  });

  return NextResponse.json(
    {
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      active: doc.active,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    },
    { status: 201 }
  );
}
