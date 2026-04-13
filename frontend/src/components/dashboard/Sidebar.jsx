import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  FolderKanban,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import { cn } from '../../lib/utils';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', icon: Home, label: 'Home', end: true },
      { to: '/dashboard/projects', icon: FolderKanban, label: 'Projects' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/dashboard/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar({
  expanded,
  onToggle,
  className,
}) {
  return (
    <motion.aside
      animate={{ width: expanded ? 256 : 72 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative hidden flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur-xl lg:flex',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-100/80 px-4">
        <NavLink
          to="/"
          className="inline-flex min-w-0 transition-transform hover:scale-[1.02]"
          aria-label="Answrdeck home"
        >
          {expanded ? (
            <BrandLogo variant="lockup" size="xs" className="min-w-0 max-w-full" />
          ) : (
            <BrandLogo variant="mark" size="xs" className="h-8 w-8" />
          )}
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <AnimatePresence>
              {expanded && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5 px-3">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                      !expanded && 'justify-center px-0'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-primary"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <item.icon className={cn('h-[18px] w-[18px] shrink-0', !expanded && 'h-5 w-5')} />
                      <AnimatePresence>
                        {expanded && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="overflow-hidden whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {expanded ? (
          <ChevronLeft className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
    </motion.aside>
  );
}
