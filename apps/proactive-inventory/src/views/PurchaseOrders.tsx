import { Mail } from 'lucide-react';
import { useState } from 'react';
import { productionOrders, purchaseOrders } from '../data/mockData';
import { fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { ARRIVAL_BASIS_LABEL, estimateArrival, lateBasis, materialById, supplierById, supplierStats } from '../engine/risk';
import { Meter, scoreColor, Stat } from '../components/ui';
import { useApp } from '../state';

type Filter = 'all' | 'late' | 'ontime';

export function PurchaseOrders() {
  const { basis, alerts, openMaterial, go } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const lb = lateBasis(basis);

  const rows = purchaseOrders
    .map((po) => {
      const est = estimateArrival(po, lb);
      const m = materialById.get(po.materialId)!;
      // Jobs that were planned around this PO but now start before it is expected.
      const jobsAtRisk = est.slipDays > 0
        ? productionOrders.filter((o) => o.jobStart >= po.dueDate && o.jobStart < est.arrival && o.requirements.some((r) => r.materialId === po.materialId))
        : [];
      const alert = alerts.find((a) => a.material.id === m.id && (a.type === 'Shortage' || a.type === 'Supplier delay'));
      return { po, est, m, jobsAtRisk, alert };
    })
    .sort((a, b) => b.est.slipDays - a.est.slipDays || a.po.dueDate.localeCompare(b.po.dueDate));
  const late = rows.filter((r) => r.est.slipDays > 0);
  const shown = filter === 'late' ? late : filter === 'ontime' ? rows.filter((r) => r.est.slipDays <= 0) : rows;
  const onOrderValue = rows.reduce((s, r) => s + r.po.qty * r.m.unitCost, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Purchase orders</h1>
          <p>
            Open POs with their expected arrival — from supplier emails where the supplier has given a date, otherwise from each supplier's delivery history.
            Estimates use: <b>{ARRIVAL_BASIS_LABEL[lb]}</b>{basis === 'due' && ' (lateness is still estimated here while planning on PO due dates)'}.
          </p>
        </div>
      </div>

      <div className="grid kpis">
        <Stat label="Open POs" value={rows.length} sub={`${fmtMoney(onOrderValue)} on order`} />
        <Stat label="Expected late" value={late.length} sub={`average slip ${late.length ? Math.round(late.reduce((s, r) => s + r.est.slipDays, 0) / late.length) : 0} days`} />
        <Stat label="Confirmed by supplier" value={late.filter((r) => r.est.source === 'Supplier email').length} sub="delay stated in a supplier email" />
        <Stat label="Jobs starting before arrival" value={new Set(late.flatMap((r) => r.jobsAtRisk.map((o) => o.id))).size} sub="production orders waiting on a late PO" />
      </div>

      <div className="filters">
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All ({rows.length})</button>
        <button className={`chip ${filter === 'late' ? 'on' : ''}`} onClick={() => setFilter('late')}>Expected late ({late.length})</button>
        <button className={`chip ${filter === 'ontime' ? 'on' : ''}`} onClick={() => setFilter('ontime')}>On time ({rows.length - late.length})</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO</th>
                <th>Material</th>
                <th>Supplier</th>
                <th className="num">Qty</th>
                <th>Due</th>
                <th>Expected</th>
                <th>Based on</th>
                <th>Jobs starting before arrival</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ po, est, m, jobsAtRisk, alert }) => {
                const s = supplierById.get(po.supplierId)!;
                const st = supplierStats.get(s.id);
                return (
                  <tr key={po.id} className="clickable" onClick={() => openMaterial(m.id)} title={est.note}>
                    <td><span className="code">{po.id}</span><div className="small muted">{po.status} · ordered {fmtDate(po.orderDate)}</div></td>
                    <td><span className="code">{m.code}</span><div className="small muted">{m.name}</div></td>
                    <td>
                      {s.name}
                      {st && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <div style={{ width: 56 }}><Meter value={st.score} color={scoreColor(st.score)} /></div>
                          <span className="small muted tnum">{st.score}</span>
                        </div>
                      )}
                    </td>
                    <td className="num">{fmtNum(po.qty)} {m.uom}<div className="small muted">{fmtMoney(po.qty * m.unitCost)}</div></td>
                    <td className="nowrap">{fmtDate(po.dueDate)}</td>
                    <td className="nowrap">
                      <span style={est.slipDays > 0 ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>{fmtDate(est.arrival)}</span>
                      {est.slipDays > 0 ? <span className="badge sev-high" style={{ marginLeft: 6 }}>+{est.slipDays} d</span> : <span className="badge sev-ok" style={{ marginLeft: 6 }}>On time</span>}
                    </td>
                    <td className="small">
                      {est.source === 'Supplier email' ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Mail size={12} /> Supplier email</span> : est.source}
                    </td>
                    <td>
                      {jobsAtRisk.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {jobsAtRisk.map((o) => (
                            <span key={o.id} className="small"><span className="code">{o.id}</span> · {fmtDate(o.jobStart)}</span>
                          ))}
                          {alert && (
                            <button className="btn ghost small" style={{ padding: 0, justifyContent: 'flex-start', color: 'var(--accent-ink)' }} onClick={(e) => { e.stopPropagation(); go('alerts', { alertId: alert.id }); }}>
                              Open alert
                            </button>
                          )}
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Click a row to see the material's stock projection. KingslakeAI never changes or places purchase orders.</p>
    </>
  );
}
