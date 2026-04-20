import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus, Bell, Globe } from 'lucide-react';
import { useState } from 'react';
import { useSidebar } from '../../contexts/SidebarContext';

export default function Header() {
  const { toggle } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'ar'>('fr');

  const toggleLang = () => {
    const newLang = lang === 'fr' ? 'ar' : 'fr';
    setLang(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const getPageContext = () => {
    const path = location.pathname;
    if (path.startsWith('/invoices/new')) return { title: 'Nouvelle Facture', parent: 'Factures' };
    if (path.startsWith('/invoices/')) return { title: 'Détails Facture', parent: 'Factures' };
    if (path === '/invoices') return { title: 'Factures', parent: null };
    if (path === '/clients') return { title: 'Clients', parent: null };
    if (path === '/products') return { title: 'Produits', parent: null };
    if (path === '/settings') return { title: 'Paramètres', parent: null };
    return { title: 'Tableau de bord', parent: null };
  };

  const { title, parent } = getPageContext();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-slate-100">

      {/* Mobile: Hamburger + Logo */}
      <div className="flex lg:hidden items-center gap-3">
        <button
          onClick={toggle}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-primary-700 text-white flex items-center justify-center font-bold text-sm shadow-btn">
          F
        </div>
      </div>

      {/* Desktop: Breadcrumb */}
      <nav className="hidden lg:flex items-center gap-2 text-sm" aria-label="Fil d'Ariane">
        {parent ? (
          <>
            <span
              className="font-medium text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
              onClick={() => navigate(-1)}
            >
              {parent}
            </span>
            <span className="text-slate-200">/</span>
            <span className="font-semibold text-slate-900">{title}</span>
          </>
        ) : (
          <span className="font-semibold text-slate-900 text-[15px]">{title}</span>
        )}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-200 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary-400"
          title="Changer de langue"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'FR' : 'AR'}</span>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary-400">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger-500 rounded-full ring-2 ring-white" />
        </button>

        {/* New Invoice CTA */}
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center gap-2 bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all shadow-btn active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle facture</span>
        </button>
      </div>
    </header>
  );
}
