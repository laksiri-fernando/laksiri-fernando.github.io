// Natural-language query layer. In the prototype this is a deterministic intent
// parser over the risk engine; in production the same "tools" (alerts, orders,
// suppliers, obsolescence…) would be exposed to an LLM as read-only tool calls,
// so every answer stays grounded in ERP data and cites what it used.
import { AS_OF, materials, productionOrders, purchaseOrders, supplierEmails, suppliers } from '../data/mockData';
import type { Material, Sector } from '../data/types';
import { addDays, daysBetween, fmtDate, fmtMoney, fmtNum } from './dates';
import {
  allocationConflicts,
  ARRIVAL_BASIS_LABEL,
  bufferRecommendations,
  demandFor,
  estimateArrival,
  inboundFor,
  materialById,
  obsolescenceItems,
  projectStock,
  supplierById,
  supplierStats,
  type Alert,
  type ArrivalBasis,
} from './risk';

export interface Answer {
  text: string;
  table?: { columns: string[]; rows: (string | number)[][] };
  bullets?: string[];
  sources: string[];
  followUps: string[];
}

interface Ctx { alerts: Alert[]; basis: ArrivalBasis }

export const SUGGESTED_QUESTIONS = [
  'Which open production orders are at risk this month?',
  'Which suppliers are the least reliable?',
  'What inventory is at risk of becoming obsolete?',
  'Is any reserved stock being used by other orders?',
  'Are there alternate vendors for the 17-4PH bar?',
  'Which POs are expected to arrive late?',
  'What should I focus on today?',
  'Status of WO-2611',
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();

const MATERIAL_ALIASES: Record<string, string[]> = {
  M01: ['350', 'aero gauge', 'aero strain'],
  M02: ['17 4', '17 4ph', 'stainless', 'bar', 'steel'],
  M03: ['afe', 'front end', 'analog front', 'ic'],
  M04: ['connector', 'm12'],
  M05: ['epoxy', 'adhesive', 'glue'],
  M06: ['cable', 'pur'],
  M07: ['rev 3', 'rev3', 'r3', 'amplifier pcb', 'amplifier board'],
  M08: ['rev 2', 'rev2', 'r2', 'superseded'],
  M09: ['o ring', 'oring', 'viton', 'seal'],
  M10: ['housing', 'aluminium', 'aluminum'],
  M11: ['120', 'industrial gauge', 'industrial strain'],
  M12: ['solder', 'paste', 'sac305'],
};

function findMaterials(q: string): Material[] {
  const n = ` ${norm(q)} `;
  const hits = materials.filter((m) => {
    if (n.includes(` ${norm(m.code)} `) || n.includes(norm(m.code).replace(/ /g, ''))) return true;
    return MATERIAL_ALIASES[m.id].some((a) => n.includes(` ${a} `) || n.includes(` ${a}s `));
  });
  if (!hits.length && /strain gauge|gauge/.test(n)) return materials.filter((m) => m.category === 'Sensing element');
  if (!hits.length && /pcb|board/.test(n)) return materials.filter((m) => m.code.startsWith('PCB'));
  return hits;
}

function findSupplier(q: string) {
  const n = norm(q);
  return suppliers.find((s) => n.includes(norm(s.name).split(' ')[0]));
}

function findOrder(q: string) {
  const m = q.toUpperCase().match(/WO[-\s]?(\d{4})/);
  return m ? productionOrders.find((o) => o.id === `WO-${m[1]}`) : undefined;
}

function findCustomer(q: string) {
  const n = norm(q);
  return [...new Set(productionOrders.map((o) => o.customer))].find((c) => n.includes(norm(c).split(' ')[0]));
}

function findSector(q: string): Sector | undefined {
  const n = norm(q);
  if (/aero|aerospace/.test(n)) return 'Aerospace';
  if (/industrial/.test(n)) return 'Industrial';
  return undefined;
}

/** Parse a time window from the question. Returns an end date and a readable label. */
function parseWindow(q: string): { end: string; label: string } {
  const n = norm(q);
  const num = n.match(/next (\d+) (day|week|month)s?/);
  if (num) {
    const k = Number(num[1]);
    const days = num[2] === 'day' ? k : num[2] === 'week' ? k * 7 : k * 30;
    return { end: addDays(AS_OF, days), label: `in the next ${k} ${num[2]}${k > 1 ? 's' : ''}` };
  }
  if (/this week/.test(n)) return { end: addDays(AS_OF, 7), label: 'this week' };
  if (/next week/.test(n)) return { end: addDays(AS_OF, 14), label: 'by end of next week' };
  if (/next month/.test(n)) return { end: '2026-12-31', label: 'through end of December' };
  if (/this month|month/.test(n)) {
    // With only a few days left in the calendar month, a planner means "the coming month".
    return { end: addDays(AS_OF, 30), label: `in the next 30 days (to ${fmtDate(addDays(AS_OF, 30))})` };
  }
  if (/quarter|90/.test(n)) return { end: addDays(AS_OF, 90), label: 'in the next 90 days' };
  return { end: addDays(AS_OF, 95), label: 'on the planning horizon' };
}

const sevLabel = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------

function ordersAtRisk(q: string, ctx: Ctx): Answer {
  const { end, label } = parseWindow(q);
  const customer = findCustomer(q);
  const sector = findSector(q);
  const rows: { orderId: string; start: string; product: string; customer: string; material: string; issue: string; severity: string }[] = [];
  ctx.alerts.forEach((a) =>
    a.affectedOrders.forEach(({ order, shortQty }) => {
      if (order.jobStart > end) return;
      if (customer && order.customer !== customer) return;
      if (sector && order.sector !== sector) return;
      if (a.type === 'End of life' || a.type === 'Excess stock' || a.type === 'Expiry') return;
      rows.push({
        orderId: order.id,
        start: order.jobStart,
        product: order.product,
        customer: order.customer,
        material: a.material.code,
        issue: shortQty ? `${a.type}: short ${fmtNum(shortQty)} ${a.material.uom}` : a.type,
        severity: a.severity,
      });
    }),
  );
  rows.sort((a, b) => a.start.localeCompare(b.start));
  const uniqueOrders = [...new Set(rows.map((r) => r.orderId))];
  const scope = [customer, sector?.toLowerCase()].filter(Boolean).join(' / ');
  if (!rows.length) {
    return {
      text: `No ${scope ? scope + ' ' : ''}production orders are at risk ${label}, planning on ${ARRIVAL_BASIS_LABEL[ctx.basis].toLowerCase()}.`,
      sources: ['Production orders (ERP job start dates)', 'Open purchase orders', 'Stock levels'],
      followUps: ['Which production orders are at risk in the next 60 days?', 'Which POs are expected to arrive late?'],
    };
  }
  const shortRows = rows.filter((r) => r.issue.includes('short'));
  return {
    text: `${uniqueOrders.length} ${scope ? scope + ' ' : ''}production order${uniqueOrders.length > 1 ? 's are' : ' is'} at risk ${label} (${uniqueOrders.join(', ')}). ${
      shortRows.length ? `The earliest is ${rows[0].orderId} on ${fmtDate(rows[0].start)}, which needs ${rows[0].material}.` : ''
    } Arrival dates are based on ${ARRIVAL_BASIS_LABEL[ctx.basis].toLowerCase()}.`,
    table: {
      columns: ['Order', 'Job start', 'Product', 'Customer', 'Material', 'Issue', 'Severity'],
      rows: rows.map((r) => [r.orderId, fmtDate(r.start), r.product, r.customer, r.material, r.issue, sevLabel(r.severity)]),
    },
    sources: ['Production orders (ERP job start dates)', 'Open purchase orders + supplier emails', 'Stock levels & reservations', 'Supplier delivery history'],
    followUps: [`Status of ${rows[0].orderId}`, `Are there alternate vendors for ${rows[0].material}?`, 'What should I focus on today?'],
  };
}

function supplierRanking(q: string): Answer {
  const best = /best|most reliable|top/.test(norm(q));
  const ranked = suppliers
    .map((s) => ({ s, st: supplierStats.get(s.id) }))
    .filter((x) => x.st)
    .sort((a, b) => (best ? b.st!.score - a.st!.score : a.st!.score - b.st!.score));
  const worst = ranked[0];
  return {
    text: best
      ? `${worst.s.name} is the most reliable supplier (score ${worst.st!.score}, ${Math.round(worst.st!.onTimeRate * 100)}% on time).`
      : `${worst.s.name} is the least reliable supplier: ${Math.round(worst.st!.onTimeRate * 100)}% on time, ${worst.st!.avgDelay.toFixed(1)} days late on average, and 1 in 5 deliveries is ${worst.st!.p80}+ days late. ${
          ranked.filter((r) => r.st!.trend === 'worsening').map((r) => r.s.name).join(' and ') || 'No supplier'
        } ${ranked.filter((r) => r.st!.trend === 'worsening').length > 1 ? 'are' : 'is'} getting worse.`,
    table: {
      columns: ['Supplier', 'Score', 'On time', 'Avg delay', 'P80 delay', 'Trend', 'Receipts'],
      rows: ranked.map(({ s, st }) => [s.name, `${st!.score} (${st!.grade})`, `${Math.round(st!.onTimeRate * 100)}%`, `${st!.avgDelay.toFixed(1)} d`, `${st!.p80} d`, st!.trend, st!.count]),
    },
    sources: ['Goods-receipt history vs PO due date (last ~20 months)'],
    followUps: [`Tell me about ${worst.s.name}`, 'Which POs are expected to arrive late?', 'What safety buffers do you recommend?'],
  };
}

function supplierDetail(name: string, ctx: Ctx): Answer {
  const s = suppliers.find((x) => x.name === name)!;
  const st = supplierStats.get(s.id);
  const open = purchaseOrders.filter((p) => p.supplierId === s.id).map((p) => estimateArrival(p, ctx.basis));
  const mails = supplierEmails.filter((e) => e.supplierId === s.id);
  return {
    text: st
      ? `${s.name} (${s.country}) scores ${st.score}/100 (grade ${st.grade}): ${Math.round(st.onTimeRate * 100)}% on time over ${st.count} receipts, average ${st.avgDelay.toFixed(1)} days late, trend ${st.trend}.`
      : `${s.name} (${s.country}) has no delivery history with us yet — it is listed as an alternate source only.`,
    bullets: [
      ...open.map((a) => `${a.po.id}: ${fmtNum(a.po.qty)} ${materialById.get(a.po.materialId)?.uom} of ${materialById.get(a.po.materialId)?.code}, due ${fmtDate(a.po.dueDate)}, expected ${fmtDate(a.arrival)} (${a.source.toLowerCase()}).`),
      ...mails.map((e) => `Email ${fmtDate(e.received)}: ${e.extracted.summary}`),
    ],
    sources: ['Supplier master', 'Goods-receipt history', 'Open purchase orders', 'Supplier correspondence'],
    followUps: ['Which suppliers are the least reliable?', 'Which POs are expected to arrive late?'],
  };
}

function obsolescence(): Answer {
  const items = obsolescenceItems();
  const total = items.reduce((s, i) => s + i.valueAtRisk, 0);
  const writeOff = items.filter((i) => i.kind !== 'End of life').reduce((s, i) => s + i.valueAtRisk, 0);
  return {
    text: `${items.length} items need attention. ${fmtMoney(writeOff)} of current stock is at risk of expiry or obsolescence, and one end-of-life notice needs a last-time-buy decision (${fmtMoney(total - writeOff)}). For context, obsolete/excess stock has cost roughly $100k a year.`,
    table: {
      columns: ['Material', 'Risk', 'Qty', 'Value', 'When', 'Recommendation'],
      rows: items.map((i) => [i.material.code, i.kind, `${fmtNum(i.qtyAtRisk)} ${i.material.uom}`, fmtMoney(i.valueAtRisk), i.date ? fmtDate(i.date, true) : '—', i.recommendation]),
    },
    sources: ['Stock lots & expiry dates', 'Production demand (FIFO consumption)', 'Last-issue dates', 'Supplier PCN / EOL emails'],
    followUps: ['Tell me about IC-AFE-24', 'What should I focus on today?'],
  };
}

function allocation(): Answer {
  const conflicts = allocationConflicts();
  const bad = conflicts.filter((c) => c.drawnFromReserve > 0);
  return {
    text: bad.length
      ? `Yes. ${bad.map((c) => `${fmtNum(c.drawnFromReserve)} ${c.material.uom} of ${c.material.code} reserved for ${c.reserved.map((r) => r.order.id).join(' & ')} has been consumed by ${c.culprits.map((i) => i.orderId).join(', ')}`).join('; ')}.`
      : 'No — all reserved stock is still covered by on-hand inventory.',
    table: {
      columns: ['Material', 'On hand', 'Reserved', 'Free', 'Reserved for', 'Issued to others'],
      rows: conflicts.map((c) => [
        c.material.code,
        fmtNum(c.material.onHand),
        fmtNum(c.reservedTotal),
        fmtNum(c.freeStock),
        c.reserved.map((r) => `${r.order.id} (${fmtNum(r.qty)})`).join(', '),
        c.culprits.map((i) => `${i.orderId} ${fmtNum(i.qty)} on ${fmtDate(i.date)}`).join(', ') || '—',
      ]),
    },
    sources: ['Stock reservations', 'Goods issues to production (last 14 days)'],
    followUps: ['Status of WO-2611', 'Which open production orders are at risk this month?'],
  };
}

function alternates(ms: Material[], ctx: Ctx): Answer {
  const rows: (string | number)[][] = [];
  const bullets: string[] = [];
  ms.forEach((m) => {
    const alert = ctx.alerts.find((a) => a.material.id === m.id && a.alternates.length);
    if (!m.alternates.length) {
      bullets.push(`${m.code}: no alternate source on file. ${m.qualification} requalification of a new vendor takes ≈${m.qualification === 'Aerospace' ? 6 : '2–3'} months.`);
      return;
    }
    (alert?.alternates ?? []).forEach((a) =>
      rows.push([m.code, a.supplierName, a.qualifiedFor.join(', '), `${a.leadTimeDays} d`, `${a.costDeltaPct >= 0 ? '+' : ''}${a.costDeltaPct.toFixed(0)}%`, a.stats ? `${a.stats.score}` : 'new', a.verdict]),
    );
    if (!alert) {
      m.alternates.forEach((a) =>
        rows.push([m.code, supplierById.get(a.supplierId)!.name, a.qualifiedFor.join(', '), `${a.leadTimeDays} d`, `${(((a.unitCost - m.unitCost) / m.unitCost) * 100).toFixed(0)}%`, supplierStats.get(a.supplierId)?.score ?? 'new', 'No active risk on this material.']),
      );
    }
  });
  return {
    text: rows.length
      ? `Found ${rows.length} alternate source${rows.length > 1 ? 's' : ''}. Only vendors already qualified for the order's sector can be used without requalification.`
      : 'No alternate sources are on file for that material.',
    table: rows.length ? { columns: ['Material', 'Alternate', 'Qualified for', 'Lead time', 'Unit cost', 'Score', 'Assessment'], rows } : undefined,
    bullets,
    sources: ['Approved vendor list', 'Supplier lead times & pricing', 'Active risk alerts'],
    followUps: ms.map((m) => `Tell me about ${m.code}`).slice(0, 2),
  };
}

function latePOs(ctx: Ctx): Answer {
  const basis = ctx.basis === 'due' ? 'p50' : ctx.basis;
  const rows = purchaseOrders
    .map((p) => estimateArrival(p, basis))
    .filter((a) => a.slipDays > 0)
    .sort((a, b) => b.slipDays - a.slipDays);
  return {
    text: `${rows.length} of ${purchaseOrders.length} open POs are expected to arrive after their due date. ${rows.filter((r) => r.source === 'Supplier email').length} of these are confirmed by the supplier; the rest are estimated from each supplier's delivery history.`,
    table: {
      columns: ['PO', 'Material', 'Supplier', 'Due', 'Expected', 'Slip', 'Basis'],
      rows: rows.map((a) => [a.po.id, materialById.get(a.po.materialId)!.code, supplierById.get(a.po.supplierId)!.name, fmtDate(a.po.dueDate), fmtDate(a.arrival), `+${a.slipDays} d`, a.source]),
    },
    sources: ['Open purchase orders', 'Supplier emails (AI-extracted)', 'Supplier delivery history'],
    followUps: ['Which open production orders are at risk this month?', 'Which suppliers are the least reliable?'],
  };
}

function buffers(): Answer {
  const recs = bufferRecommendations().filter((b) => b.delta !== 0);
  const up = recs.filter((r) => r.delta > 0);
  const down = recs.filter((r) => r.delta < 0);
  return {
    text: `Raise safety stock on ${up.length} material${up.length === 1 ? '' : 's'} supplied by late or erratic vendors (+${fmtMoney(up.reduce((s, r) => s + r.costImpact, 0))}), and lower it on ${down.length} with reliable supply (releases ${fmtMoney(-down.reduce((s, r) => s + r.costImpact, 0))} of working capital). These are suggestions only — ERP values are unchanged.`,
    table: {
      columns: ['Material', 'Current', 'Recommended', 'Change', 'Cash impact', 'Why'],
      rows: recs.map((r) => [r.material.code, fmtNum(r.current), fmtNum(r.recommended), `${r.delta > 0 ? '+' : ''}${fmtNum(r.delta)}`, `${r.costImpact > 0 ? '+' : '−'}${fmtMoney(Math.abs(r.costImpact))}`, r.rationale]),
    },
    sources: ['Scheduled demand (90 days)', 'Supplier P90 delay', 'Lead time & order multiple'],
    followUps: ['Which suppliers are the least reliable?', 'What inventory is at risk of becoming obsolete?'],
  };
}

function materialDetail(m: Material, ctx: Ctx): Answer {
  const proj = projectStock(m, ctx.basis);
  const low = proj.reduce((a, b) => (b.stock < a.stock ? b : a));
  const alerts = ctx.alerts.filter((a) => a.material.id === m.id);
  const inbound = inboundFor(m.id, ctx.basis);
  const demand = demandFor(m.id);
  return {
    text: `${m.code} — ${m.name}: ${fmtNum(m.onHand)} ${m.uom} on hand (safety stock ${fmtNum(m.safetyStock)}), ${fmtNum(demand.reduce((s, d) => s + d.qty, 0))} ${m.uom} scheduled over the next ${daysBetween(AS_OF, proj[proj.length - 1].date)} days and ${fmtNum(inbound.reduce((s, a) => s + a.po.qty, 0))} on order. Projected low point: ${fmtNum(low.stock)} ${m.uom} on ${fmtDate(low.date)}.`,
    bullets: [
      ...alerts.map((a) => `${sevLabel(a.severity)} · ${a.title}`),
      ...inbound.map((a) => `Inbound ${a.po.id}: ${fmtNum(a.po.qty)} ${m.uom}, expected ${fmtDate(a.arrival)}${a.slipDays ? ` (+${a.slipDays} d vs due)` : ''}.`),
      ...(alerts.length ? [] : ['No active risk flags.']),
    ],
    sources: ['Stock levels', 'Production demand', 'Open purchase orders'],
    followUps: [`Are there alternate vendors for ${m.code}?`, 'Which open production orders are at risk this month?'],
  };
}

function orderDetail(orderId: string, ctx: Ctx): Answer {
  const o = productionOrders.find((x) => x.id === orderId)!;
  const rows = o.requirements.map((r) => {
    const m = materialById.get(r.materialId)!;
    const proj = projectStock(m, ctx.basis);
    const after = proj.find((p) => p.date === o.jobStart)?.stock ?? 0;
    const hits = ctx.alerts.filter((a) => a.material.id === m.id && a.affectedOrders.some((x) => x.order.id === o.id));
    const hit = hits.find((a) => a.type !== 'End of life');
    const eol = hits.some((a) => a.type === 'End of life');
    const status = hit
      ? `${sevLabel(hit.severity)} — ${hit.type}`
      : `${after < m.safetyStock ? 'Covered, below safety stock after' : 'Covered'}${eol ? ' · supplier EOL notice' : ''}`;
    return [m.code, `${fmtNum(r.qty)} ${m.uom}`, fmtNum(after), status];
  });
  const risky = rows.filter((r) => !String(r[3]).startsWith('Covered'));
  return {
    text: `${o.id} — ${o.product} × ${o.qty} for ${o.customer} (${o.sector.toLowerCase()}), job start ${fmtDate(o.jobStart, true)}, status ${o.status}. ${
      risky.length ? `${risky.length} of ${rows.length} materials are at risk: ${risky.map((r) => r[0]).join(', ')}.` : `All ${rows.length} materials are covered.`
    }`,
    table: { columns: ['Material', 'Required', 'Projected stock after start', 'Status'], rows },
    sources: ['Bill of materials', 'Stock projection', 'Active risk alerts'],
    followUps: ['Which open production orders are at risk this month?', ...risky.map((r) => `Are there alternate vendors for ${r[0]}?`).slice(0, 1)],
  };
}

function focusToday(ctx: Ctx): Answer {
  const top = ctx.alerts.slice(0, 5);
  return {
    text: `Here are the ${top.length} items to look at first, ordered by severity and decision deadline:`,
    table: {
      columns: ['Severity', 'Issue', 'Decide by', 'Value at risk'],
      rows: top.map((a) => [sevLabel(a.severity), a.title, a.decideBy ? fmtDate(a.decideBy) : '—', a.valueAtRisk ? fmtMoney(a.valueAtRisk) : '—']),
    },
    sources: ['All active risk alerts'],
    followUps: ['Which open production orders are at risk this month?', 'What inventory is at risk of becoming obsolete?'],
  };
}

function signals(): Answer {
  return {
    text: `${supplierEmails.length} supplier emails in the last 2 weeks contained actionable signals. Each was converted into a structured update and linked to the PO or material it refers to.`,
    table: {
      columns: ['Received', 'Supplier', 'Signal', 'Extracted', 'Confidence'],
      rows: supplierEmails.map((e) => [fmtDate(e.received), supplierById.get(e.supplierId)!.name, e.extracted.type, e.extracted.summary, `${Math.round(e.extracted.confidence * 100)}%`]),
    },
    sources: ['Procurement mailbox (read-only)'],
    followUps: ['Which POs are expected to arrive late?'],
  };
}

export function answerQuestion(q: string, ctx: Ctx): Answer {
  const n = norm(q);
  const order = findOrder(q);
  if (order) return orderDetail(order.id, ctx);
  if (/alternat|second source|other vendor|other supplier|substitut/.test(n)) {
    const ms = findMaterials(q);
    return alternates(ms.length ? ms : ctx.alerts.filter((a) => a.alternates.length).map((a) => a.material).filter((m, i, arr) => arr.indexOf(m) === i), ctx);
  }
  if (/obsolet|expir|excess|shelf|end of life|eol|write off|slow moving|dead stock/.test(n)) return obsolescence();
  if (/reserv|allocat|drawn|drawdown|earmark|planned stock|planned inventory/.test(n)) return allocation();
  if (/buffer|recommend.*safety|safety stock level|how much safety/.test(n)) return buffers();
  if (/email|signal|inbox|correspondence|message/.test(n)) return signals();
  if (/\b(po|pos)\b.*(late|delay|slip|overdue)|(purchase order|inbound|deliver|shipment).*(late|delay|slip|overdue)|(late|delayed|overdue).*(\bpos?\b|purchase|deliver|shipment)/.test(n)) return latePOs(ctx);
  const supplier = findSupplier(q);
  if (supplier) return supplierDetail(supplier.name, ctx);
  if (/supplier|vendor/.test(n)) return supplierRanking(q);
  if (/focus|priorit|today|top risk|biggest risk|summary|what should/.test(n)) return focusToday(ctx);
  if (/risk|short|starv|stock out|stockout|late|delay|order|job/.test(n) && !findMaterials(q).length) return ordersAtRisk(q, ctx);
  const ms = findMaterials(q);
  if (ms.length) return materialDetail(ms[0], ctx);
  if (/risk|short/.test(n)) return ordersAtRisk(q, ctx);
  return {
    text: "I can answer questions about material risk, production orders, purchase orders, suppliers, reserved stock, obsolescence and safety buffers. Try one of these:",
    sources: [],
    followUps: SUGGESTED_QUESTIONS.slice(0, 5),
  };
}
