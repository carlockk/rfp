import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import FcmToken from '@/models/FcmToken';

type TokenPayload = {
  token?: string;
  platform?: string;
};

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return unauthorized();

  let payload: TokenPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  await dbConnect();

  await FcmToken.findOneAndUpdate(
    { token },
    {
      user: session.id,
      token,
      platform: payload?.platform || '',
      lastSeenAt: new Date()
    },
    { upsert: true, setDefaultsOnInsert: true, new: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return unauthorized();

  let payload: TokenPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  await dbConnect();
  await FcmToken.deleteOne({ token, user: session.id });

  return NextResponse.json({ ok: true });
}
