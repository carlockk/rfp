'use client';

import { useEffect, useMemo, useState } from 'react';
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

const EQUIPMENT_PAGE_SIZE = 6;
const MAX_RECENT_EVALUATIONS = 4;

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

const formatAnswerValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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
        note: typeof res.note === 'string' && res.note.trim() ? res.note.trim() : ''
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
  } else if (item.templateValues && typeof item.templateValues === 'object') {
    Object.entries(item.templateValues).forEach(([key, value]) => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [previewAnswers, setPreviewAnswers] = useState(null);
  const [checklistStructures, setChecklistStructures] = useState([]);
  const checklistQuestionMap = useMemo(
    () => buildChecklistQuestionMap(checklistStructures),
    [checklistStructures]
  );

  const filteredEquipments = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return assignedEquipments;
    return assignedEquipments.filter((equipment) => {
      const code = (equipment.code || '').toLowerCase();
      const type = (equipment.type || '').toLowerCase();
      return code.includes(term) || type.includes(term);
    });
  }, [assignedEquipments, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

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

  const total = filteredEquipments.length;
  const pagedEquipments = useMemo(() => {
    const start = (page - 1) * EQUIPMENT_PAGE_SIZE;
    return filteredEquipments.slice(start, start + EQUIPMENT_PAGE_SIZE);
  }, [filteredEquipments, page]);

  const limitedEvaluations = recentEvaluations.slice(0, MAX_RECENT_EVALUATIONS);

  const hasAnswers = (item) => {
    if (Array.isArray(item.responses) && item.responses.length) return true;
    if (item.formData && typeof item.formData === 'object' && Object.keys(item.formData).length) return true;
    if (item.templateValues && typeof item.templateValues === 'object' && Object.keys(item.templateValues).length) {
      return true;
    }
    return false;
  };

  const handleOpenAnswers = (item) => {
    const answers = buildAnswersFromEvaluation(item, checklistQuestionMap);
    setPreviewAnswers({
      title: item.checklist?.name || item.templateName || 'Checklist realizado',
      status: item.status,
      equipment: item.equipment?.code || '',
      completedAt: item.completedAt,
      answers
    });
  };

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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Estado de mis equipos</h3>
              <div style={{ minWidth: 220, flex: '0 1 260px' }}>
                <label className="label" htmlFor="equipment-search">
                  Buscar equipo
                </label>
                <input
                  id="equipment-search"
                  type="text"
                  className="input"
                  placeholder="Filtra por código o tipo"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </div>
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
                        {assignedEquipments.length
                          ? searchQuery
                            ? 'No hay equipos que coincidan con tu búsqueda.'
                            : 'No hay equipos en esta página.'
                          : 'No tienes equipos asignados actualmente.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {total > EQUIPMENT_PAGE_SIZE ? (
              <div style={{ marginTop: 12 }}>
                <PaginationControls
                  page={page}
                  pageSize={EQUIPMENT_PAGE_SIZE}
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
        <p className="label" style={{ marginTop: 8, marginBottom: 16 }}>
          Este listado muestra sólo tus últimos formularios enviados (máximo {MAX_RECENT_EVALUATIONS}). Para revisar todos los registros de un equipo en detalle puedes usar el botón “Ver anteriores” en la tabla de estado.
        </p>
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
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {limitedEvaluations.map((item) => (
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
                  <td>
                    {hasAnswers(item) ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAnswers(item)}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          color: 'var(--accent)',
                          fontSize: 13,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Ver checklist
                      </button>
                    ) : (
                      <span className="label">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!recentEvaluations.length ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                    Aún no registras evaluaciones.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      {previewAnswers ? (
        <div className="modal-overlay" onClick={() => setPreviewAnswers(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <h2 className="modal__title" style={{ marginBottom: 8 }}>
                {previewAnswers.title}
              </h2>
              <p className="label" style={{ fontSize: 13 }}>
                <strong>Equipo:</strong> {previewAnswers.equipment || '-'} •{' '}
                <strong>Estado:</strong> {STATUS_LABELS[previewAnswers.status] || previewAnswers.status || '-'} •{' '}
                <strong>Fecha:</strong> {formatDate(previewAnswers.completedAt)}
              </p>
            </div>

            {previewAnswers.answers && previewAnswers.answers.length ? (
              <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto', marginBottom: 16 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pregunta</th>
                      <th>Respuesta</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewAnswers.answers.map((row, idx) => (
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
              <p className="label" style={{ marginBottom: 16 }}>
                No hay respuestas detalladas para esta evaluación.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" type="button" onClick={() => setPreviewAnswers(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
