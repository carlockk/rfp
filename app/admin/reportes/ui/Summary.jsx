import Link from 'next/link';
import { dbConnect } from '@/lib/db';
import Evaluation from '@/models/Evaluation';
import Equipment from '@/models/Equipment';
import UsageOverview from './UsageOverview';

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
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const trendStart = new Date(monthStart);
  trendStart.setMonth(trendStart.getMonth() - 5);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const [
    totalsAgg = null,
    topEquiposAgg,
    usageAgg,
    monthlyTrendRaw,
    dailyUsageRaw
  ] = await Promise.all([
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
    ]),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: monthStart } } },
      {
        $group: {
          _id: '$equipment',
          ...PROJECT_TOTALS,
          latestHourmeter: { $max: { $ifNull: ['$hourmeterCurrent', null] } },
          latestOdometer: { $max: { $ifNull: ['$odometerCurrent', null] } },
          lastEvaluationAt: { $max: '$completedAt' }
        }
      },
      { $sort: { hours: -1, kilometers: -1 } },
      { $limit: 12 }
    ]),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: trendStart } } },
      {
        $group: {
          _id: {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' }
          },
          hours: { $sum: { $ifNull: ['$hourmeterDelta', 0] } },
          kilometers: { $sum: { $ifNull: ['$odometerDelta', 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: weekStart } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$completedAt',
                timezone: 'America/Santiago'
              }
            }
          },
          hours: { $sum: { $ifNull: ['$hourmeterDelta', 0] } },
          kilometers: { $sum: { $ifNull: ['$odometerDelta', 0] } }
        }
      },
      { $sort: { '_id.date': 1 } }
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

  const equipmentIds = Array.from(
    new Set([
      ...topEquiposAgg.map((item) => item._id).filter(Boolean),
      ...usageAgg.map((item) => item._id).filter(Boolean)
    ])
  );

  let equipmentDetails = [];
  let usageRows = [];
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

    usageRows = usageAgg.map((item) => {
      const info = equipmentMap[item._id?.toString()] || {};
      return {
        id: item._id?.toString() || '',
        code: info.code || 'N/D',
        type: info.type || '',
        hours: Number(item.hours || 0),
        kilometers: Number(item.kilometers || 0),
        fuel: Number(item.fuel || 0),
        adblue: Number(item.adblue || 0),
        energy: Number(item.energy || 0),
        forms: Number(item.count || 0),
        latestHourmeter: Number(item.latestHourmeter || 0),
        latestOdometer: Number(item.latestOdometer || 0),
        lastEvaluationAt: item.lastEvaluationAt ? new Date(item.lastEvaluationAt).toISOString() : null
      };
    });
  }

  const monthLabel = monthStart.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const usageTrend = monthlyTrendRaw.map((item) => {
    const date = new Date(item._id.year, item._id.month - 1, 1);
    return {
      label: date.toLocaleDateString('es-CL', { month: 'short' }),
      hours: Number(item.hours || 0),
      kilometers: Number(item.kilometers || 0)
    };
  });
  const totalHourmeter = usageRows.reduce((acc, row) => acc + (row.latestHourmeter || 0), 0);
  const hoursByType = usageRows.reduce((acc, row) => {
    if (!row.type) return acc;
    const bucket = acc[row.type] || { hours: 0, kilometers: 0, count: 0 };
    bucket.hours += row.hours;
    bucket.kilometers += row.kilometers;
    bucket.count += row.forms;
    acc[row.type] = bucket;
    return acc;
  }, {});
  const typeBreakdown = Object.entries(hoursByType).map(([type, stats]) => ({
    type,
    hours: stats.hours,
    kilometers: stats.kilometers,
    forms: stats.count
  }));
  const dailyUsage = dailyUsageRaw.map((item) => ({
    date: item._id.date,
    hours: Number(item.hours || 0),
    kilometers: Number(item.kilometers || 0)
  }));
  const hdKmRatio = totals.kilometers > 0 ? totals.hours / totals.kilometers : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                  <td>
                    <Link
                      href={`/admin/checklists/historial?equipmentId=${item.id}`}
                      style={{ color: 'var(--accent)' }}
                    >
                      {item.count}
                    </Link>
                  </td>
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

      <UsageOverview
        usageRows={usageRows}
        monthLabel={monthLabel}
        monthlyTrend={usageTrend}
        dailyUsage={dailyUsage}
        typeBreakdown={typeBreakdown}
        totalHourmeter={totalHourmeter}
        hoursRatio={hdKmRatio}
      />
    </div>
  );
}
