'use client';

import { useState } from 'react';

export default function EquipmentFormPanel({ value, onChange, types, onAddType, busy }) {
  const [showTypeCreator, setShowTypeCreator] = useState(false);
  const [newType, setNewType] = useState('');
  const [typeError, setTypeError] = useState('');

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
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="model">Modelo</label>
        <input
          id="model"
          className="input"
          value={value.model}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
        />
      </div>
      <div className="form-field">
        <label className="label" htmlFor="plate">Patente / ID</label>
        <input
          id="plate"
          className="input"
          value={value.plate}
          onChange={(event) => onChange({ ...value, plate: event.target.value })}
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
        />
      </div>
    </div>
  );
}
