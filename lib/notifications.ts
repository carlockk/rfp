import Checklist from '@/models/Checklist';

const STALE_CHECKLIST_DAYS = 90;

export async function buildComputedChecklistAlerts() {
  const alerts: Array<Record<string, unknown>> = [];
  const staleDate = new Date(Date.now() - STALE_CHECKLIST_DAYS * 24 * 60 * 60 * 1000);
  const staleChecklists = await Checklist.find({
    isActive: true,
    deletedAt: null,
    updatedAt: { $lt: staleDate }
  })
    .select('name equipmentType currentVersion updatedAt')
    .sort({ updatedAt: 1 })
    .lean();

  staleChecklists.forEach((item) => {
    alerts.push({
      id: `stale-${item._id}`,
      message: `El checklist "${item.name}" no se actualiza desde ${new Date(item.updatedAt).toLocaleDateString()}`,
      type: 'warning',
      level: 'medium',
      audience: 'admin',
      metadata: {
        checklistId: item._id.toString(),
        equipmentType: item.equipmentType,
        currentVersion: item.currentVersion
      },
      createdAt: item.updatedAt,
      computed: true
    });
  });

  return alerts;
}
