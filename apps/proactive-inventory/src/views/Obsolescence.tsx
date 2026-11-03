import { ArrowRight, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { AS_OF, supplierEmails } from '../data/mockData';
import { daysBetween, fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { obsolescenceItems, type ObsolescenceItem } from '../engine/risk';
import { Drawer, FilterChips, Stat } from '../components/ui';
import { useApp } from '../state';

type Kind = ObsolescenceItem['kind'];
type Filter = 'all' | Kind;
const key = (i: ObsolescenceItem) => `${i.material.id}-${i.kind}`;

export function Obsolescence() {
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);
  const items = obsolescenceItems();
  const writeOff = items.filter((i) => i.kind !== 'End of life');
  const eol = items.filter((i) => i.kind === 'End of life');
  const n = (k: Kind) => items.filter((i) => i.kind === k).length;
  const selected = items.find((i) => key(i) === sel);

  return (
    <>
      <div className="page-head">
        <h1>Obsolescence early warning</h1>
      </div>

      <div className="grid kpis">
        <Stat label="At risk of write-off" value={fmtMoney(writeOff.reduce((s, i) => s + i.valueAtRisk, 0))} sub={`${writeOff.length} items · expiry and excess`} />
        <Stat label="Expiring before use" value={n('Expiry')} sub="lots that scheduled jobs won't consume in time" />
        <Stat label="Last-time-buy decisions" value={eol.length} sub={eol.map((e) => `${e.material.code} by ${fmtDate(e.date!)}`).join(', ') || 'none'} />
        <Stat label="Historic obsolete/excess cost" value="≈ $100k/yr" sub="target ≈ $50k/yr" />
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: items.length },
            { id: 'Expiry', label: 'Expiry', count: n('Expiry') },
            { id: 'Excess stock', label: 'Excess stock', count: n('Excess stock') },
            { id: 'End of life', label: 'End of life', count: n('End of life') },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Material</th><th>Risk</th><th className="num">Qty at risk</th><th className="num">Value</th><th>When</th><th>Suggested action</th></tr>
            </thead>
            <tbody>
              {items.filter((i) => filter === 'all' || i.kind === filter).map((i) => (
                <tr key={key(i)} className={`clickable ${sel === key(i) ? 'selected' : ''}`} onClick={() => setSel(key(i))}>
                  <td><span className="code">{i.material.code}</span><div className="cell-sub">{i.material.name}</div></td>
                  <td><span className="tag">{i.kind}</span></td>
                  <td className="num">{fmtNum(i.qtyAtRisk)} {i.material.uom}{i.kind === 'End of life' && <div className="cell-sub">last-time-buy qty</div>}</td>
                  <td className="num">{fmtMoney(i.valueAtRisk)}</td>
                  <td className="nowrap">{i.date ? <>{fmtDate(i.date, true)}<div className="cell-sub">in {daysBetween(AS_OF, i.date)} days</div></> : '—'}</td>
                  <td className="small secondary" style={{ maxWidth: 380 }}>{i.recommendation.split('. ')[0].replace(/\.$/, '')}.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ObsolescenceDrawer i={selected} onClose={() => setSel(null)} />}
    </>
  );
}

function ObsolescenceDrawer({ i, onClose }: { i: ObsolescenceItem; onClose: () => void }) {
  const { alerts, go, openMaterial } = useApp();
  const m = i.material;
  const alert = alerts.find((a) => a.material.id === m.id && a.type === i.kind);
  const notice = i.kind === 'End of life' ? supplierEmails.find((e) => e.extracted.type === 'EOL' && e.extracted.materialId === m.id) : undefined;
  return (
    <Drawer onClose={onClose} title={<><span className="code" style={{ fontSize: 15 }}>{m.code}</span> · {i.kind}</>} subtitle={m.name}>
      <div className="card card-body kv">
        <div><span className="k">{i.kind === 'End of life' ? 'Last-time-buy qty' : 'Qty at risk'}</span><span className="v">{fmtNum(i.qtyAtRisk)} {m.uom}</span></div>
        <div><span className="k">Value</span><span className="v">{fmtMoney(i.valueAtRisk)}</span></div>
        {i.date && <div><span className="k">{i.kind === 'End of life' ? 'Order by' : 'Expires'}</span><span className="v">{fmtDate(i.date, true)}</span></div>}
        {i.date && <div><span className="k">Days left</span><span className="v">{daysBetween(AS_OF, i.date)}</span></div>}
        <div><span className="k">On hand</span><span className="v">{fmtNum(m.onHand)} {m.uom}</span></div>
      </div>

      <div className="card card-body drawer-section">
        <h3>Why this was flagged</h3>
        <p style={{ margin: 0 }}>{i.detail}</p>
        {notice && <div className="email small"><b>{notice.from}</b> · {fmtDate(notice.received)}<div style={{ marginTop: 4, fontStyle: 'italic' }}>“{notice.body}”</div></div>}
      </div>

      <div className="card card-body drawer-section">
        <h3>Suggested action</h3>
        <ul className="recs"><li><Lightbulb size={15} /> <span>{i.recommendation}</span></li></ul>
        <p className="small muted" style={{ margin: 0 }}>Suggestion only — the planner decides.</p>
      </div>

      <div className="card">
        <div className="card-head"><h2>Stock lots</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lot</th><th>Received</th><th>Expiry</th><th className="num">Qty</th></tr></thead>
            <tbody>
              {m.lots.map((l) => (
                <tr key={l.lotId}>
                  <td className="code">{l.lotId}</td>
                  <td className="nowrap">{fmtDate(l.receivedDate, true)}</td>
                  <td className="nowrap">{l.expiryDate ? fmtDate(l.expiryDate, true) : '—'}</td>
                  <td className="num">{fmtNum(l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="btn-row">
        {alert && <button className="btn primary" onClick={() => go('alerts', { alertId: alert.id })}>Open alert <ArrowRight size={14} /></button>}
        <button className="btn" onClick={() => openMaterial(m.id)}>Material view <ArrowRight size={14} /></button>
      </div>
    </Drawer>
  );
}
