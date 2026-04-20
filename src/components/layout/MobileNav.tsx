import { NavLink, useNavigate } from 'react-router-dom';
import { Home, FileText, Users, Settings, Plus } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',         icon: Home,     label: 'Accueil'     },
  { to: '/invoices', icon: FileText, label: 'Factures'    },
  { to: '/clients',  icon: Users,    label: 'Clients'     },
  { to: '/settings', icon: Settings, label: 'Paramètres'  },
];

export default function MobileNav() {
  const navigate = useNavigate();

  return (
    <div
      className="bg-white/90 backdrop-blur-xl border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-3 max-w-lg mx-auto relative">
        {/* Left two items */}
        {NAV_ITEMS.slice(0, 2).map(item => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
        ))}

        {/* FAB — Nouvelle facture */}
        <div className="flex flex-col items-center relative -mt-6">
          <button
            onClick={() => navigate('/invoices/new')}
            className="w-14 h-14 rounded-full bg-primary-700 text-white shadow-[0_4px_20px_rgba(27,73,101,0.35)] flex items-center justify-center transition-all active:scale-95 hover:bg-primary-800 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
            aria-label="Nouvelle facture"
          >
            <Plus className="w-6 h-6" />
          </button>
          <span className="text-[10px] font-medium text-slate-400 mt-1 leading-none">Créer</span>
        </div>

        {/* Right two items */}
        {NAV_ITEMS.slice(2).map(item => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
        ))}
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-16 py-1 gap-1 transition-all duration-200 ${
          isActive ? 'text-primary-700' : 'text-slate-400 hover:text-slate-600'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
            isActive ? 'bg-primary-50' : 'bg-transparent'
          }`}>
            <Icon
              className={`w-[19px] h-[19px] transition-all duration-200 ${
                isActive ? 'stroke-[2.25px]' : 'stroke-[1.75px]'
              }`}
            />
            {isActive && (
              <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary-700" />
            )}
          </div>
          <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
