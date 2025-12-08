import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import User from '@/models/User';

export async function GET() {
  const session = await getSession();
  if (!session?.id) {
    return new Response('No autenticado', { status: 401 });
  }

  await dbConnect();

  const supervisors = await User.find({ role: 'supervisor' }, { name: 1, email: 1, phone: 1 })
    .sort({ name: 1, email: 1 })
    .lean();

  const payload = supervisors.map((item) => ({
    id: item._id.toString(),
    name: item.name || '',
    email: item.email || '',
    phone: item.phone || ''
  }));

  return Response.json(payload);
}
