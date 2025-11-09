import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { getSession } from '@/lib/auth';
import mongoose from 'mongoose';

type Params = {
  params: {
    code?: string;
  };
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractCandidates = (value: string): string[] => {
  const trimmed = (value || '').trim();
  if (!trimmed) return [];

  const derived = new Set<string>();
  const addCandidate = (candidate?: string | null) => {
    if (!candidate) return;
    const normalized = candidate.trim();
    if (normalized) {
      derived.add(normalized);
    }
  };

  const collectFromPath = (path?: string | null) => {
    if (!path) return;
    const parts = path
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      addCandidate(parts[parts.length - 1]);
    }
  };

  const parseAsUrl = (): URL | null => {
    try {
      return new URL(trimmed);
    } catch {
      try {
        if (trimmed.startsWith('/')) {
          return new URL(trimmed, 'http://placeholder.local');
        }
      } catch {
        return null;
      }
      return null;
    }
  };

  const urlCandidate = parseAsUrl();
  if (urlCandidate) {
    collectFromPath(urlCandidate.pathname);
    ['code', 'id', 'equipo', 'equipoId', 'equipment', 'equipmentId'].forEach(
      (key) => addCandidate(urlCandidate.searchParams.get(key))
    );
  } else if (trimmed.includes('/')) {
    collectFromPath(trimmed);
  }

  const objectIdMatch = trimmed.match(/[0-9a-fA-F]{24}/);
  if (objectIdMatch) {
    addCandidate(objectIdMatch[0]);
  }

  if (derived.size === 0) {
    derived.add(trimmed);
    return Array.from(derived);
  }

  if (!derived.has(trimmed)) {
    derived.add(trimmed);
  }

  return Array.from(derived);
};

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const rawCode = params?.code ? decodeURIComponent(params.code) : '';
  const candidates = extractCandidates(rawCode);
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Codigo requerido' }, { status: 400 });
  }

  await dbConnect();

  let equipment: Record<string, any> | null = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (mongoose.Types.ObjectId.isValid(candidate)) {
      equipment = await Equipment.findOne({
        _id: candidate,
        isActive: true
      })
        .lean<Record<string, any>>();
    }

    if (!equipment) {
      equipment = await Equipment.findOne({
        code: new RegExp(`^${escapeRegex(candidate)}$`, 'i'),
        isActive: true
      })
        .lean<Record<string, any>>();
    }

    if (equipment) {
      break;
    }
  }

  if (!equipment) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  const assignedToCurrent =
    (Array.isArray(equipment.operators) &&
      equipment.operators.some(
        (op: any) => op?.user && op.user.toString() === String(session.id)
      )) ||
    (equipment.assignedTo &&
      equipment.assignedTo.toString() === String(session.id));

  return NextResponse.json({
    equipment: {
      id: equipment._id.toString(),
      code: equipment.code,
      type: equipment.type,
      brand: equipment.brand,
      model: equipment.model,
      plate: equipment.plate,
      fuel: equipment.fuel,
      adblue: equipment.adblue,
      notes: equipment.notes,
      hourmeterBase: equipment.hourmeterBase,
      odometerBase: equipment.odometerBase,
      assignedTo: equipment.assignedTo ? equipment.assignedTo.toString() : null,
      assignedAt: equipment.assignedAt,
      isActive: equipment.isActive,
      operators: Array.isArray(equipment.operators)
        ? equipment.operators.map((op: any) => ({
            user: op?.user ? op.user.toString() : null,
            assignedAt: op?.assignedAt || null
          }))
        : []
    },
    assignedToCurrent
  });
}
