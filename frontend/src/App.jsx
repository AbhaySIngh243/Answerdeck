import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/toast';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import LandingPage from './components/LandingPage';
import PrivacyPage from './components/PrivacyPage';
import TermsPage from './components/TermsPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import HowItWorksPage from './components/HowItWorksPage';
import PricingPage from './components/PricingPage';
import CookieConsentBanner from './components/CookieConsentBanner';

const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout'));
const DashboardHome = lazy(() => import('./components/dashboard/DashboardHome'));
const ProjectsView = lazy(() => import('./components/dashboard/ProjectsView'));
const ProjectDetailView = lazy(() => import('./components/dashboard/ProjectDetailView'));
const ProjectPromptSetupView = lazy(() => import('./components/dashboard/ProjectPromptSetupView'));
const ProjectOnboardingWizard = lazy(() => import('./components/dashboard/ProjectOnboardingWizard'));
const ReportsView = lazy(() => import('./components/dashboard/ReportsView'));
const SettingsView = lazy(() => import('./components/dashboard/SettingsView'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(3000 * Math.pow(2, attempt), 15000),
    },
  },
});

function hideFloatingClerkPath(pathname) {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/contact') ||
    pathname.startsWith('/how-it-works') ||
    pathname.startsWith('/pricing')
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return null;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const showFloatingClerk = !hideFloatingClerkPath(pathname);

  return (
    <>
      <ScrollToTop />
      {showFloatingClerk ? (
        <div className="fixed z-50 flex items-center gap-2 pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] right-0 top-0">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-full border border-[#e2e8f0] bg-white/90 px-3 py-1.5 text-sm font-medium text-[#0f172a] shadow-sm backdrop-blur-sm transition-colors hover:bg-[#f8fafc]"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-full bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-[#3b82f6]"
              >
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        {/* Clerk's "routing=path" may navigate to sub-routes under these paths. */}
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/signup/*" element={<SignupPage />} />
        <Route
          path="/dashboard/project/:id/onboarding"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteLoader />}>
                <ProjectOnboardingWizard />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteLoader />}>
                <DashboardLayout />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<RouteLoader />}><DashboardHome /></Suspense>} />
          <Route path="projects" element={<Suspense fallback={<RouteLoader />}><ProjectsView /></Suspense>} />
          <Route path="project/:id" element={<Suspense fallback={<RouteLoader />}><ProjectDetailView /></Suspense>} />
          <Route path="project/:id/prompts/setup" element={<Suspense fallback={<RouteLoader />}><ProjectPromptSetupView /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<RouteLoader />}><ReportsView /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<RouteLoader />}><SettingsView /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function RouteLoader() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <div className="min-h-screen bg-transparent selection:bg-brand-primary/25 selection:text-white">
              <AppRoutes />
              <CookieConsentBanner />
            </div>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
