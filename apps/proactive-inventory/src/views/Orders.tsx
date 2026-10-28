import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AS_OF, productionOrders } from '../data/mockData';
import { daysBetween, fmtDate, fmtNum } from '../engine/dates';
import { materialById, projectStock } from '../engine/risk';
import { SectorTag, SeverityBadge } from '../components/ui';
import { useApp } from '../state';
import { orderSeverity } from './Overview';

export function Orders() {
  const { alerts, basis, openMaterial } = useApp();
  const orders = [...productionOrders].sort((a, b) => a.jobStart.localeCompare(b.jobStart));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Production orders</h1>
          <p>Material readiness for each job, based on ERP job start dates, the bill of materials and projected stock at the start date. Click a material to see why.</p>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Product</th><th>Customer</th><th>Job start</th><th className="num">Qty</th><th>Materials</th><th>Readiness</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = orderSeverity(o.id, alerts);
                return (
                  <tr key={o.id}>
                    <td><span className="code">{o.id}</span><div className="small muted">{o.status}</div></td>
                    <td>{o.product}</td>
                    <td>{o.customer} <SectorTag sector={o.sector} /></td>
                    <td className="nowrap">{fmtDate(o.jobStart, true)}<div className="small muted">in {daysBetween(AS_OF, o.jobStart)} days</div></td>
                    <td className="num">{fmtNum(o.qty)}</td>
                    <td>
                      <div className="ready-cells">
                        {o.requirements.map((r) => {
                          const m = materialById.get(r.materialId)!;
                          const hit = s.alerts.find((a) => a.material.id === m.id);
                          const after = projectStock(m, basis).find((p) => p.date === o.jobStart)?.stock ?? 0;
                          const tone = hit ? (hit.severity === 'critical' ? 'critical' : hit.severity === 'high' ? 'high' : 'medium') : after < m.safetyStock ? 'medium' : 'ok';
                          const Icon = tone === 'ok' ? CheckCircle2 : tone === 'critical' ? AlertOctagon : AlertTriangle;
                          return (
                            <button
                              key={m.id}
                              className={`ready-cell sev-${tone}`}
                              style={{ border: 0, cursor: 'pointer' }}
                              title={`${m.code}: needs ${fmtNum(r.qty)} ${m.uom}; projected ${fmtNum(after)} ${m.uom} after start${hit ? ` — ${hit.type}` : ''}`}
                              onClick={() => openMaterial(m.id)}
                            >
                              <Icon size={11} aria-hidden /> {m.code}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td><SeverityBadge severity={s.severity} label={s.severity === 'ok' ? 'Ready' : undefined} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Amber without an alert means the job is covered but leaves stock below safety level afterwards.</p>
    </>
  );
}
