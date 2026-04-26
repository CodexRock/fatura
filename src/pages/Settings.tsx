import React, { useState, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  Save,
  Building2,
  Landmark,
  Receipt,
  Shield,
  Crown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileImage,
  Check,
  FileCode2,
  ArrowUpRight,
  Clock,
  Users,
  FileText,
  Star,
  Zap,
  Eye,
  Palette,
  X,
  MessageCircle,
  Phone,
  Unlink,
  Link as LinkIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateBusiness, listInvoices } from '../lib/firestore';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateUBL, downloadUBL } from '../lib/ubl';
import { formatMAD } from '../lib/tva';
import { functions } from '../lib/firebase';
import type { TvaRegime, LegalForm, TvaRate, Business } from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir',
  'Meknès', 'Oujda', 'Kenitra', 'Tétouan', 'Autre',
];

const PRESET_COLORS = ['#1B4965', '#F4A261', '#2A9D8F', '#E76F51', '#264653', '#8AB17D', '#6366F1', '#EC4899'];

type SettingsTab = 'entreprise' | 'facturation' | 'banque' | 'whatsapp' | 'abonnement' | 'dgi';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'entreprise', label: 'Entreprise', icon: Building2 },
  { id: 'facturation', label: 'Facturation', icon: Receipt },
  { id: 'banque', label: 'Banque', icon: Landmark },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'abonnement', label: 'Abonnement', icon: Crown },
  { id: 'dgi', label: 'Conformité DGI', icon: Shield },
];

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

const inputClass = 'w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40 focus:border-[#5FA8D3] transition-all text-slate-800 placeholder:text-slate-400';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';
const sectionCardClass = 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden';

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#1B4965]/5 flex items-center justify-center">
        <Icon className="w-4.5 h-4.5 text-[#1B4965]" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group relative flex items-center justify-center gap-3 bg-[#1B4965] hover:bg-[#153a51] text-white px-8 py-3.5 rounded-2xl font-black shadow-[0_10px_25px_-5px_rgba(27,73,101,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 min-w-[240px]"
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-white/80" />
      ) : (
        <Save className="w-5 h-5 text-white/80 group-hover:scale-110 transition-transform" />
      )}
      <span>Enregistrer les modifications</span>
    </button>
  );
}

// =============================================================================
// MAIN SETTINGS PAGE
// =============================================================================

export default function Settings() {
  const { business, refreshBusiness } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('entreprise');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showSuccess = (msg: string) => setToast({ type: 'success', message: msg });
  const showError = (msg: string) => setToast({ type: 'error', message: msg });

  const saveBusiness = async (updates: Partial<Business>) => {
    if (!business) return;
    setLoading(true);
    try {
      await updateBusiness(business.id, updates as any);
      await refreshBusiness();
      showSuccess('Modifications enregistrées avec succès.');
    } catch (err: any) {
      console.error(err);
      showError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setLoading(false);
    }
  };

  if (!business) return null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-slate-500 text-sm mt-1">Gérez votre entreprise, facturation et conformité DGI.</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border animate-in slide-in-from-top-2 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="font-medium text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-50 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Tab Navigation — Left sidebar on desktop, horizontal scroll on mobile */}
        <nav className="lg:w-56 flex-shrink-0">
          {/* Desktop: Vertical tabs */}
          <div className="hidden lg:block sticky top-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 space-y-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-[#1B4965] text-white shadow-md shadow-[#1B4965]/15'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: Horizontal scroll tabs */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#1B4965] text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'entreprise' && (
            <TabEntreprise business={business} loading={loading} onSave={saveBusiness} />
          )}
          {activeTab === 'facturation' && (
            <TabFacturation business={business} loading={loading} onSave={saveBusiness} />
          )}
          {activeTab === 'banque' && (
            <TabBanque business={business} loading={loading} onSave={saveBusiness} />
          )}
          {activeTab === 'whatsapp' && (
            <TabWhatsApp business={business} showSuccess={showSuccess} showError={showError} />
          )}
          {activeTab === 'abonnement' && (
            <TabAbonnement business={business} />
          )}
          {activeTab === 'dgi' && (
            <TabDGI business={business} />
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 1: ENTREPRISE
// =============================================================================

function TabEntreprise({
  business,
  loading,
  onSave,
}: {
  business: Business;
  loading: boolean;
  onSave: (data: Partial<Business>) => Promise<void>;
}) {
  const [legalName, setLegalName] = useState(business.legalName || '');
  const [tradeName, setTradeName] = useState(business.tradeName || '');
  const [ice, setIce] = useState(business.ice || '');
  const [identifiantFiscal, setIdentifiantFiscal] = useState(business.identifiantFiscal || '');
  const [registreCommerce, setRegistreCommerce] = useState(business.registreCommerce || '');
  const [cnss, setCnss] = useState(business.cnss || '');
  const [tvaRegime, setTvaRegime] = useState<TvaRegime>(business.tvaRegime || 'assujetti');
  const [legalForm, setLegalForm] = useState<LegalForm>(business.legalForm || 'sarl');
  const [phone, setPhone] = useState(business.phone || '');
  const [email, setEmail] = useState(business.email || '');
  const [website, setWebsite] = useState(business.website || '');
  const [street, setStreet] = useState(business.address?.street || '');
  const [city, setCity] = useState(business.address?.city || 'Casablanca');
  const [postalCode, setPostalCode] = useState(business.address?.postalCode || '');
  const [brandColor, setBrandColor] = useState(business.brandColor || '#1B4965');
  const [logoUrl, setLogoUrl] = useState(business.logoUrl || '');
  const [logoPreview, setLogoPreview] = useState<string | null>(business.logoUrl || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    let finalLogoUrl = logoUrl;

    // Upload logo if a new file was selected
    if (logoFile) {
      setUploading(true);
      try {
        const ext = logoFile.name.split('.').pop() || 'png';
        const logoRef = ref(storage, `businesses/${business.id}/logo.${ext}`);
        await uploadBytes(logoRef, logoFile);
        finalLogoUrl = await getDownloadURL(logoRef);
        setLogoFile(null);
      } catch (err) {
        console.error('Logo upload failed', err);
      } finally {
        setUploading(false);
      }
    }

    await onSave({
      legalName,
      tradeName,
      ice,
      identifiantFiscal,
      registreCommerce,
      cnss,
      tvaRegime,
      legalForm,
      phone,
      email,
      website,
      address: { street, city, postalCode, country: 'MA' },
      brandColor,
      logoUrl: finalLogoUrl,
    });
  };

  return (
    <div className="space-y-6 pb-48 lg:pb-6">
      {/* Logo & Brand */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Palette} title="Logo & Marque" description="Personnalisez l'apparence de vos factures" />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Logo Upload */}
            <div className="flex-shrink-0">
              <label className={labelClass}>Logo de l'entreprise</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#5FA8D3] flex items-center justify-center cursor-pointer overflow-hidden transition-all group relative"
              >
                {logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <FileImage className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <span className="text-xs text-slate-400">Ajouter</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
              <p className="text-xs text-slate-400 mt-2">PNG, JPG • Max 2MB</p>
            </div>

            {/* Brand Color */}
            <div className="flex-1">
              <label className={labelClass}>Couleur de marque</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setBrandColor(color)}
                    className={`w-9 h-9 rounded-full transition-all ${
                      brandColor === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {brandColor === color && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
                <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} className={`${inputClass} w-32`} />
              </div>

              {/* Mini Preview */}
              <div className="mt-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: brandColor }} />
                <div className="flex items-center gap-3 pt-1">
                  {logoPreview ? (
                    <img src={logoPreview} className="w-8 h-8 object-contain rounded" alt="" />
                  ) : (
                    <div className="w-8 h-8 bg-slate-200 rounded flex items-center justify-center"><FileImage className="w-4 h-4 text-slate-400" /></div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-800">{legalName || 'Votre Entreprise'}</p>
                    <p className="text-[10px] text-slate-400">F-2026-0001 • Aperçu facture</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Identification */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Building2} title="Identification Légale" description="Informations obligatoires pour la DGI" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Raison Sociale *</label>
            <input type="text" required value={legalName} onChange={e => setLegalName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nom Commercial</label>
            <input type="text" value={tradeName} onChange={e => setTradeName(e.target.value)} className={inputClass} placeholder="Optionnel" />
          </div>
          <div>
            <label className={labelClass}>Forme Juridique</label>
            <select value={legalForm} onChange={e => setLegalForm(e.target.value as LegalForm)} className={inputClass}>
              <option value="auto_entrepreneur">Auto Entrepreneur</option>
              <option value="sarl">SARL</option>
              <option value="sa">SA</option>
              <option value="sas">SAS</option>
              <option value="snc">SNC</option>
              <option value="personne_physique">Personne Physique</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Régime TVA</label>
            <select value={tvaRegime} onChange={e => setTvaRegime(e.target.value as TvaRegime)} className={inputClass}>
              <option value="assujetti">Assujetti</option>
              <option value="non_assujetti">Non Assujetti</option>
              <option value="exonere">Exonéré</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>ICE (15 chiffres) *</label>
            <div className="relative">
              <input
                type="text" maxLength={15} required value={ice}
                onChange={e => setIce(e.target.value.replace(/\D/g, '').slice(0, 15))}
                className={inputClass}
              />
              {ice.length === 15 && (
                <Check className="absolute right-3 top-3 w-5 h-5 text-emerald-500" />
              )}
            </div>
          </div>
          <div>
            <label className={labelClass}>Identifiant Fiscal (IF)</label>
            <input type="text" value={identifiantFiscal} onChange={e => setIdentifiantFiscal(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Registre du Commerce (RC)</label>
            <input type="text" value={registreCommerce} onChange={e => setRegistreCommerce(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>CNSS</label>
            <input type="text" value={cnss} onChange={e => setCnss(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Contact & Address */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Building2} title="Contact & Adresse" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelClass}>Adresse</label>
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} className={inputClass} placeholder="123 Boulevard d'Anfa" />
          </div>
          <div>
            <label className={labelClass}>Ville</label>
            <select value={city} onChange={e => setCity(e.target.value)} className={inputClass}>
              {MOROCCAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Code Postal</label>
            <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))} className={inputClass} placeholder="20000" />
          </div>
          <div>
            <label className={labelClass}>Email Professionnel</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="contact@entreprise.ma" />
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Site Web</label>
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} placeholder="https://www.entreprise.ma" />
          </div>
        </div>
      </div>

      <div className="fixed bottom-[65px] lg:bottom-0 left-0 lg:left-64 right-0 lg:right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-200/60 p-4 px-6 flex justify-center lg:justify-end z-40 shadow-[0_-20px_40px_rgba(0,0,0,0.08)]">
        <SaveButton loading={loading || uploading} onClick={handleSave} />
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2: FACTURATION
// =============================================================================

function TabFacturation({
  business,
  loading,
  onSave,
}: {
  business: Business;
  loading: boolean;
  onSave: (data: Partial<Business>) => Promise<void>;
}) {
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(business.defaultPaymentTermsDays || 30);
  const [defaultTvaRate, setDefaultTvaRate] = useState<TvaRate>((business as any).defaultTvaRate || 20);
  const [invoicePrefix, setInvoicePrefix] = useState((business as any).invoicePrefix || 'F');
  const [defaultNotes, setDefaultNotes] = useState((business as any).defaultInvoiceNotes || '');

  const handleSave = () => {
    onSave({
      defaultPaymentTermsDays,
      ...(({
        defaultTvaRate,
        invoicePrefix,
        defaultInvoiceNotes: defaultNotes,
      }) as any),
    });
  };

  return (
    <div className="space-y-6 pb-48 lg:pb-6">
      {/* Invoice Numbering */}
      <div className={sectionCardClass}>
        <SectionHeader icon={FileText} title="Numérotation des Factures" description="Format séquentiel conforme DGI" />
        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-1">
              <label className={labelClass}>Préfixe de numérotation</label>
              <input
                type="text" value={invoicePrefix} maxLength={5}
                onChange={e => setInvoicePrefix(e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="F"
              />
              <p className="text-xs text-slate-400 mt-1">Exemple: F, FAC, INV</p>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Aperçu du prochain numéro</label>
              <div className="px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-mono text-sm">
                {invoicePrefix}-{new Date().getFullYear()}-0001
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Default Values */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Receipt} title="Paramètres par Défaut" description="Valeurs pré-remplies pour chaque nouvelle facture" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Taux de TVA par défaut</label>
            <select value={defaultTvaRate} onChange={e => setDefaultTvaRate(parseInt(e.target.value) as TvaRate)} className={inputClass}>
              <option value={20}>20% — Standard</option>
              <option value={14}>14% — Réduit</option>
              <option value={10}>10% — Réduit</option>
              <option value={7}>7% — Super réduit</option>
              <option value={0}>0% — Exonéré</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Conditions de paiement</label>
            <select value={defaultPaymentTermsDays} onChange={e => setDefaultPaymentTermsDays(parseInt(e.target.value))} className={inputClass}>
              <option value={0}>Immédiat (À réception)</option>
              <option value={15}>15 jours</option>
              <option value={30}>30 jours</option>
              <option value={45}>45 jours fin de mois</option>
              <option value={60}>60 jours</option>
              <option value={90}>90 jours</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Notes par défaut sur les factures</label>
            <textarea
              value={defaultNotes}
              onChange={e => setDefaultNotes(e.target.value)}
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="Merci pour votre confiance. Pour toute question concernant cette facture, veuillez nous contacter."
            />
            <p className="text-xs text-slate-400 mt-1">Ce texte sera pré-rempli dans chaque nouvelle facture.</p>
          </div>
        </div>
      </div>

      {/* Currency Preview */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Eye} title="Aperçu du Format Monétaire" />
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[100000, 450050, 1250000, 9999].map(centimes => (
              <div key={centimes} className="p-3 bg-slate-50 rounded-xl text-center">
                <p className="text-xs text-slate-500 mb-1">{centimes} centimes</p>
                <p className="font-bold text-slate-800">{formatMAD(centimes)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-[65px] lg:bottom-0 left-0 lg:left-[260px] right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/60 p-4 px-6 flex justify-end z-40 shadow-[0_-10px_30px_rgb(0,0,0,0.05)]">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>
    </div>
  );
}

// =============================================================================
// TAB 3: BANQUE
// =============================================================================

function TabBanque({
  business,
  loading,
  onSave,
}: {
  business: Business;
  loading: boolean;
  onSave: (data: Partial<Business>) => Promise<void>;
}) {
  const [bankName, setBankName] = useState(business.bankDetails?.bankName || '');
  const [rib, setRib] = useState(business.bankDetails?.rib || '');
  const [iban, setIban] = useState(business.bankDetails?.iban || '');
  const [swift, setSwift] = useState(business.bankDetails?.swift || '');

  const handleSave = () => {
    onSave({
      bankDetails: { bankName, rib, iban, swift },
    });
  };

  const hasBankInfo = bankName || rib || iban;

  return (
    <div className="space-y-6 pb-48 lg:pb-6">
      <div className={sectionCardClass}>
        <SectionHeader icon={Landmark} title="Coordonnées Bancaires" description="Apparaît en pied de page de vos factures" />
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Nom de la banque</label>
            <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className={inputClass} placeholder="Ex: Attijariwafa Bank" />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>RIB (24 chiffres)</label>
            <input
              type="text" maxLength={24} value={rib}
              onChange={e => setRib(e.target.value.replace(/\D/g, '').slice(0, 24))}
              className={inputClass + ' tracking-widest font-mono'}
              placeholder="000 000 000 000 000 000 000 00"
            />
          </div>
          <div>
            <label className={labelClass}>IBAN</label>
            <input type="text" value={iban} onChange={e => setIban(e.target.value.toUpperCase())} className={inputClass + ' uppercase font-mono'} placeholder="MA00 0000 0000 0000 0000 0000 000" />
          </div>
          <div>
            <label className={labelClass}>Code SWIFT / BIC</label>
            <input type="text" value={swift} onChange={e => setSwift(e.target.value.toUpperCase())} className={inputClass + ' uppercase font-mono'} placeholder="ATTIMAMC" />
          </div>
        </div>
      </div>

      {/* Invoice Footer Preview */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Eye} title="Aperçu Pied de Facture" />
        <div className="p-6">
          {hasBankInfo ? (
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Coordonnées Bancaires</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {bankName && (
                  <div>
                    <span className="text-slate-500">Banque: </span>
                    <span className="font-medium text-slate-700">{bankName}</span>
                  </div>
                )}
                {rib && (
                  <div>
                    <span className="text-slate-500">RIB: </span>
                    <span className="font-mono font-medium text-slate-700">{rib}</span>
                  </div>
                )}
                {iban && (
                  <div>
                    <span className="text-slate-500">IBAN: </span>
                    <span className="font-mono font-medium text-slate-700">{iban}</span>
                  </div>
                )}
                {swift && (
                  <div>
                    <span className="text-slate-500">SWIFT: </span>
                    <span className="font-mono font-medium text-slate-700">{swift}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Landmark className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ajoutez vos coordonnées bancaires pour les afficher sur vos factures.</p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-[65px] lg:bottom-0 left-0 lg:left-[260px] right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/60 p-4 px-6 flex justify-end z-40 shadow-[0_-10px_30px_rgb(0,0,0,0.05)]">
        <SaveButton loading={loading} onClick={handleSave} />
      </div>
    </div>
  );
}

// =============================================================================
// TAB 4: ABONNEMENT
// =============================================================================

const PLANS = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    invoices: 5,
    users: 1,
    features: ['5 factures / mois', '1 utilisateur', 'Export PDF', 'Support email'],
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    invoices: 50,
    users: 1,
    features: ['50 factures / mois', '1 utilisateur', 'Export PDF & UBL', 'Rappels de paiement', 'Support prioritaire'],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 299,
    invoices: -1, // Unlimited
    users: 3,
    features: ['Factures illimitées', '3 utilisateurs', 'Export PDF & UBL', 'Rappels automatiques', 'API & Intégrations', 'Support dédié'],
    popular: false,
  },
];

function TabAbonnement({ business }: { business: Business }) {
  const currentPlan = business.subscription?.plan || 'free';
  const currentPlanData = PLANS.find(p => p.id === currentPlan) || PLANS[0];

  // Mock usage data (in production, you'd query actual invoice counts)
  const usageCount = 2;
  const usageLimit = currentPlanData.invoices;
  const usagePercent = usageLimit > 0 ? Math.round((usageCount / usageLimit) * 100) : 0;

  return (
    <div className="space-y-6 pb-48 lg:pb-6">
      {/* Current Plan */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Crown} title="Plan Actuel" />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-[#1B4965]/10 bg-[#1B4965]/[0.02]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-slate-900">{currentPlanData.name}</span>
                <span className="px-2 py-0.5 bg-[#1B4965]/10 text-[#1B4965] text-xs font-bold rounded-full">Actif</span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                {currentPlanData.price === 0 ? 'Gratuit' : `${currentPlanData.price} MAD / mois`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Users className="w-4 h-4" />
              <span>{currentPlanData.users} utilisateur{currentPlanData.users > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Usage Bar */}
          {usageLimit > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 font-medium">Factures ce mois</span>
                <span className="font-bold text-slate-800">{usageCount} / {usageLimit}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              {usagePercent > 80 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Vous approchez de la limite. Envisagez une mise à niveau.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plan Comparison */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Zap} title="Comparer les Plans" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-5 transition-all ${
                    plan.popular
                      ? 'border-[#1B4965] shadow-lg shadow-[#1B4965]/10'
                      : isCurrent
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#1B4965] text-white text-[10px] font-bold uppercase rounded-full tracking-wider">
                      Populaire
                    </div>
                  )}
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                      <span className="text-sm text-slate-500"> MAD/mois</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="w-full py-2 text-center text-sm font-medium text-emerald-700 bg-emerald-100 rounded-xl">
                      Plan actuel
                    </div>
                  ) : (
                    <a
                      href={`https://wa.me/212600000000?text=Bonjour, je souhaite passer au plan ${plan.name} pour Fatura.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-[#1B4965] rounded-xl hover:bg-[#133A54] transition-colors"
                    >
                      Mettre à niveau
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Billing History Placeholder */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Clock} title="Historique de Facturation" />
        <div className="p-6 text-center py-12">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucun historique de paiement pour le moment.</p>
          <p className="text-xs text-slate-400 mt-1">L'historique sera disponible après votre première mise à niveau.</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 5: CONFORMITÉ DGI
// =============================================================================

function TabDGI({ business }: { business: Business }) {
  const [exportingUBL, setExportingUBL] = useState(false);

  const handleExportAllUBL = async () => {
    setExportingUBL(true);
    try {
      const { invoices } = await listInvoices(business.id, undefined, { limit: 500 });
      if (invoices.length === 0) {
        alert('Aucune facture à exporter.');
        return;
      }

      // Generate and download each invoice as UBL XML
      // In production, you'd bundle these into a ZIP
      for (const invoice of invoices) {
        const xml = generateUBL(invoice, business, {
          id: invoice.clientId,
          businessId: business.id,
          name: 'Client',
          address: { street: '', city: '', postalCode: '', country: 'MA' },
          totalInvoiced: 0,
          totalPaid: 0,
          balance: 0,
        } as any);
        downloadUBL(xml, `${invoice.number}.xml`);
        // Small delay to avoid browser blocking multiple downloads
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      console.error('UBL export failed:', err);
      alert('Erreur lors de l\'export UBL.');
    } finally {
      setExportingUBL(false);
    }
  };

  const iceValid = !!(business.ice && business.ice.length === 15);
  const ifValid = !!business.identifiantFiscal;
  const rcValid = !!business.registreCommerce;

  return (
    <div className="space-y-6 pb-48 lg:pb-6">
      {/* DGI Connection Status */}
      <div className={sectionCardClass}>
        <SectionHeader icon={Shield} title="Connexion DGI" description="Statut de la conformité électronique" />
        <div className="p-6">
          <div className="flex items-center gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-amber-800">En attente de connexion</p>
              <p className="text-sm text-amber-700 mt-0.5">
                La connexion directe au portail DGI sera disponible prochainement.
                Vos factures sont générées conformément aux exigences UBL 2.1.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className={sectionCardClass}>
        <SectionHeader icon={CheckCircle2} title="Vérifications de Conformité" />
        <div className="p-6 space-y-3">
          <ComplianceItem checked={iceValid} label="ICE vérifié" detail={iceValid ? `ICE: ${business.ice}` : 'ICE manquant ou incomplet (15 caractères requis)'} />
          <ComplianceItem checked={ifValid} label="Identifiant Fiscal (IF)" detail={ifValid ? `IF: ${business.identifiantFiscal}` : 'Non renseigné — recommandé pour les déclarations'} />
          <ComplianceItem checked={rcValid} label="Registre du Commerce (RC)" detail={rcValid ? `RC: ${business.registreCommerce}` : 'Non renseigné'} />
          <ComplianceItem checked={true} label="Numérotation séquentielle" detail="Factures numérotées automatiquement (F-YYYY-NNNN)" />
          <ComplianceItem checked={true} label="Export UBL 2.1" detail="Génération XML conforme aux normes OASIS UBL 2.1" />
          <ComplianceItem checked={true} label="Devise MAD" detail="Tous les montants en Dirham Marocain (MAD)" />
        </div>
      </div>

      {/* UBL Export */}
      <div className={sectionCardClass}>
        <SectionHeader icon={FileCode2} title="Export UBL XML" description="Exportez toutes vos factures au format UBL 2.1" />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-600">
                Exporter l'ensemble de vos factures en fichiers XML conformes au standard UBL 2.1.
              </p>
              <p className="text-xs text-slate-400 mt-1">Chaque facture sera téléchargée séparément.</p>
            </div>
            <button
              onClick={handleExportAllUBL}
              disabled={exportingUBL}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4965] text-white rounded-xl font-medium hover:bg-[#133A54] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {exportingUBL ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode2 className="w-4 h-4" />}
              Exporter toutes les factures en XML
            </button>
          </div>
        </div>
      </div>

      {/* Archival Info */}
      <div className={sectionCardClass}>
        <div className="p-6">
          <div className="flex gap-4 items-start p-5 bg-blue-50 rounded-2xl border border-blue-100">
            <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-800 text-sm">Archivage Conforme</p>
              <p className="text-sm text-blue-700 mt-1">
                Vos factures sont archivées conformément à l'article 145-9 du Code Général des Impôts (CGI).
                La durée légale de conservation est de 10 ans à compter de la date d'émission.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Toutes les données sont stockées de manière sécurisée sur les serveurs Firebase (Google Cloud Platform)
                avec chiffrement AES-256 au repos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 6: WHATSAPP BOT
// =============================================================================

function TabWhatsApp({
  business,
  showSuccess,
  showError,
}: {
  business: Business;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}) {
  const linkedPhone = (business as any).whatsappLinkedPhone || '';
  const prefs = (business as any).whatsappPreferences || {};
  const isLinked = !!linkedPhone;

  const [phoneInput, setPhoneInput] = useState('');
  const [defaultTvaRate, setDefaultTvaRate] = useState<TvaRate>(prefs.defaultTvaRate || 20);
  const [autoConfirm, setAutoConfirm] = useState(prefs.autoConfirm || false);
  const [language, setLanguage] = useState<'fr' | 'ar'>(prefs.language || 'fr');
  const [notifyOnGeneration, setNotifyOnGeneration] = useState(prefs.notifyOnGeneration !== false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  const formatPhoneDisplay = (waId: string) => {
    if (!waId) return '';
    if (waId.startsWith('212') && waId.length >= 12) {
      return `+${waId.slice(0, 3)} ${waId.slice(3, 4)} ${waId.slice(4, 6)} ${waId.slice(6, 8)} ${waId.slice(8, 10)} ${waId.slice(10)}`;
    }
    return `+${waId}`;
  };

  const handleLink = async () => {
    if (!phoneInput.trim()) {
      showError('Veuillez entrer un numéro de téléphone.');
      return;
    }
    setLinking(true);
    try {
      const linkFn = httpsCallable(functions, 'linkWhatsApp');
      await linkFn({
        phoneNumber: phoneInput,
        preferences: { defaultTvaRate, autoConfirm, language, notifyOnGeneration },
      });
      showSuccess('WhatsApp lié avec succès ! Un message de bienvenue a été envoyé.');
      // Force reload to reflect changes
      window.location.reload();
    } catch (err: any) {
      const msg = err?.message || 'Erreur lors de la liaison WhatsApp.';
      showError(msg);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const unlinkFn = httpsCallable(functions, 'unlinkWhatsApp');
      await unlinkFn({});
      showSuccess('WhatsApp délié avec succès.');
      window.location.reload();
    } catch (err: any) {
      showError(err?.message || 'Erreur lors de la suppression du lien.');
    } finally {
      setUnlinking(false);
      setShowUnlinkConfirm(false);
    }
  };

  return (
    <div className="space-y-6 pb-48 lg:pb-6">
      {/* Connection Status */}
      <div className={sectionCardClass}>
        <SectionHeader
          icon={MessageCircle}
          title="WhatsApp Bot"
          description="Créez des factures par message WhatsApp"
        />
        <div className="p-6">
          {isLinked ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-800">Connecté</span>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-bold rounded-full">Actif</span>
                  </div>
                  <p className="text-sm text-emerald-700 mt-0.5 font-mono">
                    {formatPhoneDisplay(linkedPhone)}
                  </p>
                </div>
              </div>
              <div>
                {showUnlinkConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUnlink}
                      disabled={unlinking}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                      Confirmer
                    </button>
                    <button
                      onClick={() => setShowUnlinkConfirm(false)}
                      className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowUnlinkConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-colors"
                  >
                    <Unlink className="w-4 h-4" />
                    Délier
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-700">Aucun numéro lié</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Liez votre WhatsApp pour créer des factures par message.
                  </p>
                </div>
              </div>
              <div>
                <label className={labelClass}>Numéro WhatsApp (format international)</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">+</span>
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value.replace(/[^\d]/g, '').slice(0, 15))}
                      className={inputClass + ' pl-7 font-mono'}
                      placeholder="212 6 00 00 00 00"
                    />
                  </div>
                  <button
                    onClick={handleLink}
                    disabled={linking || !phoneInput.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-medium hover:bg-[#1da851] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                    Lier WhatsApp
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Entrez le numéro avec l'indicatif pays (ex: 212 pour le Maroc, sans le 0).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className={sectionCardClass}>
        <SectionHeader
          icon={Receipt}
          title="Préférences Bot"
          description="Paramètres par défaut pour les factures créées via WhatsApp"
        />
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>TVA par défaut</label>
              <select
                value={defaultTvaRate}
                onChange={e => setDefaultTvaRate(parseInt(e.target.value) as TvaRate)}
                className={inputClass}
                disabled={!isLinked}
              >
                <option value={20}>20% — Standard</option>
                <option value={14}>14% — Réduit</option>
                <option value={10}>10% — Réduit</option>
                <option value={7}>7% — Super réduit</option>
                <option value={0}>0% — Exonéré</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Langue des messages</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value as 'fr' | 'ar')}
                className={inputClass}
                disabled={!isLinked}
              >
                <option value="fr">Français</option>
                <option value="ar">العربية (Arabe)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={e => setAutoConfirm(e.target.checked)}
                disabled={!isLinked}
                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-[#1B4965] focus:ring-[#5FA8D3] cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Confirmation automatique</p>
                <p className="text-xs text-slate-500">Générer la facture sans demander confirmation (attention !)</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={notifyOnGeneration}
                onChange={e => setNotifyOnGeneration(e.target.checked)}
                disabled={!isLinked}
                className="w-5 h-5 rounded-lg border-2 border-slate-300 text-[#1B4965] focus:ring-[#5FA8D3] cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Notifications PDF</p>
                <p className="text-xs text-slate-500">Recevoir le PDF de la facture directement sur WhatsApp</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div className={sectionCardClass}>
        <SectionHeader
          icon={Zap}
          title="Comment ça marche ?"
        />
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Envoyez un message', desc: '"Facture pour Ahmed, consulting 5000dh"' },
              { step: '2', title: 'Vérifiez et confirmez', desc: 'Le bot affiche un récapitulatif avec les montants' },
              { step: '3', title: 'Recevez le PDF', desc: 'La facture est générée et envoyée en quelques secondes' },
            ].map((item) => (
              <div key={item.step} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-[#1B4965] text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function ComplianceItem({ checked, label, detail }: { checked: boolean; label: string; detail: string }) {
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
      checked ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
        checked ? 'bg-emerald-100' : 'bg-slate-200'
      }`}>
        {checked ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-slate-400" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${checked ? 'text-emerald-800' : 'text-slate-600'}`}>{label}</p>
        <p className="text-xs text-slate-500 truncate">{detail}</p>
      </div>
    </div>
  );
}
