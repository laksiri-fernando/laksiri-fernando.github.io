import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useState } from 'react';
import { materials, purchaseOrders, suppliers } from '../data/mockData';
import { fmtDate, fmtNum } from '../engine/dates';
import { estimateArrival, materialById, supplierStats } from '../engine/risk';
import { SupplierDelayChart } from '../components/charts';
import { Meter, scoreColor } from '../components/ui';
import { useApp } from '../state';

export function Suppliers() {
  const { basis, openMaterial } = useApp();
  const ranked = suppliers
    .map((s) => ({ s, st: supplierStats.get(s.id) ?? null }))
    .sort((a, b) => (a.st?.score ?? 101) - (b.st?.score ?? 101));
  const [sel, setSel] = useState(ranked[0].s.id);
  const cur = ranked.find((r) => r.s.id === sel)!;
  const pos = purchaseOrders.filter((p) => p.supplierId === sel).map((p) => estimateArrival(p, basis));
  const supplies = materials.filter((m) => m.primarySupplierId === sel || m.alternates.some((a) => a.supplierId === sel));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Supplier reliability</h1>
          <p>Scored from actual delivery history — PO due date versus goods-receipt date — so vendor risk is objective, not anecdotal. Scores feed the arrival estimates used in every projection.</p>
        </div>
      </div>
      <div className="split wide-left">
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Supplier</th><th>Score</th><th className="num">On time</th><th className="num">Avg delay</th><th className="num">P80</th><th>Trend</th></tr>
              </thead>
              <tbody>
                {ranked.map(({ s, st }) => (
                  <tr key={s.id} className="clickable" onClick={() => setSel(s.id)} style={sel === s.id ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>{s.name}<div className="small muted">{s.country}</div></td>
                    <td style={{ minWidth: 120 }}>
                      {st ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <b className="tnum" style={{ width: 22 }}>{st.score}</b>
                          <div style={{ flex: 1 }}><Meter value={st.score} color={scoreColor(st.score)} /></div>
                          <span className="tag">{st.grade}</span>
                        </div>
                      ) : <span className="muted small">No history · alternate only</span>}
                    </td>
                    <td className="num">{st ? `${Math.round(st.onTimeRate * 100)}%` : '—'}</td>
                    <td className="num nowrap">{st ? `${st.avgDelay.toFixed(1)} d` : '—'}</td>
                    <td className="num nowrap">{st ? `${st.p80} d` : '—'}</td>
                    <td>{st && <Trend t={st.trend} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card detail">
          <section>
            <h2>{cur.s.name}</h2>
            <div className="secondary small">{cur.s.country} · {cur.s.contact} · {cur.s.publishesPcn ? 'publishes PCN/EOL notices' : 'no PCN feed'}</div>
            {cur.st && (
              <div className="kv" style={{ marginTop: 14 }}>
                <div><span className="k">Score</span><span className="v">{cur.st.score}/100 ({cur.st.grade})</span></div>
                <div><span className="k">On time (±2 d)</span><span className="v">{Math.round(cur.st.onTimeRate * 100)}%</span></div>
                <div><span className="k">Typical delay</span><span className="v">{cur.st.p50} d</span></div>
                <div><span className="k">P80 / P90</span><span className="v">{cur.st.p80} / {cur.st.p90} d</span></div>
                <div><span className="k">Last 6 vs before</span><span className="v">{cur.st.recentAvg.toFixed(1)} vs {cur.st.priorAvg.toFixed(1)} d</span></div>
                <div><span className="k">Receipts</span><span className="v">{cur.st.count}</span></div>
              </div>
            )}
          </section>
          {cur.st ? (
            <section>
              <h3>Delivery delay per receipt (days late)</h3>
              <SupplierDelayChart stats={cur.st} />
            </section>
          ) : (
            <section className="secondary">No receipts yet. This vendor is on the approved list as an alternate source; its score will build up from the first deliveries.</section>
          )}
          <section>
            <h3>Open purchase orders</h3>
            {pos.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>PO</th><th>Material</th><th className="num">Qty</th><th>Due</th><th>Expected</th></tr></thead>
                  <tbody>
                    {pos.map((a) => {
                      const m = materialById.get(a.po.materialId)!;
                      return (
                        <tr key={a.po.id} title={a.note}>
                          <td className="code">{a.po.id}<div className="small muted" style={{ fontFamily: 'inherit', fontWeight: 400 }}>{a.po.status}</div></td>
                          <td><button className="btn ghost" style={{ padding: 0 }} onClick={() => openMaterial(m.id)}><span className="code">{m.code}</span></button></td>
                          <td className="num">{fmtNum(a.po.qty)} {m.uom}</td>
                          <td className="nowrap">{fmtDate(a.po.dueDate)}</td>
                          <td className="nowrap" style={a.slipDays > 0 ? { color: 'var(--serious-text)', fontWeight: 600 } : undefined}>
                            {fmtDate(a.arrival)}{a.slipDays > 0 && ` (+${a.slipDays}d)`}
                            <div className="small muted" style={{ fontWeight: 400 }}>{a.source}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="muted">None.</div>}
          </section>
          <section>
            <h3>Materials supplied</h3>
            <div className="btn-row">
              {supplies.map((m) => (
                <button key={m.id} className="chip" onClick={() => openMaterial(m.id)}>
                  {m.code} {m.primarySupplierId === sel ? '' : '(alternate)'}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Trend({ t }: { t: 'improving' | 'worsening' | 'stable' }) {
  if (t === 'worsening') return <span className="badge sev-high"><TrendingDown size={13} /> Worsening</span>;
  if (t === 'improving') return <span className="badge sev-ok"><TrendingUp size={13} /> Improving</span>;
  return <span className="badge sev-low"><Minus size={13} /> Stable</span>;
}
