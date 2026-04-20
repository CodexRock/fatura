import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Eye, Copy, CheckCircle, Download,
  XCircle, Calendar, FileText, MoreVertical, Loader2,
} from 'lucide-react';
import { useInvoices } from '../hooks/useInvoices';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '../types';
import { formatMAD } from '../lib/tva';
import { generateInvoicePDF } from '../lib/pdf';
import { useAuth } from '../contexts/AuthContext';
import { updateInvoiceStatus } from '../lib/firestore';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';

const STATUS_TABS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all',     label: 'Toutes'     },
  { value: 'draft',   label: 'Brouillon'  },
  { value: 'sent',    label: 'Envoyées'   },
  { value: 'paid',    label: 'Payées'     },
  { value: 'overdue', label: 'En retard'  },
];

export default function Invoices() {
  const navigate = useNavigate();
  const { business } = useAuth();
  const { invoices, loading, filters, setFilters, stats } = useInvoices();
  const { success, error: toastError } = useToast();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Confirm dialogs
  const [confirmPaid, setConfirmPaid]     = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [confirming, setConfirming]       = useState(false);

  useEffect(() => {
    const handleClickOutside = () => { if (activeDropdown) setActiveDropdown(null); };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeDropdown]);

  const handleDownloadPDF = async (e: React.MouseEvent, invoice: any) => {
    e.stopPropagation();
    if (!business || !invoice.client) return;
    try {
      const blob = await generateInvoicePDF(invoice, business, invoice.client);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture_${invoice.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toastError('Erreur lors de la génération du PDF');
    }
  };

  const doMarkPaid = async () => {
    if (!business || !confirmPaid) return;
    setConfirming(true);
    try {
      await updateInvoiceStatus(business.id, confirmPaid, 'paid');
      success('Facture marquée comme payée.');
    } catch {
      toastError('Erreur lors de la mise à jour.');
    } finally {
      setConfirming(false);
      setConfirmPaid(null);
    }
  };

  const doCancel = async () => {
    if (!business || !confirmCancel) return;
    setConfirming(true);
    try {
      await updateInvoiceStatus(business.id, confirmCancel, 'cancelled');
      success('Facture annulée.');
    } catch {
      toastError('Erreur lors de l\'annulation.');
    } finally {
      setConfirming(false);
      setConfirmCancel(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-enter">

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={!!confirmPaid}
        onClose={() => setConfirmPaid(null)}
        onConfirm={doMarkPaid}
        loading={confirming}
        title="Marquer comme payée ?"
        message="Cette action enregistre la facture comme intégralement payée."
        confirmLabel="Marquer payée"
        cancelLabel="Annuler"
      />
      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={doCancel}
        loading={confirming}
        danger
        title="Annuler la facture ?"
        message="Cette action est irréversible. La facture sera annulée définitivement."
        confirmLabel="Oui, annuler"
        cancelLabel="Retour"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Factures</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {stats.count} facture{stats.count !== 1 ? 's' : ''} · {formatMAD(stats.totalTTC)} TTC
          </p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="inline-flex items-center gap-2 bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-btn hover:bg-primary-800 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilters({ ...filters, status: tab.value })}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-all ${
                filters.status === tab.value
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + date */}
        <div className="flex gap-3">
          {/* Date select */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={filters.dateRange}
              onChange={e => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="input-field pl-9 pr-3 w-40 cursor-pointer"
            >
              <option value="all">Toutes les dates</option>
              <option value="this_month">Ce mois</option>
              <option value="last_month">Mois dernier</option>
              <option value="this_quarter">Ce trimestre</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="N° facture ou client..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="input-field pl-9"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-7 h-7 text-primary-300" />}
            title="Aucune facture trouvée"
            description={
              filters.status === 'overdue'
                ? 'Aucune facture en retard — bravo !'
                : 'Essayez de modifier vos filtres ou créez une nouvelle facture.'
            }
            action={
              <button
                onClick={() => navigate('/invoices/new')}
                className="text-sm font-semibold text-primary-700 hover:underline"
              >
                + Créer une facture
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label="Liste des factures">
              <thead>
                <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-3">Numéro</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Date d'émission</th>
                  <th className="px-6 py-3 text-right">Montant TTC</th>
                  <th className="px-6 py-3 text-center">Statut</th>
                  <th className="px-6 py-3 w-10"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map(inv => {
                  const statusInfo = INVOICE_STATUS_LABELS[inv.status];
                  const issueDate = inv.issueDate?.toDate?.() || new Date(inv.issueDate as any);

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="group cursor-pointer hover:bg-primary-50/30 transition-colors duration-100"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-mono font-semibold text-primary-700 group-hover:text-primary-800">
                        {inv.number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          {inv.client?.name || 'Client inconnu'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500 tabular-nums">
                        {issueDate.toLocaleDateString('fr-FR')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-bold text-slate-900 text-right tabular-nums">
                        {formatMAD(inv.totals.totalTTC)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <span className={`badge ${statusInfo.color}`}>
                          {statusInfo.fr}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === inv.id ? null : inv.id);
                            }}
                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeDropdown === inv.id && (
                            <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-xl shadow-modal border border-slate-100 py-1 overflow-hidden">
                              <button
                                onClick={() => navigate(`/invoices/${inv.id}`)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-slate-400" /> Voir les détails
                              </button>
                              <button
                                onClick={() => navigate(`/invoices/new?duplicate=${inv.id}`)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <Copy className="w-4 h-4 text-slate-400" /> Dupliquer
                              </button>
                              <button
                                onClick={e => handleDownloadPDF(e, inv)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <Download className="w-4 h-4 text-slate-400" /> Télécharger PDF
                              </button>

                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    onClick={() => { setActiveDropdown(null); setConfirmPaid(inv.id); }}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-success-500 hover:bg-success-50 transition-colors"
                                  >
                                    <CheckCircle className="w-4 h-4" /> Marquer payée
                                  </button>
                                </>
                              )}

                              {inv.status !== 'cancelled' && (
                                <button
                                  onClick={() => { setActiveDropdown(null); setConfirmCancel(inv.id); }}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger-500 hover:bg-danger-50 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" /> Annuler
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
