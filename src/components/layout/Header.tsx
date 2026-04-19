import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus, Bell, Globe, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'ar'>('fr');

  const toggleLang = () => {
    const newLang = lang === 'fr' ? 'ar' : 'fr';
    setLang(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  // Helper determining the context title based on precise pathname
  const getPageContext = () => {
    const path = location.pathname;
    if (path.startsWith('/invoices/new')) return { title: 'Nouvelle Facture', parent: 'Factures' };
    if (path.startsWith('/invoices/')) return { title: 'Détails Facture', parent: 'Factures' };
    if (path === '/invoices') return { title: 'Factures', parent: null };
    if (path === '/clients') return { title: 'Clients', parent: null };
    if (path === '/products') return { title: 'Produits', parent: null };
    if (path === '/settings') return { title: 'Paramètres', parent: null };
    return { title: 'Aperçu', parent: 'Tableau de bord' };
  };

  const { title, parent } = getPageContext();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-slate-100 shadow-sm/50">
      
      {/* Mobile Structure: Hamburger + Logo */}
      <div className="flex lg:hidden items-center gap-3">
        <button className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-lg focus:outline-none focus:bg-slate-50 transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-[#1B4965] text-white flex items-center justify-center font-bold text-lg leading-none shadow-sm">
          F
        </div>
      </div>

      {/* Desktop Structure: Contextual Breadcrumb */}
      <div className="hidden lg:flex items-center space-x-2 text-sm text-slate-600">
        {parent ? (
          <>
            <span className="font-medium hover:text-slate-800 cursor-pointer">{parent}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 border-b-2 border-[#5FA8D3] pb-0.5">{title}</span>
          </>
        ) : (
          <span className="font-bold text-[#1B4965] text-lg">{title}</span>
        )}
      </div>

      {/* Interactions (Both Desktop & Mobile Layout) */}
      <div className="flex items-center gap-3 sm:gap-4">
        
        {/* Bilingual Quick Toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#1B4965] bg-slate-50 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors border border-slate-200"
          title="Changer de langue"
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{lang === 'fr' ? 'AR' : 'FR'}</span>
        </button>

        {/* Mobile Bell Notice */}
        <button className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-full relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* Mobile Logout */}
        <button 
          onClick={logout}
          className="lg:hidden p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
        </button>

        {/* Mobile Call to Action */}
        <button
          onClick={() => navigate('/invoices/new')}
          className="sm:hidden p-1.5 bg-[#1B4965] text-white rounded-lg shadow-[0_2px_8px_0_rgb(27,73,101,0.25)] active:scale-95 transition-all"
          title="Nouvelle facture"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Desktop Call to Action */}
        <button
          onClick={() => navigate('/invoices/new')}
          className="hidden sm:flex items-center gap-2 bg-[#1B4965] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#153a51] transition-all shadow-[0_4px_14px_0_rgb(27,73,101,0.25)] active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </button>
      </div>

    </header>
  );
}
