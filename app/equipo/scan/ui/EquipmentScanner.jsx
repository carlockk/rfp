'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EvaluationEntry from '@/app/equipo/[id]/ui/EvaluationEntry';
import BackButton from '@/app/ui/BackButton';

const DEFAULT_KEY = 'default';

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
    assignedTo: equipment.assignedTo || '',
    assignedAt: equipment.assignedAt || null
  };
}

export default function EquipmentScanner({ assignedEquipments, checklistsByType, techProfile }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);

  const [supportsBarcode, setSupportsBarcode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [assignedToCurrent, setAssignedToCurrent] = useState(false);

  useEffect(() => {
    setSupportsBarcode(typeof window !== 'undefined' && 'BarcodeDetector' in window);
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setError('No se pudo leer el codigo QR. Intenta nuevamente.');
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
      setError('Tu navegador no soporta lectura de QR nativamente. Usa la entrada manual o escanea con otra app.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }
        },
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
      console.error('Error iniciando camara', err);
      setError('No se pudo acceder a la camara. Revisa los permisos del navegador.');
      stopCamera();
    }
  };

  const lookupEquipment = async (code) => {
    const cleaned = String(code || '').trim();
    if (!cleaned) {
      setError('Codigo no valido.');
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
      setStatus(`Codigo detectado: ${equipment.code}`);
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
      setError('Ingresa un codigo QR valido.');
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

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <BackButton fallback="/" />
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel del tecnico</p>
            <h1 className="page-header__title">Escanear equipo por QR</h1>
          </div>
        </div>
      </div>
      <p className="page-header__subtitle">
        Escanea el codigo de la maquina para iniciar la evaluacion, o selecciona uno de tus equipos asignados.
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
              Limpiar seleccion
            </button>
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
                  La camara aparecerá aquí cuando comiences el escaneo.
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ color: 'var(--muted)' }}>
              Tu navegador no soporta lectura de códigos QR. Utiliza la entrada manual o selecciona un equipo de la lista.
            </div>
          )}

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
          checklistsByType={checklistsByType}
          sessionRole="tecnico"
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
          </ul>
        </div>
      )}
    </div>
  );
}
