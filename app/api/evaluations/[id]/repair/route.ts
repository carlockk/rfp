import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ALLOWED_STATUS = new Set(['desviacion', 'en_reparacion', 'reparado']);

export async function PUT(req: NextRequest, { params }: { params?: { id?: string } }) {
  const session = await requireRole(['admin', 'superadmin', 'supervisor']);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const id = params?.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  let payload: { status?: string; note?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const status = typeof payload?.status === 'string' ? payload.status.trim() : '';
  const note = typeof payload?.note === 'string' ? payload.note.trim() : '';
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
  }

  await dbConnect();
  const evaluation = await Evaluation.findById(id);
  if (!evaluation) {
    return NextResponse.json({ error: 'Evaluacion no encontrada' }, { status: 404 });
  }
  if (evaluation.status !== 'critico') {
    return NextResponse.json({ error: 'Solo aplica a evaluaciones criticas' }, { status: 400 });
  }

  const now = new Date();
  evaluation.repairStatus = status as any;
  evaluation.repairNote = note;
  evaluation.repairUpdatedAt = now;
  evaluation.repairedAt = status === 'reparado' ? now : null;

  await evaluation.save();

  await logAudit({
    req,
    userId: typeof session.id === 'string' ? session.id : undefined,
    action: 'evaluation.repair.update',
    module: 'evaluations',
    subject: evaluation._id.toString(),
    subjectId: evaluation._id,
    details: {
      evaluationId: evaluation._id.toString(),
      repairStatus: evaluation.repairStatus,
      repairUpdatedAt: evaluation.repairUpdatedAt
    }
  });

  return NextResponse.json({
    ok: true,
    repairStatus: evaluation.repairStatus,
    repairNote: evaluation.repairNote,
    repairUpdatedAt: evaluation.repairUpdatedAt,
    repairedAt: evaluation.repairedAt
  });
}
