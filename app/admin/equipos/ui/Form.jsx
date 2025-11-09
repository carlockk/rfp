'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import EquipmentFormPanel from './EquipmentFormPanel';

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

export default function Form({ data }) {
  const router = useRouter();
  const [form, setForm] = useState(() => {
    if (!data) return EMPTY_EQUIPMENT;
    const normalizedOperators = Array.isArray(data.operators)
      ? data.operators
          .map((op) => {
            if (typeof op === 'string') return op;
            if (op?.user?._id) return op.user._id.toString();
            if (op?.user) return op.user.toString();
            return '';
          })
          .filter(Boolean)
      : [];
    return {
      ...EMPTY_EQUIPMENT,
      ...data,
      hourmeterBase: data.hourmeterBase ?? '',
      odometerBase: data.odometerBase ?? '',
      operators: normalizedOperators
    };
  });
  const [types, setTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const isEdit = useMemo(() => Boolean(data?._id), [data]);

  useEffect(() => {
    fetchTypes();
    fetchTechnicians();
  }, []);

  async function fetchTypes() {
    try {
      const res = await fetch('/api/equipment-types', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      setTypes(payload);
      setForm((prev) => {
        if (prev.type) return prev;
        if (payload.length === 0) return prev;
        return { ...prev, type: payload[0].name };
      });
    } catch (err) {
      setFeedback(err.message || 'No se pudieron cargar los tipos');
    }
  }

  async function fetchTechnicians() {
    try {
      const res = await fetch('/api/users?role=tecnico', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      setTechnicians(payload);
    } catch (err) {
      setFeedback(err.message || 'No se pudieron cargar los operadores');
    }
  }

  async function handleAddType(name) {
    const res = await fetch('/api/equipment-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(await res.text());
    const created = await res.json();
    setTypes((prev) => {
      const exists = prev.some((t) => t.name.toLowerCase() === created.name.toLowerCase());
      if (exists) return prev;
      return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
    });
    return created;
  }

  async function save() {
    setLoading(true);
    setFeedback('');
    try {
      const payload = {
        ...form,
        hourmeterBase: form.hourmeterBase ? Number(form.hourmeterBase) : 0,
        odometerBase: form.odometerBase ? Number(form.odometerBase) : 0,
        operators: Array.isArray(form.operators)
          ? form.operators.filter((id) => typeof id === 'string' && id)
          : []
      };
      const res = await fetch(isEdit ? `/api/equipments/${data._id}` : '/api/equipments', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      router.push('/admin/equipos');
    } catch (err) {
      setFeedback(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{isEdit ? 'Editar equipo' : 'Nuevo equipo'}</h3>
      {feedback ? <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{feedback}</div> : null}
      <EquipmentFormPanel
        value={form}
        onChange={setForm}
        types={types}
        onAddType={handleAddType}
        busy={loading}
        technicians={technicians}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={() => router.back()} disabled={loading}>Cancelar</button>
        <button className="btn primary" onClick={save} disabled={loading || !form.code || !form.type}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
