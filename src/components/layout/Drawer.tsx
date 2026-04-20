import { useEffect } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import { useSidebar } from '../../contexts/SidebarContext';

export default function Drawer() {
  const { open, close } = useSidebar();

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[300]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-fade-in"
        onClick={close}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-modal animate-drawer-enter flex flex-col"
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Reuse the same Sidebar content */}
        <Sidebar />
      </div>
    </div>
  );
}
