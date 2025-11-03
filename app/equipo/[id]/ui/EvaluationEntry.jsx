'use client';

import { useEffect, useMemo, useState } from 'react';
import BackButton from '../../../ui/BackButton';
import SlidingPanel from '../../../ui/SlidingPanel';
import EvaluationForm from './EvaluationForm';

const DEFAULT_KEY = 'default';

function typeKey(value) {
  return (value || '').toLowerCase() || DEFAULT_KEY;
}

export default function EvaluationEntry({
  equipment,
  assignedEquipments,
  assignedToUser,
  techProfile,
  checklistsByType,
  sessionRole
}) {
  const variant = techProfile === 'candelaria' ? 'candelaria' : 'externo';

  const equipmentMap = useMemo(() => {
    const map = { [equipment.id]: equipment };
    assignedEquipments.forEach((item) => {
      map[item.id] = { ...item };
    });
    return map;
  }, [equipment, assignedEquipments]);

  const technicianEquipments = useMemo(() => {
    const seen = new Set();
    return assignedEquipments.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [assignedEquipments]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [activeEquipmentId, setActiveEquipmentId] = useState(
    assignedToUser || sessionRole !== 'tecnico' ? equipment.id : ''
  );
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (
      sessionRole === 'tecnico' &&
      !assignedToUser &&
      technicianEquipments.length > 0 &&
      !activeEquipmentId
    ) {
      setPanelOpen(true);
    }
  }, [sessionRole, assignedToUser, technicianEquipments, activeEquipmentId]);

  const targetEquipment =
    activeEquipmentId && equipmentMap[activeEquipmentId]
      ? equipmentMap[activeEquipmentId]
      : (assignedToUser || sessionRole !== 'tecnico' ? equipment : null);

  const checklists =
    targetEquipment
      ? (checklistsByType[typeKey(targetEquipment.type)] || checklistsByType[DEFAULT_KEY] || [])
      : [];

  const canEvaluate = sessionRole === 'tecnico';

  function handleSelect(id) {
    setActiveEquipmentId(id);
    setPanelOpen(false);
    setFeedback('');
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>{equipment.code} - {equipment.type}</h3>
          <div className="label">
            {equipment.brand} {equipment.model}{equipment.plate ? ` - ${equipment.plate}` : ''}
          </div>
          <div className="label" style={{ marginTop: 4 }}>
            Perfil tecnico: {variant === 'candelaria' ? 'Tecnico Candelaria' : 'Tecnico externo'}
          </div>
        </div>
        <BackButton fallback="/" />
      </div>

      <div className="info-block" style={{ marginBottom: 16 }}>
        <p className="label">Detalle del equipo escaneado</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Combustible: {equipment.fuel || 'N/D'}{equipment.adblue ? ' + AdBlue' : ''}</li>
          <li>Asignado a ti: {assignedToUser ? 'Si' : 'No'}</li>
        </ul>
      </div>

      {sessionRole === 'tecnico' ? (
        <div style={{ marginBottom: 16 }}>
          {!assignedToUser ? (
            <div className="alert" style={{ background: 'rgba(240, 68, 56, 0.1)', padding: 12, borderRadius: 8, color: '#c62828', marginBottom: 12 }}>
              Esta maquina o equipo no esta asociada a tu usuario.
            </div>
          ) : null}
          <button className="btn" onClick={() => setPanelOpen(true)}>
            No puedo escanear la maquina
          </button>
        </div>
      ) : null}

      {feedback ? (
        <div style={{ marginBottom: 16, color: 'var(--accent)' }}>{feedback}</div>
      ) : null}

      {canEvaluate ? (
        targetEquipment ? (
          checklists.length > 0 ? (
            <EvaluationForm
              equipment={targetEquipment}
              checklists={checklists}
              variant={variant}
              onSubmitted={() => setFeedback('Evaluacion enviada. Si estabas sin conexion se sincronizara automaticamente.')}
            />
          ) : (
            <div style={{ color: 'var(--muted)' }}>
              No hay checklist disponibles para este tipo de equipo. Contacta al administrador.
            </div>
          )
        ) : technicianEquipments.length ? (
          <div style={{ color: 'var(--muted)' }}>
            Selecciona uno de tus equipos asignados para continuar con la evaluacion.
          </div>
        ) : (
          <div style={{ color: 'var(--muted)' }}>
            No tienes equipos asignados actualmente. Solicita una asignacion al administrador.
          </div>
        )
      ) : (
        <div style={{ color: 'var(--muted)' }}>
          Tu perfil no requiere completar evaluaciones en este flujo.
        </div>
      )}

      <SlidingPanel
        open={panelOpen}
        title="Mis equipos asignados"
        onClose={() => setPanelOpen(false)}
      >
        {technicianEquipments.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No tienes equipos asignados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {technicianEquipments.map((item) => (
              <button
                key={item.id}
                className="btn"
                type="button"
                onClick={() => handleSelect(item.id)}
                style={{ justifyContent: 'flex-start' }}
              >
                <strong style={{ marginRight: 8 }}>{item.code}</strong>
                <span>{item.type}</span>
              </button>
            ))}
          </div>
        )}
      </SlidingPanel>
    </div>
  );
}

