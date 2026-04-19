import { NavLink } from 'react-router-dom';
import {
  Home,
  FileText,
  Package,
  Users,
  Settings
} from 'lucide-react';

export default function MobileNav() {
  return (
    <div className="bg-white/80 backdrop-blur-lg border-t border-slate-200/60 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex justify-around items-center px-1 pt-3 pb-3 max-w-md mx-auto">
        <NavItem to="/" icon={Home} label="Accueil" />
        <NavItem to="/invoices" icon={FileText} label="Factures" />
        <NavItem to="/products" icon={Package} label="Produits" />
        <NavItem to="/clients" icon={Users} label="Clients" />
        <NavItem to="/settings" icon={Settings} label="Paramètres" />
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => 
        `flex flex-col items-center justify-center w-16 gap-1 transition-all duration-300 ease-out ${
          isActive 
            ? 'text-[#1B4965] scale-105' 
            : 'text-slate-400 hover:text-slate-600 hover:scale-105'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-300 ${isActive ? 'bg-[#1B4965]/10' : 'bg-transparent'}`}>
            <Icon 
              className={`w-5 h-5 transition-all duration-300 ${
                isActive ? 'fill-[#1B4965]/20 stroke-[2.5px]' : 'stroke-2'
              }`} 
            />
            {isActive && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#1B4965]" />
            )}
          </div>
          <span className={`text-[10px] leading-tight transition-all duration-300 ${
            isActive ? 'font-bold' : 'font-medium'
          }`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
