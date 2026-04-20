import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, FileText, Clock,
  AlertCircle, Plus, Users, Download, Loader2, Building2, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { formatMAD } from '../lib/tva';
import { INVOICE_STATUS_LABELS } from '../types';
import { useToast } from '../components/ui/Toast';
import Tooltip from '../components/ui/Tooltip';

export default function Dashboard() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stats, chartData, recentInvoices, topClients, loading } = useDashboard();

  const dateStr = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary-700" />
        <p className="text-slate-500 text-sm font-medium">Chargement de votre espace...</p>
      </div>
    );
  }

  const maxChartVal = Math.max(...chartData.map(d => d.amount), 1);

  // Y-axis labels (3 levels)
  const yLabels = [maxChartVal, maxChartVal / 2, 0].map(v =>
    v === 0 ? '0' : v >= 100000 ? `${(v / 100000).toFixed(0)}k` : `${(v / 100).toFixed(0)}`
  );

  return (
    <div className="space-y-6 animate-page-enter">

      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Bonjour, {business?.tradeName || business?.legalName || 'Gérant'}
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-0.5 capitalize">{dateStr}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Revenue */}
        <div className="card p-5 flex flex-col gap-3 relative overflow-hidden group animate-card-appear" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4.5 h-4.5 text-primary-700" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">CA ce mois</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums truncate">
            {formatMAD(stats.revenueThisMonth)}
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold ${stats.revenuePercentChange >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
            {stats.revenuePercentChange >= 0
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(stats.revenuePercentChange)}% vs mois dernier
          </div>
        </div>

        {/* Invoices */}
        <div className="card p-5 flex flex-col gap-3 relative overflow-hidden animate-card-appear" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4.5 h-4.5 text-accent-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Factures ce mois</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">
            {stats.invoicesThisMonth}
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold ${stats.invoicesPercentChange >= 0 ? 'text-success-500' : 'text-slate-400'}`}>
            {stats.invoicesPercentChange >= 0
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(stats.invoicesPercentChange)}% vs mois dernier
          </div>
        </div>

        {/* Pending */}
        <div className="card p-5 flex flex-col gap-3 animate-card-appear" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">En attente</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums truncate">
            {formatMAD(stats.pendingAmount)}
          </div>
          <p className="text-xs font-semibold text-slate-400">Totalité des encours</p>
        </div>

        {/* Overdue — clickable */}
        <button
          onClick={() => navigate('/invoices?filter=overdue')}
          className="card p-5 flex flex-col gap-3 text-left cursor-pointer group border-danger-100 hover:border-danger-200 hover:bg-danger-50/30 transition-all animate-card-appear focus-visible:ring-2 focus-visible:ring-primary-400"
          style={{ animationDelay: '180ms' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-danger-50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4.5 h-4.5 text-danger-500" />
            </div>
            <span className="text-xs font-semibold text-danger-500 uppercase tracking-wide">En retard</span>
          </div>
          <div className="text-3xl font-bold text-danger-500 tabular-nums">
            {stats.overdueCount}
          </div>
          <p className="text-xs font-semibold text-danger-400 flex items-center gap-1 group-hover:underline">
            Voir les relances <ChevronRight className="w-3 h-3" />
          </p>
        </button>
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Revenue Chart */}
        <div className="xl:col-span-2 panel p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-[15px] text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Évolution du CA (6 derniers mois)
            </h2>
          </div>

          {/* Chart body */}
          <div className="flex gap-4 h-[240px]">
            {/* Y-axis */}
            <div className="flex flex-col justify-between items-end pb-10 flex-shrink-0 w-10">
              {yLabels.map((label, i) => (
                <span key={i} className="text-[10px] font-medium text-slate-400 tabular-nums">{label}</span>
              ))}
            </div>

            {/* Bars + x-labels */}
            <div className="flex-1 flex flex-col">
              {/* Grid lines + bars */}
              <div className="flex-1 relative">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="border-t border-dashed border-slate-100 w-full" />
                  ))}
                </div>

                {/* Bars */}
                <div className="absolute inset-0 flex items-end gap-2 sm:gap-4 px-1">
                  {chartData.map((data, idx) => {
                    const heightPct = (data.amount / maxChartVal) * 100;
                    const isCurrentMonth = idx === chartData.length - 1;
                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="bg-white border border-slate-100 shadow-modal text-slate-900 text-xs font-semibold py-1.5 px-3 rounded-xl whitespace-nowrap tabular-nums">
                            {formatMAD(data.amount)}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-100" />
                          </div>
                        </div>
                        {/* Bar */}
                        <div
                          className={`w-full max-w-[36px] rounded-t-lg transition-all duration-500 ease-out origin-bottom [animation:bar-grow_600ms_ease-out_both] ${
                            isCurrentMonth
                              ? 'bg-accent-500 group-hover:bg-accent-600'
                              : 'bg-primary-200 group-hover:bg-primary-400'
                          }`}
                          style={{
                            height: `${heightPct}%`,
                            minHeight: data.amount > 0 ? '6px' : '2px',
                            animationDelay: `${idx * 60}ms`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* X-axis labels */}
              <div className="flex gap-2 sm:gap-4 px-1 mt-2 h-6">
                {chartData.map((data, idx) => (
                  <div key={idx} className="flex-1 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                    {data.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="panel p-6 flex flex-col">
          <h2 className="font-semibold text-[15px] text-slate-900 mb-5">Actions rapides</h2>

          <div className="flex flex-col gap-3 flex-1 justify-center">
            <button
              onClick={() => navigate('/invoices/new')}
              className="w-full flex items-center justify-center gap-2.5 bg-primary-700 hover:bg-primary-800 text-white py-3.5 px-5 rounded-xl font-semibold text-sm transition-all shadow-btn hover:shadow-btn-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              Nouvelle facture
            </button>

            <button
              onClick={() => navigate('/clients')}
              className="w-full flex items-center justify-center gap-2.5 bg-accent-500 hover:bg-accent-600 text-white py-3.5 px-5 rounded-xl font-semibold text-sm transition-all shadow-btn-accent active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              Ajouter un client
            </button>

            <Tooltip content="Bientôt disponible" position="top">
              <button
                disabled
                className="w-full flex items-center justify-center gap-2.5 bg-white border border-slate-200 text-slate-400 py-3.5 px-5 rounded-xl font-semibold text-sm cursor-not-allowed opacity-60"
                aria-disabled="true"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                Exporter TVA (DGI)
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Recent Invoices + Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Invoices */}
        <div className="lg:col-span-2 panel overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-[15px] text-slate-900">Factures récentes</h2>
            <button
              onClick={() => navigate('/invoices')}
              className="text-sm font-semibold text-accent-600 hover:text-accent-700 hover:underline transition-colors"
            >
              Voir tout
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-primary-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 mb-1">Aucune facture encore</h3>
              <p className="text-xs text-slate-400 mb-5">Créez votre première facture en moins de 2 minutes.</p>
              <button
                onClick={() => navigate('/invoices/new')}
                className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline"
              >
                Créer une facture →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" aria-label="Factures récentes">
                <thead>
                  <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-3">Numéro</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3 text-right">Montant TTC</th>
                    <th className="px-6 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentInvoices.map(inv => {
                    const conf = INVOICE_STATUS_LABELS[inv.status];
                    const dateDisplay = inv.issueDate
                      ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          .format(inv.issueDate.toDate())
                      : '–';
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="hover:bg-primary-50/30 transition-colors duration-100 cursor-pointer group"
                      >
                        <td className="px-6 py-3.5 font-mono font-semibold text-sm text-slate-700 group-hover:text-primary-700 transition-colors">
                          {inv.number}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-slate-500 tabular-nums">
                          {dateDisplay}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-slate-800">
                          {inv.clientName}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-sm text-slate-900 tabular-nums">
                          {formatMAD(inv.totals?.totalTTC || 0)}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={`badge ${conf.color}`}>
                            {conf.fr}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Clients */}
        <div className="panel flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 className="font-semibold text-[15px] text-slate-900">Meilleurs clients</h2>
            <Users className="w-4 h-4 text-slate-300" />
          </div>

          <div className="p-6 flex-1 flex flex-col gap-4">
            {topClients.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <Building2 className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-400 font-medium leading-snug">
                  Facturez vos clients pour les voir ici.
                </p>
              </div>
            ) : (
              topClients.map((client, idx) => (
                <button
                  key={client.id}
                  className="flex items-center justify-between group cursor-pointer text-left w-full"
                  onClick={() => navigate('/clients')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs group-hover:bg-primary-700 group-hover:text-white transition-all flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 group-hover:text-primary-700 transition-colors truncate">
                        {client.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[120px]">
                        {client.ice || 'Sans ICE'}
                      </p>
                    </div>
                  </div>
                  <div className="font-bold text-xs text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg tabular-nums flex-shrink-0 ml-2">
                    {formatMAD(client.totalPaid)}
                  </div>
                </button>
              ))
            )}
          </div>

          {topClients.length > 0 && (
            <button
              onClick={() => navigate('/clients')}
              className="px-6 py-4 border-t border-slate-100 text-sm font-semibold text-slate-400 hover:text-primary-700 hover:bg-slate-50 transition-colors w-full text-left"
            >
              Gérer le portefeuille →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
