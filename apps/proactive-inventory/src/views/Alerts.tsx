import { useState } from 'react';
import { AlertDetail } from '../components/AlertDetail';
import { Drawer, FilterChips, SeverityBadge, Stat } from '../components/ui';
import { AS_OF } from '../data/mockData';
import { addDays, fmtDate, fmtMoney } from '../engine/dates';
import type { AlertType, Severity } from '../engine/risk';
import { useApp } from '../state';

type SevFilter = Severity | 'all';
const GROUPS: { label: string; types: AlertType[] }[] = [
  { label: 'Shortage & delay', types: ['Shortage', 'Supplier delay', 'Below safety stock'] },
  { label: 'Reserved stock', types: ['Allocation conflict'] },
  { label: 'Obsolescence', types: ['Expiry', 'End of life', 'Excess stock'] },
];

export function Alerts() {
  const { alerts, selectedAlertId, selectAlert, alertState } = useApp();
  const [sev, setSev] = useState<SevFilter>('all');
  const [group, setGroup] = useState<string>('all');
  const [onlyNew, setOnlyNew] = useState(false);

  const status = (id: string) => alertState[id]?.status ?? 'new';
  const filtered = alerts.filter(
    (a) =>
      (sev === 'all' || a.severity === sev) &&
      (group === 'all' || GROUPS.find((g) => g.label === group)!.types.includes(a.type)) &&
      (!onlyNew || status(a.id) === 'new'),
  );
  const selected = alerts.find((a) => a.id === selectedAlertId);
  const in7 = addDays(AS_OF, 7);
  const dueSoon = alerts.filter((a) => a.decideBy && a.decideBy <= in7).length;
  const count = (s: Severity) => alerts.filter((a) => a.severity === s).length;

  return (
    <>
      <div className="page-head">
        <h1>Risk alerts</h1>
      </div>

      <div className="grid kpis">
        <Stat label="Open alerts" value={alerts.length} sub={`${alerts.filter((a) => status(a.id) === 'new').length} new · ${new Set(alerts.map((a) => a.material.id)).size} materials`} />
        <Stat label="Critical" value={count('critical')} sub={`${count('high')} high · ${count('medium')} medium`} />
        <Stat label="Decisions due in 7 days" value={dueSoon} sub={`by ${fmtDate(in7)}`} />
        <Stat label="Value at risk" value={fmtMoney(alerts.reduce((s, a) => s + a.valueAtRisk, 0))} sub="shortfall, write-off and last-time-buy" />
      </div>

      <div className="filters">
        <FilterChips<SevFilter>
          value={sev}
          onChange={setSev}
          options={[
            { id: 'all', label: 'All', count: alerts.length },
            { id: 'critical', label: 'Critical', count: count('critical') },
            { id: 'high', label: 'High', count: count('high') },
            { id: 'medium', label: 'Medium', count: count('medium') },
          ]}
        />
        <span style={{ width: 8 }} />
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Alert type">
          <option value="all">All types</option>
          {GROUPS.map((g) => <option key={g.label}>{g.label}</option>)}
        </select>
        <label className="small secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only new
        </label>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Severity</th><th>Alert</th><th>Type</th><th>Material</th><th className="num">Orders</th><th>Decide by</th><th className="num">Value at risk</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="empty">No alerts match these filters.</td></tr>}
              {filtered.map((a) => {
                const st = alertState[a.id];
                return (
                  <tr key={a.id} className={`clickable ${selected?.id === a.id ? 'selected' : ''}`} onClick={() => selectAlert(a.id)}>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td style={{ maxWidth: 420 }}><div className="cell-title">{a.title}</div><div className="cell-sub">{a.summary}</div></td>
                    <td className="nowrap small">{a.type}</td>
                    <td><span className="code">{a.material.code}</span></td>
                    <td className="num">{a.affectedOrders.length || '—'}</td>
                    <td className="nowrap">{a.decideBy ? fmtDate(a.decideBy) : '—'}</td>
                    <td className="num">{a.valueAtRisk ? fmtMoney(a.valueAtRisk) : '—'}</td>
                    <td className="nowrap small">{!st || st.status === 'new' ? <span className="tag">New</span> : st.status === 'assigned' ? st.assignee : st.status[0].toUpperCase() + st.status.slice(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Drawer onClose={() => selectAlert(null)} title={<><span className="code" style={{ fontSize: 15 }}>{selected.material.code}</span> · {selected.type}</>} subtitle={selected.material.name}>
          <AlertDetail key={selected.id} alert={selected} />
        </Drawer>
      )}
    </>
  );
}
