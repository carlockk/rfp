import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { dbConnect } from './db.js';
import Role from '@/models/Role.js';
import Permission from '@/models/Permission.js';
import RolePermission from '@/models/RolePermission.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

type SessionPayload = {
  id: string;
  role?: string;
  [key: string]: unknown;
};

const forbiddenResponse = () =>
  NextResponse.json({ error: 'Forbidden' }, { status: 403 });

export type RequirePermissionResult = SessionPayload | NextResponse;

export async function requirePermission(
  req: NextRequest,
  permissionKey: string
): Promise<RequirePermissionResult> {
  const token = req.cookies.get('token')?.value;
  if (!token) return forbiddenResponse();

  let session: SessionPayload;
  try {
    session = jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return forbiddenResponse();
  }

  if (!session?.role) return forbiddenResponse();

  const roleKey = String(session.role).toLowerCase().trim();
  if (roleKey === 'superadmin') return session;

  await dbConnect();

  const normalizedKey = permissionKey.toLowerCase().trim();

  const [roleDoc, permissionDoc] = await Promise.all([
    Role.findOne({ key: roleKey }).lean<Record<string, any>>(),
    Permission.findOne({ key: normalizedKey }).lean<Record<string, any>>()
  ]);

  if (!roleDoc || !permissionDoc) return forbiddenResponse();

  const binding = await RolePermission.exists({
    role: roleDoc._id,
    permission: permissionDoc._id
  });

  if (!binding) return forbiddenResponse();

  return session;
}
