import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import AnomalyRecipient from '@/models/AnomalyRecipient';
import RecipientsManager from './ui/RecipientsManager';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  await dbConnect();
  const recipients = await AnomalyRecipient.find({})
    .sort({ updatedAt: -1 })
    .lean();

  const serialized = recipients.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    email: item.email,
    active: Boolean(item.active),
    createdAt: item.createdAt?.toISOString?.() || '',
    updatedAt: item.updatedAt?.toISOString?.() || ''
  }));

  return <RecipientsManager initialRecipients={serialized} />;
}
