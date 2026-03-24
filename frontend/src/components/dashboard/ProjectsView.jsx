import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FolderKanban, Globe, Loader2, Plus, Trash2 } from 'lucide-react';

import { api } from '../../lib/api';

const MAX_PROJECTS_PER_ACCOUNT = 3;

const initialForm = {
  name: '',
  category: '',
  competitors: '',
  region: '',
  website_url: '',
};

const ProjectsView = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(initialForm);

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  });

  const createProjectMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateModal(false);
      setForm(initialForm);
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
      website_url: form.website_url,
    });
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    const hint = String(error?.message || '').includes('CORS')
      ? 'Check `CORS_ORIGINS` on the backend matches your frontend URL.'
      : String(error?.message || '').includes('VITE_API_BASE_URL')
        ? 'Check `VITE_API_BASE_URL` in your frontend env.'
        : String(error?.message || '').includes('timeout')
          ? 'Check backend uptime and network. Render free tier can cold-start.'
          : '';

    return (
      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-semibold">Could not load projects.</div>
        <div className="text-red-700">{error.message}</div>
        {hint ? <div className="text-xs text-red-600">{hint}</div> : null}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e2e8f0] pb-5 md:flex-row md:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">Workspace</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-[#0f172a]">My Projects</h1>
          <p className="mt-1 text-sm text-[#64748b]">Monitor, analyze, and improve your brand visibility across AI answers.</p>
          <p className="mt-0.5 text-xs text-[#94a3b8]">
            {projects.length}/{MAX_PROJECTS_PER_ACCOUNT} projects
          </p>
        </div>
        <button
          onClick={() => !atProjectLimit && setShowCreateModal(true)}
          disabled={atProjectLimit}
          className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#3b82f6] disabled:cursor-not-allowed disabled:opacity-50 md:self-auto"
        >
          <Plus className="w-4 h-4" />
          {atProjectLimit ? 'Project limit reached (3)' : 'Start New Project'}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
            <FolderKanban className="h-5 w-5 text-[#64748b]" />
          </div>
          <h3 className="mb-1.5 text-sm font-bold text-[#0f172a]">No projects yet</h3>
          <p className="mx-auto mb-4 max-w-sm text-xs text-[#64748b]">Create your first project to begin AI visibility monitoring.</p>
          <button
            onClick={() => !atProjectLimit && setShowCreateModal(true)}
            disabled={atProjectLimit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#0f172a] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const competitors = Array.isArray(project.competitors) ? project.competitors : [];
            return (
              <div
                key={project.id}
                className="group relative flex h-full flex-col rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition-all duration-200 hover:border-brand-primary/30 hover:shadow-md"
              >
                <div className="mb-3.5 flex items-start justify-between">
                  <div className="rounded-lg bg-slate-100 p-2 transition-colors group-hover:bg-brand-primary/10">
                    <FolderKanban className="h-4 w-4 text-[#64748b] transition-colors group-hover:text-brand-primary" />
                  </div>
                  <button
                    onClick={() => deleteProjectMutation.mutate(project.id)}
                    className="rounded-lg p-1.5 text-[#64748b] opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <Link to={`/dashboard/project/${project.id}`} className="flex-1">
                  <h3 className="mb-0.5 truncate text-base font-bold leading-snug text-[#0f172a] transition-colors group-hover:text-brand-primary">
                    {project.name}
                  </h3>
                  <div className="mb-3.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#64748b]">
                    {project.category || 'Portfolio'}
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Region</span>
                      <p className="truncate text-sm font-semibold text-slate-700">{project.region || 'Global'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Competitors</span>
                      <p className="text-sm font-semibold text-slate-700">{competitors.length}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-slate-50 px-3 py-2 transition-colors group-hover:border-brand-primary/20">
                    <Globe className="h-3 w-3 text-[#94a3b8]" />
                    <span className="truncate text-[11px] font-medium text-[#64748b]">{project.website_url || 'No URL'}</span>
                  </div>
                </Link>

                <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-3.5">
                  <Link
                    to={`/dashboard/project/${project.id}`}
                    className="group/btn inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary transition-colors hover:text-[#1d4ed8]"
                  >
                    Analysis Center
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </Link>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-sm sm:p-6">
          <div className="my-auto w-full max-w-lg rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-7 max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] overflow-y-auto overscroll-contain">
            <div className="mb-5">
              <h2 className="mb-1 text-lg font-bold leading-snug tracking-tight text-[#0f172a]">New project</h2>
              <p className="text-sm text-[#64748b]">Define your brand and competitive landscape.</p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {createProjectMutation.isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {createProjectMutation.error?.message}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                    Brand name *
                  </label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/15"
                    placeholder="e.g. Answrdeck"
                  />
                </div>

                <div className="col-span-1">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Industry</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(event) => updateField('category', event.target.value)}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/15"
                    placeholder="e.g. FinTech"
                  />
                </div>

                <div className="col-span-1">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Region</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(event) => updateField('region', event.target.value)}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/15"
                    placeholder="e.g. Global"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Website URL</label>
                  <input
                    type="url"
                    value={form.website_url}
                    onChange={(event) => updateField('website_url', event.target.value)}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/15"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Competitors</label>
                  <input
                    type="text"
                    value={form.competitors}
                    onChange={(event) => updateField('competitors', event.target.value)}
                    className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-sm font-medium text-[#0f172a] outline-none transition-all placeholder:text-slate-400 focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/15"
                    placeholder="Brand A, Brand B, Brand C"
                  />
                  <p className="mt-1.5 text-[10px] text-[#94a3b8]">Separate competitors with commas.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-[#e2e8f0] px-4 py-2.5 text-xs font-semibold text-[#64748b] transition-colors hover:bg-slate-50 hover:text-[#0f172a]"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending || !form.name.trim()}
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#3b82f6] disabled:opacity-50"
                >
                  {createProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Deploy Project</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsView;
