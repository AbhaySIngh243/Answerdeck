import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    iconClass: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    className: 'border-red-200 bg-red-50 text-red-700',
    iconClass: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    iconClass: 'text-amber-500',
  },
  info: {
    icon: Info,
    className: 'border-slate-200 bg-white text-slate-700',
    iconClass: 'text-brand-primary',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = toast?.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = {
        id,
        variant: toast?.variant || 'info',
        title: toast?.title || '',
        description: toast?.description || '',
        duration: toast?.duration ?? 4200,
      };
      setToasts((prev) => [...prev, entry]);
      if (entry.duration > 0) {
        setTimeout(() => dismiss(id), entry.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, description, opts) => push({ variant: 'success', title, description, ...opts }),
      error: (title, description, opts) => push({ variant: 'error', title, description, ...opts }),
      warning: (title, description, opts) => push({ variant: 'warning', title, description, ...opts }),
      info: (title, description, opts) => push({ variant: 'info', title, description, ...opts }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-xs flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const variant = VARIANTS[t.variant] || VARIANTS.info;
            const Icon = variant.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20, y: -4 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto relative flex items-start gap-2 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-sm ${variant.className}`}
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${variant.iconClass}`} />
                <div className="flex-1 text-xs leading-snug">
                  {t.title ? <p className="text-sm font-semibold">{t.title}</p> : null}
                  {t.description ? <p className="mt-0.5 opacity-90">{t.description}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="rounded p-0.5 text-current/60 hover:bg-black/5"
                  aria-label="Dismiss toast"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback that does not crash in tests / SSR.
    return {
      push: () => null,
      dismiss: () => null,
      success: () => null,
      error: () => null,
      warning: () => null,
      info: () => null,
    };
  }
  return ctx;
}
