import React, { useState, useMemo, useEffect } from 'react';
import {
  Package, Plus, FileEdit, Trash2, Eye, EyeOff,
  MoreVertical, Loader2, Box,
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { formatMAD } from '../lib/tva';
import ProductForm from '../components/products/ProductForm';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import type { Product, ProductUnit } from '../types';

const UNIT_LABELS: Record<ProductUnit, string> = {
  unit: 'Unité',
  hour: 'Heure',
  day: 'Jour',
  kg: 'Kg',
  m2: 'm²',
  forfait: 'Forfait',
  lot: 'Lot',
};

export default function Products() {
  const { products, loading, categories, removeProduct, toggleActive } = useProducts();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const close = () => { if (activeDropdown) setActiveDropdown(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [activeDropdown]);

  const handleCreate = () => { setEditingProduct(null); setIsFormOpen(true); };
  const handleEdit = (product: Product) => { setEditingProduct(product); setIsFormOpen(true); setActiveDropdown(null); };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await removeProduct(confirmDelete.id);
      success('Produit supprimé du catalogue.');
    } catch {
      toastError('Erreur lors de la suppression.');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleToggle = async (product: Product) => {
    try {
      await toggleActive(product);
      success(product.isActive ? 'Produit désactivé.' : 'Produit activé.');
    } catch {
      toastError('Impossible de modifier le statut.');
    }
    setActiveDropdown(null);
  };

  const filteredProducts = useMemo(() => {
    if (activeTab === 'all') return products;
    return products.filter(p => p.category === activeTab);
  }, [products, activeTab]);

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
        title="Supprimer ce produit ?"
        message={`La suppression de "${confirmDelete?.label}" est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
      />

      <ProductForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={editingProduct}
        existingCategories={categories}
        onSuccess={(msg) => success(msg)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Produits & Services</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {products.length} article{products.length !== 1 ? 's' : ''} dans le catalogue
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-btn hover:bg-primary-800 active:scale-[0.97] transition-all focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau produit
        </button>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-all ${
              activeTab === 'all'
                ? 'bg-primary-50 text-primary-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            Tous
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-all ${
                activeTab === cat
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="panel overflow-hidden">
        {filteredProducts.length === 0 ? (
          <EmptyState
            icon={<Package className="w-7 h-7 text-primary-300" />}
            title="Catalogue vide"
            description={
              activeTab !== 'all'
                ? 'Aucun produit dans cette catégorie.'
                : 'Créez votre catalogue de produits et services pour facturer plus vite.'
            }
            action={
              activeTab === 'all' ? (
                <button
                  onClick={handleCreate}
                  className="text-sm font-semibold text-primary-700 hover:underline"
                >
                  + Ajouter un premier produit
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full text-left text-sm" aria-label="Catalogue produits">
                <thead>
                  <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-3">Produit / Service</th>
                    <th className="px-6 py-3">Catégorie</th>
                    <th className="px-6 py-3">Unité</th>
                    <th className="px-6 py-3 text-right">Prix HT</th>
                    <th className="px-6 py-3 text-center">TVA</th>
                    <th className="px-6 py-3 text-center">Statut</th>
                    <th className="px-6 py-3 w-10"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProducts.map(product => (
                    <tr
                      key={product.id}
                      className={`group hover:bg-primary-50/30 transition-colors duration-100 ${!product.isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                            <Box className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[200px]">{product.label}</div>
                            {product.description && (
                              <div className="text-xs text-slate-400 truncate max-w-[200px]">{product.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {product.category ? (
                          <span className="badge bg-slate-100 text-slate-600 border-slate-200">{product.category}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                        {UNIT_LABELS[product.unit] ?? product.unit}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-bold tabular-nums text-slate-900">
                        {formatMAD(product.unitPrice)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <span className={`badge ${product.tvaRate > 0 ? 'bg-primary-50 text-primary-700 border-primary-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {product.tvaRate}%
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        {product.isActive ? (
                          <span className="badge bg-success-50 text-success-600 border-success-100">Actif</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-400 border-slate-200">Inactif</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === product.id ? null : product.id);
                            }}
                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeDropdown === product.id && (
                            <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-xl shadow-modal border border-slate-100 py-1 overflow-hidden">
                              <button
                                onClick={() => handleEdit(product)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <FileEdit className="w-4 h-4 text-slate-400" /> Modifier
                              </button>
                              <button
                                onClick={() => handleToggle(product)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                {product.isActive
                                  ? <><EyeOff className="w-4 h-4 text-slate-400" /> Désactiver</>
                                  : <><Eye className="w-4 h-4 text-slate-400" /> Activer</>
                                }
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                onClick={() => { setActiveDropdown(null); setConfirmDelete(product); }}
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
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className={`p-4 ${!product.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                        <Box className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{product.label}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {product.category && (
                            <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{product.category}</span>
                          )}
                          <span className="text-xs text-slate-400">{UNIT_LABELS[product.unit] ?? product.unit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(product)}
                        className="p-2 text-slate-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        {product.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 text-slate-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <FileEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(product)}
                        className="p-2 text-slate-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">{formatMAD(product.unitPrice)}</div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${product.tvaRate > 0 ? 'bg-primary-50 text-primary-700 border-primary-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        TVA {product.tvaRate}%
                      </span>
                      {product.isActive
                        ? <span className="badge text-xs bg-success-50 text-success-600 border-success-100">Actif</span>
                        : <span className="badge text-xs bg-slate-100 text-slate-400 border-slate-200">Inactif</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
