import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Checklist from '@/models/Checklist';
import Equipment from '@/models/Equipment';
import User from '@/models/User';
import HistoryDashboard from './ui/HistoryDashboard';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  await dbConnect();

  const [checklists, technicians, equipments] = await Promise.all([
    Checklist.find({ isActive: true, deletedAt: null }, { versions: 0 })
      .sort({ name: 1 })
      .lean(),
    User.find({ role: 'tecnico' }, { name: 1, email: 1 })
      .sort({ name: 1, email: 1 })
      .lean(),
    Equipment.find({ isActive: true }, { code: 1, type: 1 })
      .sort({ code: 1 })
      .lean()
  ]);

  return (
    <HistoryDashboard
      checklistOptions={checklists.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        equipmentType: item.equipmentType || '',
        currentVersion: item.currentVersion || 1
      }))}
      technicianOptions={technicians.map((user) => ({
        id: user._id.toString(),
        name: user.name || '',
        email: user.email
      }))}
      equipmentOptions={equipments.map((eq) => ({
        id: eq._id.toString(),
        code: eq.code,
        type: eq.type || ''
      }))}
    />
  );
}
