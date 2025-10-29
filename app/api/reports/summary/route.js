
import { dbConnect } from '@/lib/db';
import Reading from '@/models/Reading';

export async function GET(){
  await dbConnect();
  const last30 = new Date(Date.now() - 1000*60*60*24*30);
  const readings = await Reading.find({ createdAt: { $gte: last30 }}).lean();
  const totals = readings.reduce((acc,r)=>{
    acc.liters += r.liters || 0;
    acc.kwh += r.kwh || 0;
    acc.adblue += r.adblueLiters || 0;
    acc.uses += (r.kind === 'uso' || r.kind==='fin_uso') ? 1 : 0;
    return acc;
  }, { liters:0, kwh:0, adblue:0, uses:0 });
  return Response.json({ period:'30d', totals, count: readings.length });
}
