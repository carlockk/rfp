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
  notes: '',
  operators: []
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
  const [docsPanelOpen, setDocsPanelOpen] = useState(false);
  const [docsEquipment, setDocsEquipment] = useState(null);
  const [docsError, setDocsError] = useState('');
  const [docsUploading, setDocsUploading] = useState(false);
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
        odometerBase: draft.odometerBase ? Number(draft.odometerBase) : 0,
        operators: Array.isArray(draft.operators)
          ? draft.operators.filter((id) => typeof id === 'string' && id)
          : []
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

  const updateEquipmentLocal = (equipmentId, updater) => {
    setItems((prev) =>
      prev.map((item) => {
        if (String(item._id) !== String(equipmentId)) return item;
        const nextValue = typeof updater === 'function' ? updater(item) : updater;
        return { ...item, ...nextValue };
      })
    );
  };

  const openDocumentsPanel = (equipmentId) => {
    const equipment = items.find((item) => String(item._id) === String(equipmentId));
    if (!equipment) return;
    setDocsEquipment(equipment);
    setDocsError('');
    setDocsPanelOpen(true);
  };

  const closeDocumentsPanel = () => {
    setDocsPanelOpen(false);
    setDocsEquipment(null);
    setDocsError('');
    setDocsUploading(false);
  };

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  async function handleDocumentUpload(event) {
    if (!docsEquipment) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setDocsUploading(true);
    setDocsError('');
    const equipmentId = docsEquipment._id || docsEquipment.id;
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataURL(file);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: dataUrl })
        });
        if (!uploadRes.ok) {
          throw new Error(await uploadRes.text());
        }
        const uploadPayload = await uploadRes.json();
        const docRes = await fetch(`/api/equipment/documents/${equipmentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            size: file.size,
            url: uploadPayload.url
          })
        });
        if (!docRes.ok) {
          throw new Error(await docRes.text());
        }
        const { documents } = await docRes.json();
        updateEquipmentLocal(equipmentId, () => ({ documents }));
        setDocsEquipment((prev) => (prev ? { ...prev, documents } : prev));
      }
    } catch (err) {
      setDocsError(err.message || 'No se pudo subir el documento');
    } finally {
      setDocsUploading(false);
      event.target.value = '';
    }
  }

  async function handleDeleteDocument(docId) {
    if (!docsEquipment) return;
    const equipmentId = docsEquipment._id || docsEquipment.id;
    try {
      const res = await fetch(
        `/api/equipment/documents/${equipmentId}?documentId=${encodeURIComponent(docId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(await res.text());
      const { documents } = await res.json();
      updateEquipmentLocal(equipmentId, () => ({ documents }));
      setDocsEquipment((prev) => (prev ? { ...prev, documents } : prev));
    } catch (err) {
      setDocsError(err.message || 'No se pudo eliminar el documento');
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
                <th>Operadores</th>
                <th>Documentos</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const equipmentId = String(item._id);
                const operatorNames = Array.isArray(item.operators)
                  ? item.operators
                      .map((entry) => {
                        const user = entry.user || entry;
                        if (typeof user === 'string') return user;
                        if (user?.name) return `${user.name} (${user.email})`;
                        if (user?.email) return user.email;
                        return '';
                      })
                      .filter(Boolean)
                  : [];
                const operatorSummary =
                  operatorNames.length === 0
                    ? 'Sin operadores'
                    : operatorNames.length > 2
                      ? `${operatorNames.slice(0, 2).join(', ')} +${operatorNames.length - 2}`
                      : operatorNames.join(', ');
                return (
                  <tr key={equipmentId}>
                    <td>{item.code}</td>
                    <td>{item.type}</td>
                    <td>{item.brand} {item.model}</td>
                    <td>{item.fuel}{item.adblue ? ' + AdBlue' : ''}</td>
                    <td>
                      <span className="operator-badge" title={operatorNames.join(', ') || 'Sin operadores'}>
                        {operatorSummary}
                      </span>
                    </td>
                    <td>
                      <button className="btn" type="button" onClick={() => openDocumentsPanel(equipmentId)}>
                        Ver docs ({Array.isArray(item.documents) ? item.documents.length : 0})
                      </button>
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
          technicians={technicians}
        />
        {!hasDraftChanges ? (
          <span className="input-hint">Completa el formulario y guarda para registrar un nuevo equipo.</span>
        ) : null}
      </SlidingPanel>

      <SlidingPanel
        open={docsPanelOpen}
        title={docsEquipment ? `Documentos de ${docsEquipment.code}` : 'Documentos'}
        onClose={closeDocumentsPanel}
        footer={null}
      >
        {docsEquipment ? (
          <>
            <div className="form-field">
              <label className="label" htmlFor="document-upload">Subir archivo (imágenes o PDF)</label>
              <input
                id="document-upload"
                className="input"
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleDocumentUpload}
                disabled={docsUploading}
              />
              <span className="input-hint">
                Se almacenan en la ficha del equipo. Peso recomendado &lt; 5MB por archivo.
              </span>
            </div>
            {docsError ? <div style={{ color: 'var(--danger)' }}>{docsError}</div> : null}
            {docsUploading ? <div className="label">Subiendo archivos...</div> : null}
            {Array.isArray(docsEquipment.documents) && docsEquipment.documents.length ? (
              <div className="documents-grid">
                {docsEquipment.documents.map((doc) => (
                  <div key={doc._id || doc.url} className="document-card">
                    {doc.type?.startsWith('image/') ? (
                      <img
                        src={doc.url}
                        alt={doc.name}
                        className="document-card__preview"
                        onClick={() => window.open(doc.url, '_blank', 'noopener')}
                      />
                    ) : (
                      <div className="document-card__pdf" onClick={() => window.open(doc.url, '_blank', 'noopener')}>
                        PDF
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.name}
                      </span>
                      <button
                        className="btn"
                        type="button"
                        style={{ padding: '2px 8px' }}
                        onClick={() => handleDeleteDocument(doc._id || doc.url)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="label" style={{ marginTop: 12 }}>Aún no hay documentos asociados.</p>
            )}
          </>
        ) : null}
      </SlidingPanel>

      <div className="back-button-row">
        <BackButton fallback="/" />
      </div>
    </div>
  );
}
