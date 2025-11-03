
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(){
  await dbConnect();
  const items = await Equipment.find({ isActive: true }).sort({createdAt:-1}).lean();
  return Response.json(items);
}

export async function POST(req){
  const ses = await requireRole('admin');
  if (!ses) return new Response('Forbidden', { status:403 });
  const data = await req.json();
  await dbConnect();
  const created = await Equipment.create(data);

  await logAudit({
    req,
    userId: typeof ses.id === 'string' ? ses.id : undefined,
    action: 'equipment.create',
    module: 'equipment',
    subject: created.code,
    subjectId: created._id,
    details: {
      equipmentId: created._id.toString(),
      type: created.type,
      fuel: created.fuel
    }
  });

  return Response.json(created);
}
