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
  required?: boolean;
}

const heightMap = {
  sm: 'h-9  text-xs',
  md: 'h-11 text-sm',
  lg: 'h-12 text-base',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, prefix, suffix, inputSize = 'md', type, disabled, id, required, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId  = id || label?.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const actualType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700 mb-1.5 rtl:text-right">
            {label}
            {required && <span className="text-danger-400 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3.5 rtl:pl-0 rtl:pr-3.5 pointer-events-none text-slate-400">
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            disabled={disabled}
            required={required}
            className={cn(
              'w-full bg-white border rounded-xl px-4 transition-all duration-150',
              'placeholder:text-slate-400 text-slate-900',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              heightMap[inputSize],
              error
                ? 'border-danger-300 focus:ring-danger-300/40 bg-danger-50/20'
                : 'border-slate-200 focus:ring-primary-400/30 focus:border-primary-400',
              prefix && 'pl-10 rtl:pl-4 rtl:pr-10',
              (suffix || isPassword) && 'pr-11 rtl:pr-4 rtl:pl-11',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-3.5 rtl:pr-0 rtl:pl-3.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {suffix && !isPassword && (
            <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-3.5 rtl:pr-0 rtl:pl-3.5 pointer-events-none text-slate-400 text-sm">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-danger-500 rtl:text-right flex items-center gap-1">
            {error}
          </p>
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
