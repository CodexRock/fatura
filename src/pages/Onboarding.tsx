import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  Building2, 
  MapPin, 
  Receipt, 
  Palette, 
  CreditCard,
  Loader2,
  FileImage
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createBusiness, updateBusiness } from '../lib/firestore';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { LegalForm, TvaRegime } from '../types';

const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès', 'Oujda', 'Kenitra', 'Tétouan', 'Autre'
];

const PRESET_COLORS = ['#1B4965', '#F4A261', '#2A9D8F', '#E76F51', '#264653', '#8AB17D'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showBank, setShowBank] = useState(false);

  const [formData, setFormData] = useState({
    legalForm: 'auto_entrepreneur' as LegalForm,
    legalName: '',
    tradeName: '',
    ice: '',
    identifiantFiscal: '',
    registreCommerce: '',
    cnss: '',
    tvaRegime: 'assujetti' as TvaRegime,
    address: { street: '', city: 'Casablanca', postalCode: '', country: 'MA' },
    phone: '',
    email: '',
    website: '',
    bankDetails: { bankName: '', rib: '', iban: '', swift: '' },
    brandColor: '#1B4965',
    defaultPaymentTermsDays: 30,
    defaultCurrency: 'MAD' as const
  });

  useEffect(() => {
    if (user?.phoneNumber) {
      setFormData(prev => ({ ...prev, phone: user.phoneNumber || '' }));
    }
  }, [user]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    validateAndSaveImage(file);
  };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSaveImage(file);
  };

  const validateAndSaveImage = (file: File) => {
    if (!file.type.startsWith('image/')) return alert('Le fichier doit être une image.');
    if (file.size > 2 * 1024 * 1024) return alert('La taille de l\'image ne doit pas dépasser 2MB.');
    
    setLogoFile(file);
    const render = new FileReader();
    render.onload = (e) => setLogoPreview(e.target?.result as string);
    render.readAsDataURL(file);
  };

  const canGoNext = () => {
    if (step === 1) return !!formData.legalName && formData.ice.length === 15;
    if (step === 2) return !!formData.tvaRegime;
    if (step === 3) return !!formData.address.city && !!formData.address.street;
    return true; // Step 4 relies on standard fields being optional or prefilled
  };

  const handleNext = () => {
    if (canGoNext()) setStep(s => Math.min(s + 1, 4));
  };

  const handlePrev = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const submitOnboarding = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      // 1. Create native Business document
      const payload: any = { ...formData };
      
      // Cleanup optional schemas internally evaluating object existence 
      if (!showBank || !formData.bankDetails.rib) {
        delete payload.bankDetails;
      }
      
      const bz = await createBusiness(user.uid, payload);

      // 2. Upload storage attachments securely bound to the validated bz ID
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png';
        const logoRef = ref(storage, `businesses/${bz.id}/logo.${ext}`);
        await uploadBytes(logoRef, logoFile);
        const logoUrl = await getDownloadURL(logoRef);
        await updateBusiness(bz.id, { logoUrl });
      }

      // 3. Complete binding natively syncing upstream listener inside AuthContext
      navigate('/dashboard');

    } catch (err) {
      console.error(err);
      alert('Une erreur est survenue lors de la sauvegarde du profil.');
      setIsSubmitting(false);
    }
  };

  const ProgressStep = ({ current, target, icon: Icon, label }: any) => {
    const active = current >= target;
    return (
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${active ? 'bg-[#1B4965] text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-xs mt-2 font-medium hidden sm:block ${active ? 'text-[#1B4965]' : 'text-slate-400'}`}>{label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-8 pb-12 px-4 selection:bg-[#5FA8D3] selection:text-white">
      
      {/* Header & Progress */}
      <div className="w-full max-w-2xl mb-8 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1B4965] tracking-tight">Configuration du Compte</h1>
          <p className="text-slate-500 mt-1">Paramétrez votre entreprise pour créer des factures conformes DGI.</p>
        </div>

        <div className="relative flex justify-between items-center sm:px-8">
          <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-200 -z-10 hidden sm:block">
            <div 
              className="h-full bg-[#1B4965] transition-all duration-500 ease-out" 
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
          <ProgressStep current={step} target={1} icon={Building2} label="Identité" />
          <ProgressStep current={step} target={2} icon={Receipt} label="Fiscalité" />
          <ProgressStep current={step} target={3} icon={MapPin} label="Contact" />
          <ProgressStep current={step} target={4} icon={Palette} label="Marque" />
        </div>
      </div>

      {/* Main Card container */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-slate-100 relative min-h-[500px] flex flex-col">
        <div className="p-8 flex-grow">
          {/* Form Step Binders */}
          <div className={`transition-all duration-300 ${step === 1 ? 'block animate-in fade-in slide-in-from-right-4' : 'hidden'}`}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">Identité de l'entreprise</h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Forme juridique</label>
                <select 
                  value={formData.legalForm} 
                  onChange={e => setFormData({ ...formData, legalForm: e.target.value as LegalForm })}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:outline-none transition-colors"
                >
                  <option value="auto_entrepreneur">Auto-entrepreneur</option>
                  <option value="sarl">SARL / SARL AU</option>
                  <option value="sa">SNC</option>
                  <option value="sas">SAS</option>
                  <option value="personne_physique">Personne Physique</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Raison sociale (Nom légal) *</label>
                <input 
                  type="text" 
                  value={formData.legalName}
                  onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="Ex: Fatura Maroc SARL"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nom commercial (Optionnel)</label>
                <input 
                  type="text" 
                  value={formData.tradeName}
                  onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                  placeholder="Ex: Le Café Bleu"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">ICE (Identifiant Commun de l'Entreprise) *</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formData.ice}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                      setFormData({ ...formData, ice: val });
                    }}
                    placeholder="000000000000000"
                    className="w-full p-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                  {formData.ice.length === 15 && (
                    <div className="absolute right-3.5 top-3.5">
                      <Check className="w-6 h-6 text-emerald-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">L'ICE est obligatoire au Maroc et doit comporter exactement 15 chiffres.</p>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-300 ${step === 2 ? 'block animate-in fade-in slide-in-from-right-4' : 'hidden'}`}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">Informations fiscales</h2>
            <div className="space-y-5">
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Régime de TVA *</label>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => setFormData({ ...formData, tvaRegime: 'assujetti' })}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${formData.tvaRegime === 'assujetti' ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">Assujetti à la TVA</span>
                      {formData.tvaRegime === 'assujetti' && <Check className="w-5 h-5 text-[#1B4965]" />}
                    </div>
                    <p className="text-sm text-slate-500">Vous facturez et déclarez la TVA (taux standard 20%)</p>
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, tvaRegime: 'non_assujetti' })}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${formData.tvaRegime === 'non_assujetti' ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">Non assujetti</span>
                      {formData.tvaRegime === 'non_assujetti' && <Check className="w-5 h-5 text-[#1B4965]" />}
                    </div>
                    <p className="text-sm text-slate-500">Votre CA est sous le seuil d'assujettissement (Mention: "TVA non applicable")</p>
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, tvaRegime: 'exonere' })}
                    className={`text-left p-4 rounded-2xl border-2 transition-all ${formData.tvaRegime === 'exonere' ? 'border-[#1B4965] bg-[#1B4965]/5' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">Exonéré</span>
                      {formData.tvaRegime === 'exonere' && <Check className="w-5 h-5 text-[#1B4965]" />}
                    </div>
                    <p className="text-sm text-slate-500">Votre activité est exonérée de TVA (exports, agriculture, etc.)</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Identifiant Fiscal (IF)</label>
                  <input 
                    type="text" 
                    value={formData.identifiantFiscal}
                    onChange={e => setFormData({ ...formData, identifiantFiscal: e.target.value.replace(/\D/g, '') })}
                    placeholder="Ex: 12345678"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">N° Registre Commerce</label>
                  <input 
                    type="text" 
                    value={formData.registreCommerce}
                    onChange={e => setFormData({ ...formData, registreCommerce: e.target.value })}
                    placeholder="Ex: 12345 (Casa)"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

            </div>
          </div>

          <div className={`transition-all duration-300 ${step === 3 ? 'block animate-in fade-in slide-in-from-right-4' : 'hidden'}`}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">Contact & Adresse</h2>
            <div className="space-y-5">
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Adresse de l'entreprise *</label>
                <input 
                  type="text" 
                  value={formData.address.street}
                  onChange={e => setFormData({ ...formData, address: { ...formData.address, street: e.target.value }})}
                  placeholder="Ex: 123 Boulevard d'Anfa, Étage 4"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Ville *</label>
                  <select 
                    value={formData.address.city}
                    onChange={e => setFormData({ ...formData, address: { ...formData.address, city: e.target.value }})}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:outline-none transition-colors"
                  >
                    {MOROCCAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Code Postal</label>
                  <input 
                    type="text" 
                    value={formData.address.postalCode}
                    onChange={e => setFormData({ ...formData, address: { ...formData.address, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) }})}
                    placeholder="Ex: 20000"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Email professionnel</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@fatura.ma"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Téléphone</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:bg-white focus:outline-none transition-colors text-slate-500"
                    readOnly
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setShowBank(!showBank)} 
                  className="flex items-center space-x-2 text-[#5FA8D3] font-medium hover:text-[#1B4965] transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>{showBank ? "Masquer les coordonnées bancaires" : "Ajouter des coordonnées bancaires (Optionnel)"}</span>
                </button>

                {showBank && (
                  <div className="mt-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Banque</label>
                      <input 
                        type="text" 
                        value={formData.bankDetails.bankName}
                        onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value }})}
                        placeholder="Ex: Attijariwafa Bank"
                        className="w-full p-3 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">RIB (24 chiffres)</label>
                      <input 
                        type="text" 
                        value={formData.bankDetails.rib}
                        onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, rib: e.target.value.replace(/\D/g, '').slice(0, 24) }})}
                        placeholder="000000000000000000000000"
                        className="w-full p-3 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className={`transition-all duration-300 ${step === 4 ? 'block animate-in fade-in slide-in-from-right-4' : 'hidden'}`}>
            <h2 className="text-xl font-bold text-slate-900 mb-6">Préférences et Marque</h2>
            <div className="space-y-8">
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">Logo de l'entreprise (Optionnel)</label>
                <div 
                  onDragOver={handleDragOver} 
                  onDrop={handleDrop}
                  className="w-full relative border-2 border-dashed border-slate-200 rounded-2xl hover:border-[#5FA8D3] hover:bg-[#5FA8D3]/5 transition-all flex flex-col items-center justify-center p-8 group cursor-pointer"
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  {logoPreview ? (
                    <div className="relative">
                      <img src={logoPreview} alt="Logo" className="max-h-24 object-contain rounded-lg shadow-sm" />
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium">Cliquez ou glissez votre logo</p>
                      <p className="text-sm text-slate-400 mt-1">PNG, JPG jusqu'à 2MB</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">Couleur principale de vos factures</label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, brandColor: color })}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm
                        ${formData.brandColor === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    >
                      {formData.brandColor === color && <Check className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">Conditions de paiement par défaut</label>
                <select 
                  value={formData.defaultPaymentTermsDays}
                  onChange={e => setFormData({ ...formData, defaultPaymentTermsDays: parseInt(e.target.value) })}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#5FA8D3] focus:outline-none transition-colors"
                >
                  <option value={0}>Immédiat (À réception)</option>
                  <option value={15}>15 jours</option>
                  <option value={30}>30 jours (Recommandé)</option>
                  <option value={45}>45 jours fin de mois</option>
                  <option value={60}>60 jours</option>
                </select>
              </div>

              {/* Live Preview Card */}
              <div className="mt-6 p-6 border border-slate-100 rounded-2xl shadow-sm bg-white overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: formData.brandColor }}></div>
                <div className="flex justify-between items-start pt-2">
                  <div className="flex gap-4 items-center">
                    {logoPreview ? (
                      <img src={logoPreview} className="w-12 h-12 object-contain" alt="" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                        <FileImage className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight">
                        {formData.legalName || "Votre Entreprise SARL"}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Facture #F-2026-0001</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-slate-50 rounded text-xs font-semibold text-slate-600 border border-slate-200">
                    Aperçu DGI
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handlePrev}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200/50 transition-colors ${step === 1 ? 'invisible' : ''}`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Précédent</span>
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="flex items-center space-x-2 px-6 py-2.5 bg-[#1B4965] text-white rounded-xl font-medium hover:bg-[#153a51] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#1B4965]/20"
            >
              <span>Suivant</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={submitOnboarding}
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              <span>Terminer la configuration</span>
            </button>
          )}
        </div>
      </div>
      
    </div>
  );
}
