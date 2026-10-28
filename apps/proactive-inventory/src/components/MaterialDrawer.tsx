import { AS_OF, reservations } from '../data/mockData';
import { daysBetween, fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { demandFor, inboundFor, materialById, orderById, supplierById, supplierStats } from '../engine/risk';
import { useApp } from '../state';
import { ProjectionChart } from './charts';
import { Card, Drawer, SectorTag, SeverityBadge } from './ui';

export function MaterialDrawer() {
  const { materialId, openMaterial, basis, alerts, go } = useApp();
  if (!materialId) return null;
  const m = materialById.get(materialId)!;
  const supplier = supplierById.get(m.primarySupplierId)!;
  const stats = supplierStats.get(supplier.id);
  const own = alerts.filter((a) => a.material.id === m.id);
  const inbound = inboundFor(m.id, basis);
  const demand = demandFor(m.id);
  const res = reservations.filter((r) => r.materialId === m.id);
  const close = () => openMaterial(null);

  return (
    <Drawer
      onClose={close}
      title={<><span className="code" style={{ fontSize: 15 }}>{m.code}</span> · {m.name}</>}
      subtitle={<>{m.category} · {m.qualification}-qualified · primary supplier {supplier.name}{stats ? ` (reliability ${stats.score}/100)` : ''}</>}
    >
      <div className="card card-body kv">
        <div><span className="k">On hand</span><span className="v">{fmtNum(m.onHand)} {m.uom}</span></div>
        <div><span className="k">Safety stock</span><span className="v">{fmtNum(m.safetyStock)}</span></div>
        <div><span className="k">Reserved</span><span className="v">{fmtNum(res.reduce((s, r) => s + r.qty, 0))}</span></div>
        <div><span className="k">Lead time</span><span className="v">{m.leadTimeDays} d</span></div>
        <div><span className="k">MOQ / multiple</span><span className="v">{fmtNum(m.moq)} / {fmtNum(m.orderMultiple)}</span></div>
        <div><span className="k">Unit cost</span><span className="v">{fmtMoney(m.unitCost)}</span></div>
        <div><span className="k">Stock value</span><span className="v">{fmtMoney(m.onHand * m.unitCost)}</span></div>
      </div>

      {own.length > 0 && (
        <Card title="Active alerts" flush>
          <div className="alert-list">
            {own.map((a) => (
              <button key={a.id} className="alert-row" onClick={() => { close(); go('alerts', { alertId: a.id }); }}>
                <span className={`sev-bar ${a.severity}`} />
                <div className="body">
                  <span className="title">{a.title}</span>
                  <span className="meta"><SeverityBadge severity={a.severity} /> {a.type}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card title="Projected stock — next 95 days" subtitle="Production demand at job start dates, receipts at expected arrival. Hover for events.">
        <ProjectionChart material={m} basis={basis} />
      </Card>

      <div className="grid halves">
        <Card title="Scheduled demand" flush>
          {demand.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order</th><th>Start</th><th className="num">Qty</th></tr></thead>
                <tbody>
                  {demand.map((d) => (
                    <tr key={d.order.id}>
                      <td><span className="code">{d.order.id}</span> <SectorTag sector={d.order.sector} /></td>
                      <td className="nowrap">{fmtDate(d.date)}</td>
                      <td className="num">{fmtNum(d.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No scheduled demand.</div>}
        </Card>
        <Card title="Open purchase orders" flush>
          {inbound.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>PO</th><th>Due</th><th>Expected</th><th className="num">Qty</th></tr></thead>
                <tbody>
                  {inbound.map((a) => (
                    <tr key={a.po.id} title={a.note}>
                      <td className="code">{a.po.id}</td>
                      <td className="nowrap">{fmtDate(a.po.dueDate)}</td>
                      <td className="nowrap" style={a.slipDays > 0 ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>
                        {fmtDate(a.arrival)}{a.slipDays > 0 && ` (+${a.slipDays}d)`}
                        <div className="small muted" style={{ fontWeight: 400 }}>{a.source}</div>
                      </td>
                      <td className="num">{fmtNum(a.po.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No open POs.</div>}
        </Card>
      </div>

      <div className="grid halves">
        <Card title="Stock lots" flush>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lot</th><th>Received</th><th>Expiry</th><th className="num">Qty</th></tr></thead>
              <tbody>
                {m.lots.map((l) => {
                  const d = l.expiryDate ? daysBetween(AS_OF, l.expiryDate) : null;
                  return (
                    <tr key={l.lotId}>
                      <td className="code">{l.lotId}</td>
                      <td className="nowrap">{fmtDate(l.receivedDate, true)}</td>
                      <td className="nowrap" style={d !== null && d < 60 ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>
                        {l.expiryDate ? `${fmtDate(l.expiryDate, true)} (${d} d)` : '—'}
                      </td>
                      <td className="num">{fmtNum(l.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Reservations" flush>
          {res.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Reserved for</th><th>Start</th><th className="num">Qty</th></tr></thead>
                <tbody>
                  {res.map((r) => (
                    <tr key={r.orderId}>
                      <td className="code">{r.orderId}</td>
                      <td>{fmtDate(orderById.get(r.orderId)!.jobStart)}</td>
                      <td className="num">{fmtNum(r.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">No reservations.</div>}
        </Card>
      </div>

      {m.alternates.length > 0 && (
        <Card title="Approved alternate sources" flush>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Supplier</th><th>Qualified for</th><th className="num">Lead time</th><th className="num">Unit cost</th></tr></thead>
              <tbody>
                {m.alternates.map((a) => (
                  <tr key={a.supplierId}>
                    <td>{supplierById.get(a.supplierId)!.name}</td>
                    <td>{a.qualifiedFor.map((s) => <SectorTag key={s} sector={s} />)}</td>
                    <td className="num">{a.leadTimeDays} d</td>
                    <td className="num">${a.unitCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Drawer>
  );
}
