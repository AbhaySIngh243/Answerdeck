import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  FolderKanban,
  Globe,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDomainFromWebsiteUrl, normalizeWebsiteUrl } from '../../lib/url';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { SkeletonCard } from './LoadingSkeleton';

const PROJECTS_CACHE_KEY = 'answerdeck.projects.cache.v1';
const REGION_OPTIONS = [
  'Global', 'India', 'United States', 'United Kingdom', 'Canada',
  'Australia', 'Singapore', 'Europe', 'Middle East', 'South East Asia',
];

const initialForm = {
  name: '', category: '', competitors: '', region: '', website_url: '',
};

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const ProjectsView = () => {
  const navigate = useNavigate();
  const { loading: authLoading, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [cacheLoaded] = useState(() => {
    try {
      const raw = window.localStorage.getItem(PROJECTS_CACHE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const { data: projects = [], isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    enabled: !authLoading && Boolean(isSignedIn),
    placeholderData: cacheLoaded.length > 0 ? cacheLoaded : undefined,
    staleTime: 30_000,
  });

  const { data: billing } = useQuery({
    queryKey: ['billing', 'me'],
    queryFn: api.getBillingMe,
    enabled: !authLoading && Boolean(isSignedIn),
    staleTime: 60_000,
  });

  const maxProjects = billing?.limits?.max_projects ?? 1;

  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects || []));
    } catch { /* ignore */ }
  }, [projects]);

  const createProjectMutation = useMutation({
    mutationFn: api.createProject,
    retry: 2,
    retryDelay: (attempt) => Math.min(3000 * Math.pow(2, attempt), 10000),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
      setShowCreateModal(false);
      setForm(initialForm);
      if (payload?.id) navigate(`/dashboard/project/${payload.id}/onboarding`);
    },
  });

  const atProjectLimit = projects.length >= maxProjects;

  const deleteProjectMutation = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const handleCreateProject = (event) => {
    event.preventDefault();
    const competitors = form.competitors.split(',').map((i) => i.trim()).filter(Boolean);
    createProjectMutation.mutate({
      name: form.name, category: form.category, competitors,
      region: form.region, website_url: normalizeWebsiteUrl(form.website_url),
    });
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const createDisabled = createProjectMutation.isPending || !form.name.trim();
  const shouldShowInitialLoading = isLoading && projects.length === 0;

  if (shouldShowInitialLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-end justify-between border-b border-slate-200/60 pb-5">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const isTimeout = String(error?.message || '').toLowerCase().includes('timed out');
  const hasProjects = projects.length > 0;

  const errorBanner = error && !hasProjects ? (
    <div className="glass-card-v2 space-y-2 border-amber-200/60 bg-amber-50/60 p-4 text-sm text-amber-800">
      <div className="font-semibold">{isTimeout ? 'Taking longer than usual…' : 'Could not load projects.'}</div>
      <div className="text-xs text-amber-700">{isTimeout ? 'Still trying in the background. Retrying…' : error.message}</div>
      <button type="button" onClick={() => refetch()} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50">
        {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Retry now
      </button>
    </div>
  ) : error && hasProjects ? (
    <div className="glass-card-v2 flex items-center gap-2 border-amber-200/60 bg-amber-50/60 px-4 py-2.5 text-xs font-medium text-amber-800">
      <span>{isTimeout ? 'Refresh is taking longer than usual — showing cached projects.' : 'Refresh failed — showing cached projects.'}</span>
      <button type="button" onClick={() => refetch()} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-50">
        {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Retry
      </button>
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200/60 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Projects</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor, analyze, and improve your brand visibility across AI answers.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">{projects.length}/{maxProjects} projects</Badge>
          <Button onClick={() => !atProjectLimit && setShowCreateModal(true)} disabled={atProjectLimit}>
            <Plus className="h-4 w-4" />
            {atProjectLimit ? 'Limit reached' : 'New Project'}
          </Button>
        </div>
      </div>

      {errorBanner}

      {/* Empty state */}
      {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-v2 flex flex-col items-center py-16 text-center"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">Create your first project to begin AI visibility monitoring.</p>
          <Button onClick={() => setShowCreateModal(true)} className="mt-5">
            <Plus className="h-4 w-4" />Create Project
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="visible" className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const competitors = Array.isArray(project.competitors) ? project.competitors : [];
            const domain = getDomainFromWebsiteUrl(project.website_url);
            const projectRoute = project.context_ready ? `/dashboard/project/${project.id}` : `/dashboard/project/${project.id}/onboarding`;
            return (
              <motion.div key={project.id} variants={item} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
                <div className="glass-card-v2 group flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-[0_12px_40px_rgba(15,23,42,0.1)]">
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-brand-primary/8 p-2.5 transition-colors group-hover:bg-brand-primary/12">
                        <FolderKanban className="h-5 w-5 text-brand-primary" />
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => deleteProjectMutation.mutate(project.id)}
                        className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Link to={projectRoute} className="flex-1 space-y-3">
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          {domain && (
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                              alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
                              className="h-4 w-4 shrink-0 rounded-sm"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-brand-primary transition-colors">{project.name}</h3>
                        </div>
                        <Badge variant="secondary">{project.category || 'Portfolio'}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Region</p>
                          <p className="truncate text-sm font-semibold text-slate-700">{project.region || 'Global'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Competitors</p>
                          <p className="text-sm font-semibold text-slate-700">{competitors.length}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-slate-50/80 px-3 py-2">
                        <Globe className="h-3 w-3 text-slate-400" />
                        <span className="truncate text-[11px] font-medium text-slate-500">{project.website_url || 'No URL'}</span>
                      </div>
                    </Link>

                    <div className="border-t border-slate-100/80 pt-4">
                      <div className="flex items-center justify-between">
                        <Link to={projectRoute} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary transition-colors hover:text-blue-700">
                          {project.context_ready ? 'Analysis Center' : 'Continue onboarding'}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <div className={`h-2 w-2 rounded-full ${project.context_ready ? 'bg-emerald-400 shadow-emerald-400/40' : 'bg-amber-400 shadow-amber-400/40'} shadow-sm`} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Create project modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto glass-card-v2 border-slate-200/60">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Define your brand and competitive landscape.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            {createProjectMutation.isError && (
              <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-3 text-sm text-red-600">
                {String(createProjectMutation.error?.message || '').toLowerCase().includes('timed out')
                  ? 'Server is still starting up. Please wait and try again.'
                  : createProjectMutation.error?.message}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand name *</label>
                <Input autoFocus required value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="e.g. Answrdeck" />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Industry</label>
                <Input value={form.category} onChange={(e) => updateField('category', e.target.value)} placeholder="e.g. FinTech" />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Region</label>
                <Select value={form.region || 'Global'} onChange={(e) => updateField('region', e.target.value)}>
                  {REGION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Website URL</label>
                <Input value={form.website_url} onChange={(e) => updateField('website_url', e.target.value)} placeholder="example.com" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Competitors</label>
                <Input value={form.competitors} onChange={(e) => updateField('competitors', e.target.value)} placeholder="Brand A, Brand B, Brand C" />
                <p className="mt-1.5 text-[10px] text-slate-400">Separate competitors with commas.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Discard</Button>
              <Button type="submit" disabled={createDisabled}>
                {createProjectMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Creating...</span></> : <span>Next: Onboarding</span>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsView;
