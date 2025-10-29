
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function POST(req){
  const { email, password } = await req.json();
  await dbConnect();
  const user = await User.findOne({ email });
  if (!user) return new Response('Unauthorized', { status:401 });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return new Response('Unauthorized', { status:401 });
  const token = signToken({ id:String(user._id), role:user.role });
  setAuthCookie(token);
  return Response.json({ ok:true, role:user.role });
}
