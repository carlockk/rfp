'use client';

import { useMemo, useState } from 'react';
import EquipmentHistoryButton from './EquipmentHistoryButton';
import PaginationControls from './PaginationControls';

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

const PAGE_SIZE = 6;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CL');
};

const formatDuration = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function TechnicianDashboard({ data }) {
  const {
    assignedEquipments,
    equipmentStatuses,
    equipmentHistory,
    recentEvaluations,
    notifications
  } = data;

  const [page, setPage] = useState(1);

  const total = assignedEquipments.length;
  const pagedEquipments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return assignedEquipments.slice(start, start + PAGE_SIZE);
  }, [assignedEquipments, page]);

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
                    <th>Historial</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEquipments.map((equipment) => {
                    const status = equipmentStatuses[equipment.id];
                    const history = equipmentHistory?.[equipment.id] || [];
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
                        <td>
                          <EquipmentHistoryButton
                            equipmentCode={equipment.code}
                            history={history}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {!pagedEquipments.length ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                        {assignedEquipments.length ? 'No hay equipos en esta página.' : 'No tienes equipos asignados actualmente.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE ? (
              <div style={{ marginTop: 12 }}>
                <PaginationControls
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Evaluaciones recientes</h3>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Checklist</th>
                <th>Equipo</th>
                <th>Estado</th>
                <th>Duración</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {recentEvaluations.map((item) => (
                <tr key={item._id.toString()}>
                  <td>{formatDate(item.completedAt)}</td>
                  <td>{item.checklist?.name || item.templateName || '-'}</td>
                  <td>{item.equipment?.code || '-'}</td>
                  <td>
                    <span
                      style={{
                        background: `${(STATUS_COLORS[item.status] || '#607d8b')}22`,
                        color: STATUS_COLORS[item.status] || '#607d8b',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 12
                      }}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </td>
                  <td>{formatDuration(item.durationSeconds)}</td>
                  <td>{item.observations || '-'}</td>
                </tr>
              ))}
              {!recentEvaluations.length ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                    Aún no registras evaluaciones.
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
