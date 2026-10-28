import { AS_OF } from '../data/mockData';
import { daysBetween, fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { obsolescenceItems } from '../engine/risk';
import { Card, Stat } from '../components/ui';
import { useApp } from '../state';

export function Obsolescence() {
  const { openMaterial, go, alerts } = useApp();
  const items = obsolescenceItems();
  const writeOff = items.filter((i) => i.kind !== 'End of life');
  const eol = items.filter((i) => i.kind === 'End of life');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Obsolescence early warning</h1>
          <p>Shelf-life expiry, slow-moving stock and supplier end-of-life notices — flagged while there is still time to act. Aerospace material changes take ≈6 months to requalify, so early notice matters.</p>
        </div>
      </div>
      <div className="grid kpis">
        <Stat label="At risk of write-off" value={fmtMoney(writeOff.reduce((s, i) => s + i.valueAtRisk, 0))} sub={`${writeOff.length} items (expiry + excess)`} />
        <Stat label="Last-time-buy decisions" value={eol.length} sub={eol.map((e) => `${e.material.code} by ${fmtDate(e.date!)}`).join(', ')} />
        <Stat label="Historic obsolete/excess cost" value="≈ $100k/yr" sub="≈ $400k over 2–4 years · target ≈ $50k/yr" />
      </div>
      <Card title="Items needing a decision" flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Risk</th><th className="num">Qty at risk</th><th className="num">Value</th><th>When</th><th>Detail</th><th>Suggested action</th><th /></tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const alert = alerts.find((a) => a.material.id === i.material.id && a.type === i.kind);
                return (
                  <tr key={i.material.id + i.kind}>
                    <td><button className="btn ghost" style={{ padding: 0 }} onClick={() => openMaterial(i.material.id)}><span className="code">{i.material.code}</span></button><div className="small muted">{i.material.name}</div></td>
                    <td><span className="tag">{i.kind}</span></td>
                    <td className="num">{fmtNum(i.qtyAtRisk)} {i.material.uom}{i.kind === 'End of life' && <div className="small muted">LTB qty</div>}</td>
                    <td className="num">{fmtMoney(i.valueAtRisk)}</td>
                    <td className="nowrap">{i.date ? <>{fmtDate(i.date, true)}<div className="small muted">in {daysBetween(AS_OF, i.date)} d</div></> : '—'}</td>
                    <td className="small secondary" style={{ maxWidth: 280 }}>{i.detail}</td>
                    <td className="small" style={{ maxWidth: 300 }}>{i.recommendation}</td>
                    <td>{alert && <button className="btn" onClick={() => go('alerts', { alertId: alert.id })}>Alert</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="small muted" style={{ margin: 0 }}>
        Expiry risk uses FIFO-by-expiry consumption against scheduled jobs. EOL signals are extracted from supplier PCN emails; production would also monitor distributor and manufacturer lifecycle feeds where available.
      </p>
    </>
  );
}
