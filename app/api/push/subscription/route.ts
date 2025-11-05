import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import PushSubscription from '@/models/PushSubscription';

type SubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  platform?: string;
};

function forbidden() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return forbidden();

  let body: SubscriptionPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Datos de subscripcion incompletos' }, { status: 400 });
  }

  await dbConnect();

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: session.id,
      endpoint,
      keys: { p256dh, auth },
      userAgent: req.headers.get('user-agent') || '',
      platform: body.platform || ''
    },
    { upsert: true, setDefaultsOnInsert: true, new: true }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) return forbidden();

  let body: SubscriptionPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido' }, { status: 400 });
  }

  const endpoint = body?.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 });
  }

  await dbConnect();

  await PushSubscription.deleteOne({ endpoint, user: session.id });

  return NextResponse.json({ ok: true });
}
