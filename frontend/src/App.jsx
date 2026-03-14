import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './components/LandingPage';
import DashboardLayout from './components/dashboard/DashboardLayout';
import ProjectsView from './components/dashboard/ProjectsView';
import ProjectDetailView from './components/dashboard/ProjectDetailView';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
      <div className="min-h-screen bg-white selection:bg-brand-accent selection:text-brand-primary">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<ProjectsView />} />
            <Route path="project/:id" element={<ProjectDetailView />} />
            <Route path="reports" element={<ReportsView />} />
            <Route path="settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </div>
    </Router>
    </QueryClientProvider>
  );
}

export default App;
