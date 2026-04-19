import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import type { Client, CreateDTO, UpdateDTO } from '../../types';

interface ClientFormProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  onSuccess?: (msg: string) => void;
}

export default function ClientForm({ isOpen, onClose, client, onSuccess }: ClientFormProps) {
  const { addClient, editClient } = useClients();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Setup the bounding parameters generically mapped to standard payloads.
  const [formData, setFormData] = useState({
    name: '',
    ice: '',
    email: '',
    phone: '',
    contactPerson: '',
    address: { street: '', city: 'Casablanca', postalCode: '', country: 'MA' as const },
    paymentTermsDays: 30,
    notes: ''
  });

  // Pre-fill mutations if a client instance dynamically hits the DOM
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        ice: client.ice || '',
        email: client.email || '',
        phone: client.phone || '',
        contactPerson: client.contactPerson || '',
        address: client.address || { street: '', city: 'Casablanca', postalCode: '', country: 'MA' as const },
        paymentTermsDays: client.paymentTermsDays || 30,
        notes: client.notes || ''
      });
    } else {
      // Clear forms structurally on new bounds limits
      setFormData({
        name: '',
        ice: '',
        email: '',
        phone: '',
        contactPerson: '',
        address: { street: '', city: 'Casablanca', postalCode: '', country: 'MA' as const },
        paymentTermsDays: 30,
        notes: ''
      });
    }
    setErrorMsg(null);
  }, [client, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const payload: any = { ...formData };

      // Explicitly cleanup optionals avoiding massive null objects overriding boundaries internally
      if (!payload.ice) delete payload.ice;
      if (!payload.notes) delete payload.notes;

      if (client?.id) {
        await editClient(client.id, payload as UpdateDTO<Client>);
        onSuccess?.('Le client a été mis à jour avec succès.');
      } else {
        await addClient(payload as CreateDTO<Client>);
        onSuccess?.('Nouveau client ajouté avec succès.');
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Une erreur est survenue.');
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
      
      {/* Slide-over Layout Wrapper */}
      <div 
        className={`absolute inset-y-0 right-0 w-full md:max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform pb-[68px] lg:pb-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
          <h2 className="text-xl font-bold text-[#1B4965]">
            {client ? 'Modifier le client' : 'Ajouter un client'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Scrollable Content */}
        <div className="flex-1 overflow-y-auto w-full p-6 bg-slate-50">
          
          {errorMsg && (
            <div className="mb-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-700">{errorMsg}</p>
            </div>
          )}

          <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Base Identifier Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">IDENTIFICATION</h3>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Raison sociale / Nom *</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  placeholder="Ex: Entreprise S.A"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">ICE (Identifiant Commun de l'Entreprise)</label>
                <input 
                  type="text" 
                  value={formData.ice}
                  onChange={(e) => setFormData({...formData, ice: e.target.value.replace(/\D/g, '').slice(0, 15)})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  placeholder="000000000000000"
                />
                <p className="text-xs text-slate-400">Requis pour les factures professionnelles marocaines.</p>
              </div>
            </div>

            {/* Coordinates Tracker */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">COORDONNÉES</h3>
               
               <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Nom du contact</label>
                <input 
                  type="text" 
                  value={formData.contactPerson || ''}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  placeholder="Ex: M. Ahmed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Email</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                    placeholder="contact@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Téléphone</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                    placeholder="06 00 00 00 00"
                  />
                </div>
              </div>
            </div>

            {/* Complete Address Parameters */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">ADRESSE PRINCIPALE</h3>
               
               <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Rue / Immeuble</label>
                <input 
                  type="text" 
                  value={formData.address.street}
                  onChange={(e) => setFormData({...formData, address: { ...formData.address, street: e.target.value }})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Ville</label>
                  <input 
                    type="text" 
                    value={formData.address.city}
                    onChange={(e) => setFormData({...formData, address: { ...formData.address, city: e.target.value }})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Code Postal</label>
                  <input 
                    type="text" 
                    value={formData.address.postalCode}
                    onChange={(e) => setFormData({...formData, address: { ...formData.address, postalCode: e.target.value.replace(/\D/g, '') }})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Financial & Additional Mappings */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">RÉGLAGES ET NOTES</h3>
               
               <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Conditions de paiement</label>
                <select 
                  value={formData.paymentTermsDays || 30}
                  onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                >
                  <option value={15}>15 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={45}>45 jours</option>
                  <option value={60}>60 jours</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Notes (Interne)</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors min-h-[100px]"
                  placeholder="Informations supplémentaires sur ce client..."
                />
              </div>
            </div>

          </form>
        </div>

        {/* Panel Footer Bounding Action Controls */}
        <div className="mt-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-200/60 shadow-[0_-10px_30px_rgb(0,0,0,0.05)]">
          <button 
            type="submit"
            form="client-form"
            disabled={isSubmitting || !formData.name}
            className="w-full flex items-center justify-center space-x-2 bg-[#1B4965] hover:bg-[#153a51] text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgb(27,73,101,0.25)] active:scale-[0.98]"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{isSubmitting ? 'Sauvegarde...' : 'Sauvegarder le client'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
