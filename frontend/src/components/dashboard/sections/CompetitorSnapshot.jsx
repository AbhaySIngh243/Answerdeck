import React from 'react';
import { motion } from 'framer-motion';
import { Users, Target } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function CompetitorSnapshot({ competitors, onViewAll }) {
  const rows = Array.isArray(competitors) ? competitors : [];
  const sorted = [...rows].sort((a, b) => {
    const visDiff =
      Number(b.visibility_pct ?? b.visibility ?? 0) -
      Number(a.visibility_pct ?? a.visibility ?? 0);
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
      className="rounded-2xl border border-slate-200/60 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-800">
              Answer rankings
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Sorted by how often each brand is named in model answers.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <Target className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-400">
              No answer ranking yet
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Run an analysis to populate
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Brand
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Answer visibility
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Answer position
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.slice(0, 6).map((c, idx) => {
                  const vis =
                    Number(c.visibility_pct ?? c.visibility ?? 0) || 0;
                  const avgPos =
                    c.avg_rank ?? c.avg_pos ?? c.avg_position;
                  const isFocus = focusIndex === idx;

                  return (
                    <tr
                      key={c.brand || idx}
                      className={cn(
                        'transition-colors',
                        isFocus
                          ? 'bg-brand-primary/[0.04]'
                          : 'hover:bg-slate-50/40'
                      )}
                    >
                      <td className="px-4 py-3.5 text-[13px] text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'text-[13px] font-semibold',
                            isFocus
                              ? 'text-brand-primary'
                              : 'text-slate-800'
                          )}
                        >
                          {c.brand || '-'}
                          {c.is_focus && (
                            <span className="ml-1 text-[11px] font-bold text-brand-primary">
                              (You)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-[13px] font-bold text-brand-primary">
                          {vis}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-[13px] font-bold text-slate-700">
                          {avgPos != null ? (
                            `#${avgPos}`
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
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
