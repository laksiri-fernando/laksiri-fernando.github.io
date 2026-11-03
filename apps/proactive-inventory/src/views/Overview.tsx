import { AlertOctagon, ArrowRight, Boxes, CalendarClock, Mail, PackageX, Truck, TrendingDown, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AS_OF, productionOrders, purchaseOrders } from '../data/mockData';
import { addDays, fmtDate, fmtMoney } from '../engine/dates';
import {
  computeAlerts, estimateArrival, lateBasis, obsolescenceItems, supplierById, supplierStats, SEVERITY_RANK,
  type Alert, type Severity,
} from '../engine/risk';
import { Meter, scoreColor, SeverityBadge } from '../components/ui';
import { useApp, type View } from '../state';

export function orderSeverity(orderId: string, alerts: Alert[]): { severity: Severity | 'ok'; alerts: Alert[] } {
  const hits = alerts.filter((a) => a.type !== 'End of life' && a.affectedOrders.some((o) => o.order.id === orderId));
  if (!hits.length) return { severity: 'ok', alerts: [] };
  return { severity: hits.reduce((s, a) => (SEVERITY_RANK[a.severity] < SEVERITY_RANK[s] ? a.severity : s), 'low' as Severity), alerts: hits };
}

function KpiCard({ icon: Icon, label, value, caption, children, footer, to, wide }: {
  icon: LucideIcon; label: string; value: ReactNode; caption: ReactNode; children: ReactNode; footer: string; to: View; wide?: boolean;
}) {
  const { go } = useApp();
  return (
    <button className={`card kpi-card ${wide ? 'wide' : ''}`} onClick={() => go(to)}>
      <div className="kpi-top">
        <span className="kpi-icon"><Icon size={18} aria-hidden /></span>
        <span className="kpi-label">{label}</span>
      </div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-caption">{caption}</div>
      </div>
      <div className="kpi-detail">{children}</div>
      <span className="kpi-footer">{footer} <ArrowRight size={14} aria-hidden /></span>
    </button>
  );
}

const SEV_BAR: { key: Severity; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: 'var(--critical)' },
  { key: 'high', label: 'High', color: 'var(--serious)' },
  { key: 'medium', label: 'Medium', color: 'var(--warning)' },
];

export function Overview() {
  const { alerts, basis, alertState } = useApp();

  // Orders at risk in the next 30 days, on the selected basis and on PO due dates alone.
  const in30 = addDays(AS_OF, 30);
  const window30 = productionOrders.filter((o) => o.jobStart >= AS_OF && o.jobStart <= in30).sort((a, b) => a.jobStart.localeCompare(b.jobStart));
  const atRisk = window30.map((o) => ({ o, s: orderSeverity(o.id, alerts) })).filter((x) => x.s.severity !== 'ok');
  const dueAlerts = computeAlerts('due');
  const atRiskOnDue = window30.filter((o) => orderSeverity(o.id, dueAlerts).severity !== 'ok').length;

  const open = alerts.filter((a) => (alertState[a.id]?.status ?? 'new') !== 'resolved');
  const materialsFlagged = new Set(open.map((a) => a.material.id)).size;
  const nextDecision = [...open].filter((a) => a.decideBy).sort((a, b) => a.decideBy!.localeCompare(b.decideBy!))[0];

  const late = purchaseOrders
    .map((p) => estimateArrival(p, lateBasis(basis)))
    .filter((a) => a.slipDays > 0)
    .sort((a, b) => b.slipDays - a.slipDays);
  const confirmed = late.filter((l) => l.source === 'Supplier email').length;

  const obs = obsolescenceItems();
  const expiry = obs.filter((o) => o.kind === 'Expiry');
  const excess = obs.filter((o) => o.kind === 'Excess stock');
  const eol = obs.filter((o) => o.kind === 'End of life');
  const sum = (xs: typeof obs) => xs.reduce((s, o) => s + o.valueAtRisk, 0);
  const writeOff = sum(expiry) + sum(excess);

  const ranked = [...supplierStats.values()].filter((s) => s !== null).sort((a, b) => a!.score - b!.score);
  const onTime = ranked.reduce((s, x) => s + x!.onTimeRate * x!.count, 0) / ranked.reduce((s, x) => s + x!.count, 0);
  const worsening = ranked.filter((s) => s!.trend === 'worsening').length;

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={CalendarClock}
          label="Orders at risk · next 30 days"
          value={atRisk.length}
          caption={`of ${window30.length} production orders starting by ${fmtDate(in30)}`}
          footer="View production orders"
          to="orders"
        >
          {basis !== 'due' ? (
            <div className="kpi-note">
              {atRisk.length > atRiskOnDue
                ? <>PO due dates alone show <b>{atRiskOnDue}</b> — <b>{atRisk.length - atRiskOnDue}</b> more flagged from supplier signals</>
                : <>Same as planning on PO due dates</>}
            </div>
          ) : (
            <div className="kpi-note">Planning on PO due dates only — switch to “Typical delay” to include supplier signals</div>
          )}
          <ul className="kpi-list">
            {atRisk.slice(0, 3).map(({ o, s }) => (
              <li key={o.id}>
                <span><span className="code">{o.id}</span> <span className="muted">· {fmtDate(o.jobStart)}</span></span>
                <SeverityBadge severity={s.severity} />
              </li>
            ))}
          </ul>
        </KpiCard>

        <KpiCard
          icon={AlertOctagon}
          label="Open alerts"
          value={open.length}
          caption={`across ${materialsFlagged} materials`}
          footer="View risk alerts"
          to="alerts"
        >
          <div className="sevbar" role="img" aria-label={SEV_BAR.map((b) => `${open.filter((a) => a.severity === b.key).length} ${b.label}`).join(', ')}>
            {SEV_BAR.map((b) => {
              const n = open.filter((a) => a.severity === b.key).length;
              return n ? <span key={b.key} style={{ flex: n, background: b.color }} /> : null;
            })}
          </div>
          <div className="sev-legend">
            {SEV_BAR.map((b) => (
              <span key={b.key}><i style={{ background: b.color }} /> {open.filter((a) => a.severity === b.key).length} {b.label.toLowerCase()}</span>
            ))}
          </div>
          {nextDecision && (
            <div className="kpi-note">Next decision by <b>{fmtDate(nextDecision.decideBy!)}</b>: {nextDecision.material.code} {nextDecision.type.toLowerCase()}</div>
          )}
        </KpiCard>

        <KpiCard
          icon={Truck}
          label="POs expected late"
          value={late.length}
          caption={`of ${purchaseOrders.length} open purchase orders`}
          footer="View purchase orders"
          to="pos"
        >
          <ul className="kpi-list">
            {late.slice(0, 3).map((a) => (
              <li key={a.po.id}>
                <span>
                  <span className="code">{a.po.id}</span> <span className="muted">· {supplierById.get(a.po.supplierId)!.name}</span>
                  {a.source === 'Supplier email' && <Mail size={12} aria-label="confirmed by supplier email" style={{ marginLeft: 4, verticalAlign: -1, color: 'var(--accent)' }} />}
                </span>
                <span className="badge sev-high">+{a.slipDays} d</span>
              </li>
            ))}
          </ul>
          <div className="kpi-note">{confirmed} confirmed by supplier email · {late.length - confirmed} estimated from delivery history</div>
        </KpiCard>

        <KpiCard
          icon={PackageX}
          label="Stock at risk of write-off"
          value={fmtMoney(writeOff)}
          caption="expiring or slow-moving stock with no planned use"
          footer="View obsolescence"
          to="obsolescence"
          wide
        >
          <ul className="kpi-list">
            <li><span>Shelf-life expiry <span className="muted">· {expiry.length} lot{expiry.length === 1 ? '' : 's'}</span></span><b className="tnum">{fmtMoney(sum(expiry))}</b></li>
            <li><span>Excess / slow-moving <span className="muted">· {excess.length} item{excess.length === 1 ? '' : 's'}</span></span><b className="tnum">{fmtMoney(sum(excess))}</b></li>
            {eol.map((e) => (
              <li key={e.material.id}><span>Last-time-buy decision <span className="muted">· {e.material.code} by {fmtDate(e.date!)}</span></span><b className="tnum">{fmtMoney(e.valueAtRisk)}</b></li>
            ))}
          </ul>
          <div className="kpi-note">Historic obsolete &amp; excess cost ≈ $100k / year — target ≈ $50k</div>
        </KpiCard>

        <KpiCard
          icon={Boxes}
          label="Supplier on-time rate"
          value={`${Math.round(onTime * 100)}%`}
          caption="PO due date vs goods receipt, within ±2 days"
          footer="View supplier reliability"
          to="suppliers"
          wide
        >
          <ul className="kpi-list">
            {ranked.slice(0, 3).map((st) => (
              <li key={st!.supplierId}>
                <span>{supplierById.get(st!.supplierId)!.name}</span>
                <span className="kpi-score">
                  {st!.trend === 'worsening' && <TrendingDown size={13} aria-label="worsening" style={{ color: 'var(--serious-text)' }} />}
                  <span style={{ width: 70 }}><Meter value={st!.score} color={scoreColor(st!.score)} /></span>
                  <b className="tnum">{st!.score}</b>
                </span>
              </li>
            ))}
          </ul>
          <div className="kpi-note">Lowest reliability scores shown · {worsening} supplier{worsening === 1 ? '' : 's'} getting worse</div>
        </KpiCard>
      </div>
    </>
  );
}
