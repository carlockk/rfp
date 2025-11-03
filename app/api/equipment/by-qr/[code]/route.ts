import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { getSession } from '@/lib/auth';

type Params = {
  params: {
    code?: string;
  };
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const rawCode = params?.code ? decodeURIComponent(params.code) : '';
  const normalizedCode = rawCode.trim();

  if (!normalizedCode) {
    return NextResponse.json({ error: 'Codigo requerido' }, { status: 400 });
  }

  await dbConnect();

  const equipment = await Equipment.findOne({
    code: new RegExp(`^${escapeRegex(normalizedCode)}$`, 'i'),
    isActive: true
  }).lean();

  if (!equipment) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  const assignedToCurrent =
    equipment.assignedTo &&
    equipment.assignedTo.toString() === String(session.id);

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
      isActive: equipment.isActive
    },
    assignedToCurrent
  });
}
