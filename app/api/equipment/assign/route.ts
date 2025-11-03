import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import User from '@/models/User';
import { requirePermission } from '@/lib/authz';
import { logAudit } from '@/lib/audit';

type AssignBody = {
  equipmentId?: string;
  userId?: string | null;
};

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'asignar_equipo');
  if (auth instanceof NextResponse) return auth;

  let payload: AssignBody;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const { equipmentId, userId } = payload || {};

  if (!equipmentId || !mongoose.isValidObjectId(equipmentId)) {
    return NextResponse.json({ error: 'equipmentId requerido' }, { status: 400 });
  }

  const normalizedUserId =
    typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null;

  if (normalizedUserId && !mongoose.isValidObjectId(normalizedUserId)) {
    return NextResponse.json({ error: 'userId invalido' }, { status: 400 });
  }

  await dbConnect();

  const equipment = await Equipment.findById(equipmentId);

  if (!equipment) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  let user = null;
  if (normalizedUserId) {
    user = await User.findById(normalizedUserId).lean();
    if (!user || user.role !== 'tecnico') {
      return NextResponse.json({ error: 'Usuario invalido para asignacion' }, { status: 400 });
    }
  }

  equipment.assignedTo = user ? user._id : null;
  equipment.assignedAt = user ? new Date() : null;
  await equipment.save();

  await logAudit({
    req,
    userId: typeof auth.id === 'string' ? auth.id : undefined,
    action: 'equipment.assign',
    module: 'equipment',
    subject: equipment.code,
    subjectId: equipment._id,
    details: {
      equipmentId: equipment._id.toString(),
      assignedTo: equipment.assignedTo?.toString(),
      assignedAt: equipment.assignedAt
    }
  });

  return NextResponse.json({
    equipment: {
      id: equipment._id.toString(),
      code: equipment.code,
      type: equipment.type,
      brand: equipment.brand,
      model: equipment.model,
      assignedTo: equipment.assignedTo?.toString() || null,
      assignedAt: equipment.assignedAt
    }
  });
}
