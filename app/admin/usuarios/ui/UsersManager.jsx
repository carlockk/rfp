'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import SlidingPanel from '../../../ui/SlidingPanel';
import BackButton from '../../../ui/BackButton';
import PaginationControls from '../../../ui/PaginationControls';

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

const PAGE_SIZE = 10;

export default function UsersManager({ initialUsers, canManageSuperadmin }) {
  const rawFormId = useId();
  const formId = useMemo(
    () => `user-form-${rawFormId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawFormId]
  );
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [page, setPage] = useState(1);

  const availableRoles = useMemo(
    () => (canManageSuperadmin ? ['tecnico', 'admin', 'superadmin'] : ['tecnico', 'admin']),
    [canManageSuperadmin]
  );

  const techProfiles = useMemo(() => ['externo', 'candelaria'], []);

  const isEditing = Boolean(editingId);

  const sortedUsers = useMemo(() => {
    return users
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  }, [users]);

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, page]);

  useEffect(() => {
    setPage(1);
  }, [sortedUsers.length]);

  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data);
      setPage(1);
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
      resetForm();
      setSuccess('');
    }
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingId('');
    setError('');
  }

  function openCreate() {
    resetForm();
    openPanel();
  }

  function handleEdit(user) {
    if (!canManageSuperadmin) return;
    setEditingId(user.id);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'tecnico',
      techProfile: user.techProfile || (user.role === 'tecnico' ? 'externo' : '')
    });
    setError('');
    setSuccess('');
    setPanelOpen(true);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!availableRoles.includes(form.role)) {
      setError('Rol no permitido');
      setSaving(false);
      return;
    }

    if (!isEditing && form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      setSaving(false);
      return;
    }

    if (isEditing && form.password && form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        techProfile: form.role === 'tecnico' ? form.techProfile : '',
        password: form.password || undefined
      };

      const res = await fetch(isEditing ? `/api/users/${editingId}` : '/api/users', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setUsers((prev) =>
        isEditing
          ? prev.map((item) => (item.id === created.id ? created : item))
          : [created, ...prev]
      );
      setPanelOpen(false);
      resetForm();
      setSuccess(isEditing ? 'Usuario actualizado' : 'Usuario creado correctamente');
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

  async function handleDelete(userId) {
    if (!canManageSuperadmin) return;
    if (typeof window !== 'undefined' && !window.confirm('Seguro que deseas eliminar este usuario?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setUsers((prev) => prev.filter((item) => item.id !== userId));
      setError('');
      setSuccess('Usuario eliminado');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el usuario');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel de administracion</p>
            <h1 className="page-header__title">Usuarios</h1>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn primary" onClick={openCreate}>Nuevo usuario</button>
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
              {canManageSuperadmin ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.name || '-'}</td>
                <td>{user.email}</td>
                <td>{roleLabels[user.role] || user.role}</td>
                <td>{profileLabels[user.techProfile] || '-'}</td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</td>
                {canManageSuperadmin ? (
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" type="button" onClick={() => handleEdit(user)}>Editar</button>
                    <button className="btn" type="button" onClick={() => handleDelete(user.id)}>Eliminar</button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {sortedUsers.length === 0 ? (
          <div style={{ marginTop: 12, color: 'var(--muted)' }}>No hay usuarios registrados.</div>
        ) : null}
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          total={sortedUsers.length}
          onPageChange={setPage}
        />
      </div>

      <SlidingPanel
        open={panelOpen}
        title={isEditing ? 'Editar usuario' : 'Nuevo usuario'}
        onClose={closePanel}
        footer={(
          <>
            <button className="btn" type="button" onClick={handleCancel} disabled={saving}>Cancelar</button>
            <button className="btn primary" type="submit" form={formId} disabled={saving}>
              {saving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
            </button>
          </>
        )}
      >
        <form id={formId} className="form-grid" onSubmit={onSubmit}>
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
            <label className="label" htmlFor="password">Contrasena {isEditing ? '(opcional)' : ''}</label>
            <input
              id="password"
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            {isEditing ? <span className="input-hint">Deja en blanco para mantener la contraseña actual.</span> : null}
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

      <div className="back-button-row">
        <BackButton fallback="/" />
      </div>
    </div>
  );
}
