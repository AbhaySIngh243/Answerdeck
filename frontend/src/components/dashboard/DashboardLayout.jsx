import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import {
  FolderKanban,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clerkAppearance } from '../../lib/clerkAppearance';
import BrandLogo from '../BrandLogo';
import { warmUpBackend } from '../../lib/api';

function clerkPrimaryEmail(u) {
  if (!u) return '';
  return (
    u.primaryEmailAddress?.emailAddress ??
    u.emailAddresses?.[0]?.emailAddress ??
    ''
  );
}

function clerkDisplayName(u) {
  if (!u) return '';
  const full = u.fullName?.trim();
  if (full) return full;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return u.username?.trim() ?? '';
}

const DashboardLayout = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = useMemo(() => clerkPrimaryEmail(user), [user]);
  const displayName = useMemo(() => clerkDisplayName(user), [user]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    warmUpBackend().then((ok) => setBackendReady(ok));
  }, []);
  /** Desktop (lg+): full main nav vs hidden rail — more room for project views. */
  const [mainNavExpanded, setMainNavExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('dashboard-main-nav') !== 'collapsed';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('dashboard-main-nav', mainNavExpanded ? 'expanded' : 'collapsed');
    } catch {
      /* ignore */
    }
  }, [mainNavExpanded]);

  const userButtonAppearance = useMemo(
    () => ({
      ...clerkAppearance,
      elements: {
        ...clerkAppearance.elements,
        userButtonAvatarBox: 'h-9 w-9 sm:h-10 sm:w-10 ring-2 ring-slate-100',
        userButtonTrigger: 'rounded-2xl ring-2 ring-slate-100 focus:shadow-none',
      },
    }),
    []
  );

  useEffect(() => {
    document.body.classList.add('dashboard-mode');
    return () => {
      document.body.classList.remove('dashboard-mode');
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    setSidebarOpen(false);
    await signOut();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `flex min-h-[2.75rem] touch-manipulation items-center gap-3 border-l-[3px] rounded-xl py-3 pl-[13px] pr-4 text-sm font-semibold transition-all duration-200 ${
      isActive
        ? 'border-brand-primary bg-brand-primary/[0.08] text-brand-primary shadow-sm'
        : 'border-transparent text-[#64748b] hover:border-slate-200 hover:bg-slate-50 hover:text-[#0f172a]'
    }`;

  const sidebarInner = (
    <>
      <div className="flex h-16 min-h-[4rem] items-center border-b border-[#e2e8f0] px-4 sm:px-6 lg:h-20">
        <div className="flex w-full items-center justify-between gap-2 lg:justify-start">
          <NavLink
            to="/"
            className="group inline-flex min-w-0 transition-transform hover:scale-[1.01]"
            onClick={() => setSidebarOpen(false)}
            aria-label="Answrdeck home"
          >
            <BrandLogo variant="lockup" size="xs" className="min-w-0 max-w-full" />
          </NavLink>
          <button
            type="button"
            className="touch-manipulation rounded-lg p-2 text-[#64748b] hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5">
        <p className="mb-2 ml-1 text-[10px] font-semibold tracking-wide text-[#64748b]">Main</p>
        <NavLink to="/dashboard" end className={navClass} onClick={() => setSidebarOpen(false)}>
          <FolderKanban className="h-5 w-5 flex-shrink-0" />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/dashboard/reports" className={navClass} onClick={() => setSidebarOpen(false)}>
          <BarChart3 className="h-5 w-5 flex-shrink-0" />
          <span>Reports</span>
        </NavLink>
        <div className="mt-6 border-t border-[#e2e8f0] pt-6">
          <p className="mb-2 ml-1 text-[10px] font-semibold tracking-wide text-[#64748b]">Account</p>
          <NavLink to="/dashboard/settings" className={navClass} onClick={() => setSidebarOpen(false)}>
            <Settings className="h-5 w-5 flex-shrink-0" />
            <span>Settings</span>
          </NavLink>
        </div>
      </nav>
    </>
  );

  return (
    <div className="flex h-[100dvh] min-h-0 w-full min-w-0 bg-[#f8fafc] text-[#0f172a]">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] touch-manipulation bg-slate-900/40 lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-[90] flex w-[min(18rem,88vw)] max-w-[20rem] flex-col border-r border-[#e2e8f0] bg-white transition-[transform,width] duration-200 ease-out lg:static lg:z-20 lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          mainNavExpanded
            ? 'lg:w-72 lg:min-w-[18rem] lg:border-r'
            : 'lg:w-0 lg:min-w-0 lg:max-w-0 lg:overflow-hidden lg:border-r-0'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${!mainNavExpanded ? 'lg:hidden' : ''}`}
        >
          {sidebarInner}
          <button
            type="button"
            className="absolute right-0 top-[5.5rem] z-[95] hidden h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#64748b] shadow-md transition-colors hover:border-brand-primary hover:text-brand-primary lg:flex"
            aria-expanded={mainNavExpanded}
            aria-controls="dashboard-sidebar"
            aria-label="Collapse main menu"
            title="Hide Projects / Reports / Settings"
            onClick={() => setMainNavExpanded(false)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8fafc]">
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white/90 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 sm:min-h-16 sm:px-6 lg:h-20 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="touch-manipulation rounded-xl border border-[#e2e8f0] p-2 text-[#0f172a] hover:bg-slate-50 lg:hidden"
              aria-expanded={sidebarOpen}
              aria-controls="dashboard-sidebar"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={`touch-manipulation rounded-xl border border-[#e2e8f0] p-2 text-[#0f172a] transition-colors hover:border-brand-primary hover:bg-slate-50 hover:text-brand-primary ${
                mainNavExpanded ? 'hidden' : 'hidden lg:inline-flex'
              }`}
              aria-expanded={mainNavExpanded}
              aria-controls="dashboard-sidebar"
              aria-label="Expand main menu"
              title="Show Projects, Reports, Settings"
              onClick={() => setMainNavExpanded(true)}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <h2 className="truncate text-xs font-semibold tracking-wide text-[#64748b]">Dashboard</h2>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 max-w-[min(42vw,11rem)] flex-col items-end text-right sm:max-w-[13rem] lg:max-w-[16rem]">
              <span className="w-full truncate text-xs font-semibold text-[#0f172a]" title={email || undefined}>
                {loading ? 'Loading account…' : email || 'Signed in'}
              </span>
              <span className="w-full truncate text-[10px] font-medium text-[#64748b]" title={displayName || undefined}>
                {displayName || 'Answrdeck'}
              </span>
            </div>
            <UserButton afterSignOutUrl="/" appearance={userButtonAppearance} />
            <button
              type="button"
              onClick={handleSignOut}
              className="touch-manipulation rounded-xl p-2 text-[#64748b] transition-colors hover:bg-slate-100 hover:text-[#0f172a]"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {!backendReady && (
            <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 sm:mx-6 lg:mx-10">
              <svg className="h-4 w-4 shrink-0 animate-spin text-amber-600" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Waking up the server — first load may take up to a minute...
            </div>
          )}
          <div className="mx-auto w-full max-w-[min(100%,1920px)] px-4 py-6 sm:px-6 md:py-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
