import { redirect } from 'next/navigation';
import Link from 'next/link';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Evaluation from '@/models/Evaluation';
import Checklist from '@/models/Checklist';
import User from '@/models/User';
import Notification from '@/models/Notification';
import GlobalSearch from './GlobalSearch';
import TechnicianDashboard from './TechnicianDashboard';
import RepairStatusControl from './RepairStatusControl';

const ALERT_WINDOW_DAYS = 30;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function AdminDashboard({ metrics }) {
  const {
    totalEquipos,
    activeTechnicians,
    formsSubmitted,
    criticalLast30,
    equipmentByType,
    equipmentTrend,
    trendMonths,
    trendPage,
    trendTotal,
    trendPageSize,
    trendType,
    trendTypes,
    recentCriticals,
    smartAlerts,
    consumption30d
  } = metrics;

  const totalTrendPages = trendPageSize
    ? Math.max(1, Math.ceil(trendTotal / trendPageSize))
    : 1;
  const currentTrendPage = Math.min(Math.max(trendPage || 1, 1), totalTrendPages);
  const trendStart = trendTotal ? (currentTrendPage - 1) * trendPageSize + 1 : 0;
  const trendEnd = Math.min(trendTotal, currentTrendPage * trendPageSize);
  const trendPages = [];
  const maxTrendButtons = 5;
  let startPage = Math.max(1, currentTrendPage - 2);
  let endPage = Math.min(totalTrendPages, startPage + maxTrendButtons - 1);
  if (endPage - startPage < maxTrendButtons - 1) {
    startPage = Math.max(1, endPage - maxTrendButtons + 1);
  }
  for (let page = startPage; page <= endPage; page += 1) {
    trendPages.push(page);
  }

  const trendHref = (page) => `/?trendPage=${page}${trendType ? `&trendType=${encodeURIComponent(trendType)}` : ''}`;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="page-header__titles">
          <p className="page-header__eyebrow">Panel de administración</p>
          <h1 className="page-header__title">Resumen general</h1>
        </div>
        <div className="page-header__actions">
          <GlobalSearch />
        </div>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{totalEquipos}</div>
            <div className="label">Equipos registrados</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{activeTechnicians}</div>
            <div className="label">técnicos activos</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{formsSubmitted}</div>
            <div className="label">Formularios enviados</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{criticalLast30}</div>
            <div className="label">Fallas críticas (30 días)</div>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <div className="col">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Equipos por tipo</h3>
            {equipmentByType.length ? (
              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
                }}
              >
                {equipmentByType.map((item) => (
                  <div
                    key={item.type}
                    className="kpi-card"
                    style={{ background: 'var(--surface)', padding: 16 }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{item.count}</div>
                    <div className="label">{item.type || 'Sin tipo'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="label" style={{ color: 'var(--muted)' }}>
                No hay equipos registrados.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{consumption30d.fuel.toFixed(1)}</div>
            <div className="label">Combustible (L) 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{consumption30d.energy.toFixed(1)}</div>
            <div className="label">Energía (kWh) 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{consumption30d.adblue.toFixed(1)}</div>
            <div className="label">AdBlue (L) 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{consumption30d.kilometers.toFixed(1)}</div>
            <div className="label">Kilómetros 30 días</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{consumption30d.hours.toFixed(1)}</div>
            <div className="label">Horas operadas 30 días</div>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <div className="col" style={{ flexBasis: '70%' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Tendencia mensual (por equipo)</h3>
            <form method="get" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="trend-type">Tipo de equipo</label>
                <select
                  id="trend-type"
                  name="trendType"
                  className="input"
                  defaultValue={trendType || ''}
                >
                  <option value="">Todos</option>
                  {trendTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <input type="hidden" name="trendPage" value="1" />
              <button className="btn" type="submit">Aplicar</button>
            </form>
            {equipmentTrend.length ? (
              <div className="table-wrapper">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Equipo</th>
                      <th>Tipo</th>
                      {trendMonths.map((month) => (
                        <th key={month.key}>{month.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentTrend.map((item) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.type || '-'}</td>
                        {trendMonths.map((month) => {
                          const data = item.months[month.key] || {
                            hours: 0,
                            kilometers: 0,
                            fuel: 0,
                            energy: 0
                          };
                          return (
                            <td key={`${item.id}-${month.key}`}>
                              <div className="label" style={{ lineHeight: 1.5 }}>
                                Horas: <strong>{data.hours.toFixed(1)}</strong><br />
                                Km: <strong>{data.kilometers.toFixed(1)}</strong><br />
                                Comb: <strong>{data.fuel.toFixed(1)}</strong><br />
                                Energía: <strong>{data.energy.toFixed(1)}</strong><br />
                                Total: <strong>{data.total}</strong>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trendTotal > trendPageSize ? (
                  <div className="pagination">
                    <span className="pagination__summary">
                      Mostrando {trendStart}-{trendEnd} de {trendTotal}
                    </span>
                    <div className="pagination__controls" role="group" aria-label="Paginación">
                      {currentTrendPage === 1 ? (
                        <span className="pagination__button" aria-disabled="true">
                          Anterior
                        </span>
                      ) : (
                        <Link className="pagination__button" href={trendHref(currentTrendPage - 1)}>
                          Anterior
                        </Link>
                      )}
                      {trendPages.map((page) =>
                        page === currentTrendPage ? (
                          <span
                            key={page}
                            className="pagination__button"
                            aria-current="page"
                            style={{
                              background: 'var(--accent)',
                              borderColor: 'var(--accent)',
                              color: '#fff'
                            }}
                          >
                            {page}
                          </span>
                        ) : (
                          <Link key={page} className="pagination__button" href={trendHref(page)}>
                            {page}
                          </Link>
                        )
                      )}
                      {currentTrendPage === totalTrendPages ? (
                        <span className="pagination__button" aria-disabled="true">
                          Siguiente
                        </span>
                      ) : (
                        <Link className="pagination__button" href={trendHref(currentTrendPage + 1)}>
                          Siguiente
                        </Link>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="label" style={{ color: 'var(--muted)' }}>
                Aún no hay evaluaciones en los últimos meses.
              </p>
            )}
          </div>
        </div>
        <div className="col" style={{ flexBasis: '30%' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Alertas inteligentes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {smartAlerts.length ? (
                smartAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      borderLeft: `4px solid ${alert.level === 'high' ? '#c62828' : '#f9a825'}`,
                      background: 'var(--surface)',
                      padding: '8px 12px'
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600 }}>{alert.message}</p>
                    <span className="label">{formatDate(alert.dueAt)}</span>
                  </div>
                ))
              ) : (
                <p className="label" style={{ color: 'var(--muted)' }}>
                  No hay alertas próximas.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fallas críticas recientes</h3>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Checklist</th>
                <th>Equipo</th>
                <th>técnico</th>
                <th>Duración</th>
                <th>Observaciones</th>
                <th>Estado reparación</th>
              </tr>
            </thead>
            <tbody>
              {recentCriticals.map((item) => (
                <tr key={item._id.toString()}>
                  <td>{formatDate(item.completedAt)}</td>
                  <td>{item.checklist?.name || '-'}</td>
                  <td>{item.equipment?.code || '-'}</td>
                  <td>{item.technician?.name || item.technician?.email || '-'}</td>
                  <td>{formatDuration(item.durationSeconds)}</td>
                  <td>{item.observations || '-'}</td>
                  <td>
                    <RepairStatusControl
                      evaluationId={item._id.toString()}
                      initialStatus={item.repairStatus || 'desviacion'}
                    />
                  </td>
                </tr>
              ))}
              {!recentCriticals.length ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                    No hay fallas críticas recientes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default async function Dashboard({ searchParams } = {}) {
  await dbConnect();
  const session = await getSession();
  if (!session) redirect('/login');

  if (session.role === 'supervisor') {
    redirect('/supervisor');
  }

  if (session.role === 'tecnico') {
    const technicianId = mongoose.Types.ObjectId.isValid(session.id)
      ? new mongoose.Types.ObjectId(session.id)
      : session.id;
    const assignedEquipmentsDocs = await Equipment.find({
      isActive: true,
      $or: [
        { assignedTo: technicianId },
        { operators: { $elemMatch: { user: technicianId } } }
      ]
    })
      .select('code type')
      .sort({ code: 1 })
      .lean();

    const assignedEquipments = assignedEquipmentsDocs.map((item) => ({
      id: item._id.toString(),
      code: item.code,
      type: item.type || ''
    }));

    const recentEvaluations = await Evaluation.find({ technician: session.id })
      .sort({ completedAt: -1 })
      .limit(4)
      .populate('checklist', 'name')
      .populate('equipment', 'code type')
      .lean();

    const equipmentIds = assignedEquipmentsDocs.map((item) => item._id);

    const lastEvaluations = equipmentIds.length
      ? await Evaluation.aggregate([
          {
            $match: {
              equipment: { $in: equipmentIds },
              completedAt: { $exists: true },
              technician: technicianId
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
          technician: session.id
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

    return (
      <TechnicianDashboard
        data={{
          assignedEquipments,
          equipmentStatuses,
          equipmentHistory,
          recentEvaluations,
          notifications: cleanNotifications
        }}
      />
    );
  }

  const trendPageRaw =
    typeof searchParams?.trendPage === 'string' ? Number(searchParams.trendPage) : 1;
  const trendPage = Number.isFinite(trendPageRaw) && trendPageRaw > 0 ? trendPageRaw : 1;
  const trendType =
    typeof searchParams?.trendType === 'string' ? searchParams.trendType.trim() : '';
  const trendPageSize = 10;

  const trendStart = new Date();
  trendStart.setDate(1);
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setMonth(trendStart.getMonth() - 2);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalEquipos,
    activeTechnicians,
    formsSubmitted,
    criticalLast30,
    equipmentDocs,
    equipmentTrendRaw,
    recentCriticals,
    consumptionLast30,
    trendTypes
  ] = await Promise.all([
    Equipment.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'tecnico' }),
    Evaluation.countDocuments(),
    Evaluation.countDocuments({
      status: 'critico',
      completedAt: { $gte: thirtyDaysAgo }
    }),
    Equipment.find({ isActive: true })
      .select('code type nextMaintenanceAt techReviewExpiresAt circulationPermitExpiresAt')
      .sort({ code: 1 })
      .lean(),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: trendStart } } },
      {
        $group: {
          _id: { equipment: '$equipment', year: { $year: '$completedAt' }, month: { $month: '$completedAt' } },
          hourmeterDelta: { $sum: { $ifNull: ['$hourmeterDelta', 0] } },
          odometerDelta: { $sum: { $ifNull: ['$odometerDelta', 0] } },
          fuelAddedLiters: { $sum: { $ifNull: ['$fuelAddedLiters', 0] } },
          energyAddedKwh: { $sum: { $ifNull: ['$energyAddedKwh', 0] } },
          latestCompletedAt: { $max: '$completedAt' },
          total: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'equipments',
          localField: '_id.equipment',
          foreignField: '_id',
          as: 'equipment'
        }
      },
      { $unwind: '$equipment' },
      { $match: { 'equipment.isActive': true } },
      {
        $project: {
          equipmentId: '$_id.equipment',
          code: '$equipment.code',
          type: '$equipment.type',
          year: '$_id.year',
          month: '$_id.month',
          hourmeterDelta: 1,
          odometerDelta: 1,
          fuelAddedLiters: 1,
          energyAddedKwh: 1,
          latestCompletedAt: 1,
          total: 1
        }
      }
    ]),
    Evaluation.find({ status: 'critico' })
      .sort({ completedAt: -1 })
      .limit(6)
      .populate('checklist', 'name')
      .populate('equipment', 'code type')
      .populate('technician', 'name email')
      .lean(),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          fuel: { $sum: { $ifNull: ['$fuelAddedLiters', 0] } },
          energy: { $sum: { $ifNull: ['$energyAddedKwh', 0] } },
          adblue: { $sum: { $ifNull: ['$adblueAddedLiters', 0] } },
          kilometers: { $sum: { $ifNull: ['$odometerDelta', 0] } },
          hours: { $sum: { $ifNull: ['$hourmeterDelta', 0] } }
        }
      }
    ]),
    Equipment.distinct('type', { isActive: true })
  ]);


  const sortedTrendTypes = Array.isArray(trendTypes)
    ? trendTypes.filter(Boolean).sort((a, b) => a.localeCompare(b))
    : [];

  const consumptionTotalsRaw = consumptionLast30[0] || {};
  const consumptionTotals = {
    fuel: Number(consumptionTotalsRaw.fuel || 0),
    energy: Number(consumptionTotalsRaw.energy || 0),
    adblue: Number(consumptionTotalsRaw.adblue || 0),
    kilometers: Number(consumptionTotalsRaw.kilometers || 0),
    hours: Number(consumptionTotalsRaw.hours || 0)
  };

  const baseMonth = new Date();
  baseMonth.setDate(1);
  baseMonth.setHours(0, 0, 0, 0);
  const trendMonths = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(baseMonth);
    date.setMonth(date.getMonth() - index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
    return { key, label };
  });

  const monthKeys = new Set(trendMonths.map((item) => item.key));
  const equipmentTrendMap = {};
  const filteredEquipmentDocs = trendType
    ? equipmentDocs.filter((item) => item.type === trendType)
    : equipmentDocs;

  filteredEquipmentDocs.forEach((item) => {
    const id = item._id.toString();
    equipmentTrendMap[id] = {
      id,
      code: item.code,
      type: item.type || '',
      months: {},
      lastCompletedAt: null
    };
    trendMonths.forEach((month) => {
      equipmentTrendMap[id].months[month.key] = {
        hours: 0,
        kilometers: 0,
        fuel: 0,
        energy: 0,
        total: 0
      };
    });
  });

  equipmentTrendRaw.forEach((item) => {
    const id = item.equipmentId?.toString();
    if (!id || !equipmentTrendMap[id]) return;
    const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
    if (!monthKeys.has(key)) return;
    const target = equipmentTrendMap[id].months[key];
    target.hours += Number(item.hourmeterDelta || 0);
    target.kilometers += Number(item.odometerDelta || 0);
    target.fuel += Number(item.fuelAddedLiters || 0);
    target.energy += Number(item.energyAddedKwh || 0);
    target.total += Number(item.total || 0);
    if (item.latestCompletedAt) {
      const current = equipmentTrendMap[id].lastCompletedAt;
      const next = new Date(item.latestCompletedAt);
      if (!current || next > current) {
        equipmentTrendMap[id].lastCompletedAt = next;
      }
    }
  });

  const equipmentTrend = Object.values(equipmentTrendMap).sort((a, b) => {
    const aTime = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
    const bTime = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.code.localeCompare(b.code);
  });
  const trendTotal = equipmentTrend.length;
  const totalTrendPages = Math.max(1, Math.ceil(trendTotal / trendPageSize));
  const safeTrendPage = Math.min(trendPage, totalTrendPages);
  const trendSliceStart = (safeTrendPage - 1) * trendPageSize;
  const equipmentTrendPage = equipmentTrend.slice(
    trendSliceStart,
    trendSliceStart + trendPageSize
  );

  const typeMap = new Map();
  equipmentDocs.forEach((item) => {
    const type = item.type || '';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });
  const equipmentByType = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const now = new Date();
  const alertWindowMs = ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const smartAlerts = [];
  const pushAlert = (equipment, key, label, dateValue) => {
    if (!dateValue) return;
    const dueAt = new Date(dateValue);
    if (Number.isNaN(dueAt.getTime())) return;
    const diff = dueAt.getTime() - now.getTime();
    if (diff > alertWindowMs) return;
    smartAlerts.push({
      id: `${equipment._id}-${key}`,
      message: `${equipment.code}: ${label}`,
      dueAt,
      level: diff < 0 ? 'high' : 'medium'
    });
  };

  equipmentDocs.forEach((equipment) => {
    pushAlert(equipment, 'maintenance', 'Próxima mantención', equipment.nextMaintenanceAt);
    pushAlert(equipment, 'tech-review', 'Revisión técnica', equipment.techReviewExpiresAt);
    pushAlert(equipment, 'permit', 'Permiso de circulación', equipment.circulationPermitExpiresAt);
  });

  smartAlerts.sort((a, b) => a.dueAt - b.dueAt);

  return (
    <AdminDashboard
      metrics={{
        totalEquipos,
        activeTechnicians,
        formsSubmitted,
        criticalLast30,
        equipmentByType,
        equipmentTrend: equipmentTrendPage,
        trendMonths,
        trendPage: safeTrendPage,
        trendTotal,
        trendPageSize,
        trendType,
        trendTypes: sortedTrendTypes,
        recentCriticals,
        smartAlerts,
        consumption30d: consumptionTotals
      }}
    />
  );
}









