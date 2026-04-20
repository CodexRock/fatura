import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Plus, Building2, Mail, Phone,
  FileEdit, Trash2, ChevronLeft, ChevronRight, MoreVertical, Loader2,
} from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { formatMAD } from '../lib/tva';
import ClientForm from '../components/clients/ClientForm';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import type { Client } from '../types';

export default function Clients() {
  const { clients, loading, searchClients, removeClient } = useClients();
  const { success, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const filtered = useMemo(() => searchClients(searchTerm), [searchTerm, clients]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedClients = useMemo(
    () => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page],
  );

  useEffect(() => {
    const close = () => { if (activeDropdown) setActiveDropdown(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [activeDropdown]);

  const handleCreate = () => { setEditingClient(null); setIsFormOpen(true); };
  const handleEdit = (client: Client) => { setEditingClient(client); setIsFormOpen(true); setActiveDropdown(null); };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await removeClient(confirmDelete.id);
      success('Client supprimé avec succès.');
      if (paginatedClients.length === 1 && page > 1) setPage(page - 1);
    } catch {
      toastError('Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-enter">

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        danger
        title="Supprimer ce client ?"
        message={`La suppression de "${confirmDelete?.name}" est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
      />

      <ClientForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        client={editingClient}
        onSuccess={(msg) => success(msg)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-btn hover:bg-primary-800 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter un client
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
          placeholder="Rechercher par nom, email ou ICE..."
          className="input-field pl-9 w-full"
        />
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7 text-primary-300" />}
            title="Aucun client trouvé"
            description={
              searchTerm
                ? 'Aucun client ne correspond à cette recherche.'
                : 'Ajoutez votre premier client pour commencer à facturer.'
            }
            action={
              !searchTerm ? (
                <button
                  onClick={handleCreate}
                  className="text-sm font-semibold text-primary-700 hover:underline"
                >
                  + Ajouter un client
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full text-left text-sm" aria-label="Liste des clients">
                <thead>
                  <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-3">Nom / Raison sociale</th>
                    <th className="px-6 py-3">ICE</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3 text-right">Solde</th>
                    <th className="px-6 py-3 w-10"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedClients.map(client => (
                    <tr
                      key={client.id}
                      className="group hover:bg-primary-50/30 transition-colors duration-100"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {getInitials(client.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-snug">{client.name}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3" />
                              {client.address?.city || 'Ville non renseignée'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500 font-mono">
                        {client.ice || <span className="text-slate-300 not-italic">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {client.phone && (
                            <div className="flex items-center text-xs text-slate-500 gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              {client.phone}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center text-xs text-slate-500 gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[160px]">{client.email}</span>
                            </div>
                          )}
                          {!client.phone && !client.email && (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-bold tabular-nums">
                        <span className={
                          client.balance === 0
                            ? 'text-slate-400'
                            : client.balance > 0
                              ? 'text-success-600'
                              : 'text-danger-500'
                        }>
                          {formatMAD(Math.abs(client.balance))}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === client.id ? null : client.id);
                            }}
                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeDropdown === client.id && (
                            <div className="absolute right-0 z-20 mt-1 w-44 bg-white rounded-xl shadow-modal border border-slate-100 py-1 overflow-hidden">
                              <button
                                onClick={() => handleEdit(client)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <FileEdit className="w-4 h-4 text-slate-400" /> Modifier
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                onClick={() => { setActiveDropdown(null); setConfirmDelete(client); }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger-500 hover:bg-danger-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" /> Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-50">
              {paginatedClients.map(client => (
                <div key={client.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {getInitials(client.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{client.name}</div>
                        {client.ice && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{client.ice}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(client)}
                        className="p-2 text-slate-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <FileEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(client)}
                        className="p-2 text-slate-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {client.phone && (
                      <span className="inline-flex items-center text-xs text-slate-500 gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                        <Phone className="w-3 h-3" /> {client.phone}
                      </span>
                    )}
                    {client.email && (
                      <span className="inline-flex items-center text-xs text-slate-500 gap-1 bg-slate-50 px-2 py-1 rounded-lg truncate max-w-[180px]">
                        <Mail className="w-3 h-3 flex-shrink-0" /> {client.email}
                      </span>
                    )}
                    <span className={`ml-auto text-sm font-bold tabular-nums ${
                      client.balance === 0 ? 'text-slate-400' : client.balance > 0 ? 'text-success-600' : 'text-danger-500'
                    }`}>
                      {formatMAD(Math.abs(client.balance))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50">
                <span>Page {page} sur {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
