import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Checklist from '@/models/Checklist';
import Evaluation from '@/models/Evaluation';
import User from '@/models/User';

const MAX_RESULTS = 5;

type SearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  meta?: string;
};

type SearchCategory = {
  key: string;
  label: string;
  items: SearchItem[];
};

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

function buildRegex(value: string) {
  return new RegExp(value.replace(ESCAPE_REGEX, '\\$&'), 'i');
}

function buildFilter(filters: Record<string, unknown>[]) {
  if (!filters.length) return {};
  if (filters.length === 1) return filters[0];
  return { $and: filters };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').trim();

  if (query.length < 2) {
    return NextResponse.json({ error: 'Debe ingresar al menos 2 caracteres' }, { status: 400 });
  }

  const limitParam = Number(searchParams.get('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 20
      ? Math.round(limitParam)
      : MAX_RESULTS;

  await dbConnect();

  const regex = buildRegex(query);
  const technicianId =
    typeof session.id === 'string' && mongoose.Types.ObjectId.isValid(session.id)
      ? new mongoose.Types.ObjectId(session.id)
      : null;
  const isTechnician = session.role === 'tecnico';

  const equipmentFilters: Record<string, unknown>[] = [
    { isActive: true },
    {
      $or: [
        { code: regex },
        { plate: regex },
        { type: regex },
        { brand: regex },
        { model: regex }
      ]
    }
  ];

  if (isTechnician && technicianId) {
    equipmentFilters.push({
      $or: [
        { assignedTo: technicianId },
        { operators: { $elemMatch: { user: technicianId } } }
      ]
    });
  }

  const evaluationsFilters: Record<string, unknown>[] = [
    {
      $or: [
        { observations: regex },
        { templateName: regex },
        { status: regex }
      ]
    }
  ];

  if (isTechnician && technicianId) {
    evaluationsFilters.push({ technician: technicianId });
  }

  const includeAdminSections = !isTechnician;

  const equipmentPromise = Equipment.find(buildFilter(equipmentFilters))
    .limit(limit)
    .sort({ updatedAt: -1 })
    .select('code type brand model plate');

  const evaluationsPromise = Evaluation.find(buildFilter(evaluationsFilters))
    .limit(limit)
    .sort({ completedAt: -1 })
    .populate('equipment', 'code type')
    .populate('checklist', 'name')
    .populate('technician', 'name email');

  const checklistPromise = includeAdminSections
    ? Checklist.find({
        isActive: true,
        deletedAt: null,
        $or: [{ name: regex }, { description: regex }, { equipmentType: regex }, { tags: regex }]
      })
        .limit(limit)
        .sort({ updatedAt: -1 })
        .select('name equipmentType currentVersion description')
    : Promise.resolve([]);

  const usersPromise = includeAdminSections
    ? (() => {
        const userFilters: Record<string, unknown>[] = [
          {
            $or: [{ name: regex }, { email: regex }]
          }
        ];
        if (session.role === 'admin') {
          userFilters.push({ role: { $ne: 'superadmin' } });
        }
        return User.find(buildFilter(userFilters))
          .limit(limit)
          .sort({ name: 1 })
          .select('name email role');
      })()
    : Promise.resolve([]);

  const [equipments, evaluations, checklists, users] = await Promise.all([
    equipmentPromise,
    evaluationsPromise,
    checklistPromise,
    usersPromise
  ]);

  const categories: SearchCategory[] = [];

  if (equipments.length) {
    categories.push({
      key: 'equipment',
      label: 'Equipos',
      items: equipments.map((item) => ({
        id: item._id.toString(),
        title: item.code,
        subtitle: [item.type, item.brand && item.model ? `${item.brand} ${item.model}` : item.brand || item.model, item.plate && `Patente ${item.plate}`]
          .filter(Boolean)
          .join(' · '),
        href: `/equipo/${item._id}`,
        badge: 'Equipo'
      }))
    });
  }

  if (evaluations.length) {
    categories.push({
      key: 'evaluations',
      label: 'Evaluaciones',
      items: evaluations.map((item) => ({
        id: item._id.toString(),
        title: item.checklist?.name || item.templateName || 'Evaluación',
        subtitle: [
          item.equipment?.code ? `Equipo ${item.equipment.code}` : null,
          item.technician?.name || item.technician?.email || null,
          item.completedAt ? new Date(item.completedAt).toLocaleString('es-CL') : null
        ]
          .filter(Boolean)
          .join(' · '),
        href: `/admin/checklists/historial?evaluacion=${item._id}`,
        badge: `Estado ${item.status}`
      }))
    });
  }

  if (includeAdminSections && checklists.length) {
    categories.push({
      key: 'checklists',
      label: 'Checklists',
      items: checklists.map((item) => ({
        id: item._id.toString(),
        title: item.name,
        subtitle: [
          item.description,
          item.equipmentType ? `Tipo ${item.equipmentType}` : null,
          `Versión ${item.currentVersion || 1}`
        ]
          .filter(Boolean)
          .join(' · '),
        href: `/admin/checklists`,
        badge: 'Checklist'
      }))
    });
  }

  if (includeAdminSections && users.length) {
    categories.push({
      key: 'users',
      label: 'Usuarios',
      items: users.map((item) => ({
        id: item._id.toString(),
        title: item.name || item.email,
        subtitle: item.name ? item.email : undefined,
        href: `/admin/usuarios`,
        badge: item.role
      }))
    });
  }

  return NextResponse.json({
    query,
    total: categories.reduce((acc, category) => acc + category.items.length, 0),
    categories
  });
}
