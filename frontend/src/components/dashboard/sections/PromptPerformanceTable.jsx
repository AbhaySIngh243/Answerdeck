import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';

function VisibilityBar({ value }) {
  const pct = Number(value) || 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-brand-primary">{pct}%</span>
    </div>
  );
}

function statusForVisibility(pct) {
  const v = Number(pct) || 0;
  if (v <= 0) return { label: 'Not named', cls: 'text-slate-400' };
  if (v < 100) return { label: 'Partly named', cls: 'text-brand-primary' };
  return { label: 'Named', cls: 'text-brand-primary' };
}

function ModelBadges({ models }) {
  const list = Array.isArray(models) ? models : [];
  if (!list.length) return <span className="text-xs text-slate-300">-</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.slice(0, 4).map((m) => (
        <span key={m} className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {String(m).slice(0, 10)}
        </span>
      ))}
      {list.length > 4 && (
        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          +{list.length - 4}
        </span>
      )}
    </div>
  );
}

export default function PromptPerformanceTable({ loading, rows, onViewAll }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Prompt visibility</h3>
              <p className="mt-0.5 text-[11px] text-slate-400">Measured only from brand names in model answers</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search prompts..."
                disabled
                className="w-full rounded-xl border border-slate-200/60 bg-white/60 py-2 pl-9 pr-3 text-[13px] font-medium text-slate-600 placeholder:text-slate-400 backdrop-blur-sm"
              />
            </div>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 text-[13px] font-medium text-slate-600 backdrop-blur-sm"
              title="Filter is coming soon"
            >
              All prompts <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-brand-primary">
              View all
            </Button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              {['Prompt', 'Answer visibility', 'Answer position', 'Models', 'Top competitor', 'Answer status'].map((h) => (
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
                  <td className="px-5 py-3.5"><div className="h-5 w-28 animate-pulse rounded-md bg-slate-100" /></td>
                  <td className="px-5 py-3.5"><div className="h-3 w-16 animate-pulse rounded-md bg-slate-100" /></td>
                  <td className="px-5 py-3.5"><div className="h-3 w-12 animate-pulse rounded-md bg-slate-100" /></td>
                </tr>
              ))
              : safeRows.slice(0, 8).map((row, idx) => {
                const vis = row.visibility_pct ?? row.visibility ?? 0;
                const status = statusForVisibility(vis);
                return (
                  <tr key={`${row.prompt_id ?? idx}`} className={cn('transition-colors hover:bg-slate-50/50', idx < safeRows.slice(0, 8).length - 1 && 'border-b border-slate-50')}>
                    <td className="max-w-[260px] truncate px-5 py-3.5 text-[13px] font-semibold text-slate-800">
                      {row.prompt_text}
                      {row.updated_at && (
                        <div className="mt-0.5 text-[11px] font-medium text-slate-400">
                          Updated {String(row.updated_at).slice(0, 10)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><VisibilityBar value={vis} /></td>
                    <td className="px-5 py-3.5 text-xs font-semibold tabular-nums text-slate-700">
                      {row.avg_rank != null ? `#${row.avg_rank}` : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <ModelBadges models={row.models} />
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                      {row.top_competitor || row.topCompetitor || <span className="text-slate-300">-</span>}
                    </td>
                    <td className={cn('px-5 py-3.5 text-xs font-semibold', status.cls)}>{status.label}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
