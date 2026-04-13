import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardCard({
  title,
  description,
  icon: Icon,
  headerAction,
  className,
  noPadding,
  children,
}) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        'glass-card-v2 overflow-hidden transition-shadow duration-200',
        className
      )}
    >
      {(title || headerAction) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100/80 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <Icon className="h-4.5 w-4.5" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-sm font-semibold text-slate-800">
                  {title}
                </h3>
              )}
              {description && (
                <p className="truncate text-xs text-slate-400">{description}</p>
              )}
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </motion.div>
  );
}
