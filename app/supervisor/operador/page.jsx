import mongoose from 'mongoose';
import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Evaluation from '@/models/Evaluation';
import Notification from '@/models/Notification';
import TechnicianDashboard from '@/app/ui/TechnicianDashboard';

const buildSupervisorOperatorData = async (session) => {
  const supervisorId = mongoose.Types.ObjectId.isValid(session.id)
    ? new mongoose.Types.ObjectId(session.id)
    : session.id;

  const equipmentDocs = await Equipment.find({
    isActive: true,
    $or: [
      { assignedTo: supervisorId },
      { operators: { $elemMatch: { user: supervisorId } } }
    ]
  })
    .select('code type')
    .sort({ code: 1 })
    .lean();

  const equipmentIds = equipmentDocs.map((item) => item._id);

  const assignedEquipments = equipmentDocs.map((item) => ({
    id: item._id.toString(),
    code: item.code,
    type: item.type || ''
  }));

  const recentEvaluations = equipmentIds.length
    ? await Evaluation.find({ equipment: { $in: equipmentIds }, technician: supervisorId })
        .sort({ completedAt: -1 })
        .limit(4)
        .populate('checklist', 'name')
        .populate('equipment', 'code type')
        .lean()
    : [];

  const lastEvaluations = equipmentIds.length
    ? await Evaluation.aggregate([
        {
          $match: {
            equipment: { $in: equipmentIds },
            completedAt: { $exists: true },
            technician: supervisorId
          }
        },
        { $sort: { completedAt: -1 } },
        {
          $group: {
            _id: '$equipment',
            status: { $first: '$status' },
            completedAt: { $first: '$completedAt' }
          }
        }
      ])
    : [];

  const equipmentStatuses = lastEvaluations.reduce((acc, item) => {
    acc[item._id.toString()] = {
      status: item.status,
      completedAt: item.completedAt
    };
    return acc;
  }, {});

  const recipientFilter = mongoose.isValidObjectId(session.id)
    ? [{ recipients: new mongoose.Types.ObjectId(session.id) }]
    : [];

  const notifications = await Notification.find({
    $or: [
      { audience: 'all' },
      { audience: 'technician' },
      ...recipientFilter
    ]
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const cleanNotifications = notifications.map((item) => ({
    id: item._id.toString(),
    message: item.message,
    level: item.level,
    createdAt: item.createdAt
  }));

  const historyEntries = equipmentIds.length
    ? await Evaluation.find({
        equipment: { $in: equipmentIds },
        technician: supervisorId
      })
        .sort({ completedAt: -1, createdAt: -1 })
        .limit(100)
        .select('equipment status completedAt observations hourmeterCurrent odometerCurrent checklist templateName')
        .populate('checklist', 'name')
        .lean()
    : [];

  const equipmentHistory = historyEntries.reduce((acc, entry) => {
    const key = entry.equipment?.toString();
    if (!key) return acc;
    const historyRecord = {
      id: entry._id.toString(),
      status: entry.status,
      completedAt: entry.completedAt
        ? entry.completedAt.toISOString?.() || entry.completedAt
        : null,
      observations: entry.observations || '',
      checklistName: entry.checklist?.name || entry.templateName || '',
      hourmeterCurrent: entry.hourmeterCurrent ?? null,
      odometerCurrent: entry.odometerCurrent ?? null
    };
    if (!acc[key]) acc[key] = [];
    acc[key].push(historyRecord);
    return acc;
  }, {});

  return {
    assignedEquipments,
    equipmentStatuses,
    equipmentHistory,
    recentEvaluations,
    notifications: cleanNotifications
  };
};

export default async function Page() {
  await dbConnect();
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'supervisor') {
    redirect('/');
  }

  const data = await buildSupervisorOperatorData(session);

  return <TechnicianDashboard data={data} />;
}
