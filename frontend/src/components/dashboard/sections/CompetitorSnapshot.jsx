import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';

export default function CompetitorSnapshot({ competitors, onViewAll }) {
  return (
    <Card className="overflow-hidden rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
        <CardTitle>Competitor Snapshot</CardTitle>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View all
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {(competitors || []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No competitor data yet. Run an analysis to populate.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {(competitors || []).slice(0, 6).map((c, idx) => {
              const vis = c.visibility_pct ?? 0;
              return (
                <div key={c.brand || idx} className="flex items-center gap-4 px-5 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{c.brand}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden w-24 sm:block">
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-brand-primary transition-all" style={{ width: `${Math.min(100, vis)}%` }} />
                      </div>
                    </div>
                    <span className="min-w-[3rem] text-right text-xs font-bold tabular-nums text-slate-700">{vis}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
