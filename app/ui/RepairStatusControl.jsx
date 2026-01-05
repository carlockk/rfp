'use client';

import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'desviacion', label: 'Desviacion' },
  { value: 'en_reparacion', label: 'En reparacion' },
  { value: 'reparado', label: 'Reparado' }
];

export default function RepairStatusControl({ evaluationId, initialStatus }) {
  const [status, setStatus] = useState(initialStatus || 'desviacion');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async (event) => {
    const next = event.target.value;
    const previous = status;
    setStatus(next);
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/repair`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err) {
      setStatus(previous);
      setError(err.message || 'Error actualizando estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        className="input"
        value={status}
        onChange={handleChange}
        disabled={saving}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="label" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
