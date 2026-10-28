import { AlertOctagon, ArrowRight, Boxes, CalendarClock, Mail, PackageX, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { AS_OF, productionOrders, purchaseOrders, supplierEmails } from '../data/mockData';
import { addDays, daysBetween, fmtDate, fmtMoney } from '../engine/dates';
import { computeAlerts, estimateArrival, materialById, obsolescenceItems, supplierById, supplierStats, SEVERITY_RANK, type Alert, type Severity } from '../engine/risk';
import { Card, SectorTag, SeverityBadge, Stat } from '../components/ui';
import { useApp } from '../state';

export function orderSeverity(orderId: string, alerts: Alert[]): { severity: Severity | 'ok'; alerts: Alert[] } {
  const hits = alerts.filter((a) => a.type !== 'End of life' && a.affectedOrders.some((o) => o.order.id === orderId));
  if (!hits.length) return { severity: 'ok', alerts: [] };
  return { severity: hits.reduce((s, a) => (SEVERITY_RANK[a.severity] < SEVERITY_RANK[s] ? a.severity : s), 'low' as Severity), alerts: hits };
}

export function Overview() {
  const { alerts, basis, go, alertState, openMaterial } = useApp();
  const in30 = addDays(AS_OF, 30);
  const upcoming = productionOrders.filter((o) => o.jobStart >= AS_OF).sort((a, b) => a.jobStart.localeCompare(b.jobStart));
  const atRisk30 = upcoming.filter((o) => o.jobStart <= in30 && orderSeverity(o.id, alerts).severity !== 'ok');
  const flaggedMaterials = new Set(alerts.map((a) => a.material.id));
  const late = purchaseOrders.map((p) => estimateArrival(p, basis === 'due' ? 'p50' : basis)).filter((a) => a.slipDays > 0);
  const obs = obsolescenceItems().filter((o) => o.kind !== 'End of life');
  const obsValue = obs.reduce((s, o) => s + o.valueAtRisk, 0);
  const stats = [...supplierStats.values()].filter(Boolean);
  const onTime = stats.reduce((s, x) => s + x!.onTimeRate * x!.count, 0) / stats.reduce((s, x) => s + x!.count, 0);
  const open = alerts.filter((a) => (alertState[a.id]?.status ?? 'new') !== 'resolved');
  const critical = open.filter((a) => a.severity === 'critical').length;
  // What the ERP alone would show: every PO on its due date, no supplier signals.
  const countShortOrders = (list: Alert[]) =>
    new Set(list.filter((a) => a.type === 'Shortage' || a.type === 'Supplier delay').flatMap((a) => a.affectedOrders.map((o) => o.order.id))).size;
  const erpOnly = countShortOrders(computeAlerts('due'));
  const withAi = countShortOrders(alerts);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Material risk overview</h1>
          <p>Production plan, stock and open purchase orders in one view — with risks flagged before they turn into shortages. As of {fmtDate(AS_OF, true)}.</p>
        </div>
        <button className="btn primary" onClick={() => go('assistant')}>Ask KingslakeAI <ArrowRight size={15} /></button>
      </div>

      <div className="banner">
        <ShieldCheck size={18} style={{ color: 'var(--accent)', flex: 'none' }} />
        <span><b>Decision support, not autopilot.</b> KingslakeAI reads ERP data and supplier emails, surfaces risks and options, and drafts follow-ups. It never places purchase orders or changes the production schedule.</span>
      </div>

      <div className="grid kpis">
        <Stat label="Orders at risk · next 30 days" icon={CalendarClock} value={atRisk30.length} sub={`of ${upcoming.filter((o) => o.jobStart <= in30).length} orders starting by ${fmtDate(in30)}`} onClick={() => go('orders')} />
        <Stat label="Open alerts" icon={AlertOctagon} tone="var(--critical)" value={open.length} sub={`${critical} critical · ${flaggedMaterials.size} materials`} onClick={() => go('alerts')} />
        <Stat label="POs expected late" icon={Truck} value={late.length} sub={`of ${purchaseOrders.length} open POs · ${late.filter((l) => l.source === 'Supplier email').length} confirmed by supplier`} onClick={() => go('suppliers')} />
        <Stat label="Stock at risk of write-off" icon={PackageX} value={fmtMoney(obsValue)} sub={`${obs.length} items · expiry & excess`} onClick={() => go('obsolescence')} />
        <Stat label="Supplier on-time rate" icon={Boxes} value={`${Math.round(onTime * 100)}%`} sub="PO due vs goods receipt, ±2 days" onClick={() => go('suppliers')} />
      </div>

      {basis !== 'due' && withAi > erpOnly && (
        <div className="banner" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Sparkles size={18} style={{ color: 'var(--accent)', flex: 'none' }} />
          <span>
            Planning on PO due dates alone, the ERP shows <b>{erpOnly}</b> production order{erpOnly === 1 ? '' : 's'} short of material.
            Adding supplier emails and delivery history, KingslakeAI expects <b>{withAi}</b> — flagged weeks before the jobs start.
          </span>
        </div>
      )}

      <div className="grid two">
        <Card title="Needs attention" subtitle="Ordered by severity, then by the date a decision is needed" actions={<button className="btn ghost" onClick={() => go('alerts')}>All alerts <ArrowRight size={14} /></button>} flush>
          <div className="alert-list">
            {open.slice(0, 6).map((a) => (
              <button key={a.id} className="alert-row" onClick={() => go('alerts', { alertId: a.id })}>
                <span className={`sev-bar ${a.severity}`} />
                <div className="body">
                  <span className="title">{a.title}</span>
                  <span className="secondary small">{a.summary}</span>
                  <span className="meta">
                    <SeverityBadge severity={a.severity} />
                    <span>{a.type}</span>
                    {a.decideBy && <span>· decide by {fmtDate(a.decideBy)}</span>}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Upcoming production — material readiness" subtitle="Next jobs by start date" actions={<button className="btn ghost" onClick={() => go('orders')}>All orders <ArrowRight size={14} /></button>} flush>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Start</th><th>Customer</th><th>Status</th></tr></thead>
              <tbody>
                {upcoming.slice(0, 7).map((o) => {
                  const s = orderSeverity(o.id, alerts);
                  return (
                    <tr key={o.id} className="clickable" onClick={() => go('orders')}>
                      <td><span className="code">{o.id}</span><div className="small muted">{o.product}</div></td>
                      <td className="nowrap">{fmtDate(o.jobStart)}<div className="small muted">in {daysBetween(AS_OF, o.jobStart)} d</div></td>
                      <td>{o.customer} <SectorTag sector={o.sector} /></td>
                      <td>
                        <SeverityBadge severity={s.severity} label={s.severity === 'ok' ? 'Ready' : undefined} />
                        {s.alerts.length > 0 && <div className="small muted" style={{ marginTop: 2 }}>{[...new Set(s.alerts.map((a) => a.material.code))].join(', ')}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid two">
        <Card title="Signals from supplier emails" subtitle="Unstructured correspondence turned into structured updates" actions={<button className="btn ghost" onClick={() => go('inbox')}>Inbox <ArrowRight size={14} /></button>} flush>
          <div className="alert-list">
            {supplierEmails.slice(0, 4).map((e) => (
              <div key={e.id} className="alert-row" style={{ cursor: 'default' }}>
                <Mail size={16} style={{ color: 'var(--accent)', marginTop: 2, flex: 'none' }} />
                <div className="body">
                  <span className="title">{e.extracted.summary}</span>
                  <span className="meta">
                    <span className="tag">{e.extracted.type}</span>
                    {supplierById.get(e.supplierId)!.name} · {fmtDate(e.received)} · {Math.round(e.extracted.confidence * 100)}% confidence
                    {e.extracted.materialId && (
                      <button className="btn ghost small" style={{ padding: '0 4px' }} onClick={() => openMaterial(e.extracted.materialId!)}>
                        <span className="code">{materialById.get(e.extracted.materialId)!.code}</span>
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Obsolete & excess stock" subtitle="Illustrative business case from the scope document">
          <div className="kv" style={{ marginBottom: 16 }}>
            <div><span className="k">Historic cost</span><span className="v">≈ $100k / yr</span></div>
            <div><span className="k">Target</span><span className="v">≈ $50k / yr</span></div>
            <div><span className="k">Flagged now</span><span className="v">{fmtMoney(obsValue)}</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {obs.map((o) => (
              <button key={o.material.id + o.kind} className="alt" style={{ textAlign: 'left', cursor: 'pointer', background: 'transparent' }} onClick={() => openMaterial(o.material.id)}>
                <div className="alt-head">
                  <span className="code">{o.material.code}</span>
                  <span className="tag">{o.kind}</span>
                  <span className="muted small" style={{ marginLeft: 'auto' }}>{fmtMoney(o.valueAtRisk)}</span>
                </div>
                <div className="small secondary">{o.detail}</div>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>How much historic cost is addressable by earlier visibility is to be validated during the pilot.</p>
        </Card>
      </div>
    </>
  );
}
