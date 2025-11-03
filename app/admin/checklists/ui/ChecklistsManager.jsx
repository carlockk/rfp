'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import SlidingPanel from '@/app/ui/SlidingPanel';
import ChecklistBuilder from './ChecklistBuilder';

const DEFAULT_OPTIONS = [
  { key: 'cumple', label: 'Cumple' },
  { key: 'no-cumple', label: 'No cumple' },
  { key: 'no-aplica', label: 'No aplica' }
];

const newId = (prefix = 'node') =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(16).slice(2)}`);

const createDefaultNodes = () => [
  {
    key: newId('section'),
    title: 'Sección 1',
    description: '',
    inputType: 'section',
    required: false,
    allowMultiple: false,
    options: undefined,
    children: [
      {
        key: newId('item'),
        title: 'Pregunta 1',
        description: '',
        inputType: 'select',
        required: true,
        allowMultiple: false,
        options: DEFAULT_OPTIONS,
        children: []
      }
    ]
  }
];

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function ChecklistsManager({ initialChecklists, canCreate }) {
  const [checklists, setChecklists] = useState(initialChecklists);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    equipmentType: '',
    tagsText: '',
    nodes: createDefaultNodes(),
    notes: '',
    versionTitle: '',
    versionSummary: ''
  });

  const resetForm = useCallback(() => {
    setForm({
      name: '',
      description: '',
      equipmentType: '',
      tagsText: '',
      nodes: createDefaultNodes(),
      notes: '',
      versionTitle: '',
      versionSummary: ''
    });
    setVersionHistory([]);
    setError('');
    setMessage('');
    setEditingId('');
  }, []);

  const handleNew = useCallback(() => {
    resetForm();
    setPanelOpen(true);
  }, [resetForm]);

  const openEditor = useCallback(async (id) => {
    resetForm();
    setEditingId(id);
    setPanelOpen(true);
    setLoadingStructure(true);
    try {
      const res = await fetch(`/api/checklists/${id}?includeStructure=true`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setForm({
        name: data.name || '',
        description: data.description || '',
        equipmentType: data.equipmentType || '',
        tagsText: Array.isArray(data.tags) ? data.tags.join(', ') : '',
        nodes: data.structure && data.structure.length ? data.structure : createDefaultNodes(),
        notes: '',
        versionTitle: data.currentVersionTitle || data.name || '',
        versionSummary: data.currentVersionNotes || data.description || ''
      });
      setVersionHistory(Array.isArray(data.versions) ? data.versions : []);
      setError('');
    } catch (err) {
      setError(err.message || 'No se pudo cargar el checklist');
      setPanelOpen(false);
    } finally {
      setLoadingStructure(false);
    }
  }, [resetForm]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setSaving(false);
    setLoadingStructure(false);
    setError('');
    setMessage('');
  }, []);

  const tagsArray = useMemo(
    () =>
      form.tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tagsText]
  );

  const hasChanges = useMemo(() => {
    if (!form.name.trim()) return false;
    if (!form.equipmentType.trim()) return false;
    return form.nodes.length > 0;
  }, [form.name, form.equipmentType, form.nodes]);

  async function handleSave() {
    if (!hasChanges) {
      setError('Completa los campos obligatorios');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        name: form.name,
        description: form.description,
        equipmentType: form.equipmentType,
        tags: tagsArray,
        nodes: form.nodes,
        notes: form.notes,
        versionTitle: form.versionTitle || form.name,
        versionSummary: form.versionSummary || form.description
      };

      const res = await fetch(editingId ? `/api/checklists/${editingId}` : '/api/checklists', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();

      setChecklists((prev) => {
        const next = editingId
          ? prev.map((item) =>
              item.id === saved.id
                ? {
                    ...item,
                    name: saved.name,
                    description: saved.description,
                    equipmentType: saved.equipmentType,
                    tags: saved.tags,
                    currentVersion: saved.currentVersion,
                    updatedAt: saved.updatedAt
                  }
                : item
            )
          : [
              ...prev,
              {
                id: saved.id,
                name: saved.name,
                description: saved.description,
                equipmentType: saved.equipmentType,
                tags: saved.tags,
                isActive: saved.isActive,
                deletedAt: saved.deletedAt,
                currentVersion: saved.currentVersion,
                updatedAt: saved.updatedAt,
                createdAt: saved.createdAt
              }
            ];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });

      setMessage(editingId ? 'Checklist actualizado' : 'Checklist creado');
      setVersionHistory(Array.isArray(saved.versions) ? saved.versions : []);
      if (!editingId) {
        setEditingId(saved.id);
      }
    } catch (err) {
      setError(err.message || 'Error al guardar el checklist');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id, nextActive) {
    try {
      const res = await fetch(`/api/checklists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive, restore: nextActive })
      });
      if (!res.ok) throw new Error(await res.text());
      setChecklists((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, isActive: nextActive, deletedAt: nextActive ? null : new Date().toISOString() }
            : item
        )
      );
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Configuración</p>
            <h1 className="page-header__title">Checklists</h1>
          </div>
        </div>
        <div className="page-header__actions">
          <Link href="/admin/checklists/historial" className="btn">
            Ver historial / reportes
          </Link>
          {canCreate ? (
            <button className="btn primary" onClick={handleNew}>
              Nuevo checklist
            </button>
          ) : null}
        </div>
      </div>
      <p className="page-header__subtitle">
        Configura secciones, preguntas y opciones personalizadas. Cada publicación genera una nueva versión.
      </p>

      {error && !panelOpen ? (
        <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>
      ) : null}
      {message && !panelOpen ? (
        <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</div>
      ) : null}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo equipo</th>
              <th>Versión</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {checklists.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.equipmentType || '-'}</td>
                <td>v{item.currentVersion || 1}</td>
                <td>{item.isActive ? 'Activo' : 'Archivado'}</td>
                <td>{formatDate(item.updatedAt)}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => openEditor(item.id)}>
                    Editar
                  </button>
                  <button
                    className="btn"
                    onClick={() => toggleActive(item.id, !item.isActive)}
                  >
                    {item.isActive ? 'Archivar' : 'Restaurar'}
                  </button>
                </td>
              </tr>
            ))}
            {checklists.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  Aún no hay checklists configurados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlidingPanel
        open={panelOpen}
        title={editingId ? 'Actualizar checklist' : 'Nuevo checklist'}
        onClose={closePanel}
        footer={(
          <>
            <button className="btn" onClick={closePanel} disabled={saving || loadingStructure}>
              Cerrar
            </button>
            <button
              className="btn primary"
              onClick={handleSave}
              disabled={saving || loadingStructure || !hasChanges}
            >
              {saving ? 'Guardando...' : 'Publicar versión'}
            </button>
          </>
        )}
      >
        {loadingStructure ? (
          <div>Cargando estructura...</div>
        ) : (
          <div className="form-grid" style={{ gap: 16 }}>
            <div className="form-field">
              <label className="label" htmlFor="name">Nombre</label>
              <input
                id="name"
                className="input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="equipmentType">Tipo de equipo</label>
              <input
                id="equipmentType"
                className="input"
                placeholder="Ej: camioneta, grua..."
                value={form.equipmentType}
                onChange={(event) => setForm((prev) => ({ ...prev, equipmentType: event.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="description">Descripción</label>
              <textarea
                id="description"
                className="input"
                rows={2}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="tags">Etiquetas</label>
              <input
                id="tags"
                className="input"
                placeholder="Seguridad, pre-operacional..."
                value={form.tagsText}
                onChange={(event) => setForm((prev) => ({ ...prev, tagsText: event.target.value }))}
              />
              <span className="input-hint">Separar por coma. Ej: seguridad, mantención</span>
            </div>
            <div className="form-field">
              <label className="label" htmlFor="versionTitle">Título de versión</label>
              <input
                id="versionTitle"
                className="input"
                value={form.versionTitle}
                onChange={(event) => setForm((prev) => ({ ...prev, versionTitle: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="versionSummary">Resumen</label>
              <textarea
                id="versionSummary"
                className="input"
                rows={2}
                value={form.versionSummary}
                onChange={(event) => setForm((prev) => ({ ...prev, versionSummary: event.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="label" htmlFor="notes">Notas de versión (visible en historial)</label>
              <textarea
                id="notes"
                className="input"
                rows={2}
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>

            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Estructura del checklist</label>
              <ChecklistBuilder
                value={form.nodes}
                onChange={(nodes) => setForm((prev) => ({ ...prev, nodes }))}
              />
            </div>

            {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
            {message ? <div style={{ color: 'var(--accent)' }}>{message}</div> : null}

            {versionHistory.length ? (
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Versiones anteriores</label>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Versión</th>
                        <th>Título</th>
                        <th>Notas</th>
                        <th>Creada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versionHistory
                        .slice()
                        .sort((a, b) => b.version - a.version)
                        .map((version) => (
                          <tr key={version.version}>
                            <td>v{version.version}</td>
                            <td>{version.title || '-'}</td>
                            <td>{version.notes || '-'}</td>
                            <td>{formatDate(version.createdAt)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SlidingPanel>
    </div>
  );
}
