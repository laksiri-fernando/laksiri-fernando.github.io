export type Sector = 'Aerospace' | 'Industrial';

export interface Supplier {
  id: string;
  name: string;
  country: string;
  contact: string;
  /** Published end-of-life / product change notices this supplier exposes. */
  publishesPcn: boolean;
}

export interface AlternateSource {
  supplierId: string;
  /** Sectors the alternate is already qualified for (customer-approved). */
  qualifiedFor: Sector[];
  leadTimeDays: number;
  unitCost: number;
}

export interface StockLot {
  lotId: string;
  qty: number;
  receivedDate: string;
  expiryDate?: string;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  uom: string;
  onHand: number;
  safetyStock: number;
  leadTimeDays: number;
  moq: number;
  orderMultiple: number;
  unitCost: number;
  primarySupplierId: string;
  /** Highest qualification level required by the products this material goes into. */
  qualification: Sector;
  alternates: AlternateSource[];
  lots: StockLot[];
  lastIssueDate: string;
}

export interface Requirement {
  materialId: string;
  qty: number;
}

export interface ProductionOrder {
  id: string;
  product: string;
  customer: string;
  sector: Sector;
  jobStart: string;
  qty: number;
  status: 'Planned' | 'Released' | 'In progress';
  requirements: Requirement[];
}

export interface PurchaseOrder {
  id: string;
  line: number;
  materialId: string;
  supplierId: string;
  qty: number;
  orderDate: string;
  /** PO due date — treated as the expected material arrival date (scope §11). */
  dueDate: string;
  shipDate?: string;
  status: 'Open' | 'Confirmed' | 'Shipped';
}

export interface ReceiptHistory {
  poId: string;
  supplierId: string;
  materialId: string;
  dueDate: string;
  receiptDate: string;
  qty: number;
}

export interface Reservation {
  materialId: string;
  orderId: string;
  qty: number;
}

export interface StockIssue {
  materialId: string;
  orderId: string;
  qty: number;
  date: string;
  issuedBy: string;
}

export type SignalType = 'Delay' | 'Confirmation' | 'EOL' | 'PriceChange';

export interface SupplierEmail {
  id: string;
  supplierId: string;
  from: string;
  subject: string;
  received: string;
  body: string;
  /** Structured signal extracted from the unstructured email by the AI layer. */
  extracted: {
    type: SignalType;
    poId?: string;
    materialId?: string;
    newDate?: string;
    lastTimeBuyDate?: string;
    confidence: number;
    summary: string;
  };
}
