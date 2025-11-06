import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import EvaluationTemplate from '@/models/EvaluationTemplate';
import TemplatesManager from './ui/TemplatesManager';

function toPlain(template) {
  return {
    id: template._id.toString(),
    name: template.name,
    description: template.description,
    techProfile: template.techProfile,
    equipmentTypes: template.equipmentTypes || [],
    equipmentIds: (template.equipmentIds || []).map((id) => id.toString()),
    isChecklistMandatory: template.isChecklistMandatory,
    fields: template.fields || [],
    attachmentsEnabled: template.attachmentsEnabled,
    maxAttachments: template.maxAttachments,
    isActive: template.isActive,
    updatedAt: template.updatedAt ? template.updatedAt.toISOString() : null
  };
}

export default async function Page() {
  const session = await requireRole(['admin', 'superadmin']);
  if (!session) redirect('/login');

  await dbConnect();
  const templates = await EvaluationTemplate.find().sort({ updatedAt: -1 }).lean();

  return (
    <TemplatesManager
      initialTemplates={templates.map(toPlain)}
      canManageAll={session.role === 'superadmin'}
    />
  );
}
