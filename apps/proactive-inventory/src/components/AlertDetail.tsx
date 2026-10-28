import { ArrowRight, Check, Copy, Lightbulb, Mail, MessageSquare, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { AS_OF } from '../data/mockData';
import { daysBetween, fmtDate, fmtMoney, fmtNum } from '../engine/dates';
import { supplierById, type Alert } from '../engine/risk';
import { useApp } from '../state';
import { Modal, SectorTag, SeverityBadge } from './ui';

const PLANNERS = ['Nadeesha (Planning)', 'Ruwan (Procurement)', 'Tharindu (Production)', 'Ishara (Design)'];

export function AlertDetail({ alert }: { alert: Alert }) {
  const { alertState, updateAlert, openMaterial, toast, go, ask } = useApp();
  const state = alertState[alert.id] ?? { status: 'new' };
  const [draftOpen, setDraftOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const m = alert.material;
  const supplier = supplierById.get(m.primarySupplierId)!;
  const daysLeft = alert.decideBy ? daysBetween(AS_OF, alert.decideBy) : null;

  return (
    <div className="card detail">
      <section>
        <div className="btn-row" style={{ marginBottom: 8, alignItems: 'center' }}>
          <SeverityBadge severity={alert.severity} />
          <span className="tag">{alert.type}</span>
          {state.status !== 'new' && <span className="tag">{state.status === 'assigned' ? `Assigned · ${state.assignee}` : state.status}</span>}
        </div>
        <h2 style={{ marginBottom: 6 }}>{alert.title}</h2>
        <p className="secondary" style={{ margin: 0 }}>{alert.summary}</p>
        <div className="kv" style={{ marginTop: 14 }}>
          <div><span className="k">Material</span><button className="btn ghost" style={{ padding: 0, justifyContent: 'flex-start' }} onClick={() => openMaterial(m.id)}><span className="code">{m.code}</span></button></div>
          <div><span className="k">Primary supplier</span><span className="v">{supplier.name}</span></div>
          {alert.decideBy && (
            <div>
              <span className="k">Decide by</span>
              <span className="v" style={daysLeft !== null && daysLeft <= 7 ? { color: 'var(--critical-text)' } : undefined}>
                {fmtDate(alert.decideBy)} {daysLeft !== null && <span className="muted small">({daysLeft <= 0 ? 'today' : `${daysLeft} d`})</span>}
              </span>
            </div>
          )}
          {alert.valueAtRisk > 0 && <div><span className="k">Value at risk</span><span className="v">{fmtMoney(alert.valueAtRisk)}</span></div>}
        </div>
      </section>

      <section>
        <h3>Why this was flagged</h3>
        <ul className="reasons">
          {alert.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        {alert.sourceEmails.map((e) => (
          <div key={e.id} className="email" style={{ marginTop: 10 }}>
            <div className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Mail size={12} /> {e.from} · {fmtDate(e.received)} · extracted with {Math.round(e.extracted.confidence * 100)}% confidence
            </div>
            <div style={{ marginTop: 4, fontStyle: 'italic' }}>“{e.body}”</div>
          </div>
        ))}
      </section>

      {alert.affectedOrders.length > 0 && (
        <section>
          <h3>Affected production orders</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Job start</th>{alert.affectedOrders.some((o) => o.shortQty) && <th className="num">Short</th>}</tr></thead>
              <tbody>
                {alert.affectedOrders.map(({ order, shortQty }) => (
                  <tr key={order.id}>
                    <td className="code">{order.id}</td>
                    <td>{order.product} <SectorTag sector={order.sector} /></td>
                    <td>{order.customer}</td>
                    <td className="nowrap">{fmtDate(order.jobStart)}</td>
                    {alert.affectedOrders.some((o) => o.shortQty) && <td className="num">{shortQty ? `${fmtNum(shortQty)} ${m.uom}` : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {alert.alternates.length > 0 && (
        <section>
          <h3>Alternate vendors</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alert.alternates.map((a) => (
              <div key={a.supplierId} className={`alt ${a.qualified && a.meetsNeedDate ? 'ok' : ''}`}>
                <div className="alt-head">
                  <b>{a.supplierName}</b>
                  {a.qualifiedFor.map((s) => <SectorTag key={s} sector={s} />)}
                  <span className="muted small">
                    {a.leadTimeDays}-day lead · {a.costDeltaPct >= 0 ? '+' : ''}{a.costDeltaPct.toFixed(0)}% unit cost · {a.stats ? `reliability ${a.stats.score}/100` : 'no delivery history'}
                  </span>
                </div>
                <div className="small secondary">{a.verdict}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3>Suggested options</h3>
        <ul className="recs">
          {alert.recommendations.map((r) => (
            <li key={r}><Lightbulb size={15} /> <span>{r}</span></li>
          ))}
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>Suggestions only — KingslakeAI never places orders or changes the schedule. You decide.</p>
      </section>

      <section>
        <div className="btn-row">
          <button className="btn primary" onClick={() => setDraftOpen(true)}><Mail size={15} /> Draft supplier follow-up</button>
          <button className="btn" onClick={() => setAssignOpen(true)}><UserPlus size={15} /> Assign</button>
          <button
            className="btn"
            disabled={state.status === 'acknowledged' || state.status === 'resolved'}
            onClick={() => { updateAlert(alert.id, { ...state, status: 'acknowledged' }); toast('Alert acknowledged'); }}
          >
            <Check size={15} /> Acknowledge
          </button>
          <button className="btn ghost" onClick={() => { ask(`Tell me about ${m.code}`); go('assistant'); }}><MessageSquare size={15} /> Ask about this</button>
          <button className="btn ghost" onClick={() => openMaterial(m.id)}>Material view <ArrowRight size={15} /></button>
        </div>
      </section>

      {draftOpen && <DraftEmail alert={alert} onClose={() => setDraftOpen(false)} />}
      {assignOpen && (
        <Modal title="Assign alert" onClose={() => setAssignOpen(false)}>
          <p className="secondary" style={{ margin: 0 }}>Who should own “{alert.title}”?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PLANNERS.map((p) => (
              <button
                key={p}
                className={`btn ${state.assignee === p ? 'primary' : ''}`}
                style={{ justifyContent: 'flex-start' }}
                onClick={() => { updateAlert(alert.id, { ...state, status: 'assigned', assignee: p }); setAssignOpen(false); toast(`Assigned to ${p}`); }}
              >
                {p}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function draftFor(alert: Alert): { to: string; subject: string; body: string } {
  const m = alert.material;
  const s = supplierById.get(m.primarySupplierId)!;
  const firstOrder = alert.affectedOrders[0];
  const po = alert.reasons.find((r) => r.startsWith('PO-'))?.split(' ')[0];
  if (alert.type === 'End of life') {
    return {
      to: s.contact,
      subject: `Last-time-buy quotation – ${m.code}`,
      body: `Dear ${s.name} team,\n\nFollowing your end-of-life notice for ${m.code}, please quote a last-time-buy and confirm:\n\n• Maximum quantity available and price breaks\n• Latest order and final shipment dates\n• Availability of engineering samples of the recommended replacement for our qualification programme\n\nKind regards,\nProcurement – HITEC Sensor Developments`,
    };
  }
  return {
    to: s.contact,
    subject: `${po ? `${po} – ` : ''}${m.code}: request for firm delivery date`,
    body: `Dear ${s.name} team,\n\n${
      po ? `We are tracking ${po} for ${m.name} (${m.code}).` : `We are reviewing supply of ${m.name} (${m.code}).`
    } ${firstOrder ? `This material is required for production order ${firstOrder.order.id} starting ${fmtDate(firstOrder.order.jobStart, true)}.` : ''}\n\nCould you please confirm by return:\n\n• A firm dispatch date and expected arrival date at our site\n• Whether a partial shipment${firstOrder?.shortQty ? ` of at least ${fmtNum(firstOrder.shortQty)} ${m.uom}` : ''} can be dispatched earlier\n• Any risks to the remaining quantity\n\nThank you for your support.\n\nKind regards,\nProcurement – HITEC Sensor Developments`,
  };
}

function DraftEmail({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const { toast } = useApp();
  const d = draftFor(alert);
  const [body, setBody] = useState(d.body);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${d.to}\nSubject: ${d.subject}\n\n${body}`);
      toast('Draft copied to clipboard');
    } catch {
      toast('Copy failed — select the text manually');
    }
  };
  return (
    <Modal
      title="Draft supplier follow-up"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={copy}><Copy size={15} /> Copy draft</button>
        </>
      }
    >
      <div className="small secondary"><b>To:</b> {d.to}</div>
      <div className="small secondary"><b>Subject:</b> {d.subject}</div>
      <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="small muted">Drafted from the alert context. Nothing is sent automatically — review, edit and send from your own mailbox.</div>
    </Modal>
  );
}
