import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Building2, 
  Mail, 
  Phone, 
  FileEdit, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { formatMAD } from '../lib/tva';
import ClientForm from '../components/clients/ClientForm';
import type { Client } from '../types';

export default function Clients() {
  const { clients, loading, searchClients, removeClient } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Active States mapping bindings evaluating modals specifically downstream safely. 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null);

  // Derive computations safely isolating performance
  const filtered = useMemo(() => searchClients(searchTerm), [searchTerm, clients]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedClients = useMemo(() => {
    return filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [filtered, page]);

  // Toast auto-clear logic strictly enforced inside DOM interactions natively
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = () => {
    setEditingClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleDelete = async (client: Client) => {
    if (window.confirm(`Veuillez confirmer la suppression du client "${client.name}". Cette action est irréversible.`)) {
      try {
        await removeClient(client.id);
        showToast('Client supprimé avec succès.');
        if (paginatedClients.length === 1 && page > 1) {
          setPage(page - 1);
        }
      } catch (err) {
        showToast('Erreur lors de la suppression.', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-[#1B4965]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Dynamic Native Floating Toasts Bounds */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className={`px-6 py-3 rounded-full shadow-lg flex items-center space-x-3 text-sm font-bold text-white
            ${toast.type === 'success' ? 'bg-[#2A9D8F]' : 'bg-rose-500'}`}
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Slide-over Form Container mapped onto logical limits */}
      <ClientForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        client={editingClient}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* Header Pipeline Limits bounding strict UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4965]">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez vos clients et visualisez leur balance en temps réel.</p>
        </div>

        <button 
          onClick={handleCreate}
          className="flex items-center justify-center space-x-2 bg-[#F4A261] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#e0863f] transition-all shadow-[0_4px_14px_0_rgb(244,162,97,0.39)]"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un client</span>
        </button>
      </div>

      {/* Structural Filtering Architecture */}
      <div className="bg-white p-2 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center">
        <div className="flex-shrink-0 pl-4 pr-2">
          <Search className="w-5 h-5 text-slate-400" />
        </div>
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          placeholder="Rechercher par nom, email ou ICE..."
          className="w-full bg-transparent py-3 pr-4 focus:outline-none font-medium placeholder:text-slate-400 text-slate-700"
        />
      </div>

      {/* Fallback Boundaries Empty States Native Execution Wrapper */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 border-dashed p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#1B4965]/5 rounded-full flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-[#5FA8D3]" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Aucun client trouvé</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">
            {searchTerm 
              ? "Aucun de vos clients enregistrés ne correspond à cette recherche." 
              : "Aucun client. Ajoutez votre premier client pour commencer à facturer."}
          </p>
          {!searchTerm && (
            <button onClick={handleCreate} className="text-[#1B4965] font-bold hover:underline">
              + Créer mon premier client
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  <th className="px-6 py-4">Nom / Raison Sociale</th>
                  <th className="px-6 py-4">ICE</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4 text-right">Solde</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedClients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#1B4965] group-hover:text-[#5FA8D3] transition-colors">{client.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {client.address?.city || 'Ville non renseignée'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">
                      {client.ice ? (
                         <span className="font-mono">{client.ice.length > 10 ? `${client.ice.substring(0,10)}...` : client.ice}</span>
                      ) : <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        {client.phone && (
                          <div className="flex items-center text-xs text-slate-600 gap-2">
                             <Phone className="w-3.5 h-3.5 text-slate-400" />
                             {client.phone}
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center text-xs text-slate-600 gap-2">
                             <Mail className="w-3.5 h-3.5 text-slate-400" />
                             <span className="truncate max-w-[150px]">{client.email}</span>
                          </div>
                        )}
                        {!client.phone && !client.email && <span className="text-slate-300 italic text-sm">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${client.balance === 0 ? 'text-emerald-500' : client.balance < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                        {formatMAD(Math.abs(client.balance))}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(client)} className="p-2 text-slate-400 hover:text-[#5FA8D3] hover:bg-[#5FA8D3]/10 rounded-lg transition-colors">
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(client)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Intermediary View */}
          <div className="block lg:hidden divide-y divide-slate-100">
             {paginatedClients.map(client => (
                <div key={client.id} className="p-4 space-y-4 relative">
                   <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-lg">
                          {client.name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                         <h4 className="font-bold text-[#1B4965] text-lg leading-tight">{client.name}</h4>
                         {client.ice && <p className="text-xs text-slate-500 font-mono mt-1">ICE: {client.ice}</p>}
                       </div>
                     </div>
                     <div className="flex space-x-1">
                        <button onClick={() => handleEdit(client)} className="p-2 text-slate-400 bg-slate-50 rounded-lg"><FileEdit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(client)} className="p-2 text-rose-400 bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                     </div>
                   </div>

                   <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                      {client.phone && <span className="inline-flex items-center text-xs font-medium bg-slate-50 text-slate-600 px-2 py-1 rounded"><Phone className="w-3 h-3 mr-1" /> {client.phone}</span>}
                      {client.email && <span className="inline-flex items-center text-xs font-medium bg-slate-50 text-slate-600 px-2 py-1 rounded"><Mail className="w-3 h-3 mr-1" /> truncate email</span>}
                      <span className={`inline-flex ml-auto items-center text-sm font-bold ${client.balance === 0 ? 'text-emerald-500' : client.balance < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                         {formatMAD(Math.abs(client.balance))}
                      </span>
                   </div>
                </div>
             ))}
          </div>

          {/* Pagination Logical Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50">
              <span>Page {page} sur {totalPages}</span>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
