import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const inputSizes = {
  sm: 'py-1.5 text-xs',
  md: 'py-2.5 text-sm',
  lg: 'py-3 text-base',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, prefix, suffix, inputSize = 'md', type, disabled, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const actualType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-slate-700 mb-1.5 rtl:text-right"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3 rtl:pl-0 rtl:pr-3 pointer-events-none">
              <span className="text-slate-400 text-sm">{prefix}</span>
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            disabled={disabled}
            className={cn(
              'w-full bg-white border rounded-xl px-4 transition-all duration-200 placeholder:text-slate-400 text-slate-800',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              inputSizes[inputSize],
              error
                ? 'border-red-300 focus:ring-red-200/60 bg-red-50/30'
                : 'border-slate-200 focus:ring-[#5FA8D3]/40 focus:border-[#5FA8D3]',
              disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
              prefix && 'pl-10 rtl:pl-4 rtl:pr-10',
              (suffix || isPassword) && 'pr-10 rtl:pr-4 rtl:pl-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-3 rtl:pr-0 rtl:pl-3 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {suffix && !isPassword && (
            <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-3 rtl:pr-0 rtl:pl-3 pointer-events-none">
              <span className="text-slate-400 text-sm">{suffix}</span>
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-600 rtl:text-right">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-slate-400 rtl:text-right">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
