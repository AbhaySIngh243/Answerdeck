import React from 'react';
import { motion } from 'framer-motion';
import { Users, Crown, Target } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';

const RANK_COLORS = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-amber-600 text-white'];

export default function CompetitorSnapshot({ competitors, onViewAll }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-v2 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <Users className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Competitor Snapshot</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="text-brand-primary">
          View all
        </Button>
      </div>
      <div className="p-0">
        {(competitors || []).length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <Target className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-400">No competitor data yet</p>
            <p className="mt-0.5 text-xs text-slate-400">Run an analysis to populate</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50/80">
            {(competitors || []).slice(0, 6).map((c, idx) => {
              const vis = c.visibility_pct ?? 0;
              const barColor = vis > 60 ? 'bg-emerald-500' : vis > 30 ? 'bg-brand-primary' : 'bg-amber-400';
              return (
                <div key={c.brand || idx} className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/50">
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                    idx < 3 ? RANK_COLORS[idx] : 'bg-slate-100 text-slate-500'
                  )}>
                    {idx < 3 ? <Crown className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-slate-900">{c.brand}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden w-28 sm:block">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, vis)}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                          className={cn('h-full rounded-full', barColor)}
                        />
                      </div>
                    </div>
                    <span className="min-w-[2.5rem] text-right text-xs font-bold tabular-nums text-slate-700">
                      {vis}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
