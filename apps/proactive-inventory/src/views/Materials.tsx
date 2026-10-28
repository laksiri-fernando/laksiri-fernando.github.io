import { useState } from 'react';
import { reservations } from '../data/mockData';
import { fmtDate, fmtNum } from '../engine/dates';
import { materialStatuses, SEVERITY_RANK, supplierById } from '../engine/risk';
import { SeverityBadge } from '../components/ui';
import { useApp } from '../state';

export function Materials() {
  const { alerts, basis, openMaterial } = useApp();
  const [q, setQ] = useState('');
  const [onlyRisk, setOnlyRisk] = useState(false);
  const rows = materialStatuses(alerts, basis)
    .filter((s) => (!onlyRisk || s.severity !== 'ok') && `${s.material.code} ${s.material.name} ${s.material.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.severity === 'ok' ? 9 : SEVERITY_RANK[a.severity]) - (b.severity === 'ok' ? 9 : SEVERITY_RANK[b.severity]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Consolidated material view</h1>
          <p>Stock, reservations, scheduled demand and inbound supply for every material — the single source of truth across production plan, inventory and open POs.</p>
        </div>
        <div className="filters">
          <input type="text" placeholder="Search code or name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search materials" />
          <label className="small secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} /> At risk only
          </label>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Supplier</th>
                <th className="num">On hand</th>
                <th className="num">Safety</th>
                <th className="num">Reserved</th>
                <th className="num">Demand 95 d</th>
                <th className="num">On order</th>
                <th>Next arrival</th>
                <th className="num">Projected low</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const m = s.material;
                const reserved = reservations.filter((r) => r.materialId === m.id).reduce((a, r) => a + r.qty, 0);
                return (
                  <tr key={m.id} className="clickable" onClick={() => openMaterial(m.id)}>
                    <td><span className="code">{m.code}</span><div className="small muted">{m.name}</div></td>
                    <td className="small">{supplierById.get(m.primarySupplierId)!.name}</td>
                    <td className="num" style={m.onHand < m.safetyStock ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>{fmtNum(m.onHand)}</td>
                    <td className="num">{fmtNum(m.safetyStock)}</td>
                    <td className="num" style={reserved > m.onHand ? { color: 'var(--critical-text)', fontWeight: 600 } : undefined}>{reserved ? fmtNum(reserved) : '—'}</td>
                    <td className="num">{s.demand90 ? fmtNum(s.demand90) : '—'}</td>
                    <td className="num">{s.onOrder ? fmtNum(s.onOrder) : '—'}</td>
                    <td className="nowrap small">
                      {s.nextArrival ? (
                        <>
                          {fmtDate(s.nextArrival.arrival)}
                          {s.nextArrival.slipDays > 0 && <span style={{ color: 'var(--serious-text)', fontWeight: 600 }}> +{s.nextArrival.slipDays}d</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="num" style={s.minProjected < 0 ? { color: 'var(--critical-text)', fontWeight: 600 } : s.minProjected < m.safetyStock ? { color: 'var(--warning-text)' } : undefined}>
                      {fmtNum(s.minProjected)} <span className="muted small">{m.uom}</span>
                    </td>
                    <td>
                      <SeverityBadge severity={s.severity} />
                      {s.alerts.length > 0 && <div className="small muted" style={{ marginTop: 2 }}>{[...new Set(s.alerts.map((a) => a.type))].join(', ')}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
