import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import EquipmentManager from './ui/EquipmentManager';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');
  return <EquipmentManager />;
}
