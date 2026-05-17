import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function StatsCard({
  label,
  value,
  trend,
  trendValue,
  icon: Icon,
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
      className={cn(
        'rounded-lg border border-slate-100/90 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.03)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-tight text-slate-600">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
            <Icon className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
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
        {sub && <span className="text-[11px] font-normal text-slate-400">{sub}</span>}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
    </motion.div>
  );
}
