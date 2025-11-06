import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import Equipment from '@/models/Equipment';

const PROJECT_TOTALS = {
  fuel: { $sum: { $ifNull: ['$fuelAddedLiters', 0] } },
  energy: { $sum: { $ifNull: ['$energyAddedKwh', 0] } },
  adblue: { $sum: { $ifNull: ['$adblueAddedLiters', 0] } },
  kilometers: { $sum: { $ifNull: ['$odometerDelta', 0] } },
  hours: { $sum: { $ifNull: ['$hourmeterDelta', 0] } },
  count: { $sum: 1 }
};

export default async function Summary() {
  await dbConnect();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalsAgg = null, topEquiposAgg] = await Promise.all([
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, ...PROJECT_TOTALS } }
    ]).then((res) => res[0] || null),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$equipment',
          ...PROJECT_TOTALS
        }
      },
      { $sort: { fuel: -1, energy: -1, hours: -1 } },
      { $limit: 5 }
    ])
  ]);

  const totals = {
    fuel: Number(totalsAgg?.fuel || 0),
    energy: Number(totalsAgg?.energy || 0),
    adblue: Number(totalsAgg?.adblue || 0),
    kilometers: Number(totalsAgg?.kilometers || 0),
    hours: Number(totalsAgg?.hours || 0),
    count: Number(totalsAgg?.count || 0)
  };

  const equipmentIds = topEquiposAgg.map((item) => item._id).filter(Boolean);
  let equipmentDetails = [];
  if (equipmentIds.length) {
    const equipmentDocs = await Equipment.find({ _id: { $in: equipmentIds } })
      .select('code type brand model')
      .lean();
    const equipmentMap = equipmentDocs.reduce((acc, doc) => {
      acc[doc._id.toString()] = {
        code: doc.code,
        type: doc.type,
        brand: doc.brand,
        model: doc.model
      };
      return acc;
    }, {});

    equipmentDetails = topEquiposAgg.map((item) => {
      const info = equipmentMap[item._id?.toString()] || {};
      return {
        id: item._id?.toString() || '',
        code: info.code || 'N/D',
        type: info.type || '',
        brand: info.brand || '',
        model: info.model || '',
        fuel: Number(item.fuel || 0),
        energy: Number(item.energy || 0),
        adblue: Number(item.adblue || 0),
        kilometers: Number(item.kilometers || 0),
        hours: Number(item.hours || 0),
        count: Number(item.count || 0)
      };
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="row" style={{ gap: 16 }}>
        <div className="col">
          <div className="card">
            <div className="kpi">{totals.fuel.toFixed(1)}</div>
            <div className="label">Combustible (L) 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="kpi">{totals.energy.toFixed(1)}</div>
            <div className="label">Energía (kWh) 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="kpi">{totals.adblue.toFixed(1)}</div>
            <div className="label">AdBlue (L) 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="kpi">{totals.kilometers.toFixed(1)}</div>
            <div className="label">Kilómetros 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="kpi">{totals.hours.toFixed(1)}</div>
            <div className="label">Horas operadas 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="kpi">{totals.count}</div>
            <div className="label">Evaluaciones 30 días</div>
          </div>
        </div>
      </div>

      {equipmentDetails.length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Equipos con mayor consumo (30 días)</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Tipo</th>
                  <th>Horas</th>
                  <th>Kilómetros</th>
                  <th>Combustible (L)</th>
                  <th>Energía (kWh)</th>
                  <th>AdBlue (L)</th>
                  <th>Evaluaciones</th>
                </tr>
              </thead>
              <tbody>
                {equipmentDetails.map((item) => (
                  <tr key={item.id || item.code}>
                    <td>{item.code}</td>
                    <td>{item.type}</td>
                    <td>{item.hours.toFixed(1)}</td>
                    <td>{item.kilometers.toFixed(1)}</td>
                    <td>{item.fuel.toFixed(1)}</td>
                    <td>{item.energy.toFixed(1)}</td>
                    <td>{item.adblue.toFixed(1)}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="label" style={{ margin: 0, color: 'var(--muted)' }}>
            No hay datos suficientes aún para elaborar el ranking de equipos.
          </p>
        </div>
      )}
    </div>
  );
}
