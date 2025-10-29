import { dbConnect } from '@/lib/db';
import EquipmentType from '@/models/EquipmentType';
import { requireRole } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  const types = await EquipmentType.find({}).sort({ name: 1 }).lean();
  return Response.json(types);
}

export async function POST(req) {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) {
    return new Response('Forbidden', { status: 403 });
  }

  const { name } = await req.json();
  if (!name || !name.trim()) {
    return new Response('Nombre requerido', { status: 400 });
  }

  await dbConnect();

  const normalized = name.trim();
  const existing = await EquipmentType.findOne({ name: new RegExp(`^${normalized}$`, 'i') });
  if (existing) {
    return Response.json(existing);
  }

  const created = await EquipmentType.create({ name: normalized });
  return Response.json(created);
}
