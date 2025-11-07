'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SlidingPanel from '../../../ui/SlidingPanel';
import PaginationControls from '../../../ui/PaginationControls';
import EquipmentFormPanel from './EquipmentFormPanel';
import BackButton from '../../../ui/BackButton';

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

const PAGE_SIZE = 10;

export default function EquipmentManager() {
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_EQUIPMENT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [assigningId, setAssigningId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignInfo, setAssignInfo] = useState('');
  const [page, setPage] = useState(1);

  const hasDraftChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(EMPTY_EQUIPMENT),
    [draft]
  );

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [equipmentsRes, typesRes, techniciansRes] = await Promise.all([
        fetch('/api/equipments', { cache: 'no-store' }),
        fetch('/api/equipment-types', { cache: 'no-store' }),
        fetch('/api/users?role=tecnico', { cache: 'no-store' })
      ]);
      if (!equipmentsRes.ok) throw new Error('No se pudo cargar equipos');
      if (!typesRes.ok) throw new Error('No se pudo cargar tipos');
      if (!techniciansRes.ok) throw new Error('No se pudo cargar tecnicos');
      const [equipments, typesPayload, techniciansPayload] = await Promise.all([
        equipmentsRes.json(),
        typesRes.json(),
        techniciansRes.json()
      ]);
      setItems(equipments);
      setTypes(typesPayload);
      setTechnicians(techniciansPayload);
      setAssignError('');
      setAssignInfo('');
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

  useEffect(() => {
    if (!assignInfo) return;
    const timer = setTimeout(() => setAssignInfo(''), 3000);
    return () => clearTimeout(timer);
  }, [assignInfo]);

  const sortedItems = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => {
        const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return bDate - aDate;
      });
  }, [items]);

  useEffect(() => {
    setPage(1);
  }, [sortedItems.length]);

  const visibleItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedItems.slice(start, start + PAGE_SIZE);
  }, [sortedItems, page]);

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

  async function handleAssign(equipmentId, nextUserId) {
    setAssigningId(equipmentId);
    setAssignError('');
    setAssignInfo('');
    try {
      const res = await fetch('/api/equipment/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId,
          userId: nextUserId || null
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const { equipment } = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          String(item._id) === equipment.id
            ? { ...item, assignedTo: equipment.assignedTo, assignedAt: equipment.assignedAt }
            : item
        )
      );
      setAssignInfo('Asignacion actualizada');
    } catch (err) {
      setAssignError(err.message || 'No se pudo asignar el equipo');
    } finally {
      setAssigningId('');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel de administración</p>
            <h1 className="page-header__title">Equipos</h1>
          </div>
        </div>
        <div className="page-header__actions">
          <button className="btn primary" onClick={openPanel}>Nuevo equipo</button>
        </div>
      </div>
      <p className="page-header__subtitle">Gestiona tu flota y agrega unidades desde este panel.</p>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}
      {assignError ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{assignError}</div> : null}
      {assignInfo ? <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{assignInfo}</div> : null}

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
                <th>Asignado a</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const equipmentId = String(item._id);
                const assignedValue = item.assignedTo ? String(item.assignedTo) : '';
                return (
                  <tr key={equipmentId}>
                    <td>{item.code}</td>
                    <td>{item.type}</td>
                    <td>{item.brand} {item.model}</td>
                    <td>{item.fuel}{item.adblue ? ' + AdBlue' : ''}</td>
                    <td>
                      <select
                        className="input"
                        value={assignedValue}
                        onChange={(event) => handleAssign(equipmentId, event.target.value)}
                        disabled={assigningId === equipmentId}
                      >
                        <option value="">Sin asignar</option>
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.name ? `${tech.name} (${tech.email})` : tech.email}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CL') : '-'}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <Link href={`/admin/equipos/${equipmentId}`} className="nav-link">Editar</Link>
                      <Link href={`/admin/equipos/qr/${equipmentId}`} className="nav-link">QR</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            total={sortedItems.length}
            onPageChange={setPage}
          />
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

      <div className="back-button-row">
        <BackButton fallback="/" />
      </div>
    </div>
  );
}
