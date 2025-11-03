import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Checklist from '@/models/Checklist';
import EvaluationEntry from './ui/EvaluationEntry';
import BackButton from '@/app/ui/BackButton';
import { serializeChecklist } from '@/lib/checklists';

export default async function Page({ params }) {
  await dbConnect();
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const equipmentDoc = await Equipment.findById(params.id).lean();
  if (!equipmentDoc || equipmentDoc.isActive === false) {
    return (
      <div className="card">
        <BackButton fallback="/" />
        <p style={{ marginTop: 12 }}>Equipo no encontrado</p>
      </div>
    );
  }

  const equipment = {
    id: equipmentDoc._id.toString(),
    code: equipmentDoc.code,
    type: equipmentDoc.type || '',
    brand: equipmentDoc.brand || '',
    model: equipmentDoc.model || '',
    plate: equipmentDoc.plate || '',
    fuel: equipmentDoc.fuel || '',
    adblue: Boolean(equipmentDoc.adblue),
    notes: equipmentDoc.notes || '',
    assignedTo: equipmentDoc.assignedTo ? equipmentDoc.assignedTo.toString() : '',
    assignedAt: equipmentDoc.assignedAt ? equipmentDoc.assignedAt.toISOString?.() || equipmentDoc.assignedAt : null
  };

  const assignedToUser =
    session.role !== 'tecnico'
      ? true
      : equipmentDoc.assignedTo && equipmentDoc.assignedTo.toString() === session.id;

  let assignedEquipments = [];
  if (session.role === 'tecnico' && session.id) {
    const assignedDocs = await Equipment.find({
      isActive: true,
      assignedTo: session.id
    })
      .select('code type brand model plate fuel')
      .sort({ code: 1 })
      .lean();

    assignedEquipments = assignedDocs.map((item) => ({
      id: item._id.toString(),
      code: item.code,
      type: item.type || '',
      brand: item.brand || '',
      model: item.model || '',
      plate: item.plate || '',
      fuel: item.fuel || ''
    }));
  }

  const checklistsRaw = await Checklist.find({
    isActive: true,
    deletedAt: null
  })
    .select('name equipmentType currentVersion versions items updatedAt description')
    .sort({ name: 1 })
    .lean();

  const serialized = checklistsRaw.map((doc) => serializeChecklist(doc, true));

  const checklistsByType = serialized.reduce((acc, item) => {
    const key = (item.equipmentType || '').toLowerCase();
    const normalizedKey = key || 'default';
    if (!acc[normalizedKey]) acc[normalizedKey] = [];

    acc[normalizedKey].push({
      id: item.id,
      name: item.name,
      equipmentType: item.equipmentType || '',
      version: item.currentVersion || 1,
      nodes: item.structure || [],
      notes: item.currentVersionNotes || ''
    });
    return acc;
  }, { default: [] });

  if (!checklistsByType.default) {
    checklistsByType.default = [];
  }

  return (
    <EvaluationEntry
      equipment={equipment}
      assignedEquipments={assignedEquipments}
      assignedToUser={assignedToUser}
      techProfile={session.techProfile || 'externo'}
      checklistsByType={checklistsByType}
      sessionRole={session.role}
    />
  );
}
