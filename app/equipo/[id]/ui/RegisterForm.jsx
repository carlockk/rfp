
'use client';
import { useState } from 'react';

export default function RegisterForm({ equipmentId, fuel, adblue }){
  const [kind,setKind] = useState('uso');
  const [hourmeter,setHourmeter] = useState('');
  const [odometer,setOdometer] = useState('');
  const [liters,setLiters] = useState('');
  const [abl,setAbl] = useState('');
  const [kwh,setKwh] = useState('');
  const [note,setNote] = useState('');
  const [file,setFile] = useState(null);
  const [msg,setMsg] = useState('');

  async function uploadToCloudinary(){
    if (!file) return null;
    const b64 = await new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=reject;
      r.readAsDataURL(file);
    });
    const res = await fetch('/api/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fileBase64: b64 }) });
    const j = await res.json();
    return j.url;
  }

  async function save(){
    setMsg('Guardando...');
    let photoUrl = await uploadToCloudinary();
    const payload = {
      equipmentId, kind,
      hourmeter: hourmeter? Number(hourmeter): undefined,
      odometer: odometer? Number(odometer): undefined,
      liters: liters? Number(liters): undefined,
      adblueLiters: abl? Number(abl): undefined,
      kwh: kwh? Number(kwh): undefined,
      note, photoUrl
    };
    const res = await fetch('/api/readings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (res.ok){ setMsg('Registro guardado ✅'); setHourmeter(''); setOdometer(''); setLiters(''); setAbl(''); setKwh(''); setNote(''); setFile(null); }
    else setMsg('Error al guardar ❌');
  }

  return (
    <div className="row">
      <div className="col">
        <label className="label">Tipo de registro</label>
        <select value={kind} onChange={e=>setKind(e.target.value)}>
          <option value="uso">Inicio de uso / lectura</option>
          <option value="fin_uso">Fin de uso</option>
          <option value="combustible">Carga de combustible</option>
          {adblue ? <option value="adblue">Carga AdBlue</option>: null}
          {fuel==='electrico' ? <option value="kwh">Carga eléctrica</option> : null}
        </select>
      </div>
      <div className="col">
        <label className="label">Horómetro</label>
        <input className="input" type="number" value={hourmeter} onChange={e=>setHourmeter(e.target.value)} placeholder="ej: 1520.5"/>
      </div>
      <div className="col">
        <label className="label">Kilometraje</label>
        <input className="input" type="number" value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="ej: 102500"/>
      </div>
      <div className="col">
        <label className="label">Litros combustible</label>
        <input className="input" type="number" value={liters} onChange={e=>setLiters(e.target.value)} placeholder="si aplica"/>
      </div>
      {adblue ? (
        <div className="col">
          <label className="label">Litros AdBlue</label>
          <input className="input" type="number" value={abl} onChange={e=>setAbl(e.target.value)} placeholder="si aplica"/>
        </div>
      ): null}
      {fuel==='electrico' ? (
        <div className="col">
          <label className="label">kWh cargados</label>
          <input className="input" type="number" value={kwh} onChange={e=>setKwh(e.target.value)} placeholder="si aplica"/>
        </div>
      ): null}
      <div className="col" style={{flexBasis:'100%'}}>
        <label className="label">Observación</label>
        <textarea className="input" rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="opcional"></textarea>
      </div>
      <div className="col" style={{flexBasis:'100%'}}>
        <label className="label">Foto de comprobante (opcional)</label>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)} />
      </div>
      <div className="col" style={{flexBasis:'100%', display:'flex', gap:8}}>
        <button className="btn primary" onClick={save}>Guardar registro</button>
        <span className="label">{msg}</span>
      </div>
    </div>
  )
}
