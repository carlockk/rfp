'use client';

import { useMemo, useState } from 'react';
import SlidingPanel from '@/app/ui/SlidingPanel';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  LabelList
} from 'recharts';

const PIE_COLORS = ['#22c55e', '#0ea5e9', '#eab308', '#f97316', '#6366f1', '#ec4899'];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CL', {
    maximumFractionDigits: 1
  });
}

export default function UsageOverview({
  usageRows,
  monthLabel,
  monthlyTrend,
  dailyUsage = [],
  typeBreakdown = [],
  totalHourmeter = 0,
  hoursRatio = null
}) {
  const [open, setOpen] = useState(false);
  const hasTrend = monthlyTrend && monthlyTrend.length > 0;

  // ─────────────────────────────────────────────
  // KPIs + datos para gráfico circular
  // ─────────────────────────────────────────────
  const { monthHours, monthKm, pieData } = useMemo(() => {
    const monthHours = usageRows.reduce((acc, r) => acc + (r.hours || 0), 0);
    const monthKm = usageRows.reduce((acc, r) => acc + (r.kilometers || 0), 0);

    const totalHoursPie = typeBreakdown.reduce(
      (acc, item) => acc + (item.hours || 0),
      0
    );

    const pieData =
      totalHoursPie > 0
        ? typeBreakdown.map((item) => ({
            name: item.type || 'Sin tipo',
            value: item.hours || 0,
            percent: (100 * (item.hours || 0)) / totalHoursPie
          }))
        : [];

    return { monthHours, monthKm, pieData };
  }, [usageRows, typeBreakdown]);

  const hasEquipmentUsage = usageRows && usageRows.length > 0;

  return (
    <div className="card">
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Control de horómetros y kilometraje</h3>
          <p className="label" style={{ margin: 0 }}>
            Resumen de uso mensual ({monthLabel || 'sin periodo'})
          </p>
        </div>
        {hasTrend ? (
          <button
            className="btn secondary"
            type="button"
            onClick={() => setOpen(true)}
          >
            Ver gráfico
          </button>
        ) : null}
      </div>

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginTop: 16
        }}
      >
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Horas registradas en {monthLabel}</div>
          <div className="kpi" style={{ fontSize: 22 }}>
            {formatNumber(monthHours)} h
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="label">KM registrados en {monthLabel}</div>
          <div className="kpi" style={{ fontSize: 22 }}>
            {formatNumber(monthKm)} km
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Horómetro actual (total general)</div>
          <div className="kpi" style={{ fontSize: 22 }}>
            {formatNumber(totalHourmeter)} h
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="label">Relación Horas / KM</div>
          <div className="kpi" style={{ fontSize: 22 }}>
            {hoursRatio != null ? hoursRatio.toFixed(2) : '-'}
          </div>
        </div>
      </div>

      {/* TABLA POR EQUIPO */}
      {hasEquipmentUsage ? (
        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Tipo</th>
                <th>Horas registradas</th>
                <th>KM registrados</th>
                <th>Último horómetro</th>
                <th>Último odómetro</th>
                <th>Combustible (L)</th>
                <th>Energía (kWh)</th>
                <th>AdBlue (L)</th>
                <th>Formularios</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map((row) => (
                <tr key={row.id || row.code}>
                  <td>{row.code}</td>
                  <td>{row.type || '-'}</td>
                  <td>{formatNumber(row.hours)}</td>
                  <td>{formatNumber(row.kilometers)}</td>
                  <td>
                    {row.latestHourmeter != null
                      ? formatNumber(row.latestHourmeter)
                      : '-'}
                  </td>
                  <td>
                    {row.latestOdometer != null
                      ? formatNumber(row.latestOdometer)
                      : '-'}
                  </td>
                  <td>{formatNumber(row.fuel)}</td>
                  <td>{formatNumber(row.energy)}</td>
                  <td>{formatNumber(row.adblue)}</td>
                  <td>{row.forms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="label" style={{ marginTop: 16, color: 'var(--muted)' }}>
          Todavía no hay suficiente data mensual para resumir horómetros y
          kilometrajes.
        </p>
      )}

      {/* DISTRIBUCIÓN POR EQUIPO (barras, como Excel) */}
      {hasEquipmentUsage && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 4 }}>Distribución Horómetro Diario</h4>
          <p className="label" style={{ margin: 0, marginBottom: 8 }}>
            Total de horas por equipo en el periodo filtrado.
          </p>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart
                data={usageRows}
                margin={{ top: 10, right: 16, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="code" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${formatNumber(value)} h`}
                  labelFormatter={(label) => `Equipo: ${label}`}
                />
                <Legend />
                <Bar dataKey="hours" name="Horas" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="hours"
                    position="top"
                    formatter={(v) => v.toFixed(1)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TOTAL HORAS POR DOTACIÓN + GRÁFICO CIRCULAR */}
      {typeBreakdown.length ? (
        <div
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
            gap: 24,
            alignItems: 'center'
          }}
        >
          <div>
            <h4 style={{ marginBottom: 8 }}>Total horas por dotación</h4>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dotación / Tipo</th>
                    <th>Horas</th>
                    <th>KM</th>
                    <th>Formularios</th>
                  </tr>
                </thead>
                <tbody>
                  {typeBreakdown.map((item) => (
                    <tr key={item.type}>
                      <td>{item.type}</td>
                      <td>{formatNumber(item.hours)}</td>
                      <td>{formatNumber(item.kilometers)}</td>
                      <td>{item.forms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>
              Distribución de horas por tipo (gráfico circular)
            </h4>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  {/* AHORA ES UN CÍRCULO COMPLETO (sin innerRadius) */}
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => {
                      const percent = props.payload.percent || 0;
                      return [
                        `${formatNumber(value)} h`,
                        `${name} (${percent.toFixed(1)}%)`
                      ];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {/* PANEL LATERAL: TENDENCIA MENSUAL (línea de horas) */}
      {hasTrend ? (
        <SlidingPanel
          open={open}
          title="Tendencia de uso (últimos 6 meses)"
          onClose={() => setOpen(false)}
        >
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart
                data={monthlyTrend}
                margin={{ top: 10, right: 16, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${formatNumber(value)} h`}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="hours"
                  name="Horas"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="label" style={{ marginTop: 12 }}>
            Cada punto muestra el total mensual de horas capturado desde los
            formularios enviados por los técnicos.
          </p>
        </SlidingPanel>
      ) : null}
    </div>
  );
}
