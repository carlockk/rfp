
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { requireRole } from '@/lib/auth';

export async function GET(){
  await dbConnect();
  const items = await Equipment.find({}).sort({createdAt:-1}).lean();
  return Response.json(items);
}

export async function POST(req){
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status:403 });
  const data = await req.json();
  await dbConnect();
  const created = await Equipment.create(data);
  return Response.json(created);
}
