import { redirect } from 'next/navigation';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Equipment from '@/models/Equipment';
import Evaluation from '@/models/Evaluation';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { buildComputedChecklistAlerts } from '@/lib/notifications';
import GlobalSearch from './GlobalSearch';

const STATUS_KEYS = ['ok', 'observado', 'critico'];

const STATUS_LABELS = {
  ok: 'Cumple',
  observado: 'Caso NA',
  critico: 'No cumple'
};

const STATUS_COLORS = {
  ok: '#2e7d32',
  observado: '#f9a825',
  critico: '#c62828'
};

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
    monthlyStats,
    recentCriticals,
    notifications,
    consumption30d
  } = metrics;

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
        <div className="col" style={{ flexBasis: '60%' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Tendencia mensual</h3>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {monthlyStats.map((item) => (
                <div key={item.month} className="kpi-card" style={{ background: 'var(--surface)', padding: 16 }}>
                  <p className="label" style={{ margin: 0 }}>{item.month}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 }}>
                    <div>
                      <span className="label">Total</span>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{item.total}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {STATUS_KEYS.map((status) => (
                        <span key={status} className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: STATUS_COLORS[status],
                              display: 'inline-block'
                            }}
                          />
                          {item[status]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div className="label">
                      Horas<br />
                      <strong>{item.hourmeterDelta.toFixed(1)}</strong>
                    </div>
                    <div className="label">
                      Km<br />
                      <strong>{item.odometerDelta.toFixed(1)}</strong>
                    </div>
                    <div className="label">
                      Combustible (L)<br />
                      <strong>{item.fuelAddedLiters.toFixed(1)}</strong>
                    </div>
                    <div className="label">
                      Energía (kWh)<br />
                      <strong>{item.energyAddedKwh.toFixed(1)}</strong>
                    </div>
                    <div className="label">
                      AdBlue (L)<br />
                      <strong>{item.adblueAddedLiters.toFixed(1)}</strong>
                    </div>
                  </div>
                </div>
              ))}
              {!monthlyStats.length ? (
                <p className="label" style={{ color: 'var(--muted)' }}>
                  Aún no hay evaluaciones en los últimos meses.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col" style={{ flexBasis: '40%' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Alertas inteligentes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notifications.length ? (
                notifications.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      borderLeft: `4px solid ${alert.level === 'high' ? '#c62828' : alert.level === 'medium' ? '#f9a825' : '#1976d2'}`,
                      background: 'var(--surface)',
                      padding: '8px 12px'
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600 }}>{alert.message}</p>
                    <span className="label">{formatDate(alert.createdAt)}</span>
                  </div>
                ))
              ) : (
                <p className="label" style={{ color: 'var(--muted)' }}>No hay alertas activas.</p>
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
                </tr>
              ))}
              {!recentCriticals.length ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
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

function TechnicianDashboard({ data }) {
  const {
    assignedEquipments,
    equipmentStatuses,
    recentEvaluations,
    notifications
  } = data;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="page-header__titles">
          <p className="page-header__eyebrow">Panel del técnico</p>
          <h1 className="page-header__title">Mis equipos y formularios</h1>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{assignedEquipments.length}</div>
            <div className="label">Equipos asignados</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{recentEvaluations.length}</div>
            <div className="label">Evaluaciones recientes</div>
          </div>
        </div>
        <div className="col">
          <div className="card kpi-card">
            <div className="kpi">{notifications.length}</div>
            <div className="label">Alertas pendientes</div>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <div className="col" style={{ flexBasis: '60%' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Estado de mis equipos</h3>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Tipo</th>
                    <th>Último estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedEquipments.map((equipment) => {
                    const status = equipmentStatuses[equipment.id];
                    return (
                      <tr key={equipment.id}>
                        <td>{equipment.code}</td>
                        <td>{equipment.type || '-'}</td>
                        <td>
                          {status ? (
                            <span
                              style={{
                                background: `${(STATUS_COLORS[status.status] || '#607d8b')}22`,
                                color: STATUS_COLORS[status.status] || '#607d8b',
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 12
                              }}
                            >
                              {STATUS_LABELS[status.status] || status.status}
                            </span>
                          ) : (
                            'Sin registro'
                          )}
                        </td>
                        <td>{status ? formatDate(status.completedAt) : '-'}</td>
                      </tr>
                    );
                  })}
                  {!assignedEquipments.length ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                        No tienes equipos asignados actualmente.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col" style={{ flexBasis: '40%' }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Alertas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notifications.length ? (
                notifications.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      borderLeft: `4px solid ${alert.level === 'high' ? '#c62828' : alert.level === 'medium' ? '#f9a825' : '#1976d2'}`,
                      background: 'var(--surface)',
                      padding: '8px 12px'
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600 }}>{alert.message}</p>
                    <span className="label">{formatDate(alert.createdAt)}</span>
                  </div>
                ))
              ) : (
                <p className="label" style={{ color: 'var(--muted)' }}>No tienes alertas pendientes.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      
    </div>
  );
}

export default async function Dashboard() {
  await dbConnect();
  const session = await getSession();
  if (!session) redirect('/login');

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
      .limit(6)
      .populate('checklist', 'name')
      .populate('equipment', 'code type')
      .lean();

    const equipmentIds = assignedEquipmentsDocs.map((item) => item._id);

    const lastEvaluations = equipmentIds.length
      ? await Evaluation.aggregate([
          { $match: { equipment: { $in: equipmentIds }, completedAt: { $exists: true } } },
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

    return (
      <TechnicianDashboard
        data={{
          assignedEquipments,
          equipmentStatuses,
          recentEvaluations,
          notifications: cleanNotifications
        }}
      />
    );
  }

  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalEquipos,
    activeTechnicians,
    formsSubmitted,
    criticalLast30,
    monthlyStatsRaw,
    recentCriticals,
    notificationsRaw,
    computedAlerts,
    consumptionLast30
  ] = await Promise.all([
    Equipment.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'tecnico' }),
    Evaluation.countDocuments(),
    Evaluation.countDocuments({
      status: 'critico',
      completedAt: { $gte: thirtyDaysAgo }
    }),
    Evaluation.aggregate([
      { $match: { completedAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$completedAt' }, month: { $month: '$completedAt' } },
          total: { $sum: 1 },
          ok: { $sum: { $cond: [{ $eq: ['$status', 'ok'] }, 1, 0] } },
          observado: { $sum: { $cond: [{ $eq: ['$status', 'observado'] }, 1, 0] } },
          critico: { $sum: { $cond: [{ $eq: ['$status', 'critico'] }, 1, 0] } },
          hourmeterDelta: { $sum: { $ifNull: ['$hourmeterDelta', 0] } },
          odometerDelta: { $sum: { $ifNull: ['$odometerDelta', 0] } },
          fuelAddedLiters: { $sum: { $ifNull: ['$fuelAddedLiters', 0] } },
          energyAddedKwh: { $sum: { $ifNull: ['$energyAddedKwh', 0] } },
          adblueAddedLiters: { $sum: { $ifNull: ['$adblueAddedLiters', 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    Evaluation.find({ status: 'critico' })
      .sort({ completedAt: -1 })
      .limit(6)
      .populate('checklist', 'name')
      .populate('equipment', 'code type')
      .populate('technician', 'name email')
      .lean(),
    Notification.find({ $or: [{ audience: 'all' }, { audience: 'admin' }] })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    buildComputedChecklistAlerts(),
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
    ])
  ]);

  const consumptionTotalsRaw = consumptionLast30[0] || {};
  const consumptionTotals = {
    fuel: Number(consumptionTotalsRaw.fuel || 0),
    energy: Number(consumptionTotalsRaw.energy || 0),
    adblue: Number(consumptionTotalsRaw.adblue || 0),
    kilometers: Number(consumptionTotalsRaw.kilometers || 0),
    hours: Number(consumptionTotalsRaw.hours || 0)
  };

  const monthlyStats = monthlyStatsRaw.map((item) => {
    const year = item._id.year;
    const month = item._id.month - 1;
    const label = new Date(year, month, 1).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
    return {
      month: label,
      total: item.total,
      ok: item.ok,
      observado: item.observado,
      critico: item.critico,
      hourmeterDelta: item.hourmeterDelta || 0,
      odometerDelta: item.odometerDelta || 0,
      fuelAddedLiters: item.fuelAddedLiters || 0,
      energyAddedKwh: item.energyAddedKwh || 0,
      adblueAddedLiters: item.adblueAddedLiters || 0
    };
  });

  const notifications = [
    ...computedAlerts.map((alert) => ({
      id: alert.id,
      message: alert.message,
      level: alert.level,
      createdAt: alert.createdAt
    })),
    ...notificationsRaw.map((item) => ({
      id: item._id.toString(),
      message: item.message,
      level: item.level,
      createdAt: item.createdAt
    }))
  ].slice(0, 6);

  return (
    <AdminDashboard
      metrics={{
        totalEquipos,
        activeTechnicians,
        formsSubmitted,
        criticalLast30,
        monthlyStats,
        recentCriticals,
        notifications,
        consumption30d: consumptionTotals
      }}
    />
  );
}









