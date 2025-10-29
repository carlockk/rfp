
import { dbConnect } from '@/lib/db';
import Reading from '@/models/Reading';
import { getSession } from '@/lib/auth';

export async function GET(req){
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const equipmentId = searchParams.get('equipmentId');
  const q = equipmentId ? { equipmentId } : {};
  const items = await Reading.find(q).sort({createdAt:-1}).limit(50).lean();
  return Response.json(items);
}

export async function POST(req){
  await dbConnect();
  const ses = await getSession();
  const data = await req.json();
  const created = await Reading.create({
    ...data,
    userId: ses?.id || null
  });
  return Response.json(created);
}
