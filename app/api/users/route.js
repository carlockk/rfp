import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { requireRole } from '@/lib/auth';

function sanitize(user) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    email: user.email,
    role: user.role,
    createdAt: user.createdAt?.toISOString?.() || new Date().toISOString()
  };
}

export async function GET() {
  const ses = await requireRole('superadmin');
  if (!ses) return new Response('Unauthorized', { status: 401 });
  await dbConnect();
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean();
  return Response.json(users.map(sanitize));
}

export async function POST(req) {
  const ses = await requireRole('superadmin');
  if (!ses) return new Response('Unauthorized', { status: 401 });
  const { name = '', email, password, role } = await req.json();

  if (!email || !password || !role) {
    return new Response('Datos incompletos', { status: 400 });
  }

  const allowedRoles = ['admin', 'tecnico', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    return new Response('Rol invalido', { status: 400 });
  }

  if (password.length < 6) {
    return new Response('La contrasena debe tener al menos 6 caracteres', { status: 400 });
  }

  await dbConnect();

  const existing = await User.findOne({ email });
  if (existing) {
    return new Response('Email ya registrado', { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role
  });

  return Response.json(sanitize(user));
}
