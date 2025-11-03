import type { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import AuditLog from '@/models/AuditLog.js';

type AuditParams = {
  req: NextRequest;
  userId?: string | null;
  action: string;
  module: string;
  subject?: string;
  subjectId?: mongoose.Types.ObjectId | string | null;
  details?: Record<string, unknown>;
  permissionId?: mongoose.Types.ObjectId | string | null;
};

const toObjectId = (value?: string | null) => {
  if (!value || !mongoose.isValidObjectId(value)) return undefined;
  return new mongoose.Types.ObjectId(value);
};

export async function logAudit({
  req,
  userId,
  action,
  module,
  subject = '',
  subjectId,
  details,
  permissionId
}: AuditParams) {
  try {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.ip ||
      req.headers.get('x-real-ip') ||
      '';

    const userAgent = req.headers.get('user-agent') || '';

    await AuditLog.create({
      user: toObjectId(userId),
      action,
      module,
      subject,
      subjectId: subjectId ? toObjectId(typeof subjectId === 'string' ? subjectId : subjectId.toString()) : undefined,
      permission: permissionId ? toObjectId(typeof permissionId === 'string' ? permissionId : permissionId.toString()) : undefined,
      ip,
      userAgent,
      metadata: details || {}
    });
  } catch (err) {
    console.error('logAudit error', err);
  }
}
