import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Checklist from '@/models/Checklist';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@/lib/authz';
import { logAudit } from '@/lib/audit';
import { normalizeChecklistNodes, serializeChecklist } from '@/lib/checklists';

const PROFILE_KEYS = new Set(['externo', 'candelaria', 'todos']);

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeProfiles(value: unknown): string[] {
  const profiles = normalizeStringArray(value).map((item) => item.toLowerCase());
  if (!profiles.length) return [];
  const set = new Set<string>();
  profiles.forEach((profile) => {
    if (!PROFILE_KEYS.has(profile)) return;
    if (profile === 'todos') {
      set.add('externo');
      set.add('candelaria');
    } else {
      set.add(profile);
    }
  });
  return Array.from(set);
}

function normalizeEquipmentTypes(value: unknown): string[] {
  return normalizeStringArray(value).map((item) => item.toLowerCase());
}

function normalizeEquipmentIds(value: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(value)) return [];
  const ids: mongoose.Types.ObjectId[] = [];
  const seen = new Set<string>();
  value.forEach((raw) => {
    if (typeof raw !== 'string') return;
    if (!mongoose.isValidObjectId(raw)) return;
    const key = raw.toString();
    if (seen.has(key)) return;
    seen.add(key);
    ids.push(new mongoose.Types.ObjectId(raw));
  });
  return ids;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const equipmentType = searchParams.get('equipmentType');
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const includeStructure = searchParams.get('includeStructure') === 'true';
  const versionParam = searchParams.get('version');
  const search = searchParams.get('search');

  const query: Record<string, unknown> = {};

  if (!includeInactive) {
    query.isActive = true;
    query.deletedAt = null;
  }

  if (equipmentType) {
    const normalized = equipmentType.trim();
    if (normalized) {
      const regex = new RegExp(`^${normalized}$`, 'i');
      query.$or = [
        ...(Array.isArray(query.$or) ? query.$or : []),
        { equipmentType: regex },
        { equipmentTypes: regex }
      ];
    }
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: regex },
      { description: regex },
      { equipmentType: regex },
      { tags: regex }
    ];
  }

  const records = await Checklist.find(query).sort({ name: 1 }).lean();
  const versionNumber = versionParam ? Number(versionParam) : undefined;

  const payload = records.map((record) =>
    serializeChecklist(record, includeStructure, versionNumber)
  );

  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'editar_checklist');
  if (auth instanceof NextResponse) return auth;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const {
    name,
    description = '',
    equipmentType = '',
    tags = [],
    nodes = [],
    notes = ''
  } = payload || {};

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return NextResponse.json({ error: 'Checklist requiere al menos un nodo' }, { status: 400 });
  }

  let normalizedNodes;
  try {
    normalizedNodes = normalizeChecklistNodes(nodes);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Estructura invalida' }, { status: 400 });
  }

  const normalizedTags = Array.isArray(tags)
    ? tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
    : [];

  const normalizedEquipmentTypes = normalizeEquipmentTypes(payload.equipmentTypes ?? []);
  const normalizedEquipmentIds = normalizeEquipmentIds(payload.equipmentIds ?? []);

  const allowedProfilesRaw = normalizeProfiles(payload.allowedProfiles ?? []);
  const mandatoryProfilesRaw = normalizeProfiles(payload.mandatoryProfiles ?? []);
  const allowedProfiles =
    allowedProfilesRaw.length === 0 && mandatoryProfilesRaw.length === 0
      ? []
      : Array.from(new Set([...allowedProfilesRaw, ...mandatoryProfilesRaw]));
  const mandatoryProfiles = mandatoryProfilesRaw.filter((profile) =>
    allowedProfiles.length ? allowedProfiles.includes(profile) : true
  );

  const equipmentTypeValue =
    typeof equipmentType === 'string' && equipmentType.trim()
      ? equipmentType.trim()
      : normalizedEquipmentTypes[0] || '';

  await dbConnect();

  const created = await Checklist.create({
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    equipmentType: equipmentTypeValue,
    equipmentTypes: normalizedEquipmentTypes,
    equipmentIds: normalizedEquipmentIds,
    allowedProfiles,
    mandatoryProfiles,
    tags: normalizedTags,
    currentVersion: 1,
    versions: [
      {
        version: 1,
        title: name.trim(),
        summary: typeof description === 'string' ? description.trim() : '',
        notes: typeof notes === 'string' ? notes.trim() : '',
        nodes: normalizedNodes,
        createdBy: typeof auth.id === 'string' && auth.id ? auth.id : undefined
      }
    ]
  });

  await logAudit({
    req,
    userId: typeof auth.id === 'string' ? auth.id : undefined,
    action: 'checklist.create',
    module: 'checklists',
    subject: created.name,
    subjectId: created._id,
    details: {
      checklistId: created._id.toString(),
      equipmentType: created.equipmentType,
      version: 1,
      nodeCount: normalizedNodes.length
    }
  });

  return NextResponse.json(serializeChecklist(created.toObject(), true), { status: 201 });
}
