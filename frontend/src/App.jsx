import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/dashboard/DashboardLayout';
import ProjectsView from './components/dashboard/ProjectsView';
import ProjectDetailView from './components/dashboard/ProjectDetailView';
import ProjectPromptSetupView from './components/dashboard/ProjectPromptSetupView';
import ReportsView from './components/dashboard/ReportsView';
import SettingsView from './components/dashboard/SettingsView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

function hideFloatingClerkPath(pathname) {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/dashboard')
  );
}

function AppRoutes() {
  const { pathname } = useLocation();
  const showFloatingClerk = !hideFloatingClerkPath(pathname);

  return (
    <>
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
        {/* Clerk's "routing=path" may navigate to sub-routes under these paths. */}
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/signup/*" element={<SignupPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<ProjectsView />} />
          <Route path="project/:id" element={<ProjectDetailView />} />
          <Route path="project/:id/prompts/setup" element={<ProjectPromptSetupView />} />
          <Route path="reports" element={<ReportsView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <div className="min-h-screen bg-transparent selection:bg-brand-primary/25 selection:text-white">
            <AppRoutes />
          </div>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;

