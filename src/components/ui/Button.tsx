import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const variants = {
  primary:   'bg-primary-700 text-white hover:bg-primary-800 shadow-btn hover:shadow-btn-hover focus-visible:ring-primary-400',
  secondary: 'bg-primary-400 text-white hover:bg-primary-500 shadow-sm focus-visible:ring-primary-300',
  accent:    'bg-accent-500 text-white hover:bg-accent-600 shadow-btn-accent focus-visible:ring-accent-400',
  outline:   'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-300',
  danger:    'bg-danger-500 text-white hover:bg-danger-600 shadow-sm focus-visible:ring-danger-400',
  success:   'bg-success-500 text-white hover:bg-success-600 shadow-sm focus-visible:ring-success-400',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-200',
} as const;

const sizes = {
  xs: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 h-8',
  sm: 'px-4 py-2 text-sm rounded-xl gap-2 h-9',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2 h-11',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2.5 h-12',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, icon, fullWidth = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className={cn('animate-spin flex-shrink-0', size === 'xs' || size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        ) : icon ? (
          <span className={cn('flex-shrink-0', size === 'xs' || size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4', '[&>svg]:w-full [&>svg]:h-full')}>
            {icon}
          </span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
