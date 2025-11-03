import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Checklist from '@/models/Checklist';
import { requirePermission } from '@/lib/authz';
import { logAudit } from '@/lib/audit';
import { normalizeChecklistNodes, serializeChecklist } from '@/lib/checklists';

type Params = {
  params: {
    id?: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  const id = params?.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const includeStructure = searchParams.get('includeStructure') === 'true';
  const versionParam = searchParams.get('version');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const checklist = await Checklist.findById(id).lean<Record<string, any>>();
  if (!checklist) {
    return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 });
  }

  if (!includeInactive && (checklist.isActive === false || checklist.deletedAt)) {
    return NextResponse.json({ error: 'Checklist inactivo' }, { status: 404 });
  }

  const payload = serializeChecklist(
    checklist,
    includeStructure,
    versionParam ? Number(versionParam) : undefined
  );

  return NextResponse.json(payload);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requirePermission(req, 'editar_checklist');
  if (auth instanceof NextResponse) return auth;

  const id = params?.id || '';
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

  const checklist = await Checklist.findById(id);
  if (!checklist) {
    return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 });
  }

  if (checklist.deletedAt && payload.restore !== true) {
    return NextResponse.json({ error: 'Checklist eliminado logicamente' }, { status: 404 });
  }

  let hasChanges = false;
  const auditDetails: Record<string, unknown> = {};

  if (typeof payload.name === 'string' && payload.name.trim() && payload.name.trim() !== checklist.name) {
    checklist.name = payload.name.trim();
    auditDetails.name = checklist.name;
    hasChanges = true;
  }

  if (typeof payload.description === 'string' && payload.description.trim() !== checklist.description) {
    checklist.description = payload.description.trim();
    auditDetails.description = checklist.description;
    hasChanges = true;
  }

  if (typeof payload.equipmentType === 'string' && payload.equipmentType.trim() !== checklist.equipmentType) {
    checklist.equipmentType = payload.equipmentType.trim();
    auditDetails.equipmentType = checklist.equipmentType;
    hasChanges = true;
  }

  if (Array.isArray(payload.tags)) {
    const normalizedTags = payload.tags
      .map((tag: unknown) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean);
    if (JSON.stringify(normalizedTags) !== JSON.stringify(checklist.tags || [])) {
      checklist.tags = normalizedTags;
      auditDetails.tags = normalizedTags;
      hasChanges = true;
    }
  }

  if (Array.isArray(payload.nodes) && payload.nodes.length) {
    let normalizedNodes;
    try {
      normalizedNodes = normalizeChecklistNodes(payload.nodes);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Estructura invalida' }, { status: 400 });
    }

    const nextVersion = (checklist.currentVersion || 0) + 1;
    const versionTitle = typeof payload.versionTitle === 'string' && payload.versionTitle.trim()
      ? payload.versionTitle.trim()
      : checklist.name;
    const versionSummary = typeof payload.versionSummary === 'string' && payload.versionSummary.trim()
      ? payload.versionSummary.trim()
      : checklist.description || '';
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';

    checklist.versions.push({
      version: nextVersion,
      title: versionTitle,
      summary: versionSummary,
      notes,
      nodes: normalizedNodes,
      createdBy: typeof auth.id === 'string' ? auth.id : undefined
    });
    checklist.currentVersion = nextVersion;
    hasChanges = true;
    auditDetails.newVersion = nextVersion;
    auditDetails.nodeCount = normalizedNodes.length;
  }

  if (typeof payload.isActive === 'boolean') {
    checklist.isActive = payload.isActive;
    if (payload.isActive) {
      checklist.deletedAt = null;
    }
    auditDetails.isActive = checklist.isActive;
    hasChanges = true;
  }

  if (payload.restore === true) {
    checklist.isActive = true;
    checklist.deletedAt = null;
    auditDetails.restored = true;
    hasChanges = true;
  }

  if (!hasChanges) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  await checklist.save();

  await logAudit({
    req,
    userId: typeof auth.id === 'string' ? auth.id : undefined,
    action: 'checklist.update',
    module: 'checklists',
    subject: checklist.name,
    subjectId: checklist._id,
    details: {
      checklistId: checklist._id.toString(),
      ...auditDetails
    }
  });

  return NextResponse.json(serializeChecklist(checklist.toObject(), true));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePermission(req, 'editar_checklist');
  if (auth instanceof NextResponse) return auth;

  const id = params?.id || '';
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  await dbConnect();

  const updated = await Checklist.findByIdAndUpdate(
    id,
    { isActive: false, deletedAt: new Date() },
    { new: true }
  ).lean<Record<string, any>>();

  if (!updated) {
    return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 });
  }

  await logAudit({
    req,
    userId: typeof auth.id === 'string' ? auth.id : undefined,
    action: 'checklist.delete',
    module: 'checklists',
    subject: updated.name,
    subjectId: updated._id,
    details: {
      checklistId: updated._id.toString(),
      deletedAt: updated.deletedAt
    }
  });

  return NextResponse.json({ ok: true });
}
