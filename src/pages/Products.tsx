import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  MoreVertical, 
  FileEdit, 
  Trash2,
  Box,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Eye,
  Loader2
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { formatMAD } from '../lib/tva';
import ProductForm from '../components/products/ProductForm';
import type { Product, ProductUnit } from '../types';

const UNIT_LABELS: Record<ProductUnit, string> = {
  unit: 'Unité',
  hour: 'Heure',
  day: 'Jour',
  kg: 'Kg',
  m2: 'm²',
  forfait: 'Forfait',
  lot: 'Lot'
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Produit': <Package className="w-3.5 h-3.5" />,
  'Service': <Box className="w-3.5 h-3.5" />,
  'Matériel': <Package className="w-3.5 h-3.5" />, // Re-using Package but could unique
  'Forfait': <CheckCircle2 className="w-3.5 h-3.5" />,
  'Software': <Box className="w-3.5 h-3.5" />,
  'Consulting': <Box className="w-3.5 h-3.5" />,
  'Abonnement': <Box className="w-3.5 h-3.5" />,
  'Autre': <MoreVertical className="w-3.5 h-3.5" />
};

export default function Products() {
  const { products, loading, categories, removeProduct, toggleActive } = useProducts();
  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  
  // Dialog Controllers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (window.confirm(`Confirmer la suppression du produit "${product.label}" ?`)) {
      try {
        await removeProduct(product.id);
        showToast('Produit supprimé de votre catalogue.');
      } catch (err) {
        showToast('Erreur de suppression.', 'error');
      }
    }
  };

  const handleToggle = async (product: Product) => {
    try {
      await toggleActive(product);
      showToast(product.isActive ? 'Produit désactivé.' : 'Produit activé.');
    } catch {
      showToast('Impossible de modifier le statut.', 'error');
    }
  };

  // Locally filtered elements mapped over active layout tab structurally
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeTab !== 'all') {
      result = result.filter(p => p.category === activeTab);
    }
    return result;
  }, [products, activeTab]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-[#1B4965]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Notification Limits Boundary */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4">
          <div className={`px-6 py-3 rounded-full shadow-lg flex items-center space-x-3 text-sm font-bold text-white
            ${toast.type === 'success' ? 'bg-[#2A9D8F]' : 'bg-rose-500'}`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Reactive Floating Slideover Configurator Component */}
      <ProductForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={editingProduct}
        existingCategories={categories}
        onSuccess={showToast}
      />

      {/* Header Pipeline Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2">
             <Box className="w-6 h-6 text-[#1B4965]" />
             <h1 className="text-2xl font-bold text-[#1B4965]">Produits & Services</h1>
           </div>
          <p className="text-sm text-slate-500 mt-1">Gérez votre catalogue pour accélérer l'édition de vos factures.</p>
        </div>

        <button 
          onClick={handleCreate}
          className="flex items-center justify-center space-x-2 bg-[#F4A261] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#e0863f] transition-all shadow-[0_4px_14px_0_rgb(244,162,97,0.39)]"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un produit</span>
        </button>
      </div>

      {/* Categories Tabs Wrapper Navigation */}
      {products.length > 0 && categories.length > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
           <button
             onClick={() => setActiveTab('all')}
             className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${activeTab === 'all' ? 'bg-[#1B4965] border-[#1B4965] text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
           >
             <Package className="w-3.5 h-3.5" />
             Tous les produits
           </button>
           {categories.map(cat => (
             <button
               key={cat}
               onClick={() => setActiveTab(cat)}
               className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${activeTab === cat ? 'bg-[#1B4965] border-[#1B4965] text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
             >
               {CATEGORY_ICONS[cat] || <Box className="w-3.5 h-3.5" />}
               {cat}
             </button>
           ))}
        </div>
      )}

      {/* Render Condition Enclosing Structure Limits */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 border-dashed p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#F4A261]/10 rounded-full flex items-center justify-center mb-4">
            <Package className="w-10 h-10 text-[#F4A261]" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Catalogue vide</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">
             {activeTab === 'all' 
               ? "Créez votre catalogue de produits et services pour facturer plus vite."
               : "Aucun produit dans cette catégorie."}
          </p>
          {activeTab === 'all' && (
            <button onClick={handleCreate} className="text-[#1B4965] font-bold hover:underline">
              + Ajouter un premier forfait
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className={`relative bg-white rounded-2xl p-5 border transition-all hover:shadow-lg ${!product.isActive ? 'border-slate-100 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-[#5FA8D3]/50 shadow-sm'}`}
              >
                 {/* Top Context & Settings Limit */}
                 <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                       {product.category && (
                         <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 bg-slate-100 text-slate-500 rounded-md">
                           {product.category}
                         </span>
                       )}
                       {!product.isActive && (
                         <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 bg-rose-100 text-rose-600 rounded-md">
                           Inactif
                         </span>
                       )}
                    </div>
                    {/* Action Dropdown Group Limits Overlay */}
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleToggle(product)} title={product.isActive ? 'Désactiver' : 'Activer'} className={`p-1.5 rounded-lg transition-colors ${product.isActive ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-500' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}>
                         {product.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleEdit(product)} title="Modifier" className="p-1.5 text-slate-400 hover:bg-[#5FA8D3]/10 hover:text-[#5FA8D3] rounded-lg transition-colors">
                         <FileEdit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(product)} title="Supprimer" className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors">
                         <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                 </div>

                 {/* Core Information Base Mapping */}
                 <h3 className="font-bold text-lg text-[#1B4965] leading-tight mb-1 line-clamp-2" title={product.label}>
                    {product.label}
                 </h3>
                 <p className="text-sm text-slate-500 line-clamp-2 h-10 mb-4" title={product.description}>
                    {product.description || <span className="italic opacity-50">Aucune description</span>}
                 </p>

                 {/* Financial Math Bounds Tracker */}
                 <div className="pt-4 border-t border-slate-100 flex items-end justify-between">
                    <div>
                       <div className="text-xs font-semibold text-slate-400 mb-0.5">Prix HT / {UNIT_LABELS[product.unit]}</div>
                       <div className="font-bold text-xl text-slate-800">
                          {formatMAD(product.unitPrice)}
                       </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold border
                       ${product.tvaRate > 0 ? 'bg-[#5FA8D3]/10 text-[#5FA8D3] border-[#5FA8D3]/20' : 'bg-slate-100 text-slate-600 border-slate-200'}
                    `}>
                       TVA {product.tvaRate}%
                    </div>
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* ---------------- MOBILE ACTION BAR ---------------- */}
      <div className="lg:hidden fixed bottom-[65px] left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 p-4 px-6 flex items-center justify-center z-40 shadow-[0_-15px_35px_rgba(0,0,0,0.1)] rounded-t-2xl">
        <button
          onClick={() => {
            setEditingProduct(null);
            setIsFormOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 bg-[#1B4965] hover:bg-[#153a51] text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgb(27,73,101,0.25)] active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Nouveau Produit
        </button>
      </div>
    </div>
  );
}
