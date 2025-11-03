import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import { requirePermission } from '@/lib/authz';

type MatchFilter = Record<string, unknown>;

const STATUS_FIELDS = {
  ok: 'cumple',
  critico: 'noCumple',
  observado: 'casoNa'
} as const;

const STATUS_ALIASES: Record<string, keyof typeof STATUS_FIELDS> = {
  ok: 'ok',
  cumple: 'ok',
  'cumple_ok': 'ok',
  critico: 'critico',
  'no': 'critico',
  'no_cumple': 'critico',
  'nocumple': 'critico',
  observado: 'observado',
  'caso_na': 'observado',
  'na': 'observado'
};

const VALID_TIMEZONE = (tz: string | null) => {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: tz }).format();
    return tz;
  } catch {
    return 'UTC';
  }
};

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'ver_reporte');
  if (auth instanceof NextResponse) return auth;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const equipmentId = searchParams.get('equipmentId');
  const checklistId = searchParams.get('checklistId');
  const technicianId = searchParams.get('technicianId');
  const statusParam = searchParams.get('status');
  const timezone = VALID_TIMEZONE(searchParams.get('timezone'));

  const match: MatchFilter = {};

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const dateFrom = new Date(from);
      if (!Number.isNaN(dateFrom.getTime())) {
        range.$gte = dateFrom;
      }
    }
    if (to) {
      const dateTo = new Date(to);
      if (!Number.isNaN(dateTo.getTime())) {
        range.$lte = dateTo;
      }
    }
    if (Object.keys(range).length > 0) {
      match.completedAt = range;
    }
  }

  if (statusParam) {
    const normalizedStatus = STATUS_ALIASES[statusParam.toLowerCase()];
    if (normalizedStatus) {
      match.status = normalizedStatus;
    } else if (STATUS_FIELDS[statusParam as keyof typeof STATUS_FIELDS]) {
      match.status = statusParam;
    }
  }

  if (equipmentId && mongoose.isValidObjectId(equipmentId)) {
    match.equipment = new mongoose.Types.ObjectId(equipmentId);
  }

  if (checklistId && mongoose.isValidObjectId(checklistId)) {
    match.checklist = new mongoose.Types.ObjectId(checklistId);
  }

  if (technicianId && mongoose.isValidObjectId(technicianId)) {
    match.technician = new mongoose.Types.ObjectId(technicianId);
  }

  const session = auth;
  if (session.role === 'tecnico') {
    if (!mongoose.isValidObjectId(session.id)) {
      return NextResponse.json({ error: 'Sesion invalida' }, { status: 400 });
    }
    match.technician = new mongoose.Types.ObjectId(session.id);
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedAt',
              timezone
            }
          }
        },
        cumple: {
          $sum: {
            $cond: [{ $eq: ['$status', 'ok'] }, 1, 0]
          }
        },
        noCumple: {
          $sum: {
            $cond: [{ $eq: ['$status', 'critico'] }, 1, 0]
          }
        },
        casoNa: {
          $sum: {
            $cond: [{ $eq: ['$status', 'observado'] }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id.date',
        cumple: 1,
        noCumple: 1,
        casoNa: 1,
        total: 1
      }
    }
  ];

  const data = await Evaluation.aggregate(pipeline);

  return NextResponse.json({
    data,
    keys: ['cumple', 'noCumple', 'casoNa']
  });
}
