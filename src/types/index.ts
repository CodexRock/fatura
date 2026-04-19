// All money is stored as integers (centimes).
// Example: 4500.00 MAD = 450000 centimes.
// This convention prevents floating-point inaccuracies during arithmetic operations.

import type { Timestamp } from 'firebase/firestore';

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: 'MA';
}

export type TvaRegime = 'assujetti' | 'non_assujetti' | 'exonere';
export type LegalForm = 'auto_entrepreneur' | 'sarl' | 'sa' | 'sas' | 'snc' | 'personne_physique';

export interface BankDetails {
  bankName: string;
  rib: string;
  iban: string;
  swift: string;
}

export interface Subscription {
  plan: 'free' | 'starter' | 'pro' | 'fiduciaire';
  status: string;
  currentPeriodEnd: Timestamp;
}

export interface Business {
  id: string;
  ownerId: string; // Firebase Auth UID
  legalName: string;
  tradeName: string;
  ice: string; // 15-char string, Identifiant Commun de l'Entreprise
  identifiantFiscal?: string;
  registreCommerce?: string;
  cnss?: string;
  tvaRegime: TvaRegime;
  legalForm: LegalForm;
  address: Address;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  brandColor?: string;
  defaultPaymentTermsDays: number; // default 30
  defaultCurrency: 'MAD';
  bankDetails?: BankDetails;
  subscription: Subscription;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Client {
  id: string;
  businessId: string;
  name: string;
  ice?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address: Address;
  paymentTermsDays?: number;
  notes?: string;
  tags?: string[];
  totalInvoiced: number; // in centimes
  totalPaid: number; // in centimes
  balance: number; // in centimes
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TvaRate = 0 | 7 | 10 | 14 | 20;
export type ProductUnit = 'unit' | 'hour' | 'day' | 'kg' | 'm2' | 'forfait' | 'lot';

export interface Product {
  id: string;
  businessId: string;
  label: string;
  description?: string;
  unitPrice: number; // in centimes
  tvaRate: TvaRate;
  unit: ProductUnit;
  category?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Discount = {
  type: 'percentage' | 'fixed';
  value: number; // percentage value OR fixed amount in centimes
};

export interface InvoiceLine {
  id: string; // short UUID
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number; // in centimes
  tvaRate: TvaRate;
  discount?: Discount;
  totalHT: number; // in centimes
  totalTVA: number; // in centimes
  totalTTC: number; // in centimes
}

export type PaymentMethod = 'cash' | 'check' | 'virement' | 'carte' | 'mobile';

export interface Payment {
  id: string;
  date: Timestamp;
  amount: number; // in centimes
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export type InvoiceType = 'facture' | 'avoir' | 'proforma' | 'devis';
export type InvoiceStatus = 'draft' | 'sent' | 'validated' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
export type DgiStatus = 'pending' | 'validated' | 'rejected' | null;

export interface Invoice {
  id: string;
  businessId: string;
  clientId: string;
  number: string; // "F-YYYY-NNNN"
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: Timestamp;
  dueDate: Timestamp;
  lines: InvoiceLine[];
  notes?: string;
  internalNotes?: string;
  totals: {
    totalHT: number; // in centimes
    tvaBreakdown: {
      rate: number;
      base: number; // in centimes
      amount: number; // in centimes
    }[];
    totalTVA: number; // in centimes
    totalTTC: number; // in centimes
  };
  payments: Payment[];
  pdfUrl?: string;
  ublXml?: string;
  dgiValidationId?: string | null;
  dgiStatus: DgiStatus;
  sentAt?: Timestamp;
  paidAt?: Timestamp;
  cancelledAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InvoiceCounter {
  businessId: string;
  currentYear: number;
  lastNumber: number;
}

export interface ActivityLog {
  id: string;
  businessId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>; // JSON
  timestamp: Timestamp;
}

// Helpers
export type CreateDTO<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDTO<T> = Partial<Omit<T, 'id' | 'businessId'>>;

// Constants
export const TVA_RATES: TvaRate[] = [0, 7, 10, 14, 20];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, { fr: string; ar: string; color: string }> = {
  draft: { fr: 'Brouillon', ar: 'مسودة', color: 'bg-gray-100 text-gray-800' },
  sent: { fr: 'Envoyée', ar: 'مُرسلة', color: 'bg-blue-100 text-blue-800' },
  validated: { fr: 'Validée DGI', ar: 'مُصادق عليها', color: 'bg-indigo-100 text-indigo-800' },
  paid: { fr: 'Payée', ar: 'مدفوعة', color: 'bg-green-100 text-green-800' },
  partially_paid: { fr: 'Partiellement Payée', ar: 'مدفوعة جزئياً', color: 'bg-indicator-warning text-yellow-800' }, // Assuming custom color or generic tailwind
  overdue: { fr: 'En retard', ar: 'متأخرة', color: 'bg-red-100 text-red-800' },
  cancelled: { fr: 'Annulée', ar: 'ملغاة', color: 'bg-slate-100 text-slate-800' },
};

export const LEGAL_FORM_LABELS: Record<LegalForm, { fr: string; ar: string }> = {
  auto_entrepreneur: { fr: 'Auto Entrepreneur', ar: 'مُقاول ذاتي' },
  sarl: { fr: 'SARL', ar: 'شركة ذات مسؤولية محدودة' },
  sa: { fr: 'SA', ar: 'شركة مجهولة الاسم' },
  sas: { fr: 'SAS', ar: 'شركة مساهمة مبسطة' },
  snc: { fr: 'SNC', ar: 'شركة التضامن' },
  personne_physique: { fr: 'Personne Physique', ar: 'شخص طبيعي' },
};

// Utility types
export type Centimes = number;
