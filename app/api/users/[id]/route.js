import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { assertSafeText, isValidEmail, isValidPassword, isValidPhone, sanitizeEmail, sanitizePhone } from '@/lib/validation';

export async function PUT(req, { params }) {
  const ses = await requireRole('superadmin');
  if (!ses) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params?.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const updates = {};

  if (payload.name !== undefined) {
    const normalizedName = assertSafeText(payload.name, { minLength: 2, maxLength: 80 });
    if (!normalizedName) {
      return NextResponse.json({ error: 'Nombre invalido' }, { status: 400 });
    }
    updates.name = normalizedName;
  }

  if (payload.email !== undefined) {
    const normalizedEmail = sanitizeEmail(payload.email);
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 });
    }
    updates.email = normalizedEmail;
  }

  const allowedRoles = ['superadmin', 'admin', 'tecnico', 'supervisor'];
  if (payload.role) {
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
    }
    updates.role = payload.role;
  }

  let techProfile = payload.techProfile;
  if (updates.role === 'tecnico' || (!updates.role && payload.techProfile !== undefined)) {
    const allowedProfiles = ['externo', 'candelaria'];
    techProfile = allowedProfiles.includes(payload.techProfile) ? payload.techProfile : 'externo';
    updates.techProfile = techProfile;
  } else if (updates.role && updates.role !== 'tecnico') {
    updates.techProfile = '';
  }

  if (payload.password) {
    if (!isValidPassword(payload.password, { minLength: 6, maxLength: 120 })) {
      return NextResponse.json({ error: 'La contrasena debe tener al menos 6 caracteres' }, { status: 400 });
    }
    updates.password = await bcrypt.hash(payload.password, 10);
  }

  if (payload.phone !== undefined) {
    const normalizedPhone = sanitizePhone(payload.phone);
    if (!isValidPhone(normalizedPhone)) {
      return NextResponse.json({ error: 'Telefono invalido' }, { status: 400 });
    }
    updates.phone = normalizedPhone;
  }

  await dbConnect();

  if (updates.email) {
    const exists = await User.findOne({ _id: { $ne: id }, email: updates.email }).lean();
    if (exists) {
      return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 });
    }
  }

  const user = await User.findById(id);
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const nextRole = updates.role || user.role;
  const nextPhone = updates.phone !== undefined ? updates.phone : user.phone;
  if (nextRole === 'supervisor' && !isValidPhone(nextPhone)) {
    return NextResponse.json({ error: 'Supervisor requiere un telefono valido' }, { status: 400 });
  }

  Object.assign(user, updates);
  await user.save();

  await logAudit({
    req,
    userId: ses.id,
    action: 'user.update',
    module: 'users',
    subject: user.email,
    subjectId: user._id,
    details: {
      userId: user._id.toString(),
      updates: Object.keys(updates)
    }
  });

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name || '',
    email: user.email,
    role: user.role,
    techProfile: user.techProfile || '',
    phone: user.phone || '',
    createdAt: user.createdAt?.toISOString?.() || new Date().toISOString()
  });
}

export async function DELETE(req, { params }) {
  const ses = await requireRole('superadmin');
  if (!ses) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params?.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  await dbConnect();
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  await logAudit({
    req,
    userId: ses.id,
    action: 'user.delete',
    module: 'users',
    subject: user.email,
    subjectId: user._id,
    details: {
      userId: user._id.toString()
    }
  });

  return NextResponse.json({ ok: true });
}
