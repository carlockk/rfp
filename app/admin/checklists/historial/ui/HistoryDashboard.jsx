'use client';

import { useEffect, useMemo, useState } from 'react';
import PaginationControls from '@/app/ui/PaginationControls';

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

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatDuration = (seconds) => {
  if (!seconds || Number.isNaN(seconds)) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const toCSV = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const str = value == null ? '' : String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))
  ];
  return lines.join('\n');
};

const PAGE_SIZE = 10;

export default function HistoryDashboard({ checklistOptions, technicianOptions, equipmentOptions }) {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    checklistId: '',
    technicianId: '',
    equipmentId: '',
    status: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluations, setEvaluations] = useState([]);
  const [page, setPage] = useState(1);

  const filteredTechnicians = technicianOptions || [];
  const filteredChecklists = checklistOptions || [];
  const filteredEquipments = equipmentOptions || [];

  const chartData = useMemo(() => {
    const counts = evaluations.reduce(
      (acc, item) => {
        const key = item.status || 'ok';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { ok: 0, observado: 0, critico: 0 }
    );
    return Object.keys(counts).map((key) => ({
      status: key,
      label: STATUS_LABELS[key] || key,
      value: counts[key] || 0
    }));
  }, [evaluations]);

  const totalEvaluations = evaluations.length;

  const pagedEvaluations = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return evaluations.slice(start, start + PAGE_SIZE);
  }, [evaluations, page]);

  async function fetchEvaluations() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.status) params.append('status', filters.status);
      if (filters.checklistId) params.append('checklistId', filters.checklistId);
      if (filters.technicianId) params.append('technicianId', filters.technicianId);
      if (filters.equipmentId) params.append('equipmentId', filters.equipmentId);

      const res = await fetch(`/api/evaluations?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ordered = Array.isArray(data)
        ? data
            .slice()
            .sort(
              (a, b) =>
                new Date(b.completedAt || b.createdAt || 0).getTime() -
                new Date(a.completedAt || a.createdAt || 0).getTime()
            )
        : [];
      setEvaluations(ordered);
      setPage(1);
    } catch (err) {
      setError(err.message || 'Error obteniendo evaluaciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCSV = () => {
    if (!evaluations.length) return;
    const rows = evaluations.map((item, index) => ({
      fecha: formatDateTime(item.completedAt),
      checklist: item.checklist?.name || '-',
      version: item.checklistVersion || '-',
      equipo: item.equipment?.code || '-',
      tecnico: item.technician?.name || item.technician?.email || '-',
      estado: STATUS_LABELS[item.status] || item.status,
      duracion: formatDuration(item.durationSeconds),
      observaciones: item.observations || '',
      respuestas: JSON.stringify(item.formData || {}, null, 2)
    }));
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evaluaciones-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Reportes</p>
            <h1 className="page-header__title">Historial de evaluaciones</h1>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn" onClick={handleExportCSV} disabled={!evaluations.length}>
            Exportar CSV
          </button>
          <button className="btn" onClick={handlePrint}>
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="filters-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 16 }}>
        <div>
          <label className="label" htmlFor="from">Desde</label>
          <input
            id="from"
            className="input"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">Hasta</label>
          <input
            id="to"
            className="input"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="checklist">Checklist</label>
          <select
            id="checklist"
            className="input"
            value={filters.checklistId}
            onChange={(event) => setFilters((prev) => ({ ...prev, checklistId: event.target.value }))}
          >
            <option value="">Todos</option>
            {filteredChecklists.map((checklist) => (
              <option key={checklist.id} value={checklist.id}>
                {checklist.name} (v{checklist.currentVersion})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="technician">Tecnico</label>
          <select
            id="technician"
            className="input"
            value={filters.technicianId}
            onChange={(event) => setFilters((prev) => ({ ...prev, technicianId: event.target.value }))}
          >
            <option value="">Todos</option>
            {filteredTechnicians.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ? `${user.name} (${user.email})` : user.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="equipment">Equipo</label>
          <select
            id="equipment"
            className="input"
            value={filters.equipmentId}
            onChange={(event) => setFilters((prev) => ({ ...prev, equipmentId: event.target.value }))}
          >
            <option value="">Todos</option>
            {filteredEquipments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.type ? `(${item.type})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Estado</label>
          <select
            id="status"
            className="input"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">Todos</option>
            <option value="ok">Cumple</option>
            <option value="critico">No cumple</option>
            <option value="observado">Caso NA</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <button className="btn primary" onClick={fetchEvaluations} disabled={loading}>
          {loading ? 'Filtrando...' : 'Aplicar filtros'}
        </button>
        <span className="label">
          Resultados: <strong>{totalEvaluations}</strong>
        </span>
        {error ? <span style={{ color: 'var(--danger)' }}>{error}</span> : null}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-end',
          marginBottom: 24,
          flexWrap: 'wrap'
        }}
      >
        {chartData.map((item) => {
          const percentage = totalEvaluations ? Math.round((item.value / totalEvaluations) * 100) : 0;
          return (
            <div key={item.status} style={{ minWidth: 140 }}>
              <div
                style={{
                  height: 120,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  padding: 8,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.05), transparent)'
                }}
              >
                <div
                  style={{
                    width: '60%',
                    height: `${percentage || (item.value ? 20 : 4)}%`,
                    background: STATUS_COLORS[item.status] || 'var(--accent)',
                    borderRadius: 6,
                    minHeight: item.value ? 8 : 4
                  }}
                />
              </div>
              <p className="label" style={{ textAlign: 'center', marginTop: 8 }}>
                {item.label}: <strong>{item.value}</strong>
              </p>
            </div>
          );
        })}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Checklist</th>
              <th>Version</th>
              <th>Equipo</th>
              <th>Tecnico</th>
              <th>Estado</th>
              <th>Duracion</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.length ? pagedEvaluations.map((item, index) => (
              <tr key={item._id?.toString?.() || item._id || index}>
                <td>{formatDateTime(item.completedAt)}</td>
                <td>{item.checklist?.name || '-'}</td>
                <td>{item.checklistVersion || '-'}</td>
                <td>{item.equipment?.code || '-'}</td>
                <td>{item.technician?.name || item.technician?.email || '-'}</td>
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
                <td style={{ maxWidth: 280 }}>
                  <div className="label">
                    {item.observations || '-'}
                    {item.formData ? (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>Ver respuestas</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                          {JSON.stringify(item.formData, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : null}
            {!evaluations.length ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  No hay evaluaciones para los filtros seleccionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={evaluations.length}
        onPageChange={setPage}
      />
    </div>
  );
}
