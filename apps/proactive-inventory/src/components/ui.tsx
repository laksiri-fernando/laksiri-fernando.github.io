import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { Sector } from '../data/types';
import type { Severity } from '../engine/risk';

const SEV: Record<Severity | 'ok', { label: string; icon: LucideIcon }> = {
  critical: { label: 'Critical', icon: AlertOctagon },
  high: { label: 'High', icon: AlertTriangle },
  medium: { label: 'Medium', icon: AlertTriangle },
  low: { label: 'Low', icon: Info },
  ok: { label: 'OK', icon: CheckCircle2 },
};

export function SeverityBadge({ severity, label }: { severity: Severity | 'ok'; label?: string }) {
  const { label: l, icon: Icon } = SEV[severity];
  return (
    <span className={`badge sev-${severity}`}>
      <Icon size={13} aria-hidden /> {label ?? l}
    </span>
  );
}

export function SectorTag({ sector }: { sector: Sector }) {
  return <span className={`tag ${sector === 'Aerospace' ? 'aero' : ''}`}>{sector}</span>;
}

export function Card({ title, subtitle, actions, children, flush }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, onClick, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; onClick?: () => void; tone?: string }) {
  return (
    <div className={`card stat ${onClick ? 'clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span className="label">
        {Icon && <Icon size={14} aria-hidden style={tone ? { color: tone } : undefined} />} {label}
      </span>
      <span className="value">{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export function Drawer({ onClose, title, subtitle, children }: { onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="secondary small" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ onClose, title, children, footer }: { onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fn]);
}

export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <div className="meter" aria-hidden>
      <div style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function scoreColor(score: number) {
  return score >= 80 ? 'var(--good)' : score >= 65 ? 'var(--accent)' : score >= 45 ? 'var(--warning)' : 'var(--critical)';
}

export function SimpleTable({ columns, rows, numeric = [] }: { columns: string[]; rows: (string | number)[][]; numeric?: number[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={numeric.includes(i) ? 'num' : undefined}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className={[numeric.includes(ci) ? 'num' : '', String(cell).length <= 16 ? 'nowrap' : ''].join(' ').trim() || undefined}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
