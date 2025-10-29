
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import Reading from '@/models/Reading';

export default async function Dashboard(){
  await dbConnect();
  const totalEquipos = await Equipment.countDocuments();
  const totalLecturas = await Reading.countDocuments();
  const ultimas = await Reading.find({}).sort({createdAt:-1}).limit(5).lean();

  return (
    <div className="row">
      <div className="col">
        <div className="card">
          <div className="kpi">{totalEquipos}</div>
          <div className="label">Equipos</div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="kpi">{totalLecturas}</div>
          <div className="label">Registros</div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="kpi">OK</div>
          <div className="label">Estado</div>
        </div>
      </div>

      <div className="col" style={{flexBasis:'100%'}}>
        <div className="card">
          <h3 style={{marginTop:0}}>Últimos registros</h3>
          <table className="table">
            <thead>
              <tr><th>Equipo</th><th>Tipo</th><th>Horómetro</th><th>Km</th><th>Litros</th><th>kWh</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {ultimas.map((r)=> (
                <tr key={r._id}>
                  <td>{String(r.equipmentId)}</td>
                  <td>{r.kind}</td>
                  <td>{r.hourmeter ?? '-'}</td>
                  <td>{r.odometer ?? '-'}</td>
                  <td>{r.liters ?? '-'}</td>
                  <td>{r.kwh ?? '-'}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
