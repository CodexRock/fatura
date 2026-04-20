import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, MoreVertical, Eye, Edit, 
  Copy, CheckCircle, Download, XCircle, Calendar, ChevronLeft, ChevronRight, FileText
} from 'lucide-react';
import { useInvoices } from '../hooks/useInvoices';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '../types';
import { formatMAD } from '../lib/tva';
import { generateInvoicePDF } from '../lib/pdf';
import { useAuth } from '../contexts/AuthContext';
import { updateInvoiceStatus } from '../lib/firestore';

const STATUS_TABS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyées' },
  { value: 'paid', label: 'Payées' },
  { value: 'overdue', label: 'En retard' },
];

export default function Invoices() {
  const navigate = useNavigate();
  const { business } = useAuth();
  const { invoices, loading, filters, setFilters, stats } = useInvoices();
  
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeDropdown) setActiveDropdown(null);
    };
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
      alert('Erreur lors de la génération du PDF');
    }
  };

  const handleMarkPaid = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    if (!business) return;
    if (confirm('Marquer cette facture comme payée ?')) {
      await updateInvoiceStatus(business.id, invoiceId, 'paid');
    }
  };

  const handleCancel = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    if (!business) return;
    if (confirm('Voulez-vous vraiment annuler cette facture ?')) {
      await updateInvoiceStatus(business.id, invoiceId, 'cancelled');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-48 md:pb-12 text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez vos factures et suivez vos paiements
          </p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Plus className="h-5 w-5" />
          Nouvelle facture
        </button>
      </div>

      {/* Summary Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 pr-6 sm:border-r border-gray-200">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Total factures</p>
            <p className="text-lg font-bold text-gray-900">{stats.count}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-50 p-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Chiffre d'affaires (TTC)</p>
            <p className="text-lg font-bold text-gray-900">{formatMAD(stats.totalTTC)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 lg:w-auto lg:border-none lg:pb-0 scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilters({ ...filters, status: tab.value })}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
                filters.status === tab.value
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col sm:flex-row gap-3 lg:w-auto">
          {/* Date Picker */}
          <div className="relative">
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="block w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Toutes les dates</option>
              <option value="this_month">Ce mois</option>
              <option value="last_month">Mois dernier</option>
              <option value="this_quarter">Ce trimestre</option>
              <option value="custom">Personnalisé...</option>
            </select>
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="N° facture ou client..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 rounded-full bg-gray-50 p-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Aucune facture trouvée</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filters.status === 'overdue' 
                ? 'Aucune facture en retard — bravo! 🎉' 
                : 'Essayez de modifier vos filtres ou créez une nouvelle facture.'}
            </p>
            <button
              onClick={() => navigate('/invoices/new')}
              className="mt-6 font-medium text-indigo-600 hover:text-indigo-500"
            >
              + Créer une facture
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold text-gray-900">Numéro</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-gray-900">Client</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-gray-900">Date d'émission</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-gray-900">Montant TTC</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-gray-900">Statut</th>
                  <th scope="col" className="relative px-6 py-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {invoices.map((inv) => {
                  const statusInfo = INVOICE_STATUS_LABELS[inv.status];
                  const dDate = inv.issueDate?.toDate?.() || new Date(inv.issueDate as any);
                  
                  return (
                    <tr 
                      key={inv.id} 
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="group cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-indigo-600">
                        {inv.number}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="font-medium text-gray-900">{inv.client?.name || 'Client inconnu'}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                        {dDate.toLocaleDateString('fr-FR')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-gray-900">
                        {formatMAD(inv.totals.totalTTC)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.fr}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === inv.id ? null : inv.id);
                            }}
                            className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                          
                          {activeDropdown === inv.id && (
                            <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <div className="py-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${inv.id}`); }}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Eye className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                                  Voir les détails
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/invoices/new?duplicate=${inv.id}`); }}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Copy className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                                  Dupliquer
                                </button>
                                <button
                                  onClick={(e) => handleDownloadPDF(e, inv)}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Download className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                                  Télécharger PDF
                                </button>
                                
                                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                  <>
                                    <div className="my-1 border-t border-gray-100" />
                                    <button
                                      onClick={(e) => handleMarkPaid(e, inv.id)}
                                      className="group flex w-full items-center px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                    >
                                      <CheckCircle className="mr-3 h-4 w-4 text-green-500" />
                                      Marquer payée
                                    </button>
                                  </>
                                )}
                                
                                {inv.status !== 'cancelled' && (
                                  <button
                                    onClick={(e) => handleCancel(e, inv.id)}
                                    className="group flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                  >
                                    <XCircle className="mr-3 h-4 w-4 text-red-500" />
                                    Annuler
                                  </button>
                                )}
                              </div>
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
      
      {/* ---------------- MOBILE ACTION BAR ---------------- */}
      <div className="lg:hidden fixed bottom-[65px] left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 p-4 px-6 flex items-center justify-center z-40 shadow-[0_-15px_35px_rgba(0,0,0,0.1)] rounded-t-2xl">
        <button
          onClick={() => navigate('/invoices/new')}
          className="w-full flex items-center justify-center gap-2 bg-[#1B4965] hover:bg-[#153a51] text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgb(27,73,101,0.25)] active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Nouvelle facture
        </button>
      </div>
    </div>
  );
}
