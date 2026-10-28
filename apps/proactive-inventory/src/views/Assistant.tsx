import { Database, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { answerQuestion, SUGGESTED_QUESTIONS, type Answer } from '../engine/nlq';
import { ARRIVAL_BASIS_LABEL } from '../engine/risk';
import { SimpleTable } from '../components/ui';
import { useApp } from '../state';

interface Msg { role: 'user' | 'ai'; text: string; answer?: Answer }

const WELCOME: Msg = {
  role: 'ai',
  text: 'Ask about material risk in plain language — production orders, POs, suppliers, reserved stock, obsolescence or safety buffers. Answers are computed from ERP data and show their sources.',
};

export function Assistant() {
  const { alerts, basis, pendingQuestion, ask } = useApp();
  const [log, setLog] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const submit = (q: string) => {
    const text = q.trim();
    if (!text || thinking) return;
    setLog((l) => [...l, { role: 'user', text }]);
    setInput('');
    setThinking(true);
    // Small delay so the exchange reads like a conversation.
    window.setTimeout(() => {
      const answer = answerQuestion(text, { alerts, basis });
      setLog((l) => [...l, { role: 'ai', text: answer.text, answer }]);
      setThinking(false);
    }, 450);
  };

  useEffect(() => {
    if (pendingQuestion) {
      submit(pendingQuestion);
      ask(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log, thinking]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ask KingslakeAI</h1>
          <p>No manual report-building — ask the question you would ask a colleague. Planning on: <b>{ARRIVAL_BASIS_LABEL[basis]}</b>.</p>
        </div>
      </div>
      <div className="card chat">
        <div className="chat-log">
          {log.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === 'ai' && <div className="avatar">K</div>}
              <div className="bubble">
                <div>{m.text}</div>
                {m.answer?.bullets && m.answer.bullets.length > 0 && (
                  <ul className="reasons">{m.answer.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                )}
                {m.answer?.table && (
                  <div className="card" style={{ boxShadow: 'none' }}>
                    <SimpleTable columns={m.answer.table.columns} rows={m.answer.table.rows} />
                  </div>
                )}
                {m.answer && m.answer.sources.length > 0 && (
                  <div className="sources"><Database size={12} /> Sources: {m.answer.sources.map((s) => <span key={s} className="tag">{s}</span>)}</div>
                )}
                {(m.answer?.followUps ?? (i === 0 ? SUGGESTED_QUESTIONS : [])).length > 0 && i === log.length - 1 && !thinking && (
                  <div className="btn-row">
                    {(m.answer?.followUps ?? SUGGESTED_QUESTIONS).map((f) => (
                      <button key={f} className="chip" onClick={() => submit(f)}>{f}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="msg ai">
              <div className="avatar">K</div>
              <div className="bubble"><span className="typing"><i /><i /><i /></span></div>
            </div>
          )}
          <div ref={end} />
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Which open production orders are at risk this month?" aria-label="Question" />
          <button className="btn primary" type="submit" disabled={!input.trim() || thinking}><Send size={15} /> Ask</button>
        </form>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Prototype note: questions are answered by a deterministic intent engine over the demo data. In the product, a managed language model calls the same read-only data tools, so answers stay grounded in the ERP and cite their sources.
      </p>
    </>
  );
}
