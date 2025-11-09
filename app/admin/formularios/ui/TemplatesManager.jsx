'use client';

import { useCallback, useMemo, useState } from 'react';
import BackButton from '../../../ui/BackButton';
import SlidingPanel from '../../../ui/SlidingPanel';
import { TEMPLATE_METRIC_OPTIONS } from '@/lib/templateMetrics';
import { getOperatorProfileLabel } from '@/lib/operatorProfiles';

const DEFAULT_TEMPLATE = {
  id: '',
  name: '',
  description: '',
  techProfile: 'todos',
  equipmentTypes: [],
  equipmentIds: [],
  isChecklistMandatory: true,
  attachmentsEnabled: true,
  maxAttachments: 3,
  fields: [],
  isActive: true
};

const FIELD_TYPES = [
  { value: 'section', label: 'Seccion' },
  { value: 'number', label: 'Numero' },
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Area de texto' },
  { value: 'select', label: 'Seleccion' },
  { value: 'date', label: 'Fecha' },
  { value: 'time', label: 'Hora' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'file', label: 'Archivo/Imagen' }
];

function createField(type = 'text') {
  return {
    key: `campo_${Math.random().toString(36).slice(2, 8)}`,
    label: 'Nuevo campo',
    type,
    required: false,
    helpText: '',
    unit: '',
    options: type === 'select'
      ? [
          { value: 'opcion_1', label: 'Opcion 1' },
          { value: 'opcion_2', label: 'Opcion 2' }
        ]
      : undefined,
    children: type === 'section' ? [] : undefined,
    metadata: {}
  };
}

function FieldNode({ node, onChange, onRemove, level = 0 }) {
  const update = (patch) => {
    onChange({ ...node, ...patch });
  };

  const handleTypeChange = (event) => {
    const nextType = event.target.value;
    const base = {
      ...node,
      type: nextType,
      metadata: { ...(node.metadata || {}) }
    };
    if (nextType === 'section') {
      base.children = node.children || [];
      delete base.unit;
      delete base.options;
    } else {
      delete base.children;
      if (nextType === 'select') {
        base.options = node.options || [
          { value: 'opcion_1', label: 'Opcion 1' },
          { value: 'opcion_2', label: 'Opcion 2' }
        ];
      } else {
        delete base.options;
      }
    }
    if (nextType !== 'number' && base.metadata) {
      delete base.metadata.metricKey;
    }
    onChange(base);
  };

  const updateOption = (index, patch) => {
    const next = [...(node.options || [])];
    next[index] = { ...next[index], ...patch };
    update({ options: next });
  };

  const addOption = () => {
    const next = [...(node.options || [])];
    next.push({ value: `opcion_${next.length + 1}`, label: `Opcion ${next.length + 1}` });
    update({ options: next });
  };

  const removeOption = (index) => {
    const next = [...(node.options || [])];
    next.splice(index, 1);
    update({ options: next });
  };

  const addChild = () => {
    const next = [...(node.children || [])];
    next.push(createField('text'));
    update({ children: next });
  };

  const updateChild = (index, value) => {
    const next = [...(node.children || [])];
    next[index] = value;
    update({ children: next });
  };

  const removeChild = (index) => {
    const next = [...(node.children || [])];
    next.splice(index, 1);
    update({ children: next });
  };

  return (
    <div className="template-field" style={{ marginLeft: level * 16 }}>
      <div className="template-field__head">
        <input
          className="input"
          value={node.label}
          onChange={(event) => update({ label: event.target.value })}
          placeholder="Etiqueta"
        />
        <select className="input" value={node.type} onChange={handleTypeChange}>
          {FIELD_TYPES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <label className="template-field__checkbox">
          <input
            type="checkbox"
            checked={node.required}
            onChange={(event) => update({ required: event.target.checked })}
          />
          Obligatorio
        </label>
        <button className="btn" type="button" onClick={onRemove}>Eliminar</button>
      </div>
      {node.type !== 'section' ? (
        <div className="template-field__body">
          <input
            className="input"
            value={node.key}
            onChange={(event) => update({ key: event.target.value })}
            placeholder="Clave interna"
          />
          <input
            className="input"
            value={node.helpText || ''}
            onChange={(event) => update({ helpText: event.target.value })}
            placeholder="Texto de ayuda"
          />
          {['number', 'text'].includes(node.type) ? (
          <input
            className="input"
            value={node.unit || ''}
            onChange={(event) => update({ unit: event.target.value })}
            placeholder="Unidad (ej: km, litros)"
          />
        ) : null}
        {node.type === 'number' ? (
          <div className="template-field__metric">
            <label className="label" htmlFor={`${node.key}-metric`}>Metrica asociada</label>
            <select
              id={`${node.key}-metric`}
              className="input"
              value={node.metadata?.metricKey || ''}
              onChange={(event) => {
                const metricKey = event.target.value;
                if (!metricKey) {
                  const nextMetadata = { ...(node.metadata || {}) };
                  delete nextMetadata.metricKey;
                  update({ metadata: nextMetadata });
                } else {
                  update({ metadata: { ...(node.metadata || {}), metricKey } });
                }
              }}
            >
              {TEMPLATE_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ) : null}
          {node.type === 'select' ? (
            <div className="template-field__options">
              <p className="label">Opciones</p>
              {(node.options || []).map((option, index) => (
                <div key={option.value} className="template-field__option">
                  <input
                    className="input"
                    value={option.label}
                    onChange={(event) => updateOption(index, { label: event.target.value })}
                    placeholder="Etiqueta"
                  />
                  <input
                    className="input"
                    value={option.value}
                    onChange={(event) => updateOption(index, { value: event.target.value })}
                    placeholder="Valor"
                  />
                  <button className="btn" type="button" onClick={() => removeOption(index)}>
                    Quitar
                  </button>
                </div>
              ))}
              <button className="btn" type="button" onClick={addOption}>
                Agregar opcion
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="template-field__children">
          <div className="template-field__children-header">
            <span className="label">Campos de la seccion</span>
            <button className="btn" type="button" onClick={addChild}>Agregar campo</button>
          </div>
          {(node.children || []).length === 0 ? (
            <div className="label">Aun no hay campos dentro de esta seccion.</div>
          ) : (
            node.children.map((child, index) => (
              <FieldNode
                key={child.key}
                node={child}
                onChange={(value) => updateChild(index, value)}
                onRemove={() => removeChild(index)}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FieldsBuilder({ value, onChange }) {
  const addField = (type = 'text') => {
    onChange([...(value || []), createField(type)]);
  };

  const updateField = (index, field) => {
    const next = [...(value || [])];
    next[index] = field;
    onChange(next);
  };

  const removeField = (index) => {
    const next = [...(value || [])];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="template-fields">
      <div className="template-fields__header">
        <span className="label">Campos del formulario</span>
        <div className="template-fields__actions">
          <button className="btn" type="button" onClick={() => addField('section')}>
            Seccion
          </button>
          <button className="btn primary" type="button" onClick={() => addField('text')}>
            Campo
          </button>
        </div>
      </div>
      {(value || []).length === 0 ? (
        <div className="label" style={{ marginTop: 8 }}>
          Aun no hay campos definidos. Agrega una seccion o un campo individual.
        </div>
      ) : (
        value.map((field, index) => (
          <FieldNode
            key={field.key || index}
            node={field}
            onChange={(next) => updateField(index, next)}
            onRemove={() => removeField(index)}
          />
        ))
      )}
    </div>
  );
}

export default function TemplatesManager({ initialTemplates, canManageAll }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(DEFAULT_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const isEditing = Boolean(editingId);

  const resetForm = useCallback(() => {
    setForm(DEFAULT_TEMPLATE);
    setEditingId('');
    setError('');
    setSuccess('');
  }, []);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    setError('');
    setSuccess('');
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    resetForm();
  }, [resetForm]);

  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/evaluation-templates', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleCreate = () => {
    resetForm();
    openPanel();
  };

  const handleEdit = (template) => {
    setEditingId(template.id);
    setForm({
      ...DEFAULT_TEMPLATE,
      ...template,
      equipmentTypes: template.equipmentTypes || [],
      equipmentIds: template.equipmentIds || [],
      fields: template.fields || []
    });
    openPanel();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: form.name,
      description: form.description,
      techProfile: form.techProfile,
      equipmentTypes: form.equipmentTypes,
      equipmentIds: form.equipmentIds,
      isChecklistMandatory: form.isChecklistMandatory,
      attachmentsEnabled: form.attachmentsEnabled,
      maxAttachments: form.maxAttachments,
      fields: form.fields,
      isActive: form.isActive
    };

    try {
      const res = await fetch(isEditing ? `/api/evaluation-templates/${editingId}` : '/api/evaluation-templates', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates((prev) =>
        isEditing ? prev.map((item) => (item.id === data.id ? data : item)) : [data, ...prev]
      );
      setSuccess(isEditing ? 'Plantilla actualizada' : 'Plantilla creada');
      setPanelOpen(false);
      resetForm();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template) => {
    try {
      const res = await fetch(`/api/evaluation-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !template.isActive })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates((prev) => prev.map((item) => (item.id === data.id ? data : item)));
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado');
    }
  };

  const handleFieldChange = (fields) => {
    setForm((prev) => ({ ...prev, fields }));
  };

  const templateCards = useMemo(() => {
    return templates.map((template) => (
      <div key={template.id} className="card template-card">
        <div className="template-card__header">
          <div>
            <h3 className="template-card__title">{template.name}</h3>
            <p className="label">{template.description || 'Sin descripcion'}</p>
          </div>
          <span className={`badge ${template.isActive ? '' : 'badge--warning'}`}>
            {template.isActive ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <div className="template-card__meta">
          <p className="label">
            Perfil: {template.techProfile === 'todos' ? 'Todos los operadores' : getOperatorProfileLabel(template.techProfile)}
          </p>
          <p className="label">
            Checklist {template.isChecklistMandatory ? 'obligatorio' : 'opcional'}
          </p>
          <p className="label">
            Campos: {template.fields?.length || 0}
          </p>
        </div>
        <div className="template-card__actions">
          <button className="btn" type="button" onClick={() => handleEdit(template)}>
            Editar
          </button>
          <button className="btn" type="button" onClick={() => handleToggleActive(template)}>
            {template.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    ));
  }, [templates]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel de administracion</p>
            <h1 className="page-header__title">Formularios operativos</h1>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn" type="button" onClick={refetch} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn primary" type="button" onClick={handleCreate}>
            Nueva plantilla
          </button>
        </div>
      </div>
      <p className="page-header__subtitle">
        Configura los formularios que los operadores deben completar antes o después de cada checklist.
      </p>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}
      {success ? <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{success}</div> : null}

      <div className="template-grid">
        {templateCards.length ? templateCards : (
          <div className="label">No hay plantillas creadas todavia.</div>
        )}
      </div>

      <SlidingPanel
        open={panelOpen}
        title={isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
        onClose={closePanel}
        footer={(
          <>
            <button className="btn" type="button" onClick={closePanel} disabled={saving}>Cancelar</button>
            <button className="btn primary" type="submit" form="template-form" disabled={saving}>
              {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
            </button>
          </>
        )}
      >
        <form id="template-form" className="form-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="label" htmlFor="template-name">Nombre</label>
            <input
              id="template-name"
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="template-description">Descripcion</label>
            <textarea
              id="template-description"
              className="input"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="template-profile">Perfil del operador</label>
            <select
              id="template-profile"
              className="input"
              value={form.techProfile}
              onChange={(event) => setForm((prev) => ({ ...prev, techProfile: event.target.value }))}
            >
              <option value="todos">Todos</option>
              <option value="externo">{getOperatorProfileLabel('externo')}</option>
              <option value="candelaria">{getOperatorProfileLabel('candelaria')}</option>
            </select>
          </div>
          <div className="form-field">
            <label className="label" htmlFor="template-equipment-types">Tipos de equipo (separados por coma)</label>
            <input
              id="template-equipment-types"
              className="input"
              value={form.equipmentTypes.join(', ')}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  equipmentTypes: event.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                }))
              }
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="template-checklist">Checklist obligatorio</label>
            <select
              id="template-checklist"
              className="input"
              value={form.isChecklistMandatory ? 'yes' : 'no'}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isChecklistMandatory: event.target.value === 'yes' }))
              }
            >
              <option value="yes">Si, siempre</option>
              <option value="no">Opcional</option>
            </select>
          </div>
          <div className="form-field">
            <label className="label" htmlFor="template-attachments">Adjuntos permitidos</label>
            <select
              id="template-attachments"
              className="input"
              value={form.attachmentsEnabled ? 'yes' : 'no'}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, attachmentsEnabled: event.target.value === 'yes' }))
              }
            >
              <option value="yes">Si</option>
              <option value="no">No</option>
            </select>
          </div>
          {form.attachmentsEnabled ? (
            <div className="form-field">
              <label className="label" htmlFor="template-max-attachments">Cantidad maxima de archivos</label>
              <input
                id="template-max-attachments"
                className="input"
                type="number"
                min="1"
                max="10"
                value={form.maxAttachments}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, maxAttachments: Number(event.target.value) || 1 }))
                }
              />
            </div>
          ) : null}

          <div className="form-field form-field--full">
            <FieldsBuilder value={form.fields} onChange={handleFieldChange} />
          </div>
        </form>
      </SlidingPanel>

      <div className="back-button-row">
        <BackButton fallback="/" />
      </div>
    </div>
  );
}
