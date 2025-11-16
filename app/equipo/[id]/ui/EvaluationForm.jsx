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
          // Checkbox: lista de opciones seleccionadas
          answers[item.key] = [];
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

const MAX_EVIDENCE_FILE_SIZE = 1024 * 1024 * 3;
const MAX_EVIDENCE_FILES = 3;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  const [fuelAdded, setFuelAdded] = useState('');
  const [energyAdded, setEnergyAdded] = useState('');
  const [adblueAdded, setAdblueAdded] = useState('');
  const [fuelEnabled, setFuelEnabled] = useState(false);
  const [energyEnabled, setEnergyEnabled] = useState(false);
  const [adblueEnabled, setAdblueEnabled] = useState(false);
  const [shift, setShift] = useState('dia');
  const [supervisor, setSupervisor] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [skipChecklist, setSkipChecklist] = useState(false);
  const [evidencePhotos, setEvidencePhotos] = useState([]);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceUploadingCount, setEvidenceUploadingCount] = useState(0);
  const evidenceUploading = evidenceUploadingCount > 0;

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

    const shouldForceChecklist = Boolean(
      mandatory || templateRequiresChecklist || !canSkipChecklist
    );
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
    setFuelAdded('');
    setEnergyAdded('');
    setAdblueAdded('');
    setFuelEnabled(false);
    setEnergyEnabled(false);
    setAdblueEnabled(false);
  }, [checklistId, equipment.id, skipChecklist, matchedTemplate?.id]);

  useEffect(() => {
    setEvidencePhotos([]);
    setEvidenceError('');
    setEvidenceUploadingCount(0);
  }, [equipment.id]);

  const updateAnswer = (key, value) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleMultiChange = (node, value) => {
    updateAnswer(node.key, value);
  };

  const toggleFuel = (enabled) => {
    setFuelEnabled(enabled);
    if (!enabled) setFuelAdded('');
  };

  const toggleEnergy = (enabled) => {
    setEnergyEnabled(enabled);
    if (!enabled) setEnergyAdded('');
  };

  const toggleAdblue = (enabled) => {
    setAdblueEnabled(enabled);
    if (!enabled) setAdblueAdded('');
  };

  const handleEvidenceUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    let remaining = MAX_EVIDENCE_FILES - evidencePhotos.length;
    if (remaining <= 0) {
      setEvidenceError(`Puedes adjuntar hasta ${MAX_EVIDENCE_FILES} fotos.`);
      event.target.value = '';
      return;
    }

    for (const file of files) {
      if (remaining <= 0) break;
      if (file.size > MAX_EVIDENCE_FILE_SIZE) {
        setEvidenceError(`El archivo ${file.name} supera los 3MB permitidos.`);
        continue;
      }
      setEvidenceUploadingCount((prev) => prev + 1);
      try {
        const dataUrl = await readFileAsDataURL(file);
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: dataUrl })
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        if (!payload?.url) {
          throw new Error('Respuesta invalida del servidor');
        }
        setEvidencePhotos((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || 'image/jpeg',
            url: payload.url
          }
        ]);
        remaining -= 1;
        setEvidenceError('');
      } catch (err) {
        console.error('No se pudo subir la foto', err);
        setEvidenceError(err.message || `No se pudo subir ${file.name}`);
      } finally {
        setEvidenceUploadingCount((prev) => Math.max(0, prev - 1));
      }
    }

    event.target.value = '';
  };

  const handleEvidenceRemove = (index) => {
    setEvidencePhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const renderNode = (node, depth = 0) => {
    if (!node) return null;
    const childNodes = Array.isArray(node.children) ? node.children : [];

    if (node.inputType === 'section') {
      return (
        <div
          key={node.key}
          className="evaluation-section"
          style={{
            marginTop: depth > 0 ? 16 : 0,
            marginLeft: depth > 0 ? `${depth * 15}px` : 0
          }}
        >
          <h3 className="evaluation-section__title">{node.title}</h3>
          {node.description ? (
            <p className="evaluation-section__description">{node.description}</p>
          ) : null}
          <div className="evaluation-section__content">
            {childNodes.length ? (
              childNodes.map((child) => renderNode(child, depth + 1))
            ) : (
              <p className="label" style={{ color: 'var(--muted)' }}>
                Sin items configurados.
              </p>
            )}
          </div>
        </div>
      );
    }

    const fieldValue = answers[node.key];
    const nodeOptions = DEFAULT_MULTI_OPTIONS(node.options);

    // Prefijo e indentación visual por nivel
    const prefix = depth > 0 ? `${'-'.repeat(depth)} ` : '';
    const nodeLabel = `${prefix}${node.title || node.label}`;
    const inputId = `node-${node.key}`;

    // Indentación base del item
    const itemIndentStyle = depth > 0 ? { marginLeft: `${depth * 20}px` } : {};

    const hasChildren = childNodes.length > 0;
    // Cuando es checkbox con hijos, usamos un layout vertical en vez de la grilla por columnas
    const isCheckboxTree = node.inputType === 'checkbox' && hasChildren;

    const wrapperStyle = {
      ...itemIndentStyle,
      ...(isCheckboxTree
        ? {
            display: 'block',
            paddingLeft: depth > 0 ? depth * 10 : 0
          }
        : {})
    };

    let control = null;

    if (node.inputType === 'radio') {
      control = (
        <div className="checklist-options">
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
      );
    } else if (node.inputType === 'checkbox') {
      const current = Array.isArray(fieldValue) ? fieldValue : [];
      control = (
        <div className="checklist-options">
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
      );
    } else if (node.inputType === 'select' && node.allowMultiple) {
      control = (
        <select
          multiple
          id={inputId}
          className="input"
          value={Array.isArray(fieldValue) ? fieldValue : []}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map(
              (option) => option.value
            );
            handleMultiChange(node, selected);
          }}
        >
          {nodeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      );
    } else if (node.inputType === 'select') {
      control = (
        <select
          id={inputId}
          className="input"
          value={fieldValue ?? ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        >
          <option value="">Selecciona...</option>
          {nodeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      );
    } else if (node.inputType === 'textarea') {
      control = (
        <textarea
          id={inputId}
          className="input"
          rows={3}
          value={fieldValue ?? ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        />
      );
    } else if (node.inputType === 'date' || node.inputType === 'time') {
      control = (
        <input
          id={inputId}
          type={node.inputType}
          className="input"
          value={fieldValue ?? ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        />
      );
    } else if (node.inputType === 'number') {
      control = (
        <input
          id={inputId}
          type="number"
          className="input"
          value={fieldValue ?? ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        />
      );
    } else {
      control = (
        <input
          id={inputId}
          className="input"
          value={fieldValue ?? ''}
          onChange={(event) => updateAnswer(node.key, event.target.value)}
        />
      );
    }

    const promptContent =
      node.inputType === 'select' ||
      node.inputType === 'textarea' ||
      node.inputType === 'text' ||
      node.inputType === 'date' ||
      node.inputType === 'time' ||
      node.inputType === 'number'
        ? (
            <label className="label" htmlFor={inputId}>
              {nodeLabel}
              {node.required ? ' *' : ''}
            </label>
          )
        : (
            <span className="label">
              {nodeLabel}
              {node.required ? ' *' : ''}
            </span>
          );

    return (
      <div key={node.key} className="checklist-item" style={wrapperStyle}>
        <div className="checklist-item__prompt">
          {promptContent}
          {node.description ? (
            <p className="checklist-item__description">
              {node.description}
            </p>
          ) : null}
        </div>
        <div className="checklist-item__controls">{control}</div>
        {hasChildren ? (
          <div
            className="checklist-item__children"
            style={
              isCheckboxTree
                ? { marginTop: 8, paddingLeft: 20 }
                : { gridColumn: '1 / -1', paddingLeft: '10px' }
            }
          >
            {childNodes.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
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
      setError(
        `Completa los campos obligatorios: ${missing
          .slice(0, 3)
          .join(', ')}${missing.length > 3 ? '...' : ''}`
      );
      setBusy(false);
      return;
    }

    if (templateState.uploading) {
      setError('Espera a que finalice la subida de los adjuntos.');
      setBusy(false);
      return;
    }

    if (evidenceUploading) {
      setError('Espera a que termine la subida de la foto de respaldo.');
      setBusy(false);
      return;
    }

    if (matchedTemplate && !templateState.valid) {
      const missingFields = templateState.missing.slice(0, 3).join(', ');
      setError(
        `Completa los campos requeridos del formulario operativo${
          missingFields
            ? `: ${missingFields}${
                templateState.missing.length > 3 ? '...' : ''
              }`
            : ''
        }`
      );
      setBusy(false);
      return;
    }

    const hourValue = hourmeter.trim() !== '' ? Number(hourmeter) : null;
    const odoValue = odometer.trim() !== '' ? Number(odometer) : null;

    if (hourValue !== null && (!Number.isFinite(hourValue) || hourValue < 0)) {
      setError('Ingresa un valor válido para el horómetro.');
      setBusy(false);
      return;
    }

    if (odoValue !== null && (!Number.isFinite(odoValue) || odoValue < 0)) {
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
      responses.push({
        itemKey: 'observaciones',
        value: observations,
        note: ''
      });

      if (hourValue !== null) {
        responses.push({
          itemKey: 'horometro_actual',
          value: hourValue,
          note: ''
        });
      }
      if (odoValue !== null) {
        responses.push({
          itemKey: 'odometro_actual',
          value: odoValue,
          note: ''
        });
      }

      if (variant === 'candelaria') {
        responses.push({ itemKey: 'turno', value: shift, note: '' });
        responses.push({ itemKey: 'supervisor', value: supervisor, note: '' });
      }

      const fuelValue =
        fuelEnabled && fuelAdded.trim() !== '' ? Number(fuelAdded) : null;
      const energyValue =
        energyEnabled && energyAdded.trim() !== '' ? Number(energyAdded) : null;
      const adblueValue =
        adblueEnabled && adblueAdded.trim() !== '' ? Number(adblueAdded) : null;

      if (fuelValue !== null && Number.isFinite(fuelValue)) {
        responses.push({ itemKey: 'combustible_cargado', value: fuelValue, note: '' });
      }
      if (energyValue !== null && Number.isFinite(energyValue)) {
        responses.push({ itemKey: 'energia_cargada', value: energyValue, note: '' });
      }
      if (adblueValue !== null && Number.isFinite(adblueValue)) {
        responses.push({ itemKey: 'adblue_cargado', value: adblueValue, note: '' });
      }

      const formData = {
        ...(!skipChecklist ? answers : {}),
        estado_general: status,
        observaciones: observations,
        checklistId: skipChecklist ? null : checklistId,
        checklistNombre: skipChecklist ? '' : selectedChecklist?.name,
        variante: variant,
        equipo: equipment.code,
        horometro_actual: hourValue,
        odometro_actual: odoValue,
        combustible_cargado: fuelValue,
        energia_cargada: energyValue,
        adblue_cargado: adblueValue
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
      const durationSeconds = Math.max(
        0,
        Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)
      );

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
        checklistVersion: !skipChecklist ? selectedChecklist?.version || 1 : 0,
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
        evidencePhotos: evidencePhotos.length ? evidencePhotos : undefined,
        skipChecklist
      };

      const result = await submitEvaluation(payload);
      if (result?.queued) {
        setInfo(
          'Sin conexión: evaluación encolada y se enviará al reconectar.'
        );
      } else {
        setInfo('Evaluación registrada correctamente.');
      }

      setObservations('');
      setStatus('ok');
      setHourmeter('');
      setOdometer('');
      setFuelAdded('');
      setEnergyAdded('');
      setAdblueAdded('');
      setFuelEnabled(false);
      setEnergyEnabled(false);
      setAdblueEnabled(false);
      if (variant === 'candelaria') {
        setSupervisor('');
        setShift('dia');
      }
      const initialAnswers = buildInitialAnswers(
        selectedChecklist?.nodes || []
      );
      setAnswers(initialAnswers);
      setTemplateState({
        values: {},
        attachments: [],
        valid: !matchedTemplate,
        missing: [],
        uploading: false
      });
      setSkipChecklist(false);
      setEvidencePhotos([]);
      setEvidenceError('');
      setEvidenceUploadingCount(0);
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
        <TemplateForm template={matchedTemplate} onChange={setTemplateState} />
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
            Puedes registrar solo el formulario operativo si no hay checklist
            obligatorio.
          </span>
        </div>
      ) : null}

      {!skipChecklist ? (
        <div className="form-field">
          <label className="label" htmlFor="checklist">
            Checklist
          </label>
          <select
            id="checklist"
            className="input"
            value={checklistId}
            onChange={(event) => setChecklistId(event.target.value)}
            required
          >
            <option value="">Selecciona...</option>
            {checklistOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="form-field form-field--full" style={{ marginBottom: 0 }}>
          <div
            className="alert"
            style={{
              background: 'rgba(59,130,246,0.08)',
              padding: 12,
              borderRadius: 8
            }}
          >
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
            <label className="label" htmlFor="hourmeter">
              Horómetro / horas actuales
            </label>
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
            <span className="input-hint">
              Ingresa las horas acumuladas. Si no aplica, completa el odómetro.
            </span>
          </div>

          <div className="form-field">
            <label className="label" htmlFor="odometer">
              Odómetro / kilometraje actual
            </label>
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
            <span className="input-hint">
              Si no registra kilometraje, completa el horómetro.
            </span>
          </div>

          <div className="form-field form-field--full">
            <label className="label" style={{ marginBottom: 4 }}>Consumos registrados (opcional)</label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" htmlFor="fuel-added">Combustible (L)</label>
                  <label className="input-choice" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={fuelEnabled}
                      onChange={(event) => toggleFuel(event.target.checked)}
                    />
                    ¿Registrar?
                  </label>
                </div>
                <input
                  id="fuel-added"
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={fuelAdded}
                  onChange={(event) => setFuelAdded(event.target.value)}
                  placeholder="Litros cargados"
                  disabled={!fuelEnabled}
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" htmlFor="energy-added">Energía (kWh)</label>
                  <label className="input-choice" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={energyEnabled}
                      onChange={(event) => toggleEnergy(event.target.checked)}
                    />
                    ¿Registrar?
                  </label>
                </div>
                <input
                  id="energy-added"
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={energyAdded}
                  onChange={(event) => setEnergyAdded(event.target.value)}
                  placeholder="kWh cargados"
                  disabled={!energyEnabled}
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" htmlFor="adblue-added">AdBlue (L)</label>
                  <label className="input-choice" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={adblueEnabled}
                      onChange={(event) => toggleAdblue(event.target.checked)}
                    />
                    ¿Registrar?
                  </label>
                </div>
                <input
                  id="adblue-added"
                  className="input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={adblueAdded}
                  onChange={(event) => setAdblueAdded(event.target.value)}
                  placeholder="Litros AdBlue"
                  disabled={!adblueEnabled}
                />
              </div>
            </div>
            <span className="input-hint">
              Marca “¿Registrar?” para los consumos que apliquen al equipo.
            </span>
          </div>
        </>
      ) : null}

      <div className="form-field">
        <label className="label" htmlFor="status">
          Estado general
        </label>
        <select
          id="status"
          className="input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {variant === 'candelaria' ? (
        <>
          <div className="form-field">
            <label className="label" htmlFor="shift">
              Turno
            </label>
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
            <label className="label" htmlFor="supervisor">
              Supervisor
            </label>
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
        <label className="label" htmlFor="observations">
          Observaciones adicionales
        </label>
        <textarea
          id="observations"
          className="input"
          rows={4}
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          placeholder="Notas o incidencias relevantes"
        />
      </div>

      <div className="form-field" style={{ gridColumn: '1 / -1' }}>
        <label className="label" htmlFor="evidence-photo">
          Foto de respaldo (opcional)
        </label>
        <input
          id="evidence-photo"
          type="file"
          accept="image/*"
          onChange={handleEvidenceUpload}
          disabled={evidenceUploading || evidencePhotos.length >= MAX_EVIDENCE_FILES}
        />
        <span className="input-hint">
          Puedes adjuntar hasta {MAX_EVIDENCE_FILES} fotos para documentar la
          condición del equipo.
        </span>
        {evidenceError ? (
          <div style={{ color: 'var(--danger)' }}>{evidenceError}</div>
        ) : null}
        {evidenceUploading ? (
          <div className="label" style={{ color: 'var(--muted)' }}>
            Subiendo foto...
          </div>
        ) : null}
        {evidencePhotos.length ? (
          <div className="evidence-thumbs">
            {evidencePhotos.map((photo, index) => {
              const src = photo.url || photo.dataUrl;
              if (!src) return null;
              return (
                <div
                  key={`${photo.name}-${index}`}
                  className="evidence-thumb"
                >
                  <button
                    type="button"
                    className="evidence-thumb__button"
                    onClick={() =>
                      window.open(src, '_blank', 'noopener')
                    }
                  >
                    <img
                      src={src}
                      alt={photo.name}
                      className="evidence-thumb__image"
                    />
                  </button>
                  <button
                    type="button"
                    className="evidence-thumb__remove"
                    onClick={() => handleEvidenceRemove(index)}
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ color: 'var(--danger)' }}>{error}</div>
      ) : null}
      {info ? <div style={{ color: 'var(--accent)' }}>{info}</div> : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          className="btn primary"
          type="submit"
          disabled={busy || templateState.uploading}
        >
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
