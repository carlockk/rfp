import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (session.role !== 'tecnico') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  await dbConnect();
  const equipments = await Equipment.find({
    isActive: true,
    assignedTo: session.id
  })
    .select('code type brand model plate fuel assignedAt')
    .sort({ code: 1 })
    .lean();

  const payload = equipments.map((item) => ({
    id: item._id.toString(),
    code: item.code,
    type: item.type || '',
    brand: item.brand || '',
    model: item.model || '',
    plate: item.plate || '',
    fuel: item.fuel || '',
    assignedAt: item.assignedAt
      ? typeof item.assignedAt.toISOString === 'function'
        ? item.assignedAt.toISOString()
        : item.assignedAt
      : null
  }));

  return NextResponse.json(payload);
}
