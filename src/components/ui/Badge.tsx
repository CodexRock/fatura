import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  // Invoice statuses
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  // Extra utility variants
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  primary: 'bg-[#1B4965]/5 text-[#1B4965] border-[#1B4965]/15',
  accent: 'bg-[#F4A261]/10 text-[#F4A261] border-[#F4A261]/20',
} as const;

const dotColors: Record<string, string> = {
  draft: 'bg-slate-400',
  sent: 'bg-blue-500',
  paid: 'bg-emerald-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-slate-400',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  primary: 'bg-[#1B4965]',
  accent: 'bg-[#F4A261]',
};

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
} as const;

export interface BadgeProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = 'draft',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
