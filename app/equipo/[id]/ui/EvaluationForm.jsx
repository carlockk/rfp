'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { submitEvaluation } from '../../../../lib/offline/evaluationsQueue';
import TemplateForm from './TemplateForm';
import { matchTemplateForEquipment } from '@/lib/evaluationTemplates';

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

export default function EvaluationForm({
  equipment,
  checklists,
  variant,
  templates = [],
  techProfile = 'externo',
  checklistSkipAllowed = false,
  onSubmitted
}) {
  const [checklistId, setChecklistId] = useState(checklists[0]?.id || '');
  const [status, setStatus] = useState('ok');
  const [observations, setObservations] = useState('');
  const [answers, setAnswers] = useState({});
  const [hourmeter, setHourmeter] = useState('');
  const [odometer, setOdometer] = useState('');
  const [shift, setShift] = useState('dia');
  const [supervisor, setSupervisor] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [skipChecklist, setSkipChecklist] = useState(false);

  const startRef = useRef(new Date());

  const checklistOptions = useMemo(
    () =>
      checklists.map((item) => ({
        value: item.id,
        label: `${item.name} (v${item.version || 1})${item.isMandatory ? ' · Obligatorio' : ''}`
      })),
    [checklists]
  );

  const matchedTemplate = useMemo(
    () =>
      matchTemplateForEquipment(
        templates,
        { id: equipment.id, type: equipment.type },
        techProfile
      ),
    [templates, equipment.id, equipment.type, techProfile]
  );

  const templateRequiresChecklist = matchedTemplate?.isChecklistMandatory === true;


  const [templateState, setTemplateState] = useState(() => ({
    values: {},
    attachments: [],
    valid: !matchedTemplate,
    missing: [],
    uploading: false
  }));

  const selectedChecklist = useMemo(() => {
    if (skipChecklist) return null;
    return checklists.find((item) => item.id === checklistId) || null;
  }, [checklists, checklistId, skipChecklist]);

  const canSkipChecklist = !templateRequiresChecklist && checklistSkipAllowed;


  useEffect(() => {
    if (!checklists.length) {
      setChecklistId('');
      setSkipChecklist(true);
      return;
    }
    const mandatory = checklists.find((item) => item.isMandatory);
    const defaultId = mandatory ? mandatory.id : checklists[0].id;
    setChecklistId(defaultId);

    const shouldForceChecklist = Boolean(mandatory || templateRequiresChecklist || !canSkipChecklist);
    if (shouldForceChecklist) {
      setSkipChecklist(false);
      return;
    }

    setSkipChecklist(false);
  }, [checklists, templateRequiresChecklist, canSkipChecklist]);

  useEffect(() => {
    if (!selectedChecklist) {
      setAnswers({});
      return;
    }
    const initialAnswers = buildInitialAnswers(selectedChecklist.nodes || []);
    setAnswers(initialAnswers);
    startRef.current = new Date();
  }, [selectedChecklist?.id]);

  useEffect(() => {
    setTemplateState({
      values: {},
      attachments: [],
      valid: !matchedTemplate,
      missing: [],
      uploading: false
    });
    setSkipChecklist(false);
  }, [matchedTemplate?.id]);

  useEffect(() => {
    if (skipChecklist) {
      setChecklistId('');
      return;
    }
    setChecklistId(checklists[0]?.id || '');
  }, [checklists, skipChecklist]);

  useEffect(() => {
    startRef.current = new Date();
    setHourmeter('');
    setOdometer('');
  }, [checklistId, equipment.id, skipChecklist, matchedTemplate?.id]);

  const updateAnswer = (key, value) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleMultiChange = (node, value) => {
    updateAnswer(node.key, value);
  };

  const renderNode = (node) => {
    if (!node) return null;
    if (node.inputType === 'section') {
      return (
        <div key={node.key} className="evaluation-section">
          <h3 className="evaluation-section__title">{node.title}</h3>
          {node.description ? (
            <p className="evaluation-section__description">{node.description}</p>
          ) : null}
          <div className="evaluation-section__content">
            {(node.children || []).map(renderNode)}
          </div>
        </div>
      );
    }

    const fieldValue = answers[node.key];
    const nodeOptions = DEFAULT_MULTI_OPTIONS(node.options);
    const nodeLabel = node.title || node.label;

    if (node.inputType === 'radio') {
      return (
        <div key={node.key} className="form-field">
          <label className="label">{nodeLabel}{node.required ? ' *' : ''}</label>
          <div className="input-stack">
            {nodeOptions.map((option) => (
              <label key={option.key} className="input-choice">
                <input
                  type="radio"
                  name={node.key}
                  value={option.key}
                  checked={fieldValue === option.key}
                  onChange={(event) => updateAnswer(node.key, event.target.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (node.inputType === 'checkbox') {
      const current = Array.isArray(fieldValue) ? fieldValue : [];
      return (
        <div key={node.key} className="form-field">
          <label className="label">{nodeLabel}{node.required ? ' *' : ''}</label>
          <div className="input-stack">
            {nodeOptions.map((option) => {
              const checked = current.includes(option.key);
              return (
                <label key={option.key} className="input-choice">
                  <input
                    type="checkbox"
                    value={option.key}
                    checked={checked}
                    onChange={(event) => {
                      const next = new Set(current);
                      if (event.target.checked) {
                        next.add(option.key);
                      } else {
                        next.delete(option.key);
                      }
                      handleMultiChange(node, Array.from(next));
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    if (node.inputType === 'select' && node.allowMultiple) {
      return (
        <div key={node.key} className="form-field">
          <label className="label" htmlFor={node.key}>
            {nodeLabel}{node.required ? ' *' : ''}
          </label>
          <select
            multiple
            id={node.key}
            className="input"
            value={Array.isArray(fieldValue) ? fieldValue : []}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              handleMultiChange(node, selected);
            }}
          >
            {nodeOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (node.inputType === 'select') {
      return (
        <div key={node.key} className="form-field">
          <label className="label" htmlFor={node.key}>
            {nodeLabel}{node.required ? ' *' : ''}
          </label>
          <select
            id={node.key}
            className="input"
            value={fieldValue ?? ''}
            onChange={(event) => updateAnswer(node.key, event.target.value)}
          >
            <option value="">Selecciona...</option>
            {nodeOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (node.inputType === 'textarea') {
      return (
        <div key={node.key} className="form-field">
          <label className="label" htmlFor={node.key}>
            {nodeLabel}{node.required ? ' *' : ''}
          </label>
          <textarea
            id={node.key}
            className="input"
            rows={3}
            value={fieldValue ?? ''}
            onChange={(event) => updateAnswer(node.key, event.target.value)}
          />
        </div>
      );
    }

    if (node.inputType === 'date') {
      return (
        <div key={node.key} className="form-field">
          <label className="label" htmlFor={node.key}>
            {nodeLabel}{node.required ? ' *' : ''}
          </label>
          <input
            id={node.key}
            type="date"
            className="input"
            value={fieldValue ?? ''}
            onChange={(event) => updateAnswer(node.key, event.target.value)}
          />
        </div>
      );
    }

    if (node.inputType === 'time') {
      return (
        <div key={node.key} className="form-field">
          <label className="label" htmlFor={node.key}>
            {nodeLabel}{node.required ? ' *' : ''}
          </label>
          <input
            id={node.key}
            type="time"
            className="input"
            value={fieldValue ?? ''}
            onChange={(event) => updateAnswer(node.key, event.target.value)}
          />
        </div>
      );
    }

    if (node.inputType === 'number') {
      return (
        <div key={node.key} className="form-field">
          <label className="label" htmlFor={node.key}>
            {nodeLabel}{node.required ? ' *' : ''}
          </label>
          <input
            id={node.key}
            type="number"
            className="input"
            value={fieldValue ?? ''}
             onChange={(event) => updateAnswer(node.key, event.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={node.key} className="form-field">
        <label className="label" htmlFor={node.key}>
          {nodeLabel}{node.required ? ' *' : ''}
        </label>
        <input
          id={node.key}
          className="input"
          value={fieldValue ?? ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        />
      </div>
    );
  };

  const validateRequired = () => {
    if (skipChecklist || !selectedChecklist) return null;
    const missing = [];
    const traverse = (nodes) => {
      nodes.forEach((node) => {
        if (!node) return;
        if (node.inputType !== 'section' && node.required) {
          const value = answers[node.key];
          const empty =
            value === undefined ||
            value === null ||
            (typeof value === 'string' && !value.trim()) ||
            (Array.isArray(value) && value.length === 0);
          if (empty) {
            missing.push(node.title || node.label || node.key);
          }
        }
        if (Array.isArray(node.children) && node.children.length) {
          traverse(node.children);
        }
      });
    };
    traverse(selectedChecklist.nodes || []);
    return missing;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');

    const checklistRequired = !skipChecklist;
    if (checklistRequired && (!checklistId || !selectedChecklist)) {
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

    if (templateState.uploading) {
      setError('Espera a que finalice la subida de los adjuntos.');
      setBusy(false);
      return;
    }

    if (matchedTemplate && !templateState.valid) {
      const missingFields = templateState.missing.slice(0, 3).join(', ');
      setError(
        `Completa los campos requeridos del formulario operativo${
          missingFields ? `: ${missingFields}${templateState.missing.length > 3 ? '...' : ''}` : ''
        }`
      );
      setBusy(false);
      return;
    }

    const hourValue = hourmeter.trim() !== '' ? Number(hourmeter) : null;
    const odoValue = odometer.trim() !== '' ? Number(odometer) : null;

    if (
      hourValue !== null &&
      (!Number.isFinite(hourValue) || hourValue < 0)
    ) {
      setError('Ingresa un valor válido para el horómetro.');
      setBusy(false);
      return;
    }

    if (
      odoValue !== null &&
      (!Number.isFinite(odoValue) || odoValue < 0)
    ) {
      setError('Ingresa un valor válido para el odómetro.');
      setBusy(false);
      return;
    }

    if (!matchedTemplate && hourValue === null && odoValue === null) {
      setError('Debes registrar al menos el horómetro u odómetro actual.');
      setBusy(false);
      return;
    }

    try {
      const responses = [];
      if (!skipChecklist && selectedChecklist) {
        collectResponses(selectedChecklist.nodes || [], answers, responses);
      }

      responses.push({ itemKey: 'estado_general', value: status, note: '' });
      responses.push({ itemKey: 'observaciones', value: observations, note: '' });

      if (hourValue !== null) {
        responses.push({ itemKey: 'horometro_actual', value: hourValue, note: '' });
      }
      if (odoValue !== null) {
        responses.push({ itemKey: 'odometro_actual', value: odoValue, note: '' });
      }

      if (variant === 'candelaria') {
        responses.push({ itemKey: 'turno', value: shift, note: '' });
        responses.push({ itemKey: 'supervisor', value: supervisor, note: '' });
      }

      const formData = {
        ...(!skipChecklist ? answers : {}),
        estado_general: status,
        observaciones,
        checklistId: skipChecklist ? null : checklistId,
        checklistNombre: skipChecklist ? '' : selectedChecklist?.name,
        variante: variant,
        equipo: equipment.code,
        horometro_actual: hourValue,
        odometro_actual: odoValue
      };

      if (variant === 'candelaria') {
        formData.turno = shift;
        formData.supervisor = supervisor;
      }

      if (matchedTemplate) {
        formData.templateId = matchedTemplate.id;
        formData.templateName = matchedTemplate.name;
        formData.templateValues = templateState.values;
      }

      const finishedAt = new Date();
      const startedAt = startRef.current;
      const durationSeconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));

      const payload = {
        checklistId: !skipChecklist ? checklistId : undefined,
        equipmentId: equipment.id,
        status,
        observations,
        responses,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationSeconds,
        formData,
        completedAt: finishedAt.toISOString(),
        checklistVersion: !skipChecklist ? (selectedChecklist?.version || 1) : 0,
        template: matchedTemplate
          ? {
              id: matchedTemplate.id,
              name: matchedTemplate.name,
              isChecklistMandatory: matchedTemplate.isChecklistMandatory,
              attachmentsEnabled: matchedTemplate.attachmentsEnabled,
              maxAttachments: matchedTemplate.maxAttachments,
              fields: matchedTemplate.fields,
              values: templateState.values,
              attachments: templateState.attachments
            }
          : undefined,
        skipChecklist
      };

      const result = await submitEvaluation(payload);
      if (result?.queued) {
        setInfo('Sin conexión: evaluación encolada y se enviará al reconectar.');
      } else {
        setInfo('Evaluación registrada correctamente.');
      }

      setObservations('');
      setStatus('ok');
      setHourmeter('');
      setOdometer('');
      if (variant === 'candelaria') {
        setSupervisor('');
        setShift('dia');
      }
      const initialAnswers = buildInitialAnswers(selectedChecklist?.nodes || []);
      setAnswers(initialAnswers);
      setTemplateState({
        values: {},
        attachments: [],
        valid: !matchedTemplate,
        missing: []
      });
      setSkipChecklist(false);
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
      {matchedTemplate ? (
        <TemplateForm
          template={matchedTemplate}
          onChange={setTemplateState}
        />
      ) : null}

      {canSkipChecklist ? (
        <div className="form-field form-field--full">
          <label className="label" htmlFor="skip-checklist">
            <input
              id="skip-checklist"
              type="checkbox"
              checked={skipChecklist}
              onChange={(event) => setSkipChecklist(event.target.checked)}
              style={{ marginRight: 8 }}
            />
            Omitir checklist en esta evaluación
          </label>
          <span className="input-hint">
            Puedes registrar solo el formulario operativo si no hay checklist obligatorio.
          </span>
        </div>
      ) : null}

      {!skipChecklist ? (
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
      ) : (
        <div className="form-field form-field--full" style={{ marginBottom: 0 }}>
          <div className="alert" style={{ background: 'rgba(59,130,246,0.08)', padding: 12, borderRadius: 8 }}>
            Checklist omitido. Solo se registrará el formulario operativo.
          </div>
        </div>
      )}

      {!skipChecklist && selectedChecklist?.nodes?.length ? (
        <div style={{ gridColumn: '1 / -1' }}>
          {selectedChecklist.nodes.map((node) => renderNode(node))}
        </div>
      ) : null}

      {!matchedTemplate ? (
        <>
          <div className="form-field">
            <label className="label" htmlFor="hourmeter">Horómetro / horas actuales</label>
            <input
              id="hourmeter"
              className="input"
              type="number"
              min="0"
              step="0.1"
              value={hourmeter}
              onChange={(event) => setHourmeter(event.target.value)}
              placeholder="Ej: 1234.5"
              required={odometer.trim() === ''}
            />
            <span className="input-hint">Ingresa las horas acumuladas. Si no aplica, completa el odómetro.</span>
          </div>

          <div className="form-field">
            <label className="label" htmlFor="odometer">Odómetro / kilometraje actual</label>
            <input
              id="odometer"
              className="input"
              type="number"
              min="0"
              step="1"
              value={odometer}
              onChange={(event) => setOdometer(event.target.value)}
              placeholder="Ej: 48000"
              required={hourmeter.trim() === ''}
            />
            <span className="input-hint">Si no registra kilometraje, completa el horómetro.</span>
          </div>
        </>
      ) : null}

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
              <option value="dia">Dia</option>
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
        <button className="btn primary" type="submit" disabled={busy || templateState.uploading}>
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

