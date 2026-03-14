import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  PlayCircle,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../../lib/api';

const SECTION_IDS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'sources', label: 'Sources' },
  { id: 'history', label: 'Response History' },
  { id: 'audit', label: 'Audit' },
  { id: 'execute', label: 'Execution Plan' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'invite', label: 'Invite Collaborator' },
  { id: 'test', label: 'Test Prompt' },
];

const ProjectDetailView = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptCountry, setNewPromptCountry] = useState('');
  const [newPromptTags, setNewPromptTags] = useState('');
  const [newPromptModels, setNewPromptModels] = useState([]);

  const [runningPrompts, setRunningPrompts] = useState({});
  const [selectedPromptId, setSelectedPromptId] = useState(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testModels, setTestModels] = useState([]);
  const [activeSection, setActiveSection] = useState('dashboard');

  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project-data', id],
    queryFn: async () => {
      const [project, prompts, dashboard, engines, deepAnalysis, promptAnalysis, sourcesIntel, competitorIntel] = await Promise.all([
        api.getProject(id),
        api.getPrompts(id),
        api.getProjectDashboard(id),
        api.getEngines(),
        api.getDeepAnalysis(id),
        api.getPromptAnalysis(id),
        api.getSourcesIntelligence(id),
        api.getCompetitorIntelligence(id),
      ]);

      return {
        project,
        prompts,
        dashboard,
        enabledEngines: engines.enabled_engines || [],
        availableEngines: engines.available_engines || [],
        deepAnalysis,
        promptAnalysis,
        sourcesIntel,
        competitorIntel,
      };
    },
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['prompt-report', selectedPromptId],
    queryFn: () => api.getPromptResults(selectedPromptId),
    enabled: Boolean(selectedPromptId),
  });

  const { data: promptDetailData, isLoading: promptDetailLoading } = useQuery({
    queryKey: ['prompt-detail', selectedPromptId],
    queryFn: () => api.getPromptDetail(selectedPromptId),
    enabled: Boolean(selectedPromptId),
  });

  const { data: intelSummary, isLoading: intelSummaryLoading } = useQuery({
    queryKey: ['intel-summary', id],
    queryFn: () => api.getIntelSummary(id),
    enabled: Boolean(id),
  });

  const { data: globalAudit, isLoading: globalAuditLoading } = useQuery({
    queryKey: ['global-audit', id],
    queryFn: () => api.getGlobalAudit(id),
    enabled: Boolean(id),
  });

  const [execContent, setExecContent] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedActionModel, setSelectedActionModel] = useState('deepseek');
  const [execError, setExecError] = useState(null);

  const executeActionMutation = useMutation({
    mutationFn: (data) => api.executeAction(id, data),
    onSuccess: (res) => {
      setExecContent(res);
      setIsExecuting(false);
      setExecError(null);
    },
    onError: (err) => {
      setIsExecuting(false);
      setExecError(err.message || 'Failed to generate content. Please check your API keys.');
    }
  });

  const testPromptMutation = useMutation({
    mutationFn: (payload) => api.runTestPrompt(id, payload),
  });

  const inviteMutation = useMutation({
    mutationFn: (email) => api.inviteCollaborator(id, email),
    onSuccess: () => {
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['project-data', id] });
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['project-data', id] });
  };

  const analyzePromptMutation = useMutation({
    mutationFn: async (payload) => {
      const created = await api.createPrompt(id, payload);
      const promptId = created.id;
      const run = await api.runPromptAnalysis(promptId);
      return { promptId, jobId: run.job_id };
    },
    onSuccess: ({ promptId, jobId }) => {
      setSelectedPromptId(promptId);
      setRunningPrompts((prev) => ({ ...prev, [promptId]: true }));
      setNewPromptText('');
      setNewPromptCountry('');
      setNewPromptTags('');
      setNewPromptModels([]);
      pollJobStatus(jobId, promptId);
    },
  });

  const deletePromptMutation = useMutation({
    mutationFn: api.deletePrompt,
    onSuccess: refreshAll,
  });

  const runPromptMutation = useMutation({
    mutationFn: api.runPromptAnalysis,
    onSuccess: (payload, promptId) => {
      setRunningPrompts((prev) => ({ ...prev, [promptId]: true }));
      pollJobStatus(payload.job_id, promptId);
    },
  });

  const runAllMutation = useMutation({
    mutationFn: api.runAllPromptAnalysis,
    onSuccess: (payload) => {
      payload.results.forEach((item) => {
        setRunningPrompts((prev) => ({ ...prev, [item.prompt_id]: true }));
        pollJobStatus(item.job_id, item.prompt_id);
      });
    },
  });

  const pollJobStatus = async (jobId, promptId) => {
    try {
      const data = await api.getJobStatus(jobId);
      if (data.status === 'completed' || data.status === 'failed') {
        setRunningPrompts((prev) => ({ ...prev, [promptId]: false }));
        refreshAll();
        queryClient.invalidateQueries({ queryKey: ['prompt-detail', promptId] });
        queryClient.invalidateQueries({ queryKey: ['prompt-report', promptId] });
        return;
      }
      setTimeout(() => pollJobStatus(jobId, promptId), 2500);
    } catch (_error) {
      setRunningPrompts((prev) => ({ ...prev, [promptId]: false }));
    }
  };

  const rankingByPrompt = useMemo(() => {
    const map = new Map();
    (projectData?.dashboard?.prompt_rankings || []).forEach((item) => map.set(item.prompt_id, item));
    return map;
  }, [projectData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error || !projectData) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error?.message || 'Failed to load project'}</div>;
  }

  const {
    project,
    prompts,
    dashboard,
    enabledEngines,
    availableEngines,
    deepAnalysis,
    promptAnalysis,
    sourcesIntel,
    competitorIntel,
  } = projectData;

  const handleAddPrompt = (event) => {
    event.preventDefault();
    if (!newPromptText.trim()) return;

    const tags = newPromptTags.split(',').map((item) => item.trim()).filter(Boolean);
    analyzePromptMutation.mutate({
      prompt_text: newPromptText.trim(),
      country: newPromptCountry || project.region || '',
      tags,
      selected_models: newPromptModels,
      prompt_type: 'Manual',
      is_active: true,
    });
  };

  const togglePromptModel = (modelId) => {
    setNewPromptModels((prev) => (prev.includes(modelId) ? prev.filter((item) => item !== modelId) : [...prev, modelId]));
  };

  const toggleTestModel = (modelId) => {
    setTestModels((prev) => (prev.includes(modelId) ? prev.filter((item) => item !== modelId) : [...prev, modelId]));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between mb-8 group">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="p-2.5 bg-white border border-slate-200 hover:border-brand-primary hover:text-brand-primary rounded-xl text-neutral-500 transition-all duration-300 shadow-sm hover:shadow-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
            <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{project.category || 'Uncategorized'}</span>
              {project.region && <span className="w-1 h-1 bg-slate-300 rounded-full" />}
              {project.region}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <aside className="bg-white border border-slate-200/60 rounded-2xl p-4 h-fit sticky top-4 shadow-premium">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 px-3 py-3 mb-1">Project Menu</p>
          <div className="space-y-1.5">
            {SECTION_IDS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20 scale-[1.02]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-brand-primary'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-premium-hover group hover:-translate-y-1">
          <div className="flex items-center gap-3 mb-4 text-slate-500">
            <div className="p-2 bg-brand-accent/50 rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors duration-300">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-600">Visibility</h3>
          </div>
          <div className="text-5xl font-black text-slate-900 leading-none">
            {dashboard?.current_visibility_score || 0}
            <span className="text-slate-400 text-xl font-medium tracking-tight ml-1">/100</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-premium-hover group hover:-translate-y-1">
          <div className="flex items-center gap-3 mb-4 text-slate-500">
            <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-500 group-hover:text-white transition-colors duration-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-600">Prompts</h3>
          </div>
          <div className="text-5xl font-black text-slate-900 leading-none">{prompts.length}</div>
        </div>

        <div className="glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-premium-hover md:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-700">Active AI Engines</h3>
            <button
              onClick={() => runAllMutation.mutate(id)}
              disabled={runAllMutation.isPending || prompts.length === 0}
              className="btn-premium inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary disabled:opacity-50"
            >
              {runAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5" />} 
              <span>Run All Prompts</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {enabledEngines.length === 0 && <span className="text-sm text-slate-400 font-medium">No engines configured</span>}
            {enabledEngines.map((engine) => (
              <span key={engine.id} className="text-xs font-bold rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-slate-600 shadow-sm">{engine.name}</span>
            ))}
          </div>
        </div>
      </div>

      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="glass-card rounded-2xl p-7 transition-all duration-300 hover:shadow-premium-hover">
              <h3 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-green-500 rounded-full" />
                Visibility Growth
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard?.visibility_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontWeight: 700, color: '#0f172a' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="glass-card rounded-2xl p-7 transition-all duration-300 hover:shadow-premium-hover">
              <h3 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-full" />
                Competitor Market Share
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(dashboard?.competitors || []).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="brand" type="category" tick={{ fontSize: 11, fontWeight: 600, fill: '#475569' }} width={90} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="visibility_score" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-neutral-900 mb-4">Prompt Performance Overview</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                    <th className="text-left pb-3 px-2">Prompt</th>
                    <th className="text-right pb-3 px-2">Visibility</th>
                    <th className="text-right pb-3 px-2">Avg Rank</th>
                    <th className="text-center pb-3 px-2">Sentiment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(promptAnalysis?.rows || []).slice(0, 10).map((row) => (
                    <tr key={row.prompt_id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-2 text-slate-900 font-bold truncate max-w-[300px]">{row.prompt_text}</td>
                      <td className="py-4 px-2 text-right">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${row.visibility > 70 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {row.visibility}%
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right text-slate-500 font-mono font-bold">{row.avg_rank ?? '-'}</td>
                      <td className="py-4 px-2 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          row.sentiment === 'positive' ? 'bg-blue-50 text-blue-600' : 
                          row.sentiment === 'negative' ? 'bg-red-50 text-red-600' : 
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {row.sentiment}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                onClick={() => setActiveSection('prompts')}
                className="mt-4 text-brand-primary text-xs font-bold hover:underline"
              >
                View all prompts →
              </button>
            </div>
          </section>

          {/* Project Intelligence Overview (Executive Summary) */}
          {!selectedPromptId && activeSection === 'dashboard' && intelSummary && (
            <div className="glass-card border-brand-primary/20 rounded-2xl p-8 bg-gradient-to-br from-white to-brand-accent/5 shadow-premium mt-8 border-l-4 border-l-brand-primary">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <BarChart2 className="w-6 h-6 text-brand-primary" />
                    Executive Intelligence Summary
                  </h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Cross-platform performance & strategic roadmapping</p>
                </div>
                <div className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest ${
                  intelSummary.overall_health === 'Strong' ? 'bg-green-100 text-green-600' : 
                  intelSummary.overall_health === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-brand-accent text-brand-primary'
                }`}>
                  Health: {intelSummary.overall_health}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12">
                <div className="space-y-8">
                  <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Visionary Narrative</p>
                    <p className="text-lg text-slate-800 font-bold leading-relaxed italic">&quot;{intelSummary.executive_summary}&quot;</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-brand-primary tracking-widest mb-4">Immediate Roadmap</h4>
                      <div className="space-y-3">
                        {(intelSummary.strategic_roadmap || []).map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-white/40 rounded-xl border border-white/50">
                            <div className="w-5 h-5 rounded-full bg-brand-primary text-white text-[10px] flex items-center justify-center font-black shrink-0 mt-0.5">{idx + 1}</div>
                            <div>
                              <p className="text-[9px] font-black text-brand-primary uppercase tracking-tighter">{step.phase}</p>
                              <p className="text-xs text-slate-700 font-bold">{step.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Competitive Threats</h4>
                      <div className="space-y-3">
                        {(intelSummary.competitive_threats || []).map((threat, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                            {threat}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 bg-slate-900/5 p-6 rounded-2xl border border-slate-900/5">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">High-Priority Directives</h4>
                  <div className="space-y-4">
                    {(intelSummary.top_priority_prompts || []).map((prompt, idx) => (
                      <div key={idx} className="group cursor-pointer bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-brand-primary hover:shadow-md transition-all">
                        <p className="text-xs font-black text-slate-800 mb-1 group-hover:text-brand-primary">{prompt}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Visibility Vulnerability Detected</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveSection('prompts')} className="w-full btn-premium bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 mt-4 shadow-lg shadow-slate-900/10">
                    Remediate All Prompts
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeSection === 'prompts' && (
      <section id="prompts" className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-200"><h2 className="text-lg font-bold text-neutral-900">Prompts Analysis</h2></div>

        <div className="p-8 bg-slate-50/50">
          <form onSubmit={handleAddPrompt} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Prompt Query</label>
                <input type="text" value={newPromptText} onChange={(event) => setNewPromptText(event.target.value)} placeholder="e.g. Best budget 4k tv India 2024" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Region</label>
                <input type="text" value={newPromptCountry} onChange={(event) => setNewPromptCountry(event.target.value)} placeholder="Country (optional)" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Tags</label>
                <input type="text" value={newPromptTags} onChange={(event) => setNewPromptTags(event.target.value)} placeholder="Comma separated" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all" />
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Model Selection</p>
              <div className="flex flex-wrap gap-2.5">
                {availableEngines.map((engine) => (
                  <button
                    type="button"
                    key={engine.id}
                    onClick={() => togglePromptModel(engine.id)}
                    disabled={!engine.enabled}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 ${
                      newPromptModels.includes(engine.id) 
                        ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20' 
                        : 'bg-white text-slate-600 border-slate-100 hover:border-brand-primary/30 hover:bg-slate-50'
                    } ${!engine.enabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {engine.name}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={analyzePromptMutation.isPending || !newPromptText.trim()} className="btn-premium bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-slate-900/10">
              {analyzePromptMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} 
              <span>Analyze New Prompt</span>
            </button>
          </form>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="text-left py-4 px-6">Prompt</th>
                <th className="text-left py-4 px-6">Visibility</th>
                <th className="text-left py-4 px-6">Sentiment</th>
                <th className="text-left py-4 px-6">Avg Rank</th>
                <th className="text-left py-4 px-6">Models</th>
                <th className="text-left py-4 px-6">Country</th>
                <th className="text-left py-4 px-6">Tags</th>
                <th className="text-left py-4 px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {(promptAnalysis?.rows || []).map((row, idx) => (
                <tr key={`${row.prompt_id}-${idx}`} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 max-w-[340px] truncate font-semibold text-slate-900">{row.prompt_text}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${row.visibility > 70 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                      {row.visibility}%
                    </span>
                  </td>
                  <td className="py-4 px-6 capitalize font-bold text-xs">{row.sentiment}</td>
                  <td className="py-4 px-6 font-mono font-bold text-slate-500">{row.avg_rank ?? '-'}</td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {(row.models || []).map(m => (
                        <span key={m} className="text-[10px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6">{row.country || '-'}</td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {(row.tags || []).map(t => (
                        <span key={t} className="text-[10px] font-bold bg-brand-accent/30 px-1.5 py-0.5 rounded text-brand-primary">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button onClick={() => runPromptMutation.mutate(row.prompt_id)} className="btn-premium inline-flex items-center gap-1 rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-bold text-white"><Play className="w-3 h-3" />Run</button>
                      <button onClick={() => { setSelectedPromptId(row.prompt_id); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-primary transition-colors"><FileText className="w-3 h-3" />Details</button>
                      <button onClick={() => deletePromptMutation.mutate(row.prompt_id)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(promptAnalysis?.rows || []).length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 italic">No prompt analytics yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeSection === 'competitors' && (
      <section id="competitors" className="glass-card rounded-2xl p-8">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-brand-primary shadow-sm shadow-brand-primary/40" />
          Competitors Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {((selectedPromptId && promptDetailData ? promptDetailData.competitors : competitorIntel?.rows) || []).slice(0, 20).map((item) => (
            <div key={item.brand} className={`flex flex-col p-5 rounded-2xl border transition-all duration-300 ${item.is_focus ? 'bg-brand-accent/20 border-brand-primary/30 shadow-md shadow-brand-primary/5' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-lg font-black tracking-tight ${item.is_focus ? 'text-brand-primary' : 'text-slate-900'}`}>{item.brand}</span>
                {item.is_focus && <span className="text-[10px] font-bold uppercase bg-brand-primary text-white px-2 py-0.5 rounded-full">Target Brand</span>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col px-2 py-1 bg-slate-50 rounded-lg">
                  <span className="text-[9px] font-bold uppercase text-slate-400">Share</span>
                  <span className="font-bold text-slate-700">{item.market_share}%</span>
                </div>
                <div className="flex flex-col px-2 py-1 bg-slate-50 rounded-lg">
                  <span className="text-[9px] font-bold uppercase text-slate-400">Vis</span>
                  <span className="font-bold text-slate-700">{item.visibility}</span>
                </div>
                <div className="flex flex-col px-2 py-1 bg-slate-50 rounded-lg">
                  <span className="text-[9px] font-bold uppercase text-slate-400">Rank</span>
                  <span className="font-bold text-slate-700">{item.avg_rank ?? '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeSection === 'sources' && (
      <section id="sources" className="glass-card rounded-2xl p-8">
        <h3 className="text-2xl font-extrabold text-slate-900 mb-8 border-b border-slate-100 pb-4">Sources Intelligence</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12">
          <div className="h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={((selectedPromptId && promptDetailData ? promptDetailData.sources : sourcesIntel?.domains) || []).slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="domain" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="source_mentions" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 max-h-80 overflow-auto pr-2 custom-scrollbar">
            {((selectedPromptId && promptDetailData ? promptDetailData.sources : sourcesIntel?.domains) || []).slice(0, 20).map((item) => (
              <details key={item.domain} className="group glass-card border-slate-100 rounded-xl overflow-hidden hover:border-brand-primary/30 transition-colors">
                <summary className="cursor-pointer p-4 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <span className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.source_mentions > 3 ? 'bg-green-500' : 'bg-slate-300'}`} />
                    {item.domain}
                  </span>
                  <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 text-[10px]">{item.source_mentions} Mentions</span>
                </summary>
                <ul className="p-4 bg-slate-50/50 space-y-2 border-t border-slate-100">
                  {(item.links || []).slice(0, 20).map((link) => {
                    const domain = link.replace(/^https?:\/\//, '').split('/')[0];
                    return (
                      <li key={link} className="flex items-center gap-3 group/link">
                        <div className="p-1 bg-white border border-slate-200 rounded-md shadow-sm">
                          <img 
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                            alt="" 
                            className="w-3.5 h-3.5 shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <a href={link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-primary hover:text-brand-secondary transition-colors truncate max-w-[200px] flex items-center gap-1.5 focus:underline outline-none">
                          {link} <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>
      )}

      {activeSection === 'history' && (
      <section id="history" className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">Response History</h3>
        <div className="space-y-3 text-sm">
          {(deepAnalysis?.prompt_matrix || []).slice(0, 20).map((item) => (
            <div key={item.prompt_id} className="border border-neutral-200 rounded-lg p-3">
              <p className="font-medium text-neutral-900">{item.prompt_text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(item.engines || {}).map(([engine, info]) => (
                  <span key={engine} className={`text-xs px-2 py-1 rounded-full border ${info.mentioned ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {engine}: {info.mentioned ? `mentioned (#${info.rank ?? '-'})` : 'not mentioned'}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeSection === 'audit' && (
      <section id="audit" className="glass-card rounded-2xl p-8">
        <h3 className="text-2xl font-black text-slate-900 mb-8 border-b border-slate-100 pb-4">
          {selectedPromptId ? `Audit: ${promptDetailData?.prompt_text}` : 'Strategic Project Audit'}
        </h3>
        {globalAuditLoading || promptDetailLoading ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-primary opacity-20" /></div> : (
          <div className="space-y-6">
            {selectedPromptId ? (
              <div className="space-y-4">
                <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100/30">
                  <h4 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4">Critical Gaps for this Prompt</h4>
                  {(promptDetailData?.audit?.missing || []).length > 0 ? (
                    <ul className="space-y-3">
                      {(promptDetailData.audit.missing).map((brand, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Brand not mentioned: {brand}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm font-bold text-green-600 flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4" /> Your brand is successfully retrieved for this prompt context.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              (globalAudit || []).map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100/50 hover:border-brand-primary/20 transition-all custom-shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-extrabold text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] text-slate-500">{idx+1}</span>
                      {item.title}
                    </h4>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      item.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-brand-accent text-brand-primary'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Systemic Root Cause</p>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{item.root_cause}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-black tracking-widest text-brand-primary">Global Solution</p>
                      <p className="text-sm text-slate-700 leading-relaxed font-bold">{item.solution}</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-red-50/50 rounded-xl border border-red-100/30 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-red-500 shrink-0">Strategic Avoidance:</span>
                    <p className="text-xs text-red-600 font-medium italic">{item.avoid}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
      )}

      {activeSection === 'execute' && (
        <section id="execute" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card rounded-2xl p-8 border-brand-primary/20 bg-brand-accent/5">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">AI Execution Center</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Act on high-fidelity strategic advice to displace competitors in AI retrieval paths.</p>
              </div>
              <div className="px-4 py-2 bg-white border border-brand-primary/20 rounded-xl shadow-sm">
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] block">Powered By</span>
                <select 
                  value={selectedActionModel}
                  onChange={(e) => setSelectedActionModel(e.target.value)}
                  className="text-sm font-black text-slate-700 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                >
                  {availableEngines.filter(e => e.enabled).map(engine => (
                    <option key={engine.id} value={engine.id}>{engine.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" /> Recommended Execution Paths
                </h4>
                {(dashboard?.recommendations?.missing_from_prompts || []).concat(dashboard?.recommendations?.recommendation_text ? [dashboard.recommendations.recommendation_text] : []).map((rec, i) => (
                  <div key={i} className="group glass-card bg-white p-5 rounded-2xl hover:border-brand-primary transition-all cursor-pointer shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-brand-accent group-hover:text-brand-primary transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex gap-2">
                        {['Article', 'Reddit Post', 'Blog'].map(type => (
                          <button 
                            key={type}
                            onClick={() => {
                              setIsExecuting(true);
                              setExecError(null);
                              setExecContent(null);
                              executeActionMutation.mutate({
                                directive: rec,
                                content_type: type,
                                query: rec,
                                model: selectedActionModel
                              });
                            }}
                            disabled={isExecuting}
                            className="bg-white border border-slate-100 hover:border-brand-primary hover:text-brand-primary text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                          >
                            Gen {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>

              <div className="glass-card bg-white/50 rounded-2xl border-dashed border-2 border-slate-200 p-8 flex flex-col items-center justify-center min-h-[400px]">
                {isExecuting ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-brand-primary/10 border-t-brand-primary rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-pulse text-brand-primary opacity-30" />
                      </div>
                    </div>
                    <p className="text-sm font-black text-brand-primary uppercase tracking-[0.2em] animate-pulse">Reasoning Content...</p>
                  </div>
                ) : execContent ? (
                  <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Generated Logic Piece</h5>
                      <button 
                         onClick={() => {
                           navigator.clipboard.writeText(execContent.content);
                           alert('Copied to clipboard!');
                         }}
                         className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase bg-brand-primary text-white px-4 py-2 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
                      >
                         Copy Content
                      </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex-1 shadow-inner overflow-auto max-h-[500px] custom-scrollbar">
                      <h4 className="text-xl font-black text-slate-900 mb-4 border-b pb-4">{execContent.title}</h4>
                      <div className="whitespace-pre-wrap text-sm text-slate-600 leading-loose font-medium font-mono bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                        {execContent.content}
                      </div>
                    </div>
                    <div className="mt-6 p-4 bg-brand-accent/30 border border-brand-primary/20 rounded-xl">
                      <span className="text-[10px] font-black uppercase text-brand-primary block mb-2">Publishing Strategy</span>
                      <p className="text-xs text-slate-700 font-bold leading-relaxed">{execContent.placement_advice}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-slate-400 font-bold max-w-[200px] mx-auto">Select a recommendation to generate model-optimized content.</p>
                  </div>
                )}
                
                {execError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-red-700 text-center">{execError}</p>
                    <button 
                      onClick={() => setExecError(null)}
                      className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'opportunities' && (
      <div className="space-y-8">
        <section id="opportunities" className="glass-card rounded-2xl p-8">
          <h3 className="text-2xl font-black text-slate-900 mb-8 border-b border-slate-100 pb-4">Strategic Action Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(deepAnalysis?.action_plan || []).map((item, idx) => (
              <div key={idx} className="flex gap-5 p-6 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-premium-hover group hover:border-brand-primary/20">
                <div className={`mt-1.5 h-3 w-3 rounded-full shrink-0 shadow-sm ${item.priority === 'high' ? 'bg-red-500 shadow-red-500/20' : 'bg-brand-primary shadow-brand-primary/20'}`} />
                <div>
                  <h4 className="font-extrabold text-slate-900 leading-tight mb-2 group-hover:text-brand-primary transition-colors">{item.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {deepAnalysis?.search_intel?.enabled && (
          <section className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Pinpointed Retrieval Points</h3>
            <p className="text-sm text-neutral-500 mb-4">These specific threads, videos, and articles are currently being used as primary data sources by LLMs.</p>
            <div className="space-y-3 mb-6">
              {(deepAnalysis?.search_intel?.retrieval_points || []).map((item, idx) => (
                <div key={idx} className="p-3 border border-brand-primary/10 rounded-lg bg-brand-accent/30 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-primary uppercase mb-0.5">{item.domain} • Citied for "{item.query}"</p>
                    <p className="text-sm font-semibold text-neutral-900 truncate">{item.title}</p>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0 bg-white border border-brand-primary text-brand-primary px-3 py-1 rounded-md text-xs font-bold hover:bg-brand-primary hover:text-white transition-colors flex items-center gap-1">
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
              {(deepAnalysis?.search_intel?.retrieval_points || []).length === 0 && (
                <p className="text-xs text-neutral-500 italic px-2">Run a fresh analysis to identify specific deep links.</p>
              )}
            </div>

            <h3 className="text-lg font-bold text-neutral-900 mb-2">High-Impact Retrieval Domains</h3>
            <p className="text-sm text-neutral-500 mb-4">Domains frequently used by search-enabled LLMs (Perplexity, GPT-4o) for your project's niche.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(deepAnalysis?.search_intel?.domains || []).map((item) => (
                <div key={item.domain} className="p-3 border border-neutral-100 rounded-lg bg-neutral-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800">{item.domain}</span>
                  <span className="text-xs bg-brand-accent text-brand-primary px-2 py-0.5 rounded-full font-bold">{item.count} citations</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}

      {activeSection === 'invite' && (
      <section id="invite" className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">Invite Collaborator</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!inviteEmail.trim()) return;
            inviteMutation.mutate(inviteEmail.trim());
          }}
          className="flex flex-col md:flex-row gap-3"
        >
          <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" className="flex-1 border border-neutral-200 rounded-lg px-4 py-2" />
          <button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()} className="inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg disabled:opacity-50">
            {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite
          </button>
        </form>
        <div className="mt-4 text-sm text-neutral-700">
          <p className="font-medium">Current collaborators:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            {(project.collaborators || []).map((email) => <li key={email}>{email}</li>)}
            {(project.collaborators || []).length === 0 && <li>No collaborators invited yet.</li>}
          </ul>
        </div>
      </section>
      )}

      {activeSection === 'test' && (
      <section id="test" className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">Test Prompt</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!testQuery.trim()) return;
            testPromptMutation.mutate({ query: testQuery.trim(), selected_models: testModels });
          }}
          className="space-y-3"
        >
          <textarea value={testQuery} onChange={(event) => setTestQuery(event.target.value)} rows={3} placeholder="Type an ad-hoc prompt to test models instantly" className="w-full border border-neutral-200 rounded-lg px-4 py-2" />
          <div className="flex flex-wrap gap-2">
            {availableEngines.filter((e) => e.enabled).map((engine) => (
              <button type="button" key={engine.id} onClick={() => toggleTestModel(engine.id)} className={`px-3 py-1.5 rounded-full text-xs border ${testModels.includes(engine.id) ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-neutral-700 border-neutral-300'}`}>
                {engine.name}
              </button>
            ))}
          </div>
          <button type="submit" disabled={testPromptMutation.isPending || !testQuery.trim()} className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg disabled:opacity-50">
            {testPromptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Test Prompt
          </button>
        </form>

        {testPromptMutation.data && (
          <div className="mt-6 space-y-4">
            {(testPromptMutation.data.results || []).map((result) => (
              <div key={result.engine} className="border border-neutral-200 rounded-lg p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500">{result.engine}</p>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap mt-2">{result.response_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      </div>
      </div>

      {selectedPromptId && (
        <section className="bg-white border border-neutral-200 rounded-xl p-8 shadow-premium mt-8">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Deep Intelligence Layer</h3>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">{promptDetailData?.prompt_text}</h2>
            </div>
            <button onClick={() => setSelectedPromptId(null)} className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50 text-slate-400 transition-colors">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>

          {promptDetailLoading ? (
            <div className="py-20 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-primary opacity-20" /></div>
          ) : !promptDetailData ? (
            <p className="text-sm text-neutral-500 p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">No detail found for this prompt.</p>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
                {/* Market Summary */}
                <div className="space-y-6">
                  <div className="glass-card border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 font-bold flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" /> Market Share & Positioning
                    </h5>
                    <div className="space-y-4">
                      {(promptDetailData.brand_ranking || []).slice(0, 6).map((item) => (
                        <div key={item.name} className={`flex items-center justify-between p-3 rounded-xl transition-all ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'bg-brand-accent/30 border border-brand-primary/20' : 'hover:bg-slate-50'}`}>
                          <span className={`font-bold ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'text-brand-primary' : 'text-slate-800'}`}>{item.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{item.mentions} Citations</span>
                            <span className={`font-mono font-black text-sm ${item.avg_rank === 1 ? 'text-yellow-500' : 'text-slate-500'}`}>#{item.avg_rank ?? '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 font-bold">Model Sentiment Profile</h5>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-green-50 rounded-2xl border border-green-100/50">
                        <p className="text-[9px] font-black uppercase text-green-500 mb-1">Positive</p>
                        <p className="text-xl font-black text-green-600">{promptDetailData.sentiment?.positive ?? 0}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Neutral</p>
                        <p className="text-xl font-black text-slate-700">{promptDetailData.sentiment?.neutral ?? 0}</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-2xl border border-red-100/50">
                        <p className="text-[9px] font-black uppercase text-red-500 mb-1">Negative</p>
                        <p className="text-xl font-black text-red-600">{promptDetailData.sentiment?.negative ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Layer */}
                <div className="glass-card border-brand-primary/20 rounded-2xl p-8 bg-brand-accent/5 shadow-premium overflow-hidden relative border-t-4 border-t-brand-primary">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                  <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mb-8 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Detailed Strategic Audit
                  </h5>
                  <div className="space-y-6">
                    {(promptDetailData.audit || []).map((item, idx) => (
                      <div key={idx} className="group p-5 bg-white/60 border border-white/60 rounded-2xl transition-all hover:bg-white/90 hover:shadow-premium-hover">
                        <div className="flex items-center justify-between mb-4">
                          <h6 className="font-extrabold text-slate-800 text-sm tracking-tight">{item.title}</h6>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                            item.priority === 'high' ? 'bg-red-100 text-red-500' : 'bg-brand-accent text-brand-primary'
                          }`}>
                            {item.priority}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5 opacity-60">
                              <div className="w-1 h-1 rounded-full bg-slate-300" /> Root Cause
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold italic">{item.root_cause || item.detail}</p>
                          </div>
                          <div className="pl-4 border-l border-slate-100 space-y-1">
                            <p className="text-[10px] uppercase font-black tracking-widest text-brand-primary flex items-center gap-1.5 opacity-60">
                              <div className="w-1 h-1 rounded-full bg-brand-primary shadow-sm" /> Tactical Solution
                            </p>
                            <p className="text-xs text-slate-900 leading-relaxed font-black">{item.solution}</p>
                          </div>
                        </div>
                        {item.avoid && (
                          <div className="mt-4 pt-3 border-t border-slate-50 flex items-start gap-2">
                            <Trash2 className="w-3.5 h-3.5 text-red-300 mt-0.5" />
                            <p className="text-[10px] font-black text-red-400/80 uppercase tracking-tighter italic">Avoid: {item.avoid}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actionable Research & Links */}
              <div className="glass-card border-brand-primary/20 rounded-2xl p-8 bg-brand-accent/20 shadow-premium border-l-4 border-l-brand-primary">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mb-8 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6" /> Recommended Execution Steps
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(promptDetailData.recommended_actions || []).map((item, idx) => (
                    <div key={idx} className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-white/80 shadow-sm transition-all hover:shadow-premium-hover group flex flex-col justify-between">
                      <div>
                        <h6 className="font-black text-slate-900 text-sm mb-2 group-hover:text-brand-primary transition-colors">{item.title}</h6>
                        <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed font-semibold italic">{item.detail}</p>
                      </div>
                      {item.link ? (
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn-premium inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-brand-primary bg-white px-5 py-3 rounded-xl border-2 border-brand-primary/20 hover:border-brand-primary overflow-hidden transition-all group/btn"
                        >
                          Execute Strategy <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cited Sources & Retrieval Points */}
              <div className="glass-card border-slate-100 rounded-2xl p-8 shadow-sm">
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Cited Sources & Knowledge Points
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(promptDetailData.sources || []).slice(0, 30).map((source) => (
                    <details key={source.domain} className="group glass-card border-slate-50 rounded-2xl transition-all hover:border-brand-primary/20 shadow-sm overflow-hidden h-fit">
                      <summary className="cursor-pointer text-slate-800 py-4 px-5 flex items-center justify-between hover:bg-slate-50 list-none">
                        <span className="flex items-center gap-3">
                          <img 
                            src={`https://www.google.com/s2/favicons?domain=${source.domain.split(' ')[0]}&sz=32`} 
                            alt="" 
                            className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className={`${source.domain.includes('(Target Content)') ? 'font-black text-brand-primary' : 'font-bold'} text-sm truncate max-w-[140px]`}>
                            {source.domain}
                          </span>
                        </span>
                        <span className="text-[10px] font-black border border-slate-100 px-2 py-1 rounded-lg text-slate-400 group-hover:text-brand-primary group-hover:border-brand-primary/20 transition-all uppercase tracking-tighter">{source.mentions || 0} Hits</span>
                      </summary>
                      <ul className="px-5 pb-5 pt-3 space-y-4 border-t border-slate-50 bg-slate-50/30">
                        {(source.links || []).map((linkObj, lIdx) => (
                          <li key={(linkObj.url || '') + lIdx} className="flex flex-col gap-2 group/link">
                            {linkObj.title && (
                              <span className="text-[11px] font-black text-slate-700 leading-snug group-hover/link:text-brand-primary transition-colors">{linkObj.title}</span>
                            )}
                            <div className="flex items-center gap-2 overflow-hidden bg-white p-2.5 rounded-xl border border-white shadow-sm transition-all hover:shadow-md">
                              <ExternalLink className="w-3 h-3 text-slate-300 shrink-0" />
                              <a 
                                href={linkObj.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] font-bold text-slate-400 hover:text-brand-primary truncate"
                                title={linkObj.url}
                              >
                                {linkObj.url}
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>

              {/* Raw Intelligence Logs */}
              <div className="glass-card border-slate-100 rounded-2xl p-8 bg-slate-900/5">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 border-b border-slate-900/10 pb-4">
                  Synthetic Intelligence Drifts (Raw Logs)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {(reportData?.responses || []).filter(r => r.engine !== 'perplexity_research').slice(0, 10).map((response) => (
                    <div key={response.id} className="relative group">
                      <div className="absolute -left-6 top-0 h-full w-[2px] bg-slate-200 group-hover:bg-brand-primary transition-colors" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 group-hover:text-brand-primary">{response.engine}</p>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-bold font-mono italic p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">&quot;{response.response_text}&quot;</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default ProjectDetailView;
