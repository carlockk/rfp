
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Reading from '@/models/Reading';
import { getSession } from '@/lib/auth';
import { parseNumeric, assertSafeText } from '@/lib/validation';

const ALLOWED_KINDS = new Set(['uso','combustible','adblue','kwh','fin_uso']);
const MAX_NOTE_LENGTH = 280;

export async function GET(req){
  const session = await getSession();
  if (!session?.id) {
    return new Response('No autenticado', { status: 401 });
  }

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const equipmentId = searchParams.get('equipmentId');
  const q = {};

  if (equipmentId) {
    if (!mongoose.isValidObjectId(equipmentId)) {
      return new Response('equipmentId invalido', { status: 400 });
    }
    q.equipmentId = new mongoose.Types.ObjectId(equipmentId);
  }

  if (session.role === 'tecnico') {
    if (!mongoose.isValidObjectId(session.id)) {
      return new Response('Sesion invalida', { status: 400 });
    }
    if (!q.equipmentId) {
      return new Response('equipmentId requerido', { status: 400 });
    }
    q.userId = new mongoose.Types.ObjectId(session.id);
  }

  const items = await Reading.find(q).sort({createdAt:-1}).limit(50).lean();
  return Response.json(items);
}

export async function POST(req){
  const ses = await getSession();
  if (!ses?.id) {
    return new Response('No autenticado', { status: 401 });
  }
  if (!mongoose.isValidObjectId(ses.id)) {
    return new Response('Sesion invalida', { status: 400 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return new Response('Payload invalido', { status: 400 });
  }

  const equipmentId = typeof data?.equipmentId === 'string' ? data.equipmentId.trim() : '';
  if (!equipmentId || !mongoose.isValidObjectId(equipmentId)) {
    return new Response('equipmentId invalido', { status: 400 });
  }

  const kind = typeof data?.kind === 'string' && ALLOWED_KINDS.has(data.kind)
    ? data.kind
    : 'uso';

  const hourmeter = parseNumeric(data?.hourmeter, { min: 0 });
  const odometer = parseNumeric(data?.odometer, { min: 0 });
  const liters = parseNumeric(data?.liters, { min: 0 });
  const adblueLiters = parseNumeric(data?.adblueLiters, { min: 0 });
  const kwh = parseNumeric(data?.kwh, { min: 0 });
  const note = assertSafeText(data?.note, { minLength: 1, maxLength: MAX_NOTE_LENGTH }) || '';
  const photoUrl = typeof data?.photoUrl === 'string' && data.photoUrl.trim().startsWith('http')
    ? data.photoUrl.trim()
    : '';

  await dbConnect();

  const created = await Reading.create({
    equipmentId: new mongoose.Types.ObjectId(equipmentId),
    userId: new mongoose.Types.ObjectId(ses.id),
    kind,
    hourmeter,
    odometer,
    liters,
    adblueLiters,
    kwh,
    note,
    photoUrl: photoUrl || undefined
  });
  return Response.json(created);
}
