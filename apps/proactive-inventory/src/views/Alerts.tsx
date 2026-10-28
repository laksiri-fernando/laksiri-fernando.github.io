import { useEffect, useState } from 'react';
import { AlertDetail } from '../components/AlertDetail';
import { SeverityBadge } from '../components/ui';
import { fmtDate, fmtMoney } from '../engine/dates';
import type { AlertType, Severity } from '../engine/risk';
import { useApp } from '../state';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium'];
const GROUPS: { label: string; types: AlertType[] }[] = [
  { label: 'Shortage & delay', types: ['Shortage', 'Supplier delay', 'Below safety stock'] },
  { label: 'Reserved stock', types: ['Allocation conflict'] },
  { label: 'Obsolescence', types: ['Expiry', 'End of life', 'Excess stock'] },
];

export function Alerts() {
  const { alerts, selectedAlertId, selectAlert, alertState } = useApp();
  const [sev, setSev] = useState<Severity | 'all'>('all');
  const [group, setGroup] = useState<string>('all');
  const [hideDone, setHideDone] = useState(false);

  const filtered = alerts.filter(
    (a) =>
      (sev === 'all' || a.severity === sev) &&
      (group === 'all' || GROUPS.find((g) => g.label === group)!.types.includes(a.type)) &&
      (!hideDone || (alertState[a.id]?.status ?? 'new') === 'new'),
  );
  const selected = filtered.find((a) => a.id === selectedAlertId) ?? filtered[0];

  useEffect(() => {
    // Switching the arrival basis can re-key an alert; keep a valid selection.
    if (selectedAlertId && !alerts.some((a) => a.id === selectedAlertId)) selectAlert(null);
  }, [alerts, selectedAlertId, selectAlert]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Risk alerts</h1>
          <p>Early warnings across shortages, supplier delays, reserved-stock conflicts and obsolescence. Every alert explains why it was raised and what the options are.</p>
        </div>
      </div>

      <div className="filters">
        <button className={`chip ${sev === 'all' ? 'on' : ''}`} onClick={() => setSev('all')}>All severities ({alerts.length})</button>
        {SEVERITIES.map((s) => (
          <button key={s} className={`chip ${sev === s ? 'on' : ''}`} onClick={() => setSev(s)}>
            {s[0].toUpperCase() + s.slice(1)} ({alerts.filter((a) => a.severity === s).length})
          </button>
        ))}
        <span style={{ width: 12 }} />
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Alert type">
          <option value="all">All types</option>
          {GROUPS.map((g) => <option key={g.label}>{g.label}</option>)}
        </select>
        <label className="small secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Only new
        </label>
      </div>

      <div className="split">
        <div className="card">
          <div className="alert-list">
            {filtered.length === 0 && <div className="empty">No alerts match these filters.</div>}
            {filtered.map((a) => {
              const st = alertState[a.id]?.status ?? 'new';
              return (
                <button key={a.id} className={`alert-row ${selected?.id === a.id ? 'selected' : ''} ${st !== 'new' ? 'done' : ''}`} onClick={() => selectAlert(a.id)}>
                  <span className={`sev-bar ${a.severity}`} />
                  <div className="body">
                    <span className="title">{a.title}</span>
                    <span className="meta">
                      <SeverityBadge severity={a.severity} />
                      <span>{a.type}</span>
                      {a.decideBy && <span>· decide by {fmtDate(a.decideBy)}</span>}
                      {a.valueAtRisk > 0 && <span>· {fmtMoney(a.valueAtRisk)}</span>}
                      {st !== 'new' && <span className="tag">{st === 'assigned' ? alertState[a.id]?.assignee : st}</span>}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {selected && <AlertDetail key={selected.id} alert={selected} />}
      </div>
    </>
  );
}
