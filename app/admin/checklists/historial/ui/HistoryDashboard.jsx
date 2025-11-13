'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale/es';
import 'react-day-picker/dist/style.css';
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

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const startOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

const generateDaysBetween = (start, end) => {
  const days = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const formatRangeLabel = (from, to) => {
  if (!from || !to) return 'Sin rango';
  const formatter = (value) =>
    value.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${formatter(from)} - ${formatter(to)}`;
};

const dayKey = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* ──────────────────────────────────────────────
   Helpers para mostrar respuestas en el modal
   ────────────────────────────────────────────── */

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

/**
 * Aplana los nodos de un checklist (versión actual) en un array plano.
 */
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

/**
 * Construye un mapa checklistId -> Map(itemKey -> labelPregunta)
 */
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

  // Template fields (para plantillas genéricas)
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

  // Preguntas de checklist
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
    // 1) Buscar en plantilla
    const templateField = templateFieldMap.get(itemKey);
    if (templateField) return resolveFieldLabel(templateField, itemKey);
    // 2) Buscar en checklist
    if (checklistQuestions && checklistQuestions.has(itemKey)) {
      return checklistQuestions.get(itemKey) || itemKey;
    }
    // 3) Fallback
    return itemKey;
  };

  // 1) Usar responses si existen
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
    // 2) Si no hay responses, usar formData
    Object.entries(item.formData).forEach(([key, value]) => {
      const label = resolveLabelFromAnySource(key);
      answers.push({
        label,
        value: formatAnswerValue(value),
        note: ''
      });
    });
  } else if (item.templateValues && typeof item.templateValues === 'object') {
    // 3) Como último recurso, templateValues
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

export default function HistoryDashboard({ checklistOptions, technicianOptions, equipmentOptions }) {
  const [filters, setFilters] = useState({
    checklistId: '',
    technicianId: '',
    equipmentId: '',
    status: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluations, setEvaluations] = useState([]);
  const [page, setPage] = useState(1);
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [previewAnswers, setPreviewAnswers] = useState(null);

  // Estructuras completas de checklists (con nodos/preguntas)
  const [checklistStructures, setChecklistStructures] = useState([]);

  // Calendario colapsable
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [selectedDays, setSelectedDays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(today);

  const initialFetchDone = useRef(false);

  const dateBounds = useMemo(() => {
    if (!selectedDays.length) return null;
    const sorted = selectedDays
      .slice()
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      from: startOfDay(sorted[0]),
      to: endOfDay(sorted[sorted.length - 1])
    };
  }, [selectedDays]);

  const filteredTechnicians = technicianOptions || [];
  const filteredChecklists = checklistOptions || [];
  const filteredEquipments = equipmentOptions || [];

  const selectedDayKeys = useMemo(() => {
    if (!selectedDays.length) return null;
    const set = new Set(
      selectedDays.map((day) => dayKey(startOfDay(day)))
    );
    return set;
  }, [selectedDays]);

  const filteredEvaluations = useMemo(() => {
    if (!selectedDayKeys || !selectedDayKeys.size) return evaluations;
    return evaluations.filter((item) => {
      if (!item?.completedAt) return false;
      const completed = new Date(item.completedAt);
      if (Number.isNaN(completed.getTime())) return false;
      const key = dayKey(startOfDay(completed));
      return selectedDayKeys.has(key);
    });
  }, [evaluations, selectedDayKeys]);

  const chartData = useMemo(() => {
    const counts = filteredEvaluations.reduce(
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
  }, [filteredEvaluations]);

  const totalEvaluations = filteredEvaluations.length;

  const pagedEvaluations = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEvaluations.slice(start, start + PAGE_SIZE);
  }, [filteredEvaluations, page]);

  // Mapa checklistId -> Map(itemKey -> labelPregunta)
  const checklistQuestionMap = useMemo(
    () => buildChecklistQuestionMap(checklistStructures),
    [checklistStructures]
  );

  async function fetchEvaluations() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.checklistId) params.append('checklistId', filters.checklistId);
      if (filters.technicianId) params.append('technicianId', filters.technicianId);
      if (filters.equipmentId) params.append('equipmentId', filters.equipmentId);
      if (dateBounds?.from) params.append('from', dateBounds.from.toISOString());
      if (dateBounds?.to) params.append('to', dateBounds.to.toISOString());

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

  // Cargar evaluaciones al entrar
  useEffect(() => {
    fetchEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar estructuras de checklists (con nodos/preguntas) al entrar
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
        // si falla, no rompemos nada: sólo no tendremos labels bonitos
      }
    };
    loadChecklists();
  }, []);

  useEffect(() => {
    if (selectedDayKeys && selectedDayKeys.size && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchEvaluations();
    }
    if (selectedDayKeys && selectedDayKeys.size) {
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayKeys]);

  const handleExportCSV = () => {
    if (!filteredEvaluations.length) return;
    const rows = filteredEvaluations.map((item) => ({
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

  const handleOpenAnswers = (item) => {
    const answers = buildAnswersFromEvaluation(item, checklistQuestionMap);
    setPreviewAnswers({
      title: item.checklist?.name || item.templateName || 'Respuestas del formulario',
      status: item.status,
      equipment: item.equipment?.code || '',
      operator: item.technician?.name || item.technician?.email || '',
      completedAt: item.completedAt,
      answers
    });
  };

  const hasAnswers = (item) => {
    if (Array.isArray(item.responses) && item.responses.length) return true;
    if (item.formData && typeof item.formData === 'object' && Object.keys(item.formData).length) return true;
    if (item.templateValues && typeof item.templateValues === 'object' && Object.keys(item.templateValues).length) {
      return true;
    }
    return false;
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
          <button className="btn" onClick={handleExportCSV} disabled={!filteredEvaluations.length}>
            Exportar CSV
          </button>
          <button className="btn" onClick={handlePrint}>
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Calendario colapsable */}
      <div
        className="date-filter-card"
        style={{
          marginBottom: 16,
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Header colapsable */}
        <button
          type="button"
          onClick={() => setIsDateFilterOpen((prev) => !prev)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            border: 'none',
            background: 'var(--card)',
            cursor: 'pointer',
            borderRadius: 12,
            boxShadow: '0 1px 2px rgba(15,23,42,0.05)'
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <p className="label" style={{ marginBottom: 2, fontSize: 12, textTransform: 'uppercase' }}>
              Filtros de fecha
            </p>
            <p className="label" style={{ fontSize: 13 }}>
              {selectedDays.length
                ? `Seleccionados: ${selectedDays.length} día(s) • ${formatRangeLabel(
                    dateBounds?.from,
                    dateBounds?.to
                  )}`
                : 'Selecciona uno o más días en el calendario'}
            </p>
          </div>
          <span
            style={{
              fontSize: 18,
              transform: isDateFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease'
            }}
          >
            ▾
          </span>
        </button>

        {/* Contenido desplegable */}
        {isDateFilterOpen && (
          <div
            style={{
              marginTop: 8,
              padding: '12px 16px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)'
            }}
          >
            <DayPicker
              mode="multiple"
              month={currentMonth}
              selected={selectedDays}
              onSelect={(days) => {
                if (!days || days.length === 0) {
                  setSelectedDays([]);
                  return;
                }
                const sorted = days
                  .slice()
                  .sort((a, b) => a.getTime() - b.getTime());
                if (sorted.length === 1) {
                  setSelectedDays(sorted);
                  return;
                }
                const first = startOfDay(sorted[0]);
                const last = endOfDay(sorted[sorted.length - 1]);
                setSelectedDays(generateDaysBetween(first, last));
              }}
              onMonthChange={setCurrentMonth}
              locale={es}
              showOutsideDays
              numberOfMonths={1}
              weekStartsOn={1}
            />

            <div className="date-filter__actions">
              <button
                type="button"
                className="date-filter__btn"
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(now);
                  setSelectedDays(generateDaysBetween(startOfMonth(now), endOfMonth(now)));
                }}
              >
                Mes actual
              </button>
              <button
                type="button"
                className="date-filter__btn"
                onClick={() => {
                  const todayOnly = startOfDay(new Date());
                  setCurrentMonth(todayOnly);
                  setSelectedDays([todayOnly]);
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className="date-filter__btn"
                onClick={() => {
                  const end = new Date();
                  const start = new Date(end);
                  start.setDate(start.getDate() - 6);
                  setCurrentMonth(start);
                  setSelectedDays(generateDaysBetween(startOfDay(start), endOfDay(end)));
                }}
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                className="date-filter__btn"
                onClick={() => setSelectedDays([])}
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="filters-grid"
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          marginBottom: 16
        }}
      >
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
          <label className="label" htmlFor="technician">Operador</label>
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
              <th>Operador</th>
              <th>Estado</th>
              <th>Duracion</th>
              <th>Fotos</th>
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
                <td>
                  {Array.isArray(item.evidencePhotos) && item.evidencePhotos.length ? (
                    <div className="evidence-thumbs">
                      {item.evidencePhotos.map((photo, photoIndex) => {
                        const src = photo.url || photo.dataUrl;
                        if (!src) return null;
                        return (
                          <button
                            type="button"
                            className="evidence-thumb__button"
                            key={`${photo.name || 'photo'}-${photoIndex}`}
                            onClick={() => setPreviewEvidence({ src, name: photo.name || `Foto ${photoIndex + 1}` })}
                          >
                            <img src={src} alt={photo.name || 'Foto'} className="evidence-thumb__image" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="label">-</span>
                  )}
                </td>
                <td style={{ maxWidth: 280 }}>
                  <div className="label">
                    {item.observations || '-'}
                    {hasAnswers(item) && (
                      <button
                        type="button"
                        onClick={() => handleOpenAnswers(item)}
                        style={{
                          marginLeft: 8,
                          marginTop: 4,
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          color: 'var(--accent)',
                          fontSize: 12,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Ver
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : null}
            {!evaluations.length ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
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

      {previewEvidence ? (
        <div className="modal-overlay" onClick={() => setPreviewEvidence(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <img src={previewEvidence.src} alt={previewEvidence.name} className="modal__image" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" type="button" onClick={() => setPreviewEvidence(null)}>
                Cerrar
              </button>
              <a className="btn primary" href={previewEvidence.src} target="_blank" rel="noreferrer">
                Abrir
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {previewAnswers ? (
        <div className="modal-overlay" onClick={() => setPreviewAnswers(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <h2 className="modal__title" style={{ marginBottom: 8 }}>
                {previewAnswers.title}
              </h2>
              <p className="label" style={{ fontSize: 13 }}>
                <strong>Equipo:</strong> {previewAnswers.equipment || '-'}{' '}
                • <strong>Operador:</strong> {previewAnswers.operator || '-'}{' '}
                • <strong>Fecha:</strong> {formatDateTime(previewAnswers.completedAt)}
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
