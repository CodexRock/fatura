import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title = 'Aucune donnée',
  description = 'Il n\'y a rien à afficher pour le moment.',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-5">
        {icon || <Inbox className="w-7 h-7 text-primary-300" />}
      </div>
      <h3 className="text-[15px] font-bold text-slate-700 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
