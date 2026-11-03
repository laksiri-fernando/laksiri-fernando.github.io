import { ArrowRight, Send } from 'lucide-react';
import { useState } from 'react';
import { fmtMoney, fmtNum } from '../engine/dates';
import { bufferRecommendations, supplierById, supplierStats, type BufferRecommendation } from '../engine/risk';
import { Drawer, FilterChips, Stat } from '../components/ui';
import { useApp } from '../state';

type Filter = 'all' | 'up' | 'down' | 'same';
const cash = (v: number) => (v === 0 ? '—' : `${v > 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`);

export function Buffers() {
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);
  const recs = bufferRecommendations();
  const match: Record<Filter, (r: BufferRecommendation) => boolean> = {
    all: () => true,
    up: (r) => r.delta > 0,
    down: (r) => r.delta < 0,
    same: (r) => r.delta === 0,
  };
  const up = recs.filter(match.up);
  const down = recs.filter(match.down);
  const net = recs.reduce((s, r) => s + r.costImpact, 0);
  const selected = recs.find((r) => r.material.id === sel);

  return (
    <>
      <div className="page-head">
        <h1>Safety-buffer guidance</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Materials reviewed" value={recs.length} sub="with scheduled demand in the next 95 days" />
        <Stat label="Increase recommended" value={up.length} sub={`+${fmtMoney(up.reduce((s, r) => s + r.costImpact, 0))} inventory`} />
        <Stat label="Decrease recommended" value={down.length} sub={`releases ${fmtMoney(-down.reduce((s, r) => s + r.costImpact, 0))}`} />
        <Stat label="Net working-capital change" value={fmtMoney(Math.abs(net))} sub={net >= 0 ? 'net increase' : 'net release'} />
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: recs.length },
            { id: 'up', label: 'Increase', count: up.length },
            { id: 'down', label: 'Decrease', count: down.length },
            { id: 'same', label: 'No change', count: recs.filter(match.same).length },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Supplier</th><th className="num">P90 delay</th><th className="num">Daily demand</th><th className="num">Current</th><th className="num">Recommended</th><th className="num">Change</th><th className="num">Cash impact</th></tr>
            </thead>
            <tbody>
              {recs.filter(match[filter]).map((r) => {
                const s = supplierById.get(r.material.primarySupplierId)!;
                const st = supplierStats.get(s.id);
                return (
                  <tr key={r.material.id} className={`clickable ${sel === r.material.id ? 'selected' : ''}`} onClick={() => setSel(r.material.id)}>
                    <td><span className="code">{r.material.code}</span><div className="cell-sub">{r.material.name}</div></td>
                    <td className="small">{s.name}{st && <div className="cell-sub">score {st.score}</div>}</td>
                    <td className="num">{r.p90Delay} d</td>
                    <td className="num">{r.dailyDemand.toFixed(1)} {r.material.uom}</td>
                    <td className="num">{fmtNum(r.current)}</td>
                    <td className="num"><b>{fmtNum(r.recommended)}</b></td>
                    <td className="num" style={{ color: r.delta > 0 ? 'var(--serious-text)' : r.delta < 0 ? 'var(--good-text)' : undefined, fontWeight: 600 }}>
                      {r.delta > 0 ? '+' : ''}{r.delta ? fmtNum(r.delta) : '—'}
                    </td>
                    <td className="num">{cash(r.costImpact)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <BufferDrawer r={selected} onClose={() => setSel(null)} />}
    </>
  );
}

function BufferDrawer({ r, onClose }: { r: BufferRecommendation; onClose: () => void }) {
  const { toast, openMaterial } = useApp();
  const m = r.material;
  const s = supplierById.get(m.primarySupplierId)!;
  const st = supplierStats.get(s.id);
  return (
    <Drawer onClose={onClose} title={<><span className="code" style={{ fontSize: 15 }}>{m.code}</span> · safety buffer</>} subtitle={m.name}>
      <div className="card card-body kv">
        <div><span className="k">Current</span><span className="v">{fmtNum(r.current)} {m.uom}</span></div>
        <div><span className="k">Recommended</span><span className="v">{fmtNum(r.recommended)} {m.uom}</span></div>
        <div><span className="k">Change</span><span className="v" style={{ color: r.delta > 0 ? 'var(--serious-text)' : r.delta < 0 ? 'var(--good-text)' : undefined }}>{r.delta > 0 ? '+' : ''}{fmtNum(r.delta)}</span></div>
        <div><span className="k">Cash impact</span><span className="v">{cash(r.costImpact)}</span></div>
      </div>

      <div className="card card-body drawer-section">
        <h3>Why</h3>
        <p style={{ margin: 0 }}>{r.rationale}</p>
        <p className="small muted" style={{ margin: 0 }}>
          {r.delta > 0
            ? `${s.name} is often late, so a bigger buffer protects jobs from late deliveries.`
            : r.delta < 0
              ? `${s.name} delivers reliably, so less buffer is needed and working capital can be released.`
              : 'The current safety stock already matches the recommendation.'}
        </p>
      </div>

      <div className="card card-body drawer-section">
        <h3>Inputs</h3>
        <div className="kv">
          <div><span className="k">Daily demand</span><span className="v">{r.dailyDemand.toFixed(1)} {m.uom}</span></div>
          <div><span className="k">Supplier P90 delay</span><span className="v">{r.p90Delay} d</span></div>
          <div><span className="k">Quoted lead time</span><span className="v">{m.leadTimeDays} d</span></div>
          <div><span className="k">Order multiple</span><span className="v">{fmtNum(m.orderMultiple)}</span></div>
          <div><span className="k">Supplier</span><span className="v">{s.name}</span></div>
          {st && <div><span className="k">Reliability</span><span className="v">{st.score}/100 · {Math.round(st.onTimeRate * 100)}% on time</span></div>}
        </div>
      </div>

      <div className="btn-row">
        {r.delta !== 0 && <button className="btn primary" onClick={() => toast(`Proposal for ${m.code} sent to planning review`)}><Send size={14} /> Propose to planning review</button>}
        <button className="btn" onClick={() => openMaterial(m.id)}>Material view <ArrowRight size={14} /></button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Suggestion only — ERP safety-stock values are not changed.</p>
    </Drawer>
  );
}
