import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { assertSafeText, isValidEmail, isValidPassword, isValidPhone, sanitizeEmail, sanitizePhone } from '@/lib/validation';

function sanitize(user) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    email: user.email,
    role: user.role,
    techProfile: user.techProfile || '',
    phone: user.phone || '',
    createdAt: user.createdAt?.toISOString?.() || new Date().toISOString()
  };
}

export async function GET(req) {
  try {
    const ses = await requireRole(['admin', 'superadmin']);
    if (!ses) return new Response('Unauthorized', { status: 401 });
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get('role');

  const query = {};
  const validFilters = ['admin', 'tecnico', 'supervisor'];

  if (ses.role === 'admin') {
    if (roleFilter && validFilters.includes(roleFilter)) {
      query.role = { $ne: 'superadmin', $in: [roleFilter] };
    } else {
      query.role = { $ne: 'superadmin' };
    }
  } else if (roleFilter && validFilters.includes(roleFilter)) {
    query.role = roleFilter;
  }

    const users = await User.find(query, { password: 0 }).sort({ createdAt: -1 }).lean();
    return Response.json(users.map(sanitize));
  } catch (err) {
    console.error('GET /api/users error', err);
    return new Response('Error interno', { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ses = await requireRole(['admin', 'superadmin']);
    if (!ses) return new Response('Unauthorized', { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response('Payload invalido', { status: 400 });
    }

    const { name = '', email, password, role, techProfile = '', phone = '' } = body || {};

    const normalizedName = assertSafeText(name, { minLength: 2, maxLength: 80 });
    if (!normalizedName) {
      return new Response('Nombre invalido', { status: 400 });
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return new Response('Email invalido', { status: 400 });
    }

    if (!isValidPassword(password, { minLength: 6, maxLength: 120 })) {
      return new Response('La contrasena debe tener al menos 6 caracteres', { status: 400 });
    }

    const allowedRoles = ses.role === 'admin'
      ? ['admin', 'tecnico', 'supervisor']
      : ['admin', 'tecnico', 'superadmin', 'supervisor'];
    if (!allowedRoles.includes(role)) {
      return new Response('Rol invalido', { status: 400 });
    }

    const normalizedPhone = sanitizePhone(phone);
    if (role === 'supervisor' && !isValidPhone(normalizedPhone)) {
      return new Response('Telefono invalido para supervisor', { status: 400 });
    }

    await dbConnect();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return new Response('Email ya registrado', { status: 409 });
    }

    const allowedProfiles = ['externo', 'candelaria'];
    const profile =
      role === 'tecnico'
        ? allowedProfiles.includes(techProfile) ? techProfile : 'externo'
        : '';

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashed,
      role,
      techProfile: profile,
      phone: role === 'supervisor' ? normalizedPhone : ''
    });

    await logAudit({
      req,
      userId: typeof ses.id === 'string' ? ses.id : undefined,
      action: 'user.create',
      module: 'users',
      subject: user.email,
      subjectId: user._id,
      details: {
        userId: user._id.toString(),
        role: user.role,
        techProfile: user.techProfile || ''
      }
    });

    return Response.json(sanitize(user));
  } catch (err) {
    console.error('POST /api/users error', err);
    return new Response('Error interno', { status: 500 });
  }
}
