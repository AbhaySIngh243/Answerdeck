import React, { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  Play,
  PlayCircle,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
  Zap,
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
  Area,
  AreaChart,
} from 'recharts';

import { api } from '../../lib/api';
import { chartTheme } from '../../lib/chartTheme';
import { mergeSourcesByDomainKey } from '../../lib/mergeSources';
import SourcesPieChart from './SourcesPieChart';

const MAX_PROMPTS_PER_PROJECT = 10;

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

const surf = 'bg-white';
const brd = 'border-slate-200';
const fg = 'text-slate-900';
const mt = 'text-slate-500';
const label = 'text-[11px] font-semibold uppercase tracking-wider text-slate-400';

const DRAFT_TARGET_LABELS = {
  research: 'Suggested from research',
  audit: 'From audit',
  citation: 'From citations',
  path: 'From execution path',
  custom: 'Custom brief',
};

const EXEC_CONTENT_TYPES = ['Article', 'Blog', 'Reddit Post'];

/** Split action-plan detail text into { prose, urls[] } so we can render them separately. */
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
  const prose = s
    .replace(/https?:\/\/[^\s<>'"]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { prose, urls };
}

/** Turn raw strings that contain URLs into text nodes + external links (e.g. action plan copy from the API). */
function renderTextWithLinks(text, linkClassName) {
  if (text == null || text === '') return null;
  const s = String(text);
  const cn =
    linkClassName ||
    'font-semibold text-brand-primary underline decoration-brand-primary/50 underline-offset-2 break-all hover:decoration-brand-primary';
  const parts = [];
  let last = 0;
  let m;
  let k = 0;
  const urlRe = /https?:\/\/[^\s<>'"]+/gi;
  while ((m = urlRe.exec(s)) !== null) {
    const raw = m[0];
    const href = raw.replace(/[),.;:]+$/g, '') || raw;
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      <a key={`link-${k++}`} href={href} target="_blank" rel="noopener noreferrer" className={cn}>
        {href.length < raw.length ? href : raw}
      </a>
    );
    last = m.index + raw.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length > 0 ? parts : s;
}

/** A single action-plan card with clean formatting + expandable deep playbook. */
function ActionPlanCard({ item, projectId }) {
  const [open, setOpen] = useState(false);

  const { data: playbook, isLoading: playbookLoading, refetch } = useQuery({
    queryKey: ['action-playbook', projectId, item.title],
    queryFn: () =>
      api.getActionPlaybook(projectId, {
        title: item.title,
        detail: item.detail,
      }),
    enabled: false,
  });

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && !playbook && !playbookLoading) refetch();
  }, [open, playbook, playbookLoading, refetch]);

  const { prose, urls } = useMemo(() => splitProseAndUrls(item.detail), [item.detail]);

  return (
    <div className="rounded-lg border border-slate-100 hover:border-slate-200 transition-colors overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h4 className="text-[13px] font-semibold text-slate-800 leading-snug">{item.title}</h4>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            item.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-brand-primary'
          }`}>
            {item.priority}
          </span>
        </div>

        {prose && (
          <p className="text-xs text-slate-500 leading-relaxed mb-2">{prose}</p>
        )}

        {urls.length > 0 && (
          <div className="mb-1">
            <p className={`${label} mb-1.5`}>Sources ({urls.length})</p>
            <ul className="space-y-1">
              {urls.map((url, i) => {
                let domain;
                try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = url; }
                return (
                  <li key={i} className="flex items-center gap-1.5 min-w-0">
                    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-3 w-3 shrink-0 rounded-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                    <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-[11px] font-medium text-brand-primary hover:underline" title={url}>
                      {domain}
                    </a>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 text-slate-300" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-2 text-[11px] font-medium transition-colors ${
          open ? 'bg-blue-50/50 text-brand-primary' : 'bg-slate-50/40 text-slate-400 hover:text-brand-primary'
        }`}
      >
        {playbookLoading ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
        ) : open ? (
          <><ChevronDown className="h-3 w-3 rotate-180" /> Hide playbook</>
        ) : (
          <><ChevronDown className="h-3 w-3" /> Show playbook</>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/30">
          {playbookLoading && !playbook ? (
            <div className="flex flex-col items-center gap-2.5 py-10">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary/40" />
              <p className="text-xs text-slate-400">Researching this action…</p>
            </div>
          ) : playbook ? (
            <div className="space-y-4 p-4">
              {playbook.why_it_matters && (
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-primary mb-1.5">
                    <Lightbulb className="h-3 w-3" /> Why this matters
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{playbook.why_it_matters}</p>
                </div>
              )}

              <div>
                <p className={`${label} mb-2`}>Steps</p>
                <ol className="space-y-2.5">
                  {(playbook.steps || []).map((step, si) => (
                    <li key={si} className="rounded-lg border border-slate-100 bg-white p-3">
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-primary text-[10px] font-semibold text-white mt-px">{si + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-800 mb-0.5">{step.title}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{step.detail}</p>
                          {step.example && (
                            <div className="mt-2 rounded-md bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500 italic">
                              <span className="not-italic font-medium text-slate-600 mr-1">Example:</span>{step.example}
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
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-2">
                    <Zap className="h-3 w-3" /> Quick wins
                  </p>
                  <div className="space-y-2">
                    {playbook.quick_wins.map((qw, qi) => (
                      <div key={qi} className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2">
                        <p className="text-xs font-medium text-emerald-700 mb-0.5">{qw.title}</p>
                        <p className="text-xs text-emerald-600/70 leading-relaxed">{qw.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(playbook.common_mistakes || []).length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-2">
                    <ShieldAlert className="h-3 w-3" /> Avoid
                  </p>
                  <div className="space-y-2">
                    {playbook.common_mistakes.map((cm, ci) => (
                      <div key={ci} className="rounded-md bg-red-50 border border-red-100 px-3 py-2">
                        <p className="text-xs font-medium text-red-600 mb-0.5">{cm.title}</p>
                        <p className="text-xs text-red-500/70 leading-relaxed">{cm.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(playbook.tools_mentioned || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-medium text-slate-400">Tools:</span>
                  {playbook.tools_mentioned.map((tool) => (
                    <span key={tool} className="rounded border border-slate-100 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{tool}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-center">
              <p className="text-xs text-slate-400 mb-2">Failed to load playbook.</p>
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testModels, setTestModels] = useState([]);
  const [activeSection, setActiveSection] = useState('dashboard');

  const { data: projectData, isLoading, error } = useQuery({
    queryKey: ['project-data', id],
    queryFn: async () => {
      const [project, prompts, dashboard, engines] = await Promise.all([
        api.getProject(id),
        api.getPrompts(id),
        api.getProjectDashboard(id),
        api.getEngines(),
      ]);

      return {
        project,
        prompts,
        dashboard,
        enabledEngines: engines.enabled_engines || [],
        availableEngines: engines.available_engines || [],
      };
    },
  });

  const needsPromptAnalysis = activeSection === 'dashboard' || activeSection === 'prompts';
  const needsDeepAnalysis = activeSection === 'history' || activeSection === 'opportunities' || activeSection === 'execute';
  /* Prefetch so Sources / Competitors tabs are not empty while a second request runs after navigation. */
  const needsSourcesIntel = Boolean(id);
  const needsCompetitorIntel = Boolean(id);

  const { data: promptAnalysis, isLoading: promptAnalysisLoading, error: promptAnalysisError } = useQuery({
    queryKey: ['prompt-analysis', id],
    queryFn: () => api.getPromptAnalysis(id),
    enabled: Boolean(id) && needsPromptAnalysis,
    staleTime: 60_000,
  });

  const { data: deepAnalysis, isLoading: deepAnalysisLoading, error: deepAnalysisError } = useQuery({
    queryKey: ['deep-analysis', id],
    queryFn: () => api.getDeepAnalysis(id),
    enabled: Boolean(id) && needsDeepAnalysis,
    staleTime: 60_000,
  });

  const { data: sourcesIntel, isLoading: sourcesIntelLoading } = useQuery({
    queryKey: ['sources-intelligence', id],
    queryFn: () => api.getSourcesIntelligence(id),
    enabled: Boolean(id) && needsSourcesIntel,
    staleTime: 60_000,
  });

  const { data: competitorIntel, isLoading: competitorIntelLoading } = useQuery({
    queryKey: ['competitor-intelligence', id],
    queryFn: () => api.getCompetitorIntelligence(id),
    enabled: Boolean(id) && needsCompetitorIntel,
    staleTime: 60_000,
  });

  const { data: reportData } = useQuery({
    queryKey: ['prompt-report', selectedPromptId],
    queryFn: () => api.getPromptResults(selectedPromptId),
    enabled: Boolean(selectedPromptId),
  });

  const { data: promptDetailData, isLoading: promptDetailLoading } = useQuery({
    queryKey: ['prompt-detail', selectedPromptId],
    queryFn: () => api.getPromptDetail(selectedPromptId),
    enabled: Boolean(selectedPromptId),
  });

  /** Prefer prompt-scoped sources when non-empty; else project aggregate. Normalize shapes (prompt uses `mentions` + link objects). */
  const mergedSourcesRows = useMemo(() => {
    const fromPrompt =
      selectedPromptId && Array.isArray(promptDetailData?.sources) && promptDetailData.sources.length > 0
        ? promptDetailData.sources
        : null;
    const raw = (fromPrompt ?? sourcesIntel?.domains) || [];
    const normalized = raw.slice(0, 20).map((row) => {
      const linkObjs = Array.isArray(row.links) ? row.links : [];
      const flatLinks = linkObjs
        .map((l) => (typeof l === 'string' ? l : l?.url))
        .filter(Boolean);
      return {
        domain: row.domain,
        source_mentions: Number(row.source_mentions ?? row.mentions) || 0,
        links: flatLinks,
      };
    });
    return mergeSourcesByDomainKey(normalized);
  }, [selectedPromptId, promptDetailData?.sources, sourcesIntel?.domains]);

  /** Always use `/competitors` rows: same shape as the grid (brand, market_share, visibility…). Prompt detail `competitors` is brand_ranking ({ name, mentions }) and breaks this UI. */
  const competitorDisplayRows = useMemo(() => competitorIntel?.rows || [], [competitorIntel?.rows]);

  const { data: intelSummary, isLoading: intelSummaryLoading } = useQuery({
    queryKey: ['intel-summary', id],
    queryFn: () => api.getIntelSummary(id),
    // This query is only shown in the "dashboard" section when a specific prompt
    // isn't selected. Avoid fetching it for every section to keep the UI responsive.
    enabled: Boolean(id) && activeSection === 'dashboard' && !selectedPromptId,
  });

  const { data: globalAudit, isLoading: globalAuditLoading } = useQuery({
    queryKey: ['global-audit', id],
    queryFn: () => api.getGlobalAudit(id),
    // This query is only shown in the "audit" section when no prompt is selected.
    enabled: Boolean(id) && activeSection === 'audit' && !selectedPromptId,
  });

  const [execContent, setExecContent] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedActionModel, setSelectedActionModel] = useState('deepseek');
  const [execError, setExecError] = useState(null);
  const [execIncludeFaqSchema, setExecIncludeFaqSchema] = useState(true);
  const [execIncludeComparisonTable, setExecIncludeComparisonTable] = useState(true);
  const [execIncludePublishChecklist, setExecIncludePublishChecklist] = useState(true);
  /** When set, Execution tab "draft target" panel reflects this source (audit, custom, etc.) instead of only the first research retrieval point. */
  const [execDraftTarget, setExecDraftTarget] = useState(null);
  const [customBriefText, setCustomBriefText] = useState('');
  const [customBriefType, setCustomBriefType] = useState('Article');
  const [dashChartMode, setDashChartMode] = useState('visibility');

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const exportDashboardCSV = useCallback(() => {
    const proj = projectData?.project;
    const dash = projectData?.dashboard;
    const proms = projectData?.prompts ?? [];
    const engines = projectData?.enabledEngines ?? [];
    if (!proj) return;
    const rows = [['Section', 'Field', 'Value']];
    rows.push(['Overview', 'Project', proj.name]);
    rows.push(['Overview', 'Category', proj.category || '']);
    rows.push(['Overview', 'Region', proj.region || '']);
    rows.push(['Overview', 'Visibility', String(dash?.current_visibility_score ?? '')]);
    rows.push(['Overview', 'Prompts', String(proms.length)]);
    rows.push(['Overview', 'Engines', engines.map((e) => e.name).join(', ')]);
    rows.push(['Overview', 'Date range', `${dateFrom} – ${dateTo}`]);
    (dash?.visibility_trend || []).forEach((t) => {
      rows.push(['Visibility Trend', t.date, String(t.score)]);
    });
    (dash?.competitors || []).forEach((c) => {
      rows.push(['Competitor', c.brand, String(c.visibility_score ?? '')]);
    });
    (promptAnalysis?.rows || []).forEach((r) => {
      rows.push(['Prompt', r.prompt_text, `vis=${r.visibility} rank=${r.avg_rank ?? '-'} sentiment=${r.sentiment}`]);
    });
    if (intelSummary) {
      rows.push(['Intel', 'Health', intelSummary.overall_health || '']);
      rows.push(['Intel', 'Summary', intelSummary.executive_summary || '']);
      (intelSummary.competitive_threats || []).forEach((t) => rows.push(['Intel', 'Threat', t]));
      (intelSummary.top_priority_prompts || []).forEach((p) => rows.push(['Intel', 'Priority', p]));
    }
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
    if (execIncludeFaqSchema) {
      lines.push(
        'Requirements: include an FAQ section and provide JSON-LD FAQ schema markup (where possible).'
      );
    }
    if (execIncludeComparisonTable) {
      lines.push('Requirements: include at least one structured comparison table (targets, key specs, and decision criteria).');
    }
    if (execIncludePublishChecklist) {
      lines.push('Requirements: end with a publish checklist (what to add to the page, recommended anchor text, and internal linking notes).');
    }
    return lines.join('\n');
  };

  const executeActionMutation = useMutation({
    mutationFn: (data) => api.executeAction(id, data),
    onSuccess: (res) => { setExecContent(res); setIsExecuting(false); setExecError(null); },
    onError: (err) => { setIsExecuting(false); setExecError(err.message || 'Failed to generate content.'); },
  });

  const testPromptMutation = useMutation({
    mutationFn: (payload) => api.runTestPrompt(id, payload),
  });

  const inviteMutation = useMutation({
    mutationFn: (email) => api.inviteCollaborator(id, email),
    onSuccess: () => { setInviteEmail(''); queryClient.invalidateQueries({ queryKey: ['project-data', id] }); },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['project-data', id] });
    queryClient.invalidateQueries({ queryKey: ['prompt-analysis', id] });
    queryClient.invalidateQueries({ queryKey: ['deep-analysis', id] });
    queryClient.invalidateQueries({ queryKey: ['sources-intelligence', id] });
    queryClient.invalidateQueries({ queryKey: ['competitor-intelligence', id] });
    queryClient.invalidateQueries({ queryKey: ['intel-summary', id] });
    queryClient.invalidateQueries({ queryKey: ['global-audit', id] });
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
      setNewPromptText(''); setNewPromptCountry(''); setNewPromptTags(''); setNewPromptModels([]);
      pollJobStatus(jobId, promptId);
    },
  });

  const deletePromptMutation = useMutation({ mutationFn: api.deletePrompt, onSuccess: refreshAll });

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
    return <div className={`rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400`}>{error?.message || 'Failed to load project'}</div>;
  }

  const { project, prompts, dashboard, enabledEngines, availableEngines } = projectData;
  const atPromptLimit = (prompts?.length ?? 0) >= MAX_PROMPTS_PER_PROJECT;

  const runExecuteFromTarget = (target) => {
    if (!target?.source) return;
    let directive;
    let query = target.query;
    const contentType = target.contentType || 'Article';
    switch (target.source) {
      case 'research': {
        const dom = target.domain || 'the top cited source';
        directive = applyExecOptionsToDirective(
          `Use ${dom} as an evidence-backed citation target. Write an AI-retrieval-first answer page for this intent: "${target.query}". Include: clear section headings, concise factual claims aligned to the citation framing, and a strong next-step recommendation for brand ${project.name}.`
        );
        break;
      }
      case 'audit':
        directive = applyExecOptionsToDirective(
          `Turn this audit fix into an AI-retrieval-first content draft for brand ${project.name}. Root cause: ${target.auditRootCause}. Solution: ${target.auditSolution}. Include structured headings, explicit intent coverage, and a clear next-step recommendation.`
        );
        break;
      case 'citation': {
        const dom = target.domain || 'the top citation domain';
        directive = applyExecOptionsToDirective(
          `Write an AI-retrieval-first fix for brand ${project.name}. Use ${dom} as a citation target. Anchor the content to the intent "${target.query}". Include: clear headings, explicit answers, and next-step positioning guidance.`
        );
        break;
      }
      case 'path':
        directive = applyExecOptionsToDirective(
          `Write an AI-retrieval-first solution for brand ${project.name}. ${target.pathRec} Focus on: exact intent coverage, structured headings, and clear next steps that increase likelihood of appearing in AI recommendations.`
        );
        query = target.pathRec;
        break;
      case 'custom':
        directive = applyExecOptionsToDirective(
          `Write an AI-retrieval-first ${contentType} for brand ${project.name} based on this brief from the user:\n\n${target.customBrief}\n\nFollow the brief closely; use clear headings and entity-rich language suited for AI retrieval.`
        );
        query = target.headline || target.customBrief.slice(0, 200);
        break;
      default:
        return;
    }
    setIsExecuting(true);
    setExecError(null);
    setExecContent(null);
    executeActionMutation.mutate({
      directive,
      content_type: contentType,
      query,
      model: selectedActionModel,
    });
  };

  const topRetrievalPoint = deepAnalysis?.search_intel?.retrieval_points?.[0];
  const effectiveDraftTarget =
    execDraftTarget ||
    (topRetrievalPoint
      ? {
          source: 'research',
          headline: topRetrievalPoint.title,
          query: topRetrievalPoint.query,
          contentType: 'Article',
          domain: topRetrievalPoint.domain,
        }
      : null);

  const handleAddPrompt = (event) => {
    event.preventDefault();
    if (!newPromptText.trim() || atPromptLimit) return;
    const tags = newPromptTags.split(',').map((item) => item.trim()).filter(Boolean);
    analyzePromptMutation.mutate({ prompt_text: newPromptText.trim(), country: newPromptCountry || project.region || '', tags, selected_models: newPromptModels, prompt_type: 'Manual', is_active: true });
  };

  const togglePromptModel = (modelId) => { setNewPromptModels((prev) => (prev.includes(modelId) ? prev.filter((item) => item !== modelId) : [...prev, modelId])); };
  const toggleTestModel = (modelId) => { setTestModels((prev) => (prev.includes(modelId) ? prev.filter((item) => item !== modelId) : [...prev, modelId])); };

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
      {/* Header + date / export toolbar */}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to="/dashboard"
            className={`shrink-0 rounded-lg border ${brd} ${surf} p-2 ${mt} transition-colors hover:border-brand-primary hover:text-brand-primary`}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{project.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500 font-medium">{project.category || 'Uncategorized'}</span>
              {project.region ? (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="truncate">{project.region}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-center">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-lg border ${brd} ${surf} px-3 py-2 text-[12px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300`}
            >
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="tabular-nums">
                {new Date(dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' - '}
                {new Date(dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>
            {showDatePicker && (
              <div className={`absolute right-0 top-full z-30 mt-1.5 flex items-center gap-2 rounded-xl border ${brd} ${surf} p-3 shadow-lg`}>
                <label className="text-[11px] font-medium text-slate-500">
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  />
                </label>
                <span className="mt-4 text-slate-300">–</span>
                <label className="text-[11px] font-medium text-slate-500">
                  To
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  />
                </label>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="mt-4 rounded-md bg-brand-primary px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
          <button
            onClick={exportDashboardCSV}
            className={`inline-flex items-center gap-1.5 rounded-lg border ${brd} ${surf} px-3 py-2 text-[12px] font-medium text-slate-600 shadow-sm transition-colors hover:border-brand-primary hover:text-brand-primary`}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside
          className={`${surf} border ${brd} h-fit rounded-xl p-2.5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto max-lg:max-h-[min(50vh,22rem)] max-lg:overflow-y-auto`}
        >
          <p className={`${label} px-3 pt-2 pb-1.5`}>Sections</p>
          <div className="space-y-0.5">
            {SECTION_IDS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-brand-primary text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
      {/* ── Stat cards ── */}
      {(() => {
        const vis = dashboard?.current_visibility_score || 0;
        const trend = dashboard?.visibility_trend || [];
        const prevVis = trend.length >= 2 ? trend[trend.length - 2]?.score : null;
        const visDeltaRaw = prevVis != null ? vis - prevVis : null;
        const visDelta = visDeltaRaw != null ? Math.round(visDeltaRaw * 10) / 10 : null;
        const promptCount = prompts.length;
        const avgRank = (() => {
          const rows = promptAnalysis?.rows || [];
          if (!rows.length) return null;
          const vals = rows.map(r => r.avg_rank).filter(v => v != null);
          return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
        })();
        const engineCount = enabledEngines.length;
        const competitorCount = (dashboard?.competitors || []).length;

        const cards = [
          { label: 'Visibility', value: `${vis}%`, delta: visDelta != null ? `${visDelta >= 0 ? '+' : ''}${visDelta}%` : null, deltaUp: visDelta >= 0, sub: 'since last period' },
          { label: 'Rankings trend', value: avgRank != null ? avgRank : '-', delta: null, sub: `across ${promptCount} prompts` },
          { label: 'AI Engines', value: engineCount, delta: null, sub: `${competitorCount} competitors tracked` },
          { label: 'Prompts', value: promptCount, delta: null, sub: promptCount > 0 ? 'active queries' : 'no queries yet' },
        ];
        return (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className={`${surf} border ${brd} rounded-xl px-4 py-4 flex flex-col justify-between gap-1`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                  {c.label === 'AI Engines' && (
                    <button
                      onClick={() => runAllMutation.mutate(id)}
                      disabled={runAllMutation.isPending || prompts.length === 0}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-primary px-2 py-1 text-[10px] font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      {runAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                      Run All
                    </button>
                  )}
                </div>
                <p className="text-2xl font-bold tabular-nums text-slate-900 tracking-tight">{c.value}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.delta != null && (
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      c.deltaUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {c.deltaUp ? '↑' : '↓'} {c.delta}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 font-medium">{c.sub}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ===== DASHBOARD TAB ===== */}
      {activeSection === 'dashboard' && (
        <div className="space-y-5">

          {/* ── Performance chart with toggle tabs ── */}
          <section className={`rounded-xl border ${brd} ${surf} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-800">Performance</h3>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
                {[
                  { id: 'visibility', label: 'Visibility' },
                  { id: 'rankings', label: 'Rankings' },
                  { id: 'engines', label: 'Engines' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDashChartMode(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                      dashChartMode === tab.id
                        ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {dashChartMode === 'visibility' ? (
                    <AreaChart data={dashboard?.visibility_trend || []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="visAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartTheme.colors.accent} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={chartTheme.colors.accent} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartTheme.grid} vertical={false} />
                      <XAxis dataKey="date" tick={chartTheme.axisTick} axisLine={false} tickLine={false} dy={8} />
                      <YAxis domain={[0, 100]} tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={chartTheme.tooltip.contentStyle} itemStyle={chartTheme.tooltip.itemStyle} labelStyle={chartTheme.tooltip.labelStyle} />
                      <Area type="monotone" dataKey="score" stroke={chartTheme.colors.accent} strokeWidth={2.5} fill="url(#visAreaFill)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: chartTheme.colors.accent }} name="Visibility" />
                    </AreaChart>
                  ) : dashChartMode === 'rankings' ? (
                    <AreaChart data={(promptAnalysis?.rows || []).slice(0, 12).map((r) => ({ name: r.prompt_text?.slice(0, 24) + (r.prompt_text?.length > 24 ? '…' : ''), rank: r.avg_rank, visibility: r.visibility }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="rankAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartTheme.colors.success} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={chartTheme.colors.success} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartTheme.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ ...chartTheme.axisTick, fontSize: 10 }} axisLine={false} tickLine={false} dy={8} interval={0} angle={-18} textAnchor="end" height={48} />
                      <YAxis tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={36} reversed domain={[1, 'auto']} />
                      <Tooltip contentStyle={chartTheme.tooltip.contentStyle} itemStyle={chartTheme.tooltip.itemStyle} labelStyle={chartTheme.tooltip.labelStyle} />
                      <Area type="monotone" dataKey="rank" stroke={chartTheme.colors.success} strokeWidth={2.5} fill="url(#rankAreaFill)" dot={{ r: 3, fill: chartTheme.colors.success, strokeWidth: 0 }} name="Avg Rank" />
                    </AreaChart>
                  ) : (
                    <BarChart data={(dashboard?.competitors || []).slice(0, 10)} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid {...chartTheme.grid} horizontal={false} />
                      <XAxis type="number" tick={chartTheme.axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis dataKey="brand" type="category" tick={{ ...chartTheme.axisTick, fontSize: 11, fontWeight: 600 }} width={96} axisLine={false} tickLine={false} tickFormatter={(v) => v?.length > 14 ? v.slice(0, 13) + '…' : v} />
                      <Tooltip contentStyle={chartTheme.tooltip.contentStyle} itemStyle={chartTheme.tooltip.itemStyle} labelStyle={chartTheme.tooltip.labelStyle} />
                      <Bar dataKey="visibility_score" fill={chartTheme.colors.accent} radius={chartTheme.barRadiusHorizontal} barSize={16} name="Visibility" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ── Two-column: Prompt Performance + Competitor Quick View ── */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
            {/* Prompt Performance Table */}
            <section className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Prompt Performance</p>
                <button onClick={() => setActiveSection('prompts')} className="text-xs font-medium text-brand-primary hover:underline">View all</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="text-left py-2.5 px-5 font-medium text-[11px] uppercase tracking-wider">Prompt</th>
                      <th className="text-right py-2.5 px-4 font-medium text-[11px] uppercase tracking-wider">Visibility</th>
                      <th className="text-right py-2.5 px-4 font-medium text-[11px] uppercase tracking-wider">Avg Rank</th>
                      <th className="text-center py-2.5 px-4 font-medium text-[11px] uppercase tracking-wider">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {promptAnalysisLoading
                      ? Array.from({ length: 5 }).map((_, idx) => (
                          <tr key={`sk-${idx}`}>
                            <td className="py-3 px-5"><div className="h-3 w-52 rounded bg-slate-100 animate-pulse" /></td>
                            <td className="py-3 px-4 text-right"><div className="h-5 w-14 rounded bg-slate-100 animate-pulse inline-block" /></td>
                            <td className="py-3 px-4 text-right"><div className="h-3 w-10 rounded bg-slate-100 animate-pulse inline-block" /></td>
                            <td className="py-3 px-4 text-center"><div className="h-5 w-16 rounded bg-slate-100 animate-pulse inline-block" /></td>
                          </tr>
                        ))
                      : (promptAnalysis?.rows || []).slice(0, 8).map((row) => (
                          <tr key={row.prompt_id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-5 font-medium text-slate-800 truncate max-w-[260px]">{row.prompt_text}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${row.visibility > 70 ? 'bg-emerald-50 text-emerald-600' : row.visibility > 40 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                {row.visibility}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-500 tabular-nums font-medium">{row.avg_rank ?? '-'}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                                row.sentiment === 'positive' ? 'bg-blue-50 text-blue-600'
                                  : row.sentiment === 'negative' ? 'bg-red-50 text-red-600'
                                  : 'bg-slate-50 text-slate-500'
                              }`}>
                                {row.sentiment}
                              </span>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Competitor Quick View */}
            <section className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Competitor Snapshot</p>
                <button onClick={() => setActiveSection('competitors')} className="text-xs font-medium text-brand-primary hover:underline">View all</button>
              </div>
              <div className="divide-y divide-slate-100">
                {(dashboard?.competitors || []).length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">No competitor data yet. Run an analysis to populate.</p>
                ) : (
                  (dashboard?.competitors || []).slice(0, 6).map((c, idx) => {
                    const vis = c.visibility_score ?? 0;
                    return (
                      <div key={c.brand || idx} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-slate-800">{c.brand}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="hidden w-24 sm:block">
                            <div className="h-1.5 w-full rounded-full bg-slate-100">
                              <div
                                className="h-1.5 rounded-full bg-brand-primary transition-all"
                                style={{ width: `${Math.min(100, vis)}%` }}
                              />
                            </div>
                          </div>
                          <span className="min-w-[3rem] text-right text-xs font-bold tabular-nums text-slate-700">{vis}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* ── Executive Intelligence Summary ── */}
          {!selectedPromptId && activeSection === 'dashboard' && (
            intelSummaryLoading ? (
              <div className={`border ${brd} rounded-xl p-6 ${surf} animate-pulse`}>
                <div className="space-y-3 mb-6">
                  <div className="h-5 w-64 rounded bg-slate-100" />
                  <div className="h-3 w-44 rounded bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
                  <div className="space-y-4">
                    <div className="h-20 rounded-lg bg-slate-50 border border-slate-100" />
                    <div className="h-28 rounded-lg bg-slate-50 border border-slate-100" />
                  </div>
                  <div className="h-52 rounded-lg bg-slate-50 border border-slate-100" />
                </div>
              </div>
            ) : (
              intelSummary && (
                <div className={`border ${brd} rounded-xl ${surf} overflow-hidden`}>
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Executive Intelligence Summary</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Evidence-backed roadmap to improve AI visibility</p>
                </div>
                <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  intelSummary.overall_health === 'Strong' ? 'bg-emerald-50 text-emerald-600' :
                  intelSummary.overall_health === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-brand-primary'
                }`}>
                  {intelSummary.overall_health}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                <div className="p-6 space-y-5">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className={`${label} mb-2`}>Summary</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{intelSummary.executive_summary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <p className={`${label} mb-2.5`}>Roadmap</p>
                      <div className="space-y-2">
                        {(intelSummary.strategic_roadmap || []).map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-primary text-[10px] font-semibold text-white mt-0.5">{idx + 1}</span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-brand-primary uppercase">{step.phase}</p>
                              <p className="text-xs text-slate-600 leading-relaxed">{step.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className={`${label} mb-2.5`}>Competitive Threats</p>
                      <div className="space-y-2">
                        {(intelSummary.competitive_threats || []).map((threat, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" /> {threat}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <p className={`${label}`}>Priority Directives</p>
                  <div className="space-y-2.5">
                    {(intelSummary.top_priority_prompts || []).map((prompt, idx) => (
                      <div key={idx} className="group cursor-pointer rounded-lg border border-slate-100 p-3 hover:border-brand-primary/40 transition-colors">
                        <p className="text-[13px] font-medium text-slate-800 group-hover:text-brand-primary">{prompt}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {intelSummary.overall_health === 'Strong' ? 'Defend winning intents'
                            : intelSummary.overall_health === 'Critical' ? 'Remediate low-visibility'
                            : 'Improve intent coverage'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveSection('execute')}
                    className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600"
                  >
                    {intelSummary.overall_health === 'Strong' ? 'Generate defense drafts'
                      : intelSummary.overall_health === 'Critical' ? 'Generate remediation drafts'
                      : 'Generate stabilization drafts'}
                  </button>
                  <button onClick={() => setActiveSection('prompts')} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-primary hover:text-brand-primary">
                    Re-run prompt diagnostics
                  </button>
                </div>
              </div>
            </div>
              )
            )
          )}
        </div>
      )}

      {/* ===== PROMPTS TAB ===== */}
      {activeSection === 'prompts' && (
      <section id="prompts" className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Prompts Analysis</h2>
          <span className="text-xs text-slate-400">{(prompts?.length ?? 0)}/{MAX_PROMPTS_PER_PROJECT} prompts</span>
        </div>

        <div className="p-5 bg-slate-50/60">
          {analyzePromptMutation.isError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
              {analyzePromptMutation.error?.message}
            </div>
          )}
          <form onSubmit={handleAddPrompt} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Prompt Query', val: newPromptText, set: setNewPromptText, ph: 'e.g. Best budget 4k tv India 2024' },
                { label: 'Region', val: newPromptCountry, set: setNewPromptCountry, ph: 'Country (optional)' },
                { label: 'Tags', val: newPromptTags, set: setNewPromptTags, ph: 'Comma separated' },
              ].map((f) => (
                <div key={f.label}>
                  <label className={`${label} mb-1 block`}>{f.label}</label>
                  <input type="text" value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/20" />
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <p className={`${label} mb-2`}>Model Selection</p>
              <div className="flex flex-wrap gap-2">
                {availableEngines.map((engine) => (
                  <button
                    type="button" key={engine.id} onClick={() => togglePromptModel(engine.id)} disabled={!engine.enabled}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      newPromptModels.includes(engine.id)
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    } ${!engine.enabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {engine.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={analyzePromptMutation.isPending || !newPromptText.trim() || atPromptLimit} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50">
                {analyzePromptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {atPromptLimit ? `Limit reached (${MAX_PROMPTS_PER_PROJECT})` : 'Analyze Prompt'}
              </button>
              {Object.values(runningPrompts).some(Boolean) && (
                <span className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysis in progress
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                {['Prompt','Visibility','Sentiment','Avg Rank','Models','Country','Tags','Actions'].map(h => (
                  <th key={h} className="text-left py-2.5 px-5 font-medium text-[11px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promptAnalysisLoading
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`sk-p-${idx}`}>
                      <td className="py-3 px-5"><div className="h-3 w-52 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-5 w-14 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-3 w-12 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-3 w-10 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-3 w-28 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-3 w-10 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-3 w-20 rounded bg-slate-100 animate-pulse" /></td>
                      <td className="py-3 px-5"><div className="h-6 w-32 rounded bg-slate-100 animate-pulse" /></td>
                    </tr>
                  ))
                : (promptAnalysis?.rows || []).map((row, idx) => (
                    <tr key={`${row.prompt_id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5 font-medium text-slate-800 truncate max-w-[300px]">{row.prompt_text}</td>
                      <td className="py-3 px-5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${row.visibility > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {row.visibility}%
                        </span>
                      </td>
                      <td className="py-3 px-5 capitalize text-xs text-slate-500 font-medium">{row.sentiment}</td>
                      <td className="py-3 px-5 tabular-nums text-slate-500 font-medium">{row.avg_rank ?? '-'}</td>
                      <td className="py-3 px-5">
                        <div className="flex flex-wrap gap-1">
                          {(row.models || []).map(m => (
                            <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{m}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-slate-500 text-xs">{row.country || '-'}</td>
                      <td className="py-3 px-5">
                        <div className="flex flex-wrap gap-1">
                          {(row.tags || []).map(t => (
                            <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-primary">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => runPromptMutation.mutate(row.prompt_id)} disabled={runningPrompts[row.prompt_id]}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors ${runningPrompts[row.prompt_id] ? 'bg-brand-primary/60 cursor-not-allowed' : 'bg-brand-primary hover:bg-blue-600'}`}
                          >
                            {runningPrompts[row.prompt_id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            {runningPrompts[row.prompt_id] ? 'Running' : 'Run'}
                          </button>
                          <button onClick={() => setSelectedPromptId(row.prompt_id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:border-brand-primary hover:text-brand-primary transition-colors"><FileText className="w-3 h-3" />Details</button>
                          <button onClick={() => deletePromptMutation.mutate(row.prompt_id)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              {!promptAnalysisLoading && (promptAnalysis?.rows || []).length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">No prompt analytics yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* ===== COMPETITORS TAB ===== */}
      {activeSection === 'competitors' && (
      <section id="competitors" className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Competitor Analysis</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
            {competitorIntelLoading && competitorDisplayRows.length === 0
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div key={`sk-c-${idx}`} className="bg-white p-4 animate-pulse">
                    <div className="h-4 w-28 rounded bg-slate-100 mb-3" />
                    <div className="grid grid-cols-3 gap-3">
                      {Array.from({ length: 3 }).map((__, j) => (
                        <div key={j}><div className="h-3 w-8 rounded bg-slate-100 mb-1" /><div className="h-4 w-10 rounded bg-slate-100" /></div>
                      ))}
                    </div>
                  </div>
                ))
              : competitorDisplayRows.slice(0, 20).map((item) => (
                  <div key={item.brand} className={`bg-white p-4 ${item.is_focus ? 'ring-1 ring-inset ring-brand-primary/20 bg-blue-50/30' : ''}`}>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`text-sm font-semibold ${item.is_focus ? 'text-brand-primary' : 'text-slate-800'}`}>{item.brand}</span>
                      {item.is_focus && <span className="rounded bg-brand-primary px-1.5 py-0.5 text-[10px] font-medium text-white">Target</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { l: 'Share', v: `${item.market_share}%` },
                        { l: 'Visibility', v: item.visibility },
                        { l: 'Rank', v: item.avg_rank ?? '-' },
                      ].map((s) => (
                        <div key={s.l}>
                          <p className="text-[10px] text-slate-400 font-medium">{s.l}</p>
                          <p className="text-sm font-semibold text-slate-700 tabular-nums">{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
        </div>
      </section>
      )}

      {/* ===== SOURCES TAB ===== */}
      {activeSection === 'sources' && (
      <section id="sources" className={`rounded-xl border ${brd} ${surf} overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Research Sources (Citations)</p>
          <p className="text-xs text-slate-400 mt-0.5">Citations that LLMs are pulling into recommendations for your queries.</p>
        </div>

        <div className="px-5 pt-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className={`${label}`}>Evidence-backed targets</p>
          <button
            onClick={() => {
              const top = mergedSourcesRows[0];
              if (!top) return;
              const domainLabel = top.label || top.domain;
              const intent = intelSummary?.top_priority_prompts?.[0] || project.name;
              const t = {
                source: 'citation',
                headline: `${domainLabel} · ${intent}`,
                query: intent,
                contentType: 'Article',
                domain: domainLabel,
              };
              setExecDraftTarget(t);
              setActiveSection('execute');
              runExecuteFromTarget(t);
            }}
            disabled={mergedSourcesRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50"
          >
            Generate Draft from Top Citation
          </button>
        </div>

        {(sourcesIntelLoading || (Boolean(selectedPromptId) && promptDetailLoading)) && mergedSourcesRows.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12">
            <div className="h-80 relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-4 animate-pulse">
              <div className="h-5 w-[55%] rounded bg-slate-100 mb-4" />
              <div className="h-[230px] rounded-2xl bg-slate-50 border border-slate-200" />
            </div>
            <div className="dashboard-panel-scroll max-h-80 space-y-2 overflow-y-auto pr-1">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={`animate-pulse rounded-xl border ${surf} ${brd} p-3.5`}>
                  <div className="mb-2 h-4 w-[70%] rounded bg-slate-100" />
                  <div className="h-3 w-[85%] rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10">
            <div className="relative min-h-[280px] min-w-0 rounded-xl border border-[#e2e8f0] bg-[color:var(--color-bg-surface)] px-4 py-5 sm:px-6">
              <SourcesPieChart data={mergedSourcesRows} maxItems={10} />
            </div>
            <div className="dashboard-panel-scroll min-w-0 max-h-96 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
              {mergedSourcesRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
                  No citation sources in this view yet.
                </p>
              ) : null}
              {mergedSourcesRows.map((item) => {
                const displayName = item.label || item.domain;
                const aliases = item.mergedDomains || [displayName];
                const links = item.links || [];
                const linkCap = 50;
                const shownLinks = links.slice(0, linkCap);
                const listKey = aliases.slice().sort().join('|') || displayName;
                return (
                <details
                  key={listKey}
                  className={`min-w-0 w-full overflow-hidden rounded-xl border border-[#e2e8f0] bg-[color:var(--color-bg-surface)] transition-colors hover:border-slate-300 open:border-[#e2e8f0] open:shadow-sm`}
                >
                  <summary className="flex min-h-[2.75rem] cursor-pointer list-none items-center gap-2.5 overflow-hidden px-3 py-2.5 marker:content-none hover:bg-slate-50/80 sm:gap-3 sm:px-3.5 sm:py-3 [&::-webkit-details-marker]:hidden">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${item.source_mentions > 3 ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-left">
                      <span
                        className="block truncate text-sm font-semibold leading-tight text-slate-800"
                        title={displayName}
                      >
                        {displayName}
                      </span>
                      {aliases.length > 1 ? (
                        <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400" title={aliases.join(' · ')}>
                          {aliases.length} labels merged · {aliases.join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold leading-none tabular-nums text-slate-600">
                      {item.source_mentions} Mentions
                    </span>
                  </summary>
                  <div className={`border-t ${brd} bg-slate-50`}>
                    {aliases.length > 1 ? (
                      <div className="px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Grouped domain labels</p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                          {aliases.map((d) => (
                            <li key={d} className="font-medium leading-snug">{d}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {links.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-500">No URLs recorded for this source in the current data.</p>
                    ) : (
                      <ul className="space-y-2 p-4">
                        {shownLinks.map((link) => {
                          const domain = link.replace(/^https?:\/\//, '').split('/')[0];
                          return (
                            <li key={link} className="flex items-center gap-3 group/link">
                              <div className={`p-1 ${surf} border ${brd} rounded-md`}>
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  className="w-3.5 h-3.5 shrink-0"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                              <a href={link} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold text-brand-primary transition-colors hover:text-[color:var(--color-accent)]">
                                <span className="truncate">{link}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
                              </a>
                            </li>
                          );
                        })}
                        {links.length > linkCap ? (
                          <li className="pt-1 text-[11px] text-slate-400">
                            Showing {linkCap} of {links.length} URLs (deduplicated).
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                </details>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </section>
      )}

      {/* ===== HISTORY TAB ===== */}
      {activeSection === 'history' && (
      <section id="history" className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Response History</p>
        </div>
        <div className="divide-y divide-slate-100">
            {deepAnalysisLoading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div key={`sk-h-${idx}`} className="px-5 py-3.5 animate-pulse">
                    <div className="h-3.5 w-3/4 rounded bg-slate-100 mb-2.5" />
                    <div className="flex gap-2">
                      {Array.from({ length: 3 }).map((__, j) => (
                        <div key={j} className="h-5 w-24 rounded bg-slate-100" />
                      ))}
                    </div>
                  </div>
                ))
              : (deepAnalysis?.prompt_matrix || []).slice(0, 20).map((item) => (
                  <div key={item.prompt_id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <p className="text-[13px] font-medium text-slate-800 mb-1.5">{item.prompt_text}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(item.engines || {}).map(([engine, info]) => (
                        <span key={engine} className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${info.mentioned ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {engine}{info.mentioned ? ` #${info.rank ?? '-'}` : ' — absent'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
        </div>
      </section>
      )}

      {/* ===== AUDIT TAB ===== */}
      {activeSection === 'audit' && (
      <section id="audit" className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            {selectedPromptId ? `Audit: ${promptDetailData?.prompt_text}` : 'Action Audit'}
          </p>
        </div>
        {globalAuditLoading || promptDetailLoading ? <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div> : (
          <div className="p-5 space-y-4">
            {selectedPromptId ? (
              <div className="rounded-lg bg-red-50 border border-red-100 p-4">
                <p className={`${label} text-red-500 mb-2`}>Critical Gaps</p>
                {(promptDetailData?.audit?.missing || []).length > 0 ? (
                  <ul className="space-y-1.5">
                    {(promptDetailData.audit.missing).map((brand, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Not mentioned: {brand}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-emerald-600 flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4" /> Brand retrieved for this prompt.
                  </p>
                )}
              </div>
            ) : (
              (globalAudit || []).map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 p-5 hover:border-slate-200 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500">{idx+1}</span>
                      <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                      item.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-brand-primary'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className={`${label} mb-1`}>Root Cause</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{item.root_cause}</p>
                    </div>
                    <div>
                      <p className={`${label} text-brand-primary mb-1`}>Solution</p>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">{item.solution}</p>
                    </div>
                  </div>
                  {item.avoid && (
                    <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50/60 border border-red-100 px-3 py-2">
                      <span className="text-[10px] font-semibold text-red-500 shrink-0 mt-px">Avoid:</span>
                      <p className="text-xs text-red-500/80 leading-relaxed">{item.avoid}</p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const t = {
                        source: 'audit',
                        headline: item.title,
                        query: item.title,
                        contentType: 'Article',
                        auditRootCause: item.root_cause,
                        auditSolution: item.solution,
                      };
                      setExecDraftTarget(t);
                      setActiveSection('execute');
                      runExecuteFromTarget(t);
                    }}
                    disabled={isExecuting}
                    className="mt-3 w-full rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                  >
                    Generate Fix Draft
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>
      )}

      {/* ===== EXECUTE TAB ===== */}
      {activeSection === 'execute' && (
        <section id="execute" className="space-y-5">
          <div className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">AI Execution Center</p>
                <p className="text-xs text-slate-400 mt-0.5">Generate publishable drafts from citations and audit fixes.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Engine:</span>
                <select
                  value={selectedActionModel} onChange={(e) => setSelectedActionModel(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-primary focus:outline-none"
                >
                  {availableEngines.filter(e => e.enabled).map(engine => (
                    <option key={engine.id} value={engine.id}>{engine.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className={`${label} flex items-center gap-1.5`}><PlayCircle className="w-3.5 h-3.5" /> Deep Research</p>
                  <button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['deep-analysis', id] });
                      queryClient.invalidateQueries({ queryKey: ['intel-summary', id] });
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-brand-primary transition-colors"
                    disabled={deepAnalysisLoading}
                  >
                    {deepAnalysisLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    {[
                      { checked: execIncludeFaqSchema, set: setExecIncludeFaqSchema, label: 'FAQ + JSON-LD' },
                      { checked: execIncludeComparisonTable, set: setExecIncludeComparisonTable, label: 'Comparison table' },
                      { checked: execIncludePublishChecklist, set: setExecIncludePublishChecklist, label: 'Publish checklist' },
                    ].map((opt) => (
                      <label key={opt.label} className="flex items-center gap-1.5 cursor-pointer text-[12px] font-medium text-slate-600">
                        <input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20" />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${mt}`}>Top domains</p>
                      {deepAnalysis?.search_intel?.enabled ? (
                        (deepAnalysis?.search_intel?.domains || []).length > 0 ? (
                          (deepAnalysis.search_intel.domains || []).slice(0, 4).map((d) => (
                            <div key={d.domain} className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-bold text-slate-800 truncate">{d.domain}</span>
                              <span className="text-[10px] font-black bg-[color:rgba(37,99,235,0.12)] border border-[color:rgba(37,99,235,0.25)] text-brand-primary px-2 py-0.5 rounded-lg">
                                {d.count} citations
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className={`text-sm ${mt}`}>No domain rollup yet. Refresh deep research.</p>
                        )
                      ) : (
                        <p className={`text-sm ${mt}`}>
                          Deep research is off. Enable Perplexity in the backend to populate citation domains.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${mt}`}>Active draft target</p>
                      {effectiveDraftTarget ? (
                        <>
                          <span className="inline-block rounded-lg bg-[color:rgba(37,99,235,0.12)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-primary">
                            {DRAFT_TARGET_LABELS[effectiveDraftTarget.source] || effectiveDraftTarget.source}
                          </span>
                          <div className="text-sm font-bold text-slate-700">{effectiveDraftTarget.headline}</div>
                          <div className="text-xs text-slate-600">
                            Target / intent:{' '}
                            <span className="font-bold text-brand-primary">{effectiveDraftTarget.query}</span>
                          </div>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${mt}`}>
                            Format: {effectiveDraftTarget.contentType || 'Article'}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const t =
                                effectiveDraftTarget.source === 'research' && topRetrievalPoint
                                  ? {
                                      source: 'research',
                                      headline: topRetrievalPoint.title,
                                      query: topRetrievalPoint.query,
                                      contentType: 'Article',
                                      domain: topRetrievalPoint.domain,
                                    }
                                  : effectiveDraftTarget;
                              if (t.source === 'research') setExecDraftTarget(null);
                              runExecuteFromTarget(t);
                            }}
                            className="mt-1 w-full rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:shadow-[0_0_24px_rgba(37,99,235,0.3)] disabled:opacity-50"
                            disabled={isExecuting}
                          >
                            Generate draft for this target
                          </button>
                          {execDraftTarget && topRetrievalPoint ? (
                            <button
                              type="button"
                              onClick={() => setExecDraftTarget(null)}
                              className={`text-[10px] font-black uppercase tracking-widest ${mt} hover:text-brand-primary`}
                            >
                              Use research suggestion instead
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <p className={`text-sm ${mt}`}>
                          No suggestion loaded yet. Run prompts with Perplexity research, use Audit → Generate Fix Draft, or write a custom brief below.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <h4 className={`text-xs font-black uppercase tracking-widest ${mt} px-1 flex items-center gap-2`}>
                  <PlayCircle className="w-4 h-4" /> Recommended Execution Paths
                </h4>

                <div className={`${surf} space-y-3 rounded-2xl border ${brd} p-5`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${mt}`}>Your own brief</p>
                  <p className={`text-xs ${mt}`}>
                    Describe the piece you want (topic, angle, audience). Choose a format — the model will follow your brief instead of a suggested path.
                  </p>
                  <textarea
                    value={customBriefText}
                    onChange={(e) => setCustomBriefText(e.target.value)}
                    rows={4}
                    placeholder='Example: A blog for first-time buyers comparing counter-depth vs standard fridges, with a clear CTA to our buying guide.'
                    className={`min-h-[5.5rem] w-full resize-y rounded-xl border ${brd} bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${mt}`}>Format</span>
                    <select
                      value={customBriefType}
                      onChange={(e) => setCustomBriefType(e.target.value)}
                      className={`rounded-lg border ${brd} bg-white px-2 py-2 text-xs font-bold text-slate-700`}
                    >
                      {EXEC_CONTENT_TYPES.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isExecuting || !customBriefText.trim()}
                      onClick={() => {
                        const brief = customBriefText.trim();
                        const t = {
                          source: 'custom',
                          headline: brief.split('\n')[0].slice(0, 140) || 'Custom brief',
                          query: brief.slice(0, 200),
                          contentType: customBriefType,
                          customBrief: brief,
                        };
                        setExecDraftTarget(t);
                        runExecuteFromTarget(t);
                      }}
                      className="rounded-xl bg-brand-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                    >
                      Generate from brief
                    </button>
                  </div>
                </div>

                {(dashboard?.recommendations?.missing_from_prompts || []).concat(dashboard?.recommendations?.recommendation_text ? [dashboard.recommendations.recommendation_text] : []).map((rec, i) => (
                  <div key={i} className={`group ${surf} p-5 rounded-2xl border ${brd} hover:border-brand-primary transition-all cursor-pointer`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className={`p-2 bg-slate-50 rounded-xl ${mt} group-hover:bg-[color:rgba(37,99,235,0.12)] group-hover:text-brand-primary transition-colors`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex gap-2">
                        {EXEC_CONTENT_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const t = {
                                source: 'path',
                                headline: rec.length > 88 ? `${rec.slice(0, 88)}…` : rec,
                                query: rec,
                                pathRec: rec,
                                contentType: type,
                              };
                              setExecDraftTarget(t);
                              runExecuteFromTarget(t);
                            }}
                            disabled={isExecuting}
                            className={`${surf} border ${brd} hover:border-brand-primary hover:text-brand-primary text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${mt}`}
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

              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 flex flex-col items-center justify-center min-h-[380px] p-6">
                {isExecuting ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary/40" />
                    <p className="text-xs font-medium text-brand-primary animate-pulse">Generating content…</p>
                  </div>
                ) : execContent ? (
                  <div className="w-full h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <p className={`${label}`}>Generated Content</p>
                      <button
                         onClick={() => { navigator.clipboard.writeText(execContent.content); alert('Copied to clipboard!'); }}
                         className="rounded-lg bg-brand-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-600"
                      >
                         Copy
                      </button>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white flex-1 overflow-auto max-h-[480px]">
                      <div className="px-5 py-4 border-b border-slate-100">
                        <h4 className="text-base font-semibold text-slate-800">{execContent.title}</h4>
                      </div>
                      <div className="px-5 py-4 whitespace-pre-wrap text-[13px] text-slate-600 leading-relaxed">
                        {execContent.content}
                      </div>
                    </div>
                    {execContent.placement_advice && (
                      <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                        <p className={`${label} text-brand-primary mb-1`}>Publishing Strategy</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{execContent.placement_advice}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-400 max-w-[220px] mx-auto">
                      Use a draft target, execution path, or your brief to generate content.
                    </p>
                  </div>
                )}

                {execError && (
                  <div className="mt-4 w-full rounded-lg bg-red-50 border border-red-100 px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-red-600">{execError}</p>
                    <button onClick={() => setExecError(null)} className="text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors shrink-0">Dismiss</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== OPPORTUNITIES TAB ===== */}
      {activeSection === 'opportunities' && (
      <div className="space-y-5">
        {deepAnalysisLoading ? (
          <>
            <section id="opportunities" className={`${surf} border ${brd} rounded-xl overflow-hidden animate-pulse`}>
              <div className="px-5 py-3.5 border-b border-slate-100">
                <div className="h-4 w-48 rounded bg-slate-100" />
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-100 p-4">
                    <div className="h-4 w-40 rounded bg-slate-100 mb-2" />
                    <div className="h-3 w-56 rounded bg-slate-100 mb-1" />
                    <div className="h-3 w-44 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            </section>
            <section className={`${surf} border ${brd} rounded-xl p-5 animate-pulse`}>
              <div className="h-4 w-52 rounded bg-slate-100 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-16 rounded-lg bg-slate-50 border border-slate-100" />
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section id="opportunities" className={`${surf} border ${brd} rounded-xl overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Strategic Action Plan</p>
                <p className="text-xs text-slate-400 mt-0.5">Expand any item for a step-by-step execution playbook.</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {(deepAnalysis?.action_plan || []).map((item, idx) => (
                  <ActionPlanCard key={idx} item={item} projectId={id} />
                ))}
              </div>
            </section>

            {deepAnalysis?.search_intel?.enabled && (
              <section className={`${surf} border ${brd} rounded-xl p-6`}>
                <h3 className={`text-lg font-bold ${fg} mb-2`}>Pinpointed Retrieval Points</h3>
                <p className={`text-sm ${mt} mb-4`}>These specific threads, videos, and articles are currently being used as primary data sources by LLMs.</p>
                <div className="space-y-3 mb-6">
                  {(deepAnalysis?.search_intel?.retrieval_points || []).map((item, idx) => (
                    <div key={idx} className="p-3 border border-[color:rgba(37,99,235,0.15)] rounded-lg bg-[color:rgba(37,99,235,0.05)] flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-primary uppercase mb-0.5">{item.domain} &middot; Cited for &quot;{item.query}&quot;</p>
                        <p className={`text-sm font-semibold ${fg} truncate`}>{item.title}</p>
                      </div>
                      <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0 bg-brand-primary text-white px-3 py-1 rounded-md text-xs font-bold hover:shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                  {(deepAnalysis?.search_intel?.retrieval_points || []).length === 0 && (
                    <p className={`text-xs ${mt} italic px-2`}>Run a fresh analysis to identify specific deep links.</p>
                  )}
                </div>

                <h3 className={`text-lg font-bold ${fg} mb-2`}>High-Impact Retrieval Domains</h3>
                <p className={`text-sm ${mt} mb-4`}>Domains frequently used by search-enabled LLMs for your project's niche.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(deepAnalysis?.search_intel?.domains || []).map((item) => (
                    <div key={item.domain} className={`p-3 border ${brd} rounded-lg ${surf} flex items-center justify-between`}>
                      <span className={`text-sm font-medium ${fg}`}>{item.domain}</span>
                      <span className="text-xs bg-[color:rgba(37,99,235,0.10)] text-brand-primary px-2 py-0.5 rounded-full font-bold">{item.count} citations</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      )}

      {/* ===== INVITE TAB ===== */}
      {activeSection === 'invite' && (
      <section id="invite" className={`${surf} border ${brd} rounded-xl p-6`}>
        <h3 className={`text-lg font-bold ${fg} mb-4`}>Invite Collaborator</h3>
        <form
          onSubmit={(event) => { event.preventDefault(); if (!inviteEmail.trim()) return; inviteMutation.mutate(inviteEmail.trim()); }}
          className="flex flex-col md:flex-row gap-3"
        >
          <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@company.com" className={`flex-1 bg-slate-50 border ${brd} rounded-lg px-4 py-2 ${fg} placeholder:text-slate-400 focus:border-brand-primary outline-none transition-colors`} />
          <button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()} className="inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-all">
            {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite
          </button>
        </form>
        <div className="mt-4 text-sm text-slate-600">
          <p className="font-medium">Current collaborators:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            {(project.collaborators || []).map((email) => <li key={email}>{email}</li>)}
            {(project.collaborators || []).length === 0 && <li className={`${mt}`}>No collaborators invited yet.</li>}
          </ul>
        </div>
      </section>
      )}

      {/* ===== TEST PROMPT TAB ===== */}
      {activeSection === 'test' && (
      <section id="test" className={`${surf} border ${brd} rounded-xl p-6`}>
        <h3 className={`text-lg font-bold ${fg} mb-4`}>Test Prompt</h3>
        <form
          onSubmit={(event) => { event.preventDefault(); if (!testQuery.trim()) return; testPromptMutation.mutate({ query: testQuery.trim(), selected_models: testModels }); }}
          className="space-y-3"
        >
          <textarea value={testQuery} onChange={(event) => setTestQuery(event.target.value)} rows={3} placeholder="Type an ad-hoc prompt to test models instantly" className={`w-full bg-slate-50 border ${brd} rounded-lg px-4 py-2 ${fg} placeholder:text-slate-400 focus:border-brand-primary outline-none transition-colors`} />
          <div className="flex flex-wrap gap-2">
            {availableEngines.filter((e) => e.enabled).map((engine) => (
              <button type="button" key={engine.id} onClick={() => toggleTestModel(engine.id)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${testModels.includes(engine.id) ? 'bg-brand-primary text-white border-brand-primary' : `bg-transparent ${mt} ${brd}`}`}>
                {engine.name}
              </button>
            ))}
          </div>
          <button type="submit" disabled={testPromptMutation.isPending || !testQuery.trim()} className="inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-all">
            {testPromptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Test Prompt
          </button>
        </form>

        {testPromptMutation.data && (
          <div className="mt-6 space-y-4">
            {(testPromptMutation.data.results || []).map((result) => (
              <div key={result.engine} className={`border ${brd} rounded-lg p-4`}>
                <p className={`text-xs font-semibold uppercase ${mt}`}>{result.engine}</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap mt-2">{result.response_text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      </div>
      </div>

      {/* ===== SELECTED PROMPT DETAIL PANEL ===== */}
      {selectedPromptId && (
        <section className={`${surf} border ${brd} rounded-xl p-8 mt-8`}>
          <div className={`flex items-center justify-between mb-8 pb-6 border-b ${brd}`}>
            <div>
              <h3 className={`text-sm font-black ${mt} uppercase tracking-[0.2em] mb-1`}>Deep Intelligence Layer</h3>
              <h2 className={`text-2xl font-black ${fg} tracking-tight italic`}>{promptDetailData?.prompt_text}</h2>
            </div>
            <button onClick={() => setSelectedPromptId(null)} className={`p-2 border ${brd} rounded-xl hover:bg-slate-50 ${mt} transition-colors`}>
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>

          {promptDetailLoading ? (
            <div className="py-20 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-primary opacity-20" /></div>
          ) : !promptDetailData ? (
            <p className={`text-sm ${mt} p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed ${brd}`}>No detail found for this prompt.</p>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
                {/* Market Summary */}
                <div className="space-y-6">
                  <div className={`${surf} border ${brd} rounded-2xl p-6`}>
                    <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mt} mb-6 flex items-center gap-2`}>
                      <BarChart2 className="w-4 h-4" /> Market Share & Positioning
                    </h5>
                    <div className="space-y-4">
                      {(promptDetailData.brand_ranking || []).slice(0, 6).map((item) => (
                        <div key={item.name} className={`flex items-center justify-between p-3 rounded-xl transition-all ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'bg-[color:rgba(37,99,235,0.08)] border border-[color:rgba(37,99,235,0.2)]' : 'hover:bg-slate-50'}`}>
                          <span className={`font-bold ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'text-brand-primary' : fg}`}>{item.name}</span>
                          <div className="flex items-center gap-4">
                            <span className={`text-[10px] font-black ${mt} uppercase`}>{item.mentions} Citations</span>
                            <span className={`tabular-nums font-black text-sm ${item.avg_rank === 1 ? 'text-yellow-400' : mt}`}>#{item.avg_rank ?? '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${surf} border ${brd} rounded-2xl p-6`}>
                    <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mt} mb-6`}>Model Sentiment Profile</h5>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                        <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Positive</p>
                        <p className="text-xl font-black text-emerald-400">{promptDetailData.sentiment?.positive ?? 0}</p>
                      </div>
                      <div className={`p-3 bg-slate-50 rounded-2xl border ${brd}`}>
                        <p className={`text-[9px] font-black uppercase ${mt} mb-1`}>Neutral</p>
                        <p className={`text-xl font-black ${fg}`}>{promptDetailData.sentiment?.neutral ?? 0}</p>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                        <p className="text-[9px] font-black uppercase text-red-400 mb-1">Negative</p>
                        <p className="text-xl font-black text-red-400">{promptDetailData.sentiment?.negative ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Layer */}
                <div className={`border border-[color:rgba(37,99,235,0.2)] rounded-2xl p-8 bg-[color:rgba(37,99,235,0.03)] overflow-hidden relative border-t-4 border-t-brand-primary`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                  <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mb-8 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Detailed Strategic Audit
                  </h5>
                  <div className="space-y-6">
                    {(promptDetailData.audit || []).map((item, idx) => (
                      <div key={idx} className={`group p-5 bg-slate-50 border ${brd} rounded-2xl transition-all hover:bg-white`}>
                        <div className="flex items-center justify-between mb-4">
                          <h6 className={`font-extrabold ${fg} text-sm tracking-tight`}>{item.title}</h6>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                            item.priority === 'high' ? 'bg-red-500/15 text-red-400' : 'bg-[color:rgba(37,99,235,0.12)] text-brand-primary'
                          }`}>
                            {item.priority}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className={`text-[10px] uppercase font-black tracking-widest ${mt} flex items-center gap-1.5 opacity-60`}>
                              <span className="w-1 h-1 rounded-full bg-slate-400" /> Root Cause
                            </p>
                            <p className="text-xs text-slate-500 leading-relaxed font-semibold italic">
                              {renderTextWithLinks(item.root_cause || item.detail)}
                            </p>
                          </div>
                          <div className={`pl-4 border-l ${brd} space-y-1`}>
                            <p className="text-[10px] uppercase font-black tracking-widest text-brand-primary flex items-center gap-1.5 opacity-60">
                              <span className="w-1 h-1 rounded-full bg-brand-primary" /> Tactical Solution
                            </p>
                            <p className={`text-xs ${fg} leading-relaxed font-black`}>{renderTextWithLinks(item.solution)}</p>
                          </div>
                        </div>
                        {item.avoid && (
                          <div className={`mt-4 pt-3 border-t ${brd} flex items-start gap-2`}>
                            <Trash2 className="w-3.5 h-3.5 text-red-400/50 mt-0.5" />
                            <p className="text-[10px] font-black text-red-400/60 uppercase tracking-tighter italic">Avoid: {item.avoid}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommended Execution Steps */}
              <div className="border border-[color:rgba(37,99,235,0.2)] rounded-2xl p-8 bg-[color:rgba(37,99,235,0.04)] border-l-4 border-l-brand-primary">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary mb-8 flex items-center gap-3">
                  <PlayCircle className="w-6 h-6" /> Recommended Execution Steps
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(promptDetailData.recommended_actions || []).map((item, idx) => (
                    <div key={idx} className={`${surf} p-6 rounded-2xl border ${brd} transition-all hover:border-[color:rgba(37,99,235,0.3)] group flex flex-col justify-between`}>
                      <div>
                        <h6 className={`font-black ${fg} text-sm mb-2 group-hover:text-brand-primary transition-colors`}>{item.title}</h6>
                        <p className={`text-xs ${mt} mt-1 mb-6 leading-relaxed font-semibold italic`}>
                          {renderTextWithLinks(item.detail)}
                        </p>
                      </div>
                      {item.link ? (
                        <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-brand-primary bg-[color:rgba(37,99,235,0.08)] px-5 py-3 rounded-xl border border-[color:rgba(37,99,235,0.2)] hover:border-brand-primary overflow-hidden transition-all group/btn">
                          Execute Strategy <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cited Sources */}
              <div className={`${surf} border ${brd} rounded-2xl p-8`}>
                <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mt} mb-8 flex items-center gap-2`}>
                  <FileText className="w-4 h-4" /> Cited Sources & Knowledge Points
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(promptDetailData.sources || []).slice(0, 30).map((source) => (
                    <details key={source.domain} className={`group ${surf} border ${brd} rounded-2xl transition-all hover:border-[color:rgba(37,99,235,0.2)] overflow-hidden h-fit`}>
                      <summary className={`cursor-pointer py-4 px-5 flex items-center justify-between hover:bg-slate-50 list-none`}>
                        <span className="flex items-center gap-3">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${source.domain.split(' ')[0]}&sz=32`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className={`${source.domain.includes('(Target Content)') ? 'font-black text-brand-primary' : `font-bold ${fg}`} text-sm truncate max-w-[140px]`}>
                            {source.domain}
                          </span>
                        </span>
                        <span className={`text-[10px] font-black border ${brd} px-2 py-1 rounded-lg ${mt} group-hover:text-brand-primary group-hover:border-[color:rgba(37,99,235,0.2)] transition-all uppercase tracking-tighter`}>{source.mentions || 0} Hits</span>
                      </summary>
                      <ul className={`px-5 pb-5 pt-3 space-y-4 border-t ${brd} bg-slate-50`}>
                        {(source.links || []).map((linkObj, lIdx) => (
                          <li key={(linkObj.url || '') + lIdx} className="flex flex-col gap-2 group/link">
                            {linkObj.title && (
                              <span className={`text-[11px] font-black text-slate-700 leading-snug group-hover/link:text-brand-primary transition-colors`}>{linkObj.title}</span>
                            )}
                            <div className={`flex items-center gap-2 overflow-hidden ${surf} p-2.5 rounded-xl border ${brd} transition-all`}>
                              <ExternalLink className={`w-3 h-3 ${mt} shrink-0`} />
                              <a href={linkObj.url} target="_blank" rel="noreferrer" className={`text-[10px] font-bold ${mt} hover:text-brand-primary truncate`} title={linkObj.url}>
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
              <div className={`${surf} border ${brd} rounded-2xl p-8`}>
                <h5 className={`text-[10px] font-black uppercase tracking-[0.3em] ${mt} mb-8 border-b ${brd} pb-4`}>
                  Synthetic Intelligence Drifts (Raw Logs)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {(reportData?.responses || []).filter(r => r.engine !== 'perplexity_research').slice(0, 10).map((response) => (
                    <div key={response.id} className="relative group">
                      <div className={`absolute -left-6 top-0 h-full w-[2px] bg-slate-200 group-hover:bg-brand-primary transition-colors`} />
                      <p className={`text-[10px] font-black uppercase tracking-widest ${mt} mb-3 group-hover:text-brand-primary`}>{response.engine}</p>
                      <p className={`text-xs text-slate-500 whitespace-pre-wrap leading-relaxed font-bold italic p-6 ${surf} rounded-2xl border ${brd}`}>&quot;{response.response_text}&quot;</p>
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
