'use client';

import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  ok: 'Cumple',
  observado: 'Caso NA',
  critico: 'No cumple'
};

export default function EquipmentHistoryButton({ equipmentCode, history = [] }) {
  const [open, setOpen] = useState(false);
  const [prefersMotion, setPrefersMotion] = useState(true);

  useEffect(() => {
    setPrefersMotion(typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (!history.length) {
    return <span className="label" style={{ color: 'var(--muted)' }}>Sin registros</span>;
  }

  const handleClose = () => setOpen(false);

  return (
    <>
      <button type="button" className="btn secondary" onClick={() => setOpen(true)}>
        Ver anteriores
      </button>
      {open ? (
        <div className="modal-overlay" onClick={handleClose}>
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'hidden' }}
          >
            <h2 style={{ marginTop: 0 }}>
              Historial de {equipmentCode}
            </h2>
            <div className="table-wrapper" style={{ maxHeight: prefersMotion ? '60vh' : '70vh', overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Checklist/Formulario</th>
                    <th>Horómetro</th>
                    <th>Odómetro</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{item.completedAt ? new Date(item.completedAt).toLocaleString('es-CL') : '-'}</td>
                      <td>{STATUS_LABELS[item.status] || item.status || '-'}</td>
                      <td>{item.checklistName || '-'}</td>
                      <td>{item.hourmeterCurrent != null ? `${item.hourmeterCurrent}` : '-'}</td>
                      <td>{item.odometerCurrent != null ? `${item.odometerCurrent}` : '-'}</td>
                      <td>{item.observations || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" type="button" onClick={handleClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
