import { redirect } from 'next/navigation';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Checklist from '@/models/Checklist';
import { serializeChecklist } from '@/lib/checklists';
import EvaluationTemplate from '@/models/EvaluationTemplate';
import { normalizeTemplateDoc } from '@/lib/evaluationTemplates';
import BackButton from '@/app/ui/BackButton';
import EvaluationEntry from './ui/EvaluationEntry';

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
        <h3 style={{ marginTop: 0 }}>Equipo</h3>
        <p style={{ marginTop: 12 }}>Equipo no encontrado</p>
        <div className="back-button-row">
          <BackButton fallback="/" />
        </div>
      </div>
    );
  }

  const operatorEntries = Array.isArray(equipmentDoc.operators) ? equipmentDoc.operators : [];
  const operatorUserIds = operatorEntries.map((op) =>
    op?.user ? op.user.toString() : ''
  );

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
    assignedAt: equipmentDoc.assignedAt ? equipmentDoc.assignedAt.toISOString?.() || equipmentDoc.assignedAt : null,
    operators: operatorEntries.map((op) => ({
      user: op?.user ? op.user.toString() : '',
      assignedAt: op?.assignedAt ? op.assignedAt.toISOString?.() || op.assignedAt : null
    }))
  };

  const assignedToUser =
    session.role !== 'tecnico'
      ? true
      : operatorUserIds.includes(session.id) ||
        (equipmentDoc.assignedTo && equipmentDoc.assignedTo.toString() === session.id);

  if (session.role === 'tecnico' && !assignedToUser) {
    redirect('/equipo/scan');
  }

  let assignedEquipments = [];
  if (session.role === 'tecnico' && session.id) {
    const technicianId = mongoose.Types.ObjectId.isValid(session.id)
      ? new mongoose.Types.ObjectId(session.id)
      : session.id;
    const assignedDocs = await Equipment.find({
      isActive: true,
      $or: [
        { assignedTo: technicianId },
        { operators: { $elemMatch: { user: technicianId } } }
      ]
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
    <EvaluationEntry
      equipment={equipment}
      assignedEquipments={assignedEquipments}
      assignedToUser={assignedToUser}
      techProfile={session.techProfile || 'externo'}
      checklists={checklists}
      sessionRole={session.role}
      templates={templates}
    />
  );
}
