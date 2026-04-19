import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Settings,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar() {
  const { business, logout } = useAuth();

  const NAV_ITEMS = [
    { name: 'Tableau de bord', path: '/', icon: LayoutDashboard },
    // Simulated overdue badge mapped currently statically per request. Can be bound to Context or Zustand store!
    { name: 'Factures', path: '/invoices', icon: FileText, badge: 3 },
    { name: 'Clients', path: '/clients', icon: Users },
    { name: 'Produits & Services', path: '/products', icon: Package },
    { name: 'Paramètres', path: '/settings', icon: Settings },
  ];

  // Helper calculating badge visuals dynamically based on generic Fatura mappings
  const planMap: Record<string, string> = {
    'free': 'Gratuit',
    'starter': 'Starter',
    'pro': 'Pro',
    'fiduciaire': 'Fiduciaire'
  };
  const uiPlan = planMap[business?.subscription?.plan || 'free'];

  const initials = business?.legalName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'FA';

  return (
    <div className="flex flex-col h-full bg-white text-slate-700">

      {/* Brand Top Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        {business?.logoUrl ? (
          <img src={business.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-slate-50" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-[#1B4965] text-white flex items-center justify-center font-bold text-lg leading-none shadow-sm shadow-[#1B4965]/20">
            F
          </div>
        )}
        <div className="flex flex-col overflow-hidden">
          <span className="font-bold text-[#1B4965] truncate tracking-tight text-lg leading-tight">
            {business?.legalName || 'Fatura'}
          </span>
          {business?.tvaRegime === 'assujetti' && (
            <span className="text-[10px] uppercase font-semibold text-slate-400 truncate">Assujetti à la TVA</span>
          )}
        </div>
      </div>

      {/* Main Navigations */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }: { isActive: boolean }) =>
              `group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 border-l-[3px] ` +
              (isActive
                ? `bg-[#1B4965]/5 text-[#1B4965] border-[#F4A261] font-semibold`
                : `border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800`
              )
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.name}</span>
            </div>
            {item.badge ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold shadow-sm">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* User Status / Logout Boundary */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#5FA8D3]/10 text-[#1B4965] font-bold flex items-center justify-center text-sm border border-[#5FA8D3]/20">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold text-slate-800 truncate">Workspace</span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              Plan <span className="bg-[#F4A261]/10 text-[#e0863f] font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">{uiPlan}</span>
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Déconnexion</span>
        </button>
      </div>

    </div>
  );
}
