'use client';

import { useMemo, useState } from 'react';
import { getOperatorProfileLabel } from '@/lib/operatorProfiles';
import { SAFE_TEXT_PATTERN } from '@/lib/validation';

const resolveOperatorLabel = (technician) => {
  if (!technician) return '';
  const profileLabel = getOperatorProfileLabel(technician.techProfile);
  if (technician.name) {
    return `${technician.name} (${technician.email}) ${profileLabel ? `- ${profileLabel}` : ''}`;
  }
  return `${technician.email}${profileLabel ? ` - ${profileLabel}` : ''}`;
};

export default function EquipmentFormPanel({ value, onChange, types, onAddType, busy, technicians = [] }) {
  const [showTypeCreator, setShowTypeCreator] = useState(false);
  const [newType, setNewType] = useState('');
  const [typeError, setTypeError] = useState('');

  const selectedTechnicians = useMemo(
    () =>
      (value.operators || [])
        .map((id) => technicians.find((tech) => tech.id === id))
        .filter(Boolean),
    [value.operators, technicians]
  );

  async function handleAddType() {
    if (!newType.trim()) {
      setTypeError('Ingresa un nombre');
      return;
    }
    try {
      const created = await onAddType(newType.trim());
      if (created) {
        onChange({ ...value, type: created.name });
        setNewType('');
        setShowTypeCreator(false);
        setTypeError('');
      }
    } catch (err) {
      setTypeError(err.message || 'No se pudo crear el tipo');
    }
  }

  const toggleOperator = (operatorId) => {
    const current = Array.isArray(value.operators) ? value.operators : [];
    const exists = current.includes(operatorId);
    const next = exists ? current.filter((id) => id !== operatorId) : [...current, operatorId];
    onChange({ ...value, operators: next });
  };

  return (
    <div className="form-grid">
      <div className="form-field">
        <label className="label" htmlFor="code">Código</label>
        <input
          id="code"
          className="input"
          value={value.code}
          onChange={(event) => onChange({ ...value, code: event.target.value })}
          placeholder="Código o identificador"
          required
          maxLength={40}
          pattern={SAFE_TEXT_PATTERN}
          title="Solo letras, numeros y puntuacion basica"
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="type">Tipo</label>
        <div className="input-stack">
          <select
            id="type"
            className="input"
            value={value.type}
            onChange={(event) => onChange({ ...value, type: event.target.value })}
          >
            <option value="">Selecciona tipo</option>
            {types.map((type) => (
              <option key={type._id || type.name} value={type.name}>
                {type.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShowTypeCreator((prev) => !prev);
              setTypeError('');
            }}
          >
            {showTypeCreator ? 'Cerrar' : 'Nuevo tipo'}
          </button>
        </div>
        {showTypeCreator ? (
          <div className="input-stack" style={{ marginTop: 8 }}>
            <input
              className="input"
              value={newType}
              onChange={(event) => {
                setNewType(event.target.value);
                setTypeError('');
              }}
              placeholder="Ej: Grúa horquilla"
            />
            <button type="button" className="btn primary" onClick={handleAddType} disabled={busy}>
              Agregar
            </button>
          </div>
        ) : null}
        {typeError ? <span className="input-hint error">{typeError}</span> : null}
      </div>
      <div className="form-field">
        <label className="label" htmlFor="fuel">Combustible</label>
        <select
          id="fuel"
          className="input"
          value={value.fuel}
          onChange={(event) => onChange({ ...value, fuel: event.target.value })}
        >
          <option value="diesel">Diésel</option>
          <option value="bencina">Bencina</option>
          <option value="electrico">Eléctrico</option>
        </select>
      </div>
      <div className="form-field">
        <label className="label" htmlFor="adblue">AdBlue</label>
        <select
          id="adblue"
          className="input"
          value={value.adblue ? '1' : '0'}
          onChange={(event) => onChange({ ...value, adblue: event.target.value === '1' })}
        >
          <option value="0">No</option>
          <option value="1">Sí</option>
        </select>
      </div>
      <div className="form-field">
        <label className="label" htmlFor="brand">Marca</label>
        <input
          id="brand"
          className="input"
          value={value.brand}
          onChange={(event) => onChange({ ...value, brand: event.target.value })}
          maxLength={60}
          pattern={SAFE_TEXT_PATTERN}
          title="Solo letras, numeros y puntuacion basica"
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="model">Modelo</label>
        <input
          id="model"
          className="input"
          value={value.model}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
          maxLength={60}
          pattern={SAFE_TEXT_PATTERN}
          title="Solo letras, numeros y puntuacion basica"
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="plate">Patente / ID</label>
        <input
          id="plate"
          className="input"
          value={value.plate}
          onChange={(event) => onChange({ ...value, plate: event.target.value })}
          maxLength={30}
          pattern={SAFE_TEXT_PATTERN}
          title="Solo letras, numeros y puntuacion basica"
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="hourmeterBase">Horómetro base</label>
        <input
          id="hourmeterBase"
          className="input"
          type="number"
          value={value.hourmeterBase}
          onChange={(event) => onChange({ ...value, hourmeterBase: event.target.value })}
          min="0"
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="odometerBase">Kilometraje base</label>
        <input
          id="odometerBase"
          className="input"
          type="number"
          value={value.odometerBase}
          onChange={(event) => onChange({ ...value, odometerBase: event.target.value })}
          min="0"
        />
      </div>
      <div className="form-field form-field--full">
        <label className="label" htmlFor="notes">Notas</label>
        <textarea
          id="notes"
          className="input"
          rows={3}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          maxLength={280}
          title="Solo letras, numeros y puntuacion basica"
        />
      </div>
      <div className="form-field form-field--full">
        <label className="label">Operadores asignados</label>
        <textarea
          className="input input--chips"
          rows={Math.max(2, selectedTechnicians.length || 1)}
          readOnly
          value={
            selectedTechnicians.length
              ? selectedTechnicians.map(resolveOperatorLabel).join('\n')
              : 'Sin operadores asignados'
          }
        />
        <div className="operator-grid">
          {technicians.length === 0 ? (
            <span className="label">No hay operadores disponibles.</span>
          ) : (
            technicians.map((tech) => (
              <label key={tech.id} className="input-choice">
                <input
                  type="checkbox"
                  checked={Array.isArray(value.operators) ? value.operators.includes(tech.id) : false}
                  onChange={() => toggleOperator(tech.id)}
                />
                {resolveOperatorLabel(tech)}
              </label>
            ))
          )}
        </div>
        <span className="input-hint">Puedes asignar múltiples operadores a un mismo equipo.</span>
      </div>
    </div>
  );
}
