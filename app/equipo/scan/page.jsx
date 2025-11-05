import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Checklist from '@/models/Checklist';
import { serializeChecklist } from '@/lib/checklists';
import EquipmentScanner from './ui/EquipmentScanner';

const DEFAULT_KEY = 'default';

const toTypeKey = (value) => (value || '').toLowerCase() || DEFAULT_KEY;

export default async function Page() {
  await dbConnect();
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'tecnico') {
    redirect('/');
  }

  const assignedDocs = await Equipment.find({
    isActive: true,
    assignedTo: session.id
  })
    .select('code type brand model plate fuel adblue notes')
    .sort({ code: 1 })
    .lean();

  const assignedEquipments = assignedDocs.map((doc) => ({
    id: doc._id.toString(),
    code: doc.code,
    type: doc.type || '',
    brand: doc.brand || '',
    model: doc.model || '',
    plate: doc.plate || '',
    fuel: doc.fuel || '',
    adblue: Boolean(doc.adblue),
    notes: doc.notes || ''
  }));

  const checklistsRaw = await Checklist.find({
    isActive: true,
    deletedAt: null
  })
    .select('name equipmentType currentVersion versions items description')
    .sort({ name: 1 })
    .lean();

  const serialized = checklistsRaw.map((doc) => serializeChecklist(doc, true));
  const checklistsByType = serialized.reduce(
    (acc, item) => {
      const key = toTypeKey(item.equipmentType);
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: item.id,
        name: item.name,
        equipmentType: item.equipmentType || '',
        version: item.currentVersion || 1,
        nodes: item.structure || [],
        notes: item.currentVersionNotes || ''
      });
      return acc;
    },
    { [DEFAULT_KEY]: [] }
  );

  if (!checklistsByType[DEFAULT_KEY]) {
    checklistsByType[DEFAULT_KEY] = [];
  }

  return (
    <EquipmentScanner
      assignedEquipments={assignedEquipments}
      checklistsByType={checklistsByType}
      techProfile={session.techProfile || 'externo'}
    />
  );
}
