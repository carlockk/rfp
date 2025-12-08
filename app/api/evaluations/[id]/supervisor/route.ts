import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSession } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import User from '@/models/User';
import { sendMail } from '@/lib/mailer';

const ALLOWED_STATUS = new Set(['en_revision', 'aprobado', 'rechazado']);

export async function PUT(req: Request, { params }: { params?: { id?: string } }) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const role = String(session.role || '').toLowerCase();
  const canUpdate = ['supervisor', 'admin', 'superadmin'].includes(role);
  if (!canUpdate) {
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

  if (status === 'rechazado' && !note) {
    return NextResponse.json({ error: 'Nota requerida al rechazar' }, { status: 400 });
  }

  await dbConnect();

  const evaluation = await Evaluation.findById(id)
    .populate('technician', 'email name')
    .populate('equipment', 'code')
    .populate('supervisor', 'name email phone');

  if (!evaluation) {
    return NextResponse.json({ error: 'Evaluacion no encontrada' }, { status: 404 });
  }

  if (role === 'supervisor') {
    if (evaluation.supervisor && evaluation.supervisor.toString() !== String(session.id)) {
      return NextResponse.json({ error: 'No autorizado para esta evaluacion' }, { status: 403 });
    }
    if (!evaluation.supervisor) {
      evaluation.supervisor = session.id as any;
    }
  }

  const supervisorDoc =
    evaluation.supervisor != null
      ? await User.findById(evaluation.supervisor).lean<Record<string, any>>()
      : null;

  evaluation.supervisorStatus = status as any;
  evaluation.supervisorStatusAt = new Date();
  evaluation.supervisorAssignedAt = evaluation.supervisorAssignedAt || new Date();
  evaluation.supervisorNote = status === 'rechazado' ? note : '';
  evaluation.supervisorName =
    supervisorDoc?.name || supervisorDoc?.email || evaluation.supervisorName || '';
  evaluation.supervisorPhone = supervisorDoc?.phone || evaluation.supervisorPhone || '';

  await evaluation.save();

  if (status === 'rechazado') {
    const technician: any = evaluation.technician;
    if (technician?.email) {
      const subject = `Checklist rechazado${evaluation.equipment?.code ? ` - ${evaluation.equipment.code}` : ''}`;
      const textLines = [
        `Hola ${technician.name || 'operador'},`,
        '',
        'Tu checklist fue rechazado por el supervisor.',
        `Estado: ${status}`,
        note ? `Motivo: ${note}` : '',
        evaluation.equipment?.code ? `Equipo: ${evaluation.equipment.code}` : '',
        `Fecha: ${new Date().toLocaleString()}`
      ].filter(Boolean);
      try {
        await sendMail({
          to: technician.email,
          subject,
          text: textLines.join('\n'),
          html: undefined
        });
      } catch (err) {
        console.error('No se pudo notificar rechazo al operador', err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    status: evaluation.supervisorStatus,
    note: evaluation.supervisorNote,
    supervisorStatusAt: evaluation.supervisorStatusAt
  });
}
