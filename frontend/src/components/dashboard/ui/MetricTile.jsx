import React from 'react';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { cn } from '../../../lib/utils';

export function MetricTile({ label, value, sub, delta, deltaUp, actions, className }) {
  return (
    <Card className={cn('rounded-xl', className)}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          {actions}
        </div>
        <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
        <div className="flex items-center gap-2">
          {delta != null ? (
            <Badge variant={deltaUp ? 'success' : 'danger'}>
              {deltaUp ? '↑' : '↓'} {delta}
            </Badge>
          ) : null}
          {sub ? <span className="text-xs text-slate-500">{sub}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

