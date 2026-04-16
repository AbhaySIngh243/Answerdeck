import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

const ACCENT_MAP = {
  blue: { iconBg: 'bg-blue-100 text-blue-600' },
  green: { iconBg: 'bg-emerald-100 text-emerald-600' },
  amber: { iconBg: 'bg-amber-100 text-amber-600' },
  purple: { iconBg: 'bg-purple-100 text-purple-600' },
};

export function MetricTile({ label, value, sub, delta, deltaUp, actions, icon: Icon, accent = 'blue', className }) {
  const colors = ACCENT_MAP[accent] || ACCENT_MAP.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'glass-card-v2 relative p-6 transition-shadow duration-200',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1rem]">
        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-slate-100/40 to-transparent" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="text-xl font-bold leading-snug tracking-tight text-slate-900 tabular-nums sm:text-2xl">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', colors.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="relative mt-4 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {delta != null && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                deltaUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
              )}
            >
              {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta}
            </span>
          )}
          {sub && <span className="min-w-0 text-[11px] leading-relaxed text-slate-400">{sub}</span>}
        </div>
        {actions && <div className="flex justify-end">{actions}</div>}
      </div>
    </motion.div>
  );
}
