'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SlidingPanel from '@/app/ui/SlidingPanel';
import EquipmentFormPanel from './EquipmentFormPanel';
import BackButton from '@/app/ui/BackButton';

const EMPTY_EQUIPMENT = {
  code: '',
  type: '',
  brand: '',
  model: '',
  plate: '',
  fuel: 'diesel',
  adblue: false,
  hourmeterBase: '',
  odometerBase: '',
  notes: ''
};

export default function EquipmentManager() {
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_EQUIPMENT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const hasDraftChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(EMPTY_EQUIPMENT),
    [draft]
  );

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [equipmentsRes, typesRes] = await Promise.all([
        fetch('/api/equipments', { cache: 'no-store' }),
        fetch('/api/equipment-types', { cache: 'no-store' })
      ]);
      if (!equipmentsRes.ok) throw new Error('No se pudo cargar equipos');
      if (!typesRes.ok) throw new Error('No se pudo cargar tipos');
      const [equipments, typesPayload] = await Promise.all([
        equipmentsRes.json(),
        typesRes.json()
      ]);
      setItems(equipments);
      setTypes(typesPayload);
      setDraft((prev) => {
        if (prev.type || typesPayload.length === 0) return prev;
        return { ...prev, type: typesPayload[0].name };
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  async function handleCreateType(name) {
    const res = await fetch('/api/equipment-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const created = await res.json();
    setTypes((prev) => {
      const exists = prev.some((t) => t.name.toLowerCase() === created.name.toLowerCase());
      if (exists) return prev;
      return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
    });
    return created;
  }

  function openPanel() {
    setPanelOpen(true);
    setMessage('');
  }

  function closePanel(reason) {
    if (reason === 'backdrop' || reason === 'escape' || reason === 'close-button') {
      setPanelOpen(false);
      setMessage('');
    }
  }

  function resetDraft() {
    setDraft(EMPTY_EQUIPMENT);
  }

  async function handleSubmit() {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...draft,
        hourmeterBase: draft.hourmeterBase ? Number(draft.hourmeterBase) : 0,
        odometerBase: draft.odometerBase ? Number(draft.odometerBase) : 0
      };
      const res = await fetch('/api/equipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      await refreshData();
      setPanelOpen(false);
      resetDraft();
      setMessage('');
    } catch (err) {
      setMessage(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPanelOpen(false);
    setMessage('');
    resetDraft();
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton fallback="/" />
          <div>
            <h3 style={{ margin: 0 }}>Equipos</h3>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Gestiona tu flota y agrega unidades desde este panel.</span>
          </div>
        </div>
        <button className="btn primary" onClick={openPanel}>Nuevo equipo</button>
      </div>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}

      {loading ? (
        <div>Cargando equipos...</div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--muted)' }}>No hay equipos registrados.</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Identificador</th>
                <th>Combustible</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.code}</td>
                  <td>{item.type}</td>
                  <td>{item.brand} {item.model}</td>
                  <td>{item.fuel}{item.adblue ? ' + AdBlue' : ''}</td>
                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <Link href={`/admin/equipos/${item._id}`} className="nav-link">Editar</Link>
                    <Link href={`/admin/equipos/qr/${item._id}`} className="nav-link">QR</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlidingPanel
        open={panelOpen}
        title="Nuevo equipo"
        onClose={closePanel}
        footer={(
          <>
            <button className="btn" onClick={handleCancel} disabled={saving}>Cancelar</button>
            <button className="btn primary" onClick={handleSubmit} disabled={saving || !draft.code || !draft.type}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        )}
      >
        {message ? <div style={{ color: 'var(--danger)' }}>{message}</div> : null}
        <EquipmentFormPanel
          value={draft}
          onChange={setDraft}
          types={types}
          onAddType={handleCreateType}
          busy={saving}
        />
        {!hasDraftChanges ? (
          <span className="input-hint">Completa el formulario y guarda para registrar un nuevo equipo.</span>
        ) : null}
      </SlidingPanel>
    </div>
  );
}
