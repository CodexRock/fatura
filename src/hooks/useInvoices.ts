import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Invoice, InvoiceStatus, Client } from '../types';
import { useClients } from './useClients';

export interface InvoiceFilters {
  status: InvoiceStatus | 'all';
  dateRange: 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'custom';
  customDateFrom?: Date;
  customDateTo?: Date;
  search: string;
}

export interface InvoiceWithClient extends Invoice {
  client?: Client;
}

export function useInvoices() {
  const { business } = useAuth();
  const { clients } = useClients();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [filters, setFilters] = useState<InvoiceFilters>({
    status: 'all',
    dateRange: 'all',
    search: '',
  });

  useEffect(() => {
    if (!business?.id) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `businesses/${business.id}/invoices`),
      orderBy('issueDate', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            ...docData,
            id: doc.id,
          } as InvoiceWithClient;
        });
        setInvoices(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching invoices:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [business?.id]);

  // Inject client objects when clients/invoices change
  const mappedInvoices = useMemo(() => {
    return invoices.map(inv => ({
      ...inv,
      client: clients.find(c => c.id === inv.clientId)
    }));
  }, [invoices, clients]);

  const filteredInvoices = useMemo(() => {
    return mappedInvoices.filter((inv) => {
      // Status filter
      if (filters.status !== 'all' && inv.status !== filters.status) {
        return false;
      }

      // Search filter (Invoice number or client name)
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (!inv.number.toLowerCase().includes(term)) {
          if (!inv.client?.name?.toLowerCase().includes(term)) {
            return false;
          }
        }
      }

      // Date Range Filter
      if (filters.dateRange !== 'all') {
        const issueDate = inv.issueDate?.toDate?.() || new Date(inv.issueDate as any);
        const now = new Date();
        
        if (filters.dateRange === 'this_month') {
          if (issueDate.getMonth() !== now.getMonth() || issueDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (filters.dateRange === 'last_month') {
          let lastMonth = now.getMonth() - 1;
          let year = now.getFullYear();
          if (lastMonth < 0) {
            lastMonth = 11;
            year -= 1;
          }
          if (issueDate.getMonth() !== lastMonth || issueDate.getFullYear() !== year) {
            return false;
          }
        } else if (filters.dateRange === 'this_quarter') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const issueQuarter = Math.floor(issueDate.getMonth() / 3);
          if (currentQuarter !== issueQuarter || issueDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (filters.dateRange === 'custom') {
          if (filters.customDateFrom && issueDate < filters.customDateFrom) return false;
          if (filters.customDateTo) {
            const endOfDay = new Date(filters.customDateTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (issueDate > endOfDay) return false;
          }
        }
      }

      return true;
    });
  }, [invoices, filters]);

  const stats = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, inv) => {
        acc.count++;
        acc.totalTTC += inv.totals.totalTTC;
        if (inv.status === 'paid' || inv.status === 'partially_paid') {
          const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0;
          acc.totalPaid += paid;
        }
        return acc;
      },
      { count: 0, totalTTC: 0, totalPaid: 0 }
    );
  }, [filteredInvoices]);

  return {
    invoices: filteredInvoices, // Returning filtered list directly for convenience
    rawInvoices: invoices, // In case raw is needed
    loading,
    error,
    filters,
    setFilters,
    stats,
  };
}
