// Illustrative data modelled on the HITEC scope (sensor manufacturing,
// aerospace + industrial). All companies, people and figures are fictitious.
import type {
  Material,
  ProductionOrder,
  PurchaseOrder,
  ReceiptHistory,
  Reservation,
  StockIssue,
  Supplier,
  SupplierEmail,
} from './types';

/** "Today" for the prototype — every projection is relative to this date. */
export const AS_OF = '2026-10-28';

export const suppliers: Supplier[] = [
  { id: 'SUP-01', name: 'Apex Strain Technologies', country: 'USA', contact: 'orders@apexstrain.example', publishesPcn: false },
  { id: 'SUP-02', name: 'Nordic Alloys AB', country: 'Sweden', contact: 'sales@nordicalloys.example', publishesPcn: false },
  { id: 'SUP-03', name: 'Pacific Microelectronics', country: 'Taiwan', contact: 'pcn@pacificmicro.example', publishesPcn: true },
  { id: 'SUP-04', name: 'Delta Connectors Ltd', country: 'UK', contact: 'cs@deltaconnectors.example', publishesPcn: true },
  { id: 'SUP-05', name: 'Meridian Adhesives GmbH', country: 'Germany', contact: 'service@meridian.example', publishesPcn: false },
  { id: 'SUP-06', name: 'Orion Cable Co.', country: 'India', contact: 'dispatch@orioncable.example', publishesPcn: false },
  { id: 'SUP-07', name: 'Zenith PCB Fab', country: 'China', contact: 'pm@zenithpcb.example', publishesPcn: false },
  { id: 'SUP-08', name: 'Helix Metals Inc.', country: 'USA', contact: 'quotes@helixmetals.example', publishesPcn: false },
  { id: 'SUP-09', name: 'Coastal Electronics', country: 'Singapore', contact: 'sales@coastal.example', publishesPcn: true },
  { id: 'SUP-10', name: 'Lanka Polymers', country: 'Sri Lanka', contact: 'orders@lankapolymers.example', publishesPcn: false },
  { id: 'SUP-11', name: 'Tokai Gauge Works', country: 'Japan', contact: 'export@tokaigauge.example', publishesPcn: false },
];

export const materials: Material[] = [
  {
    id: 'M01', code: 'SG-350-AERO', name: 'Foil strain gauge 350Ω (aero grade)', category: 'Sensing element', uom: 'pcs',
    onHand: 1200, safetyStock: 500, leadTimeDays: 42, moq: 500, orderMultiple: 100, unitCost: 4.2,
    primarySupplierId: 'SUP-01', qualification: 'Aerospace', alternates: [],
    lots: [{ lotId: 'L-2409', qty: 1200, receivedDate: '2026-09-12' }], lastIssueDate: '2026-10-21',
  },
  {
    id: 'M02', code: 'SS17-4-D25', name: 'Stainless 17-4PH bar Ø25 mm', category: 'Raw material', uom: 'kg',
    onHand: 300, safetyStock: 150, leadTimeDays: 56, moq: 200, orderMultiple: 50, unitCost: 18.5,
    primarySupplierId: 'SUP-02', qualification: 'Aerospace',
    alternates: [{ supplierId: 'SUP-08', qualifiedFor: ['Aerospace', 'Industrial'], leadTimeDays: 21, unitCost: 21.4 }],
    lots: [{ lotId: 'H-7781', qty: 300, receivedDate: '2026-08-30' }], lastIssueDate: '2026-10-19',
  },
  {
    id: 'M03', code: 'IC-AFE-24', name: '24-bit sensor analog front-end IC', category: 'Electronics', uom: 'pcs',
    onHand: 900, safetyStock: 250, leadTimeDays: 70, moq: 250, orderMultiple: 250, unitCost: 11.8,
    primarySupplierId: 'SUP-03', qualification: 'Aerospace',
    alternates: [{ supplierId: 'SUP-09', qualifiedFor: ['Industrial'], leadTimeDays: 49, unitCost: 10.9 }],
    lots: [{ lotId: 'D-2531', qty: 900, receivedDate: '2026-07-15' }], lastIssueDate: '2026-10-21',
  },
  {
    id: 'M04', code: 'CON-M12-8P', name: 'M12 8-pin panel connector', category: 'Interconnect', uom: 'pcs',
    onHand: 2400, safetyStock: 500, leadTimeDays: 35, moq: 500, orderMultiple: 100, unitCost: 6.1,
    primarySupplierId: 'SUP-04', qualification: 'Aerospace', alternates: [],
    lots: [{ lotId: 'C-1180', qty: 2400, receivedDate: '2026-09-28' }], lastIssueDate: '2026-10-24',
  },
  {
    id: 'M05', code: 'EPX-353', name: 'Two-part epoxy adhesive (gauge bonding)', category: 'Consumable', uom: 'kit',
    onHand: 140, safetyStock: 30, leadTimeDays: 28, moq: 20, orderMultiple: 10, unitCost: 85,
    primarySupplierId: 'SUP-05', qualification: 'Aerospace', alternates: [],
    lots: [
      { lotId: 'E-0611', qty: 60, receivedDate: '2026-06-11', expiryDate: '2026-12-10' },
      { lotId: 'E-0902', qty: 80, receivedDate: '2026-09-02', expiryDate: '2027-03-02' },
    ],
    lastIssueDate: '2026-10-21',
  },
  {
    id: 'M06', code: 'CBL-SH-4C', name: 'Shielded 4-core PUR cable', category: 'Interconnect', uom: 'm',
    onHand: 3200, safetyStock: 1500, leadTimeDays: 30, moq: 1000, orderMultiple: 500, unitCost: 1.35,
    primarySupplierId: 'SUP-06', qualification: 'Industrial',
    alternates: [{ supplierId: 'SUP-04', qualifiedFor: ['Industrial'], leadTimeDays: 14, unitCost: 1.62 }],
    lots: [{ lotId: 'W-3302', qty: 3200, receivedDate: '2026-09-05' }], lastIssueDate: '2026-10-22',
  },
  {
    id: 'M07', code: 'PCB-LCA-R3', name: 'Load-cell amplifier PCB (rev 3)', category: 'Electronics', uom: 'pcs',
    onHand: 320, safetyStock: 150, leadTimeDays: 35, moq: 100, orderMultiple: 50, unitCost: 14.0,
    primarySupplierId: 'SUP-07', qualification: 'Aerospace', alternates: [],
    lots: [{ lotId: 'P-3R-0915', qty: 320, receivedDate: '2026-09-15' }], lastIssueDate: '2026-10-22',
  },
  {
    id: 'M08', code: 'PCB-LCA-R2', name: 'Load-cell amplifier PCB (rev 2, superseded)', category: 'Electronics', uom: 'pcs',
    onHand: 650, safetyStock: 0, leadTimeDays: 35, moq: 100, orderMultiple: 50, unitCost: 14.0,
    primarySupplierId: 'SUP-07', qualification: 'Aerospace', alternates: [],
    lots: [{ lotId: 'P-2R-2502', qty: 650, receivedDate: '2025-02-20' }], lastIssueDate: '2026-02-10',
  },
  {
    id: 'M09', code: 'ORG-VT-22', name: 'Viton O-ring 22 mm', category: 'Seal', uom: 'pcs',
    onHand: 5200, safetyStock: 1000, leadTimeDays: 21, moq: 1000, orderMultiple: 500, unitCost: 0.32,
    primarySupplierId: 'SUP-10', qualification: 'Industrial', alternates: [],
    lots: [{ lotId: 'R-1007', qty: 5200, receivedDate: '2026-10-07' }], lastIssueDate: '2026-10-22',
  },
  {
    id: 'M10', code: 'HSG-AL-60', name: 'Machined aluminium housing 60 mm', category: 'Mechanical', uom: 'pcs',
    onHand: 210, safetyStock: 80, leadTimeDays: 28, moq: 50, orderMultiple: 10, unitCost: 23.0,
    primarySupplierId: 'SUP-08', qualification: 'Industrial', alternates: [],
    lots: [{ lotId: 'A-0920', qty: 210, receivedDate: '2026-09-20' }], lastIssueDate: '2026-10-22',
  },
  {
    id: 'M11', code: 'SG-120-IND', name: 'Foil strain gauge 120Ω (industrial)', category: 'Sensing element', uom: 'pcs',
    onHand: 380, safetyStock: 400, leadTimeDays: 42, moq: 500, orderMultiple: 100, unitCost: 2.6,
    primarySupplierId: 'SUP-01', qualification: 'Industrial',
    alternates: [{ supplierId: 'SUP-11', qualifiedFor: ['Industrial'], leadTimeDays: 24, unitCost: 2.95 }],
    lots: [{ lotId: 'L-2405', qty: 380, receivedDate: '2026-08-14' }], lastIssueDate: '2026-10-22',
  },
  {
    id: 'M12', code: 'SLD-SAC305', name: 'Solder paste SAC305 (500 g jar)', category: 'Consumable', uom: 'jar',
    onHand: 18, safetyStock: 4, leadTimeDays: 14, moq: 6, orderMultiple: 6, unitCost: 62,
    primarySupplierId: 'SUP-05', qualification: 'Aerospace', alternates: [],
    lots: [
      { lotId: 'S-0515', qty: 12, receivedDate: '2026-05-15', expiryDate: '2026-11-15' },
      { lotId: 'S-1001', qty: 6, receivedDate: '2026-10-01', expiryDate: '2027-04-01' },
    ],
    lastIssueDate: '2026-10-14',
  },
];

export const productionOrders: ProductionOrder[] = [
  {
    id: 'WO-2607', product: 'Torque sensor TS-220', customer: 'AeroDyn Systems', sector: 'Aerospace', jobStart: '2026-11-09', qty: 200, status: 'Released',
    requirements: [{ materialId: 'M01', qty: 400 }, { materialId: 'M02', qty: 120 }, { materialId: 'M03', qty: 200 }, { materialId: 'M04', qty: 200 }, { materialId: 'M05', qty: 10 }, { materialId: 'M12', qty: 1 }],
  },
  {
    id: 'WO-2609', product: 'Load cell LC-500', customer: 'Atlas Weighing Systems', sector: 'Industrial', jobStart: '2026-11-10', qty: 250, status: 'Released',
    requirements: [{ materialId: 'M11', qty: 250 }, { materialId: 'M04', qty: 250 }, { materialId: 'M06', qty: 1000 }, { materialId: 'M10', qty: 60 }, { materialId: 'M09', qty: 500 }],
  },
  {
    id: 'WO-2611', product: 'Load pin LP-90', customer: 'Skyline Aerostructures', sector: 'Aerospace', jobStart: '2026-11-16', qty: 100, status: 'Planned',
    requirements: [{ materialId: 'M01', qty: 300 }, { materialId: 'M02', qty: 220 }, { materialId: 'M07', qty: 200 }, { materialId: 'M03', qty: 150 }, { materialId: 'M05', qty: 8 }],
  },
  {
    id: 'WO-2613', product: 'Tension link TL-30', customer: 'Harbor Crane Works', sector: 'Industrial', jobStart: '2026-11-24', qty: 200, status: 'Planned',
    requirements: [{ materialId: 'M11', qty: 200 }, { materialId: 'M06', qty: 1100 }, { materialId: 'M04', qty: 400 }, { materialId: 'M10', qty: 80 }, { materialId: 'M09', qty: 800 }],
  },
  {
    id: 'WO-2615', product: 'Torque sensor TS-220', customer: 'AeroDyn Systems', sector: 'Aerospace', jobStart: '2026-12-02', qty: 200, status: 'Planned',
    requirements: [{ materialId: 'M01', qty: 400 }, { materialId: 'M02', qty: 300 }, { materialId: 'M03', qty: 200 }, { materialId: 'M12', qty: 2 }, { materialId: 'M05', qty: 10 }],
  },
  {
    id: 'WO-2618', product: 'Load cell LC-500', customer: 'Atlas Weighing Systems', sector: 'Industrial', jobStart: '2026-12-07', qty: 180, status: 'Planned',
    requirements: [{ materialId: 'M07', qty: 180 }, { materialId: 'M11', qty: 150 }, { materialId: 'M06', qty: 900 }, { materialId: 'M04', qty: 300 }, { materialId: 'M10', qty: 50 }],
  },
  {
    id: 'WO-2620', product: 'Load pin LP-90', customer: 'Skyline Aerostructures', sector: 'Aerospace', jobStart: '2026-12-14', qty: 100, status: 'Planned',
    requirements: [{ materialId: 'M01', qty: 300 }, { materialId: 'M02', qty: 200 }, { materialId: 'M03', qty: 150 }, { materialId: 'M07', qty: 120 }],
  },
  {
    id: 'WO-2622', product: 'Tension link TL-30', customer: 'Harbor Crane Works', sector: 'Industrial', jobStart: '2027-01-05', qty: 220, status: 'Planned',
    requirements: [{ materialId: 'M06', qty: 1000 }, { materialId: 'M10', qty: 90 }, { materialId: 'M11', qty: 200 }, { materialId: 'M09', qty: 600 }],
  },
  {
    id: 'WO-2625', product: 'Torque sensor TS-220', customer: 'AeroDyn Systems', sector: 'Aerospace', jobStart: '2027-01-18', qty: 200, status: 'Planned',
    requirements: [{ materialId: 'M01', qty: 400 }, { materialId: 'M02', qty: 250 }, { materialId: 'M03', qty: 200 }, { materialId: 'M05', qty: 10 }, { materialId: 'M12', qty: 1 }],
  },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: 'PO-45110', line: 1, materialId: 'M02', supplierId: 'SUP-02', qty: 600, orderDate: '2026-09-18', dueDate: '2026-11-20', status: 'Confirmed' },
  { id: 'PO-45122', line: 1, materialId: 'M02', supplierId: 'SUP-02', qty: 400, orderDate: '2026-10-09', dueDate: '2027-01-08', status: 'Open' },
  { id: 'PO-45131', line: 1, materialId: 'M01', supplierId: 'SUP-01', qty: 1000, orderDate: '2026-09-30', dueDate: '2026-11-25', shipDate: '2026-10-25', status: 'Shipped' },
  { id: 'PO-45140', line: 1, materialId: 'M11', supplierId: 'SUP-01', qty: 800, orderDate: '2026-10-15', dueDate: '2026-11-30', status: 'Open' },
  { id: 'PO-45152', line: 1, materialId: 'M06', supplierId: 'SUP-06', qty: 3000, orderDate: '2026-09-22', dueDate: '2026-11-18', status: 'Open' },
  { id: 'PO-45160', line: 1, materialId: 'M07', supplierId: 'SUP-07', qty: 400, orderDate: '2026-10-20', dueDate: '2026-12-01', status: 'Confirmed' },
  { id: 'PO-45171', line: 1, materialId: 'M03', supplierId: 'SUP-03', qty: 500, orderDate: '2026-08-28', dueDate: '2026-12-10', status: 'Confirmed' },
  { id: 'PO-45180', line: 1, materialId: 'M10', supplierId: 'SUP-08', qty: 200, orderDate: '2026-10-16', dueDate: '2026-11-14', status: 'Open' },
  { id: 'PO-45190', line: 1, materialId: 'M04', supplierId: 'SUP-04', qty: 1000, orderDate: '2026-10-25', dueDate: '2026-12-20', status: 'Open' },
  { id: 'PO-45201', line: 1, materialId: 'M05', supplierId: 'SUP-05', qty: 40, orderDate: '2026-10-26', dueDate: '2027-01-10', status: 'Open' },
];

/** Safety stock earmarked for specific production orders. */
export const reservations: Reservation[] = [
  { materialId: 'M07', orderId: 'WO-2611', qty: 200 },
  { materialId: 'M07', orderId: 'WO-2618', qty: 180 },
  { materialId: 'M02', orderId: 'WO-2607', qty: 120 },
  { materialId: 'M02', orderId: 'WO-2611', qty: 220 },
  { materialId: 'M01', orderId: 'WO-2607', qty: 400 },
];

/** Recent stock issues (goods issued to production). */
export const stockIssues: StockIssue[] = [
  { materialId: 'M07', orderId: 'WO-2604', qty: 220, date: '2026-10-22', issuedBy: 'Stores – shift B' },
  { materialId: 'M02', orderId: 'WO-2604', qty: 60, date: '2026-10-19', issuedBy: 'Stores – shift A' },
  { materialId: 'M01', orderId: 'WO-2604', qty: 300, date: '2026-10-21', issuedBy: 'Stores – shift A' },
  { materialId: 'M06', orderId: 'WO-2604', qty: 900, date: '2026-10-22', issuedBy: 'Stores – shift B' },
];

export const supplierEmails: SupplierEmail[] = [
  {
    id: 'EM-301', supplierId: 'SUP-02', from: 'Lars Holm <sales@nordicalloys.example>', subject: 'RE: PO 45110 – dispatch status', received: '2026-10-26',
    body: 'Hello, due to a furnace maintenance stop at our Sandviken mill the heat for your 17-4PH order has been rescheduled. We now expect to dispatch so that the material reaches you around 15 December. Apologies for the inconvenience.',
    extracted: { type: 'Delay', poId: 'PO-45110', materialId: 'M02', newDate: '2026-12-15', confidence: 0.94, summary: 'PO-45110 arrival moved from 20 Nov to ~15 Dec (mill maintenance).' },
  },
  {
    id: 'EM-302', supplierId: 'SUP-03', from: 'PCN Desk <pcn@pacificmicro.example>', subject: 'PCN-2026-118: End-of-life notice AFE-24 family', received: '2026-10-20',
    body: 'Pacific Microelectronics announces the end of life of the AFE-24 product family. Last-time-buy orders will be accepted until 31 January 2027, with final shipments by 30 June 2027. Recommended replacement: AFE-24B (pin compatible, requalification required).',
    extracted: { type: 'EOL', materialId: 'M03', lastTimeBuyDate: '2027-01-31', confidence: 0.98, summary: 'AFE-24 EOL — last-time-buy by 31 Jan 2027; replacement AFE-24B needs requalification.' },
  },
  {
    id: 'EM-303', supplierId: 'SUP-01', from: 'Apex Logistics <orders@apexstrain.example>', subject: 'Shipment notice PO 45131', received: '2026-10-25',
    body: 'Your order PO 45131 (1,000 pcs SG-350-AERO) has shipped via air freight, AWB 176-55120934. Estimated delivery 21 November.',
    extracted: { type: 'Confirmation', poId: 'PO-45131', materialId: 'M01', newDate: '2026-11-21', confidence: 0.91, summary: 'PO-45131 shipped 25 Oct; ETA 21 Nov.' },
  },
  {
    id: 'EM-304', supplierId: 'SUP-06', from: 'R. Kumar <dispatch@orioncable.example>', subject: 'RE: RE: PO 45152 status?', received: '2026-10-27',
    body: 'Sir, we are facing some shortage of copper rod this month. Production of your cable may slip by 2-3 weeks, we will try our best and revert with firm date.',
    extracted: { type: 'Delay', poId: 'PO-45152', materialId: 'M06', newDate: '2026-12-06', confidence: 0.68, summary: 'PO-45152 likely 2–3 weeks late (copper shortage) — no firm date given.' },
  },
  {
    id: 'EM-305', supplierId: 'SUP-05', from: 'Meridian Customer Service <service@meridian.example>', subject: 'Price adjustment from 1 January 2027', received: '2026-10-18',
    body: 'Due to raw material increases, list prices for EPX-353 and SAC305 paste will increase by 6% from 1 January 2027.',
    extracted: { type: 'PriceChange', materialId: 'M05', confidence: 0.88, summary: 'EPX-353 and SAC305 +6% from 1 Jan 2027.' },
  },
];

// ---------------------------------------------------------------------------
// Delivery history — generated deterministically so reliability scores are
// stable between reloads. Each supplier has a lateness profile in days.
// ---------------------------------------------------------------------------

interface Profile { mean: number; spread: number; drift: number; count: number; materialIds: string[] }

const profiles: Record<string, Profile> = {
  'SUP-01': { mean: 1, spread: 4, drift: 0, count: 22, materialIds: ['M01', 'M11'] },
  'SUP-02': { mean: 11, spread: 9, drift: 4, count: 16, materialIds: ['M02'] },
  'SUP-03': { mean: 3, spread: 6, drift: 0, count: 14, materialIds: ['M03'] },
  'SUP-04': { mean: 0, spread: 2, drift: 0, count: 20, materialIds: ['M04'] },
  'SUP-05': { mean: 2, spread: 4, drift: -3, count: 18, materialIds: ['M05', 'M12'] },
  'SUP-06': { mean: 6, spread: 7, drift: 9, count: 18, materialIds: ['M06'] },
  'SUP-07': { mean: 5, spread: 10, drift: 0, count: 16, materialIds: ['M07', 'M08'] },
  'SUP-08': { mean: 1, spread: 3, drift: 0, count: 15, materialIds: ['M10', 'M02'] },
  'SUP-10': { mean: -1, spread: 2, drift: 0, count: 20, materialIds: ['M09'] },
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function generateHistory(): ReceiptHistory[] {
  const rows: ReceiptHistory[] = [];
  let poSeq = 41000;
  Object.entries(profiles).forEach(([supplierId, p], si) => {
    const rand = mulberry32(1000 + si * 97);
    for (let i = 0; i < p.count; i++) {
      // Spread receipts over the last ~20 months, oldest first.
      const dueDate = addDays(AS_OF, -600 + Math.round((i / p.count) * 570) + Math.round(rand() * 10));
      const progress = i / (p.count - 1); // 0 → 1, used to apply the drift
      const noise = (rand() + rand() + rand() - 1.5) * p.spread * 1.6;
      const late = Math.round(p.mean + p.drift * (progress - 0.5) + noise);
      rows.push({
        poId: `PO-${poSeq++}`,
        supplierId,
        materialId: p.materialIds[i % p.materialIds.length],
        dueDate,
        receiptDate: addDays(dueDate, late),
        qty: 100 + Math.round(rand() * 900),
      });
    }
  });
  return rows;
}

export const receiptHistory: ReceiptHistory[] = generateHistory();
