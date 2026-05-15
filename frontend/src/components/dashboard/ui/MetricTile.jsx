import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';

const ACCENT_MAP = {
  blue: { iconBg: 'bg-blue-50 text-blue-500', ring: 'ring-blue-100/60' },
  green: { iconBg: 'bg-emerald-50 text-emerald-500', ring: 'ring-emerald-100/60' },
  amber: { iconBg: 'bg-amber-50 text-amber-500', ring: 'ring-amber-100/60' },
  purple: { iconBg: 'bg-purple-50 text-purple-500', ring: 'ring-purple-100/60' },
};

export function MetricTile({ label, value, sub, icon: Icon, accent = 'blue', className }) {
  const colors = ACCENT_MAP[accent] || ACCENT_MAP.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'rounded-2xl border border-slate-200/60 bg-white px-5 py-5 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              colors.iconBg
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 truncate text-[11px] leading-relaxed text-slate-400">{sub}</p>
      )}
    </motion.div>
  );
}
