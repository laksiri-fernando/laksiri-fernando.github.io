import { useState } from 'react';
import { reservations } from '../data/mockData';
import { fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { materialStatuses, SEVERITY_RANK, supplierById } from '../engine/risk';
import { FilterChips, SeverityBadge, Stat } from '../components/ui';
import { useApp } from '../state';

type Filter = 'all' | 'risk' | 'belowSafety' | 'shortage' | 'ok';

export function Materials() {
  const { alerts, basis, openMaterial, materialId } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const all = materialStatuses(alerts, basis);
  const match: Record<Filter, (s: (typeof all)[number]) => boolean> = {
    all: () => true,
    risk: (s) => s.severity !== 'ok',
    belowSafety: (s) => s.material.onHand < s.material.safetyStock,
    shortage: (s) => s.minProjected < 0,
    ok: (s) => s.severity === 'ok',
  };
  const rows = all
    .filter((s) => match[filter](s) && `${s.material.code} ${s.material.name} ${s.material.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.severity === 'ok' ? 9 : SEVERITY_RANK[a.severity]) - (b.severity === 'ok' ? 9 : SEVERITY_RANK[b.severity]));
  const stockValue = all.reduce((s, x) => s + x.material.onHand * x.material.unitCost, 0);

  return (
    <>
      <div className="page-head">
        <h1>Consolidated material view</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Materials tracked" value={all.length} sub={`${fmtMoney(stockValue)} stock on hand`} />
        <Stat label="At risk" value={all.filter(match.risk).length} sub="with at least one open alert" />
        <Stat label="Below safety stock today" value={all.filter(match.belowSafety).length} sub="on hand under safety level" />
        <Stat label="Projected to run out" value={all.filter(match.shortage).length} sub="stock goes negative in 95 days" />
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: all.length },
            { id: 'risk', label: 'At risk', count: all.filter(match.risk).length },
            { id: 'shortage', label: 'Projected shortage', count: all.filter(match.shortage).length },
            { id: 'belowSafety', label: 'Below safety stock', count: all.filter(match.belowSafety).length },
            { id: 'ok', label: 'OK', count: all.filter(match.ok).length },
          ]}
        />
        <span style={{ width: 8 }} />
        <input type="text" placeholder="Search code or name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search materials" />
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
              {rows.length === 0 && <tr><td colSpan={10} className="empty">No materials match these filters.</td></tr>}
              {rows.map((s) => {
                const m = s.material;
                const reserved = reservations.filter((r) => r.materialId === m.id).reduce((a, r) => a + r.qty, 0);
                return (
                  <tr key={m.id} className={`clickable ${materialId === m.id ? 'selected' : ''}`} onClick={() => openMaterial(m.id)}>
                    <td><span className="code">{m.code}</span><div className="cell-sub">{m.name}</div></td>
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
                      {s.alerts.length > 0 && <div className="cell-sub">{[...new Set(s.alerts.map((a) => a.type))].join(', ')}</div>}
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
