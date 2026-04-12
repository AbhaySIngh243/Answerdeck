import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { cn } from '../../../lib/utils';

export function SectionScaffold({ title, description, actions, className, children }) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatePanel({ title, description, action, variant = 'neutral' }) {
  const ring = variant === 'danger' ? 'border-red-200 bg-red-50' : variant === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50';
  return (
    <Card className={cn('rounded-xl', ring)}>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}

