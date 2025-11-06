import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import EvaluationTemplate from '@/models/EvaluationTemplate';

function serialize(template: Record<string, any>) {
  if (!template) return null;
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

export async function GET(req: NextRequest) {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const profile = searchParams.get('profile');
  const onlyActive = searchParams.get('active') !== 'false';
  const equipmentType = searchParams.get('equipmentType');

  const query: Record<string, unknown> = {};
  if (onlyActive) query.isActive = true;
  if (profile && ['externo', 'candelaria', 'todos'].includes(profile)) {
    query.techProfile = { $in: [profile, 'todos'] };
  }
  if (equipmentType) {
    query.$or = [
      { equipmentTypes: { $size: 0 } },
      { equipmentTypes: equipmentType }
    ];
  }

  const templates = await EvaluationTemplate.find(query).sort({ updatedAt: -1 }).lean();
  return NextResponse.json(templates.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  if (!payload?.name || typeof payload.name !== 'string') {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }

  const techProfile = payload.techProfile || 'todos';
  if (!['externo', 'candelaria', 'todos'].includes(techProfile)) {
    return NextResponse.json({ error: 'Perfil tecnico invalido' }, { status: 400 });
  }

  await dbConnect();

  try {
    const template = await EvaluationTemplate.create({
      name: payload.name.trim(),
      description: typeof payload.description === 'string' ? payload.description.trim() : '',
      techProfile,
      equipmentTypes: Array.isArray(payload.equipmentTypes)
        ? payload.equipmentTypes.filter((item: unknown) => typeof item === 'string' && item.trim())
        : [],
      equipmentIds: Array.isArray(payload.equipmentIds)
        ? payload.equipmentIds
            .filter((id: unknown) => typeof id === 'string' && mongoose.isValidObjectId(id))
        : [],
      isChecklistMandatory: payload.isChecklistMandatory !== false,
      fields: Array.isArray(payload.fields) ? payload.fields : [],
      attachmentsEnabled: payload.attachmentsEnabled !== false,
      maxAttachments: typeof payload.maxAttachments === 'number' && payload.maxAttachments > 0
        ? Math.min(payload.maxAttachments, 10)
        : 3,
      createdBy: session.id,
      updatedBy: session.id
    });

    return NextResponse.json(serialize(template.toObject()), { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json({ error: 'Ya existe una plantilla con ese nombre' }, { status: 409 });
    }
    console.error('Error creando plantilla de evaluacion', err);
    return NextResponse.json({ error: 'Error creando plantilla' }, { status: 500 });
  }
}
