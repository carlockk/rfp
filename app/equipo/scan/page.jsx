import { redirect } from 'next/navigation';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Evaluation from '@/models/Evaluation';
import Checklist from '@/models/Checklist';
import { serializeChecklist } from '@/lib/checklists';
import EvaluationTemplate from '@/models/EvaluationTemplate';
import { normalizeTemplateDoc } from '@/lib/evaluationTemplates';
import EquipmentScanner from './ui/EquipmentScanner';

export default async function Page() {
  await dbConnect();
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const isTechnician = session.role === 'tecnico';
  const isSupervisor = session.role === 'supervisor';

  if (!isTechnician && !isSupervisor) {
    redirect('/');
  }

  const technicianId = mongoose.Types.ObjectId.isValid(session.id)
    ? new mongoose.Types.ObjectId(session.id)
    : session.id;

  const equipmentQuery = {
    isActive: true,
    $or: [
      { assignedTo: technicianId },
      { operators: { $elemMatch: { user: technicianId } } }
    ]
  };

  const assignedDocs = await Equipment.find(equipmentQuery)
    .select('code type brand model plate fuel adblue notes operators')
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
    notes: doc.notes || '',
    operators: Array.isArray(doc.operators)
      ? doc.operators.map((op) => ({
          user: op?.user ? op.user.toString() : '',
          assignedAt: op?.assignedAt || null
        }))
      : []
  }));

  const checklistsRaw = await Checklist.find({
    isActive: true,
    deletedAt: null
  })
    .select('name equipmentType equipmentTypes equipmentIds allowedProfiles mandatoryProfiles currentVersion versions items description')
    .sort({ name: 1 })
    .lean();

  const serialized = checklistsRaw.map((doc) => serializeChecklist(doc, true));
  const checklists = serialized.map((item) => ({
    id: item.id,
    name: item.name,
    equipmentType: (item.equipmentType || '').toLowerCase(),
    equipmentTypes: Array.isArray(item.equipmentTypes) ? item.equipmentTypes : [],
    equipmentIds: Array.isArray(item.equipmentIds) ? item.equipmentIds : [],
    allowedProfiles: Array.isArray(item.allowedProfiles) ? item.allowedProfiles : [],
    mandatoryProfiles: Array.isArray(item.mandatoryProfiles) ? item.mandatoryProfiles : [],
    version: item.currentVersion || 1,
    nodes: item.structure || [],
    notes: item.currentVersionNotes || '',
    isActive: item.isActive !== false
  }));

  const templateDocs = await EvaluationTemplate.find({
    isActive: true,
    $or: [
      { techProfile: 'todos' },
      { techProfile: session.techProfile || 'externo' }
    ]
  })
    .sort({ updatedAt: -1 })
    .lean();

  const templates = templateDocs.map((doc) => normalizeTemplateDoc(doc));

  return (
    <EquipmentScanner
      assignedEquipments={assignedEquipments}
      checklists={checklists}
      techProfile={session.techProfile || 'externo'}
      templates={templates}
      sessionRole={session.role}
    />
  );
}

