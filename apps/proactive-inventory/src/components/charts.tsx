import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Material } from '../data/types';
import { fmtDate, fmtNum } from '../engine/dates';
import { ARRIVAL_BASIS_LABEL, demandFor, inboundFor, projectStock, type ArrivalBasis, type SupplierStats } from '../engine/risk';

const axisProps = {
  stroke: 'var(--axis)',
  tick: { fill: 'var(--text-3)', fontSize: 11 },
  tickLine: false,
} as const;

interface ProjRow { date: string; label: string; adjusted: number; planned: number; events: string[] }

export function ProjectionChart({ material, basis }: { material: Material; basis: ArrivalBasis }) {
  const adjusted = projectStock(material, basis);
  const planned = projectStock(material, 'due');
  const demand = demandFor(material.id);
  const inbound = inboundFor(material.id, basis);
  const data: ProjRow[] = adjusted.map((p, i) => ({
    date: p.date,
    label: p.label,
    adjusted: p.stock,
    planned: planned[i].stock,
    events: [
      ...inbound.filter((a) => a.arrival === p.date).map((a) => `▲ ${a.po.id} +${fmtNum(a.po.qty)}`),
      ...demand.filter((d) => d.date === p.date).map((d) => `▼ ${d.order.id} −${fmtNum(d.qty)}`),
    ],
  }));
  const showPlanned = basis !== 'due' && data.some((d) => d.planned !== d.adjusted);
  const min = Math.min(0, ...data.map((d) => Math.min(d.adjusted, d.planned)));

  return (
    <div>
      <div className="chart-legend">
        <span><i className="swatch" style={{ background: 'var(--series-1)' }} /> Projected stock ({ARRIVAL_BASIS_LABEL[basis].toLowerCase()})</span>
        {showPlanned && <span><i className="swatch dashed" /> If every PO arrives on its due date</span>}
        <span><i className="swatch" style={{ background: 'var(--warning)' }} /> Safety stock {fmtNum(material.safetyStock)}</span>
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval={13} minTickGap={20} />
            <YAxis {...axisProps} axisLine={false} width={52} domain={[min < 0 ? 'dataMin' : 0, 'auto']} tickFormatter={(v) => fmtNum(v)} />
            <ReferenceLine y={0} stroke="var(--text-3)" />
            <ReferenceLine y={material.safetyStock} stroke="var(--warning)" strokeDasharray="5 4" strokeWidth={1.5} />
            <Tooltip content={<ProjTooltip uom={material.uom} showPlanned={showPlanned} />} cursor={{ stroke: 'var(--border-strong)' }} />
            {showPlanned && (
              <Line type="stepAfter" dataKey="planned" stroke="var(--series-muted)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            )}
            <Line
              type="stepAfter"
              dataKey="adjusted"
              stroke="var(--series-1)"
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; payload?: ProjRow; index?: number }) => {
                const { cx, cy, payload, index } = props;
                if (!payload?.events.length || cx == null || cy == null) return <g key={index} />;
                const neg = payload.adjusted < 0;
                return <circle key={index} cx={cx} cy={cy} r={4.5} fill={neg ? 'var(--critical)' : 'var(--series-1)'} stroke="var(--surface)" strokeWidth={2} />;
              }}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProjTooltip({ active, payload, uom, showPlanned }: { active?: boolean; payload?: { payload: ProjRow }[]; uom: string; showPlanned: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="t-head">{fmtDate(row.date, true)}</div>
      <div className="t-row">Projected <b style={row.adjusted < 0 ? { color: 'var(--critical-text)' } : undefined}>{fmtNum(row.adjusted)} {uom}</b></div>
      {showPlanned && <div className="t-row">On due dates <b>{fmtNum(row.planned)} {uom}</b></div>}
      {row.events.map((e) => (
        <div key={e} className="small" style={{ marginTop: 2 }}>{e}</div>
      ))}
    </div>
  );
}

export function SupplierDelayChart({ stats, height = 180 }: { stats: SupplierStats; height?: number }) {
  const data = stats.history.map((h) => ({ ...h, label: fmtDate(h.dueDate) }));
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={30} />
          <YAxis {...axisProps} axisLine={false} width={36} tickFormatter={(v) => `${v}d`} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <ReferenceLine y={2} stroke="var(--good)" strokeDasharray="4 4" label={{ value: 'on-time grace', position: 'insideTopRight', fill: 'var(--text-3)', fontSize: 10 }} />
          <Tooltip
            cursor={{ fill: 'var(--surface-3)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof data)[number];
              return (
                <div className="tooltip">
                  <div className="t-head">{r.poId}</div>
                  <div className="t-row">Due <b>{fmtDate(r.dueDate, true)}</b></div>
                  <div className="t-row">Received <b>{fmtDate(r.receiptDate, true)}</b></div>
                  <div className="t-row">Delay <b>{r.delay > 0 ? `+${r.delay}` : r.delay} days</b></div>
                </div>
              );
            }}
          />
          <Bar dataKey="delay" fill="var(--series-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
