import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

const ACCENT_MAP = {
  blue: { border: 'border-l-brand-primary', iconBg: 'bg-brand-primary/10 text-brand-primary' },
  green: { border: 'border-l-brand-primary', iconBg: 'bg-brand-primary/10 text-brand-primary' },
  amber: { border: 'border-l-brand-primary', iconBg: 'bg-brand-primary/10 text-brand-primary' },
  purple: { border: 'border-l-brand-primary', iconBg: 'bg-brand-primary/10 text-brand-primary' },
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
        'glass-card-v2 relative overflow-hidden border-l-[3px] p-5 transition-shadow duration-200',
        colors.border,
        className
      )}
    >
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-slate-100/40 to-transparent" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colors.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="relative mt-3 flex items-center gap-2">
        {delta != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              deltaUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
            )}
          >
            {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta}
          </span>
        )}
        {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
    </motion.div>
  );
}
