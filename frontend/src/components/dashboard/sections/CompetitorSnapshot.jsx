import React from 'react';
import { motion } from 'framer-motion';
import { Users, Target } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';



export default function CompetitorSnapshot({ competitors, onViewAll }) {
  const rows = Array.isArray(competitors) ? competitors : [];
  const sorted = [...rows].sort((a, b) => {
    const visDiff = Number(b.visibility_pct ?? b.visibility ?? 0) - Number(a.visibility_pct ?? a.visibility ?? 0);
    if (visDiff !== 0) return visDiff;
    const aRank = a.avg_rank ?? a.avg_pos ?? a.avg_position ?? 999;
    const bRank = b.avg_rank ?? b.avg_pos ?? b.avg_position ?? 999;
    return aRank - bRank;
  });
  const focusIndex = sorted.findIndex((r) => Boolean(r?.is_focus));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-v2 overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-brand-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">Competitors</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">Sorted by visibility across prompts.</p>
          </div>
        </div>
      </div>
      <div className="px-6 pb-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <Target className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-400">No competitor data yet</p>
            <p className="mt-0.5 text-xs text-slate-400">Run an analysis to populate</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  {['#', 'Competitor', 'Visibility', 'Avg pos'].map((h, i) => (
                    <th 
                      key={h} 
                      className={cn(
                        "px-4 py-3.5 text-xs font-semibold text-slate-500",
                        i >= 2 ? "text-center" : "text-left"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {sorted.slice(0, 6).map((c, idx) => {
                  const vis = Number(c.visibility_pct ?? c.visibility ?? 0) || 0;
                  const avgPos = c.avg_rank ?? c.avg_pos ?? c.avg_position;
                  const barColor = vis > 60 ? 'bg-emerald-500' : vis > 30 ? 'bg-brand-primary' : 'bg-amber-400';
                  return (
                    <tr
                      key={c.brand || idx}
                      className={cn(
                        'transition-colors hover:bg-slate-50/50',
                        focusIndex === idx && 'bg-brand-primary/[0.08]'
                      )}
                    >
                      <td className="px-4 py-4 text-[13px] font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className={cn("max-w-[180px] truncate px-4 py-4 text-[13px] font-semibold text-slate-800", focusIndex === idx && "text-brand-primary")}>
                        <div className="leading-tight">{c.brand || '—'}</div>
                        {c.is_focus && <div className="mt-1 text-[11px] font-bold tracking-wide">(You)</div>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[13px] font-bold text-slate-700">{vis}%</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[13px] font-bold text-slate-700">
                          {avgPos != null ? avgPos : <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
