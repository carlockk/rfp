import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import EvaluationTemplate from '@/models/EvaluationTemplate';

function serialize(template: Record<string, any>) {
  return {
    id: template._id.toString(),
    name: template.name,
    description: template.description,
    techProfile: template.techProfile,
    equipmentTypes: template.equipmentTypes || [],
    equipmentIds: (template.equipmentIds || []).map((id: mongoose.Types.ObjectId) => id.toString()),
    isChecklistMandatory: template.isChecklistMandatory,
    fields: template.fields || [],
    attachmentsEnabled: template.attachmentsEnabled,
    maxAttachments: template.maxAttachments,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  await dbConnect();

  const template = await EvaluationTemplate.findById(id).lean();
  if (!template) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }

  return NextResponse.json(serialize(template));
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  await dbConnect();

  const updates: Record<string, unknown> = {};

  if (typeof payload.name === 'string' && payload.name.trim()) {
    updates.name = payload.name.trim();
  }
  if (typeof payload.description === 'string') {
    updates.description = payload.description.trim();
  }
  if (payload.techProfile && ['externo', 'candelaria', 'todos'].includes(payload.techProfile)) {
    updates.techProfile = payload.techProfile;
  }
  if (Array.isArray(payload.equipmentTypes)) {
    updates.equipmentTypes = payload.equipmentTypes.filter((item: unknown) => typeof item === 'string' && item.trim());
  }
  if (Array.isArray(payload.equipmentIds)) {
    updates.equipmentIds = payload.equipmentIds
      .filter((id: unknown) => typeof id === 'string' && mongoose.isValidObjectId(id));
  }
  if (typeof payload.isChecklistMandatory === 'boolean') {
    updates.isChecklistMandatory = payload.isChecklistMandatory;
  }
  if (Array.isArray(payload.fields)) {
    updates.fields = payload.fields;
  }
  if (typeof payload.attachmentsEnabled === 'boolean') {
    updates.attachmentsEnabled = payload.attachmentsEnabled;
  }
  if (typeof payload.maxAttachments === 'number' && payload.maxAttachments > 0) {
    updates.maxAttachments = Math.min(payload.maxAttachments, 10);
  }
  if (typeof payload.isActive === 'boolean') {
    updates.isActive = payload.isActive;
  }

  updates.updatedBy = session.id;

  try {
    const template = await EvaluationTemplate.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean();
    if (!template) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
    }
    return NextResponse.json(serialize(template));
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json({ error: 'Ya existe una plantilla con ese nombre' }, { status: 409 });
    }
    console.error('Error actualizando plantilla de evaluacion', err);
    return NextResponse.json({ error: 'Error actualizando plantilla' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = params.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  await dbConnect();

  const template = await EvaluationTemplate.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  if (!template) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
