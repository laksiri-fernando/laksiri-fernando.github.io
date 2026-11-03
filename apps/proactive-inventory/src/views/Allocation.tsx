import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { allocationConflicts, type AllocationConflict } from '../engine/risk';
import { Drawer, FilterChips, SectorTag, SeverityBadge, Stat } from '../components/ui';
import { useApp } from '../state';

type Filter = 'all' | 'conflict' | 'covered';

export function Allocation() {
  const { alerts } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);
  const conflicts = allocationConflicts();
  const bad = conflicts.filter((c) => c.drawnFromReserve > 0);
  const shown = conflicts.filter((c) => filter === 'all' || (filter === 'conflict' ? c.drawnFromReserve > 0 : c.drawnFromReserve === 0));
  const alertFor = (c: AllocationConflict) => alerts.find((a) => a.id === `ALC-${c.material.id}`);
  const selected = conflicts.find((c) => c.material.id === sel);

  return (
    <>
      <div className="page-head">
        <h1>Reserved stock</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Materials with reservations" value={conflicts.length} sub={`${conflicts.reduce((s, c) => s + c.reserved.length, 0)} reservations for production orders`} />
        <Stat label="Conflicts" value={bad.length} sub="reserved stock drawn down by other orders" />
        <Stat label="Value drawn from reserve" value={fmtMoney(bad.reduce((s, c) => s + c.drawnFromReserve * c.material.unitCost, 0))} sub="needs to be replaced before the jobs start" />
        <Stat label="Orders left uncovered" value={new Set(bad.map((c) => c.reserved[c.reserved.length - 1].order.id)).size} sub="last reservation filled is the one left short" />
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: conflicts.length },
            { id: 'conflict', label: 'Conflicts', count: bad.length },
            { id: 'covered', label: 'Covered', count: conflicts.length - bad.length },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th className="num">On hand</th><th className="num">Reserved</th><th className="num">Free / shortfall</th><th style={{ minWidth: 140 }}>Coverage</th><th>Reserved for</th><th>Issued to other orders</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const m = c.material;
                const pct = Math.min(100, (m.onHand / Math.max(1, c.reservedTotal)) * 100);
                return (
                  <tr key={m.id} className={`clickable ${sel === m.id ? 'selected' : ''}`} onClick={() => setSel(m.id)}>
                    <td><span className="code">{m.code}</span><div className="cell-sub">{m.name}</div></td>
                    <td className="num">{fmtNum(m.onHand)} {m.uom}</td>
                    <td className="num">{fmtNum(c.reservedTotal)}</td>
                    <td className="num" style={c.freeStock < 0 ? { color: 'var(--critical-text)', fontWeight: 600 } : undefined}>{c.freeStock < 0 ? `−${fmtNum(-c.freeStock)}` : fmtNum(c.freeStock)}</td>
                    <td>
                      <div className="meter" style={{ height: 8 }} aria-hidden><div style={{ width: `${pct}%`, background: c.freeStock < 0 ? 'var(--critical)' : 'var(--good)' }} /></div>
                      <div className="cell-sub">{Math.round(pct)}% covered</div>
                    </td>
                    <td className="small">{c.reserved.map((r) => <div key={r.order.id}><span className="code">{r.order.id}</span> · {fmtNum(r.qty)}</div>)}</td>
                    <td className="small">{c.culprits.length ? c.culprits.map((i) => <div key={i.orderId + i.date}><span className="code">{i.orderId}</span> · {fmtNum(i.qty)} on {fmtDate(i.date)}</div>) : '—'}</td>
                    <td>{c.drawnFromReserve > 0 ? <SeverityBadge severity={alertFor(c)?.severity ?? 'high'} label="Conflict" /> : <SeverityBadge severity="ok" label="Covered" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ReservationDrawer c={selected} onClose={() => setSel(null)} />}
    </>
  );
}

function ReservationDrawer({ c, onClose }: { c: AllocationConflict; onClose: () => void }) {
  const { alerts, go, openMaterial } = useApp();
  const m = c.material;
  const pct = Math.min(100, (m.onHand / Math.max(1, c.reservedTotal)) * 100);
  const alert = alerts.find((a) => a.id === `ALC-${m.id}`);
  return (
    <Drawer onClose={onClose} title={<><span className="code" style={{ fontSize: 15 }}>{m.code}</span> · reserved stock</>} subtitle={m.name}>
      <div className="card card-body kv">
        <div><span className="k">On hand</span><span className="v">{fmtNum(m.onHand)} {m.uom}</span></div>
        <div><span className="k">Reserved</span><span className="v">{fmtNum(c.reservedTotal)}</span></div>
        <div><span className="k">{c.freeStock < 0 ? 'Shortfall' : 'Free'}</span><span className="v" style={c.freeStock < 0 ? { color: 'var(--critical-text)' } : undefined}>{fmtNum(Math.abs(c.freeStock))}</span></div>
        <div><span className="k">Coverage</span><span className="v">{Math.round(pct)}%</span></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Reserved for</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Job start</th><th className="num">Reserved</th></tr></thead>
            <tbody>
              {c.reserved.map((r) => (
                <tr key={r.order.id}>
                  <td><span className="code">{r.order.id}</span> <SectorTag sector={r.order.sector} /></td>
                  <td>{r.order.customer}</td>
                  <td className="nowrap">{fmtDate(r.order.jobStart)}</td>
                  <td className="num">{fmtNum(r.qty)} {m.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Issued to other orders</h2></div>
        {c.culprits.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Date</th><th>Issued by</th><th className="num">Qty</th></tr></thead>
              <tbody>
                {c.culprits.map((i) => (
                  <tr key={i.orderId + i.date}>
                    <td className="code">{i.orderId}</td>
                    <td className="nowrap">{fmtDate(i.date)}</td>
                    <td>{i.issuedBy}</td>
                    <td className="num" style={c.drawnFromReserve > 0 ? { color: 'var(--critical-text)', fontWeight: 600 } : undefined}>−{fmtNum(i.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No issues to non-reserving orders.</div>}
      </div>

      {alert && (
        <div className="card card-body drawer-section">
          <h3>Suggested options</h3>
          <ul className="reasons" style={{ margin: 0 }}>{alert.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      <div className="btn-row">
        {alert && <button className="btn primary" onClick={() => go('alerts', { alertId: alert.id })}>Open alert <ArrowRight size={14} /></button>}
        <button className="btn" onClick={() => openMaterial(m.id)}>Material view <ArrowRight size={14} /></button>
      </div>
    </Drawer>
  );
}
