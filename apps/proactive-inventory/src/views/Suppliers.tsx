import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { materials, purchaseOrders, suppliers } from '../data/mockData';
import type { Supplier } from '../data/types';
import { fmtDate, fmtNum } from '../engine/dates';
import { estimateArrival, lateBasis, materialById, supplierStats, type SupplierStats } from '../engine/risk';
import { SupplierDelayChart } from '../components/charts';
import { Drawer, FilterChips, Meter, scoreColor, Stat } from '../components/ui';
import { useApp } from '../state';

type Filter = 'all' | 'good' | 'poor' | 'worsening' | 'alternates';

export function Suppliers() {
  const { basis } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);

  const rows = suppliers
    .map((s) => {
      const st = supplierStats.get(s.id) ?? null;
      const pos = purchaseOrders.filter((p) => p.supplierId === s.id).map((p) => estimateArrival(p, lateBasis(basis)));
      return { s, st, open: pos.length, late: pos.filter((a) => a.slipDays > 0).length };
    })
    .sort((a, b) => (a.st?.score ?? 101) - (b.st?.score ?? 101));
  const match: Record<Filter, (r: (typeof rows)[number]) => boolean> = {
    all: () => true,
    good: (r) => !!r.st && (r.st.grade === 'A' || r.st.grade === 'B'),
    poor: (r) => !!r.st && (r.st.grade === 'C' || r.st.grade === 'D'),
    worsening: (r) => r.st?.trend === 'worsening',
    alternates: (r) => !r.st,
  };
  const scored = rows.filter((r) => r.st);
  const onTime = scored.reduce((s, r) => s + r.st!.onTimeRate * r.st!.count, 0) / scored.reduce((s, r) => s + r.st!.count, 0);
  const selected = rows.find((r) => r.s.id === sel);

  return (
    <>
      <div className="page-head">
        <h1>Supplier reliability</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Suppliers" value={rows.length} sub={`${scored.length} with delivery history · ${rows.filter(match.alternates).length} alternates only`} />
        <Stat label="Overall on-time rate" value={`${Math.round(onTime * 100)}%`} sub="PO due date vs goods receipt, ±2 days" />
        <Stat label="Grade C or D" value={rows.filter(match.poor).length} sub="score below 65" />
        <Stat label="Getting worse" value={rows.filter(match.worsening).length} sub="last 6 receipts later than before" />
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: rows.length },
            { id: 'good', label: 'Grade A–B', count: rows.filter(match.good).length },
            { id: 'poor', label: 'Grade C–D', count: rows.filter(match.poor).length },
            { id: 'worsening', label: 'Getting worse', count: rows.filter(match.worsening).length },
            { id: 'alternates', label: 'Alternates only', count: rows.filter(match.alternates).length },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Supplier</th><th>Score</th><th className="num">On time</th><th className="num">Avg delay</th><th className="num">P80 delay</th><th>Trend</th><th className="num">Receipts</th><th className="num">Open POs</th><th className="num">Expected late</th></tr>
            </thead>
            <tbody>
              {rows.filter(match[filter]).map(({ s, st, open, late }) => (
                <tr key={s.id} className={`clickable ${sel === s.id ? 'selected' : ''}`} onClick={() => setSel(s.id)}>
                  <td><div className="cell-title">{s.name}</div><div className="cell-sub">{s.country}</div></td>
                  <td style={{ minWidth: 150 }}>
                    {st ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b className="tnum" style={{ width: 22 }}>{st.score}</b>
                        <div style={{ flex: 1 }}><Meter value={st.score} color={scoreColor(st.score)} /></div>
                        <span className="tag">{st.grade}</span>
                      </div>
                    ) : <span className="muted small">No history yet</span>}
                  </td>
                  <td className="num">{st ? `${Math.round(st.onTimeRate * 100)}%` : '—'}</td>
                  <td className="num nowrap">{st ? `${st.avgDelay.toFixed(1)} d` : '—'}</td>
                  <td className="num nowrap">{st ? `${st.p80} d` : '—'}</td>
                  <td>{st ? <Trend t={st.trend} /> : '—'}</td>
                  <td className="num">{st?.count ?? '—'}</td>
                  <td className="num">{open || '—'}</td>
                  <td className="num" style={late ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>{open ? late : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <SupplierDrawer supplier={selected.s} st={selected.st} onClose={() => setSel(null)} />}
    </>
  );
}

function SupplierDrawer({ supplier: s, st, onClose }: { supplier: Supplier; st: SupplierStats | null; onClose: () => void }) {
  const { basis, openMaterial } = useApp();
  const pos = purchaseOrders.filter((p) => p.supplierId === s.id).map((p) => estimateArrival(p, lateBasis(basis)));
  const supplies = materials.filter((m) => m.primarySupplierId === s.id || m.alternates.some((a) => a.supplierId === s.id));

  return (
    <Drawer onClose={onClose} title={s.name} subtitle={<>{s.country} · {s.contact} · {s.publishesPcn ? 'publishes PCN/EOL notices' : 'no PCN feed'}</>}>
      {st ? (
        <>
          <div className="card card-body kv">
            <div><span className="k">Score</span><span className="v">{st.score}/100 ({st.grade})</span></div>
            <div><span className="k">On time (±2 d)</span><span className="v">{Math.round(st.onTimeRate * 100)}%</span></div>
            <div><span className="k">Typical delay</span><span className="v">{st.p50} d</span></div>
            <div><span className="k">P80 / P90</span><span className="v">{st.p80} / {st.p90} d</span></div>
            <div><span className="k">Last 6 vs before</span><span className="v">{st.recentAvg.toFixed(1)} vs {st.priorAvg.toFixed(1)} d</span></div>
            <div><span className="k">Receipts</span><span className="v">{st.count}</span></div>
          </div>
          <div className="card card-body drawer-section">
            <h3>Delivery delay per receipt (days late)</h3>
            <SupplierDelayChart stats={st} />
          </div>
        </>
      ) : (
        <div className="card card-body secondary">No receipts yet. This vendor is on the approved list as an alternate source; its score will build up from the first deliveries.</div>
      )}

      <div className="card">
        <div className="card-head"><h2>Open purchase orders</h2></div>
        {pos.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>PO</th><th>Material</th><th className="num">Qty</th><th>Due</th><th>Expected</th></tr></thead>
              <tbody>
                {pos.map((a) => {
                  const m = materialById.get(a.po.materialId)!;
                  return (
                    <tr key={a.po.id} className="clickable" onClick={() => openMaterial(m.id)} title={a.note}>
                      <td><span className="code">{a.po.id}</span><div className="cell-sub">{a.po.status}</div></td>
                      <td><span className="code">{m.code}</span></td>
                      <td className="num">{fmtNum(a.po.qty)} {m.uom}</td>
                      <td className="nowrap">{fmtDate(a.po.dueDate)}</td>
                      <td className="nowrap" style={a.slipDays > 0 ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>
                        {fmtDate(a.arrival)}{a.slipDays > 0 && ` (+${a.slipDays}d)`}
                        <div className="cell-sub" style={{ fontWeight: 400 }}>{a.source}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">No open purchase orders.</div>}
      </div>

      <div className="card card-body drawer-section">
        <h3>Materials supplied</h3>
        <div className="btn-row">
          {supplies.map((m) => (
            <button key={m.id} className="chip" onClick={() => openMaterial(m.id)}>
              {m.code} {m.primarySupplierId === s.id ? '' : '(alternate)'}
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function Trend({ t }: { t: 'improving' | 'worsening' | 'stable' }) {
  if (t === 'worsening') return <span className="badge sev-high"><TrendingDown size={13} /> Worsening</span>;
  if (t === 'improving') return <span className="badge sev-ok"><TrendingUp size={13} /> Improving</span>;
  return <span className="badge sev-low"><Minus size={13} /> Stable</span>;
}
