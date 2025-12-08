'use client';

import { useEffect, useMemo, useState } from 'react';
import PaginationControls from './PaginationControls';

const STATUS_LABELS = {
  ok: 'Cumple',
  observado: 'Caso NA',
  critico: 'No cumple'
};

const SUPERVISOR_LABELS = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

const SUPERVISOR_COLORS = {
  pendiente: '#607d8b',
  en_revision: '#1565c0',
  aprobado: '#2e7d32',
  rechazado: '#c62828'
};

const PAGE_SIZE = 10;

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatAnswerValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildAnswers = (item) => {
  const answers = [];
  if (Array.isArray(item.responses) && item.responses.length) {
    item.responses.forEach((res) => {
      const key = typeof res?.itemKey === 'string' ? res.itemKey : '';
      if (!key) return;
      answers.push({
        label: key,
        value: formatAnswerValue(res.value),
        note: typeof res.note === 'string' ? res.note : ''
      });
    });
    return answers;
  }

  const source = item.formData && typeof item.formData === 'object' ? item.formData : {};
  Object.entries(source).forEach(([key, value]) => {
    answers.push({
      label: key,
      value: formatAnswerValue(value),
      note: ''
    });
  });
  return answers;
};

export default function SupervisorDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);

  const filteredItems = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((item) => item.supervisorStatus === statusFilter);
  }, [items, statusFilter]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  async function fetchEvaluations() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('supervisorStatus', statusFilter);
      const res = await fetch(`/api/evaluations?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const ordered = Array.isArray(data)
        ? data.slice().sort(
            (a, b) =>
              new Date(b.supervisorStatusAt || b.completedAt || 0).getTime() -
              new Date(a.supervisorStatusAt || a.completedAt || 0).getTime()
          )
        : [];
      setItems(ordered);
      setPage(1);
    } catch (err) {
      setError(err.message || 'Error cargando checklists');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filteredItems.length]);

  const updateStatus = async (id, status) => {
    const note =
      status === 'rechazado'
        ? window.prompt('Ingresa el motivo del rechazo')?.trim()
        : '';
    if (status === 'rechazado' && !note) return;

    try {
      const res = await fetch(`/api/evaluations/${id}/supervisor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          (item._id?.toString?.() || item._id) === id
            ? {
                ...item,
                supervisorStatus: updated.status,
                supervisorNote: updated.note || '',
                supervisorStatusAt: updated.supervisorStatusAt || new Date().toISOString()
              }
            : item
        )
      );
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__titles">
          <p className="page-header__eyebrow">Panel de supervisor</p>
          <h1 className="page-header__title">Checklists asignados</h1>
        </div>
        <div className="page-header__actions">
          <button className="btn" onClick={fetchEvaluations} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <label className="label" htmlFor="filter-status">Estado supervisor</label>
          <select
            id="filter-status"
            className="input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
        <div className="label">
          Resultados: <strong>{filteredItems.length}</strong>
        </div>
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Equipo</th>
              <th>Checklist</th>
              <th>Operador</th>
              <th>Estado</th>
              <th>Supervisor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => {
              const id = item._id?.toString?.() || item._id;
              const supStatus = item.supervisorStatus || 'pendiente';
              const answers = buildAnswers(item);
              return (
                <tr key={id}>
                  <td>{formatDateTime(item.completedAt)}</td>
                  <td>{item.equipment?.code || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--accent)', textDecoration: 'underline', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() =>
                        setPreview({
                          title: item.checklist?.name || item.templateName || 'Checklist',
                          equipment: item.equipment?.code || '-',
                          operator: item.technician?.name || item.technician?.email || '-',
                          completedAt: item.completedAt,
                          answers,
                          status: STATUS_LABELS[item.status] || item.status,
                          observations: item.observations || '',
                          supervisorStatus: SUPERVISOR_LABELS[item.supervisorStatus] || item.supervisorStatus || '-',
                          supervisorNote: item.supervisorNote || ''
                        })
                      }
                    >
                      {item.checklist?.name || item.templateName || '-'}
                    </button>
                  </td>
                  <td>{item.technician?.name || item.technician?.email || '-'}</td>
                  <td>{STATUS_LABELS[item.status] || item.status}</td>
                  <td>
                    <span
                      style={{
                        background: `${(SUPERVISOR_COLORS[supStatus] || '#607d8b')}22`,
                        color: SUPERVISOR_COLORS[supStatus] || '#607d8b',
                        padding: '2px 8px',
                        borderRadius: 8
                      }}
                    >
                      {SUPERVISOR_LABELS[supStatus] || supStatus}
                    </span>
                    <div className="label">
                      {item.supervisorStatusAt ? formatDateTime(item.supervisorStatusAt) : '-'}
                    </div>
                    {item.supervisorNote ? (
                      <div className="label" style={{ color: 'var(--danger)' }}>
                        Nota: {item.supervisorNote}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn" type="button" onClick={() => updateStatus(id, 'en_revision')}>
                        En revisión
                      </button>
                      <button className="btn" type="button" onClick={() => updateStatus(id, 'aprobado')}>
                        Aprobar
                      </button>
                      <button className="btn" type="button" onClick={() => updateStatus(id, 'rechazado')}>
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!pagedItems.length ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                  No hay checklists asignados para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={filteredItems.length}
        onPageChange={setPage}
      />

      {preview ? (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div style={{ marginBottom: 12 }}>
              <h2 className="modal__title" style={{ marginBottom: 8 }}>{preview.title}</h2>
              <p className="label" style={{ fontSize: 13 }}>
                <strong>Equipo:</strong> {preview.equipment}{' '}
                <strong>Operador:</strong> {preview.operator}{' '}
                <strong>Fecha:</strong> {formatDateTime(preview.completedAt)}
              </p>
              <p className="label" style={{ fontSize: 13 }}>
                <strong>Estado operador:</strong> {preview.status} |{' '}
                <strong>Estado supervisor:</strong> {preview.supervisorStatus}{' '}
                {preview.supervisorNote ? `(Nota: ${preview.supervisorNote})` : ''}
              </p>
              {preview.observations ? (
                <p className="label"><strong>Observaciones:</strong> {preview.observations}</p>
              ) : null}
            </div>
            {preview.answers && preview.answers.length ? (
              <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto', marginBottom: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pregunta</th>
                      <th>Respuesta</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.answers.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ width: '45%' }}>{row.label}</td>
                        <td style={{ width: '35%' }}>{row.value}</td>
                        <td style={{ width: '20%' }}>{row.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="label" style={{ marginBottom: 12 }}>No hay respuestas para mostrar.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" type="button" onClick={() => setPreview(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
