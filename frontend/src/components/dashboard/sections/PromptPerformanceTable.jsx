import React from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';

function VisibilityBar({ value }) {
  const pct = Number(value) || 0;
  const color = pct > 70 ? 'bg-emerald-500' : pct > 40 ? 'bg-amber-400' : 'bg-red-400';
  const textColor = pct > 70 ? 'text-emerald-600' : pct > 40 ? 'text-amber-600' : 'text-red-500';
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={cn('text-xs font-bold tabular-nums', textColor)}>{pct}%</span>
    </div>
  );
}

function SentimentDot({ sentiment }) {
  const s = String(sentiment || 'neutral').toLowerCase();
  const config = s === 'positive' ? { color: 'bg-emerald-500', label: 'Positive' }
    : s === 'negative' ? { color: 'bg-red-400', label: 'Negative' }
    : { color: 'bg-slate-300', label: 'Neutral' };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={cn('h-2 w-2 rounded-full', config.color)} />
      {config.label}
    </span>
  );
}

export default function PromptPerformanceTable({ loading, rows, onViewAll }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-v2 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
            <FileText className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Prompt Performance</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="text-brand-primary">
          View all
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              {['Prompt', 'Visibility', 'Quality', 'Rank', 'Sentiment'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`sk-${idx}`} className="border-b border-slate-50">
                  <td className="px-5 py-3.5"><div className="h-3.5 w-44 animate-pulse rounded-md bg-slate-100" /></td>
                  <td className="px-5 py-3.5"><div className="h-3 w-20 animate-pulse rounded-md bg-slate-100" /></td>
                  <td className="px-5 py-3.5"><div className="h-3 w-10 animate-pulse rounded-md bg-slate-100" /></td>
                  <td className="px-5 py-3.5"><div className="h-3 w-8 animate-pulse rounded-md bg-slate-100" /></td>
                  <td className="px-5 py-3.5"><div className="h-3 w-16 animate-pulse rounded-md bg-slate-100" /></td>
                </tr>
              ))
              : (rows || []).slice(0, 8).map((row, idx) => (
                <tr key={row.prompt_id} className={cn('transition-colors hover:bg-slate-50/50', idx < (rows || []).slice(0, 8).length - 1 && 'border-b border-slate-50')}>
                  <td className="max-w-[260px] truncate px-5 py-3.5 text-[13px] font-medium text-slate-800">{row.prompt_text}</td>
                  <td className="px-5 py-3.5"><VisibilityBar value={row.visibility_pct ?? row.visibility} /></td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold tabular-nums text-slate-600">{row.quality_score ?? '-'}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold tabular-nums',
                      (row.avg_rank ?? 99) <= 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'
                    )}>
                      {row.avg_rank ?? '-'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><SentimentDot sentiment={row.sentiment} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
