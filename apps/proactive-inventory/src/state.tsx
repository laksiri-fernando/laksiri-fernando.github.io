import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { computeAlerts, type Alert, type ArrivalBasis } from './engine/risk';

export type View = 'overview' | 'alerts' | 'materials' | 'orders' | 'suppliers' | 'allocation' | 'obsolescence' | 'buffers' | 'inbox' | 'assistant';

export interface AlertState {
  status: 'new' | 'acknowledged' | 'assigned' | 'resolved';
  assignee?: string;
  note?: string;
}

interface Ctx {
  view: View;
  go: (v: View, opts?: { alertId?: string }) => void;
  basis: ArrivalBasis;
  setBasis: (b: ArrivalBasis) => void;
  alerts: Alert[];
  alertState: Record<string, AlertState>;
  updateAlert: (id: string, s: AlertState) => void;
  selectedAlertId: string | null;
  selectAlert: (id: string | null) => void;
  materialId: string | null;
  openMaterial: (id: string | null) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  pendingQuestion: string | null;
  ask: (q: string | null) => void;
}

const AppCtx = createContext<Ctx | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — state just won't persist */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(() => {
    const h = window.location.hash.slice(1) as View;
    return h || 'overview';
  });
  const [basis, setBasisState] = useState<ArrivalBasis>(() => load('pim.basis', 'p50'));
  const [alertState, setAlertState] = useState<Record<string, AlertState>>(() => load('pim.alerts', {}));
  const [selectedAlertId, selectAlert] = useState<string | null>(null);
  const [materialId, openMaterial] = useState<string | null>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const [pendingQuestion, ask] = useState<string | null>(null);

  const alerts = useMemo(() => computeAlerts(basis), [basis]);

  useEffect(() => {
    const onHash = () => {
      setView((window.location.hash.slice(1) as View) || 'overview');
      openMaterial(null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((v: View, opts?: { alertId?: string }) => {
    if (opts?.alertId) selectAlert(opts.alertId);
    openMaterial(null);
    window.location.hash = v;
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const setBasis = useCallback((b: ArrivalBasis) => {
    setBasisState(b);
    save('pim.basis', b);
  }, []);

  const updateAlert = useCallback((id: string, s: AlertState) => {
    setAlertState((prev) => {
      const next = { ...prev, [id]: s };
      save('pim.alerts', next);
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const value: Ctx = {
    view, go, basis, setBasis, alerts, alertState, updateAlert, selectedAlertId, selectAlert,
    materialId, openMaterial, toast, toastMsg, pendingQuestion, ask,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}
