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

const formatMetric = (value) => {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString('es-CL', { maximumFractionDigits: 1 });
};

const flattenChecklistNodes = (checklist) => {
  if (!checklist || typeof checklist !== 'object') return [];

  let nodes = [];

  if (Array.isArray(checklist.nodes)) {
    nodes = checklist.nodes;
  } else if (checklist.structure && Array.isArray(checklist.structure.nodes)) {
    nodes = checklist.structure.nodes;
  } else if (Array.isArray(checklist.versions) && checklist.versions.length) {
    const currentVersion = checklist.currentVersion;
    const versionObj =
      checklist.versions.find((v) => v.version === currentVersion) ||
      checklist.versions[0];
    if (Array.isArray(versionObj?.nodes)) {
      nodes = versionObj.nodes;
    }
  }

  const result = [];
  const visit = (arr) => {
    arr.forEach((node) => {
      if (!node || typeof node !== 'object') return;
      result.push(node);
      if (Array.isArray(node.children) && node.children.length) {
        visit(node.children);
      }
      if (Array.isArray(node.items) && node.items.length) {
        visit(node.items);
      }
    });
  };

  visit(nodes);
  return result;
};

const buildChecklistQuestionMap = (checklistStructures) => {
  const outerMap = new Map();

  (checklistStructures || []).forEach((checklist) => {
    const id =
      checklist.id ||
      (checklist._id && checklist._id.toString ? checklist._id.toString() : checklist._id);
    if (!id) return;

    const nodes = flattenChecklistNodes(checklist);
    const innerMap = new Map();

    nodes.forEach((node) => {
      const key = node.key || node.id;
      if (!key) return;
      const label =
        node.label ||
        node.title ||
        node.text ||
        node.name ||
        node.placeholder ||
        key;
      innerMap.set(key, label);
    });

    if (innerMap.size) {
      outerMap.set(id, innerMap);
    }
  });

  return outerMap;
};

const flattenTemplateFieldsClient = (fields = []) => {
  const result = [];
  fields.forEach((field) => {
    if (!field || typeof field !== 'object') return;
    result.push(field);
    if (Array.isArray(field.children) && field.children.length) {
      result.push(...flattenTemplateFieldsClient(field.children));
    }
  });
  return result;
};

const resolveFieldLabel = (field, fallbackKey) => {
  if (!field || typeof field !== 'object') return fallbackKey;
  return (
    field.label ||
    field.title ||
    field.name ||
    field.text ||
    field.placeholder ||
    field.key ||
    fallbackKey
  );
};

const buildAnswersFromEvaluation = (item, checklistQuestionMap) => {
  const answers = [];

  const templateFields = Array.isArray(item.templateFields)
    ? flattenTemplateFieldsClient(item.templateFields)
    : [];
  const templateFieldMap = new Map(
    templateFields
      .map((field) => {
        const key = typeof field?.key === 'string' ? field.key : '';
        return key ? [key, field] : null;
      })
      .filter(Boolean)
  );

  const checklistIdRaw =
    item.checklist?._id?.toString?.() ||
    item.checklist?._id ||
    item.checklistId ||
    '';
  const checklistQuestions =
    checklistIdRaw && checklistQuestionMap
      ? checklistQuestionMap.get(checklistIdRaw)
      : null;

  const resolveLabelFromAnySource = (itemKey) => {
    if (!itemKey) return '';
    const templateField = templateFieldMap.get(itemKey);
    if (templateField) return resolveFieldLabel(templateField, itemKey);
    if (checklistQuestions && checklistQuestions.has(itemKey)) {
      return checklistQuestions.get(itemKey) || itemKey;
    }
    return itemKey;
  };

  if (Array.isArray(item.responses) && item.responses.length) {
    item.responses.forEach((res) => {
      const itemKey = typeof res?.itemKey === 'string' ? res.itemKey : '';
      if (!itemKey) return;
      const label = resolveLabelFromAnySource(itemKey);
      answers.push({
        label,
        value: formatAnswerValue(res.value),
        note: typeof res.note === 'string' ? res.note : ''
      });
    });
  } else if (item.formData && typeof item.formData === 'object') {
    Object.entries(item.formData).forEach(([key, value]) => {
      const label = resolveLabelFromAnySource(key);
      answers.push({
        label,
        value: formatAnswerValue(value),
        note: ''
      });
    });
  }

  return answers;
};

export default function SupervisorDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);
  const [checklistStructures, setChecklistStructures] = useState([]);
  const [info, setInfo] = useState('');

  const checklistQuestionMap = useMemo(
    () => buildChecklistQuestionMap(checklistStructures),
    [checklistStructures]
  );

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
    setInfo('');
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
    const loadChecklists = async () => {
      try {
        const res = await fetch('/api/checklists?includeStructure=true&includeInactive=true', {
          cache: 'no-store'
        });
        if (!res.ok) return;
        const data = await res.json();
        setChecklistStructures(Array.isArray(data) ? data : []);
      } catch {
        setChecklistStructures([]);
      }
    };
    loadChecklists();
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
      const statusLabel = SUPERVISOR_LABELS[status] || status;
      setInfo(`${statusLabel} con éxito`);
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
      setInfo('');
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
        {info ? <div style={{ color: 'var(--accent)' }}>{info}</div> : null}
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
              <th>Horometro</th>
              <th>Delta horometro</th>
              <th>Odometro</th>
              <th>Delta odometro</th>
              <th>Supervisor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => {
              const id = item._id?.toString?.() || item._id;
              const supStatus = item.supervisorStatus || 'pendiente';
              const answers = buildAnswersFromEvaluation(item, checklistQuestionMap);
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
                          hourmeterCurrent: item.hourmeterCurrent ?? null,
                          hourmeterDelta: item.hourmeterDelta ?? null,
                          odometerCurrent: item.odometerCurrent ?? null,
                          odometerDelta: item.odometerDelta ?? null,
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
                  <td>{formatMetric(item.hourmeterCurrent)}</td>
                  <td>{formatMetric(item.hourmeterDelta)}</td>
                  <td>{formatMetric(item.odometerCurrent)}</td>
                  <td>{formatMetric(item.odometerDelta)}</td>
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
                <td colSpan={11} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
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
              <p className="label" style={{ fontSize: 13 }}>
                <strong>Horometro:</strong> {formatMetric(preview.hourmeterCurrent)}{' '}
                <strong>Delta horometro:</strong> {formatMetric(preview.hourmeterDelta)}{' '}
                <strong>Odometro:</strong> {formatMetric(preview.odometerCurrent)}{' '}
                <strong>Delta odometro:</strong> {formatMetric(preview.odometerDelta)}
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
