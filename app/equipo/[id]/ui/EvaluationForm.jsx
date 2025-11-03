'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { submitEvaluation } from '../../../../lib/offline/evaluationsQueue';

const STATUS_OPTIONS = [
  { value: 'ok', label: 'Cumple' },
  { value: 'observado', label: 'Caso NA' },
  { value: 'critico', label: 'No cumple' }
];

const DEFAULT_MULTI_OPTIONS = (options) =>
  Array.isArray(options) && options.length
    ? options
    : [
        { key: 'cumple', label: 'Cumple' },
        { key: 'no-cumple', label: 'No cumple' },
        { key: 'no-aplica', label: 'No aplica' }
      ];

const buildInitialAnswers = (nodes = []) => {
  const answers = {};
  const traverse = (items) => {
    items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      if (item.inputType && item.inputType !== 'section') {
        if (item.inputType === 'select' && item.allowMultiple) {
          answers[item.key] = [];
        } else if (item.inputType === 'checkbox') {
          answers[item.key] = false;
        } else {
          answers[item.key] = '';
        }
      }
      if (Array.isArray(item.children) && item.children.length) {
        traverse(item.children);
      }
    });
  };
  traverse(nodes);
  return answers;
};

const collectResponses = (nodes, answers, responses) => {
  nodes.forEach((node) => {
    if (!node) return;
    if (node.inputType && node.inputType !== 'section') {
      responses.push({
        itemKey: node.key,
        value: answers[node.key] ?? null,
        note: ''
      });
    }
    if (Array.isArray(node.children) && node.children.length) {
      collectResponses(node.children, answers, responses);
    }
  });
};

const findNodeByKey = (nodes, key) => {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const result = findNodeByKey(node.children, key);
      if (result) return result;
    }
  }
  return null;
};

export default function EvaluationForm({ equipment, checklists, variant, onSubmitted }) {
  const [checklistId, setChecklistId] = useState(checklists[0]?.id || '');
  const [status, setStatus] = useState('ok');
  const [observations, setObservations] = useState('');
  const [answers, setAnswers] = useState({});
  const [shift, setShift] = useState('dia');
  const [supervisor, setSupervisor] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const startRef = useRef(new Date());

  const checklistOptions = useMemo(
    () => checklists.map((item) => ({
      value: item.id,
      label: `${item.name} (v${item.version || 1})`
    })),
    [checklists]
  );

  const selectedChecklist = useMemo(
    () => checklists.find((item) => item.id === checklistId) || null,
    [checklists, checklistId]
  );

  useEffect(() => {
    const initialAnswers = buildInitialAnswers(selectedChecklist?.nodes || []);
    setAnswers(initialAnswers);
    startRef.current = new Date();
  }, [selectedChecklist?.id]);

  useEffect(() => {
    setChecklistId(checklists[0]?.id || '');
  }, [checklists]);

  useEffect(() => {
    startRef.current = new Date();
  }, [checklistId, equipment.id]);

  const updateAnswer = (key, value) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const validateRequired = () => {
    if (!selectedChecklist) return null;
    const missing = [];
    const traverse = (nodes) => {
      nodes.forEach((node) => {
        if (!node) return;
        if (node.inputType !== 'section' && node.required) {
          const answer = answers[node.key];
          const isEmpty =
            answer === undefined ||
            answer === null ||
            (Array.isArray(answer) && answer.length === 0) ||
            (typeof answer === 'string' && !answer.trim()) ||
            (typeof answer === 'boolean' && !answer);
          if (isEmpty) {
            missing.push(node.title);
          }
        }
        if (node.children?.length) traverse(node.children);
      });
    };
    traverse(selectedChecklist.nodes || []);
    return missing.length ? missing : null;
  };

  const renderNode = (node, depth = 0) => {
    if (!node) return null;
    const key = node.key;
    const value = answers[key];
    const indent = depth > 0 ? { marginLeft: depth * 12 } : {};

    if (node.inputType === 'section') {
      return (
        <div key={node.key} style={{ marginTop: depth === 0 ? 12 : 8 }}>
          <h4 style={{ marginBottom: 4, ...indent }}>{node.title}</h4>
          {node.description ? (
            <p className="label" style={{ marginBottom: 8, ...indent }}>{node.description}</p>
          ) : null}
          <div style={{ borderLeft: depth === 0 ? 'none' : '2px solid var(--border)', paddingLeft: depth === 0 ? 0 : 12 }}>
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </div>
        </div>
      );
    }

    if (node.inputType === 'select') {
      const options = DEFAULT_MULTI_OPTIONS(node.options);
      if (node.allowMultiple) {
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div key={node.key} className="form-field" style={indent}>
            <label className="label">{node.title}</label>
            {node.description ? (
              <p className="label" style={{ marginBottom: 6 }}>{node.description}</p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {options.map((option) => (
                <label key={option.key} className="label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.key)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selectedValues, option.key]
                        : selectedValues.filter((val) => val !== option.key);
                      updateAnswer(node.key, next);
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div key={node.key} className="form-field" style={indent}>
          <label className="label" htmlFor={node.key}>{node.title}</label>
          {node.description ? (
            <p className="label" style={{ marginBottom: 6 }}>{node.description}</p>
          ) : null}
          <select
            id={node.key}
            className="input"
            value={value || ''}
            onChange={(event) => updateAnswer(node.key, event.target.value)}
          >
            <option value="">Selecciona...</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (node.inputType === 'checkbox') {
      return (
        <div key={node.key} className="form-field" style={{ display: 'flex', alignItems: 'center', gap: 8, ...indent }}>
          <input
            id={node.key}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateAnswer(node.key, event.target.checked)}
          />
          <label className="label" htmlFor={node.key} style={{ margin: 0 }}>
            {node.title}
          </label>
          {node.description ? (
            <span className="label">{node.description}</span>
          ) : null}
        </div>
      );
    }

    if (node.inputType === 'number') {
      return (
        <div key={node.key} className="form-field" style={indent}>
          <label className="label" htmlFor={node.key}>{node.title}</label>
          <input
            id={node.key}
            className="input"
            type="number"
            value={value ?? ''}
            onChange={(event) => updateAnswer(node.key, event.target.value ? Number(event.target.value) : '')}
          />
          {node.description ? (
            <span className="input-hint">{node.description}</span>
          ) : null}
        </div>
      );
    }

    if (node.inputType === 'textarea') {
      return (
        <div key={node.key} className="form-field" style={indent}>
          <label className="label" htmlFor={node.key}>{node.title}</label>
          <textarea
            id={node.key}
            className="input"
            rows={3}
            value={value || ''}
            onChange={(event) => updateAnswer(node.key, event.target.value)}
          />
          {node.description ? (
            <span className="input-hint">{node.description}</span>
          ) : null}
        </div>
      );
    }

    return (
      <div key={node.key} className="form-field" style={indent}>
        <label className="label" htmlFor={node.key}>{node.title}</label>
        <input
          id={node.key}
          className="input"
          value={value || ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        />
        {node.description ? (
          <span className="input-hint">{node.description}</span>
        ) : null}
      </div>
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');

    if (!checklistId || !selectedChecklist) {
      setError('Selecciona un checklist');
      setBusy(false);
      return;
    }

    const missing = validateRequired();
    if (missing && missing.length) {
      setError(`Completa los campos obligatorios: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`);
      setBusy(false);
      return;
    }

    try {
      const responses = [];
      collectResponses(selectedChecklist.nodes || [], answers, responses);

      responses.push({ itemKey: 'estado_general', value: status, note: '' });
      responses.push({ itemKey: 'observaciones', value: observations, note: '' });

      const formData = {
        ...answers,
        estado_general: status,
        observaciones,
        checklistId,
        checklistNombre: selectedChecklist.name,
        variante: variant,
        equipo: equipment.code
      };

      if (variant === 'candelaria') {
        responses.push({ itemKey: 'turno', value: shift, note: '' });
        responses.push({ itemKey: 'supervisor', value: supervisor, note: '' });
        formData.turno = shift;
        formData.supervisor = supervisor;
      }

      const finishedAt = new Date();
      const startedAt = startRef.current;
      const durationSeconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));

      const payload = {
        checklistId,
        equipmentId: equipment.id,
        status,
        observations,
        responses,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationSeconds,
        formData,
        completedAt: finishedAt.toISOString(),
        checklistVersion: selectedChecklist.version || 1
      };

      const result = await submitEvaluation(payload);
      if (result?.queued) {
        setInfo('Sin conexión: evaluación encolada y se enviará al reconectar.');
      } else {
        setInfo('Evaluación registrada correctamente.');
      }

      setObservations('');
      setStatus('ok');
      if (variant === 'candelaria') {
        setSupervisor('');
        setShift('dia');
      }
      const initialAnswers = buildInitialAnswers(selectedChecklist.nodes || []);
      setAnswers(initialAnswers);
      onSubmitted?.(true);
      startRef.current = new Date();
    } catch (err) {
      setError(err.message || 'Error al guardar evaluación');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit} style={{ gap: 16 }}>
      <div className="form-field">
        <label className="label" htmlFor="checklist">Checklist</label>
        <select
          id="checklist"
          className="input"
          value={checklistId}
          onChange={(event) => setChecklistId(event.target.value)}
          required
        >
          <option value="">Selecciona...</option>
          {checklistOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        {selectedChecklist?.nodes?.length ? (
          selectedChecklist.nodes.map((node) => renderNode(node))
        ) : (
          <p className="label">No hay campos configurados para este checklist.</p>
        )}
      </div>

      <div className="form-field">
        <label className="label" htmlFor="status">Estado general</label>
        <select
          id="status"
          className="input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {variant === 'candelaria' ? (
        <>
          <div className="form-field">
            <label className="label" htmlFor="shift">Turno</label>
            <select
              id="shift"
              className="input"
              value={shift}
              onChange={(event) => setShift(event.target.value)}
            >
              <option value="dia">Día</option>
              <option value="noche">Noche</option>
            </select>
          </div>
          <div className="form-field">
            <label className="label" htmlFor="supervisor">Supervisor</label>
            <input
              id="supervisor"
              className="input"
              value={supervisor}
              onChange={(event) => setSupervisor(event.target.value)}
              placeholder="Nombre del supervisor"
            />
          </div>
        </>
      ) : null}

      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
        <label className="label" htmlFor="observations">Observaciones adicionales</label>
        <textarea
          id="observations"
          className="input"
          rows={4}
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          placeholder="Notas o incidencias relevantes"
        />
      </div>

      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
      {info ? <div style={{ color: 'var(--accent)' }}>{info}</div> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn primary" type="submit" disabled={busy || !checklistId}>
          {busy ? 'Enviando...' : 'Enviar evaluación'}
        </button>
        <span className="label" style={{ alignSelf: 'center' }}>
          Equipo: <strong>{equipment.code}</strong>
        </span>
        <span className="label" style={{ alignSelf: 'center' }}>
          Inicio: {startRef.current.toLocaleTimeString()}
        </span>
      </div>
    </form>
  );
}
