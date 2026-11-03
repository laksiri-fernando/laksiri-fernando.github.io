import { ArrowRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { supplierEmails } from '../data/mockData';
import type { SignalType, SupplierEmail } from '../data/types';
import { fmtDate } from '../engine/dates';
import { materialById, supplierById } from '../engine/risk';
import { Drawer, FilterChips, Stat } from '../components/ui';
import { useApp } from '../state';

type Filter = 'all' | SignalType;
const LOW_CONFIDENCE = 0.75;

export function Inbox() {
  const { alerts } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<string | null>(null);
  const messages = [...supplierEmails].sort((a, b) => b.received.localeCompare(a.received));
  const byType = (t: SignalType) => messages.filter((m) => m.extracted.type === t).length;
  const linkedAlerts = (e: SupplierEmail) => alerts.filter((a) => a.sourceEmails.some((s) => s.id === e.id));
  const selected = messages.find((m) => m.id === sel);

  return (
    <>
      <div className="page-head">
        <h1>Inbox and News</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Messages with signals" value={messages.length} sub="read from the procurement mailbox" />
        <Stat label="Delays reported" value={byType('Delay')} sub="override the PO's expected arrival" />
        <Stat label="End-of-life / PCN notices" value={byType('EOL')} sub="open a last-time-buy review" />
        <Stat label="Need confirmation" value={messages.filter((m) => m.extracted.confidence < LOW_CONFIDENCE).length} sub={`extraction confidence below ${LOW_CONFIDENCE * 100}%`} />
      </div>

      <div className="filters">
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All', count: messages.length },
            { id: 'Delay', label: 'Delay', count: byType('Delay') },
            { id: 'Confirmation', label: 'Confirmation', count: byType('Confirmation') },
            { id: 'EOL', label: 'End of life', count: byType('EOL') },
            { id: 'PriceChange', label: 'Price change', count: byType('PriceChange') },
          ]}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Received</th><th>From</th><th>Subject</th><th>Signal</th><th>Linked to</th><th className="num">Confidence</th><th className="num">Alerts</th></tr>
            </thead>
            <tbody>
              {messages.filter((m) => filter === 'all' || m.extracted.type === filter).map((m) => (
                <tr key={m.id} className={`clickable ${sel === m.id ? 'selected' : ''}`} onClick={() => setSel(m.id)}>
                  <td className="nowrap">{fmtDate(m.received)}</td>
                  <td>{supplierById.get(m.supplierId)!.name}</td>
                  <td style={{ maxWidth: 380 }}><div className="cell-title">{m.subject}</div><div className="cell-sub">{m.extracted.summary}</div></td>
                  <td><span className="tag">{m.extracted.type === 'PriceChange' ? 'Price change' : m.extracted.type}</span></td>
                  <td className="small nowrap">
                    {m.extracted.poId && <div className="code">{m.extracted.poId}</div>}
                    {m.extracted.materialId && <div className="code">{materialById.get(m.extracted.materialId)!.code}</div>}
                  </td>
                  <td className="num" style={m.extracted.confidence < LOW_CONFIDENCE ? { color: 'var(--warning-text)', fontWeight: 600 } : undefined}>{Math.round(m.extracted.confidence * 100)}%</td>
                  <td className="num">{linkedAlerts(m).length || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <MessageDrawer e={selected} linked={linkedAlerts(selected)} onClose={() => setSel(null)} />}
    </>
  );
}

function MessageDrawer({ e, linked, onClose }: { e: SupplierEmail; linked: ReturnType<typeof useApp>['alerts']; onClose: () => void }) {
  const { openMaterial, go } = useApp();
  return (
    <Drawer onClose={onClose} title={e.subject} subtitle={<>{e.from} · {fmtDate(e.received, true)}</>}>
      <div className="card card-body">{e.body}</div>

      <div className="card card-body drawer-section">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> Extracted signal</h3>
        <div className="kv">
          <div><span className="k">Type</span><span className="v">{e.extracted.type === 'PriceChange' ? 'Price change' : e.extracted.type}</span></div>
          {e.extracted.poId && <div><span className="k">PO</span><span className="v">{e.extracted.poId}</span></div>}
          {e.extracted.materialId && (
            <div><span className="k">Material</span><button className="btn ghost" style={{ padding: 0, justifyContent: 'flex-start' }} onClick={() => openMaterial(e.extracted.materialId!)}><span className="code">{materialById.get(e.extracted.materialId)!.code}</span></button></div>
          )}
          {e.extracted.newDate && <div><span className="k">New date</span><span className="v">{fmtDate(e.extracted.newDate, true)}</span></div>}
          {e.extracted.lastTimeBuyDate && <div><span className="k">Last-time-buy</span><span className="v">{fmtDate(e.extracted.lastTimeBuyDate, true)}</span></div>}
          <div><span className="k">Confidence</span><span className="v">{Math.round(e.extracted.confidence * 100)}%</span></div>
        </div>
        <p className="secondary" style={{ margin: 0 }}>{e.extracted.summary}</p>
        {e.extracted.confidence < LOW_CONFIDENCE && (
          <p className="small" style={{ color: 'var(--warning-text)', margin: 0 }}>Low confidence — the supplier gave no firm date. Treated as an estimate; ask for confirmation.</p>
        )}
      </div>

      <div className="card card-body drawer-section">
        <h3>Linked alerts</h3>
        {linked.length ? (
          <div className="btn-row">
            {linked.map((a) => (
              <button key={a.id} className="btn" onClick={() => go('alerts', { alertId: a.id })}>{a.title} <ArrowRight size={14} /></button>
            ))}
          </div>
        ) : (
          <div className="muted small">No alert raised from this message{e.extracted.type === 'Confirmation' ? ' — the confirmation keeps the PO on track.' : '.'}</div>
        )}
      </div>

      <div className="card card-body drawer-section">
        <h3>How this was processed</h3>
        <ol className="reasons small secondary" style={{ margin: 0 }}>
          <li>Classified as {e.extracted.type === 'PriceChange' ? 'a price change' : `a ${e.extracted.type.toLowerCase()}`} message from a known supplier domain.</li>
          <li>PO numbers, material codes and dates extracted and matched to ERP records.</li>
          <li>Delay dates override the statistical arrival estimate; EOL notices open a last-time-buy review.</li>
          <li>Nothing is written back to the ERP without a planner's confirmation.</li>
        </ol>
      </div>
    </Drawer>
  );
}
