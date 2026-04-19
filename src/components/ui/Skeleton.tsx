import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  variant?: 'line' | 'circle' | 'card' | 'table-row';
  className?: string;
  count?: number;
}

function SkeletonBase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-slate-200/60 rounded-lg animate-pulse',
        className
      )}
    />
  );
}

export default function Skeleton({ variant = 'line', className, count = 1 }: SkeletonProps) {
  const items = Array.from({ length: count });

  switch (variant) {
    case 'circle':
      return (
        <>
          {items.map((_, i) => (
            <SkeletonBase key={i} className={cn('w-10 h-10 rounded-full', className)} />
          ))}
        </>
      );

    case 'card':
      return (
        <>
          {items.map((_, i) => (
            <div key={i} className={cn('bg-white rounded-2xl border border-slate-100 p-5 space-y-3', className)}>
              <div className="flex items-center gap-3">
                <SkeletonBase className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonBase className="h-4 w-2/3" />
                  <SkeletonBase className="h-3 w-1/3" />
                </div>
              </div>
              <SkeletonBase className="h-3 w-full" />
              <SkeletonBase className="h-3 w-4/5" />
            </div>
          ))}
        </>
      );

    case 'table-row':
      return (
        <>
          {items.map((_, i) => (
            <div key={i} className={cn('flex items-center gap-4 px-6 py-4 border-b border-slate-50', className)}>
              <SkeletonBase className="h-4 w-24" />
              <SkeletonBase className="h-4 flex-1" />
              <SkeletonBase className="h-4 w-20" />
              <SkeletonBase className="h-4 w-16" />
            </div>
          ))}
        </>
      );

    case 'line':
    default:
      return (
        <>
          {items.map((_, i) => (
            <SkeletonBase key={i} className={cn('h-4 w-full', className)} />
          ))}
        </>
      );
  }
}
