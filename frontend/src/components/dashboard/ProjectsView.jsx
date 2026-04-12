import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FolderKanban, Globe, Loader2, Plus, Trash2 } from 'lucide-react';

import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getDomainFromWebsiteUrl, normalizeWebsiteUrl } from '../../lib/url';
import { SectionScaffold, StatePanel } from './ui/SectionScaffold';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

const MAX_PROJECTS_PER_ACCOUNT = 3;
const PROJECTS_CACHE_KEY = 'answerdeck.projects.cache.v1';
const REGION_OPTIONS = [
  'Global',
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'Europe',
  'Middle East',
  'South East Asia',
];

const initialForm = {
  name: '',
  category: '',
  competitors: '',
  region: '',
  website_url: '',
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
    } catch {
      return [];
    }
  });

  const { data: projects = [], isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
    enabled: !authLoading && Boolean(isSignedIn),
    placeholderData: cacheLoaded.length > 0 ? cacheLoaded : undefined,
    staleTime: 30_000,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects || []));
    } catch {
      // ignore cache write failures
    }
  }, [projects]);

  const createProjectMutation = useMutation({
    mutationFn: api.createProject,
    retry: 2,
    retryDelay: (attempt) => Math.min(3000 * Math.pow(2, attempt), 10000),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateModal(false);
      setForm(initialForm);
      if (payload?.id) {
        navigate(`/dashboard/project/${payload.id}/prompts/setup`);
      }
    },
  });

  const atProjectLimit = projects.length >= MAX_PROJECTS_PER_ACCOUNT;

  const deleteProjectMutation = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleCreateProject = (event) => {
    event.preventDefault();
    const competitors = form.competitors
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    createProjectMutation.mutate({
      name: form.name,
      category: form.category,
      competitors,
      region: form.region,
      website_url: normalizeWebsiteUrl(form.website_url),
    });
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const createDisabled = createProjectMutation.isPending || !form.name.trim();
  const shouldShowInitialLoading = isLoading && projects.length === 0;
  const regionSelectValue = form.region || 'Global';

  if (shouldShowInitialLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm">Loading your projects...</p>
      </div>
    );
  }

  const isTimeout = String(error?.message || '').toLowerCase().includes('timed out');
  const hasProjects = projects.length > 0;

  const errorBanner = error && !hasProjects ? (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <div className="font-semibold">{isTimeout ? 'Server is waking up...' : 'Could not load projects.'}</div>
      <div className="text-amber-700 text-xs">{isTimeout ? 'Free-tier servers can take up to a minute on first visit. Retrying automatically...' : error.message}</div>
      <button
        type="button"
        onClick={() => refetch()}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50"
      >
        {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Retry now
      </button>
    </div>
  ) : error && hasProjects ? (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
      <span>{isTimeout ? 'Server is waking up — showing cached projects.' : 'Refresh failed — showing cached projects.'}</span>
      <button
        type="button"
        onClick={() => refetch()}
        className="ml-auto inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-50"
      >
        {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Retry
      </button>
    </div>
  ) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SectionScaffold
        title="My Projects"
        description="Monitor, analyze, and improve your brand visibility across AI answers."
        actions={(
          <>
            <Badge variant="secondary">{projects.length}/{MAX_PROJECTS_PER_ACCOUNT} projects</Badge>
            <Button onClick={() => !atProjectLimit && setShowCreateModal(true)} disabled={atProjectLimit}>
              <Plus className="h-4 w-4" />
              {atProjectLimit ? 'Project limit reached (3)' : 'Start New Project'}
            </Button>
          </>
        )}
      >
        {errorBanner}

        {projects.length === 0 ? (
          <StatePanel
            title="No projects yet"
            description="Create your first project to begin AI visibility monitoring."
            action={(
              <Button onClick={() => !atProjectLimit && setShowCreateModal(true)} disabled={atProjectLimit}>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const competitors = Array.isArray(project.competitors) ? project.competitors : [];
              return (
                <Card key={project.id} className="group rounded-xl transition-all hover:border-brand-primary/30 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg bg-slate-100 p-2 transition-colors group-hover:bg-brand-primary/10">
                        <FolderKanban className="h-4 w-4 text-slate-500 group-hover:text-brand-primary" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteProjectMutation.mutate(project.id)}
                        className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Link to={`/dashboard/project/${project.id}`} className="flex-1 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          {(() => {
                            const domain = getDomainFromWebsiteUrl(project.website_url);
                            return domain ? (
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="h-4 w-4 shrink-0 rounded-sm"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null;
                          })()}
                          <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-brand-primary">{project.name}</h3>
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

                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <Globe className="h-3 w-3 text-slate-400" />
                        <span className="truncate text-[11px] font-medium text-slate-500">{project.website_url || 'No URL'}</span>
                      </div>
                    </Link>

                    <Separator />
                    <div className="flex items-center justify-between">
                      <Link to={`/dashboard/project/${project.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary">
                        Analysis Center
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/40" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SectionScaffold>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Define your brand and competitive landscape.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            {createProjectMutation.isError ? (
              <StatePanel
                title="Could not create project"
                description={
                  String(createProjectMutation.error?.message || '').toLowerCase().includes('timed out')
                    ? 'Server is still starting up. Please wait a moment and try again.'
                    : createProjectMutation.error?.message
                }
                variant="danger"
              />
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand name *</label>
                <Input autoFocus required value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. Answrdeck" />
              </div>
              <div className="col-span-1">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Industry</label>
                <Input value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="e.g. FinTech" />
              </div>
              <div className="col-span-1">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Region</label>
                <Select value={regionSelectValue} onChange={(event) => updateField('region', event.target.value)}>
                  {REGION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Website URL</label>
                <Input value={form.website_url} onChange={(event) => updateField('website_url', event.target.value)} placeholder="example.com or https://example.com" />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Competitors</label>
                <Input value={form.competitors} onChange={(event) => updateField('competitors', event.target.value)} placeholder="Brand A, Brand B, Brand C" />
                <p className="mt-1.5 text-[10px] text-slate-400">Separate competitors with commas.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Discard</Button>
              <Button type="submit" disabled={createDisabled}>
                {createProjectMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Creating...</span></> : <span>Next: Choose prompts</span>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsView;
