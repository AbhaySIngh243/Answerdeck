import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLOR_MAP = {
  blue: 'bg-brand-primary/10 text-brand-primary',
  green: 'bg-emerald-500/10 text-emerald-600',
  amber: 'bg-amber-500/10 text-amber-600',
  purple: 'bg-violet-500/10 text-violet-600',
  red: 'bg-red-500/10 text-red-600',
};

export default function StatsCard({
  label,
  value,
  trend,
  trendValue,
  icon: Icon,
  color = 'blue',
  sub,
  actions,
  className,
}) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-600 bg-emerald-50'
      : trend === 'down'
        ? 'text-red-500 bg-red-50'
        : 'text-slate-400 bg-slate-50';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn('glass-card-v2 p-5 transition-shadow duration-200', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              COLOR_MAP[color] || COLOR_MAP.blue
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend && trendValue && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              trendColor
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </span>
        )}
        {sub && (
          <span className="text-xs text-slate-400">{sub}</span>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
    </motion.div>
  );
}
