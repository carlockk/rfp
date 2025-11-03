import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import Checklist from '@/models/Checklist';
import ChecklistsManager from './ui/ChecklistsManager';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  await dbConnect();
  const records = await Checklist.find({}, { versions: 0 }).sort({ name: 1 }).lean();

  const initialChecklists = records.map((record) => ({
    id: record._id.toString(),
    name: record.name,
    description: record.description || '',
    equipmentType: record.equipmentType || '',
    tags: record.tags || [],
    isActive: record.isActive !== false,
    deletedAt: record.deletedAt ? record.deletedAt.toISOString?.() || record.deletedAt : null,
    currentVersion: record.currentVersion || 1,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString?.() || record.updatedAt : null,
    createdAt: record.createdAt ? record.createdAt.toISOString?.() || record.createdAt : null
  }));

  return (
    <ChecklistsManager
      initialChecklists={initialChecklists}
      canCreate
    />
  );
}
