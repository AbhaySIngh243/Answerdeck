import React from 'react';
import { motion } from 'framer-motion';
import { Activity, FolderKanban, BarChart3, FileText, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

const TYPE_CONFIG = {
  analysis: { icon: Activity, color: 'bg-brand-primary/10 text-brand-primary' },
  project: { icon: FolderKanban, color: 'bg-emerald-500/10 text-emerald-600' },
  report: { icon: BarChart3, color: 'bg-amber-500/10 text-amber-600' },
  action: { icon: Zap, color: 'bg-violet-500/10 text-violet-600' },
  default: { icon: FileText, color: 'bg-slate-100 text-slate-500' },
};

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

export default function ActivityFeed({ items = [], className, emptyMessage }) {
  if (items.length === 0) {
    return (
      <div className={cn('py-8 text-center text-sm text-slate-400', className)}>
        {emptyMessage || 'No recent activity'}
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className={cn('space-y-1', className)}
    >
      {items.map((entry, idx) => {
        const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.default;
        const IconComponent = entry.icon || config.icon;
        return (
          <motion.div
            key={entry.id || idx}
            variants={item}
            className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/80"
          >
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                config.color
              )}
            >
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">
                {entry.title}
              </p>
              {entry.description && (
                <p className="truncate text-xs text-slate-400">
                  {entry.description}
                </p>
              )}
            </div>
            <span className="shrink-0 pt-0.5 text-[11px] text-slate-400">
              {formatRelativeTime(entry.timestamp)}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
