'use client';

import { useEffect, useMemo, useState } from 'react';

const MAX_INLINE_ATTACHMENT_SIZE = 1024 * 1024 * 3; // 3MB

function buildInitialValues(fields = []) {
  const values = {};
  const traverse = (nodes) => {
    nodes.forEach((node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type && node.type !== 'section') {
        if (node.defaultValue != null) {
          values[node.key] = node.defaultValue;
        } else if (node.type === 'boolean') {
          values[node.key] = false;
        } else if (node.type === 'select') {
          values[node.key] = '';
        } else {
          values[node.key] = '';
        }
      }
      if (Array.isArray(node.children) && node.children.length) {
        traverse(node.children);
      }
    });
  };
  traverse(fields);
  return values;
}

function validateValues(fields = [], values = {}) {
  const missing = [];
  const traverse = (nodes, path = '') => {
    nodes.forEach((node) => {
      if (!node) return;
      const label = node.label || node.key;
      const location = path ? `${path} > ${label}` : label;
      if (node.type === 'section') {
        traverse(node.children || [], location);
        return;
      }
      if (node.required) {
        const value = values[node.key];
        const empty =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && !value.trim());
        if (empty) {
          missing.push(location);
        }
      }
    });
  };
  traverse(fields);
  return missing;
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TemplateForm({ template, onChange }) {
  const initialValues = useMemo(() => buildInitialValues(template?.fields || []), [template?.fields]);
  const [values, setValues] = useState(initialValues);
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [uploadingCount, setUploadingCount] = useState(0);
  const uploading = uploadingCount > 0;

  useEffect(() => {
    setValues(initialValues);
    setAttachments([]);
    setUploadingCount(0);
    setAttachmentError('');
  }, [initialValues]);

  useEffect(() => {
    const missing = validateValues(template?.fields || [], values);
    onChange({
      values,
      attachments,
      valid: missing.length === 0 && !uploading,
      missing,
      uploading
    });
  }, [values, attachments, template?.fields, uploading, onChange]);

  if (!template) return null;

  const updateValue = (key, value) => {
    setValues((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNumberInput = (key, raw) => {
    updateValue(key, raw);
  };

  const handleAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const max = template.maxAttachments || 3;
    let remaining = max - attachments.length;
    if (remaining <= 0) {
      setAttachmentError(`Ya alcanzaste el límite de ${max} archivos.`);
      event.target.value = '';
      return;
    }

    for (const file of files) {
      if (remaining <= 0) break;
      if (file.size > MAX_INLINE_ATTACHMENT_SIZE) {
        setAttachmentError(`El archivo ${file.name} supera el limite de 3MB.`);
        continue;
      }
      setUploadingCount((prev) => prev + 1);
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
          throw new Error('Respuesta inválida del servidor');
        }
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            url: payload.url
          }
        ]);
        remaining -= 1;
        setAttachmentError('');
      } catch (err) {
        console.error('No se pudo subir el archivo', err);
        setAttachmentError(`No se pudo subir ${file.name}`);
      } finally {
        setUploadingCount((prev) => Math.max(0, prev - 1));
      }
    }

    event.target.value = '';
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
    setAttachmentError('');
  };

  const renderNode = (node) => {
    if (!node) return null;
    if (node.type === 'section') {
      return (
        <div key={node.key} className="template-section">
          <h3 className="template-section__title">{node.label}</h3>
          {node.helpText ? <p className="template-section__help">{node.helpText}</p> : null}
          <div className="template-section__body">
            {(node.children || []).map(renderNode)}
          </div>
        </div>
      );
    }

    const fieldValue = values[node.key] ?? '';
    const commonProps = {
      id: node.key,
      value: fieldValue,
      onChange: (event) => updateValue(node.key, event.target.value),
      required: node.required,
      className: 'input'
    };

    return (
      <div key={node.key} className="template-input">
        <label className="label" htmlFor={node.key}>
          {node.label}
          {node.unit ? ` (${node.unit})` : ''}
          {node.required ? '*' : ''}
        </label>
        {node.type === 'text' ? (
          <input {...commonProps} />
        ) : node.type === 'number' ? (
          <input
            {...commonProps}
            type="number"
            onChange={(event) => handleNumberInput(node.key, event.target.value)}
          />
        ) : node.type === 'textarea' ? (
          <textarea {...commonProps} rows={3} />
        ) : node.type === 'select' ? (
          <select
            className="input"
            value={fieldValue}
            onChange={(event) => updateValue(node.key, event.target.value)}
            required={node.required}
          >
            <option value="">Selecciona...</option>
            {(node.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : node.type === 'date' ? (
          <input {...commonProps} type="date" />
        ) : node.type === 'time' ? (
          <input {...commonProps} type="time" />
        ) : node.type === 'boolean' ? (
          <label className="template-checkbox">
            <input
              type="checkbox"
              checked={Boolean(fieldValue)}
              onChange={(event) => updateValue(node.key, event.target.checked)}
            />
            {node.helpText || 'Selecciona si aplica'}
          </label>
        ) : node.type === 'file' ? (
          <div className="template-file">
            <input
              type="file"
              accept="image/*"
              onChange={handleAttachmentChange}
              multiple
              disabled={uploading || attachments.length >= (template.maxAttachments || 3)}
            />
            {uploading ? (
              <span className="input-hint">Subiendo archivos...</span>
            ) : null}
          </div>
        ) : (
          <input {...commonProps} />
        )}
        {node.helpText && node.type !== 'boolean' ? (
          <span className="input-hint">{node.helpText}</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="template-form">
      <h2 className="template-form__title">{template.name}</h2>
      {template.description ? (
        <p className="label" style={{ marginBottom: 16 }}>{template.description}</p>
      ) : null}
      <div className="template-form__grid">
        {(template.fields || []).map(renderNode)}
      </div>
      {template.attachmentsEnabled ? (
        <div className="template-attachments">
          <p className="label">
            Adjuntos (max. {template.maxAttachments || 3} archivos de hasta 3MB c/u)
          </p>
          {attachmentError ? (
            <div style={{ color: 'var(--danger)' }}>{attachmentError}</div>
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={handleAttachmentChange}
            multiple
            disabled={uploading || attachments.length >= (template.maxAttachments || 3)}
          />
          {uploading ? (
            <div className="label" style={{ color: 'var(--muted)' }}>
              Subiendo adjuntos...
            </div>
          ) : null}
          {attachments.length ? (
            <ul className="template-attachments__list">
              {attachments.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  {file.url || file.dataUrl ? (
                    <a href={file.url || file.dataUrl} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                  ) : (
                    file.name
                  )}{' '}
                  ({Math.round(file.size / 1024)} KB)
                  <button className="btn" type="button" onClick={() => handleRemoveAttachment(index)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
