
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { dbConnect } from './db.js';
import User from '@/models/User.js';

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in env');
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function setAuthCookie(token) {
  cookies().set('token', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
}

export function clearAuthCookie() {
  cookies().set('token', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (e) {
    return null;
  }
}

/**
 * @param {string | string[]=} role
 */
export async function requireRole(role = 'admin') {
  const ses = await getSession();
  if (!ses) return null;
  if (!role) return ses;
  const allowed = Array.isArray(role) ? role : [role];
  if (allowed.includes(ses.role)) return ses;
  if (ses.role === 'superadmin') return ses;
  return null;
}

export async function getCurrentUser() {
  const ses = await getSession();
  if (!ses) return null;
  await dbConnect();
  const user = await User.findById(ses.id).lean();
  return user ? {
    ...ses,
    email: user.email,
    name: user.name,
    role: user.role,
    techProfile: user.techProfile || ''
  } : null;
}
