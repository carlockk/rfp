'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EvaluationEntry from '@/app/equipo/[id]/ui/EvaluationEntry';
import BackButton from '@/app/ui/BackButton';

const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

function normalizeEquipment(equipment) {
  if (!equipment) return null;
  return {
    id: equipment.id,
    code: equipment.code,
    type: equipment.type || '',
    brand: equipment.brand || '',
    model: equipment.model || '',
    plate: equipment.plate || '',
    fuel: equipment.fuel || '',
    adblue: Boolean(equipment.adblue),
    notes: equipment.notes || '',
    operators: Array.isArray(equipment.operators) ? equipment.operators : [],
    assignedAt: equipment.assignedAt || null
  };
}

export default function EquipmentScanner({ assignedEquipments, checklists, techProfile, templates = [] }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);

  const [supportsBarcode, setSupportsBarcode] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [cameraSupportChecked, setCameraSupportChecked] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [assignedToCurrent, setAssignedToCurrent] = useState(false);
  const [showMobileHint, setShowMobileHint] = useState(false);
  const [deeplinkUrl, setDeeplinkUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const hasBarcode = 'BarcodeDetector' in window;
    setSupportsBarcode(hasBarcode);
    try {
      const origin = window.location.origin;
      setDeeplinkUrl(`${origin}/equipo/scan`);
    } catch {
      setDeeplinkUrl('');
    }

    if (navigator?.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' })
        .then((result) => {
          setCameraPermission(result.state);
          result.onchange = () => setCameraPermission(result.state);
        })
        .catch(() => {
          setCameraPermission('prompt');
        })
        .finally(() => setCameraSupportChecked(true));
    } else {
      setCameraSupportChecked(true);
    }

    return () => {
      stopCamera();
    };
  }, []);

  const assignedMap = useMemo(() => {
    const map = {};
    assignedEquipments.forEach((item) => {
      map[item.id] = normalizeEquipment(item);
    });
    return map;
  }, [assignedEquipments]);

  const stopCamera = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const detectFrame = async () => {
    if (!detectorRef.current || !videoRef.current) {
      frameRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    try {
      const codes = await detectorRef.current.detect(videoRef.current);
      if (codes.length > 0) {
        const [first] = codes;
        stopCamera();
        if (first?.rawValue) {
          await lookupEquipment(first.rawValue);
        } else {
          setError('No se pudo leer el código QR. Intenta nuevamente.');
        }
      } else {
        frameRef.current = requestAnimationFrame(detectFrame);
      }
    } catch (err) {
      console.error('Error detectando QR', err);
      setError('No se pudo analizar la imagen. Intenta nuevamente.');
      stopCamera();
    }
  };

  const startScan = async () => {
    setError('');
    setStatus('');
    setSelectedEquipment(null);
    setAssignedToCurrent(false);

    if (!supportsBarcode) {
      setError('Tu navegador no soporta lectura de códigos QR nativamente. Usa la entrada manual o escanea con otra app.');
      return;
    }

    try {
      if (cameraPermission === 'denied') {
        setError('La cámara está bloqueada. Habilítala desde los permisos del navegador y vuelve a intentarlo.');
        return;
      }

      const constraints = {
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      setScanning(true);
      frameRef.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      console.error('Error iniciando cámara', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError('El acceso a la cámara fue denegado. Revisa los permisos del navegador.');
      } else if (err?.name === 'NotFoundError') {
        setError('No se encontró una cámara disponible. Usa la opción móvil o selecciona un equipo.');
      } else {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
      stopCamera();
    }
  };

  const lookupEquipment = async (code) => {
    const cleaned = String(code || '').trim();
    if (!cleaned) {
      setError('Código no válido.');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const res = await fetch(`/api/equipment/by-qr/${encodeURIComponent(cleaned)}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'No se encontro el equipo');
      }
      const payload = await res.json();
      const equipment = normalizeEquipment(payload.equipment);
      setSelectedEquipment(equipment);
      setAssignedToCurrent(Boolean(payload.assignedToCurrent));
      setStatus(`Código detectado: ${equipment.code}`);
    } catch (err) {
      console.error('No se pudo obtener equipo', err);
      setError(err.message || 'No se pudo obtener el equipo');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    stopCamera();
    if (!manualCode.trim()) {
      setError('Ingresa un código QR válido.');
      return;
    }
    await lookupEquipment(manualCode);
  };

  const handleManualSelect = (equipmentId) => {
    stopCamera();
    const equipment = assignedMap[equipmentId];
    if (!equipment) return;
    setSelectedEquipment(equipment);
    setAssignedToCurrent(true);
    setStatus(`Equipo seleccionado: ${equipment.code}`);
  };

  const resetSelection = () => {
    stopCamera();
    setSelectedEquipment(null);
    setAssignedToCurrent(false);
    setStatus('');
    setError('');
  };

  const openMobileScanner = () => {
    if (!deeplinkUrl) return;
    setShowMobileHint(true);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(deeplinkUrl).catch(() => {});
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel del operador</p>
            <h1 className="page-header__title">Escanear equipo por QR</h1>
          </div>
        </div>
      </div>
      <p className="page-header__subtitle">
        Escanea el código de la máquina para iniciar la evaluación, o selecciona uno de tus equipos asignados.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {supportsBarcode ? (
              <button className="btn primary" onClick={startScan} type="button" disabled={scanning}>
                {scanning ? 'Leyendo...' : 'Escanear QR'}
              </button>
            ) : null}
            <button className="btn" type="button" onClick={resetSelection}>
              Limpiar selección
            </button>
            {(!supportsBarcode || cameraPermission === 'denied') && deeplinkUrl ? (
              <button className="btn secondary" type="button" onClick={openMobileScanner}>
                Abrir en el móvil
              </button>
            ) : null}
          </div>

          {supportsBarcode ? (
            <div style={{ position: 'relative', background: '#0f172a', borderRadius: 12, overflow: 'hidden' }}>
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  maxHeight: 280,
                  display: scanning ? 'block' : 'none',
                  objectFit: 'cover'
                }}
                muted
                playsInline
              />
              {!scanning ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                  La cámara aparecerá aquí cuando comiences el escaneo.
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ color: 'var(--muted)' }}>
              Tu navegador no soporta lectura de códigos QR. Usa la entrada manual, selecciona un equipo o abre el enlace en tu móvil.
            </div>
          )}

          {!cameraSupportChecked || cameraPermission === 'prompt' ? (
            <div className="alert" style={{ background: 'rgba(59,130,246,0.12)', padding: 12, borderRadius: 8, color: '#1e3a8a' }}>
              Si la cámara no aparece, acepta los permisos del navegador o prueba la opción \"Abrir en el móvil\".
            </div>
          ) : null}

          {cameraPermission === 'denied' ? (
            <div
              className="hint-card"
              style={{
                background: 'rgba(240,68,56,0.08)',
                border: '1px solid rgba(240,68,56,0.3)',
                padding: 12,
                borderRadius: 8
              }}
            >
              <p className="label" style={{ marginBottom: 8 }}>Cómo habilitar la cámara</p>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)' }}>
                <li>Haz clic en el candado de la barra de direcciones y selecciona \"Permitir cámara\".</li>
                <li>Si no aparece la opción, abre la configuración del sitio y habilita el permiso de cámara.</li>
                <li>Recarga la página o vuelve atrás, luego presiona \"Escanear QR\" para reintentar.</li>
              </ul>
            </div>
          ) : null}

          <form onSubmit={handleManualSubmit} className="input-stack" style={{ flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Ingresar código manualmente"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              style={{ flex: '1 1 220px' }}
            />
            <button className="btn" type="submit" disabled={loading}>
              Buscar
            </button>
          </form>

          <div>
            <p className="label" style={{ marginBottom: 8 }}>Tus equipos asignados</p>
            {assignedEquipments.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>
                Aún no se te han asignado equipos. Contacta a un administrador.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {assignedEquipments.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="btn"
                    onClick={() => handleManualSelect(item.id)}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <strong style={{ marginRight: 8 }}>{item.code}</strong>
                    <span>{item.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {status ? <div style={{ color: 'var(--accent)' }}>{status}</div> : null}
          {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
        </div>
      </div>

      {loading ? <div>Cargando equipo...</div> : null}

      {selectedEquipment ? (
        <EvaluationEntry
          equipment={selectedEquipment}
          assignedEquipments={assignedEquipments}
          assignedToUser={assignedToCurrent}
          techProfile={techProfile}
          checklists={checklists}
          sessionRole="tecnico"
          templates={templates}
          showBackButton={false}
        />
      ) : (
        <div className="card">
          <p style={{ marginBottom: 12 }}>
            Escanea un código QR o selecciona un equipo para comenzar una evaluación.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--muted)' }}>
            <li>Si el QR pertenece a otro técnico se te permitirá escoger uno propio.</li>
            <li>Las evaluaciones pueden guardarse sin conexión y se enviarán al volver a estar en línea.</li>
            <li>Recuerda registrar el horómetro/odómetro antes de completar el checklist.</li>
            {(!supportsBarcode || cameraPermission === 'denied') && deeplinkUrl ? (
              <li>
                ¿Problemas con la cámara? Abre{' '}
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '2px 6px', fontSize: '0.85em' }}
                  onClick={openMobileScanner}
                >
                  este enlace en tu móvil
                </button>{' '}
                para usar la cámara del teléfono.
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <div className="back-button-row">
        <BackButton fallback="/" />
      </div>

      {showMobileHint && deeplinkUrl ? (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Escanear desde el móvil</h2>
            <p>Escanea este código con tu teléfono o abre el enlace directamente.</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img
                src={`${QR_API_BASE}?size=180x180&data=${encodeURIComponent(deeplinkUrl)}`}
                alt="QR para abrir el escáner en el móvil"
                width={180}
                height={180}
              />
            </div>
            <p className="label" style={{ wordBreak: 'break-all' }}>{deeplinkUrl}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button className="btn" type="button" onClick={() => setShowMobileHint(false)}>
                Cerrar
              </button>
              <a className="btn primary" href={deeplinkUrl} target="_blank" rel="noreferrer">
                Abrir enlace
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


