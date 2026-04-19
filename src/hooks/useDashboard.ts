import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Invoice, Client } from '../types';

export function useDashboard() {
  const { business } = useAuth();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [topClients, setTopClients] = useState<Client[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);

  // 1. Native Realtime Listener natively fetching structurally bounded invoice streams.
  // MVPs operate efficiently mapping locally rather than deploying complex composite indexes initially.
  useEffect(() => {
    if (!business?.id) {
       setInvoices([]);
       setLoadingInvoices(false);
       return;
    }
    const q = query(
       collection(db, `businesses/${business.id}/invoices`),
       orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
       const invs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
       setInvoices(invs);
       setLoadingInvoices(false);
    });
    return () => unsub();
  }, [business?.id]);

  // 2. Native listener utilizing pre-aggregated 'totalInvoiced' arrays solving expensive sum() logic.
  useEffect(() => {
    if (!business?.id) {
       setTopClients([]);
       setLoadingClients(false);
       return;
    }
    const q = query(
       collection(db, `businesses/${business.id}/clients`),
       orderBy('totalInvoiced', 'desc'),
       limit(5)
    );
    const unsub = onSnapshot(q, snap => {
       const cls = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
       setTopClients(cls);
       setLoadingClients(false);
    });
    return () => unsub();
  }, [business?.id]);

  // Execute O(N) functional transformations bridging KPIs explicitly and safely.
  const dashboardData = useMemo(() => {
    const now = new Date();
    
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();

    let revenueThisMonth = 0;
    let invoicesThisMonth = 0;
    let revenueLastMonth = 0;
    let invoicesLastMonth = 0;
    let pendingAmount = 0;
    let overdueCount = 0;

    // Build chronological map limits isolating recent 6 months precisely.
    const chartMap = new Map<string, { label: string, amount: number }>();
    const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    
    for (let i = 5; i >= 0; i--) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const key = `${d.getFullYear()}-${d.getMonth()}`;
       const capitalizedLabel = monthFormatter.format(d).replace('.', '').charAt(0).toUpperCase() + monthFormatter.format(d).replace('.', '').slice(1);
       chartMap.set(key, { label: capitalizedLabel, amount: 0 });
    }

    invoices.forEach(inv => {
       // Filter out raw drafts minimizing tracking pollution
       if (inv.status === 'draft' || inv.status === 'cancelled') return;

       const issueTime = inv.issueDate?.toMillis?.() || 0;
       const ttc = inv.totals?.totalTTC || 0;
       
       const paidAmount = inv.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
       const balance = ttc - paidAmount;

       if (issueTime >= currentMonthStart) {
          revenueThisMonth += ttc;
          invoicesThisMonth += 1;
       } else if (issueTime >= lastMonthStart && issueTime <= lastMonthEnd) {
          revenueLastMonth += ttc;
          invoicesLastMonth += 1;
       }

       if (inv.issueDate) {
          const invDate = new Date(issueTime);
          const key = `${invDate.getFullYear()}-${invDate.getMonth()}`;
          if (chartMap.has(key)) {
             const existing = chartMap.get(key)!;
             existing.amount += ttc;
             chartMap.set(key, existing);
          }
       }

       if (balance > 0) {
          pendingAmount += balance;
       }
       
       if ((inv.status as string) === 'overdue' || (balance > 0 && inv.dueDate && inv.dueDate.toMillis() < now.getTime() && (inv.status as string) !== 'overdue')) {
          overdueCount += 1;
       }
    });

    const revenuePercentChange = revenueLastMonth === 0 
       ? (revenueThisMonth > 0 ? 100 : 0) 
       : Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100);
       
    const invoicesPercentChange = invoicesLastMonth === 0 
       ? (invoicesThisMonth > 0 ? 100 : 0) 
       : Math.round(((invoicesThisMonth - invoicesLastMonth) / invoicesLastMonth) * 100);

    const chartData = Array.from(chartMap.values());

    return {
       stats: {
         revenueThisMonth,
         revenuePercentChange,
         invoicesThisMonth,
         invoicesPercentChange,
         pendingAmount,
         overdueCount
       },
       chartData,
       recentInvoices: invoices.slice(0, 5)
    };
  }, [invoices]);

  return {
     ...dashboardData,
     topClients,
     loading: loadingInvoices || loadingClients
  };
}
