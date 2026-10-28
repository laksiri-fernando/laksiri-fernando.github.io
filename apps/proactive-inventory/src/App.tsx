import {
  AlertTriangle, Bot, Boxes, Factory, Hourglass, Inbox as InboxIcon, LayoutDashboard, Lock, Menu, Shield, Truck,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { AS_OF } from './data/mockData';
import { fmtDate } from './engine/dates';
import { ARRIVAL_BASIS_LABEL, type ArrivalBasis } from './engine/risk';
import { MaterialDrawer } from './components/MaterialDrawer';
import { useApp, type View } from './state';
import { Alerts } from './views/Alerts';
import { Allocation } from './views/Allocation';
import { Assistant } from './views/Assistant';
import { Buffers } from './views/Buffers';
import { Inbox } from './views/Inbox';
import { Materials } from './views/Materials';
import { Obsolescence } from './views/Obsolescence';
import { Orders } from './views/Orders';
import { Overview } from './views/Overview';
import { Suppliers } from './views/Suppliers';

const NAV: { section: string; items: { id: View; label: string; icon: LucideIcon }[] }[] = [
  {
    section: 'Monitor',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'alerts', label: 'Risk alerts', icon: AlertTriangle },
      { id: 'assistant', label: 'Ask KingslakeAI', icon: Bot },
    ],
  },
  {
    section: 'Single view',
    items: [
      { id: 'materials', label: 'Materials', icon: Boxes },
      { id: 'orders', label: 'Production orders', icon: Factory },
      { id: 'suppliers', label: 'Suppliers', icon: Truck },
      { id: 'inbox', label: 'Supplier inbox', icon: InboxIcon },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { id: 'allocation', label: 'Reserved stock', icon: Lock },
      { id: 'obsolescence', label: 'Obsolescence', icon: Hourglass },
      { id: 'buffers', label: 'Safety buffers', icon: Shield },
    ],
  },
];

const VIEWS: Record<View, () => JSX.Element> = {
  overview: Overview, alerts: Alerts, materials: Materials, orders: Orders, suppliers: Suppliers,
  allocation: Allocation, obsolescence: Obsolescence, buffers: Buffers, inbox: Inbox, assistant: Assistant,
};

export default function App() {
  const { view, go, basis, setBasis, alerts, alertState, toastMsg } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const Current = VIEWS[view] ?? Overview;
  const openCritical = alerts.filter((a) => a.severity === 'critical' && (alertState[a.id]?.status ?? 'new') === 'new').length;

  return (
    <div className="app">
      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">K</div>
          <div>
            <div className="brand-name">KingslakeAI</div>
            <div className="brand-sub">Material Risk &amp; Monitoring</div>
          </div>
        </div>
        {NAV.map((g) => (
          <div key={g.section}>
            <div className="nav-section">{g.section}</div>
            {g.items.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { go(id); setMenuOpen(false); }}>
                <Icon size={16} aria-hidden /> {label}
                {id === 'alerts' && openCritical > 0 && <span className="count" aria-label={`${openCritical} new critical`}>{openCritical}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          Prototype · demo data for a sensor manufacturer (aerospace &amp; industrial). Read-only — no orders are placed.
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu"><Menu size={18} /></button>
          <span className="sync"><span className="dot" /> Kingslake ERP · synced {fmtDate(AS_OF, true)} 06:00</span>
          <span className="spacer" />
          <div className="basis">
            <span>Plan arrivals on</span>
            <div className="segmented" role="radiogroup" aria-label="Arrival basis">
              {(Object.keys(ARRIVAL_BASIS_LABEL) as ArrivalBasis[]).map((b) => (
                <button key={b} role="radio" aria-checked={basis === b} className={basis === b ? 'on' : ''} onClick={() => setBasis(b)} title={ARRIVAL_BASIS_LABEL[b]}>
                  {b === 'due' ? 'PO due date' : b === 'p50' ? 'Typical delay' : 'Cautious'}
                </button>
              ))}
            </div>
          </div>
        </header>
        <main className="content">
          <Current />
        </main>
      </div>
      {menuOpen && <div className="overlay" style={{ zIndex: 24 }} onClick={() => setMenuOpen(false)} />}
      <MaterialDrawer />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
