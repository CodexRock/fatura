import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Clock, 
  AlertCircle, 
  Plus, 
  Users, 
  Download,
  Loader2,
  Building2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { formatMAD } from '../lib/tva';
import { INVOICE_STATUS_LABELS } from '../types';

export default function Dashboard() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const { 
    stats, 
    chartData, 
    recentInvoices, 
    topClients,
    whatsappStats,
    loading 
  } = useDashboard();

  const [toast, setToast] = useState<string | null>(null);

  // Natively bounded format logic strictly overriding local states dynamically
  const dateStr = new Intl.DateTimeFormat('fr-FR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }).format(new Date());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]">
        <Loader2 className="w-12 h-12 animate-spin text-[#1B4965] mb-4" />
        <p className="text-slate-500 font-medium">Chargement de votre espace...</p>
      </div>
    );
  }

  // Pre-calculate visual bounds executing scalable charts
  const maxChartVal = Math.max(...chartData.map(d => d.amount), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Toast Notification Base Limit Overlay */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className="px-6 py-3 rounded-full shadow-lg flex items-center space-x-3 text-sm font-bold text-white bg-slate-800">
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Greeting Architectural Limits Frame */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1B4965] tracking-tight">
            Bonjour, {business?.tradeName || business?.legalName || 'Gérant'} 👋
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1 capitalize">
            {dateStr}
          </p>
        </div>
      </div>

      {/* Primary Analytical Metrics Enclosing Grid Mapping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric Card: Chiffre d'Affaires */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <TrendingUp className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#1B4965]/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-[#1B4965]" />
            </div>
            <h3 className="font-bold text-slate-500 text-sm">Chiffre d'affaires (Mois)</h3>
          </div>
          <div className="text-2xl font-black text-slate-800 mb-2 truncate">
            {formatMAD(stats.revenueThisMonth)}
          </div>
          <div className={`flex items-center text-xs font-bold ${stats.revenuePercentChange >= 0 ? 'text-[#2D6A4F]' : 'text-[#E63946]'}`}>
            {stats.revenuePercentChange >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {Math.abs(stats.revenuePercentChange)}% par rapport au mois dernier
          </div>
        </div>

        {/* Metric Card: Factures Emises */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <FileText className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#F4A261]/10 rounded-xl">
              <FileText className="w-5 h-5 text-[#F4A261]" />
            </div>
            <h3 className="font-bold text-slate-500 text-sm">Factures émises (Mois)</h3>
          </div>
          <div className="text-3xl font-black text-slate-800 mb-2">
            {stats.invoicesThisMonth}
          </div>
          <div className={`flex items-center text-xs font-bold ${stats.invoicesPercentChange >= 0 ? 'text-[#2D6A4F]' : 'text-slate-500'}`}>
            {stats.invoicesPercentChange >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {Math.abs(stats.invoicesPercentChange)}% par rapport au mois dernier
          </div>
        </div>

        {/* Metric Card: En attente */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-50 rounded-xl">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="font-bold text-slate-500 text-sm">En attente de paiement</h3>
          </div>
          <div className="text-2xl font-black text-slate-800 mb-2 truncate">
            {formatMAD(stats.pendingAmount)}
          </div>
          <p className="text-xs font-semibold text-slate-400">Totalité des encours</p>
        </div>

        {/* Metric Card: En retard */}
        <button 
          onClick={() => navigate('/invoices?filter=overdue')}
          className="bg-white p-5 rounded-2xl border border-rose-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-rose-300 hover:bg-rose-50/30 transition-all flex flex-col text-left group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <AlertCircle className="w-20 h-20 text-rose-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#E63946]/10 rounded-xl">
              <AlertCircle className="w-5 h-5 text-[#E63946]" />
            </div>
            <h3 className="font-bold text-[#E63946] text-sm">Factures en retard</h3>
          </div>
          <div className="text-3xl font-black text-[#E63946] mb-2">
            {stats.overdueCount}
          </div>
          <p className="text-xs font-semibold text-[#E63946]/70 flex items-center group-hover:underline">
            Voir les relances nécessaires <ChevronRight className="w-3 h-3 ml-1" />
          </p>
        </button>

      </div>

      {whatsappStats?.activeLink && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
          <h2 className="font-bold text-lg text-[#25D366] mb-6 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.388 0 12.035c0 2.124.553 4.195 1.604 6.01L.067 23.6l5.702-1.495c1.745.952 3.708 1.455 5.728 1.455h.004c6.645 0 12.03-5.388 12.03-12.035C23.531 5.388 18.146 0 12.031 0zm7.166 17.182c-.302.85-1.488 1.6-2.11 1.696-.583.09-1.341.259-4.27-1.002-3.708-1.597-6.143-5.46-6.326-5.713-.183-.253-1.508-2.008-1.508-3.831 0-1.823.947-2.724 1.282-3.084.335-.36.732-.45 1.005-.45.273 0 .546-.004.791.008.256.012.601-.097.94.72.348.835 1.157 2.825 1.258 3.025.101.2.164.433.028.704-.135.27-.203.435-.406.674-.202.24-.423.52-.612.72-.203.216-.418.452-.18.86.237.407 1.053 1.74 2.257 2.812 1.558 1.387 2.868 1.823 3.275 2.012.407.19.645.158.887-.091.242-.25 1.051-1.226 1.332-1.646.281-.42.562-.35.938-.208.375.142 2.378 1.121 2.783 1.321.405.2.674.3.774.467.1.168.1.976-.202 1.825z"/></svg>
            Activité WhatsApp (30 jours)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="p-4 bg-slate-50 rounded-2xl flex flex-col justify-center">
                <div className="text-sm font-bold text-slate-500 mb-1">Sessions Bot</div>
                <div className="text-2xl font-black text-slate-800">{whatsappStats.totalSessions}</div>
             </div>
             <div className="p-4 bg-slate-50 rounded-2xl flex flex-col justify-center">
                <div className="text-sm font-bold text-slate-500 mb-1">Factures Créées</div>
                <div className="text-2xl font-black text-[#1B4965]">{whatsappStats.invoicesCreated}</div>
             </div>
             <div className="p-4 bg-slate-50 rounded-2xl flex flex-col justify-center">
                <div className="text-sm font-bold text-slate-500 mb-1">PDF Envoyés</div>
                <div className="text-2xl font-black text-[#2D6A4F]">{whatsappStats.pdfSent}</div>
             </div>
             <div className="p-4 bg-slate-50 rounded-2xl flex flex-col justify-center">
                <div className="text-sm font-bold text-slate-500 mb-1">Taux de Conversion</div>
                <div className="text-2xl font-black text-[#F4A261]">{whatsappStats.successRate}%</div>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Visual Revenue Native SVG Rendering Bounded Safely */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
          <h2 className="font-bold text-lg text-[#1B4965] mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Évolution du CA (Derniers 6 mois)
          </h2>
          
          <div className="flex flex-col h-[280px]">
             {/* Chart Bounds Executed */}
             <div className="flex-1 flex items-end gap-3 sm:gap-6 relative z-10 pt-8">
               {chartData.map((data, idx) => (
                  <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                    {/* Tooltip Hover Overlay Computation */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg pointer-events-none whitespace-nowrap shadow-xl">
                       {formatMAD(data.amount)}
                       <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                    {/* Pure CSS Bar Scaling Limits Base Map */}
                    <div 
                      className={`w-full max-w-[48px] rounded-t-lg transition-all duration-700 ease-out 
                        ${idx === chartData.length -1 ? 'bg-[#F4A261] group-hover:bg-[#e0863f]' : 'bg-[#1B4965]/80 group-hover:bg-[#1B4965]'}
                      `}
                      style={{ height: `${(data.amount / maxChartVal) * 100}%`, minHeight: data.amount > 0 ? '8px' : '2px' }}
                    />
                  </div>
               ))}
             </div>
             {/* Labels Baseline Alignment Architecture */}
             <div className="flex gap-3 sm:gap-6 mt-4 border-t border-slate-100 pt-3 relative z-0">
               {chartData.map((data, idx) => (
                  <div key={idx} className="flex-1 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                     {data.label}
                  </div>
               ))}
             </div>
          </div>
        </div>

        {/* Tactical Actions Dashboard Enclosure */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col">
          <h2 className="font-bold text-lg text-[#1B4965] mb-6">Actions rapides</h2>
          
          <div className="flex flex-col gap-4 flex-1 justify-center">
             <button 
               onClick={() => navigate('/invoices/new')}
               className="w-full flex items-center justify-center gap-3 bg-[#1B4965] hover:bg-[#153a51] text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-[0_4px_14px_0_rgb(27,73,101,0.25)] active:scale-[0.98]"
             >
               <Plus className="w-5 h-5 flex-shrink-0" />
               Nouvelle facture
             </button>

             <button 
               onClick={() => navigate('/clients')}
               className="w-full flex items-center justify-center gap-3 bg-[#F4A261] hover:bg-[#e0863f] text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-[0_4px_14px_0_rgb(244,162,97,0.30)] active:scale-[0.98]"
             >
               <Users className="w-5 h-5 flex-shrink-0" />
               Ajouter un client
             </button>

             <button 
               onClick={() => showToast('Génération Télédéclaration DGI : Bientôt disponible pour la V1.')}
               className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-[#1B4965] hover:text-[#1B4965] text-slate-600 py-3.5 px-6 rounded-2xl font-bold transition-all active:scale-[0.98]"
             >
               <Download className="w-5 h-5 flex-shrink-0" />
               Exporter TVA (DGI)
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Recent Invoices Map Overlay Limits bounded implicitly */}
         <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
               <h2 className="font-bold text-lg text-[#1B4965]">Factures récentes</h2>
               <button onClick={() => navigate('/invoices')} className="text-sm font-bold text-[#F4A261] hover:underline">
                  Voir tout
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                     <th className="px-6 py-4">Numéro</th>
                     <th className="px-6 py-4">Date</th>
                     <th className="px-6 py-4">Client</th>
                     <th className="px-6 py-4 text-right">Montant TTC</th>
                     <th className="px-6 py-4 text-center">Statut</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {recentInvoices.length === 0 ? (
                      <tr>
                         <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                            Aucune facture récente.
                         </td>
                      </tr>
                   ) : recentInvoices.map((inv) => {
                       const conf = INVOICE_STATUS_LABELS[inv.status];
                       return (
                         <tr 
                           key={inv.id} 
                           onClick={() => navigate(`/invoices/${inv.id}`)}
                           className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                         >
                            <td className="px-6 py-4 font-mono font-bold text-slate-700 group-hover:text-[#5FA8D3]">
                              {inv.number}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-500">
                              {inv.issueDate ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(inv.issueDate.toDate()) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-[#1B4965]">
                              ID: {inv.clientId.substring(0,6)}... {/* Ideallly mapped via client names but ID is valid mapping baseline safely */}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-800">
                              {formatMAD(inv.totals?.totalTTC || 0)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${conf.color}`}>
                                {conf.fr}
                              </span>
                            </td>
                         </tr>
                       );
                   })}
                 </tbody>
               </table>
            </div>
         </div>

         {/* Performant Top Clients Grid Overlay List Maps Logic */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
               <h2 className="font-bold text-lg text-[#1B4965]">Meilleurs Clients</h2>
               <Users className="w-5 h-5 text-slate-400" />
            </div>
            <div className="p-6 flex-1 flex flex-col gap-5">
               {topClients.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                     <Building2 className="w-12 h-12 text-slate-200 mb-3" />
                     <p className="text-sm text-slate-500 font-medium">Facturez vos clients pour qu'ils apparaissent ici.</p>
                  </div>
               ) : topClients.map((client, idx) => (
                  <div key={client.id} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/clients')}>
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm group-hover:bg-[#1B4965] group-hover:text-white transition-colors">
                           {idx + 1}
                        </div>
                        <div>
                           <h4 className="font-bold text-slate-800 group-hover:text-[#5FA8D3] transition-colors">{client.name}</h4>
                           <p className="text-xs font-semibold text-slate-400 mt-0.5 max-w-[120px] truncate">{client.ice || 'Sans ICE'}</p>
                        </div>
                     </div>
                     <div className="font-bold text-[#1B4965] bg-[#1B4965]/5 px-3 py-1.5 rounded-lg flex items-center">
                        {formatMAD(client.totalPaid)}
                     </div>
                  </div>
               ))}
            </div>
            {topClients.length > 0 && (
              <button 
                onClick={() => navigate('/clients')}
                className="p-4 border-t border-slate-100 text-sm font-bold text-slate-500 hover:text-[#1B4965] hover:bg-slate-50 transition-colors w-full rounded-b-3xl"
              >
                Gérer le portefeuille client
              </button>
            )}
         </div>

      </div>
    </div>
  );
}
