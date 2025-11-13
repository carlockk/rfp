'use client';







import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SlidingPanel from '../../../ui/SlidingPanel';
import PaginationControls from '../../../ui/PaginationControls';
import EquipmentFormPanel from './EquipmentFormPanel';
import BackButton from '../../../ui/BackButton';
import { cacheEquipments, readCachedEquipments } from '@/lib/offline/resources';







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







const normalizeOperatorsForDraft = (operators = []) => {



  if (!Array.isArray(operators)) return [];



  return operators



    .map((entry) => {



      if (typeof entry === 'string') return entry;



      if (entry?.user?._id) return entry.user._id.toString();



      if (typeof entry?.user === 'string') return entry.user;



      if (typeof entry === 'object' && entry?._id) return entry._id.toString();



      return '';



    })



    .filter(Boolean);



};







const mapEquipmentToDraft = (equipment) => {



  if (!equipment) return EMPTY_EQUIPMENT;



  return {



    ...EMPTY_EQUIPMENT,



    code: equipment.code || '',



    type: equipment.type || '',



    brand: equipment.brand || '',



    model: equipment.model || '',



    plate: equipment.plate || '',



    fuel: equipment.fuel || 'diesel',



    adblue: Boolean(equipment.adblue),



    hourmeterBase:



      equipment.hourmeterBase === 0 || equipment.hourmeterBase



        ? String(equipment.hourmeterBase)



        : '',



    odometerBase:



      equipment.odometerBase === 0 || equipment.odometerBase



        ? String(equipment.odometerBase)



        : '',



    notes: equipment.notes || '',



    operators: normalizeOperatorsForDraft(equipment.operators)



  };



};







const formatFileSize = (bytes) => {



  if (!bytes || typeof bytes !== 'number') return '';



  if (bytes < 1024) return `${bytes} B`;



  const units = ['KB', 'MB', 'GB', 'TB'];



  let size = bytes / 1024;



  let unitIndex = 0;



  while (size >= 1024 && unitIndex < units.length - 1) {



    size /= 1024;



    unitIndex += 1;



  }



  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;



};







export default function EquipmentManager() {



  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');



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



  const [previewDoc, setPreviewDoc] = useState(null);



  const [editingEquipmentId, setEditingEquipmentId] = useState(null);



  const [deletingId, setDeletingId] = useState('');



  const [isOffline, setIsOffline] = useState(
    typeof navigator === 'undefined' ? false : !navigator.onLine
  );



  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);



  const loadCachedEquipments = useCallback(async () => {
    const cached = await readCachedEquipments();
    if (Array.isArray(cached) && cached.length) {
      setItems(cached);
      setUsingCachedData(true);
    } else {
      setUsingCachedData(false);
    }
  }, []);



  const [usingCachedData, setUsingCachedData] = useState(false);







  const hasDraftChanges = useMemo(



    () => JSON.stringify(draft) !== JSON.stringify(EMPTY_EQUIPMENT),



    [draft]



  );







  const refreshData = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      setError('');
      await loadCachedEquipments();
      return;
    }
    try {
      setUsingCachedData(false);
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
      cacheEquipments(equipments).catch(() => {});
      setTypes(typesPayload);
      setTechnicians(techniciansPayload);
      setDraft((prev) => {
        if (prev.type || typesPayload.length === 0) return prev;
        return { ...prev, type: typesPayload[0].name };
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Error cargando datos');
      await loadCachedEquipments();
    } finally {
      setLoading(false);
    }
  }, [loadCachedEquipments]);







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

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sortedItems;
    return sortedItems.filter((item) => {
      const operatorBlob = Array.isArray(item.operators)
        ? item.operators
            .map((entry) => {
              const user = entry?.user || entry;
              if (!user) return '';
              if (typeof user === 'string') return user;
              if (typeof user === 'object') {
                if (user.name && user.email) return `${user.name} ${user.email}`;
                return user.name || user.email || '';
              }
              return '';
            })
            .join(' ')
        : '';
      const fields = [
        item.code,
        item.type,
        item.brand,
        item.model,
        item.plate,
        item.fuel,
        item.notes,
        operatorBlob
      ];
      return fields.some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(query)
      );
    });
  }, [sortedItems, searchTerm]);








  useEffect(() => {



    setPage(1);



  }, [sortedItems.length]);

  useEffect(() => {

    setPage(1);

  }, [searchTerm]);







  const visibleItems = useMemo(() => {



    const start = (page - 1) * PAGE_SIZE;



    return filteredItems.slice(start, start + PAGE_SIZE);



  }, [filteredItems, page]);







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



    resetDraft();



    setEditingEquipmentId(null);



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



    setDraft({



      ...EMPTY_EQUIPMENT,



      type: types[0]?.name || ''



    });



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



      const targetId = editingEquipmentId;



      const endpoint = targetId ? `/api/equipments/${targetId}` : '/api/equipments';



      const method = targetId ? 'PUT' : 'POST';



      const res = await fetch(endpoint, {



        method,



        headers: { 'Content-Type': 'application/json' },



        body: JSON.stringify(payload)



      });



      if (!res.ok) {



        throw new Error(await res.text());



      }



      await refreshData();



      setPanelOpen(false);



      resetDraft();



      setEditingEquipmentId(null);



      setMessage('');



    } catch (err) {



      setMessage(err.message || 'No se pudo guardar');



    } finally {



      setSaving(false);



    }



  }







  function handleCancel() {



    setPanelOpen(false);



    setEditingEquipmentId(null);



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



    setPreviewDoc(null);



    setDocsPanelOpen(true);



  };







  const closeDocumentsPanel = () => {



    setDocsPanelOpen(false);



    setDocsEquipment(null);



    setDocsError('');



    setDocsUploading(false);



    setPreviewDoc(null);



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



          body: JSON.stringify({ fileBase64: dataUrl, fileType: file.type || '' })



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



            url: uploadPayload.url,



            publicId: uploadPayload.publicId || ''



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







  function handleEditEquipment(equipmentId) {



    const equipment = items.find((item) => String(item._id) === String(equipmentId));



    if (!equipment) return;



    setEditingEquipmentId(equipmentId);



    setDraft(mapEquipmentToDraft(equipment));



    setPanelOpen(true);



    setMessage('');



  }







  async function handleDeleteEquipment(equipmentId) {



    const equipment = items.find((item) => String(item._id) === String(equipmentId));



    const label = equipment?.code ? `el equipo ${equipment.code}` : 'este equipo';



    const confirmed =



      typeof window === 'undefined' ? true : window.confirm(`Seguro que deseas eliminar ${label}?`);



    if (!confirmed) return;



    setDeletingId(equipmentId);



    try {



      const res = await fetch(`/api/equipments/${equipmentId}`, { method: 'DELETE' });



      if (!res.ok) throw new Error(await res.text());



      await refreshData();



    } catch (err) {



      setError(err.message || 'No se pudo eliminar el equipo');



    } finally {



      setDeletingId('');



    }



  }







  const handleDownloadDocument = (doc) => {



    if (!doc?.url) return;



    try {



      const newWindow = window.open(doc.url, '_blank', 'noopener,noreferrer');



      if (!newWindow) {



        const anchor = document.createElement('a');



        anchor.href = doc.url;



        anchor.download = doc.name || 'documento';



        anchor.style.display = 'none';



        document.body.appendChild(anchor);



        anchor.click();



        anchor.remove();



      }



    } catch {



      window.location.assign(doc.url);



    }



  };







  const panelTitle = editingEquipmentId ? 'Editar equipo' : 'Nuevo equipo';







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



          <input
            type="search"
            className="input"
            placeholder="Buscar equipos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ minWidth: 220 }}
            aria-label="Buscar equipos"
          />



          <button className="btn primary" onClick={openPanel}>Nuevo equipo</button>



        </div>



      </div>



      <p className="page-header__subtitle">Gestiona tu flota y agrega unidades desde este panel.</p>



      {usingCachedData ? (
        <div className="offline-hint">
          Modo offline: mostrando datos almacenados en este dispositivo.
        </div>
      ) : isOffline ? (
        <div className="offline-hint">
          Sin conexión. Intentando cargar los datos guardados localmente.
        </div>
      ) : null}



      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div> : null}



      {loading ? (



        <div>Cargando equipos...</div>



      ) : items.length === 0 ? (



        <div style={{ color: 'var(--muted)' }}>No hay equipos registrados.</div>



      ) : filteredItems.length === 0 ? (



        <div style={{ color: 'var(--muted)' }}>No se encontraron equipos para la búsqueda actual.</div>



      ) : (



        <div className="table-wrapper">



          <table className="table table--compact">



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



                        Ver ({Array.isArray(item.documents) ? item.documents.length : 0})



                      </button>



                    </td>



                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CL') : '-'}</td>



                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>



                      <button className="btn" type="button" onClick={() => handleEditEquipment(equipmentId)}>



                        Editar



                      </button>



                      <button



                        className="btn"



                        type="button"



                        style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#b91c1c' }}



                        onClick={() => handleDeleteEquipment(equipmentId)}



                        disabled={deletingId === equipmentId}



                      >



                        {deletingId === equipmentId ? 'Eliminando...' : 'Eliminar'}



                      </button>



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



            total={filteredItems.length}



            onPageChange={setPage}



          />



        </div>



      )}







      <SlidingPanel



        open={panelOpen}



        title={panelTitle}



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







              <div className="documents-list">







                {docsEquipment.documents.map((doc) => {







                  const meta = [];







                  if (doc.type) meta.push(doc.type.toUpperCase());







                  if (doc.size) meta.push(formatFileSize(doc.size));







                  return (







                    <div key={doc._id || doc.url} className="document-row">







                      <button







                        type="button"







                        className="document-row__button"







                        onClick={() => setPreviewDoc(doc)}







                      >







                        {isImageDoc(doc) ? (







                          <img







                            src={doc.url}







                            alt={doc.name}







                            className="document-row__thumb"







                          />







                        ) : (







                          <div className="document-row__thumb document-row__thumb--pdf">







                            PDF







                          </div>







                        )}







                        <div className="document-row__details">







                          <div className="document-row__name" title={doc.name}>







                            {doc.name}







                          </div>







                          {meta.length ? (

                            <div className="document-row__meta">{meta.join(' â€¢ ')}</div>

                          ) : null}







                        </div>







                      </button>







                      <button







                        className="btn"







                        type="button"







                        style={{ padding: '6px 10px' }}







                        onClick={() => handleDeleteDocument(doc._id || doc.url)}







                        disabled={docsUploading}







                      >







                        Eliminar







                      </button>







                    </div>







                  );







                })}







              </div>







            ) : (







              <p className="label" style={{ marginTop: 12 }}>Aún no hay documentos asociados.</p>







            )}





          </>



        ) : null}



      </SlidingPanel>



      {previewDoc ? (



        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>



          <div className="modal" onClick={(event) => event.stopPropagation()}>



            <h3 style={{ marginTop: 0 }}>{previewDoc.name || 'Documento'}</h3>



            {isImageDoc(previewDoc) ? (



              <img src={previewDoc.url} alt={previewDoc.name} className="modal__image" />



            ) : (



              <iframe



                src={previewDoc.url}



                title={previewDoc.name || 'Documento PDF'}



                className="modal__frame"



              ></iframe>



            )}



            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>



              <button className="btn" type="button" onClick={() => handleDownloadDocument(previewDoc)}>



                Descargar



              </button>



              <button className="btn primary" type="button" onClick={() => setPreviewDoc(null)}>



                Cerrar



              </button>



            </div>



          </div>



        </div>



      ) : null}







      <div className="back-button-row">



        <BackButton fallback="/" />



      </div>



    </div>



  );



}



  const isImageDoc = (doc) => {



    if (!doc) return false;



    if (doc.type?.startsWith('image/')) return true;



    if (typeof doc.name === 'string') {



      return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(doc.name);



    }



    return false;



  };

