import React from 'react';
import { cn } from '../../../lib/utils';

export function SectionScaffold({ title, description, actions, className, children }) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 border-b border-slate-200/60 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StatePanel({ title, description, action, variant = 'neutral' }) {
  const ring =
    variant === 'danger'
      ? 'border-red-200/60 bg-red-50/60'
      : variant === 'warning'
        ? 'border-amber-200/60 bg-amber-50/60'
        : 'border-slate-200/60 bg-slate-50/60';
  return (
    <div
      className={cn(
        'glass-card-v2 space-y-3 p-6',
        ring
      )}
    >
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description ? (
        <p className="text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
