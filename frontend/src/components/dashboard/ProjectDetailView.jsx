import React, { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Copy,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Loader2,
  Play,
  PlayCircle,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { api } from '../../lib/api';
import { mergeSourcesByDomainKey } from '../../lib/mergeSources';
import SourcesPieChart from './SourcesPieChart';
import OverviewKpiGrid from './sections/OverviewKpiGrid';
import PerformancePanel from './sections/PerformancePanel';
import PromptPerformanceTable from './sections/PromptPerformanceTable';
import CompetitorSnapshot from './sections/CompetitorSnapshot';
import { Button } from '../ui/button';

const MAX_PROMPTS_PER_PROJECT = 10;

const SECTION_IDS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { id: 'prompts', label: 'Prompts', icon: Search },
  { id: 'competitors', label: 'Competitors', icon: Users },
  { id: 'sources', label: 'Sources', icon: Globe },
  { id: 'audit', label: 'Audit', icon: Shield },
  { id: 'execute', label: 'Content Studio', icon: Zap },
  { id: 'opportunities', label: 'Opportunities', icon: Sparkles },
];

const lbl = 'text-[11px] font-semibold uppercase tracking-wider text-slate-400';

function DataBadge({ type }) {
  if (type === 'measured') return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600"><span className="h-1 w-1 rounded-full bg-emerald-500" />Measured</span>;
  return <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-600"><span className="h-1 w-1 rounded-full bg-violet-500" />AI-generated</span>;
}

function isHttpUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}

const DRAFT_TARGET_LABELS = {
  research: 'Suggested from research',
  audit: 'From audit',
  citation: 'From citations',
  path: 'From execution path',
  custom: 'Custom brief',
};

const EXEC_CONTENT_TYPES = ['Article', 'Blog', 'Reddit Post'];
const SEARCH_PROVIDER_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'serper', label: 'Google (Serper)' },
  { value: 'none', label: 'Off' },
];

function splitProseAndUrls(text) {
  if (!text) return { prose: '', urls: [] };
  const s = String(text);
  const urlRe = /https?:\/\/[^\s<>'"]+/gi;
  const urls = [];
  let m;
  while ((m = urlRe.exec(s)) !== null) {
    const raw = m[0].replace(/[),.;:]+$/g, '') || m[0];
    urls.push(raw);
  }
  const prose = s.replace(/https?:\/\/[^\s<>'"]+/gi, '').replace(/\s{2,}/g, ' ').trim();
  return { prose, urls };
}

function renderTextWithLinks(text, linkClassName) {
  if (text == null || text === '') return null;
  const s = String(text);
  const cn = linkClassName || 'font-semibold text-brand-primary underline decoration-brand-primary/50 underline-offset-2 break-all hover:decoration-brand-primary';
  const parts = [];
  let last = 0;
  let m;
  let k = 0;
  const urlRe = /https?:\/\/[^\s<>'"]+/gi;
  while ((m = urlRe.exec(s)) !== null) {
    const raw = m[0];
    const href = raw.replace(/[),.;:]+$/g, '') || raw;
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(<a key={`link-${k++}`} href={href} target="_blank" rel="noopener noreferrer" className={cn}>{href.length < raw.length ? href : raw}</a>);
    last = m.index + raw.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length > 0 ? parts : s;
}

const sectionMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3 },
};

function ActionPlanCard({ item, projectId, onGenerateDraft }) {
  const [open, setOpen] = useState(false);
  const { data: playbook, isLoading: playbookLoading, refetch } = useQuery({
    queryKey: ['action-playbook', projectId, item.title],
    queryFn: () => api.getActionPlaybook(projectId, { title: item.title, detail: item.detail }),
    enabled: false,
  });

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && !playbook && !playbookLoading) refetch();
  }, [open, playbook, playbookLoading, refetch]);

  const { prose, urls } = useMemo(() => splitProseAndUrls(item.detail), [item.detail]);

  return (
    <div className="glass-card-v2 overflow-hidden transition-shadow hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h4 className="text-[13px] font-semibold leading-snug text-slate-800">{item.title}</h4>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-brand-primary/10 text-brand-primary'}`}>
            {item.priority}
          </span>
        </div>
        {prose && <p className="mb-2 text-xs leading-relaxed text-slate-500">{prose}</p>}
        {urls.length > 0 && (
          <div className="mb-1">
            <p className={`${lbl} mb-1.5`}>Sources ({urls.length})</p>
            <ul className="space-y-1">
              {urls.map((url, i) => {
                let domain;
                try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = url; }
                return (
                  <li key={i} className="flex min-w-0 items-center gap-1.5">
                    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-3 w-3 shrink-0 rounded-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-[11px] font-medium text-brand-primary hover:underline">{domain}</a>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 text-slate-300" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <div className="flex border-t border-slate-100/80">
        {onGenerateDraft && (
          <button type="button" onClick={() => onGenerateDraft(item)} className="flex flex-1 items-center justify-center gap-1.5 border-r border-slate-100/80 px-3 py-2.5 text-[11px] font-semibold text-brand-primary transition-colors hover:bg-brand-primary/5">
            <Zap className="h-3 w-3" /> Generate Draft
          </button>
        )}
        <button type="button" onClick={handleToggle} className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors ${open ? 'bg-brand-primary/5 text-brand-primary' : 'text-slate-400 hover:text-brand-primary'}`}>
          {playbookLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</> : open ? <><ChevronDown className="h-3 w-3 rotate-180" /> Hide playbook</> : <><ChevronDown className="h-3 w-3" /> Show playbook</>}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100/80 bg-slate-50/30">
          {playbookLoading && !playbook ? (
            <div className="flex flex-col items-center gap-2.5 py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-primary/40" />
              <p className="text-xs text-slate-400">Researching this action…</p>
            </div>
          ) : playbook ? (
            <div className="space-y-4 p-5">
              {playbook.why_it_matters && (
                <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/15 p-3.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-primary"><Lightbulb className="h-3 w-3" /> Why this matters</p>
                  <p className="text-xs leading-relaxed text-slate-700">{playbook.why_it_matters}</p>
                </div>
              )}
              <div>
                <p className={`${lbl} mb-2`}>Steps</p>
                <ol className="space-y-2.5">
                  {(playbook.steps || []).map((step, si) => (
                    <li key={si} className="rounded-xl border border-slate-100 bg-white p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-semibold text-white">{si + 1}</span>
                        <div className="min-w-0">
                          <p className="mb-0.5 text-[13px] font-medium text-slate-800">{step.title}</p>
                          <p className="text-xs leading-relaxed text-slate-500">{step.detail}</p>
                          {step.example && (
                            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs italic text-slate-500">
                              <span className="mr-1 not-italic font-medium text-slate-600">Example:</span>{step.example}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              {(playbook.quick_wins || []).length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600"><Zap className="h-3 w-3" /> Quick wins</p>
                  <div className="space-y-2">{playbook.quick_wins.map((qw, qi) => (<div key={qi} className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5"><p className="mb-0.5 text-xs font-medium text-emerald-700">{qw.title}</p><p className="text-xs leading-relaxed text-emerald-600/70">{qw.detail}</p></div>))}</div>
                </div>
              )}
              {(playbook.common_mistakes || []).length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-500"><ShieldAlert className="h-3 w-3" /> Avoid</p>
                  <div className="space-y-2">{playbook.common_mistakes.map((cm, ci) => (<div key={ci} className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5"><p className="mb-0.5 text-xs font-medium text-red-600">{cm.title}</p><p className="text-xs leading-relaxed text-red-500/70">{cm.detail}</p></div>))}</div>
                </div>
              )}
              {(playbook.tools_mentioned || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-medium text-slate-400">Tools:</span>
                  {playbook.tools_mentioned.map((tool) => (<span key={tool} className="rounded-lg border border-slate-100 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">{tool}</span>))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-center">
              <p className="mb-2 text-xs text-slate-400">Failed to load playbook.</p>
              <button type="button" onClick={() => refetch()} className="text-xs font-medium text-brand-primary hover:underline">Retry</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ProjectDetailView = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptCountry, setNewPromptCountry] = useState('');
  const [newPromptTags, setNewPromptTags] = useState('');
  const [newPromptModels, setNewPromptModels] = useState([]);
  const [runningPrompts, setRunningPrompts] = useState({});
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [selectedSearchProvider, setSelectedSearchProvider] = useState('auto');
  const [lastUsedSearchProvider, setLastUsedSearchProvider] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');

  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project-data', id],
    queryFn: async () => {
      const [project, prompts, dashboard, engines] = await Promise.all([
        api.getProject(id), api.getPrompts(id), api.getProjectDashboard(id), api.getEngines(),
      ]);
      return { project, prompts, dashboard, enabledEngines: engines.enabled_engines || [], availableEngines: engines.available_engines || [], searchLayer: engines.search_layer || {} };
    },
  });

  const needsPromptAnalysis = activeSection === 'dashboard' || activeSection === 'prompts';
  const needsDeepAnalysis = activeSection === 'opportunities' || activeSection === 'execute';

  const { data: promptAnalysis, isLoading: promptAnalysisLoading } = useQuery({ queryKey: ['prompt-analysis', id], queryFn: () => api.getPromptAnalysis(id), enabled: Boolean(id) && needsPromptAnalysis, staleTime: 60_000 });
  const { data: deepAnalysis, isLoading: deepAnalysisLoading } = useQuery({ queryKey: ['deep-analysis', id], queryFn: () => api.getDeepAnalysis(id), enabled: Boolean(id) && needsDeepAnalysis, staleTime: 60_000 });
  const { data: sourcesIntel, isLoading: sourcesIntelLoading } = useQuery({ queryKey: ['sources-intelligence', id], queryFn: () => api.getSourcesIntelligence(id), enabled: Boolean(id), staleTime: 60_000 });
  const { data: competitorIntel, isLoading: competitorIntelLoading } = useQuery({ queryKey: ['competitor-intelligence', id], queryFn: () => api.getCompetitorIntelligence(id), enabled: Boolean(id), staleTime: 60_000 });
  const { data: reportData } = useQuery({ queryKey: ['prompt-report', selectedPromptId], queryFn: () => api.getPromptResults(selectedPromptId), enabled: Boolean(selectedPromptId) });
  const { data: promptDetailData, isLoading: promptDetailLoading } = useQuery({ queryKey: ['prompt-detail', selectedPromptId], queryFn: () => api.getPromptDetail(selectedPromptId), enabled: Boolean(selectedPromptId) });

  const mergedSourcesRows = useMemo(() => {
    const fromPrompt = selectedPromptId && Array.isArray(promptDetailData?.sources) && promptDetailData.sources.length > 0 ? promptDetailData.sources : null;
    const raw = (fromPrompt ?? sourcesIntel?.domains) || [];
    const normalized = raw.slice(0, 20).map((row) => {
      const linkObjs = Array.isArray(row.links) ? row.links : [];
      const normalizedLinks = linkObjs.map((l) => { if (typeof l === 'string') return { url: l.trim(), title: '' }; if (!l || typeof l !== 'object') return null; const url = String(l.url || '').trim(); if (!url || !isHttpUrl(url)) return null; return { url, title: String(l.title || '').trim() }; }).filter(Boolean);
      return { domain: row.domain, source_mentions: Number(row.source_mentions ?? row.mentions) || 0, links: normalizedLinks };
    });
    return mergeSourcesByDomainKey(normalized);
  }, [selectedPromptId, promptDetailData?.sources, sourcesIntel?.domains]);

  const competitorDisplayRows = useMemo(() => competitorIntel?.rows || [], [competitorIntel?.rows]);
  const promptAuditRows = useMemo(() => (Array.isArray(promptDetailData?.audit) ? promptDetailData.audit : []), [promptDetailData?.audit]);
  const promptAuditCoverage = useMemo(() => {
    const sentiment = promptDetailData?.sentiment || {};
    const positive = Number(sentiment.positive) || 0;
    const neutral = Number(sentiment.neutral) || 0;
    const negative = Number(sentiment.negative) || 0;
    const notMentioned = Number(sentiment.not_mentioned) || 0;
    const total = positive + neutral + negative + notMentioned;
    const mentioned = positive + neutral + negative;
    const mentionRate = total > 0 ? Math.round((mentioned / total) * 100) : 0;
    return { total, mentioned, notMentioned, mentionRate };
  }, [promptDetailData?.sentiment]);

  const { data: intelSummary, isLoading: intelSummaryLoading } = useQuery({ queryKey: ['intel-summary', id], queryFn: () => api.getIntelSummary(id), enabled: Boolean(id) && activeSection === 'dashboard' && !selectedPromptId });
  const { data: globalAudit, isLoading: globalAuditLoading } = useQuery({ queryKey: ['global-audit', id], queryFn: () => api.getGlobalAudit(id), enabled: Boolean(id) && activeSection === 'audit' && !selectedPromptId });

  const [execContent, setExecContent] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedActionModel, setSelectedActionModel] = useState('deepseek');
  const [execError, setExecError] = useState(null);
  const [execIncludeFaqSchema, setExecIncludeFaqSchema] = useState(true);
  const [execIncludeComparisonTable, setExecIncludeComparisonTable] = useState(true);
  const [execIncludePublishChecklist, setExecIncludePublishChecklist] = useState(true);
  const [execDraftTarget, setExecDraftTarget] = useState(null);
  const [customBriefText, setCustomBriefText] = useState('');
  const [customBriefType, setCustomBriefType] = useState('Article');
  const [dashChartMode, setDashChartMode] = useState('visibility');

  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const exportDashboardCSV = useCallback(() => {
    const proj = projectData?.project;
    const dash = projectData?.dashboard;
    const proms = projectData?.prompts ?? [];
    const engines = projectData?.enabledEngines ?? [];
    if (!proj) return;
    const rows = [['Section', 'Field', 'Value']];
    rows.push(['Overview', 'Project', proj.name], ['Overview', 'Category', proj.category || ''], ['Overview', 'Region', proj.region || ''], ['Overview', 'Visibility', String(dash?.current_visibility_score ?? '')], ['Overview', 'Prompts', String(proms.length)], ['Overview', 'Engines', engines.map((e) => e.name).join(', ')], ['Overview', 'Date range', `${dateFrom} – ${dateTo}`]);
    (dash?.visibility_trend || []).forEach((t) => rows.push(['Visibility Trend', t.date, String(t.score)]));
    (dash?.competitors || []).forEach((c) => rows.push(['Competitor', c.brand, String(c.visibility_score ?? '')]));
    (promptAnalysis?.rows || []).forEach((r) => rows.push(['Prompt', r.prompt_text, `vis=${r.visibility} rank=${r.avg_rank ?? '-'} sentiment=${r.sentiment}`]));
    if (intelSummary) { rows.push(['Intel', 'Health', intelSummary.overall_health || ''], ['Intel', 'Summary', intelSummary.executive_summary || '']); (intelSummary.competitive_threats || []).forEach((t) => rows.push(['Intel', 'Threat', t])); (intelSummary.top_priority_prompts || []).forEach((p) => rows.push(['Intel', 'Priority', p])); }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(proj.name || 'dashboard').replace(/\s+/g, '_')}_export_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectData, promptAnalysis, intelSummary, dateFrom, dateTo]);

  const applyExecOptionsToDirective = (directiveText) => {
    const lines = [directiveText];
    if (execIncludeFaqSchema) lines.push('Requirements: include an FAQ section and provide JSON-LD FAQ schema markup (where possible).');
    if (execIncludeComparisonTable) lines.push('Requirements: include at least one structured comparison table (targets, key specs, and decision criteria).');
    if (execIncludePublishChecklist) lines.push('Requirements: end with a publish checklist (what to add to the page, recommended anchor text, and internal linking notes).');
    return lines.join('\n');
  };

  const executeActionMutation = useMutation({ mutationFn: (data) => api.executeAction(id, data), onSuccess: (res) => { setExecContent(res); setIsExecuting(false); setExecError(null); }, onError: (err) => { setIsExecuting(false); setExecError(err.message || 'Failed to generate content.'); } });
  const setSearchLayerMutation = useMutation({ mutationFn: (provider) => api.setSearchLayer(provider), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-data', id] }) });

  const refreshAll = () => {
    ['project-data', 'prompt-analysis', 'deep-analysis', 'sources-intelligence', 'competitor-intelligence', 'intel-summary', 'global-audit'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key, id] }));
  };

  const analyzePromptMutation = useMutation({
    mutationFn: async (payload) => { const created = await api.createPrompt(id, payload); const run = await api.runPromptAnalysis(created.id, { searchProvider: selectedSearchProvider }); return { promptId: created.id, jobId: run.job_id }; },
    onSuccess: ({ promptId }) => { setSelectedPromptId(promptId); setRunningPrompts((prev) => ({ ...prev, [promptId]: true })); setLastUsedSearchProvider(selectedSearchProvider); setNewPromptText(''); setNewPromptCountry(''); setNewPromptTags(''); setNewPromptModels([]); },
  });

  const deletePromptMutation = useMutation({ mutationFn: api.deletePrompt, onSuccess: refreshAll });
  const runPromptMutation = useMutation({
    mutationFn: (promptId) => api.runPromptAnalysis(promptId, { searchProvider: selectedSearchProvider }),
    onSuccess: (payload, promptId) => { if (!payload?.job_id) { refreshAll(); return; } setRunningPrompts((prev) => ({ ...prev, [promptId]: true })); setLastUsedSearchProvider(selectedSearchProvider); pollJobStatus(payload.job_id, promptId); },
  });
  const runAllMutation = useMutation({
    mutationFn: (projectId) => api.runAllPromptAnalysis(projectId, { searchProvider: selectedSearchProvider }),
    onSuccess: (payload) => { const jobs = Array.isArray(payload?.results) ? payload.results : []; if (jobs.length === 0) { refreshAll(); return; } setLastUsedSearchProvider(selectedSearchProvider); jobs.forEach((item) => { setRunningPrompts((prev) => ({ ...prev, [item.prompt_id]: true })); pollJobStatus(item.job_id, item.prompt_id); }); },
  });

  const pollJobStatus = async (jobId, promptId) => {
    try {
      const data = await api.getJobStatus(jobId);
      if (data.status === 'completed' || data.status === 'failed') { setRunningPrompts((prev) => ({ ...prev, [promptId]: false })); refreshAll(); queryClient.invalidateQueries({ queryKey: ['prompt-detail', promptId] }); queryClient.invalidateQueries({ queryKey: ['prompt-report', promptId] }); return; }
      setTimeout(() => pollJobStatus(jobId, promptId), 2500);
    } catch { setRunningPrompts((prev) => ({ ...prev, [promptId]: false })); }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error || !projectData) {
    return <div className="glass-card-v2 border-red-200/60 bg-red-50/60 p-5 text-sm text-red-600">{error?.message || 'Failed to load project'}</div>;
  }

  const { project, prompts, dashboard, enabledEngines, availableEngines, searchLayer = {} } = projectData;
  const atPromptLimit = (prompts?.length ?? 0) >= MAX_PROMPTS_PER_PROJECT;

  const runExecuteFromTarget = (target) => {
    if (!target?.source) return;
    let directive;
    let query = target.query;
    const contentType = target.contentType || 'Article';
    switch (target.source) {
      case 'research': directive = applyExecOptionsToDirective(`Use ${target.domain || 'the top cited source'} as an evidence-backed citation target. Write an AI-retrieval-first answer page for this intent: "${target.query}". Include: clear section headings, concise factual claims aligned to the citation framing, and a strong next-step recommendation for brand ${project.name}.`); break;
      case 'audit': directive = applyExecOptionsToDirective(`Turn this audit fix into an AI-retrieval-first content draft for brand ${project.name}. Root cause: ${target.auditRootCause}. Solution: ${target.auditSolution}. Include structured headings, explicit intent coverage, and a clear next-step recommendation.`); break;
      case 'citation': directive = applyExecOptionsToDirective(`Write an AI-retrieval-first fix for brand ${project.name}. Use ${target.domain || 'the top citation domain'} as a citation target. Anchor the content to the intent "${target.query}". Include: clear headings, explicit answers, and next-step positioning guidance.`); break;
      case 'path': directive = applyExecOptionsToDirective(`Write an AI-retrieval-first solution for brand ${project.name}. ${target.pathRec} Focus on: exact intent coverage, structured headings, and clear next steps that increase likelihood of appearing in AI recommendations.`); query = target.pathRec; break;
      case 'custom': directive = applyExecOptionsToDirective(`Write an AI-retrieval-first ${contentType} for brand ${project.name} based on this brief from the user:\n\n${target.customBrief}\n\nFollow the brief closely; use clear headings and entity-rich language suited for AI retrieval.`); query = target.headline || target.customBrief.slice(0, 200); break;
      default: return;
    }
    setIsExecuting(true); setExecError(null); setExecContent(null);
    executeActionMutation.mutate({ directive, content_type: contentType, query, model: selectedActionModel });
  };

  const topRetrievalPoint = deepAnalysis?.search_intel?.retrieval_points?.[0];
  const effectiveDraftTarget = execDraftTarget || (topRetrievalPoint ? { source: 'research', headline: topRetrievalPoint.title, query: topRetrievalPoint.query, contentType: 'Article', domain: topRetrievalPoint.domain } : null);

  const handleAddPrompt = (event) => {
    event.preventDefault();
    if (!newPromptText.trim() || atPromptLimit) return;
    const tags = newPromptTags.split(',').map((i) => i.trim()).filter(Boolean);
    analyzePromptMutation.mutate({ prompt_text: newPromptText.trim(), country: newPromptCountry || project.region || '', tags, selected_models: newPromptModels, prompt_type: 'Manual', is_active: true });
  };

  const togglePromptModel = (modelId) => setNewPromptModels((prev) => prev.includes(modelId) ? prev.filter((i) => i !== modelId) : [...prev, modelId]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/dashboard/projects" className="shrink-0 rounded-xl border border-slate-200/60 bg-white/60 p-2 text-slate-400 backdrop-blur-sm transition-colors hover:border-brand-primary hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{project.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">{project.category || 'Uncategorized'}</span>
              {project.region && <><span className="text-slate-300">/</span><span className="truncate">{project.region}</span></>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-center">
          <div className="relative">
            <button onClick={() => setShowDatePicker((p) => !p)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 text-[12px] font-medium text-slate-600 backdrop-blur-sm transition-colors hover:border-brand-primary hover:text-brand-primary">
              <Download className="h-3.5 w-3.5" /> Export
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>
            {showDatePicker && (
              <div className="glass-card-v2 absolute right-0 top-full z-30 mt-1.5 w-[280px] p-4 shadow-xl">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Export date range</p>
                <div className="mb-3 flex items-center gap-2">
                  <label className="flex-1 text-[11px] font-medium text-slate-500">From<input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-brand-primary" /></label>
                  <span className="mt-4 text-slate-300">–</span>
                  <label className="flex-1 text-[11px] font-medium text-slate-500">To<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-brand-primary" /></label>
                </div>
                <Button onClick={() => { exportDashboardCSV(); setShowDatePicker(false); }} className="w-full"><Download className="h-3.5 w-3.5" /> Download CSV</Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Section sidebar */}
        <motion.aside initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="glass-card-v2 h-fit space-y-0.5 p-2.5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto max-lg:max-h-[min(50vh,22rem)] max-lg:overflow-y-auto">
          <p className={`${lbl} px-3 pb-1.5 pt-2`}>Sections</p>
          {SECTION_IDS.map((section) => {
            const SIcon = section.icon;
            const active = activeSection === section.id;
            return (
              <button key={section.id} onClick={() => setActiveSection(section.id)} className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all ${active ? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/20' : 'text-slate-500 hover:bg-slate-50/80 hover:text-slate-800'}`}>
                {active && <motion.div layoutId="section-indicator" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white/60" transition={{ type: 'spring', stiffness: 350, damping: 30 }} />}
                <SIcon className={`h-4 w-4 shrink-0 ${active ? 'text-white/80' : 'text-slate-400'}`} />
                {section.label}
              </button>
            );
          })}
        </motion.aside>

        {/* Content */}
        <div className="min-w-0 space-y-5">
          <AnimatePresence mode="wait">
            {/* ===== DASHBOARD TAB ===== */}
            {activeSection === 'dashboard' && (
              <motion.div key="dashboard" {...sectionMotion} className="space-y-5">
                <OverviewKpiGrid dashboard={dashboard} prompts={prompts} enabledEngines={enabledEngines} runAllMutation={runAllMutation} projectId={id} />
                <PerformancePanel mode={dashChartMode} onModeChange={setDashChartMode} dashboard={dashboard} promptAnalysisRows={promptAnalysis?.rows || []} />
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
                  <PromptPerformanceTable loading={promptAnalysisLoading} rows={promptAnalysis?.rows || []} onViewAll={() => setActiveSection('prompts')} />
                  <CompetitorSnapshot competitors={dashboard?.competitors || []} onViewAll={() => setActiveSection('competitors')} />
                </div>

                {!selectedPromptId && (
                  intelSummaryLoading ? (
                    <div className="glass-card-v2 animate-pulse p-6">
                      <div className="mb-6 space-y-3"><div className="h-5 w-64 rounded bg-slate-100" /><div className="h-3 w-44 rounded bg-slate-100" /></div>
                      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]"><div className="space-y-4"><div className="h-20 rounded-xl bg-slate-50 border border-slate-100" /><div className="h-28 rounded-xl bg-slate-50 border border-slate-100" /></div><div className="h-52 rounded-xl bg-slate-50 border border-slate-100" /></div>
                    </div>
                  ) : intelSummary && (
                    <div className="glass-card-v2 overflow-hidden">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100/80 px-6 py-4">
                        <div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-800">Executive Intelligence Summary</h2><DataBadge type="ai" /></div><p className="mt-0.5 text-[11px] text-slate-400">Evidence-backed roadmap to improve AI visibility</p></div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${intelSummary.overall_health === 'Strong' ? 'bg-emerald-50 text-emerald-600' : intelSummary.overall_health === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-brand-primary/10 text-brand-primary'}`}>{intelSummary.overall_health}</span>
                      </div>
                      <div className="grid grid-cols-1 divide-y divide-slate-100/80 lg:grid-cols-[1.4fr_1fr] lg:divide-x lg:divide-y-0">
                        <div className="space-y-5 p-6">
                          <div className="glass-inset rounded-xl p-4"><p className={`${lbl} mb-2`}>Summary</p><p className="text-sm leading-relaxed text-slate-700">{intelSummary.executive_summary}</p></div>
                          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div><p className={`${lbl} mb-2.5`}>Roadmap</p><div className="space-y-2">{(intelSummary.strategic_roadmap || []).map((step, idx) => (<div key={idx} className="flex items-start gap-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-semibold text-white">{idx + 1}</span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-brand-primary">{step.phase}</p><p className="text-xs leading-relaxed text-slate-600">{step.action}</p></div></div>))}</div></div>
                            <div><p className={`${lbl} mb-2.5`}>Competitive Threats</p><div className="space-y-2">{(intelSummary.competitive_threats || []).map((threat, idx) => (<div key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" /> {threat}</div>))}</div></div>
                          </div>
                        </div>
                        <div className="space-y-4 p-6">
                          <p className={lbl}>Priority Directives</p>
                          <div className="space-y-2.5">{(intelSummary.top_priority_prompts || []).map((prompt, idx) => (<div key={idx} className="group cursor-pointer rounded-xl border border-slate-100 p-3.5 transition-colors hover:border-brand-primary/40"><p className="text-[13px] font-medium text-slate-800 group-hover:text-brand-primary">{prompt}</p><p className="mt-0.5 text-[11px] text-slate-400">{intelSummary.overall_health === 'Strong' ? 'Defend winning intents' : intelSummary.overall_health === 'Critical' ? 'Remediate low-visibility' : 'Improve intent coverage'}</p></div>))}</div>
                          <Button onClick={() => setActiveSection('execute')} className="w-full">{intelSummary.overall_health === 'Strong' ? 'Generate defense drafts' : intelSummary.overall_health === 'Critical' ? 'Generate remediation drafts' : 'Generate stabilization drafts'}</Button>
                          <Button variant="secondary" onClick={() => setActiveSection('prompts')} className="w-full">Re-run prompt diagnostics</Button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            )}

            {/* ===== PROMPTS TAB ===== */}
            {activeSection === 'prompts' && (
              <motion.div key="prompts" {...sectionMotion}>
                <div className="glass-card-v2 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><Search className="h-4 w-4" /></div>
                      <div><h2 className="text-sm font-semibold text-slate-800">Prompts Analysis</h2><p className="text-[11px] text-slate-400">Manage and track AI prompt performance</p></div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600">{(prompts?.length ?? 0)}/{MAX_PROMPTS_PER_PROJECT}</span>
                  </div>
                  <div className="bg-slate-50/40 p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-white/80 px-3.5 py-2.5 backdrop-blur-sm">
                      <span className={`${lbl} mb-0`}>Search layer</span>
                      <select value={selectedSearchProvider} onChange={(e) => { setSelectedSearchProvider(e.target.value); setSearchLayerMutation.mutate(e.target.value); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-primary focus:outline-none">
                        {SEARCH_PROVIDER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <span className="text-[11px] text-slate-500">Active: <span className="font-semibold text-slate-700">{searchLayer.provider || 'none'}</span></span>
                      {lastUsedSearchProvider && <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">Last: {lastUsedSearchProvider}</span>}
                    </div>
                    {analyzePromptMutation.isError && <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{analyzePromptMutation.error?.message}</div>}
                    <form onSubmit={handleAddPrompt} className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {[{ label: 'Prompt Query', val: newPromptText, set: setNewPromptText, ph: 'e.g. Best budget 4k tv India 2024' }, { label: 'Region', val: newPromptCountry, set: setNewPromptCountry, ph: 'Country (optional)' }, { label: 'Tags', val: newPromptTags, set: setNewPromptTags, ph: 'Comma separated' }].map((f) => (
                          <div key={f.label}><label className={`${lbl} mb-1 block`}>{f.label}</label><input type="text" value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/20" /></div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-slate-200/60 bg-white/80 p-3.5 backdrop-blur-sm">
                        <p className={`${lbl} mb-2`}>Model Selection</p>
                        <div className="flex flex-wrap gap-2">{availableEngines.map((engine) => (<button type="button" key={engine.id} onClick={() => togglePromptModel(engine.id)} disabled={!engine.enabled} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${newPromptModels.includes(engine.id) ? 'border-brand-primary bg-brand-primary text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'} ${!engine.enabled ? 'cursor-not-allowed opacity-30' : ''}`}>{engine.name}</button>))}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={analyzePromptMutation.isPending || !newPromptText.trim() || atPromptLimit}>{analyzePromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{atPromptLimit ? `Limit reached (${MAX_PROMPTS_PER_PROJECT})` : 'Analyze Prompt'}</Button>
                        {Object.values(runningPrompts).some(Boolean) && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysis in progress</span>}
                      </div>
                    </form>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead><tr className="border-b border-slate-100/80 text-slate-400">{['Prompt', 'Visibility', 'Quality', 'Sentiment', 'Avg Rank', 'Models', 'Country', 'Tags', 'Actions'].map((h) => <th key={h} className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {promptAnalysisLoading ? Array.from({ length: 6 }).map((_, idx) => (<tr key={`sk-${idx}`}><td className="px-5 py-3"><div className="h-3 w-52 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-5 w-14 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-12 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-12 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-10 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-28 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-10 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-20 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-6 w-32 animate-pulse rounded bg-slate-100" /></td></tr>))
                          : (promptAnalysis?.rows || []).map((row, idx) => (
                            <tr key={`${row.prompt_id}-${idx}`} className="transition-colors hover:bg-slate-50/50">
                              <td className="max-w-[300px] truncate px-5 py-3 font-medium text-slate-800">{row.prompt_text}</td>
                              <td className="px-5 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${(row.visibility_pct ?? row.visibility) > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{row.visibility_pct ?? row.visibility}%</span></td>
                              <td className="px-5 py-3 font-medium tabular-nums text-slate-500">{row.quality_score ?? '-'}</td>
                              <td className="px-5 py-3 text-xs font-medium capitalize text-slate-500">{row.sentiment}</td>
                              <td className="px-5 py-3 font-medium tabular-nums text-slate-500">{row.avg_rank ?? '-'}</td>
                              <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{(row.models || []).map((m) => <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">{m}</span>)}</div></td>
                              <td className="px-5 py-3 text-xs text-slate-500">{row.country || '-'}</td>
                              <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{(row.tags || []).map((t) => <span key={t} className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">{t}</span>)}</div></td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Button size="sm" onClick={() => runPromptMutation.mutate(row.prompt_id)} disabled={runningPrompts[row.prompt_id]}>{runningPrompts[row.prompt_id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}{runningPrompts[row.prompt_id] ? 'Running' : 'Run'}</Button>
                                  <Button size="sm" variant="secondary" onClick={() => setSelectedPromptId(row.prompt_id)}><FileText className="h-3 w-3" />Details</Button>
                                  <Button size="sm" variant="ghost" onClick={() => deletePromptMutation.mutate(row.prompt_id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {!promptAnalysisLoading && (promptAnalysis?.rows || []).length === 0 && <tr><td colSpan={9} className="py-10 text-center text-sm text-slate-400">No prompt analytics yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== COMPETITORS TAB ===== */}
            {activeSection === 'competitors' && (
              <motion.div key="competitors" {...sectionMotion}>
                <div className="glass-card-v2 overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b border-slate-100/80 px-6 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Users className="h-4 w-4" /></div>
                    <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">Competitor Analysis</p><DataBadge type="measured" /></div><p className="text-[11px] text-slate-400">Brand visibility comparison across AI engines</p></div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                    {competitorIntelLoading && competitorDisplayRows.length === 0
                      ? Array.from({ length: 6 }).map((_, idx) => (<div key={idx} className="glass-card-v2 animate-pulse p-5"><div className="mb-4 h-4 w-28 rounded bg-slate-100" /><div className="space-y-3">{Array.from({ length: 4 }).map((__, j) => <div key={j} className="flex items-center justify-between"><div className="h-3 w-16 rounded bg-slate-100" /><div className="h-3 w-10 rounded bg-slate-100" /></div>)}</div></div>))
                      : competitorDisplayRows.slice(0, 20).map((item, idx) => {
                        const vis = item.visibility_pct ?? item.visibility ?? 0;
                        const visColor = vis > 60 ? 'bg-emerald-500' : vis > 30 ? 'bg-brand-primary' : 'bg-amber-400';
                        return (
                          <motion.div key={item.brand} whileHover={{ y: -3, transition: { duration: 0.2 } }} className={`glass-card-v2 overflow-hidden transition-shadow hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)] ${item.is_focus ? 'ring-1 ring-brand-primary/25' : item.is_target_competitor ? 'ring-1 ring-amber-300/40' : ''}`}>
                            {item.is_focus && <div className="h-0.5 bg-gradient-to-r from-brand-primary to-blue-400" />}
                            {item.is_target_competitor && !item.is_focus && <div className="h-0.5 bg-gradient-to-r from-amber-400 to-amber-300" />}
                            <div className="p-5">
                              <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${idx < 3 ? 'bg-amber-400/15 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {idx < 3 ? <Crown className="h-3.5 w-3.5" /> : idx + 1}
                                  </span>
                                  <span className={`text-sm font-bold ${item.is_focus ? 'text-brand-primary' : 'text-slate-800'}`}>{item.brand}</span>
                                </div>
                                {item.is_focus && <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-primary">You</span>}
                                {item.is_target_competitor && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600">Target</span>}
                              </div>

                              <div className="mb-4">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Visibility</span>
                                  <span className="text-sm font-bold tabular-nums text-slate-800">{vis}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, vis)}%` }} transition={{ duration: 0.8, delay: idx * 0.05 }} className={`h-full rounded-full ${visColor}`} />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 border-t border-slate-100/80 pt-3">
                                {[{ l: 'AI Share', v: `${item.ai_share}%` }, { l: 'Quality', v: item.quality_score != null ? `${item.quality_score}%` : '-' }, { l: 'Avg Rank', v: item.avg_rank != null ? `#${item.avg_rank}` : '-' }].map((s) => (
                                  <div key={s.l} className="text-center">
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{s.l}</p>
                                    <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-700">{s.v}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== SOURCES TAB ===== */}
            {activeSection === 'sources' && (
              <motion.div key="sources" {...sectionMotion}>
                <div className="glass-card-v2 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600"><Globe className="h-4 w-4" /></div>
                      <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">Research Sources</p><DataBadge type="measured" /></div><p className="text-[11px] text-slate-400">Citations pulled by LLMs for your queries</p></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className={lbl}>Evidence-backed targets</p>
                      <button onClick={() => { const top = mergedSourcesRows[0]; if (!top) return; const domainLabel = top.label || top.domain; const intent = intelSummary?.top_priority_prompts?.[0] || project.name; const t = { source: 'citation', headline: `${domainLabel} · ${intent}`, query: intent, contentType: 'Article', domain: domainLabel }; setExecDraftTarget(t); setActiveSection('execute'); }} disabled={mergedSourcesRows.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-50">Draft from Top Citation</button>
                    </div>
                    {(sourcesIntelLoading || (Boolean(selectedPromptId) && promptDetailLoading)) && mergedSourcesRows.length === 0 ? (
                      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
                        <div className="glass-inset h-80 animate-pulse rounded-2xl p-4"><div className="mb-4 h-5 w-[55%] rounded bg-slate-100" /><div className="h-[230px] rounded-2xl border border-slate-200 bg-slate-50" /></div>
                        <div className="dashboard-panel-scroll max-h-80 space-y-2 overflow-y-auto pr-1">{Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="glass-inset animate-pulse rounded-xl p-3.5"><div className="mb-2 h-4 w-[70%] rounded bg-slate-100" /><div className="h-3 w-[85%] rounded bg-slate-100" /></div>)}</div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
                        <div className="glass-inset relative min-h-[280px] min-w-0 rounded-2xl px-4 py-5 sm:px-6"><SourcesPieChart data={mergedSourcesRows} maxItems={10} /></div>
                        <div className="dashboard-panel-scroll min-w-0 max-h-96 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                          {mergedSourcesRows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">No citation sources in this view yet.</p>}
                          {mergedSourcesRows.map((item) => {
                            const displayName = item.label || item.domain;
                            const aliases = item.mergedDomains || [displayName];
                            const links = item.links || [];
                            const shownLinks = links.slice(0, 50);
                            const listKey = aliases.slice().sort().join('|') || displayName;
                            return (
                              <details key={listKey} className="glass-card-v2 min-w-0 w-full overflow-hidden transition-colors hover:border-slate-300 open:shadow-sm">
                                <summary className="flex min-h-[2.75rem] cursor-pointer list-none items-center gap-2.5 overflow-hidden px-3.5 py-3 marker:content-none hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.source_mentions > 3 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold leading-tight text-slate-800">{displayName}</span>{aliases.length > 1 && <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{aliases.length} labels merged</span>}</span>
                                  <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-600">{item.source_mentions} Mentions</span>
                                </summary>
                                <div className="border-t border-slate-100/80 bg-slate-50/50">
                                  {aliases.length > 1 && <div className="px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Grouped domains</p><ul className="mt-1.5 space-y-1 text-xs text-slate-600">{aliases.map((d) => <li key={d} className="font-medium">{d}</li>)}</ul></div>}
                                  {links.length === 0 ? <p className="px-4 py-3 text-xs text-slate-500">No URLs recorded.</p> : (
                                    <ul className="space-y-2 p-4">{shownLinks.map((link) => { const url = typeof link === 'string' ? link : String(link?.url || ''); if (!url || !isHttpUrl(url)) return null; const title = typeof link === 'string' ? '' : String(link?.title || ''); const domain = url.replace(/^https?:\/\//, '').split('/')[0]; return (<li key={url} className="group/link flex items-center gap-3"><div className="rounded-lg border border-slate-200/60 bg-white p-1"><img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-3.5 w-3.5 shrink-0" onError={(e) => { e.target.style.display = 'none'; }} /></div><a href={url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline" title={url}><span className="truncate">{title || url}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" /></a></li>); })}{links.length > 50 && <li className="pt-1 text-[11px] text-slate-400">Showing 50 of {links.length} URLs.</li>}</ul>
                                  )}
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== AUDIT TAB ===== */}
            {activeSection === 'audit' && (
              <motion.div key="audit" {...sectionMotion}>
                <div className="glass-card-v2 overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b border-slate-100/80 px-6 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600"><Shield className="h-4 w-4" /></div>
                    <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">{selectedPromptId ? `Audit: ${promptDetailData?.prompt_text}` : 'Action Audit'}</p><DataBadge type="ai" /></div><p className="text-[11px] text-slate-400">Visibility gaps and recommended fixes</p></div>
                  </div>
                  {globalAuditLoading || promptDetailLoading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div> : (
                    <div className="space-y-4 p-5">
                      {selectedPromptId ? (
                        <>
                          <div className={`rounded-xl border p-4 ${promptAuditCoverage.notMentioned > 0 ? 'border-amber-200/60 bg-amber-50/60' : 'border-emerald-200/60 bg-emerald-50/60'}`}>
                            <p className={`mb-1.5 text-[11px] font-semibold tracking-wide ${promptAuditCoverage.notMentioned > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>Prompt coverage</p>
                            <p className={`flex items-center gap-2 text-sm ${promptAuditCoverage.notMentioned > 0 ? 'text-amber-700' : 'text-emerald-700'}`}><CheckCircle2 className="h-4 w-4" />Brand mentioned in {promptAuditCoverage.mentioned}/{promptAuditCoverage.total || '-'} engines ({promptAuditCoverage.mentionRate}%).</p>
                            {promptAuditCoverage.notMentioned > 0 && <p className="mt-1 text-xs text-amber-700/90">Missing in {promptAuditCoverage.notMentioned} engine{promptAuditCoverage.notMentioned > 1 ? 's' : ''}.</p>}
                          </div>
                          {promptAuditRows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No detailed audit points yet. Run this prompt again.</div> : promptAuditRows.map((item, idx) => {
                            const priority = String(item?.priority || 'medium').toLowerCase();
                            return (
                              <div key={idx} className="glass-card-v2 p-5 transition-colors hover:shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-500">{idx + 1}</span><h4 className="text-sm font-semibold text-slate-800">{item?.title || 'Audit finding'}</h4></div>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority === 'high' ? 'bg-red-50 text-red-500' : priority === 'low' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-primary/10 text-brand-primary'}`}>{priority}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  <div><p className={`${lbl} mb-1`}>Root cause</p><p className="text-xs leading-relaxed text-slate-600">{item?.root_cause || item?.detail || 'No root cause provided.'}</p></div>
                                  <div><p className={`${lbl} mb-1 text-brand-primary`}>Solution</p><p className="text-xs font-medium leading-relaxed text-slate-700">{item?.solution || 'No solution provided.'}</p></div>
                                </div>
                                {item?.avoid && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2"><span className="mt-px shrink-0 text-[10px] font-semibold text-red-500">Avoid:</span><p className="text-xs leading-relaxed text-red-500/80">{item.avoid}</p></div>}
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        (globalAudit || []).length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No project-level audit available yet. Run prompt analyses first.</div> : (globalAudit || []).map((item, idx) => (
                          <div key={idx} className="glass-card-v2 p-5 transition-colors hover:shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-500">{idx + 1}</span><h4 className="text-sm font-semibold text-slate-800">{item.title}</h4></div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-brand-primary/10 text-brand-primary'}`}>{item.priority}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div><p className={`${lbl} mb-1`}>Root Cause</p><p className="text-xs leading-relaxed text-slate-600">{item.root_cause}</p></div><div><p className={`${lbl} mb-1 text-brand-primary`}>Solution</p><p className="text-xs font-medium leading-relaxed text-slate-700">{item.solution}</p></div></div>
                            {item.avoid && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2"><span className="mt-px shrink-0 text-[10px] font-semibold text-red-500">Avoid:</span><p className="text-xs leading-relaxed text-red-500/80">{item.avoid}</p></div>}
                            <Button onClick={() => { const t = { source: 'audit', headline: item.title, query: item.title, contentType: 'Article', auditRootCause: item.root_cause, auditSolution: item.solution }; setExecDraftTarget(t); setActiveSection('execute'); }} className="mt-3 w-full">Generate Fix Draft</Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== CONTENT STUDIO TAB ===== */}
            {activeSection === 'execute' && (
              <motion.div key="execute" {...sectionMotion} className="space-y-5">
                <div className="glass-card-v2 overflow-hidden">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100/80 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Zap className="h-4 w-4" /></div>
                      <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">Content Studio</p><DataBadge type="ai" /></div><p className="text-[11px] text-slate-400">Generate AI-optimized content drafts</p></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_1.1fr]">
                    {/* Left: Configuration */}
                    <div className="border-b border-slate-100/80 p-6 lg:border-b-0 lg:border-r">
                      {/* Step 1: Goal */}
                      <div className="mb-5">
                        <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-bold text-white">1</span> What do you want to create?</p>
                        {effectiveDraftTarget ? (
                          <div className="glass-inset rounded-xl p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-primary">{DRAFT_TARGET_LABELS[effectiveDraftTarget.source] || effectiveDraftTarget.source}</span>
                              <button type="button" onClick={() => setExecDraftTarget(null)} className="text-[10px] font-medium text-slate-400 hover:text-red-500">Clear</button>
                            </div>
                            <p className="text-sm font-semibold text-slate-800">{effectiveDraftTarget.headline}</p>
                            {effectiveDraftTarget.query && <p className="mt-1 text-xs text-slate-500">Target: <span className="font-medium text-brand-primary">{effectiveDraftTarget.query}</span></p>}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <textarea value={customBriefText} onChange={(e) => setCustomBriefText(e.target.value)} rows={3} placeholder="Describe what you want to create... e.g. 'A comparison blog post about the best budget 4K TVs in India targeting first-time buyers'" className="w-full rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
                            <p className="text-[10px] text-slate-400">Or use "Draft from Top Citation" in Sources, "Generate Fix Draft" in Audit, or "Generate Draft" in Opportunities to pre-fill this.</p>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Configure */}
                      <div className="mb-5">
                        <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-bold text-white">2</span> Configure</p>
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Format</p>
                              <div className="flex rounded-xl border border-slate-200/60 bg-slate-50/50 p-0.5">{EXEC_CONTENT_TYPES.map((ct) => (<button key={ct} type="button" onClick={() => setCustomBriefType(ct)} className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${customBriefType === ct ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{ct}</button>))}</div>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">AI Engine</p>
                              <select value={selectedActionModel} onChange={(e) => setSelectedActionModel(e.target.value)} className="rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-brand-primary focus:outline-none">{availableEngines.filter((e) => e.enabled).map((engine) => <option key={engine.id} value={engine.id}>{engine.name}</option>)}</select>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3">{[{ checked: execIncludeFaqSchema, set: setExecIncludeFaqSchema, label: 'FAQ + Schema' }, { checked: execIncludeComparisonTable, set: setExecIncludeComparisonTable, label: 'Comparison table' }, { checked: execIncludePublishChecklist, set: setExecIncludePublishChecklist, label: 'Publish checklist' }].map((opt) => (<label key={opt.label} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:border-brand-primary/30"><input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20" />{opt.label}</label>))}</div>
                        </div>
                      </div>

                      {/* Step 3: Generate */}
                      <div>
                        <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700"><span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-bold text-white">3</span> Generate</p>
                        <Button onClick={() => {
                          if (effectiveDraftTarget) {
                            const t = effectiveDraftTarget.source === 'research' && topRetrievalPoint ? { source: 'research', headline: topRetrievalPoint.title, query: topRetrievalPoint.query, contentType: customBriefType, domain: topRetrievalPoint.domain } : { ...effectiveDraftTarget, contentType: customBriefType };
                            runExecuteFromTarget(t);
                          } else if (customBriefText.trim()) {
                            const brief = customBriefText.trim();
                            const t = { source: 'custom', headline: brief.split('\n')[0].slice(0, 140) || 'Custom brief', query: brief.slice(0, 200), contentType: customBriefType, customBrief: brief };
                            setExecDraftTarget(t);
                            runExecuteFromTarget(t);
                          }
                        }} disabled={isExecuting || (!effectiveDraftTarget && !customBriefText.trim())} className="w-full">
                          {isExecuting ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Zap className="h-4 w-4" /> Generate Content</>}
                        </Button>
                      </div>

                      {/* Suggestions */}
                      {(dashboard?.recommendations?.missing_from_prompts || []).length > 0 && !effectiveDraftTarget && (
                        <div className="mt-5 border-t border-slate-100/80 pt-5">
                          <p className={`${lbl} mb-2`}>Suggestions from your data</p>
                          <div className="space-y-2">{(dashboard?.recommendations?.missing_from_prompts || []).slice(0, 3).map((rec, i) => (
                            <button key={i} type="button" onClick={() => { const t = { source: 'path', headline: rec.length > 88 ? `${rec.slice(0, 88)}...` : rec, query: rec, pathRec: rec, contentType: customBriefType }; setExecDraftTarget(t); }} className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/60 bg-white/60 p-3 text-left transition-all hover:border-brand-primary/30">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors group-hover:bg-brand-primary/10 group-hover:text-brand-primary"><Lightbulb className="h-3.5 w-3.5" /></div>
                              <p className="min-w-0 truncate text-xs font-medium text-slate-700 group-hover:text-brand-primary">{rec}</p>
                            </button>
                          ))}</div>
                        </div>
                      )}
                    </div>

                    {/* Right: Output */}
                    <div className="flex min-h-[420px] flex-col p-6">
                      {isExecuting ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3">
                          <Loader2 className="h-10 w-10 animate-spin text-brand-primary/30" />
                          <p className="animate-pulse text-sm font-medium text-brand-primary">Generating your content...</p>
                          <p className="text-xs text-slate-400">This may take 30-60 seconds</p>
                        </div>
                      ) : execContent ? (
                        <div className="flex flex-1 flex-col">
                          <div className="mb-4 flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-800">Generated Content</p>
                            <Button size="sm" onClick={() => { navigator.clipboard.writeText(execContent.content); }}><Copy className="h-3 w-3" /> Copy</Button>
                          </div>
                          <div className="glass-inset max-h-[500px] flex-1 overflow-auto rounded-xl">
                            <div className="border-b border-slate-100/80 px-5 py-4"><h4 className="text-base font-semibold text-slate-800">{execContent.title}</h4></div>
                            <div className="whitespace-pre-wrap px-5 py-4 text-[13px] leading-relaxed text-slate-600">{execContent.content}</div>
                          </div>
                          {execContent.placement_advice && (
                            <div className="mt-4 rounded-xl border border-brand-primary/15 bg-brand-primary/5 px-4 py-3">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-primary">Publishing Strategy</p>
                              <p className="text-xs leading-relaxed text-slate-700">{execContent.placement_advice}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300"><FileText className="h-8 w-8" /></div>
                          <p className="text-sm font-medium text-slate-500">Your content will appear here</p>
                          <p className="mt-1 max-w-[260px] text-xs text-slate-400">Pick a goal or describe what you want, configure the format, and hit Generate.</p>
                        </div>
                      )}
                      {execError && (
                        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                          <p className="text-sm text-red-600">{execError}</p>
                          <button onClick={() => setExecError(null)} className="shrink-0 text-[11px] font-medium text-red-400 hover:text-red-600">Dismiss</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== OPPORTUNITIES TAB ===== */}
            {activeSection === 'opportunities' && (
              <motion.div key="opportunities" {...sectionMotion} className="space-y-5">
                {deepAnalysisLoading ? (
                  <>
                    <div className="glass-card-v2 animate-pulse overflow-hidden"><div className="border-b border-slate-100/80 px-6 py-4"><div className="h-4 w-48 rounded bg-slate-100" /></div><div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">{Array.from({ length: 4 }).map((_, idx) => <div key={idx} className="glass-inset rounded-xl p-4"><div className="mb-2 h-4 w-40 rounded bg-slate-100" /><div className="mb-1 h-3 w-56 rounded bg-slate-100" /><div className="h-3 w-44 rounded bg-slate-100" /></div>)}</div></div>
                    <div className="glass-card-v2 animate-pulse p-5"><div className="mb-4 h-4 w-52 rounded bg-slate-100" /><div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="glass-inset h-16 rounded-xl" />)}</div></div>
                  </>
                ) : (
                  <>
                    <div className="glass-card-v2 overflow-hidden">
                      <div className="flex items-center gap-2.5 border-b border-slate-100/80 px-6 py-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Sparkles className="h-4 w-4" /></div>
                        <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">Strategic Action Plan</p><DataBadge type="ai" /></div><p className="text-[11px] text-slate-400">Expand any item for a step-by-step execution playbook</p></div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">{(deepAnalysis?.action_plan || []).map((item, idx) => <ActionPlanCard key={idx} item={item} projectId={id} onGenerateDraft={(action) => { const t = { source: 'path', headline: action.title, query: action.detail?.slice(0, 200) || action.title, pathRec: action.detail || action.title, contentType: 'Article' }; setExecDraftTarget(t); setActiveSection('execute'); }} />)}</div>
                    </div>
                    {deepAnalysis?.search_intel?.enabled && (
                      <div className="glass-card-v2 p-6">
                        <h3 className="mb-2 text-lg font-bold text-slate-900">Pinpointed Retrieval Points</h3>
                        <p className="mb-4 text-sm text-slate-500">Specific threads, videos, and articles used as primary data sources by LLMs.</p>
                        <div className="mb-6 space-y-3">
                          {(deepAnalysis?.search_intel?.retrieval_points || []).map((item, idx) => (
                            <div key={idx} className="glass-inset flex items-center justify-between gap-4 rounded-xl border border-brand-primary/15 bg-brand-primary/5 p-3.5">
                              <div className="min-w-0"><p className="mb-0.5 text-xs font-bold uppercase text-brand-primary">{item.domain} &middot; Cited for &quot;{item.query}&quot;</p><p className="truncate text-sm font-semibold text-slate-900">{item.title}</p></div>
                              <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:shadow-md">View <ExternalLink className="h-3 w-3" /></a>
                            </div>
                          ))}
                          {(deepAnalysis?.search_intel?.retrieval_points || []).length === 0 && <p className="px-2 text-xs italic text-slate-500">Run a fresh analysis to identify specific deep links.</p>}
                        </div>
                        <h3 className="mb-2 text-lg font-bold text-slate-900">High-Impact Retrieval Domains</h3>
                        <p className="mb-4 text-sm text-slate-500">Domains frequently used by search-enabled LLMs for your niche.</p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{(deepAnalysis?.search_intel?.domains || []).map((item) => (<div key={item.domain} className="glass-card-v2 flex items-center justify-between p-3.5"><span className="text-sm font-medium text-slate-900">{item.domain}</span><span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-bold text-brand-primary">{item.count} citations</span></div>))}</div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== SELECTED PROMPT DETAIL PANEL ===== */}
      {selectedPromptId && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-v2 mt-8 overflow-hidden p-8">
          <div className="h-1 bg-gradient-to-r from-brand-primary via-violet-500 to-cyan-400 -mx-8 -mt-8 mb-8" />
          <div className="mb-8 flex items-center justify-between border-b border-slate-200/60 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary"><Target className="h-5 w-5" /></div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Deep Intelligence Layer</h3>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{promptDetailData?.prompt_text}</h2>
              </div>
            </div>
            <button onClick={() => setSelectedPromptId(null)} className="rounded-xl border border-slate-200/60 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"><Plus className="h-5 w-5 rotate-45" /></button>
          </div>

          {promptDetailLoading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-brand-primary opacity-20" /></div>
            : !promptDetailData ? <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500">No detail found for this prompt.</p>
            : (
              <div className="space-y-10">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
                  <div className="space-y-6">
                    <div className="glass-card-v2 p-6">
                      <h5 className={`mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500`}><BarChart2 className="h-4 w-4" /> Market Share & Positioning</h5>
                      <div className="space-y-4">{(promptDetailData.brand_ranking || []).slice(0, 6).map((item) => (<div key={item.name} className={`flex items-center justify-between rounded-xl p-3 transition-all ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'bg-brand-primary/8 border border-brand-primary/20' : 'hover:bg-slate-50'}`}><span className={`font-bold ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'text-brand-primary' : 'text-slate-900'}`}>{item.name}</span><div className="flex items-center gap-4"><span className="text-[10px] font-bold uppercase text-slate-500">{item.mentions} Citations</span><span className={`text-sm font-bold tabular-nums ${item.avg_rank === 1 ? 'text-yellow-400' : 'text-slate-500'}`}>#{item.avg_rank ?? '-'}</span></div></div>))}</div>
                    </div>
                    <div className="glass-card-v2 p-6">
                      <h5 className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400"><TrendingUp className="h-4 w-4" /> Sentiment Profile</h5>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-emerald-500/5 p-4 text-center">
                          <p className="text-3xl font-bold tabular-nums text-emerald-600">{promptDetailData.sentiment?.positive ?? 0}</p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-emerald-500">Positive</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/30 p-4 text-center">
                          <p className="text-3xl font-bold tabular-nums text-slate-700">{promptDetailData.sentiment?.neutral ?? 0}</p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Neutral</p>
                        </div>
                        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-50 to-red-500/5 p-4 text-center">
                          <p className="text-3xl font-bold tabular-nums text-red-500">{promptDetailData.sentiment?.negative ?? 0}</p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-red-400">Negative</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card-v2 relative overflow-hidden border-t-4 border-t-brand-primary bg-brand-primary/3 p-8">
                    <div className="absolute -mr-16 -mt-16 right-0 top-0 h-32 w-32 rounded-full bg-brand-primary/10 blur-3xl opacity-50" />
                    <h5 className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary"><CheckCircle2 className="h-5 w-5" /> Detailed Strategic Audit</h5>
                    <div className="space-y-6">{(promptDetailData.audit || []).map((item, idx) => (<div key={idx} className="glass-card-v2 group p-5 transition-all hover:bg-white"><div className="mb-4 flex items-center justify-between"><h6 className="text-sm font-bold tracking-tight text-slate-900">{item.title}</h6><span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${item.priority === 'high' ? 'bg-red-500/15 text-red-400' : 'bg-brand-primary/12 text-brand-primary'}`}>{item.priority}</span></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="space-y-1"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 opacity-60"><span className="h-1 w-1 rounded-full bg-slate-400" /> Root Cause</p><p className="text-xs font-semibold italic leading-relaxed text-slate-500">{renderTextWithLinks(item.root_cause || item.detail)}</p></div><div className="space-y-1 border-l border-slate-200/60 pl-4"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-primary opacity-60"><span className="h-1 w-1 rounded-full bg-brand-primary" /> Tactical Solution</p><p className="text-xs font-bold leading-relaxed text-slate-900">{renderTextWithLinks(item.solution)}</p></div></div>{item.avoid && <div className="mt-4 flex items-start gap-2 border-t border-slate-200/60 pt-3"><Trash2 className="mt-0.5 h-3.5 w-3.5 text-red-400/50" /><p className="text-[10px] font-bold italic uppercase tracking-tighter text-red-400/60">Avoid: {item.avoid}</p></div>}</div>))}</div>
                  </div>
                </div>
                <div className="glass-card-v2 border-l-4 border-l-brand-primary bg-brand-primary/3 p-8">
                  <h5 className="mb-8 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary"><PlayCircle className="h-6 w-6" /> Recommended Execution Steps</h5>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{(promptDetailData.recommended_actions || []).map((item, idx) => (<div key={idx} className="glass-card-v2 group flex flex-col justify-between p-6 transition-all hover:border-brand-primary/30"><div><h6 className="mb-2 text-sm font-bold text-slate-900 transition-colors group-hover:text-brand-primary">{item.title}</h6><p className="mb-6 text-xs font-semibold italic leading-relaxed text-slate-500">{renderTextWithLinks(item.detail)}</p></div>{item.link && <a href={item.link} target="_blank" rel="noreferrer" className="group/btn inline-flex items-center gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary/8 px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-brand-primary transition-all hover:border-brand-primary">Execute Strategy <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" /></a>}</div>))}</div>
                </div>
                <div className="glass-card-v2 p-8">
                  <h5 className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"><FileText className="h-4 w-4" /> Cited Sources & Knowledge Points</h5>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{(promptDetailData.sources || []).slice(0, 30).map((source) => (<details key={source.domain} className="glass-card-v2 group h-fit overflow-hidden transition-all hover:border-brand-primary/20"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 hover:bg-slate-50"><span className="flex items-center gap-3"><img src={`https://www.google.com/s2/favicons?domain=${source.domain.split(' ')[0]}&sz=32`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-4 w-4 opacity-40 grayscale transition-all group-hover:opacity-100 group-hover:grayscale-0" onError={(e) => { e.target.style.display = 'none'; }} /><span className={`truncate text-sm font-bold max-w-[140px] ${source.domain.includes('(Target Content)') ? 'text-brand-primary' : 'text-slate-900'}`}>{source.domain}</span></span><span className="rounded-full border border-slate-200/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 transition-all group-hover:border-brand-primary/20 group-hover:text-brand-primary">{source.mentions || 0} Hits</span></summary><ul className="space-y-4 border-t border-slate-200/60 bg-slate-50/50 px-5 pb-5 pt-3">{(source.links || []).map((linkObj, lIdx) => (<li key={(linkObj.url || '') + lIdx} className="group/link flex flex-col gap-2">{linkObj.title && <span className="text-[11px] font-bold leading-snug text-slate-700 transition-colors group-hover/link:text-brand-primary">{linkObj.title}</span>}<div className="flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200/60 bg-white p-2.5"><ExternalLink className="h-3 w-3 shrink-0 text-slate-500" /><a href={linkObj.url} target="_blank" rel="noreferrer" className="truncate text-[10px] font-bold text-slate-500 hover:text-brand-primary" title={linkObj.url}>{linkObj.url}</a></div></li>))}</ul></details>))}</div>
                </div>
                <div className="glass-card-v2 p-8">
                  <h5 className="mb-8 border-b border-slate-200/60 pb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Synthetic Intelligence Drifts (Raw Logs)</h5>
                  <div className="grid grid-cols-1 gap-12 md:grid-cols-2">{(reportData?.responses || []).filter((r) => r.engine !== 'perplexity_research').slice(0, 10).map((response) => (<div key={response.id} className="group relative"><div className="absolute -left-6 top-0 h-full w-[2px] bg-slate-200 transition-colors group-hover:bg-brand-primary" /><p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-brand-primary">{response.engine}</p><p className="glass-card-v2 whitespace-pre-wrap p-6 text-xs font-bold italic leading-relaxed text-slate-500">&quot;{response.response_text}&quot;</p></div>))}</div>
                </div>
              </div>
            )}
        </motion.section>
      )}
    </div>
  );
};

export default ProjectDetailView;
