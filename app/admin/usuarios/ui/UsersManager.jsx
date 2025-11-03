'use client';

import { useMemo, useState } from 'react';
import SlidingPanel from '../../../ui/SlidingPanel';
import BackButton from '../../../ui/BackButton';

const defaultForm = {
  name: '',
  email: '',
  password: '',
  role: 'tecnico',
  techProfile: 'externo'
};

const roleLabels = {
  superadmin: 'Super admin',
  admin: 'Admin',
  tecnico: 'Tecnico'
};

const profileLabels = {
  externo: 'Tecnico externo',
  candelaria: 'Tecnico Candelaria'
};

export default function UsersManager({ initialUsers, canManageSuperadmin }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const availableRoles = useMemo(
    () => (canManageSuperadmin ? ['tecnico', 'admin', 'superadmin'] : ['tecnico', 'admin']),
    [canManageSuperadmin]
  );

  const techProfiles = useMemo(() => ['externo', 'candelaria'], []);

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
      setError('La contrasena debe tener al menos 6 caracteres');
      setSaving(false);
      return;
    }

    if (!availableRoles.includes(form.role)) {
      setError('Rol no permitido');
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
    <div className="card card--page">
      <div className="page-header">
        <div className="page-header__left">
          <BackButton fallback="/" />
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel de administracion</p>
            <h1 className="page-header__title">Usuarios</h1>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn primary" onClick={openPanel}>Nuevo usuario</button>
        </div>
      </div>
      <p className="page-header__subtitle">
        Desde aqui puedes crear cuentas para administradores y tecnicos.
      </p>

      {error && !panelOpen ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}
      {success && !panelOpen ? <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{success}</div> : null}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Perfil</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || '-'}</td>
                <td>{user.email}</td>
                <td>{roleLabels[user.role] || user.role}</td>
                <td>{profileLabels[user.techProfile] || '-'}</td>
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
            <label className="label" htmlFor="password">Contrasena</label>
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
              onChange={(event) => {
                const nextRole = event.target.value;
                setForm((prev) => ({
                  ...prev,
                  role: nextRole,
                  techProfile: nextRole === 'tecnico' ? (prev.techProfile || 'externo') : ''
                }));
              }}
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>
          {form.role === 'tecnico' ? (
            <div className="form-field">
              <label className="label" htmlFor="techProfile">Perfil tecnico</label>
              <select
                id="techProfile"
                className="input"
                value={form.techProfile}
                onChange={(event) => setForm((prev) => ({ ...prev, techProfile: event.target.value }))}
              >
                {techProfiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {profileLabels[profile]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {error ? <span className="input-hint error">{error}</span> : null}
          {success ? <span className="input-hint" style={{ color: 'var(--accent)' }}>{success}</span> : null}
        </form>
      </SlidingPanel>
    </div>
  );
}
