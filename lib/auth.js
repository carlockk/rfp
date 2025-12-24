import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { dbConnect } from './db.js';
import User from '@/models/User.js';

/**
 * @typedef {Object} SessionPayload
 * @property {string=} id
 * @property {string=} role
 * @property {string=} email
 */

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in env');
}

const isProd = process.env.NODE_ENV === 'production';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * @param {unknown} decoded
 * @returns {SessionPayload | null}
 */
function normalizeSession(decoded) {
  if (decoded && typeof decoded === 'object') {
    return /** @type {SessionPayload} */ (decoded);
  }
  return null;
}

export function setAuthCookie(token) {
  cookies().set('token', token, {
    httpOnly: true,
    secure: isProd,                 // En local: false, en prod: true
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7        // 7 días
  });
}

export function clearAuthCookie() {
  cookies().set('token', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 0
  });
}

// Leer sesión usando el contexto global de cookies (server components, etc.)
/** @returns {Promise<SessionPayload | null>} */
export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return normalizeSession(decoded);
  } catch (e) {
    return null;
  }
}

// Leer sesión directamente desde un NextRequest en un Route Handler
/** @returns {Promise<SessionPayload | null>} */
export async function getSessionFromRequest(req) {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return normalizeSession(decoded);
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
  return user
    ? {
        ...ses,
        email: user.email,
        name: user.name,
        role: user.role,
        techProfile: user.techProfile || ''
      }
    : null;
}
