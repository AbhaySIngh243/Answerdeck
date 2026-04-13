import React from 'react';
import { cn } from '../../lib/utils';

function Shimmer({ className }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 bg-[length:200%_100%]',
        className
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card-v2 space-y-3 p-5"
        >
          <div className="flex items-center justify-between">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-8 rounded-xl" />
          </div>
          <Shimmer className="h-7 w-24" />
          <Shimmer className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('glass-card-v2 space-y-4 p-6', className)}>
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className }) {
  return (
    <div className={cn('glass-card-v2 overflow-hidden', className)}>
      <div className="border-b border-slate-100 px-5 py-3.5">
        <Shimmer className="h-4 w-36" />
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3">
            {Array.from({ length: cols }).map((__, c) => (
              <Shimmer
                key={c}
                className={cn('h-3', c === 0 ? 'w-40' : 'w-16')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow({ className }) {
  return (
    <div className={cn('flex items-center gap-3 animate-pulse', className)}>
      <Shimmer className="h-9 w-9 rounded-xl" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}
