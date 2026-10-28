import { fmtDate, fmtNum } from '../engine/dates';
import { allocationConflicts } from '../engine/risk';
import { Card, SectorTag, SeverityBadge } from '../components/ui';
import { useApp } from '../state';

export function Allocation() {
  const { openMaterial, go, alerts } = useApp();
  const conflicts = allocationConflicts();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Planned (reserved) stock</h1>
          <p>Stock earmarked for a specific production order, and whether other orders have quietly drawn it down. Conflicts surface as soon as a goods issue eats into a reservation.</p>
        </div>
      </div>
      <div className="grid cards">
        {conflicts.map((c) => {
          const m = c.material;
          const pct = Math.min(100, (m.onHand / Math.max(1, c.reservedTotal)) * 100);
          const alert = alerts.find((a) => a.id === `ALC-${m.id}`);
          return (
            <Card
              key={m.id}
              title={<button className="btn ghost" style={{ padding: 0 }} onClick={() => openMaterial(m.id)}><span className="code" style={{ fontSize: 14 }}>{m.code}</span></button>}
              subtitle={m.name}
              actions={c.drawnFromReserve > 0 ? <SeverityBadge severity={alert?.severity ?? 'high'} label="Conflict" /> : <SeverityBadge severity="ok" label="Covered" />}
            >
              <div className="kv" style={{ marginBottom: 12 }}>
                <div><span className="k">On hand</span><span className="v">{fmtNum(m.onHand)} {m.uom}</span></div>
                <div><span className="k">Reserved</span><span className="v">{fmtNum(c.reservedTotal)}</span></div>
                <div><span className="k">{c.freeStock < 0 ? 'Shortfall' : 'Free'}</span><span className="v" style={c.freeStock < 0 ? { color: 'var(--critical-text)' } : undefined}>{fmtNum(Math.abs(c.freeStock))}</span></div>
              </div>
              <div className="small secondary" style={{ marginBottom: 4 }}>Reservation coverage {Math.round(pct)}%</div>
              <div className="meter" style={{ height: 10, marginBottom: 14 }} aria-hidden>
                <div style={{ width: `${pct}%`, background: c.freeStock < 0 ? 'var(--critical)' : 'var(--good)' }} />
              </div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Reserved for</div>
              {c.reserved.map((r) => (
                <div key={r.order.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
                  <span><span className="code">{r.order.id}</span> <SectorTag sector={r.order.sector} /> starts {fmtDate(r.order.jobStart)}</span>
                  <b className="tnum">{fmtNum(r.qty)}</b>
                </div>
              ))}
              {c.culprits.length > 0 && (
                <>
                  <div className="small" style={{ fontWeight: 600, margin: '10px 0 4px' }}>Issued to other orders</div>
                  {c.culprits.map((i) => (
                    <div key={i.orderId + i.date} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', color: c.drawnFromReserve > 0 ? 'var(--critical-text)' : undefined }}>
                      <span><span className="code">{i.orderId}</span> · {fmtDate(i.date)} · {i.issuedBy}</span>
                      <b className="tnum">−{fmtNum(i.qty)}</b>
                    </div>
                  ))}
                </>
              )}
              {alert && (
                <button className="btn" style={{ marginTop: 12 }} onClick={() => go('alerts', { alertId: alert.id })}>Open alert</button>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
