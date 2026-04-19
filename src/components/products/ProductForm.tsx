import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Package, AlertCircle } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { formatMAD } from '../../lib/tva';
import type { Product, TvaRate, ProductUnit, CreateDTO, UpdateDTO } from '../../types';

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  existingCategories: string[];
  onSuccess?: (msg: string) => void;
}

const UNIT_LABELS: Record<ProductUnit, string> = {
  unit: 'Unité',
  hour: 'Heure',
  day: 'Jour',
  kg: 'Kg',
  m2: 'm²',
  forfait: 'Forfait',
  lot: 'Lot'
};

const TVA_RATES: TvaRate[] = [0, 7, 10, 14, 20];

export default function ProductForm({ isOpen, onClose, product, existingCategories, onSuccess }: ProductFormProps) {
  const { addProduct, editProduct } = useProducts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // String manipulation for safely parsing floats visually.
  const [priceInput, setPriceInput] = useState('');
  
  const [formData, setFormData] = useState({
    label: '',
    description: '',
    tvaRate: 20 as TvaRate,
    unit: 'unit' as ProductUnit,
    category: '',
    isActive: true
  });

  useEffect(() => {
    if (product) {
      setFormData({
        label: product.label || '',
        description: product.description || '',
        tvaRate: product.tvaRate ?? 20,
        unit: product.unit || 'unit',
        category: product.category || '',
        isActive: product.isActive ?? true
      });
      // Decode centimes to visual decimal string securely 
      setPriceInput((product.unitPrice / 100).toString());
    } else {
      setFormData({
        label: '',
        description: '',
        tvaRate: 20,
        unit: 'unit',
        category: '',
        isActive: true
      });
      setPriceInput('');
    }
    setErrorMsg(null);
  }, [product, isOpen]);

  // Derived predictive rendering explicitly
  const priceCentimes = Math.round(parseFloat(priceInput || '0') * 100);
  const priceTTC = Math.round(priceCentimes * (1 + formData.tvaRate / 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceInput || isNaN(parseFloat(priceInput))) {
      setErrorMsg("Veuillez saisir un prix valide.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        unitPrice: priceCentimes
      };

      if (!payload.description) delete (payload as any).description;
      if (!payload.category) delete (payload as any).category;

      if (product?.id) {
        await editProduct(product.id, payload as UpdateDTO<Product>);
        onSuccess?.('Produit mis à jour avec succès.');
      } else {
        await addProduct(payload as CreateDTO<Product>);
        onSuccess?.('Nouveau produit ajouté.');
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erreur lors de la sauvegarde du produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Blurred Backdrop Map */}
      <div 
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />
      
      {/* Slide-over Container Base */}
      <div 
        className={`absolute inset-y-0 right-0 w-full md:max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
          <h2 className="text-xl font-bold text-[#1B4965] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#5FA8D3]" />
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Bound Configuration Map */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          
          {errorMsg && (
            <div className="mb-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-700">{errorMsg}</p>
            </div>
          )}

          <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Primary Details Limit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
               <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Désignation *</label>
                <input 
                  required
                  type="text" 
                  value={formData.label}
                  onChange={(e) => setFormData({...formData, label: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  placeholder="Ex: Refonte Site Web E-commerce"
                />
              </div>

               <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors min-h-[80px]"
                  placeholder="Détails visibles sur vos lignes de facture..."
                />
              </div>
            </div>

            {/* Financial Parameters Engine */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Prix unitaire HT *</label>
                  <div className="relative">
                    <input 
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full p-3 pr-14 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors font-semibold text-right"
                      placeholder="0.00"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400 font-bold border-l border-slate-200">
                      MAD
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Unité de vente</label>
                  <select 
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value as ProductUnit})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  >
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                       <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TVA Engine Control Options */}
              <div className="space-y-2 pt-2">
                 <label className="text-sm font-semibold text-slate-700">Taux de TVA applicable</label>
                 <div className="flex flex-wrap gap-2">
                    {TVA_RATES.map(rate => (
                       <label 
                         key={rate} 
                         className={`flex-1 cursor-pointer min-w-[60px] text-center border rounded-xl py-2 px-1 text-sm font-bold transition-all
                           ${formData.tvaRate === rate 
                             ? 'bg-[#1B4965] border-[#1B4965] text-white shadow-md' 
                             : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-[#5FA8D3]'}`}
                       >
                         <input 
                           type="radio" 
                           name="tvaRate" 
                           value={rate} 
                           checked={formData.tvaRate === rate}
                           onChange={() => setFormData({...formData, tvaRate: rate})}
                           className="hidden"
                         />
                         {rate}%
                       </label>
                    ))}
                 </div>
              </div>

               {/* Live Projection Visualization Area */}
               <div className="bg-[#1B4965]/5 border border-[#1B4965]/10 rounded-xl p-4 mt-2">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Aperçu Facturation</p>
                  <p className="text-[#1B4965] font-semibold">
                    Facturé <span className="text-[#F4A261] font-bold text-lg mx-1">{formatMAD(priceTTC)}</span> TTC par {UNIT_LABELS[formData.unit].toLowerCase()}
                  </p>
               </div>
            </div>

            {/* Categorization & Flags Architecture */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Catégorie</label>
                <input 
                  type="text" 
                  list="categories-list"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  placeholder="Ex: Services"
                />
                <datalist id="categories-list">
                  {existingCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
                <p className="text-xs text-slate-400">Classifie les produits pour la recherche rapide.</p>
              </div>

              {/* Status Switch (Only visible explicitly) */}
              <label className="flex items-center space-x-3 cursor-pointer pt-2 group">
                 <div className={`relative w-12 h-6 flex items-center rounded-full transition-colors ${formData.isActive ? 'bg-[#2A9D8F]' : 'bg-slate-300'}`}>
                    <div className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'translate-x-7' : 'translate-x-1'}`} />
                 </div>
                 <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                   {formData.isActive ? 'Produit Actif (Disponible)' : 'Produit Inactif (Caché)'}
                 </span>
              </label>
            </div>

          </form>
        </div>

        {/* Footer Persistence Controls */}
        <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_10px_rgb(0,0,0,0.02)]">
          <button 
            type="submit"
            form="product-form"
            disabled={isSubmitting || !formData.label || !priceInput}
            className="w-full flex items-center justify-center space-x-2 bg-[#1B4965] hover:bg-[#153a51] text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgb(27,73,101,0.25)] active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{isSubmitting ? 'Sauvegarde...' : 'Enregistrer le produit'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
