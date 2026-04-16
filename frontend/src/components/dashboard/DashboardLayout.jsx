import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home,
  FolderKanban,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { warmUpBackend } from '../../lib/api';
import { PENDING_RAZORPAY_PLAN_KEY, startSubscriptionCheckout } from '../../lib/subscriptionCheckout';
import Sidebar from './Sidebar';
import DashboardNavbar from './DashboardNavbar';
import BrandLogo from '../BrandLogo';
import { cn } from '../../lib/utils';

const MOBILE_NAV = [
  { to: '/dashboard', icon: Home, label: 'Home', end: true },
  { to: '/dashboard/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/dashboard/reports', icon: BarChart3, label: 'Reports' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

const DashboardLayout = () => {
  const { signOut, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [backendReady, setBackendReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Prevents duplicate subscribe/checkout when React Strict Mode runs effects twice in dev. */
  const razorpayInFlightRef = useRef(false);

  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('dashboard-main-nav') !== 'collapsed';
  });

  useEffect(() => {
    warmUpBackend().then((ok) => setBackendReady(ok));
  }, []);

  useEffect(() => {
    if (!isSignedIn || !backendReady) return undefined;
    if (razorpayInFlightRef.current) return undefined;

    let plan;
    try {
      plan = sessionStorage.getItem(PENDING_RAZORPAY_PLAN_KEY);
    } catch {
      return undefined;
    }
    if (!plan || !['standard', 'pro'].includes(plan)) return undefined;

    razorpayInFlightRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        sessionStorage.removeItem(PENDING_RAZORPAY_PLAN_KEY);
        const outcome = await startSubscriptionCheckout(plan);
        if (outcome === 'paid') {
          queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          try {
            sessionStorage.setItem(PENDING_RAZORPAY_PLAN_KEY, plan);
          } catch {
            /* ignore */
          }
        }
      } finally {
        razorpayInFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, backendReady, queryClient]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'dashboard-main-nav',
        sidebarExpanded ? 'expanded' : 'collapsed'
      );
    } catch { /* ignore */ }
  }, [sidebarExpanded]);

  useEffect(() => {
    document.body.classList.add('dashboard-mode');
    return () => document.body.classList.remove('dashboard-mode');
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    setMobileOpen(false);
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex h-[100dvh] min-h-0 w-full min-w-0 bg-page text-slate-900">
      {/* Desktop sidebar */}
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((v) => !v)}
      />

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-slate-200 bg-white shadow-xl lg:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
                <NavLink to="/" onClick={() => setMobileOpen(false)}>
                  <BrandLogo variant="lockup" size="xs" />
                </NavLink>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4">
                <div className="space-y-1 px-3">
                  {MOBILE_NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-brand-primary/10 text-brand-primary'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        )
                      }
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardNavbar
          onMenuClick={() => setMobileOpen(true)}
          onSignOut={handleSignOut}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {!backendReady && (
            <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-xs font-medium text-amber-800 backdrop-blur-sm sm:mx-6 lg:mx-8">
              <svg
                className="h-4 w-4 shrink-0 animate-spin text-amber-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Waking up the server — first load may take up to a minute...
            </div>
          )}
          <div className="mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-6 md:py-8 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
