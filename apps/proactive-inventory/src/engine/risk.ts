// Material-risk engine. Pure functions over the ERP-shaped data: everything the
// UI shows (alerts, projections, scores, recommendations) is derived here, so
// a real ERP feed could replace the mock data without touching the views.
import {
  AS_OF,
  materials,
  productionOrders,
  purchaseOrders,
  receiptHistory,
  reservations,
  stockIssues,
  supplierEmails,
  suppliers,
} from '../data/mockData';
import type { Material, ProductionOrder, PurchaseOrder, Sector, SupplierEmail } from '../data/types';
import { addDays, daysBetween, fmtDate, maxDate } from './dates';

export const HORIZON_DAYS = 95;
export const HORIZON_END = addDays(AS_OF, HORIZON_DAYS);
/** Customer requalification time for a material/vendor change (scope §1). */
export const REQUAL_DAYS: Record<Sector, number> = { Aerospace: 180, Industrial: 75 };
const ON_TIME_GRACE_DAYS = 2;

/** Which arrival date to plan against: the PO due date, or a supplier-history-adjusted estimate. */
export type ArrivalBasis = 'due' | 'p50' | 'p80';
export const ARRIVAL_BASIS_LABEL: Record<ArrivalBasis, string> = {
  due: 'PO due date',
  p50: 'Typical supplier delay',
  p80: 'Cautious (P80 delay)',
};

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const materialById = new Map(materials.map((m) => [m.id, m]));
export const supplierById = new Map(suppliers.map((s) => [s.id, s]));
export const orderById = new Map(productionOrders.map((o) => [o.id, o]));

// ---------------------------------------------------------------------------
// Supplier reliability (PO due date vs goods receipt date)
// ---------------------------------------------------------------------------

export interface SupplierStats {
  supplierId: string;
  count: number;
  onTimeRate: number;
  avgDelay: number;
  p50: number;
  p80: number;
  p90: number;
  recentAvg: number;
  priorAvg: number;
  trend: 'improving' | 'worsening' | 'stable';
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  history: { poId: string; materialId: string; dueDate: string; receiptDate: string; delay: number }[];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function computeSupplierStats(supplierId: string): SupplierStats | null {
  const history = receiptHistory
    .filter((r) => r.supplierId === supplierId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((r) => ({ ...r, delay: daysBetween(r.dueDate, r.receiptDate) }));
  if (!history.length) return null;

  const delays = history.map((h) => h.delay);
  const sorted = [...delays].sort((a, b) => a - b);
  const onTimeRate = delays.filter((d) => d <= ON_TIME_GRACE_DAYS).length / delays.length;
  const avgDelay = mean(delays);
  const recent = delays.slice(-6);
  const prior = delays.slice(0, -6);
  const recentAvg = mean(recent);
  const priorAvg = mean(prior.length ? prior : recent);
  const diff = recentAvg - priorAvg;
  const trend = diff > 2.5 ? 'worsening' : diff < -2.5 ? 'improving' : 'stable';
  const sd = Math.sqrt(mean(delays.map((d) => (d - avgDelay) ** 2)));

  // 60 pts for on-time performance, 40 pts for how late (and how unpredictable) the misses are.
  const lateness = Math.max(0, 40 - Math.max(0, avgDelay) * 2.2 - sd * 0.8);
  const score = Math.round(Math.min(100, onTimeRate * 60 + lateness - (trend === 'worsening' ? 5 : 0)));
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 45 ? 'C' : 'D';

  return {
    supplierId,
    count: history.length,
    onTimeRate,
    avgDelay,
    p50: percentile(sorted, 0.5),
    p80: percentile(sorted, 0.8),
    p90: percentile(sorted, 0.9),
    recentAvg,
    priorAvg,
    trend,
    score,
    grade,
    history,
  };
}

export const supplierStats = new Map(
  suppliers.map((s) => [s.id, computeSupplierStats(s.id)] as const),
);

// ---------------------------------------------------------------------------
// Expected arrival of open POs
// ---------------------------------------------------------------------------

export interface ArrivalEstimate {
  po: PurchaseOrder;
  arrival: string;
  slipDays: number;
  source: 'Supplier email' | 'Supplier history' | 'PO due date';
  note: string;
  signal?: SupplierEmail;
}

export function estimateArrival(po: PurchaseOrder, basis: ArrivalBasis): ArrivalEstimate {
  const signal = supplierEmails.find(
    (e) => e.extracted.poId === po.id && (e.extracted.type === 'Delay' || e.extracted.type === 'Confirmation'),
  );
  // 'due' is the plain ERP view. Otherwise a supplier's own statement beats statistics.
  if (signal?.extracted.newDate && basis !== 'due') {
    const arrival = signal.extracted.newDate;
    return {
      po,
      arrival,
      slipDays: daysBetween(po.dueDate, arrival),
      source: 'Supplier email',
      note: `${signal.extracted.summary} (confidence ${Math.round(signal.extracted.confidence * 100)}%)`,
      signal,
    };
  }
  const stats = supplierStats.get(po.supplierId);
  if (basis === 'due' || !stats) {
    return { po, arrival: maxDate(po.dueDate, AS_OF), slipDays: 0, source: 'PO due date', note: 'Planned on PO due date' };
  }
  const delay = Math.max(0, basis === 'p50' ? stats.p50 : stats.p80);
  const arrival = maxDate(addDays(po.dueDate, delay), AS_OF);
  return {
    po,
    arrival,
    slipDays: daysBetween(po.dueDate, arrival),
    source: 'Supplier history',
    note: `${supplierById.get(po.supplierId)?.name} is typically ${delay} day${delay === 1 ? '' : 's'} late at ${basis.toUpperCase()} (${stats.count} past receipts)`,
  };
}

// ---------------------------------------------------------------------------
// Stock projection per material
// ---------------------------------------------------------------------------

export interface DemandEvent { date: string; order: ProductionOrder; qty: number }
export interface ProjectionPoint { date: string; label: string; stock: number; demand: number; receipt: number }

export function demandFor(materialId: string): DemandEvent[] {
  return productionOrders
    .flatMap((o) => o.requirements.filter((r) => r.materialId === materialId).map((r) => ({ date: o.jobStart, order: o, qty: r.qty })))
    .filter((d) => d.date <= HORIZON_END)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function inboundFor(materialId: string, basis: ArrivalBasis): ArrivalEstimate[] {
  return purchaseOrders
    .filter((p) => p.materialId === materialId)
    .map((p) => estimateArrival(p, basis))
    .sort((a, b) => a.arrival.localeCompare(b.arrival));
}

export function projectStock(material: Material, basis: ArrivalBasis): ProjectionPoint[] {
  const demand = demandFor(material.id);
  const inbound = inboundFor(material.id, basis);
  const points: ProjectionPoint[] = [];
  let stock = material.onHand;
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const date = addDays(AS_OF, i);
    const receipt = inbound.filter((a) => a.arrival === date).reduce((s, a) => s + a.po.qty, 0);
    const out = demand.filter((d) => d.date === date).reduce((s, d) => s + d.qty, 0);
    // Receipts land before the job starts on the same day.
    stock += receipt - out;
    points.push({ date, label: fmtDate(date), stock, demand: out, receipt });
  }
  return points;
}

interface OrderImpact { order: ProductionOrder; date: string; stockAfter: number; shortQty: number }

function orderImpacts(material: Material, basis: ArrivalBasis): OrderImpact[] {
  const series = projectStock(material, basis);
  const byDate = new Map(series.map((p) => [p.date, p.stock]));
  // Attribute a shortage on a day to the orders consuming that day, in sequence.
  const out: OrderImpact[] = [];
  const demand = demandFor(material.id);
  const grouped = new Map<string, DemandEvent[]>();
  demand.forEach((d) => grouped.set(d.date, [...(grouped.get(d.date) ?? []), d]));
  grouped.forEach((events, date) => {
    let after = byDate.get(date) ?? 0;
    const dayOut = events.reduce((s, e) => s + e.qty, 0);
    let running = after + dayOut;
    events.forEach((e) => {
      running -= e.qty;
      out.push({ order: e.order, date, stockAfter: running, shortQty: Math.max(0, Math.min(e.qty, -running)) });
    });
    after = running;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertType = 'Shortage' | 'Supplier delay' | 'Below safety stock' | 'Allocation conflict' | 'Expiry' | 'End of life' | 'Excess stock';

export interface AlternateOption {
  supplierId: string;
  supplierName: string;
  qualified: boolean;
  qualifiedFor: Sector[];
  leadTimeDays: number;
  unitCost: number;
  costDeltaPct: number;
  earliestArrival: string;
  meetsNeedDate: boolean;
  verdict: string;
  stats: SupplierStats | null;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  material: Material;
  title: string;
  summary: string;
  reasons: string[];
  affectedOrders: { order: ProductionOrder; shortQty?: number; date?: string }[];
  recommendations: string[];
  alternates: AlternateOption[];
  /** Latest date by which a planner has to act for the main recommendation to still work. */
  decideBy?: string;
  valueAtRisk: number;
  sourceEmails: SupplierEmail[];
}

function alternatesFor(material: Material, sector: Sector, needDate: string): AlternateOption[] {
  return material.alternates.map((a) => {
    const qualified = a.qualifiedFor.includes(sector);
    const earliestArrival = addDays(AS_OF, a.leadTimeDays + (qualified ? 0 : REQUAL_DAYS[sector]));
    const meetsNeedDate = earliestArrival <= needDate;
    const name = supplierById.get(a.supplierId)?.name ?? a.supplierId;
    const costDeltaPct = ((a.unitCost - material.unitCost) / material.unitCost) * 100;
    let verdict: string;
    if (qualified && meetsNeedDate) verdict = `Qualified for ${sector.toLowerCase()} — can arrive ${fmtDate(earliestArrival)}, ${daysBetween(earliestArrival, needDate)} days before need.`;
    else if (qualified) verdict = `Qualified, but ${a.leadTimeDays}-day lead time lands ${fmtDate(earliestArrival)} — ${daysBetween(needDate, earliestArrival)} days after need. Consider a partial split.`;
    else verdict = `Not qualified for ${sector.toLowerCase()} — requalification ≈${Math.round(REQUAL_DAYS[sector] / 30)} months. Not a fix for this shortage; start now to de-risk later orders.`;
    return {
      supplierId: a.supplierId, supplierName: name, qualified, qualifiedFor: a.qualifiedFor, leadTimeDays: a.leadTimeDays,
      unitCost: a.unitCost, costDeltaPct, earliestArrival, meetsNeedDate, verdict, stats: supplierStats.get(a.supplierId) ?? null,
    };
  });
}

function shortageAlerts(basis: ArrivalBasis): Alert[] {
  const alerts: Alert[] = [];
  materials.forEach((m) => {
    const impacts = orderImpacts(m, basis);
    const planImpacts = orderImpacts(m, 'due');
    const short = impacts.filter((i) => i.shortQty > 0);
    const inbound = inboundFor(m.id, basis);
    const slipping = inbound.filter((a) => a.slipDays > 0);
    const emails = slipping.flatMap((a) => (a.signal ? [a.signal] : []));
    const supplier = supplierById.get(m.primarySupplierId)!;

    if (short.length) {
      const first = short[0];
      const plannedShort = planImpacts.some((i) => i.shortQty > 0);
      const delayDriven = !plannedShort && slipping.length > 0;
      const daysToFirst = daysBetween(AS_OF, first.date);
      const sector: Sector = short.some((s) => s.order.sector === 'Aerospace') ? 'Aerospace' : 'Industrial';
      const alts = alternatesFor(m, sector, first.date);
      const viableAlt = alts.find((a) => a.qualified && a.meetsNeedDate);
      const decideBy = maxDate(viableAlt ? addDays(first.date, -viableAlt.leadTimeDays) : addDays(first.date, -7), AS_OF);
      const severity: Severity =
        daysToFirst <= 30 || daysBetween(AS_OF, decideBy) <= 7 || (sector === 'Aerospace' && !viableAlt) ? 'critical' : 'high';
      const totalShort = short.reduce((s, i) => s + i.shortQty, 0);

      const reasons = [
        `Projected stock goes negative on ${fmtDate(first.date)} when ${first.order.id} (${first.order.product}) starts — short ${totalShort.toLocaleString()} ${m.uom} across ${short.length} order${short.length > 1 ? 's' : ''}.`,
        ...slipping.map((a) => `${a.po.id} (${a.po.qty.toLocaleString()} ${m.uom}) now expected ${fmtDate(a.arrival)} instead of ${fmtDate(a.po.dueDate)} — ${a.note}.`),
      ];
      if (!delayDriven) {
        const demandTotal = demandFor(m.id).reduce((s, d) => s + d.qty, 0);
        const supplyTotal = m.onHand + inbound.reduce((s, a) => s + a.po.qty, 0);
        reasons.push(
          supplyTotal < demandTotal
            ? `Open supply (${supplyTotal.toLocaleString()} ${m.uom} on hand + on order) does not cover ${demandTotal.toLocaleString()} ${m.uom} of scheduled demand.`
            : `Open POs arrive after the jobs that need them — supply timing, not quantity, is the gap.`,
        );
      }
      if (m.onHand < m.safetyStock) reasons.push(`Already below safety stock today (${m.onHand} vs ${m.safetyStock} ${m.uom}).`);

      const recs: string[] = [];
      if (viableAlt) recs.push(`Place a bridging order with ${viableAlt.supplierName} (qualified, ${viableAlt.leadTimeDays}-day lead time, ${viableAlt.costDeltaPct >= 0 ? '+' : ''}${viableAlt.costDeltaPct.toFixed(0)}% unit cost) for ~${Math.ceil(totalShort / m.orderMultiple) * m.orderMultiple} ${m.uom}.`);
      if (slipping.length) recs.push(`Escalate ${slipping.map((s) => s.po.id).join(', ')} with ${supplier.name}: ask for a partial early shipment covering ${fmtDate(first.date)}.`);
      recs.push(`Review sequence: consider moving ${first.order.id} later or pulling a non-dependent order forward.`);
      if (!m.alternates.some((a) => a.qualifiedFor.includes(sector))) recs.push(`No ${sector.toLowerCase()}-qualified alternate exists — raise with Design/Quality to start qualifying a second source (≈${Math.round(REQUAL_DAYS[sector] / 30)} months).`);

      alerts.push({
        id: `SHT-${m.id}`,
        type: delayDriven ? 'Supplier delay' : 'Shortage',
        severity,
        material: m,
        title: delayDriven
          ? `${m.code}: supplier delay will starve ${short.length} production order${short.length > 1 ? 's' : ''}`
          : `${m.code}: projected shortage for ${short.length} production order${short.length > 1 ? 's' : ''}`,
        summary: `${m.name} runs out on ${fmtDate(first.date)} (${daysToFirst} days). First affected: ${first.order.id} for ${first.order.customer}.`,
        reasons,
        affectedOrders: short.map((s) => ({ order: s.order, shortQty: s.shortQty, date: s.date })),
        recommendations: recs,
        alternates: alts,
        decideBy,
        valueAtRisk: totalShort * m.unitCost,
        sourceEmails: emails,
      });
      return;
    }

    // No outright shortage — flag projected dips below safety stock.
    const dips = impacts.filter((i) => i.stockAfter < m.safetyStock);
    if (dips.length) {
      const lowest = dips.reduce((a, b) => (b.stockAfter < a.stockAfter ? b : a));
      const stats = supplierStats.get(m.primarySupplierId);
      alerts.push({
        id: `SS-${m.id}`,
        type: 'Below safety stock',
        severity: 'medium',
        material: m,
        title: `${m.code}: projected to dip below safety stock`,
        summary: `Lowest point ${lowest.stockAfter.toLocaleString()} ${m.uom} on ${fmtDate(lowest.date)} vs safety stock ${m.safetyStock.toLocaleString()} ${m.uom}.`,
        reasons: [
          `After ${lowest.order.id} starts on ${fmtDate(lowest.date)} the projected balance is ${lowest.stockAfter.toLocaleString()} ${m.uom}.`,
          ...slipping.map((a) => `${a.po.id} expected ${fmtDate(a.arrival)} (${a.slipDays} days after due) — ${a.note}.`),
          ...(stats && stats.trend === 'worsening' ? [`${supplier.name}'s delivery performance is worsening: last 6 receipts averaged ${stats.recentAvg.toFixed(1)} days late vs ${stats.priorAvg.toFixed(1)} before.`] : []),
        ],
        affectedOrders: dips.map((d) => ({ order: d.order, date: d.date })),
        recommendations: [
          `Confirm a firm dispatch date for ${slipping.map((s) => s.po.id).join(', ') || 'the next PO'} with ${supplier.name}.`,
          'Review the recommended safety buffer for this material (Safety buffers tab).',
        ],
        alternates: alternatesFor(m, m.qualification, lowest.date),
        decideBy: maxDate(addDays(lowest.date, -14), AS_OF),
        valueAtRisk: 0,
        sourceEmails: emails,
      });
    }
  });
  return alerts;
}

export interface AllocationConflict {
  material: Material;
  reserved: { order: ProductionOrder; qty: number }[];
  reservedTotal: number;
  freeStock: number;
  drawnFromReserve: number;
  culprits: { orderId: string; qty: number; date: string; issuedBy: string }[];
}

export function allocationConflicts(): AllocationConflict[] {
  const byMaterial = new Map<string, typeof reservations>();
  reservations.forEach((r) => byMaterial.set(r.materialId, [...(byMaterial.get(r.materialId) ?? []), r]));
  const out: AllocationConflict[] = [];
  byMaterial.forEach((rs, materialId) => {
    const m = materialById.get(materialId)!;
    const reservedTotal = rs.reduce((s, r) => s + r.qty, 0);
    const freeStock = m.onHand - reservedTotal;
    const reservingOrders = new Set(rs.map((r) => r.orderId));
    const culprits = stockIssues.filter((i) => i.materialId === materialId && !reservingOrders.has(i.orderId));
    out.push({
      material: m,
      reserved: rs.map((r) => ({ order: orderById.get(r.orderId)!, qty: r.qty })),
      reservedTotal,
      freeStock,
      drawnFromReserve: Math.max(0, -freeStock),
      culprits,
    });
  });
  return out.sort((a, b) => b.drawnFromReserve - a.drawnFromReserve);
}

function allocationAlerts(): Alert[] {
  return allocationConflicts()
    .filter((c) => c.drawnFromReserve > 0)
    .map((c) => {
      const m = c.material;
      const firstReserved = [...c.reserved].sort((a, b) => a.order.jobStart.localeCompare(b.order.jobStart));
      // The reservation that is filled last is the one left short.
      const victim = firstReserved[firstReserved.length - 1];
      const aero = c.reserved.some((r) => r.order.sector === 'Aerospace');
      return {
        id: `ALC-${m.id}`,
        type: 'Allocation conflict' as const,
        severity: (aero ? 'high' : 'medium') as Severity,
        material: m,
        title: `${m.code}: ${c.drawnFromReserve.toLocaleString()} ${m.uom} of reserved stock consumed by another order`,
        summary: `${c.reservedTotal.toLocaleString()} ${m.uom} is earmarked for ${c.reserved.map((r) => r.order.id).join(' & ')}, but only ${m.onHand.toLocaleString()} ${m.uom} is on hand.`,
        reasons: [
          ...c.culprits.map((i) => `${i.date === AS_OF ? 'Today' : fmtDate(i.date)}: ${i.qty.toLocaleString()} ${m.uom} issued to ${i.orderId} (not a reserving order) by ${i.issuedBy}.`),
          `Reservations: ${c.reserved.map((r) => `${r.order.id} ${r.qty.toLocaleString()} ${m.uom} (starts ${fmtDate(r.order.jobStart)})`).join('; ')}.`,
          `${victim.order.id} (${victim.order.customer}) is the reservation left uncovered if nothing changes.`,
        ],
        affectedOrders: [{ order: victim.order, shortQty: c.drawnFromReserve, date: victim.order.jobStart }],
        recommendations: [
          `Re-establish the reserve: expedite inbound supply or cover ${c.drawnFromReserve} ${m.uom} for ${victim.order.id} before ${fmtDate(victim.order.jobStart)}.`,
          'Ask Stores to require a planner override when issuing against reserved stock (ERP soft-allocation warning).',
        ],
        alternates: [],
        decideBy: maxDate(addDays(victim.order.jobStart, -m.leadTimeDays), AS_OF),
        valueAtRisk: c.drawnFromReserve * m.unitCost,
        sourceEmails: [],
      };
    });
}

export interface ObsolescenceItem {
  material: Material;
  kind: 'Expiry' | 'Excess stock' | 'End of life';
  qtyAtRisk: number;
  valueAtRisk: number;
  date?: string;
  detail: string;
  recommendation: string;
  lastTimeBuyQty?: number;
}

export function obsolescenceItems(): ObsolescenceItem[] {
  const items: ObsolescenceItem[] = [];
  materials.forEach((m) => {
    const demand = demandFor(m.id);

    // Shelf-life: consume lots FIFO against scheduled demand; whatever is left at expiry is at risk.
    const lots = [...m.lots].sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
    const remaining = demand.map((d) => ({ ...d }));
    lots.forEach((lot) => {
      let qty = lot.qty;
      remaining.forEach((d) => {
        if (qty <= 0 || d.qty <= 0 || (lot.expiryDate && d.date > lot.expiryDate)) return;
        const take = Math.min(qty, d.qty);
        qty -= take;
        d.qty -= take;
      });
      if (lot.expiryDate && lot.expiryDate <= addDays(AS_OF, 120) && qty > 0) {
        items.push({
          material: m,
          kind: 'Expiry',
          qtyAtRisk: qty,
          valueAtRisk: qty * m.unitCost,
          date: lot.expiryDate,
          detail: `Lot ${lot.lotId}: ${qty} of ${lot.qty} ${m.uom} will not be consumed by scheduled jobs before it expires on ${fmtDate(lot.expiryDate)} (${daysBetween(AS_OF, lot.expiryDate)} days).`,
          recommendation: `Use lot ${lot.lotId} first (FIFO by expiry), pull forward work that uses ${m.code}, and hold the next replenishment order.`,
        });
      }
    });

    // Excess / slow-moving: stock with no demand on the horizon and no issue in 6+ months.
    const idleDays = daysBetween(m.lastIssueDate, AS_OF);
    if (!demand.length && m.onHand > 0 && idleDays > 180) {
      items.push({
        material: m,
        kind: 'Excess stock',
        qtyAtRisk: m.onHand,
        valueAtRisk: m.onHand * m.unitCost,
        detail: `${m.onHand} ${m.uom} on hand, no scheduled demand in the next ${HORIZON_DAYS} days and no issues for ${idleDays} days.`,
        recommendation: 'Review with Design whether it can be used under deviation on industrial orders; otherwise disposition (return / sell / scrap) before value erodes further.',
      });
    }

    // End-of-life notices extracted from supplier correspondence.
    supplierEmails
      .filter((e) => e.extracted.type === 'EOL' && e.extracted.materialId === m.id)
      .forEach((e) => {
        const monthlyDemand = (demand.reduce((s, d) => s + d.qty, 0) / HORIZON_DAYS) * 30;
        // Cover demand until a replacement can be requalified, plus a 2-month cushion.
        const coverMonths = REQUAL_DAYS[m.qualification] / 30 + 2;
        const inbound = purchaseOrders.filter((p) => p.materialId === m.id).reduce((s, p) => s + p.qty, 0);
        const need = Math.max(0, Math.ceil(monthlyDemand * coverMonths) - m.onHand - inbound + m.safetyStock);
        const ltb = Math.ceil(need / m.orderMultiple) * m.orderMultiple;
        items.push({
          material: m,
          kind: 'End of life',
          qtyAtRisk: ltb,
          valueAtRisk: ltb * m.unitCost,
          date: e.extracted.lastTimeBuyDate,
          detail: `${supplierById.get(e.supplierId)?.name}: ${e.extracted.summary} Current run-rate ≈${Math.round(monthlyDemand)} ${m.uom}/month.`,
          recommendation: `Plan a last-time-buy of ≈${ltb.toLocaleString()} ${m.uom} (covers ${coverMonths} months incl. ${Math.round(REQUAL_DAYS[m.qualification] / 30)}-month ${m.qualification.toLowerCase()} requalification of the replacement) and start qualifying AFE-24B now.`,
          lastTimeBuyQty: ltb,
        });
      });
  });
  return items;
}

function obsolescenceAlerts(): Alert[] {
  return obsolescenceItems().map((o) => ({
    id: `OBS-${o.kind.replace(/\s/g, '')}-${o.material.id}`,
    type: o.kind,
    severity: (o.kind === 'End of life' ? 'high' : o.kind === 'Expiry' && o.date && daysBetween(AS_OF, o.date) < 30 ? 'high' : 'medium') as Severity,
    material: o.material,
    title:
      o.kind === 'End of life'
        ? `${o.material.code}: supplier end-of-life — last-time-buy by ${fmtDate(o.date!, true)}`
        : o.kind === 'Expiry'
          ? `${o.material.code}: ${o.qtyAtRisk} ${o.material.uom} will expire unused on ${fmtDate(o.date!)}`
          : `${o.material.code}: ${o.qtyAtRisk} ${o.material.uom} slow-moving, no planned demand`,
    summary: o.detail,
    reasons: [o.detail],
    affectedOrders:
      o.kind === 'End of life'
        ? productionOrders.filter((p) => p.requirements.some((r) => r.materialId === o.material.id)).map((order) => ({ order }))
        : [],
    recommendations: [o.recommendation],
    alternates: o.kind === 'End of life' ? alternatesFor(o.material, o.material.qualification, o.date ?? HORIZON_END) : [],
    decideBy: o.kind === 'End of life' ? o.date : o.date ? addDays(o.date, -14) : undefined,
    valueAtRisk: o.valueAtRisk,
    sourceEmails: supplierEmails.filter((e) => e.extracted.type === 'EOL' && e.extracted.materialId === o.material.id),
  }));
}

export function computeAlerts(basis: ArrivalBasis): Alert[] {
  return [...shortageAlerts(basis), ...allocationAlerts(), ...obsolescenceAlerts()].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.decideBy ?? '9999').localeCompare(b.decideBy ?? '9999'),
  );
}

// ---------------------------------------------------------------------------
// Safety-buffer guidance
// ---------------------------------------------------------------------------

export interface BufferRecommendation {
  material: Material;
  dailyDemand: number;
  p90Delay: number;
  current: number;
  recommended: number;
  delta: number;
  costImpact: number;
  rationale: string;
}

export function bufferRecommendations(): BufferRecommendation[] {
  return materials
    .map((m) => {
      const demand = demandFor(m.id).reduce((s, d) => s + d.qty, 0);
      const dailyDemand = demand / HORIZON_DAYS;
      const stats = supplierStats.get(m.primarySupplierId);
      const p90Delay = Math.max(0, stats?.p90 ?? 0);
      // Cover the supplier's P90 lateness plus a 25% allowance on the quoted lead time.
      // Demand arrives in job-sized lumps, so never go below half the largest single job
      // (the whole job when the supplier is routinely more than a week late).
      const coverDays = p90Delay + m.leadTimeDays * 0.25;
      const largestJob = Math.max(0, ...demandFor(m.id).map((d) => d.qty));
      const lumpFloor = largestJob * (p90Delay > 7 ? 1 : 0.5);
      const raw = Math.max(dailyDemand * coverDays, lumpFloor);
      const recommended = raw > 0 ? Math.ceil(raw / m.orderMultiple) * m.orderMultiple : 0;
      const delta = recommended - m.safetyStock;
      return {
        material: m,
        dailyDemand,
        p90Delay,
        current: m.safetyStock,
        recommended,
        delta,
        costImpact: delta * m.unitCost,
        rationale:
          dailyDemand * coverDays >= lumpFloor
            ? `${dailyDemand.toFixed(1)} ${m.uom}/day × ${coverDays.toFixed(0)} days (${p90Delay}-day P90 supplier delay + ${(m.leadTimeDays * 0.25).toFixed(0)}-day lead-time allowance), rounded to order multiple ${m.orderMultiple}.`
            : `Largest single job needs ${largestJob.toLocaleString()} ${m.uom}; with a ${p90Delay}-day P90 supplier delay the buffer should cover ${p90Delay > 7 ? 'one full job' : 'half a job'}. Rounded to order multiple ${m.orderMultiple}.`,
      };
    })
    .filter((b) => b.dailyDemand > 0)
    .sort((a, b) => Math.abs(b.costImpact) - Math.abs(a.costImpact));
}

// ---------------------------------------------------------------------------
// Consolidated status
// ---------------------------------------------------------------------------

export interface MaterialStatus {
  material: Material;
  severity: Severity | 'ok';
  alerts: Alert[];
  demand90: number;
  onOrder: number;
  nextArrival?: ArrivalEstimate;
  minProjected: number;
  coverDays: number | null;
}

export function materialStatuses(alerts: Alert[], basis: ArrivalBasis): MaterialStatus[] {
  return materials.map((m) => {
    const own = alerts.filter((a) => a.material.id === m.id);
    const projection = projectStock(m, basis);
    const demand90 = demandFor(m.id).reduce((s, d) => s + d.qty, 0);
    const inbound = inboundFor(m.id, basis);
    const firstNegative = projection.find((p) => p.stock < 0);
    return {
      material: m,
      severity: own.length ? own.reduce((s, a) => (SEVERITY_RANK[a.severity] < SEVERITY_RANK[s] ? a.severity : s), 'low' as Severity) : 'ok',
      alerts: own,
      demand90,
      onOrder: inbound.reduce((s, a) => s + a.po.qty, 0),
      nextArrival: inbound[0],
      minProjected: Math.min(...projection.map((p) => p.stock)),
      coverDays: demand90 ? (firstNegative ? daysBetween(AS_OF, firstNegative.date) : null) : null,
    };
  });
}
