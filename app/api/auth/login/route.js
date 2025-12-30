
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie } from '@/lib/auth';
import { isValidLoginId, isValidPassword, sanitizeLoginId } from '@/lib/validation';

export async function POST(req){
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Payload invalido', { status:400 });
  }

  const identifier = payload?.login ?? payload?.email ?? payload?.identifier;
  const loginId = sanitizeLoginId(identifier);
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!isValidLoginId(loginId) || !isValidPassword(password, { minLength: 6, maxLength: 120 })) {
    return new Response('Credenciales invalidas', { status:400 });
  }

  await dbConnect();
  const user = await User.findOne({ email: loginId });
  if (!user) return new Response('Unauthorized', { status:401 });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return new Response('Unauthorized', { status:401 });
  const token = signToken({ id:String(user._id), role:user.role, techProfile: user.techProfile || '' });
  setAuthCookie(token);
  return Response.json({ ok:true, role:user.role, techProfile: user.techProfile || '' });
}
