'use client';

import { useState } from 'react';
import SlidingPanel from '@/app/ui/SlidingPanel';
import BackButton from '@/app/ui/BackButton';

const defaultForm = {
  name: '',
  email: '',
  password: '',
  role: 'tecnico'
};

const roleLabels = {
  superadmin: 'Super admin',
  admin: 'Admin',
  tecnico: 'T\u00e9cnico'
};

export default function UsersManager({ initialUsers }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la lista');
    } finally {
      setRefreshing(false);
    }
  }

  function openPanel() {
    setPanelOpen(true);
    setError('');
    setSuccess('');
  }

  function closePanel(reason) {
    if (['backdrop', 'escape', 'close-button'].includes(reason)) {
      setPanelOpen(false);
    }
  }

  function resetForm() {
    setForm(defaultForm);
    setError('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setUsers((prev) => [created, ...prev]);
      setPanelOpen(false);
      resetForm();
      setSuccess('Usuario creado correctamente');
    } catch (err) {
      setError(err.message || 'Error al crear el usuario');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPanelOpen(false);
    resetForm();
    setSuccess('');
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton fallback="/" />
          <div>
            <h3 style={{ margin: 0 }}>Usuarios</h3>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              Desde aquí puedes crear cuentas para administradores y técnicos.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn primary" onClick={openPanel}>Nuevo usuario</button>
        </div>
      </div>

      {error && !panelOpen ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}
      {success && !panelOpen ? <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{success}</div> : null}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || '-'}</td>
                <td>{user.email}</td>
                <td>{roleLabels[user.role] || user.role}</td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? (
          <div style={{ marginTop: 12, color: 'var(--muted)' }}>No hay usuarios registrados.</div>
        ) : null}
      </div>

      <SlidingPanel
        open={panelOpen}
        title="Nuevo usuario"
        onClose={closePanel}
        footer={(
          <>
            <button className="btn" onClick={handleCancel} disabled={saving}>Cancelar</button>
            <button className="btn primary" onClick={onSubmit} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        )}
      >
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="form-field">
            <label className="label" htmlFor="name">Nombre</label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nombre (opcional)"
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="role">Rol</label>
            <select
              id="role"
              className="input"
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="tecnico">Técnico</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super admin</option>
            </select>
          </div>
          {error ? <span className="input-hint error">{error}</span> : null}
          {success ? <span className="input-hint" style={{ color: 'var(--accent)' }}>{success}</span> : null}
        </form>
      </SlidingPanel>
    </div>
  );
}
