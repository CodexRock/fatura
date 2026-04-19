import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ options, value, onChange, label, placeholder = 'Sélectionner...', error, searchable = false, clearable = false, disabled = false, className, id }, ref) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const selected = options.find(o => o.value === value);

    const filtered = searchable && search
      ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
      : options;

    // Close on click outside
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
          setSearch('');
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus search on open
    useEffect(() => {
      if (open && searchable && searchRef.current) {
        searchRef.current.focus();
      }
    }, [open, searchable]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (!open) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };

    const handleSelect = (opt: SelectOption) => {
      if (opt.disabled) return;
      onChange?.(opt.value);
      setOpen(false);
      setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.('');
    };

    return (
      <div ref={containerRef} className={cn('w-full relative', className)}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-slate-700 mb-1.5 rtl:text-right">
            {label}
          </label>
        )}
        <div
          ref={ref}
          role="combobox"
          aria-expanded={open}
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && setOpen(!open)}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex items-center justify-between w-full px-4 py-2.5 rounded-xl border cursor-pointer transition-all duration-200 text-sm',
            'focus:outline-none focus:ring-2',
            open && !error && 'ring-2 ring-[#5FA8D3]/40 border-[#5FA8D3]',
            error
              ? 'border-red-300 focus:ring-red-200/60'
              : 'border-slate-200 focus:ring-[#5FA8D3]/40 hover:border-slate-300',
            disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
          )}
        >
          <span className={cn(selected ? 'text-slate-800' : 'text-slate-400')}>
            {selected?.label || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {clearable && selected && (
              <button
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
          </div>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {searchable && (
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5FA8D3]/40 focus:border-[#5FA8D3]"
                  />
                </div>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400 text-center">Aucun résultat</div>
              ) : (
                filtered.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    disabled={opt.disabled}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm transition-colors',
                      opt.value === value
                        ? 'bg-[#1B4965]/5 text-[#1B4965] font-medium'
                        : 'text-slate-700 hover:bg-slate-50',
                      opt.disabled && 'text-slate-300 cursor-not-allowed hover:bg-transparent'
                    )}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-1.5 text-xs text-red-600 rtl:text-right">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
