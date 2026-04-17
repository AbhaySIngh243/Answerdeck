import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  BarChart3,
  Activity,
  Target,
  AlertTriangle,
  ArrowRight,
  Plus,
  FileText,
  Globe,
  Search,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDomainFromWebsiteUrl } from '../../lib/url';
import DashboardCard from './DashboardCard';
import StatsCard from './StatsCard';
import { SkeletonStats } from './LoadingSkeleton';
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

const promptItem = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const DashboardHome = () => {
  const { user, loading: authLoading, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const displayName = useMemo(() => clerkDisplayName(user), [user]);
  const homeRequestOptions = { timeoutMs: 15_000, retries: 0 };

  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: () => api.getOverview(homeRequestOptions),
    enabled: !authLoading && Boolean(isSignedIn),
    staleTime: 30_000,
    retry: 0,
  });

  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(homeRequestOptions),
    enabled: !authLoading && Boolean(isSignedIn),
    staleTime: 30_000,
    retry: 0,
  });

  const latestProject = Array.isArray(projects) && projects.length > 0 ? projects[0] : null;

  const {
    data: latestPrompts = [],
    isLoading: promptsLoading,
    error: promptsError,
    refetch: refetchPrompts,
  } = useQuery({
    queryKey: ['prompts', latestProject?.id],
    queryFn: () => api.getPrompts(latestProject.id, homeRequestOptions),
    enabled: Boolean(latestProject?.id),
    staleTime: 30_000,
    retry: 0,
  });

  const homeError = overviewError || projectsError;
  const promptLoadError = promptsError && latestProject;

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

      {homeError ? (
        <motion.div
          variants={item}
          className="glass-card-v2 flex flex-col gap-3 border-amber-200/60 bg-amber-50/60 p-4 text-sm text-amber-900 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <div className="font-semibold">Dashboard data is taking longer than usual.</div>
              <div className="text-xs text-amber-800/80">
                We could not load the latest summary right now. You can retry without leaving the page.
              </div>
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button size="sm" variant="secondary" onClick={() => refetchOverview()}>
              Retry overview
            </Button>
            <Button size="sm" variant="secondary" onClick={() => refetchProjects()}>
              Retry projects
            </Button>
          </div>
        </motion.div>
      ) : null}

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
        {/* Latest Prompts from most recent project */}
        <motion.div variants={item}>
          <DashboardCard
            title={latestProject ? `Prompts — ${latestProject.name}` : 'Latest Prompts'}
            icon={Search}
            headerAction={
              latestProject ? (
                <Link
                  to={`/dashboard/project/${latestProject.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  Open project <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null
            }
          >
            {!latestProject ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-400">No projects yet</p>
                <p className="mt-0.5 text-xs text-slate-400">Create a project to start tracking prompts</p>
              </div>
            ) : promptsLoading ? (
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
            ) : promptLoadError ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-500">Latest prompts could not be loaded</p>
                <p className="mt-0.5 text-xs text-slate-400">Retry to fetch the most recent project prompts.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => refetchPrompts()}
                >
                  Retry prompts
                </Button>
              </div>
            ) : latestPrompts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                  <Search className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-400">No prompts yet</p>
                <p className="mt-0.5 text-xs text-slate-400">Add prompts to start tracking AI visibility</p>
                <Link
                  to={`/dashboard/project/${latestProject.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline"
                >
                  Go to project <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                className="space-y-1"
              >
                {latestPrompts.slice(0, 6).map((prompt, idx) => (
                  <motion.div
                    key={prompt.id}
                    variants={promptItem}
                    className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50/80"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-primary/8 text-[10px] font-bold text-brand-primary">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">
                        {prompt.prompt_text}
                      </p>
                    </div>
                  </motion.div>
                ))}
                {latestPrompts.length > 6 && (
                  <Link
                    to={`/dashboard/project/${latestProject.id}`}
                    className="block px-3 pt-1 text-xs font-medium text-slate-400 hover:text-brand-primary"
                  >
                    +{latestPrompts.length - 6} more prompts
                  </Link>
                )}
              </motion.div>
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
                  <p className="text-sm font-semibold text-slate-800">Create New Project</p>
                  <p className="text-xs text-slate-400">Start monitoring a brand</p>
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
                  <p className="text-sm font-semibold text-slate-800">View Reports</p>
                  <p className="text-xs text-slate-400">Export CSV and PDF reports</p>
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
                  <p className="text-sm font-semibold text-slate-800">Settings</p>
                  <p className="text-xs text-slate-400">Configure workspace defaults</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
              </button>
            </div>
          </DashboardCard>
        </motion.div>
      </div>

      {/* Projects grid */}
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
