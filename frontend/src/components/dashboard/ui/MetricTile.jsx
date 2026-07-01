import React from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { cn } from '../../../lib/utils';

/** KPI tile — circular blue icon, Inter hierarchy (reference overview row). */
export function MetricTile({ label, value, sub, hint, icon: Icon, className, valueClassName }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative rounded-lg border border-slate-100/90 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_rgba(15,23,42,0.03)]',
        className
      )}
    >
      {hint ? (
        <button
          type="button"
          title={hint}
          aria-label={`About ${label}`}
          className="absolute right-2 top-2 rounded p-0.5 text-slate-300 transition-colors hover:text-slate-500"
        >
          <Info className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <div className="flex items-start justify-between gap-2 pr-4">
        <p className="text-xs font-semibold leading-tight text-slate-600">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
            <Icon className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden />
          </div>
        )}
      </div>
      <p
        className={cn(
          'mt-1.5 text-xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums',
          valueClassName
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-normal leading-snug text-slate-400">{sub}</p>
      )}
    </motion.div>
  );
}
