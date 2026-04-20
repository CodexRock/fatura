import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Package, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { name: 'Tableau de bord', path: '/',         icon: LayoutDashboard },
  { name: 'Factures',        path: '/invoices',  icon: FileText        },
  { name: 'Clients',         path: '/clients',   icon: Users           },
  { name: 'Produits',        path: '/products',  icon: Package         },
  { name: 'Paramètres',      path: '/settings',  icon: Settings        },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuit',
  starter: 'Starter',
  pro: 'Pro',
  fiduciaire: 'Fiduciaire',
};

export default function Sidebar() {
  const { business, logout } = useAuth();

  const plan = PLAN_LABELS[business?.subscription?.plan || 'free'] || 'Gratuit';
  const initials = (business?.legalName || 'FA')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div className="flex flex-col h-full bg-white text-slate-700 overflow-hidden">

      {/* Brand */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
        {business?.logoUrl ? (
          <img
            src={business.logoUrl}
            alt="Logo"
            className="w-8 h-8 rounded-xl object-contain bg-slate-50 shadow-sm"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-primary-700 text-white flex items-center justify-center font-bold text-sm shadow-btn flex-shrink-0">
            F
          </div>
        )}
        <div className="flex flex-col overflow-hidden min-w-0">
          <span className="font-bold text-primary-700 truncate text-[15px] leading-snug tracking-tight">
            {business?.legalName || 'Fatura'}
          </span>
          {business?.tvaRegime === 'assujetti' && (
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide truncate">
              Assujetti TVA
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Navigation principale">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ` +
              (isActive
                ? 'bg-primary-50 text-primary-700 font-semibold'
                : 'text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-800'
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-slate-100 flex-shrink-0 space-y-3">
        {/* User info */}
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 font-bold flex items-center justify-center text-xs border border-primary-100 flex-shrink-0">
            {initials}
          </div>
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-[13px] font-semibold text-slate-800 truncate leading-snug">
              Mon espace
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-accent-50 text-accent-700 leading-none">
                {plan}
              </span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-danger-500 hover:bg-danger-50 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
