import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

// =============================================================================
// TYPES
// =============================================================================

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  className?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  /** Unique key extractor for each row */
  rowKey?: (row: T, index: number) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function DataTable<T>({
  columns,
  data,
  loading = false,
  skeletonRows = 5,
  onRowClick,
  emptyIcon,
  emptyTitle = 'Aucune donnée',
  emptyDescription = 'Il n\'y a rien à afficher pour le moment.',
  emptyAction,
  pageSize = 10,
  className,
  rowClassName,
  rowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  // Sorting
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a: any, b: any) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  // Loading state
  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden', className)}>
        {/* Desktop skeleton */}
        <div className="hidden md:block">
          <div className="border-b border-slate-100 px-6 py-3 flex gap-4">
            {columns.map((col) => (
              <div key={col.key} className={cn('flex-1', col.headerClassName)}>
                <Skeleton variant="line" className="h-4 w-20" />
              </div>
            ))}
          </div>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-slate-50 flex gap-4">
              {columns.map((col) => (
                <div key={col.key} className={cn('flex-1', col.className)}>
                  <Skeleton variant="line" className="h-4" />
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-3 p-4">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm', className)}>
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  const getRowKey = (row: T, index: number) => {
    if (rowKey) return rowKey(row, index);
    return (row as any).id || String(index);
  };

  const getRowClassname = (row: T, index: number) => {
    if (typeof rowClassName === 'function') return rowClassName(row, index);
    return rowClassName || '';
  };

  return (
    <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden', className)}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-6 py-3 text-left rtl:text-right text-xs font-bold text-slate-500 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-slate-900 transition-colors',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key
                        ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />)
                        : <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-slate-50 last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-slate-50/70',
                  getRowClassname(row, i)
                )}
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('px-6 py-3.5 text-slate-700', col.className)}>
                    {col.render(row, page * pageSize + i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {pagedData.map((row, i) => (
          <div
            key={getRowKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'p-4 space-y-2 transition-colors',
              onRowClick && 'cursor-pointer active:bg-slate-50',
              getRowClassname(row, i)
            )}
          >
            {columns.map(col => (
              <div key={col.key} className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase">{col.header}</span>
                <span className="text-sm text-slate-700 text-right rtl:text-left">{col.render(row, page * pageSize + i)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sortedData.length)} sur {sortedData.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const pageNum = totalPages <= 7 ? i : (page <= 3 ? i : page >= totalPages - 4 ? totalPages - 7 + i : page - 3 + i);
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                    page === pageNum
                      ? 'bg-[#1B4965] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
