import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Notification from '@/models/Notification';
import { getSession } from '@/lib/auth';
import { buildComputedChecklistAlerts } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const includeComputed = searchParams.get('includeComputed') !== 'false';
  const limit = Number(searchParams.get('limit') || 20);

  const query: Record<string, unknown> = {
    $or: [
      { audience: 'all' }
    ]
  };

  if (session.role === 'admin' || session.role === 'superadmin') {
    query.$or.push({ audience: 'admin' });
  }

  if (session.role === 'tecnico') {
    query.$or.push({ audience: 'technician' });
    if (mongoose.isValidObjectId(session.id)) {
      query.$or.push({ recipients: new mongoose.Types.ObjectId(session.id) });
    }
  } else if (mongoose.isValidObjectId(session.id)) {
    query.$or.push({ recipients: new mongoose.Types.ObjectId(session.id) });
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const basePayload = notifications.map((item) => ({
    id: item._id.toString(),
    message: item.message,
    type: item.type,
    level: item.level,
    audience: item.audience,
    metadata: item.metadata || {},
    read: Array.isArray(item.readBy) && item.readBy.some((userId) => userId.toString() === session.id),
    createdAt: item.createdAt,
    expiresAt: item.expiresAt || null,
    computed: false
  }));

  if (!includeComputed) {
    return NextResponse.json(basePayload);
  }

  const computedAlerts = session.role === 'admin' || session.role === 'superadmin'
    ? await buildComputedChecklistAlerts()
    : [];

  const merged = [...computedAlerts, ...basePayload].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(merged.slice(0, limit));
}
