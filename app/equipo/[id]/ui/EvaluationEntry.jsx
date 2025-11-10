'use client';

import { useEffect, useMemo, useState } from 'react';
import BackButton from '../../../ui/BackButton';
import SlidingPanel from '../../../ui/SlidingPanel';
import EvaluationForm from './EvaluationForm';
import { getOperatorProfileLabel } from '@/lib/operatorProfiles';

function normalizeProfile(value) {
  const key = (value || '').toLowerCase();
  if (key === 'candelaria' || key === 'externo') return key;
  return 'externo';
}

function normalizeEquipmentAssignments(checklist) {
  const equipmentType = (checklist.equipmentType || '').toLowerCase();
  const equipmentTypes = Array.isArray(checklist.equipmentTypes)
    ? checklist.equipmentTypes.map((item) => (typeof item === 'string' ? item.toLowerCase() : '')).filter(Boolean)
    : [];
  const equipmentIds = Array.isArray(checklist.equipmentIds)
    ? checklist.equipmentIds.map((item) => (item ? item.toString() : '')).filter(Boolean)
    : [];
  const allowedProfiles = Array.isArray(checklist.allowedProfiles) && checklist.allowedProfiles.length
    ? checklist.allowedProfiles.map((item) => item.toLowerCase())
    : ['externo', 'candelaria'];
  const mandatoryProfiles = Array.isArray(checklist.mandatoryProfiles)
    ? checklist.mandatoryProfiles.map((item) => item.toLowerCase())
    : [];

  return {
    ...checklist,
    equipmentType,
    equipmentTypes,
    equipmentIds,
    allowedProfiles,
    mandatoryProfiles
  };
}

export default function EvaluationEntry({
  equipment,
  assignedEquipments,
  assignedToUser,
  techProfile,
  checklists = [],
  sessionRole,
  templates = [],
  showBackButton = true
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
    setActiveEquipmentId(assignedToUser || sessionRole !== 'tecnico' ? equipment.id : '');
    setFeedback('');
  }, [equipment.id, assignedToUser, sessionRole]);

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

  const displayEquipment = targetEquipment || equipment;
  const isAssignedDisplay =
    sessionRole !== 'tecnico'
      ? true
      : displayEquipment.id === equipment.id
        ? assignedToUser
        : true;

  const profileKey = normalizeProfile(techProfile);

  const filteredChecklists = useMemo(() => {
    if (!targetEquipment) return [];
    const equipmentId = targetEquipment.id;
    const equipmentType = (targetEquipment.type || '').toLowerCase();

    return checklists
      .map(normalizeEquipmentAssignments)
      .filter((checklist) => {
        if (checklist.isActive === false) return false;

        const matchesEquipmentId = checklist.equipmentIds.length
          ? checklist.equipmentIds.includes(equipmentId)
          : false;
        const possibleTypes = checklist.equipmentTypes.length
          ? checklist.equipmentTypes
          : checklist.equipmentType
            ? [checklist.equipmentType]
            : [];
        const matchesType = possibleTypes.length
          ? possibleTypes.includes(equipmentType)
          : true;
        const matchesEquipment = checklist.equipmentIds.length ? matchesEquipmentId : matchesType;

        const profileAllowed = checklist.allowedProfiles.includes(profileKey);
        return matchesEquipment && profileAllowed;
      })
      .map((checklist) => ({
        ...checklist,
        isMandatory: checklist.mandatoryProfiles.includes(profileKey)
      }));
  }, [checklists, profileKey, targetEquipment]);

  const hasMandatoryChecklist = filteredChecklists.some((item) => item.isMandatory);
  const allowChecklistSkip = filteredChecklists.length === 0 || !hasMandatoryChecklist;

  const canEvaluate = sessionRole === 'tecnico';

  function handleSelect(id) {
    setActiveEquipmentId(id);
    setPanelOpen(false);
    setFeedback('');
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{displayEquipment.code} - {displayEquipment.type}</h3>
        <div className="label">
          {displayEquipment.brand} {displayEquipment.model}{displayEquipment.plate ? ` - ${displayEquipment.plate}` : ''}
        </div>
        <div className="label" style={{ marginTop: 4 }}>
          Perfil del operador: {getOperatorProfileLabel(variant)}
        </div>
      </div>

      <div className="info-block" style={{ marginBottom: 16 }}>
        <p className="label">Detalle del equipo escaneado</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Combustible: {displayEquipment.fuel || 'N/D'}{displayEquipment.adblue ? ' + AdBlue' : ''}</li>
          <li>Asignado a ti: {isAssignedDisplay ? 'Sí' : 'No'}</li>
        </ul>
      </div>

      {sessionRole === 'tecnico' ? (
        <div style={{ marginBottom: 16 }}>
          {displayEquipment.id === equipment.id && !assignedToUser ? (
            <div className="alert" style={{ background: 'rgba(240, 68, 56, 0.1)', padding: 12, borderRadius: 8, color: '#c62828', marginBottom: 12 }}>
              Esta máquina o equipo no está asociada a tu usuario.
            </div>
          ) : null}
          <button className="btn" onClick={() => setPanelOpen(true)}>
            No puedo escanear la máquina
          </button>
        </div>
      ) : null}

      {feedback ? (
        <div style={{ marginBottom: 16, color: 'var(--accent)' }}>{feedback}</div>
      ) : null}

      {canEvaluate ? (
        targetEquipment ? (
          <EvaluationForm
            equipment={targetEquipment}
            checklists={filteredChecklists}
            variant={variant}
            templates={templates}
            techProfile={techProfile}
            checklistSkipAllowed={allowChecklistSkip}
            onSubmitted={() => setFeedback('Evaluación enviada. Si estabas sin conexión se sincronizará automáticamente.')}
          />
        ) : technicianEquipments.length ? (
          <div style={{ color: 'var(--muted)' }}>
            Selecciona uno de tus equipos asignados para continuar con la evaluación.
          </div>
        ) : (
          <div style={{ color: 'var(--muted)' }}>
            No tienes equipos asignados actualmente. Solicita una asignación al administrador.
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

      {showBackButton ? (
        <div className="back-button-row">
          <BackButton fallback="/" />
        </div>
      ) : null}
    </div>
  );
}

