import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { AS_OF, productionOrders } from '../data/mockData';
import type { ProductionOrder, Sector } from '../data/types';
import { daysBetween, fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { inboundFor, materialById, projectStock, type Alert, type ArrivalBasis } from '../engine/risk';
import { Drawer, FilterChips, SectorTag, SeverityBadge, Stat } from '../components/ui';
import { useApp } from '../state';
import { orderSeverity } from './Overview';

type Filter = 'all' | 'risk' | 'ready' | Sector;
type Tone = 'critical' | 'high' | 'medium' | 'ok';

/** Readiness of one BOM line at the order's job start. */
function lineStatus(order: ProductionOrder, materialId: string, orderAlerts: Alert[], basis: ArrivalBasis) {
  const m = materialById.get(materialId)!;
  const after = projectStock(m, basis).find((p) => p.date === order.jobStart)?.stock ?? 0;
  const hit = orderAlerts.find((a) => a.material.id === m.id);
  const tone: Tone = hit ? (hit.severity === 'critical' ? 'critical' : hit.severity === 'high' ? 'high' : 'medium') : after < m.safetyStock ? 'medium' : 'ok';
  return { m, after, hit, tone };
}

const TONE_ICON = { ok: CheckCircle2, critical: AlertOctagon, high: AlertTriangle, medium: AlertTriangle };

export function Orders() {
  const { alerts, basis, openMaterial } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);

  const orders = [...productionOrders]
    .sort((a, b) => a.jobStart.localeCompare(b.jobStart))
    .map((o) => ({ o, s: orderSeverity(o.id, alerts) }));
  const match: Record<Filter, (x: (typeof orders)[number]) => boolean> = {
    all: () => true,
    risk: (x) => x.s.severity !== 'ok',
    ready: (x) => x.s.severity === 'ok',
    Aerospace: (x) => x.o.sector === 'Aerospace',
    Industrial: (x) => x.o.sector === 'Industrial',
  };
  const shown = orders.filter(match[filter]);
  const next = orders.find((x) => x.o.jobStart >= AS_OF);
  const selected = orders.find((x) => x.o.id === sel);

  return (
    <>
      <div className="page-head">
        <h1>Production orders</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Production orders" value={orders.length} sub={`${orders.filter(match.Aerospace).length} aerospace · ${orders.filter(match.Industrial).length} industrial`} />
        <Stat label="Ready" value={orders.filter(match.ready).length} sub="all materials covered at job start" />
        <Stat label="At risk" value={orders.filter(match.risk).length} sub={`${orders.filter((x) => x.s.severity === 'critical').length} critical`} />
        {next && <Stat label="Next job start" value={fmtDate(next.o.jobStart)} sub={`${next.o.id} · in ${daysBetween(AS_OF, next.o.jobStart)} days`} />}
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: orders.length },
            { id: 'risk', label: 'At risk', count: orders.filter(match.risk).length },
            { id: 'ready', label: 'Ready', count: orders.filter(match.ready).length },
            { id: 'Aerospace', label: 'Aerospace', count: orders.filter(match.Aerospace).length },
            { id: 'Industrial', label: 'Industrial', count: orders.filter(match.Industrial).length },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Product</th><th>Customer</th><th>Job start</th><th className="num">Qty</th><th>Materials</th><th>Readiness</th></tr>
            </thead>
            <tbody>
              {shown.map(({ o, s }) => (
                <tr key={o.id} className={`clickable ${sel === o.id ? 'selected' : ''}`} onClick={() => setSel(o.id)}>
                  <td><span className="code">{o.id}</span><div className="cell-sub">{o.status}</div></td>
                  <td>{o.product}</td>
                  <td>{o.customer} <SectorTag sector={o.sector} /></td>
                  <td className="nowrap">{fmtDate(o.jobStart, true)}<div className="cell-sub">in {daysBetween(AS_OF, o.jobStart)} days</div></td>
                  <td className="num">{fmtNum(o.qty)}</td>
                  <td>
                    <div className="ready-cells">
                      {o.requirements.map((r) => {
                        const { m, tone } = lineStatus(o, r.materialId, s.alerts, basis);
                        const Icon = TONE_ICON[tone];
                        return (
                          <span key={m.id} className={`ready-cell sev-${tone}`}>
                            <Icon size={11} aria-hidden /> {m.code}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td><SeverityBadge severity={s.severity} label={s.severity === 'ok' ? 'Ready' : undefined} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <OrderDrawer order={selected.o} orderAlerts={selected.s.alerts} severity={selected.s.severity} onClose={() => setSel(null)} openMaterial={openMaterial} />
      )}
    </>
  );
}

function OrderDrawer({ order: o, orderAlerts, severity, onClose, openMaterial }: {
  order: ProductionOrder; orderAlerts: Alert[]; severity: ReturnType<typeof orderSeverity>['severity']; onClose: () => void; openMaterial: (id: string) => void;
}) {
  const { basis, go, ask } = useApp();
  const lines = o.requirements.map((r) => ({ r, ...lineStatus(o, r.materialId, orderAlerts, basis) }));
  const atRisk = lines.filter((l) => l.tone !== 'ok');
  const materialValue = lines.reduce((s, l) => s + l.r.qty * l.m.unitCost, 0);

  return (
    <Drawer
      onClose={onClose}
      title={<><span className="code" style={{ fontSize: 15 }}>{o.id}</span> · {o.product}</>}
      subtitle={<>{o.customer} · {o.sector} · {o.status}</>}
    >
      <div className="card card-body kv">
        <div><span className="k">Job start</span><span className="v">{fmtDate(o.jobStart, true)}</span></div>
        <div><span className="k">Starts in</span><span className="v">{daysBetween(AS_OF, o.jobStart)} days</span></div>
        <div><span className="k">Quantity</span><span className="v">{fmtNum(o.qty)}</span></div>
        <div><span className="k">Material value</span><span className="v">{fmtMoney(materialValue)}</span></div>
        <div><span className="k">Readiness</span><span className="v"><SeverityBadge severity={severity} label={severity === 'ok' ? 'Ready' : undefined} /></span></div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Material readiness</h2>
            <p>{atRisk.length ? `${atRisk.length} of ${lines.length} BOM lines need attention` : `All ${lines.length} BOM lines covered at job start`}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Material</th><th className="num">Required</th><th className="num">On hand</th><th className="num">After start</th><th>Next inbound</th><th>Status</th></tr></thead>
            <tbody>
              {lines.map(({ r, m, after, hit, tone }) => {
                const next = inboundFor(m.id, basis)[0];
                return (
                  <tr key={m.id} className="clickable" onClick={() => openMaterial(m.id)}>
                    <td><span className="code">{m.code}</span><div className="cell-sub">{m.name}</div></td>
                    <td className="num">{fmtNum(r.qty)} {m.uom}</td>
                    <td className="num">{fmtNum(m.onHand)}</td>
                    <td className="num" style={after < 0 ? { color: 'var(--critical-text)', fontWeight: 600 } : after < m.safetyStock ? { color: 'var(--warning-text)' } : undefined}>{fmtNum(after)}</td>
                    <td className="nowrap small">
                      {next ? (
                        <>
                          {next.po.id}
                          <div className="cell-sub" style={tone !== 'ok' && next.arrival > o.jobStart ? { color: 'var(--serious-text)' } : undefined}>
                            {fmtDate(next.arrival)}{next.arrival > o.jobStart ? ' · after start' : ''}
                          </div>
                        </>
                      ) : '—'}
                    </td>
                    <td><SeverityBadge severity={tone === 'ok' ? 'ok' : tone} label={hit ? hit.type : tone === 'ok' ? 'Covered' : 'Low after start'} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {orderAlerts.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Alerts affecting this order</h2></div>
          <div className="alert-list">
            {orderAlerts.map((a) => (
              <button key={a.id} className="alert-row" onClick={() => go('alerts', { alertId: a.id })}>
                <span className={`sev-bar ${a.severity}`} />
                <div className="body">
                  <span className="title">{a.title}</span>
                  <span className="secondary small">{a.recommendations[0]}</span>
                  <span className="meta"><SeverityBadge severity={a.severity} /> {a.type}{a.decideBy && <> · decide by {fmtDate(a.decideBy)}</>}</span>
                </div>
                <ArrowRight size={15} style={{ color: 'var(--text-3)', alignSelf: 'center' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn" onClick={() => { ask(`Status of ${o.id}`); go('assistant'); }}><MessageSquare size={15} /> Ask about this order</button>
      </div>
    </Drawer>
  );
}
