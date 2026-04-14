import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [newPromptModels, setNewPromptModels] = useState([]);
  const [runningPrompts, setRunningPrompts] = useState({});
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const deepIntelRef = useRef(null);

  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project-data', id],
    queryFn: async () => {
      const [project, prompts, dashboard, engines] = await Promise.all([
        api.getProject(id), api.getPrompts(id), api.getProjectDashboard(id), api.getEngines(),
      ]);
      return { project, prompts, dashboard, enabledEngines: engines.enabled_engines || [], availableEngines: engines.available_engines || [], searchLayer: engines.search_layer || {} };
    },
  });

  const effectiveSearchProvider = useMemo(() => {
    const p = projectData?.searchLayer?.provider;
    const s = String(p ?? 'auto').trim();
    return s || 'auto';
  }, [projectData?.searchLayer?.provider]);

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
  const { data: intelSummary, isLoading: intelSummaryLoading } = useQuery({ queryKey: ['intel-summary', id], queryFn: () => api.getIntelSummary(id), enabled: Boolean(id) && activeSection === 'dashboard' && !selectedPromptId });
  const { data: globalAudit, isLoading: globalAuditLoading } = useQuery({ queryKey: ['global-audit', id], queryFn: () => api.getGlobalAudit(id), enabled: Boolean(id) && activeSection === 'dashboard' && !selectedPromptId });

  useEffect(() => {
    setActiveSection((prev) => (prev === 'audit' ? 'dashboard' : prev));
  }, []);

  const modelIdToName = useMemo(() => {
    const engines = projectData?.availableEngines || [];
    return Object.fromEntries(engines.map((e) => [e.id, e.name]));
  }, [projectData?.availableEngines]);

  const coverageSnapshot = useMemo(() => {
    if (!projectData?.dashboard || !projectData?.project) return null;
    const d = projectData.dashboard;
    const proms = projectData.prompts || [];
    const rankings = d.prompt_rankings || [];
    const total = Math.max(proms.length, rankings.length, 1);
    const withRank = rankings.filter((r) => r.avg_rank != null).length;
    const vis = d.visibility_pct_current;
    const share = vis != null && Number.isFinite(Number(vis)) ? `${Math.round(Number(vis))}%` : '—';
    const competitors = d.competitors || [];
    const focus = (projectData.project.name || '').toLowerCase().trim();
    const sorted = [...competitors].sort((a, b) => (Number(b.visibility_pct ?? b.visibility ?? 0)) - (Number(a.visibility_pct ?? a.visibility ?? 0)));
    let topPos = '—';
    const idx = sorted.findIndex((c) => String(c.brand || '').toLowerCase().trim() === focus);
    if (idx >= 0) topPos = `#${idx + 1}`;
    else if (sorted.length) topPos = 'Not ranked';
    return {
      queriesLine: `${withRank} / ${total} queries where you rank`,
      shareLine: `${share} share of AI mentions`,
      topCompetitorLine: `${topPos} your position vs competitors`,
    };
  }, [projectData]);

  const dashboardIntelLayout = useMemo(() => {
    if (!intelSummary) return null;
    const eb = intelSummary.executive_bullets;
    let happening = '';
    if (Array.isArray(eb) && eb.length) {
      happening = String(eb[0]).trim();
    } else if (intelSummary.executive_summary) {
      const s = String(intelSummary.executive_summary).trim();
      const first = s.split(/(?<=[.!?])\s+/)[0];
      happening = (first && first.length <= 280 ? first : s.slice(0, 220)).trim();
    }
    const fromRoadmap = (intelSummary.strategic_roadmap || []).map((step) => String(step.action || '').trim()).filter(Boolean);
    const fromBullets = Array.isArray(intelSummary.executive_bullets) ? intelSummary.executive_bullets.slice(1).map((b) => String(b).trim()).filter(Boolean) : [];
    const fromQueries = (intelSummary.top_priority_prompts || []).map((p) => String(p).trim()).filter(Boolean);
    const seen = new Set();
    const priorities = [];
    for (const t of [...fromRoadmap, ...fromBullets, ...fromQueries]) {
      const k = t.toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      priorities.push(t);
      if (priorities.length >= 5) break;
    }
    const losing = (intelSummary.competitive_threats || []).map((t) => String(t).trim()).filter(Boolean);
    return { happening, priorities, losing };
  }, [intelSummary]);

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

  const refreshAll = () => {
    ['project-data', 'prompt-analysis', 'deep-analysis', 'sources-intelligence', 'competitor-intelligence', 'intel-summary', 'global-audit'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key, id] }));
  };

  const analyzePromptMutation = useMutation({
    mutationFn: async (payload) => { const created = await api.createPrompt(id, payload); const run = await api.runPromptAnalysis(created.id, { searchProvider: effectiveSearchProvider }); return { promptId: created.id, jobId: run.job_id }; },
    onSuccess: ({ promptId }) => { setSelectedPromptId(promptId); setRunningPrompts((prev) => ({ ...prev, [promptId]: true })); setNewPromptText(''); setNewPromptModels([]); requestAnimationFrame(() => deepIntelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); },
  });

  const deletePromptMutation = useMutation({ mutationFn: api.deletePrompt, onSuccess: refreshAll });
  const runPromptMutation = useMutation({
    mutationFn: (promptId) => api.runPromptAnalysis(promptId, { searchProvider: effectiveSearchProvider }),
    onSuccess: (payload, promptId) => { if (!payload?.job_id) { refreshAll(); return; } setRunningPrompts((prev) => ({ ...prev, [promptId]: true })); pollJobStatus(payload.job_id, promptId); },
  });
  const runAllMutation = useMutation({
    mutationFn: (projectId) => api.runAllPromptAnalysis(projectId, { searchProvider: effectiveSearchProvider }),
    onSuccess: (payload) => { const jobs = Array.isArray(payload?.results) ? payload.results : []; if (jobs.length === 0) { refreshAll(); return; } jobs.forEach((item) => { setRunningPrompts((prev) => ({ ...prev, [item.prompt_id]: true })); pollJobStatus(item.job_id, item.prompt_id); }); },
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

  const { project, prompts, dashboard, enabledEngines, availableEngines } = projectData;
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
    analyzePromptMutation.mutate({
      prompt_text: newPromptText.trim(),
      country: project.region || '',
      tags: [],
      selected_models: newPromptModels,
      prompt_type: 'Manual',
      is_active: true,
    });
  };

  const togglePromptModel = (modelId) => setNewPromptModels((prev) => (prev.includes(modelId) ? prev.filter((i) => i !== modelId) : [...prev, modelId]));

  const openPromptDeepIntel = (promptId) => {
    setSelectedPromptId(promptId);
    requestAnimationFrame(() => deepIntelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

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
                  <>
                    {intelSummaryLoading ? (
                      <div className="glass-card-v2 animate-pulse p-6">
                        <div className="mb-6 space-y-3"><div className="h-5 w-64 rounded bg-slate-100" /><div className="h-3 w-44 rounded bg-slate-100" /></div>
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]"><div className="space-y-4"><div className="h-20 rounded-xl bg-slate-50" /><div className="h-28 rounded-xl bg-slate-50" /></div><div className="h-52 rounded-xl bg-slate-50" /></div>
                      </div>
                    ) : intelSummary && dashboardIntelLayout && (
                      <div className="glass-card-v2 overflow-hidden">
                        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold tracking-tight text-slate-900">Executive summary</h2>
                              <DataBadge type="ai" />
                            </div>
                            <p className="mt-0.5 text-sm text-slate-500">Quick snapshot of your AI visibility</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${intelSummary.overall_health === 'Strong' ? 'bg-emerald-50 text-emerald-700' : intelSummary.overall_health === 'Critical' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{intelSummary.overall_health}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.35fr_1fr] lg:gap-0">
                          <div className="space-y-6 px-6 pb-6 lg:pr-8">
                            <div>
                              <p className={`${lbl} mb-2`}>What&apos;s happening</p>
                              <p className="text-sm font-medium leading-snug text-slate-800">{dashboardIntelLayout.happening || '—'}</p>
                            </div>
                            <div>
                              <p className={`${lbl} mb-2`}>Top priorities</p>
                              <ul className="space-y-2">
                                {(dashboardIntelLayout.priorities.length ? dashboardIntelLayout.priorities : ['Run analyses on your prompts to generate priorities.']).map((line, idx) => (
                                  <li key={idx} className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{line}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className={`${lbl} mb-2`}>Where you&apos;re losing</p>
                              <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
                                {(dashboardIntelLayout.losing.length ? dashboardIntelLayout.losing : ['Insufficient data—complete prompt runs for competitive signals.']).map((line, idx) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="space-y-5 border-t border-slate-100/80 px-6 py-6 lg:border-l lg:border-t-0 lg:pt-6">
                            <div>
                              <p className={`${lbl} mb-2`}>Priority queries</p>
                              <div className="space-y-2">
                                {(intelSummary.top_priority_prompts || []).length === 0 && <p className="text-sm text-slate-500">None flagged yet.</p>}
                                {(intelSummary.top_priority_prompts || []).map((q, idx) => (
                                  <div key={idx} className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{q}</div>
                                ))}
                              </div>
                            </div>
                            {coverageSnapshot && (
                              <div>
                                <p className={`${lbl} mb-2`}>Coverage snapshot</p>
                                <div className="space-y-2">
                                  <div className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{coverageSnapshot.queriesLine}</div>
                                  <div className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{coverageSnapshot.shareLine}</div>
                                  <div className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{coverageSnapshot.topCompetitorLine}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {globalAuditLoading ? (
                      <div className="glass-card-v2 flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                    ) : Array.isArray(globalAudit) && globalAudit.length > 0 && (
                      <div className="glass-card-v2 overflow-hidden">
                        <div className="px-6 py-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold tracking-tight text-slate-900">Project audit</h2>
                            <DataBadge type="ai" />
                          </div>
                          <p className="mt-0.5 text-sm text-slate-500">Patterns across your prompt portfolio</p>
                        </div>
                        <div className="space-y-4 px-6 pb-6">
                          {globalAudit.map((item, idx) => {
                            const priority = String(item?.priority || 'medium').toLowerCase();
                            return (
                              <div key={idx} className="glass-inset rounded-xl p-4">
                                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${priority === 'high' ? 'bg-red-50 text-red-600' : priority === 'low' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{priority}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div><p className={`${lbl} mb-1`}>Root cause</p><p className="text-xs leading-relaxed text-slate-600">{item.root_cause}</p></div>
                                  <div><p className={`${lbl} mb-1`}>Solution</p><p className="text-xs leading-relaxed text-slate-700">{item.solution}</p></div>
                                </div>
                                {item.avoid && <p className="mt-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Avoid:</span> {item.avoid}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
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
                      <div><h2 className="text-sm font-semibold text-slate-800">Prompts Analysis</h2><p className="text-[11px] text-slate-400">Visibility is share of runs where your brand appears in the model answer text (not whether your domain is in citation URLs).</p></div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600">{(prompts?.length ?? 0)}/{MAX_PROMPTS_PER_PROJECT}</span>
                  </div>
                  <div className="bg-slate-50/40 p-5">
                    {analyzePromptMutation.isError && <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{analyzePromptMutation.error?.message}</div>}
                    <form onSubmit={handleAddPrompt} className="space-y-4">
                      <div>
                        <label className={`${lbl} mb-1 block`}>Prompt query</label>
                        <input type="text" value={newPromptText} onChange={(e) => setNewPromptText(e.target.value)} placeholder="e.g. Best budget 4k tv India 2024" className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/20" />
                      </div>
                      <div className="glass-inset rounded-xl p-3.5">
                        <p className={`${lbl} mb-2`}>Models</p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {availableEngines.map((engine) => (
                            <label key={engine.id} className={`flex cursor-pointer items-center gap-2 text-sm ${engine.enabled ? 'text-slate-700' : 'cursor-not-allowed text-slate-400'}`}>
                              <input type="checkbox" checked={newPromptModels.includes(engine.id)} onChange={() => togglePromptModel(engine.id)} disabled={!engine.enabled} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/25 disabled:opacity-40" />
                              {engine.name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button type="submit" disabled={analyzePromptMutation.isPending || !newPromptText.trim() || atPromptLimit}>{analyzePromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{atPromptLimit ? `Limit reached (${MAX_PROMPTS_PER_PROJECT})` : 'Analyze Prompt'}</Button>
                        {Object.values(runningPrompts).some(Boolean) && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysis in progress</span>}
                      </div>
                    </form>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead><tr className="border-b border-slate-100/80 text-slate-400">{['Prompt', 'Answer vis.', 'Quality', 'Sentiment', 'Avg Rank', 'Models', 'Actions'].map((h) => <th key={h} className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {promptAnalysisLoading ? Array.from({ length: 6 }).map((_, idx) => (<tr key={`sk-${idx}`}><td className="px-5 py-3"><div className="h-3 w-52 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-5 w-14 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-12 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-12 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-10 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-28 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-6 w-24 animate-pulse rounded bg-slate-100" /></td></tr>))
                          : (promptAnalysis?.rows || []).map((row, idx) => (
                            <tr key={`${row.prompt_id}-${idx}`} className="transition-colors hover:bg-slate-50/50">
                              <td className="max-w-[300px] px-5 py-3">
                                <button type="button" onClick={() => openPromptDeepIntel(row.prompt_id)} className="block w-full truncate text-left text-sm font-medium text-slate-800 hover:text-brand-primary">{row.prompt_text}</button>
                              </td>
                              <td className="px-5 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${(row.visibility_pct ?? row.visibility) > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{row.visibility_pct ?? row.visibility}%</span></td>
                              <td className="px-5 py-3 font-medium tabular-nums text-slate-500">{row.quality_score ?? '-'}</td>
                              <td className="px-5 py-3 text-xs font-medium capitalize text-slate-500">{row.sentiment}</td>
                              <td className="px-5 py-3 font-medium tabular-nums text-slate-500">{row.avg_rank ?? '-'}</td>
                              <td className="max-w-[200px] px-5 py-3 text-xs text-slate-600">{(row.models || []).map((m) => modelIdToName[m] || m).join(', ') || '—'}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Button size="sm" onClick={() => runPromptMutation.mutate(row.prompt_id)} disabled={runningPrompts[row.prompt_id]}>{runningPrompts[row.prompt_id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}{runningPrompts[row.prompt_id] ? 'Running' : 'Run'}</Button>
                                  <Button size="sm" variant="ghost" onClick={() => deletePromptMutation.mutate(row.prompt_id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {!promptAnalysisLoading && (promptAnalysis?.rows || []).length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">No prompt analytics yet.</td></tr>}
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
                    <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">Competitor Analysis</p><DataBadge type="measured" /></div><p className="text-[11px] text-slate-400">Rankings from brand mentions in model answers across engines (separate from citation URLs).</p></div>
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
                      <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">Research Sources</p><DataBadge type="measured" /></div><p className="text-[11px] text-slate-400">Domains and URLs from model responses. “Site in citations” on the overview counts when your project website host appears here.</p></div>
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
                            <p className="text-[10px] text-slate-400">Or use &quot;Draft from Top Citation&quot; in Sources or &quot;Generate Draft&quot; in Opportunities to pre-fill this.</p>
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
        <motion.section ref={deepIntelRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-v2 mt-8 scroll-mt-6 overflow-hidden p-8">
          <div className="mb-8 flex items-center justify-between border-b border-slate-100/80 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Target className="h-5 w-5" /></div>
              <div>
                <h3 className="text-xs font-medium text-slate-500">Prompt detail</h3>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{promptDetailData?.prompt_text}</h2>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedPromptId(null)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600" aria-label="Close"><Plus className="h-5 w-5 rotate-45" /></button>
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
                  <div className="glass-card-v2 p-6">
                    <h5 className="mb-5 flex items-center gap-2 text-xs font-semibold text-slate-700"><CheckCircle2 className="h-4 w-4 text-slate-500" /> Strategic audit</h5>
                    <div className="space-y-4">
                      {(promptDetailData.audit || []).length === 0 && <p className="text-sm text-slate-500">No analysis yet. Run this prompt to generate audit findings.</p>}
                      {(promptDetailData.audit || []).map((item, idx) => (
                        <div key={idx} className="glass-inset rounded-xl p-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <h6 className="text-sm font-semibold text-slate-900">{item.title}</h6>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${item.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{item.priority}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div><p className={`${lbl} mb-1`}>Root cause</p><div className="text-xs leading-relaxed text-slate-600">{renderTextWithLinks(item.root_cause || item.detail)}</div></div>
                            <div><p className={`${lbl} mb-1`}>Tactical solution</p><div className="text-xs leading-relaxed text-slate-800">{renderTextWithLinks(item.solution)}</div></div>
                          </div>
                          {item.avoid && <p className="mt-3 text-xs text-slate-500"><span className="font-medium text-slate-600">Avoid:</span> {item.avoid}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="glass-card-v2 p-6">
                  <h5 className="mb-5 flex items-center gap-2 text-xs font-semibold text-slate-700"><PlayCircle className="h-5 w-5 text-slate-500" /> Recommended execution steps</h5>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {(promptDetailData.recommended_actions || []).map((item, idx) => (
                      <div key={idx} className="glass-inset flex flex-col justify-between rounded-xl p-5">
                        <div>
                          <h6 className="mb-2 text-sm font-semibold text-slate-900">{item.title}</h6>
                          <p className="text-xs leading-relaxed text-slate-600">{renderTextWithLinks(item.detail)}</p>
                        </div>
                        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline">Open link <ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    ))}
                  </div>
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
