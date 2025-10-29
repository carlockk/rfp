import { dbConnect } from '@/lib/db';
import Reading from '@/models/Reading';

export default async function Summary() {
  await dbConnect();
  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const readings = await Reading.find({ createdAt: { $gte: thirtyDaysAgo } }).lean();

  const totals = readings.reduce(
    (acc, r) => {
      acc.liters += r.liters || 0;
      acc.kwh += r.kwh || 0;
      acc.adblue += r.adblueLiters || 0;
      acc.uses += r.kind === 'uso' || r.kind === 'fin_uso' ? 1 : 0;
      return acc;
    },
    { liters: 0, kwh: 0, adblue: 0, uses: 0 }
  );

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <div className="kpi">{totals.liters.toFixed(2)}</div>
          <div className="label">Litros (30d)</div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="kpi">{totals.kwh.toFixed(2)}</div>
          <div className="label">kWh (30d)</div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="kpi">{totals.adblue.toFixed(2)}</div>
          <div className="label">AdBlue (30d)</div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="kpi">{totals.uses}</div>
          <div className="label">Registros uso (30d)</div>
        </div>
      </div>
    </div>
  );
}
