import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FolderKanban, Globe, Loader2, Plus, Trash2 } from 'lucide-react';

import { api } from '../../lib/api';

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
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">My Projects</h1>
          <p className="text-slate-500 mt-2 font-medium text-lg">Monitor, analyze and dominate your brand visibility in AI-driven search.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-premium flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all self-start md:self-auto"
        >
          <Plus className="w-5 h-5" />
          Start New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 mb-2">No projects yet</h3>
          <p className="text-neutral-500 mb-6 max-w-sm mx-auto">Create your first project to begin AI visibility monitoring.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-white border border-neutral-200 text-neutral-900 px-4 py-2 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => {
            const competitors = Array.isArray(project.competitors) ? project.competitors : [];
            return (
              <div key={project.id} className="group glass-card rounded-3xl p-8 hover:shadow-premium-hover transition-all duration-300 relative border-slate-100/50 hover:border-brand-primary/30 flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-brand-accent/30 transition-colors">
                    <FolderKanban className="w-6 h-6 text-slate-400 group-hover:text-brand-primary transition-colors" />
                  </div>
                  <button
                    onClick={() => deleteProjectMutation.mutate(project.id)}
                    className="opacity-0 group-hover:opacity-100 transition-all p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Link to={`/dashboard/project/${project.id}`} className="flex-1">
                  <h3 className="text-2xl font-black text-slate-900 group-hover:text-brand-primary transition-colors mb-1 truncate leading-tight">{project.name}</h3>
                  <div className="inline-block px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-black uppercase text-slate-500 mb-6">{project.category || 'Portfolio'}</div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Region</span>
                      <p className="font-bold text-slate-700 truncate">{project.region || 'Global'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competitors</span>
                      <p className="font-bold text-slate-700">{competitors.length}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-3 px-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 group-hover:border-brand-primary/10 transition-colors">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 truncate">{project.website_url || 'No URL'}</span>
                  </div>
                </Link>

                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <Link
                    to={`/dashboard/project/${project.id}`}
                    className="text-sm font-black text-brand-primary hover:text-brand-secondary transition-colors inline-flex items-center gap-2 group/btn"
                  >
                    Analysis Center
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[32px] p-10 max-w-xl w-full shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">Configure Project Intelligence</h2>
              <p className="text-slate-500 font-medium">Define your target brand and competitive landscape.</p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block ml-1">Brand Identity *</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:bg-white focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300"
                    placeholder="e.g. Ranklore"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block ml-1">Industry Vertical</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(event) => updateField('category', event.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:bg-white focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300"
                    placeholder="e.g. FinTech"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block ml-1">Target Region</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(event) => updateField('region', event.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:bg-white focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300"
                    placeholder="e.g. Global"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block ml-1">Core Website URL</label>
                  <input
                    type="url"
                    value={form.website_url}
                    onChange={(event) => updateField('website_url', event.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:bg-white focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block ml-1">Prime Competitors</label>
                  <input
                    type="text"
                    value={form.competitors}
                    onChange={(event) => updateField('competitors', event.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 font-bold focus:bg-white focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300"
                    placeholder="Brand A, Brand B, Brand C"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1">Separate competitors with commas for automated tracking.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-4 text-slate-400 text-sm font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending || !form.name.trim()}
                  className="btn-premium bg-brand-primary text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-brand-primary/20 hover:shadow-brand-primary/40 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {createProjectMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Deploy Project</span>}
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