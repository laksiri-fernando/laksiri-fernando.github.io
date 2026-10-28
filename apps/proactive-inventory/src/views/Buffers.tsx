import { fmtMoney, fmtNum } from '../engine/dates';
import { bufferRecommendations, supplierById, supplierStats } from '../engine/risk';
import { Card, Stat } from '../components/ui';
import { useApp } from '../state';

export function Buffers() {
  const { openMaterial, toast } = useApp();
  const recs = bufferRecommendations();
  const up = recs.filter((r) => r.delta > 0);
  const down = recs.filter((r) => r.delta < 0);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Safety-buffer guidance</h1>
          <p>Recommended safety stock per material, sized from scheduled demand and each supplier's actual delay history. Raise buffers where suppliers are late; release cash where they are reliable.</p>
        </div>
      </div>
      <div className="grid kpis">
        <Stat label="Increase recommended" value={up.length} sub={`+${fmtMoney(up.reduce((s, r) => s + r.costImpact, 0))} inventory`} />
        <Stat label="Decrease recommended" value={down.length} sub={`releases ${fmtMoney(-down.reduce((s, r) => s + r.costImpact, 0))}`} />
        <Stat label="Net working-capital change" value={fmtMoney(Math.abs(recs.reduce((s, r) => s + r.costImpact, 0)))} sub={recs.reduce((s, r) => s + r.costImpact, 0) >= 0 ? 'net increase' : 'net release'} />
      </div>
      <Card title="Recommendations" subtitle="Suggestions only — ERP safety-stock values are not changed" flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Supplier</th><th className="num">P90 delay</th><th className="num">Current</th><th className="num">Recommended</th><th className="num">Change</th><th className="num">Cash impact</th><th>Rationale</th><th /></tr>
            </thead>
            <tbody>
              {recs.map((r) => {
                const s = supplierById.get(r.material.primarySupplierId)!;
                const st = supplierStats.get(s.id);
                return (
                  <tr key={r.material.id}>
                    <td><button className="btn ghost" style={{ padding: 0 }} onClick={() => openMaterial(r.material.id)}><span className="code">{r.material.code}</span></button><div className="small muted">{r.material.name}</div></td>
                    <td className="small">{s.name}{st && <div className="muted">score {st.score}</div>}</td>
                    <td className="num">{r.p90Delay} d</td>
                    <td className="num">{fmtNum(r.current)}</td>
                    <td className="num"><b>{fmtNum(r.recommended)}</b></td>
                    <td className="num" style={{ color: r.delta > 0 ? 'var(--serious-text)' : r.delta < 0 ? 'var(--good-text)' : undefined, fontWeight: 600 }}>
                      {r.delta > 0 ? '+' : ''}{fmtNum(r.delta)}
                    </td>
                    <td className="num">{r.costImpact === 0 ? '—' : `${r.costImpact > 0 ? '+' : '−'}${fmtMoney(Math.abs(r.costImpact))}`}</td>
                    <td className="small secondary" style={{ maxWidth: 340 }}>{r.rationale}</td>
                    <td>{r.delta !== 0 && <button className="btn" onClick={() => toast(`Proposal for ${r.material.code} sent to planning review`)}>Propose</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
