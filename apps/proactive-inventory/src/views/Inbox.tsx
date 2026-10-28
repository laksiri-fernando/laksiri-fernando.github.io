import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { supplierEmails } from '../data/mockData';
import { fmtDate } from '../engine/dates';
import { materialById, supplierById } from '../engine/risk';
import { Card } from '../components/ui';
import { useApp } from '../state';

export function Inbox() {
  const { openMaterial, alerts, go } = useApp();
  const [sel, setSel] = useState(supplierEmails[0].id);
  const e = supplierEmails.find((x) => x.id === sel)!;
  const linked = alerts.filter((a) => a.sourceEmails.some((s) => s.id === e.id));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Supplier inbox</h1>
          <p>Supplier correspondence is unstructured email today. KingslakeAI reads the procurement mailbox (read-only), extracts delays, confirmations and end-of-life notices, and links each one to the PO or material it affects.</p>
        </div>
      </div>
      <div className="split">
        <div className="card">
          <div className="alert-list">
            {supplierEmails.map((m) => (
              <button key={m.id} className={`alert-row ${m.id === sel ? 'selected' : ''}`} onClick={() => setSel(m.id)}>
                <Mail size={16} style={{ color: 'var(--accent)', marginTop: 2, flex: 'none' }} />
                <div className="body">
                  <span className="title">{m.subject}</span>
                  <span className="meta">{supplierById.get(m.supplierId)!.name} · {fmtDate(m.received)} <span className="tag">{m.extracted.type}</span></span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="card detail">
          <section>
            <h2>{e.subject}</h2>
            <div className="small secondary">{e.from} · {fmtDate(e.received, true)}</div>
            <p style={{ marginBottom: 0 }}>{e.body}</p>
          </section>
          <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> Extracted signal</h3>
            <div className="kv">
              <div><span className="k">Type</span><span className="v">{e.extracted.type}</span></div>
              {e.extracted.poId && <div><span className="k">PO</span><span className="v">{e.extracted.poId}</span></div>}
              {e.extracted.materialId && (
                <div><span className="k">Material</span><button className="btn ghost" style={{ padding: 0, justifyContent: 'flex-start' }} onClick={() => openMaterial(e.extracted.materialId!)}><span className="code">{materialById.get(e.extracted.materialId)!.code}</span></button></div>
              )}
              {e.extracted.newDate && <div><span className="k">New date</span><span className="v">{fmtDate(e.extracted.newDate, true)}</span></div>}
              {e.extracted.lastTimeBuyDate && <div><span className="k">Last-time-buy</span><span className="v">{fmtDate(e.extracted.lastTimeBuyDate, true)}</span></div>}
              <div><span className="k">Confidence</span><span className="v">{Math.round(e.extracted.confidence * 100)}%</span></div>
            </div>
            <p className="secondary" style={{ marginBottom: 0 }}>{e.extracted.summary}</p>
            {e.extracted.confidence < 0.75 && (
              <p className="small" style={{ color: 'var(--warning-text)', marginBottom: 0 }}>Low confidence — the supplier gave no firm date. Treated as an estimate; ask for confirmation.</p>
            )}
          </section>
          <section>
            <h3>Linked alerts</h3>
            {linked.length ? (
              <div className="btn-row">
                {linked.map((a) => (
                  <button key={a.id} className="btn" onClick={() => go('alerts', { alertId: a.id })}>{a.title} <ArrowRight size={14} /></button>
                ))}
              </div>
            ) : (
              <div className="muted small">No alert raised from this email{e.extracted.type === 'Confirmation' ? ' — the confirmation keeps the PO on track.' : '.'}</div>
            )}
          </section>
        </div>
      </div>
      <Card title="How it works">
        <ol className="reasons" style={{ margin: 0 }}>
          <li>New emails from known supplier domains are classified (delay, confirmation, EOL/PCN, price change, other).</li>
          <li>PO numbers, material codes and dates are extracted and matched to ERP records; confidence is recorded.</li>
          <li>Delay dates override the statistical arrival estimate for that PO; EOL notices open a last-time-buy review.</li>
          <li>Nothing is written back to the ERP without a planner's confirmation.</li>
        </ol>
      </Card>
    </>
  );
}
