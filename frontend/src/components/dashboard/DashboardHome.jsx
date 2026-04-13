import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  BarChart3,
  Activity,
  Target,
  ArrowRight,
  Plus,
  FileText,
  Globe,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDomainFromWebsiteUrl } from '../../lib/url';
import DashboardCard from './DashboardCard';
import StatsCard from './StatsCard';
import ActivityFeed from './ActivityFeed';
import { SkeletonStats, SkeletonCard } from './LoadingSkeleton';
import { Button } from '../ui/button';

function clerkDisplayName(u) {
  if (!u) return '';
  const full = u.fullName?.trim();
  if (full) return full;
  const parts = [u.firstName, u.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return u.username?.trim() ?? '';
}

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const DashboardHome = () => {
  const { user, loading: authLoading, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const displayName = useMemo(() => clerkDisplayName(user), [user]);

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: api.getOverview,
    enabled: !authLoading && Boolean(isSignedIn),
    staleTime: 30_000,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    enabled: !authLoading && Boolean(isSignedIn),
    staleTime: 30_000,
  });

  const overviewProjects = overviewData?.projects || [];

  const totalPrompts = overviewProjects.reduce(
    (sum, p) => sum + (p.tracked_prompts || 0),
    0
  );
  const avgScore =
    overviewProjects.length > 0
      ? Math.round(
          overviewProjects.reduce(
            (sum, p) => sum + parseFloat(p.current_score || 0),
            0
          ) / overviewProjects.length
        )
      : 0;

  const activityItems = useMemo(() => {
    return projects.slice(0, 6).map((p) => ({
      id: p.id,
      title: p.name,
      description: `${p.category || 'Project'} · ${p.region || 'Global'}`,
      type: 'project',
      timestamp: p.updated_at || p.created_at,
    }));
  }, [projects]);

  const greeting = displayName
    ? `Welcome back, ${displayName.split(' ')[0]}`
    : 'Welcome back';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-7xl space-y-6"
    >
      {/* Greeting */}
      <motion.div variants={item} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{today}</p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/projects')}
          className="hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </motion.div>

      {/* Stats row */}
      {overviewLoading || projectsLoading ? (
        <SkeletonStats count={4} />
      ) : (
        <motion.div
          variants={container}
          className="grid grid-cols-2 gap-4 xl:grid-cols-4"
        >
          <StatsCard
            label="Projects"
            value={projects.length}
            icon={FolderKanban}
            color="blue"
            sub="active projects"
          />
          <StatsCard
            label="Prompts Tracked"
            value={totalPrompts}
            icon={Target}
            color="purple"
            sub="across all projects"
          />
          <StatsCard
            label="Reports"
            value={overviewProjects.length}
            icon={BarChart3}
            color="amber"
            sub="available"
          />
          <StatsCard
            label="Avg Score"
            value={`${avgScore}%`}
            icon={Activity}
            color="green"
            sub="visibility score"
            trend={avgScore > 50 ? 'up' : avgScore > 0 ? 'down' : undefined}
            trendValue={avgScore > 0 ? `${avgScore}%` : undefined}
          />
        </motion.div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Your Projects */}
        <motion.div variants={item}>
          <DashboardCard
            title="Your Projects"
            icon={FolderKanban}
            headerAction={
              <Link
                to="/dashboard/projects"
                className="text-xs font-medium text-brand-primary hover:underline"
              >
                View all
              </Link>
            }
          >
            {projectsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-slate-100" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ActivityFeed
                items={activityItems}
                emptyMessage="No projects yet. Create your first project to get started."
              />
            )}
          </DashboardCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item}>
          <DashboardCard title="Quick Actions" icon={FileText}>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/projects')}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/60 bg-white/60 p-4 text-left transition-all hover:border-brand-primary/30 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Create New Project
                  </p>
                  <p className="text-xs text-slate-400">
                    Start monitoring a brand
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard/reports')}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/60 bg-white/60 p-4 text-left transition-all hover:border-brand-primary/30 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    View Reports
                  </p>
                  <p className="text-xs text-slate-400">
                    Export CSV and PDF reports
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-500" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard/settings')}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/60 bg-white/60 p-4 text-left transition-all hover:border-brand-primary/30 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 transition-colors group-hover:bg-violet-500 group-hover:text-white">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Settings
                  </p>
                  <p className="text-xs text-slate-400">
                    Configure workspace defaults
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
              </button>
            </div>
          </DashboardCard>
        </motion.div>
      </div>

      {/* Projects mini-grid */}
      {projects.length > 0 && (
        <motion.div variants={item}>
          <DashboardCard
            title="Your Projects"
            icon={FolderKanban}
            headerAction={
              <Link
                to="/dashboard/projects"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 3).map((project) => {
                const domain = getDomainFromWebsiteUrl(project.website_url);
                return (
                  <Link
                    key={project.id}
                    to={`/dashboard/project/${project.id}`}
                    className="group rounded-xl border border-slate-200/60 bg-white/60 p-4 transition-all hover:border-brand-primary/30 hover:shadow-sm"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      {domain && (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                          alt=""
                          loading="lazy"
                          className="h-4 w-4 shrink-0 rounded-sm"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <h4 className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand-primary">
                        {project.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                        {project.category || 'Portfolio'}
                      </span>
                      <span>{project.region || 'Global'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </DashboardCard>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DashboardHome;
