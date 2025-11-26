'use client';

import { useMemo, useState } from 'react';

const emptyForm = { id: '', name: '', email: '', active: true };

export default function RecipientsManager({ initialRecipients = [] }) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term)
    );
  }, [recipients, query]);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/anomaly-recipients?includeInactive=true', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRecipients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Error al cargar destinatarios');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setPanelOpen(true);
  };

  const openEdit = (item) => {
    setForm({
      id: item.id,
      name: item.name,
      email: item.email,
      active: item.active
    });
    setPanelOpen(true);
  };

  const closePanel = () => {
    if (saving) return;
    setPanelOpen(false);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Ingresa un nombre');
      return;
    }
    if (!form.email.trim()) {
      setError('Ingresa un correo');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        active: form.active
      };
      const endpoint = form.id ? `/api/anomaly-recipients/${form.id}` : '/api/anomaly-recipients';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      closePanel();
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/anomaly-recipients/${form.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      closePanel();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickDelete = async (id) => {
    if (!id || deleting) return;
    const confirmDelete = window.confirm('¿Eliminar este destinatario?');
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/anomaly-recipients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__titles">
          <p className="page-header__eyebrow">Configuración</p>
          <h1 className="page-header__title">Anomalías</h1>
          <p className="label" style={{ marginTop: 4 }}>
            Define los correos que recibirán las observaciones marcadas como anomalía por los operadores.
          </p>
        </div>
        <div className="page-header__actions" style={{ gap: 8 }}>
          <input
            type="search"
            placeholder="Buscar por nombre o correo"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button className="btn primary" onClick={openCreate}>
            Nuevo correo
          </button>
        </div>
      </div>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Destinatarios</h3>
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? 'Actualizando...' : 'Refrescar'}
          </button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Actualizado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>
                      <span className="label" style={{ color: item.active ? 'var(--success)' : 'var(--muted)' }}>
                        {item.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('es-CL') : '-'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => openEdit(item)}
                        style={{ padding: '6px 10px', marginRight: 6 }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleQuickDelete(item.id)}
                        disabled={deleting}
                        style={{ padding: '6px 10px', color: 'var(--danger)' }}
                      >
                        {deleting ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
                    {loading ? 'Cargando...' : 'No hay correos configurados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {panelOpen ? (
        <div className="modal-overlay" onClick={closePanel}>
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: 460, width: '100%' }}
          >
            <h2 style={{ marginTop: 0 }}>{form.id ? 'Editar correo' : 'Nuevo correo'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-field">
                <label className="label" htmlFor="recipient-name">Nombre</label>
                <input
                  id="recipient-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="label" htmlFor="recipient-email">Correo</label>
                <input
                  id="recipient-email"
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <label className="input-choice" style={{ alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                />
                Activo
              </label>
              {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              {form.id ? (
                <button
                  className="btn"
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  style={{ color: 'var(--danger)' }}
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              ) : null}
              <button className="btn" type="button" onClick={closePanel} disabled={saving}>
                Cancelar
              </button>
              <button className="btn primary" type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
