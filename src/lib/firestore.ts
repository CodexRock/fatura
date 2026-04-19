import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { DocumentData, FirestoreDataConverter } from 'firebase/firestore';
import type {
  Business,
  Client,
  Product,
  Invoice,
  CreateDTO,
  UpdateDTO,
  Payment,
  ActivityLog,
  InvoiceStatus,
  InvoiceCounter,
} from '../types';

export class FaturaFirestoreError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'FaturaFirestoreError';
  }
}

// ----------------------------------------------------------------------
// CONVERTERS
// ----------------------------------------------------------------------

const createConverter = <T>(): FirestoreDataConverter<T> => ({
  toFirestore: (data: T): DocumentData => data as DocumentData,
  fromFirestore: (snap: QueryDocumentSnapshot): T => ({ id: snap.id, ...snap.data() } as T),
});

const converters = {
  business: createConverter<Business>(),
  client: createConverter<Client>(),
  product: createConverter<Product>(),
  invoice: createConverter<Invoice>(),
  counter: createConverter<InvoiceCounter>(),
  activityLog: createConverter<ActivityLog>(),
};

// ----------------------------------------------------------------------
// BUSINESS
// ----------------------------------------------------------------------

/**
 * Creates a new business document.
 */
export async function createBusiness(ownerId: string, data: CreateDTO<Business>): Promise<Business> {
  try {
    const businessRef = doc(collection(db, 'businesses'));
    const timestamp = serverTimestamp();
    const newBusiness = {
      ...data,
      id: businessRef.id,
      ownerId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await setDoc(businessRef, newBusiness);
    return newBusiness as unknown as Business;
  } catch (error) {
    throw new FaturaFirestoreError('Failed to create business.', 'create_business_failed');
  }
}

/**
 * Gets a business by its ID.
 */
export async function getBusiness(businessId: string): Promise<Business | null> {
  const ref = doc(db, 'businesses', businessId).withConverter(converters.business);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Gets a business by owner ID (assuming 1:1 relationship).
 */
export async function getBusinessByOwner(ownerId: string): Promise<Business | null> {
  const q = query(
    collection(db, 'businesses').withConverter(converters.business),
    where('ownerId', '==', ownerId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/**
 * Updates a business document.
 */
export async function updateBusiness(businessId: string, data: UpdateDTO<Business>): Promise<void> {
  const ref = doc(db, 'businesses', businessId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ----------------------------------------------------------------------
// CLIENTS
// ----------------------------------------------------------------------

/**
 * Creates a new client.
 */
export async function createClient(businessId: string, data: CreateDTO<Client>): Promise<Client> {
  const ref = doc(collection(db, `businesses/${businessId}/clients`));
  const newClient = {
    ...data,
    id: ref.id,
    businessId,
    totalInvoiced: 0,
    totalPaid: 0,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, newClient);
  return newClient as unknown as Client;
}

/**
 * Gets a client by ID.
 */
export async function getClient(businessId: string, clientId: string): Promise<Client | null> {
  const ref = doc(db, `businesses/${businessId}/clients`, clientId).withConverter(converters.client);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Lists clients with optional pagination and simple search.
 */
export async function listClients(
  businessId: string,
  options?: { search?: string; limit?: number; startAfter?: any }
): Promise<{ clients: Client[]; lastDoc: any }> {
  let q = query(collection(db, `businesses/${businessId}/clients`).withConverter(converters.client));

  // Note: For advanced searching (e.g. prefix), indexing setup or Algolia is better.
  // Using direct ordering as base.
  q = query(q, orderBy('name', 'asc'));

  if (options?.limit) q = query(q, limit(options.limit));
  if (options?.startAfter) q = query(q, startAfter(options.startAfter));

  const snap = await getDocs(q);
  let clients = snap.docs.map((d) => d.data());

  // Client-side quick filter for 'search' if provided (Firestore doesn't natively do substring search)
  if (options?.search) {
    const s = options.search.toLowerCase();
    clients = clients.filter(c => c.name.toLowerCase().includes(s));
  }

  return {
    clients,
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * Searches clients strictly prefixing or matching exactly (using Firestore logic)
 */
export async function searchClientsByName(businessId: string, searchStr: string): Promise<Client[]> {
  const q = query(
    collection(db, `businesses/${businessId}/clients`).withConverter(converters.client),
    where('name', '>=', searchStr),
    where('name', '<=', searchStr + '\uf8ff'),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/**
 * Updates a client.
 */
export async function updateClient(businessId: string, clientId: string, data: UpdateDTO<Client>): Promise<void> {
  const ref = doc(db, `businesses/${businessId}/clients`, clientId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a client.
 */
export async function deleteClient(businessId: string, clientId: string): Promise<void> {
  await deleteDoc(doc(db, `businesses/${businessId}/clients`, clientId));
}

// ----------------------------------------------------------------------
// PRODUCTS
// ----------------------------------------------------------------------

/**
 * Creates a new product.
 */
export async function createProduct(businessId: string, data: CreateDTO<Product>): Promise<Product> {
  const ref = doc(collection(db, `businesses/${businessId}/products`));
  const newProduct = {
    ...data,
    id: ref.id,
    businessId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, newProduct);
  return newProduct as unknown as Product;
}

/**
 * Lists products based on filters.
 */
export async function listProducts(
  businessId: string,
  options?: { category?: string; active?: boolean }
): Promise<Product[]> {
  let q = query(collection(db, `businesses/${businessId}/products`).withConverter(converters.product));

  if (options?.category) {
    q = query(q, where('category', '==', options.category));
  }
  if (options?.active !== undefined) {
    q = query(q, where('isActive', '==', options.active));
  }

  q = query(q, orderBy('label', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/**
 * Updates a product.
 */
export async function updateProduct(businessId: string, productId: string, data: UpdateDTO<Product>): Promise<void> {
  const ref = doc(db, `businesses/${businessId}/products`, productId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a product.
 */
export async function deleteProduct(businessId: string, productId: string): Promise<void> {
  await deleteDoc(doc(db, `businesses/${businessId}/products`, productId));
}

// ----------------------------------------------------------------------
// INVOICES & PAYMENTS
// ----------------------------------------------------------------------

/**
 * Creates an invoice, utilizing a transaction to increment the invoice number safely.
 */
export async function createInvoice(businessId: string, data: CreateDTO<Invoice>): Promise<Invoice> {
  const invoiceRef = doc(collection(db, `businesses/${businessId}/invoices`));
  const counterRef = doc(db, `businesses/${businessId}/counters`, 'invoice');

  const currentYear = new Date().getFullYear();

  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextNumber = 1;

    if (counterDoc.exists()) {
      const c = counterDoc.data() as InvoiceCounter;
      if (c.currentYear === currentYear) {
        nextNumber = c.lastNumber + 1;
      }
    }

    const paddedNum = nextNumber.toString().padStart(4, '0');
    const invoiceNumber = `F-${currentYear}-${paddedNum}`;

    const newInvoice = {
      ...data,
      id: invoiceRef.id,
      businessId,
      number: invoiceNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(invoiceRef, newInvoice);
    transaction.set(counterRef, {
      businessId,
      currentYear,
      lastNumber: nextNumber,
    });

    return newInvoice as unknown as Invoice;
  });
}

/**
 * Retrieves an invoice.
 */
export async function getInvoice(businessId: string, invoiceId: string): Promise<Invoice | null> {
  const ref = doc(db, `businesses/${businessId}/invoices`, invoiceId).withConverter(converters.invoice);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Lists invoices with rich filtering capabilities.
 */
export async function listInvoices(
  businessId: string,
  filters?: { status?: string; clientId?: string; dateFrom?: Date; dateTo?: Date },
  pagination?: { limit: number; startAfter?: any }
): Promise<{ invoices: Invoice[]; lastDoc: any }> {
  let q = query(collection(db, `businesses/${businessId}/invoices`).withConverter(converters.invoice));

  if (filters?.status) q = query(q, where('status', '==', filters.status));
  if (filters?.clientId) q = query(q, where('clientId', '==', filters.clientId));
  if (filters?.dateFrom) q = query(q, where('issueDate', '>=', Timestamp.fromDate(filters.dateFrom)));
  if (filters?.dateTo) q = query(q, where('issueDate', '<=', Timestamp.fromDate(filters.dateTo)));

  q = query(q, orderBy('createdAt', 'desc'));

  if (pagination?.limit) q = query(q, limit(pagination.limit));
  if (pagination?.startAfter) q = query(q, startAfter(pagination.startAfter));

  const snap = await getDocs(q);
  return {
    invoices: snap.docs.map((d) => d.data()),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * Updates invoice general data.
 */
export async function updateInvoice(businessId: string, invoiceId: string, data: UpdateDTO<Invoice>): Promise<void> {
  const ref = doc(db, `businesses/${businessId}/invoices`, invoiceId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Specifically updates invoice status.
 */
export async function updateInvoiceStatus(businessId: string, invoiceId: string, status: InvoiceStatus): Promise<void> {
  const ref = doc(db, `businesses/${businessId}/invoices`, invoiceId);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Safely adds a payment to an invoice, recalculating status and updating the client balance transactionally.
 */
export async function addPayment(businessId: string, invoiceId: string, paymentData: Omit<Payment, 'id'>): Promise<void> {
  const invoiceRef = doc(db, `businesses/${businessId}/invoices`, invoiceId).withConverter(converters.invoice);
  
  await runTransaction(db, async (transaction) => {
    const invoiceSnap = await transaction.get(invoiceRef);
    if (!invoiceSnap.exists()) throw new FaturaFirestoreError('Invoice not found', 'not_found');
    
    const invoice = invoiceSnap.data();
    
    const newPayment: Payment = {
      ...paymentData,
      id: crypto.randomUUID(), // Assuming modern browser context or Node environment with crypto
    };

    const newPayments = [...(invoice.payments || []), newPayment];
    const totalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
    
    let newStatus = invoice.status;
    if (totalPaid >= invoice.totals.totalTTC) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    }

    const updates: any = {
      payments: newPayments,
      status: newStatus,
      updatedAt: serverTimestamp(),
    };

    if (newStatus === 'paid' && invoice.status !== 'paid') {
      updates.paidAt = serverTimestamp();
    }

    transaction.update(invoiceRef, updates);

    // Update denormalized client balances
    const clientRef = doc(db, `businesses/${businessId}/clients`, invoice.clientId).withConverter(converters.client);
    const clientSnap = await transaction.get(clientRef);
    if (clientSnap.exists()) {
      const clientObj = clientSnap.data();
      transaction.update(clientRef, {
        totalPaid: clientObj.totalPaid + newPayment.amount,
        balance: clientObj.balance - newPayment.amount,
        updatedAt: serverTimestamp()
      });
    }
  });
}

/**
 * Cancels an invoice.
 */
export async function cancelInvoice(businessId: string, invoiceId: string, reason: string): Promise<void> {
  const ref = doc(db, `businesses/${businessId}/invoices`, invoiceId);
  await updateDoc(ref, {
    status: 'cancelled',
    internalNotes: reason, // simplified tracking
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Aggregates invoice statistics. 
 * Note: Due to client-side reads constraint on aggregations without cloud functions,
 * this fetches matching invoices and reduces them locally.
 */
export async function getInvoiceStats(
  businessId: string,
  period?: { from: Date; to: Date }
): Promise<{
  totalHT: number;
  totalTTC: number;
  totalPaid: number;
  totalOverdue: number;
  count: number;
  countByStatus: Record<string, number>;
}> {
  let q = query(
    collection(db, `businesses/${businessId}/invoices`).withConverter(converters.invoice)
  );

  if (period) {
    q = query(q, where('issueDate', '>=', Timestamp.fromDate(period.from)));
    q = query(q, where('issueDate', '<=', Timestamp.fromDate(period.to)));
  }

  const snap = await getDocs(q);
  const invoices = snap.docs.map((d) => d.data());

  return invoices.reduce(
    (acc, inv) => {
      acc.count++;
      if (inv.status !== 'cancelled') {
         acc.totalHT += inv.totals.totalHT;
         acc.totalTTC += inv.totals.totalTTC;
      }
      
      const paidAmt = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
      acc.totalPaid += paidAmt;

      if (inv.status === 'overdue') {
         acc.totalOverdue += (inv.totals.totalTTC - paidAmt);
      }

      acc.countByStatus[inv.status] = (acc.countByStatus[inv.status] || 0) + 1;

      return acc;
    },
    {
      totalHT: 0,
      totalTTC: 0,
      totalPaid: 0,
      totalOverdue: 0,
      count: 0,
      countByStatus: {} as Record<string, number>,
    }
  );
}

// ----------------------------------------------------------------------
// ACTIVITY LOG
// ----------------------------------------------------------------------

/**
 * Logs an activity into the audit trail.
 */
export async function logActivity(
  businessId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: any
): Promise<void> {
  const ref = doc(collection(db, `businesses/${businessId}/activityLogs`));
  await setDoc(ref, {
    id: ref.id,
    businessId,
    userId,
    action,
    entityType,
    entityId,
    details: details || {},
    timestamp: serverTimestamp(),
  });
}
