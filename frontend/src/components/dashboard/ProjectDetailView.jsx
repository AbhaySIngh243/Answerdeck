import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
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
  History,
  Info,
  AlertTriangle,
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
  TrendingDown,
  TrendingUp,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react';

import { api, downloadFile } from '../../lib/api';
import { mergeSourcesByDomainKey } from '../../lib/mergeSources';
import SourcesPieChart from './SourcesPieChart';
import OverviewKpiGrid from './sections/OverviewKpiGrid';
import PerformancePanel from './sections/PerformancePanel';
import PromptPerformanceTable from './sections/PromptPerformanceTable';
import CompetitorSnapshot from './sections/CompetitorSnapshot';
import TopCitingSources from './sections/TopCitingSources';
import CoverageBadge, { CoverageEmptyState, isInsufficient } from './sections/CoverageBadge';
import { Button } from '../ui/button';
import FormattedProse, { ProseText } from '../ui/FormattedProse';
import { sanitizeProse } from '../../lib/sanitizeProse';

const SECTION_IDS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { id: 'prompts', label: 'Prompts', icon: Search },
  { id: 'competitors', label: 'Competitors', icon: Users },
  { id: 'sources', label: 'Sources', icon: Globe },
  { id: 'execute', label: 'Content Studio', icon: Zap },
  { id: 'opportunities', label: 'Opportunities', icon: Sparkles },
];

const lbl = 'text-[11px] font-semibold text-slate-400';

function isHttpUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
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
  const s = sanitizeProse(text);
  if (!s) return { prose: '', urls: [] };
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
  const s = sanitizeProse(text);
  if (!s) return null;
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

  const detailText = item.detail || (Array.isArray(item.action_plan) ? item.action_plan.join(' ') : '');
  const { prose, urls } = useMemo(() => splitProseAndUrls(detailText), [detailText]);
  const nResponsesSupporting = Number(item.n_responses_supporting || 0);
  const nEnginesSupporting = Number(item.n_engines_supporting || 0);
  const evidenceBasis = String(item.evidence_basis || '').trim();
  const evidenceQuote = sanitizeProse(item.evidence_quote);

  return (
    <div className="glass-card-v2 overflow-hidden transition-shadow hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <ProseText text={item.title} as="h4" className="text-[13px] font-semibold leading-snug text-slate-800" />
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.priority === 'high' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-600'}`}>
            {item.priority}
          </span>
        </div>
        {item.trigger_signal && <p className="mb-2 text-[11px] text-slate-500"><span className="font-semibold text-slate-600">Signal:</span> {sanitizeProse(item.trigger_signal)}</p>}
        {prose && <p className="mb-2 text-xs leading-relaxed text-slate-500">{prose}</p>}
        {Array.isArray(item.action_plan) && item.action_plan.length > 0 && (
          <ul className="mb-2 list-disc space-y-1 pl-5 text-[11px] text-slate-700">
            {item.action_plan.slice(0, 4).map((step, idx) => <li key={`${idx}-${step}`}>{sanitizeProse(step)}</li>)}
          </ul>
        )}
        {evidenceQuote && (
          <blockquote className="mb-2 border-l-2 border-brand-primary/40 bg-slate-50/70 px-3 py-2 text-xs italic leading-relaxed text-slate-600">
            &ldquo;{evidenceQuote}&rdquo;
          </blockquote>
        )}
        {(evidenceBasis || nResponsesSupporting > 0 || item.source_count) && (
          <p className="mb-1 text-[10px] text-slate-400">
            {evidenceBasis
              ? evidenceBasis
              : nResponsesSupporting > 0
                ? `Based on ${nResponsesSupporting} answer${nResponsesSupporting === 1 ? '' : 's'}${nEnginesSupporting ? ` across ${nEnginesSupporting} engine${nEnginesSupporting === 1 ? '' : 's'}` : ''}`
                : item.source_count
                  ? `${item.source_count} sources`
                  : null}
          </p>
        )}
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
              <p className="text-xs text-slate-400">Loading steps…</p>
            </div>
          ) : playbook ? (
            <div className="space-y-4 p-5">
              {playbook.why_it_matters && (
                <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/15 p-3.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-brand-primary"><Lightbulb className="h-3 w-3" /> Why this matters</p>
                  <ProseText text={playbook.why_it_matters} className="text-xs leading-relaxed text-slate-700" />
                </div>
              )}
              <div>
                <p className={`${lbl} mb-2`}>Steps</p>
                <ol className="space-y-2.5">
                  {toArray(playbook.steps).map((step, si) => (
                    <li key={si} className="rounded-xl border border-slate-100 bg-white p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-semibold text-white">{si + 1}</span>
                        <div className="min-w-0">
                          <ProseText text={step.title} className="mb-0.5 text-[13px] font-medium text-slate-800" />
                          <ProseText text={step.detail} className="text-xs leading-relaxed text-slate-500" />
                          {step.example && (
                            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs italic text-slate-500">
                              <span className="mr-1 not-italic font-medium text-slate-600">Example:</span>
                              {sanitizeProse(step.example)}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              {toArray(playbook.quick_wins).length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-brand-primary"><Zap className="h-3 w-3" /> Quick wins</p>
                  <div className="space-y-2">{toArray(playbook.quick_wins).map((qw, qi) => (<div key={qi} className="rounded-xl border border-brand-primary/10 bg-brand-primary/[0.04] px-3.5 py-2.5"><ProseText text={qw.title} className="mb-0.5 text-xs font-medium text-brand-primary" /><ProseText text={qw.detail} className="text-xs leading-relaxed text-slate-600" /></div>))}</div>
                </div>
              )}
              {toArray(playbook.common_mistakes).length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><ShieldAlert className="h-3 w-3" /> Avoid</p>
                  <div className="space-y-2">{toArray(playbook.common_mistakes).map((cm, ci) => (<div key={ci} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"><ProseText text={cm.title} className="mb-0.5 text-xs font-medium text-slate-700" /><ProseText text={cm.detail} className="text-xs leading-relaxed text-slate-600" /></div>))}</div>
                </div>
              )}
              {toArray(playbook.tools_mentioned).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-medium text-slate-400">Tools:</span>
                  {toArray(playbook.tools_mentioned).map((tool) => (<span key={tool} className="rounded-lg border border-slate-100 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">{tool}</span>))}
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
  const location = useLocation();
  const queryClient = useQueryClient();

  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptModels, setNewPromptModels] = useState([]);
  const [runningPrompts, setRunningPrompts] = useState({});
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashChartMode, setDashChartMode] = useState('7d');
  const [showGlossary, setShowGlossary] = useState(false);
  const [improveTarget, setImproveTarget] = useState(null); // {prompt_id, prompt_text}
  const deepIntelRef = useRef(null);

  // Track active polling jobs to allow cleanup and prevent memory leaks
  const activePollsRef = useRef(new Map());
  const launchJobsHandledRef = useRef(false);
  const MAX_POLL_ATTEMPTS = 120; // 5 minutes at 2.5s intervals

  const { data: projectCore, isLoading: coreLoading, error: coreError } = useQuery({
    queryKey: ['project-core', id],
    queryFn: async () => {
      const [projectRes, promptsRes, enginesRes] = await Promise.allSettled([
        api.getProject(id),
        api.getPrompts(id),
        api.getEngines(),
      ]);
      if (projectRes.status === 'rejected') throw projectRes.reason;
      const engines = enginesRes.status === 'fulfilled' ? enginesRes.value : {};
      const prompts = promptsRes.status === 'fulfilled' ? promptsRes.value : [];
      return {
        project: projectRes.value,
        prompts,
        enabledEngines: toArray(engines.enabled_engines),
        availableEngines: toArray(engines.available_engines),
        searchLayer: engines.search_layer || {},
      };
    },
    staleTime: 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * Math.pow(2, attempt), 10_000),
  });

  const { data: dashboardMetrics, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['project-dashboard', id],
    queryFn: () => api.getProjectDashboard(id),
    enabled: Boolean(id) && Boolean(projectCore?.project),
    staleTime: 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * Math.pow(2, attempt), 10_000),
  });

  const projectData = useMemo(() => {
    if (!projectCore) return null;
    return { ...projectCore, dashboard: dashboardMetrics || null };
  }, [projectCore, dashboardMetrics]);

  const isLoading = coreLoading;
  const error = coreError;

  const { data: billing } = useQuery({
    queryKey: ['billing', 'me'],
    queryFn: api.getBillingMe,
    staleTime: 60_000,
  });

  const effectiveSearchProvider = useMemo(() => {
    const p = projectData?.searchLayer?.provider;
    const s = String(p ?? 'auto').trim();
    return s || 'auto';
  }, [projectData?.searchLayer?.provider]);

  const primaryLoaded = Boolean(projectData);
  const needsPromptAnalysis = activeSection === 'dashboard' || activeSection === 'prompts';
  const needsDeepAnalysis = activeSection === 'opportunities' || activeSection === 'execute';
  // Keep tab queries scoped; project-level sources are prefetched below after the primary data loads.
  const needsSourcesIntel = primaryLoaded && (activeSection === 'sources' || Boolean(selectedPromptId));
  const needsCompetitorIntel = primaryLoaded && activeSection === 'competitors';

  const { data: promptAnalysis, isLoading: promptAnalysisLoading, error: promptAnalysisError } = useQuery({ queryKey: ['prompt-analysis', id], queryFn: () => api.getPromptAnalysis(id), enabled: Boolean(id) && primaryLoaded && needsPromptAnalysis, staleTime: 60_000, retry: 2 });
  const { data: deepAnalysis, isLoading: deepAnalysisLoading } = useQuery({ queryKey: ['deep-analysis', id], queryFn: () => api.getDeepAnalysis(id), enabled: Boolean(id) && needsDeepAnalysis, staleTime: 60_000, retry: 1 });
  const { data: sourcesIntel, isLoading: sourcesIntelLoading } = useQuery({ queryKey: ['sources-intelligence', id], queryFn: () => api.getSourcesIntelligence(id), enabled: needsSourcesIntel, staleTime: 60_000, retry: 2 });
  const { data: competitorIntel, isLoading: competitorIntelLoading } = useQuery({ queryKey: ['competitor-intelligence', id], queryFn: () => api.getCompetitorIntelligence(id), enabled: needsCompetitorIntel, staleTime: 60_000, retry: 2 });
  const { data: promptDetailData, isLoading: promptDetailLoading, isError: promptDetailIsError, error: promptDetailError } = useQuery({
    queryKey: ['prompt-detail', selectedPromptId],
    queryFn: () => api.getPromptDetail(selectedPromptId),
    enabled: Boolean(selectedPromptId),
    retry: 0,
  });

  const mergedSourcesRows = useMemo(() => {
    const fromPrompt = selectedPromptId && Array.isArray(promptDetailData?.sources) && promptDetailData.sources.length > 0 ? promptDetailData.sources : null;
    const raw = toArray(fromPrompt ?? sourcesIntel?.domains);
    const normalized = raw.slice(0, 20).map((row) => {
      const linkObjs = Array.isArray(row.links) ? row.links : [];
      const normalizedLinks = linkObjs.map((l) => { if (typeof l === 'string') return { url: l.trim(), title: '' }; if (!l || typeof l !== 'object') return null; const url = String(l.url || '').trim(); if (!url || !isHttpUrl(url)) return null; return { url, title: String(l.title || '').trim() }; }).filter(Boolean);
      return { domain: row.domain, source_mentions: Number(row.source_mentions ?? row.mentions) || 0, links: normalizedLinks };
    });
    return mergeSourcesByDomainKey(normalized);
  }, [selectedPromptId, promptDetailData?.sources, sourcesIntel?.domains]);
  const contextState = useMemo(
    () => (
      projectData?.dashboard?.context_state ||
      deepAnalysis?.context_state ||
      sourcesIntel?.context_state ||
      { context_ready: true }
    ),
    [projectData?.dashboard?.context_state, deepAnalysis?.context_state, sourcesIntel?.context_state]
  );

  const competitorDisplayRows = useMemo(() => {
    const rows = toArray(competitorIntel?.rows).map((r) => ({
      ...r,
      __vis: Number(r?.visibility_pct ?? r?.visibility ?? 0) || 0,
    }));
    rows.sort((a, b) => {
      const diff = Number(b.__vis) - Number(a.__vis);
      if (diff !== 0) return diff;
      return String(a?.brand ?? '').localeCompare(String(b?.brand ?? ''));
    });
    return rows;
  }, [competitorIntel?.rows]);

  const competitorTopRows = useMemo(() => competitorDisplayRows.slice(0, 20), [competitorDisplayRows]);
  const competitorMaxVis = useMemo(
    () => Math.max(...competitorTopRows.map((r) => Number(r?.__vis ?? r?.visibility_pct ?? r?.visibility ?? 0) || 0), 1),
    [competitorTopRows]
  );
  const { data: intelSummary, isLoading: intelSummaryLoading, error: intelSummaryError } = useQuery({ queryKey: ['intel-summary', id], queryFn: () => api.getIntelSummary(id), enabled: Boolean(id) && primaryLoaded && activeSection === 'dashboard' && !selectedPromptId, staleTime: 60_000, retry: 2 });
  const { data: globalAudit, isLoading: globalAuditLoading, error: globalAuditError } = useQuery({ queryKey: ['global-audit', id], queryFn: () => api.getGlobalAudit(id), enabled: Boolean(id) && primaryLoaded && activeSection === 'dashboard' && !selectedPromptId, staleTime: 60_000, retry: 2 });
  const { data: movements, isLoading: movementsLoading } = useQuery({ queryKey: ['movements', id], queryFn: () => api.getMovements(id), enabled: Boolean(id) && primaryLoaded && activeSection === 'dashboard' && !selectedPromptId, staleTime: 60_000, retry: 1 });
  const { data: citationEconomics, isLoading: citationEconomicsLoading } = useQuery({ queryKey: ['citation-economics', id], queryFn: () => api.getCitationEconomics(id), enabled: Boolean(id) && primaryLoaded && activeSection === 'dashboard' && !selectedPromptId, staleTime: 60_000, retry: 1 });

  const sessionExpired = useMemo(() => {
    const candidates = [error, dashboardError, intelSummaryError, globalAuditError, promptAnalysisError];
    return candidates.some((err) => {
      const msg = String(err?.message || '').toLowerCase();
      return err?.status === 401 || msg.includes('401') || msg.includes('unauthorized') || msg.includes('session expired');
    });
  }, [error, dashboardError, intelSummaryError, globalAuditError, promptAnalysisError]);

  useEffect(() => {
    if (!id || !primaryLoaded) return;
    queryClient.prefetchQuery({
      queryKey: ['sources-intelligence', id],
      queryFn: () => api.getSourcesIntelligence(id),
      staleTime: 60_000,
    });
  }, [id, primaryLoaded, queryClient]);

  useEffect(() => {
    setActiveSection((prev) => (prev === 'audit' ? 'dashboard' : prev));
  }, []);

  // Cleanup active polls when component unmounts
  useEffect(() => {
    return () => {
      // Cancel all active polling timeouts
      activePollsRef.current.forEach((poll) => {
        if (poll.timeoutId) {
          clearTimeout(poll.timeoutId);
        }
      });
      activePollsRef.current.clear();
    };
  }, []);

  const modelIdToName = useMemo(() => {
    const engines = toArray(projectData?.availableEngines);
    return Object.fromEntries(engines.map((e) => [e.id, e.name]));
  }, [projectData?.availableEngines]);

  const coverageSnapshot = useMemo(() => {
    if (!projectData?.dashboard || !projectData?.project) return null;
    const d = projectData.dashboard;
    const proms = toArray(projectData.prompts);
    const rankings = toArray(d.prompt_rankings);
    const total = Math.max(proms.length, rankings.length, 1);
    const withRank = rankings.filter((r) => r.avg_rank != null).length;
    const vis = d.visibility_pct_current;
    const share = vis != null && Number.isFinite(Number(vis)) ? `${Math.round(Number(vis))}%` : '—';
    const competitors = toArray(d.competitors);
    const focus = (projectData.project.name || '').toLowerCase().trim();
    const sorted = [...competitors].sort((a, b) => (Number(b.visibility_pct ?? b.visibility ?? 0)) - (Number(a.visibility_pct ?? a.visibility ?? 0)));
    let topPos = '—';
    const idx = sorted.findIndex((c) => String(c.brand || '').toLowerCase().trim() === focus);
    if (idx >= 0) topPos = `#${idx + 1} of ${sorted.length}`;
    else if (sorted.length) topPos = 'Not ranked';
    const focusRow = sorted[idx >= 0 ? idx : -1];
    const focusRank = focusRow && focusRow.avg_rank != null ? Number(focusRow.avg_rank) : null;
    const prominence = focusRank == null
      ? null
      : focusRank <= 2.5
        ? 'usually listed near the top'
        : focusRank <= 4.5
          ? `usually listed mid-pack (~#${focusRank.toFixed(0)})`
          : `usually listed low (~#${focusRank.toFixed(0)})`;
    return {
      queriesLine: `Listed in a ranked order in ${withRank} of ${total} prompt${total === 1 ? '' : 's'}`,
      shareLine: `Named in about ${share} of model answers we measured`,
      topCompetitorLine: prominence
        ? `By how often you're named you rank ${topPos} — but ${prominence}`
        : `By how often you're named you rank ${topPos}`,
    };
  }, [projectData]);

  const dashboardIntelLayout = useMemo(() => {
    if (intelSummary) {
      const eb = intelSummary.executive_bullets;
      let happening = '';
      if (Array.isArray(eb) && eb.length) {
        happening = String(eb[0]).trim();
      } else if (intelSummary.executive_summary) {
        const s = String(intelSummary.executive_summary).trim();
        const first = s.split(/(?<=[.!?])\s+/)[0];
        happening = (first && first.length <= 280 ? first : s.slice(0, 220)).trim();
      }
      const promptEchoes = new Set(
        toArray(projectData?.prompts)
          .map((p) => String(p?.prompt_text || '').trim().toLowerCase())
          .filter(Boolean),
      );
      const fromRoadmap = toArray(intelSummary.strategic_roadmap)
        .map((step) => String(step.action || '').trim())
        .filter(Boolean);
      const fromBullets = Array.isArray(intelSummary.executive_bullets)
        ? intelSummary.executive_bullets.slice(1).map((b) => String(b).trim()).filter(Boolean)
        : [];
      const seen = new Set();
      const priorities = [];
      for (const t of [...fromRoadmap, ...fromBullets]) {
        const k = t.toLowerCase();
        if (!k || seen.has(k)) continue;
        if (promptEchoes.has(k)) continue;
        seen.add(k);
        priorities.push(t);
        if (priorities.length >= 5) break;
      }
      const losing = toArray(intelSummary.competitive_threats)
        .map((t) => String(t).trim())
        .filter((t) => t && !promptEchoes.has(t.toLowerCase()));
      return { happening, priorities, losing, fromIntel: true };
    }
    const dash = projectData?.dashboard;
    if (!dash) return null;
    const vis = dash.visibility_pct_current;
    const visText = vis != null ? `${vis}% visibility across measured answers` : 'Measured dashboard data is available';
    return {
      happening: `${projectData?.project?.name || 'Your brand'}: ${visText}.`,
      priorities: [],
      losing: [],
      fromIntel: false,
    };
  }, [intelSummary, projectData?.prompts, projectData?.dashboard, projectData?.project?.name]);

  const [expandedCompetitor, setExpandedCompetitor] = useState({});
  const [execContent, setExecContent] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedActionModel, setSelectedActionModel] = useState('gemini');
  const [execError, setExecError] = useState(null);
  const [execIncludeFaqSchema, setExecIncludeFaqSchema] = useState(true);
  const [execIncludeComparisonTable, setExecIncludeComparisonTable] = useState(true);
  const [execIncludePublishChecklist, setExecIncludePublishChecklist] = useState(true);
  const [execDraftTarget, setExecDraftTarget] = useState(null);
  const [customBriefText, setCustomBriefText] = useState('');
  const [customBriefType, setCustomBriefType] = useState('Article');

  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exportLoading, setExportLoading] = useState(null);
  const [exportError, setExportError] = useState(null);

  const handleExport = useCallback(
    async (format) => {
      const proj = projectData?.project;
      if (!proj) return;
      setExportLoading(format);
      setExportError(null);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const safeName = (proj.name || 'dashboard').replace(/\s+/g, '_');
        if (format === 'pdf') {
          await downloadFile(
            `/reports/project/${id}/export.pdf${qs}`,
            `${safeName}_full_report.pdf`,
          );
        } else {
          await downloadFile(
            `/reports/project/${id}/export.csv${qs}`,
            `${safeName}_full_report.csv`,
          );
        }
        setShowDatePicker(false);
      } catch (err) {
        setExportError(
          err?.status >= 500
            ? 'The server is warming up or processing a large report. Please wait a moment and try again.'
            : (err.message || 'Export failed. Please retry.'),
        );
      } finally {
        setExportLoading(null);
      }
    },
    [id, projectData?.project, dateFrom, dateTo],
  );

  const applyExecOptionsToDirective = (directiveText) => {
    const lines = [directiveText];
    if (execIncludeFaqSchema) lines.push('Requirements: include an FAQ section and provide JSON-LD FAQ schema markup (where possible).');
    if (execIncludeComparisonTable) lines.push('Requirements: include at least one structured comparison table (targets, key specs, and decision criteria).');
    if (execIncludePublishChecklist) lines.push('Requirements: end with a publish checklist (what to add to the page, recommended anchor text, and internal linking notes).');
    return lines.join('\n');
  };

  const executeActionMutation = useMutation({ mutationFn: (data) => api.executeAction(id, data), onSuccess: (res) => { setExecContent(res); setIsExecuting(false); setExecError(null); }, onError: (err) => { setIsExecuting(false); setExecError(err.message || 'Failed to generate content.'); } });

  const refreshAll = async () => {
    const keys = [
      ['project', id],
      ['project-core', id],
      ['project-dashboard', id],
      ['billing', 'me'],
      ['reports-overview'],
      ['prompts', id],
      ['prompt-analysis', id],
      ['deep-analysis', id],
      ['sources-intelligence', id],
      ['competitor-intelligence', id],
      ['citation-economics', id],
      ['intel-summary', id],
      ['global-audit', id],
      ['movements', id],
    ];
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };

  const analyzePromptMutation = useMutation({
    mutationFn: async (payload) => { const created = await api.createPrompt(id, payload); const run = await api.runPromptAnalysis(created.id, { searchProvider: effectiveSearchProvider }); return { promptId: created.id, jobId: run.job_id }; },
    onSuccess: ({ promptId, jobId }) => {
      setSelectedPromptId(promptId);
      setRunningPrompts((prev) => ({ ...prev, [promptId]: true }));
      setNewPromptText('');
      setNewPromptModels([]);
      // Register and start polling for this job
      if (jobId) {
        activePollsRef.current.set(jobId, { timeoutId: null, promptId });
        pollJobStatus(jobId, promptId, 1);
      }
      requestAnimationFrame(() => deepIntelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    },
  });

  const deletePromptMutation = useMutation({ mutationFn: api.deletePrompt, onSuccess: refreshAll });
  const runPromptMutation = useMutation({
    mutationFn: (promptId) => api.runPromptAnalysis(promptId, { searchProvider: effectiveSearchProvider }),
    onSuccess: (payload, promptId) => {
      if (!payload?.job_id) { refreshAll(); return; }
      setRunningPrompts((prev) => ({ ...prev, [promptId]: true }));
      // Register this poll so we can clean it up later
      activePollsRef.current.set(payload.job_id, { timeoutId: null, promptId });
      pollJobStatus(payload.job_id, promptId, 1);
    },
  });
  const runAllMutation = useMutation({
    mutationFn: (projectId) => api.runAllPromptAnalysis(projectId, { searchProvider: effectiveSearchProvider }),
    onSuccess: (payload) => {
      const jobs = Array.isArray(payload?.results) ? payload.results : [];
      if (jobs.length === 0) { refreshAll(); return; }
      jobs.forEach((item) => {
        setRunningPrompts((prev) => ({ ...prev, [item.prompt_id]: true }));
        // Register this poll so we can clean it up later
        activePollsRef.current.set(item.job_id, { timeoutId: null, promptId: item.prompt_id });
        pollJobStatus(item.job_id, item.prompt_id, 1);
      });
    },
  });

  const pollJobStatus = useCallback(async (jobId, promptId, attempt = 1) => {
    // Stop if we've exceeded max attempts
    if (attempt > MAX_POLL_ATTEMPTS) {
      setRunningPrompts((prev) => ({ ...prev, [promptId]: false }));
      activePollsRef.current.delete(jobId);
      return;
    }

    // Stop if this poll was cancelled (component unmount or new poll started)
    if (!activePollsRef.current.has(jobId)) {
      return;
    }

    try {
      const data = await api.getJobStatus(jobId);

      if (data.status === 'completed') {
        setRunningPrompts((prev) => ({ ...prev, [promptId]: false }));
        activePollsRef.current.delete(jobId);
        // Invalidate all relevant caches to ensure fresh data
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['project', id] }),
          queryClient.invalidateQueries({ queryKey: ['project-core', id] }),
          queryClient.invalidateQueries({ queryKey: ['project-dashboard', id] }),
          queryClient.invalidateQueries({ queryKey: ['prompts', id] }),
          queryClient.invalidateQueries({ queryKey: ['prompt-analysis', id] }),
          queryClient.invalidateQueries({ queryKey: ['prompt-detail', promptId] }),
          queryClient.invalidateQueries({ queryKey: ['deep-analysis', id] }),
          queryClient.invalidateQueries({ queryKey: ['sources-intelligence', id] }),
          queryClient.invalidateQueries({ queryKey: ['competitor-intelligence', id] }),
          queryClient.invalidateQueries({ queryKey: ['citation-economics', id] }),
          queryClient.invalidateQueries({ queryKey: ['intel-summary', id] }),
          queryClient.invalidateQueries({ queryKey: ['global-audit', id] }),
          queryClient.invalidateQueries({ queryKey: ['movements', id] }),
        ]);
        return;
      }

      if (data.status === 'failed') {
        setRunningPrompts((prev) => ({ ...prev, [promptId]: false }));
        activePollsRef.current.delete(jobId);
        return;
      }

      // Still pending/running - schedule next poll
      const timeoutId = setTimeout(() => {
        pollJobStatus(jobId, promptId, attempt + 1);
      }, 2500);

      // Store timeout ID so we can cancel on cleanup
      activePollsRef.current.set(jobId, { timeoutId, promptId });
    } catch (err) {
      // On error, stop polling for this job
      setRunningPrompts((prev) => ({ ...prev, [promptId]: false }));
      activePollsRef.current.delete(jobId);
      // eslint-disable-next-line no-console
      console.error(`Job polling error for ${jobId}:`, err);
    }
  }, [id, queryClient]);

  useEffect(() => {
    if (launchJobsHandledRef.current) return;

    const jobs = Array.isArray(location.state?.analysisJobs)
      ? location.state.analysisJobs
      : [];
    const validJobs = jobs.filter((item) => item?.job_id && item?.prompt_id);
    if (validJobs.length === 0) return;

    launchJobsHandledRef.current = true;
    validJobs.forEach((item) => {
      setRunningPrompts((prev) => ({ ...prev, [item.prompt_id]: true }));
      activePollsRef.current.set(item.job_id, { timeoutId: null, promptId: item.prompt_id });
      pollJobStatus(item.job_id, item.prompt_id, 1);
    });
  }, [location.state, pollJobStatus]);

  useEffect(() => {
    let active = true;
    const loadBackgroundJobs = async () => {
      if (!id) return;
      try {
        const res = await api.getProjectJobs(id);
        if (!active) return;
        const jobs = Array.isArray(res?.jobs) ? res.jobs : [];
        const runningOrPending = jobs.filter(
          (j) => (j.status === 'running' || j.status === 'pending') && j.job_id && j.prompt_id
        );
        runningOrPending.forEach((item) => {
          if (!activePollsRef.current.has(item.job_id)) {
            setRunningPrompts((prev) => ({ ...prev, [item.prompt_id]: true }));
            activePollsRef.current.set(item.job_id, { timeoutId: null, promptId: item.prompt_id });
            pollJobStatus(item.job_id, item.prompt_id, 1);
          }
        });
      } catch (err) {
        console.error('Failed to load active background jobs:', err);
      }
    };
    loadBackgroundJobs();
    
    const timer = setInterval(loadBackgroundJobs, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, pollJobStatus]);

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm text-slate-400">Loading project…</p>
      </div>
    );
  }

  if (error || !projectData) {
    const msg = error?.message || 'Failed to load project';
    const isAuth = msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('401') || msg.toLowerCase().includes('unauthorized');
    return (
      <div className="glass-card-v2 border-red-200/60 bg-red-50/60 p-6 text-sm">
        <p className="font-semibold text-red-700">
          {isAuth ? 'Session expired — please refresh the page' : 'Failed to load project'}
        </p>
        <p className="mt-1 text-xs text-red-500">{msg}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90"
        >
          Refresh page
        </button>
      </div>
    );
  }

  const { project, prompts, dashboard, enabledEngines, availableEngines } = projectData;
  const maxPromptsPerProject = billing?.limits?.max_prompts_per_project ?? 3;
  const atPromptLimit = (prompts?.length ?? 0) >= maxPromptsPerProject;

  const runExecuteFromTarget = (target) => {
    if (!target?.source) return;
    let directive;
    let query = target.query;
    const contentType = target.contentType || 'Article';
    switch (target.source) {
      case 'research': directive = applyExecOptionsToDirective(`Draft a page for ${project.name} that answers this search: "${target.query}". Cite or mirror the kind of facts used on ${target.domain || 'the top cited source'}. Use clear headings, real facts, and a short "what to do next" for the reader.`); break;
      case 'audit': directive = applyExecOptionsToDirective(`Draft content for ${project.name} that fixes this issue. Problem: ${target.auditRootCause}. Fix: ${target.auditSolution}. Use headings; say what to change in plain terms; end with one next step.`); break;
      case 'citation': directive = applyExecOptionsToDirective(`Draft for ${project.name} on topic: "${target.query}". Reference the style of content on ${target.domain || 'the top cited site'}. Clear headings, direct answers, one next step for the reader.`); break;
      case 'path': directive = applyExecOptionsToDirective(`Draft for ${project.name}. ${target.pathRec} Use headings, match the search intent, and add clear next steps.`); query = target.pathRec; break;
      case 'custom': directive = applyExecOptionsToDirective(`Write a ${contentType} for ${project.name} using this brief:\n\n${target.customBrief}\n\nFollow the brief. Short sections, plain words, one call to action at the end.`); query = target.headline || target.customBrief.slice(0, 200); break;
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
                <p className="mb-3 text-[11px] font-semibold text-slate-400">Export date range (trends)</p>
                <div className="mb-3 flex items-center gap-2">
                  <label className="flex-1 text-[11px] font-medium text-slate-500">From<input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-brand-primary" /></label>
                  <span className="mt-4 text-slate-300">–</span>
                  <label className="flex-1 text-[11px] font-medium text-slate-500">To<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-brand-primary" /></label>
                </div>
                {exportError && (
                  <p className="mb-2 text-[11px] text-red-600">{exportError}</p>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={Boolean(exportLoading)}
                    className="w-full"
                  >
                    {exportLoading === 'pdf' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    Download Full Report (PDF)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleExport('csv')}
                    disabled={Boolean(exportLoading)}
                    className="w-full"
                  >
                    {exportLoading === 'csv' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download Data (CSV)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {!contextState?.context_ready && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Limited context mode</p>
          <p className="mt-1 text-xs text-amber-800">
            Complete onboarding to step 5 for sharper, context-rich recommendations.
            <Link to={`/dashboard/project/${id}/onboarding`} className="ml-1 font-semibold underline underline-offset-2">
              Improve context
            </Link>
          </p>
        </div>
      )}

      {sessionExpired && (
        <div className="rounded-xl border border-red-200/70 bg-red-50/70 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Session expired — refresh the page to reload dashboard panels.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary/90"
          >
            Refresh page
          </button>
        </div>
      )}

      {/* Horizontal tab bar */}
      <div className="border-b border-slate-200/60">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {SECTION_IDS.map((section) => {
            const SIcon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                  active
                    ? 'text-brand-primary'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <SIcon className={`h-4 w-4 ${active ? 'text-brand-primary' : 'text-slate-400'}`} />
                {section.label}
                {active && (
                  <motion.div
                    layoutId="section-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="min-w-0 space-y-5">
          <AnimatePresence mode="wait">
            {/* ===== DASHBOARD TAB ===== */}
            {activeSection === 'dashboard' && (
              <motion.div key="dashboard" {...sectionMotion} className="space-y-5">
                <OverviewKpiGrid dashboard={dashboard} prompts={prompts} enabledEngines={enabledEngines} metricsLoading={dashboardLoading} />

                {/* Low-confidence warning banner */}
                {(() => {
                  const nResponses = Number(dashboard?.coverage?.n_responses ?? 0);
                  if (nResponses > 0 && nResponses < 15) return (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-5 py-3.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Early results — directional only</p>
                        <p className="mt-0.5 text-xs text-amber-600">Based on {nResponses} model answer{nResponses === 1 ? '' : 's'} so far. Scores and rankings will stabilize as more prompts complete across engines.</p>
                      </div>
                    </div>
                  );
                  return null;
                })()}

                {/* Collapsible glossary */}
                <div className="glass-card-v2 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowGlossary((v) => !v)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-slate-50/50"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Info className="h-4 w-4 text-slate-400" />
                      What do the metrics mean?
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showGlossary ? 'rotate-180' : ''}`} />
                  </button>
                  {showGlossary && (
                    <div className="space-y-3 border-t border-slate-100/80 px-5 py-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="glass-inset rounded-lg px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-slate-700">Score</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Composite of mention rate, rank position, and sentiment across all tracked prompts. 0–100 scale.</p>
                        </div>
                        <div className="glass-inset rounded-lg px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-slate-700">Visibility</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Percentage of (prompt × engine) cells where your brand was explicitly named in the answer text.</p>
                        </div>
                        <div className="glass-inset rounded-lg px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-slate-700">AI Share</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Your brand's share of all brand-mention events. Differs from visibility, which measures presence per cell.</p>
                        </div>
                        <div className="glass-inset rounded-lg px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-slate-700">Quality</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Weighted blend of how often the brand is mentioned, its typical rank position, and positive/negative sentiment.</p>
                        </div>
                        <div className="glass-inset rounded-lg px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-slate-700">Moat score</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">How defensible your visibility is — factoring in owned citations, official-site references, and source diversity.</p>
                        </div>
                        <div className="glass-inset rounded-lg px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-slate-700">Answer position</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Average rank when your brand is named. #1 = first mentioned, higher numbers = mentioned later in the answer.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!selectedPromptId && (() => {
                  if (!movements || movements.has_data === false) {
                    if (movementsLoading) {
                      return (
                        <div className="glass-card-v2 flex items-center gap-2 px-6 py-4 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                          Checking what changed since your last run…
                        </div>
                      );
                    }
                    return null;
                  }
                  const m = movements;
                  const s = m.summary || {};
                  const ev = toArray(m.events);
                  return (
                    <div className="glass-card-v2 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><History className="h-4 w-4" /></div>
                          <div>
                            <h2 className="text-base font-semibold tracking-tight text-slate-900">What changed since your last check</h2>
                            <p className="text-xs text-slate-500">{s.previous_check ? `Comparing ${s.previous_check} → ${s.last_checked}` : 'Run-over-run movement across engines'}</p>
                          </div>
                        </div>
                        {m.has_history && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary"><TrendingUp className="h-3.5 w-3.5" />{s.gains || 0} gains</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><TrendingDown className="h-3.5 w-3.5" />{s.drops || 0} drops</span>
                          </div>
                        )}
                      </div>
                      {!m.has_history ? (
                        <div className="border-t border-slate-100/80 px-6 py-7 text-center">
                          <p className="text-sm font-medium text-slate-600">Baseline captured from your first run.</p>
                          <p className="mt-1 text-xs text-slate-400">Re-run analysis to start tracking gains, drops, and new competitor threats since your last check.</p>
                        </div>
                      ) : ev.length === 0 ? (
                        <div className="border-t border-slate-100/80 px-6 py-7 text-center">
                          <p className="text-sm font-medium text-slate-600">No material changes since your last run.</p>
                          <p className="mt-1 text-xs text-slate-400">Your visibility held steady across tracked prompts and engines.</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100/80 border-t border-slate-100/80">
                          {ev.map((e, i) => {
                            const Icon = e.direction === 'up' ? ArrowUpRight : e.direction === 'down' ? ArrowDownRight : ShieldAlert;
                            const toneCls = e.direction === 'up' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-600';
                            return (
                              <li key={i} className="flex items-start gap-3 px-6 py-3.5">
                                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toneCls}`}><Icon className="h-4 w-4" /></span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-800">{e.headline}</p>
                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-slate-500">{e.engine}</span>
                                  </div>
                                  {e.detail && <p className="mt-0.5 text-xs text-slate-500">{e.detail}</p>}
                                  {(e.from || e.to) && (
                                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                      <span className="rounded bg-slate-50 px-1.5 py-0.5">{e.from}</span>
                                      <span>→</span>
                                      <span className={`rounded px-1.5 py-0.5 ${toneCls}`}>{e.to}</span>
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {dashboardLoading ? (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
                    <div className="glass-card-v2 animate-pulse rounded-2xl p-6">
                      <div className="mb-4 h-4 w-40 rounded bg-slate-100" />
                      <div className="h-48 rounded-xl bg-slate-50" />
                    </div>
                    <div className="glass-card-v2 animate-pulse rounded-2xl p-6">
                      <div className="mb-4 h-4 w-32 rounded bg-slate-100" />
                      <div className="h-48 rounded-xl bg-slate-50" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
                    <PerformancePanel range={dashChartMode} onRangeChange={setDashChartMode} dashboard={dashboard} />
                    <CompetitorSnapshot competitors={toArray(dashboard?.competitors)} onViewAll={() => setActiveSection('competitors')} />
                  </div>
                )}
                <PromptPerformanceTable loading={promptAnalysisLoading} rows={toArray(promptAnalysis?.rows)} onViewAll={() => setActiveSection('prompts')} />

                {!selectedPromptId && (
                  <>
                    {(() => {
                      if (intelSummaryLoading && !dashboardIntelLayout) {
                        return (
                          <div className="glass-card-v2 flex items-center gap-2 px-6 py-4 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                            Loading summary from measured data…
                          </div>
                        );
                      }
                      if (!dashboardIntelLayout) return null;

                      const summaryCoverage = intelSummary?.coverage || dashboard?.coverage;
                      const summaryResponseCount = Number(summaryCoverage?.n_responses ?? 0) || 0;
                      const noSummaryData = intelSummary
                        ? intelSummary.has_data === false && summaryResponseCount <= 0
                        : summaryResponseCount <= 0 && !dashboardIntelLayout.fromIntel;
                      const overallHealth = intelSummary?.overall_health
                        || (noSummaryData ? 'No data' : 'Neutral');
                      const healthBadgeStyle = overallHealth === 'Strong'
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : overallHealth === 'Critical'
                          ? 'bg-slate-100 text-slate-700'
                          : overallHealth === 'No data'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-100 text-slate-600';
                      const priorityPrompts = toArray(intelSummary?.top_priority_prompts);

                      return (
                        <div className="glass-card-v2 overflow-hidden">
                          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold tracking-tight text-slate-900">Summary</h2>
                                {intelSummaryLoading && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Updating…
                                  </span>
                                )}
                              </div>
                              {intelSummaryError && !intelSummary && (
                                <p className="mt-1 text-xs text-slate-500">Using measured dashboard metrics — full summary unavailable.</p>
                              )}
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${healthBadgeStyle}`}>{overallHealth}</span>
                          </div>
                          {noSummaryData ? (
                            <div className="px-6 pb-6">
                              <CoverageEmptyState
                                coverage={summaryCoverage}
                                title="No summary signal yet"
                                message="Run a prompt with model answers to generate a dashboard summary from real data."
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.35fr_1fr] lg:gap-0">
                              <div className="space-y-6 px-6 pb-6 lg:pr-8">
                                <div>
                                  <p className={`${lbl} mb-2`}>In short</p>
                                  <p className="text-sm font-medium leading-snug text-slate-800">{dashboardIntelLayout.happening || '—'}</p>
                                </div>
                                <div>
                                  <p className={`${lbl} mb-2`}>Do these first</p>
                                  <ul className="space-y-2">
                                    {(dashboardIntelLayout.priorities.length ? dashboardIntelLayout.priorities : ['Run your prompts to get a short list here.']).map((line, idx) => (
                                      <li key={idx} className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{line}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className={`${lbl} mb-2`}>Risks</p>
                                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
                                    {(dashboardIntelLayout.losing.length ? dashboardIntelLayout.losing : ['Run more analyses to see competitor gaps here.']).map((line, idx) => (
                                      <li key={idx}>{line}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              <div className="space-y-5 border-t border-slate-100/80 px-6 py-6 lg:border-l lg:border-t-0 lg:pt-6">
                                <div>
                                  <p className={`${lbl} mb-2`}>Prompts to watch</p>
                                  <div className="space-y-2">
                                    {priorityPrompts.length === 0 && <p className="text-sm text-slate-500">None yet. Run analysis first.</p>}
                                    {priorityPrompts.map((q, idx) => (
                                      <div key={idx} className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{q}</div>
                                    ))}
                                  </div>
                                </div>
                                {coverageSnapshot && (
                                  <div>
                                    <p className={`${lbl} mb-2`}>Coverage</p>
                                    <div className="space-y-2">
                                      <div className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{coverageSnapshot.queriesLine}</div>
                                      <div className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{coverageSnapshot.shareLine}</div>
                                      <div className="glass-inset rounded-lg px-3 py-2 text-sm text-slate-700">{coverageSnapshot.topCompetitorLine}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {citationEconomicsLoading && !citationEconomics ? (
                      <div className="glass-card-v2 flex items-center gap-2 px-6 py-4 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                        Mapping citation authority...
                      </div>
                    ) : citationEconomics ? (() => {
                      const moat = citationEconomics.citation_moat || {};
                      const rollup = citationEconomics.rollup_focus_mentions || {};
                      const topDomains = toArray(citationEconomics.domain_kpis?.top_domains).slice(0, 5);
                      const recs = toArray(moat.recommendations);
                      const focusMentions = Number(rollup.focus_mentions || 0);
                      const moatScore = Number.isFinite(Number(moat.score)) ? Number(moat.score) : 0;
                      const statusStyle = moat.status === 'Strong'
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : moat.status === 'Leaky'
                          ? 'bg-slate-100 text-slate-700'
                          : moat.status === 'No data'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-brand-primary/10 text-brand-primary';
                      const signalLabel = {
                        brand_owned: 'Owned',
                        competitor_named: 'Competitor',
                        other: 'Market source',
                      };
                      const draftFromRecommendation = (rec) => {
                        setExecDraftTarget({
                          source: 'audit',
                          headline: rec.title || 'Authority moat action',
                          query: rec.title || rec.detail || '',
                          pathRec: rec.detail || rec.title || '',
                          contentType: 'Article',
                        });
                        setActiveSection('execute');
                      };

                      return (
                        <div className="glass-card-v2 overflow-hidden">
                          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900">
                                  <Crown className="h-4 w-4 text-brand-primary" />
                                  Authority moat
                                </h2>
                              </div>
                              <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
                                Which sources make AI engines trust you, and where competitors can still steal the answer.
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusStyle}`}>
                              {moat.status || 'No data'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-0 border-t border-slate-100/80 lg:grid-cols-[0.85fr_1.15fr]">
                            <div className="space-y-4 px-6 py-5">
                              <div>
                                <p className={`${lbl} mb-2`}>Moat score</p>
                                <div className="flex items-end gap-2">
                                  <span className="text-4xl font-bold tabular-nums text-slate-900">{Math.round(moatScore)}</span>
                                  <span className="pb-1 text-sm font-medium text-slate-400">/100</span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                  {moat.summary || 'Run analysis to measure citation backing.'}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="glass-inset rounded-lg px-3 py-2">
                                  <p className={lbl}>Focus mentions</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{focusMentions}</p>
                                </div>
                                <div className="glass-inset rounded-lg px-3 py-2">
                                  <p className={lbl}>Any source</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{moat.focus_cited_pct ?? 0}%</p>
                                </div>
                                <div className="glass-inset rounded-lg px-3 py-2">
                                  <p className={lbl}>Owned citations</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{moat.owned_cited_pct ?? 0}%</p>
                                </div>
                                <div className="glass-inset rounded-lg px-3 py-2">
                                  <p className={lbl}>Official site cited</p>
                                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                                    {citationEconomics.official_site_alignment?.official_site_cited_pct ?? 0}%
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-5 border-t border-slate-100/80 px-6 py-5 lg:border-l lg:border-t-0">
                              <div>
                                <p className={`${lbl} mb-2`}>Top citation domains</p>
                                {topDomains.length === 0 ? (
                                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No citation domains yet.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {topDomains.map((domain) => (
                                      <div key={domain.domain} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white/70 px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-slate-800">{domain.domain}</p>
                                          <p className="text-[10px] text-slate-400">{signalLabel[domain.signal] || 'Market source'}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                          {domain.share_of_measured_urls ?? 0}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className={`${lbl} mb-2`}>Recommended moves</p>
                                <div className="space-y-2">
                                  {recs.map((rec, idx) => (
                                    <div key={`${rec.title}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${rec.priority === 'high' ? 'bg-slate-100 text-slate-700' : 'bg-brand-primary/10 text-brand-primary'}`}>
                                          {rec.priority || 'medium'}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{rec.detail}</p>
                                      <button type="button" onClick={() => draftFromRecommendation(rec)} className="mt-2 text-xs font-semibold text-brand-primary hover:underline">
                                        Draft content from this
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })() : null}
                    {globalAuditLoading && !globalAudit ? (
                      <div className="glass-card-v2 flex items-center justify-center gap-2 px-6 py-4 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                        Checking measured visibility audit...
                      </div>
                    ) : (() => {
                      // The backend now returns { items, coverage, has_data } from this endpoint.
                      // Fall back gracefully if a cached older array shape lands here.
                      const audit = globalAudit;
                      const items = Array.isArray(audit)
                        ? audit
                        : (Array.isArray(audit?.items) ? audit.items : []);
                      const auditCoverage = audit && !Array.isArray(audit) ? audit.coverage : null;
                      const hasData = audit && !Array.isArray(audit) ? audit.has_data !== false : items.length > 0;
                      const gated = !hasData || isInsufficient(auditCoverage);
                      if (!audit && items.length === 0) return null;
                      return (
                        <div className="glass-card-v2 overflow-hidden">
                          <div className="px-6 py-5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold tracking-tight text-slate-900">Visibility audit</h2>
                            </div>
                            <p className="mt-0.5 text-sm text-slate-500">Evidence-backed issues and fixes from the answers collected so far</p>
                          </div>
                          <div className="space-y-4 px-6 pb-6">
                            {gated ? (
                              <CoverageEmptyState
                                coverage={auditCoverage}
                                message="Run one prompt with model answers to generate the visibility audit."
                              />
                            ) : (
                              items.map((item, idx) => {
                                const priority = String(item?.priority || 'medium').toLowerCase();
                                const supporting = toArray(item?.queries_supporting);
                                return (
                                  <div key={idx} className="glass-inset rounded-xl p-4">
                                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                      <ProseText text={item.title} as="h3" className="text-sm font-semibold text-slate-800" />
                                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${priority === 'high' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-600'}`}>{priority}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                      <div><p className={`${lbl} mb-1`}>Root cause</p><ProseText text={item.root_cause} className="text-xs leading-relaxed text-slate-600" /></div>
                                      <div><p className={`${lbl} mb-1`}>Solution</p><ProseText text={item.solution} className="text-xs leading-relaxed text-slate-700" /></div>
                                    </div>
                                    {item.evidence_quote && (
                                      <blockquote className="mt-3 border-l-2 border-brand-primary/40 bg-slate-50/70 px-3 py-2 text-xs italic leading-relaxed text-slate-600">
                                        &ldquo;{sanitizeProse(item.evidence_quote)}&rdquo;
                                      </blockquote>
                                    )}
                                    {supporting.length > 0 && (
                                      <p className="mt-2 text-[10px] text-slate-400">
                                        Seen in {supporting.length} {supporting.length === 1 ? 'query' : 'queries'}: {supporting.slice(0, 3).map((q) => `"${sanitizeProse(q)}"`).join(' \u00b7 ')}{supporting.length > 3 ? ' \u2026' : ''}
                                      </p>
                                    )}
                                    {item.avoid && <p className="mt-2 text-xs text-slate-500"><span className="font-medium text-slate-600">Avoid:</span> {sanitizeProse(item.avoid)}</p>}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
                      <div><h2 className="text-sm font-semibold text-slate-800">Prompts</h2><p className="text-[11px] text-slate-400">Visibility = how often your brand is named in the answer text. Link citations are tracked separately on Sources.</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/project/${id}/prompts/setup`}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-primary hover:text-brand-primary"
                        title="Bulk add from AI suggestions"
                      >
                        <Sparkles className="h-3 w-3" />
                        Bulk add from suggestions
                      </Link>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600">{(prompts?.length ?? 0)}/{maxPromptsPerProject}</span>
                    </div>
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
                        <Button type="submit" disabled={analyzePromptMutation.isPending || !newPromptText.trim() || atPromptLimit}>{analyzePromptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{atPromptLimit ? `Limit reached (${maxPromptsPerProject})` : 'Analyze Prompt'}</Button>
                        {Object.values(runningPrompts).some(Boolean) && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysis in progress</span>}
                      </div>
                    </form>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead><tr className="border-b border-slate-100/80 text-slate-400">{['Prompt', 'Answer visibility', 'Quality', 'Sentiment', 'Answer position', 'Models', 'Actions'].map((h) => <th key={h} className="px-5 py-2.5 text-left text-[11px] font-medium">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {promptAnalysisLoading ? Array.from({ length: 6 }).map((_, idx) => (<tr key={`sk-${idx}`}><td className="px-5 py-3"><div className="h-3 w-52 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-5 w-14 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-12 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-12 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-10 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-3 w-28 animate-pulse rounded bg-slate-100" /></td><td className="px-5 py-3"><div className="h-6 w-24 animate-pulse rounded bg-slate-100" /></td></tr>))
                          : toArray(promptAnalysis?.rows).map((row, idx) => (
                            <tr key={`${row.prompt_id}-${idx}`} className="transition-colors hover:bg-slate-50/50">
                              <td className="max-w-[300px] px-5 py-3">
                                <button type="button" onClick={() => openPromptDeepIntel(row.prompt_id)} className="block w-full truncate text-left text-sm font-medium text-slate-800 hover:text-brand-primary">{row.prompt_text}</button>
                              </td>
                              <td className="px-5 py-3"><span className="inline-block rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-primary">{row.visibility_pct ?? row.visibility}%</span></td>
                              <td className="px-5 py-3 font-medium tabular-nums text-slate-500">{row.quality_score ?? '-'}</td>
                              <td className="px-5 py-3 text-xs font-medium capitalize text-slate-500">{row.sentiment}</td>
                              <td className="px-5 py-3 font-medium tabular-nums text-slate-500">{row.avg_rank ?? '-'}</td>
                              <td className="max-w-[200px] px-5 py-3 text-xs text-slate-600">{toArray(row.models).map((m) => modelIdToName[m] || m).join(', ') || '-'}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Button size="sm" onClick={() => runPromptMutation.mutate(row.prompt_id)} disabled={runningPrompts[row.prompt_id]}>{runningPrompts[row.prompt_id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}{runningPrompts[row.prompt_id] ? 'Running' : 'Run'}</Button>
                                  <Button size="sm" variant="secondary" onClick={() => setImproveTarget({ prompt_id: row.prompt_id, prompt_text: row.prompt_text })} title="Improve this prompt with AI"><Wand2 className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => deletePromptMutation.mutate(row.prompt_id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {!promptAnalysisLoading && toArray(promptAnalysis?.rows).length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                              <p>No prompts yet. Add one above, or</p>
                              <Link
                                to={`/dashboard/project/${id}/prompts/setup`}
                                className="mt-1 inline-flex items-center gap-1 text-brand-primary hover:underline"
                              >
                                <Sparkles className="h-3 w-3" />
                                bulk add from AI suggestions
                              </Link>
                            </td>
                          </tr>
                        )}
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
                  <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Users className="h-4 w-4" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">Competitor Analysis</p>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Directional from the first run, then stronger as more prompts complete. Visibility is % of measured answers that named each brand; AI Share is share of actual brand mentions.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] tabular-nums text-slate-400">{competitorDisplayRows.length} brands</span>
                  </div>

                  {competitorIntelLoading && competitorDisplayRows.length === 0 ? (
                    <div className="divide-y divide-slate-50">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="flex animate-pulse items-center gap-4 px-6 py-4">
                          <div className="h-3 w-4 rounded bg-slate-100" />
                          <div className="h-3 w-28 rounded bg-slate-100" />
                          <div className="ml-auto flex items-center gap-8">
                            <div className="h-1.5 w-32 rounded-full bg-slate-100" />
                            <div className="h-3 w-10 rounded bg-slate-100" />
                            <div className="h-3 w-10 rounded bg-slate-100" />
                            <div className="h-3 w-10 rounded bg-slate-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : competitorDisplayRows.length === 0 ? (
                    <div className="px-6 py-8">
                      <CoverageEmptyState
                        coverage={competitorIntel?.coverage}
                        title="No competitor signal yet"
                        message="No competitors were extracted from the measured answers yet. Run or rerun a prompt to generate real brand mentions."
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100/80 bg-slate-50/50">
                            <th className="w-10 px-6 py-3 text-left text-[10px] font-semibold text-slate-400">#</th>
                            <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400">Brand</th>
                            <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400" title="% of (prompt \u00d7 engine) cells where the brand was named.">Visibility</th>
                            <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400" title="Share of all brand-mention events across model answers in the tracked portfolio.">AI Share</th>
                            <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400" title="Composite of mention rate, rank, and sentiment. Hover a row to see the sub-components.">Quality</th>
                            <th className="px-6 py-3 text-right text-[10px] font-semibold text-slate-400" title="Mean position when the brand was named in measured answers.">Answer position</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {competitorTopRows.map((item, idx) => {
                            const vis = item.__vis ?? item.visibility_pct ?? item.visibility ?? 0;
                            const barPct = Math.min(100, (Number(vis) / competitorMaxVis) * 100);
                            const isFocus = item.is_focus;
                            const isTarget = item.is_target_competitor;
                            const rowKey = item.brand || idx;
                            const expanded = !!expandedCompetitor[rowKey];
                            const perEngine = item.per_engine && typeof item.per_engine === 'object'
                              ? Object.values(item.per_engine)
                              : [];
                            const qc = item.quality_components || {};
                            const qualityTooltip = item.quality_score != null
                              ? `Quality breakdown\nmention rate score: ${qc.mention_rate_score ?? '0'}\nrank score: ${qc.rank_score ?? '0'}\nsentiment score: ${qc.sentiment_score ?? '0'}\nbased on ${qc.n_supporting ?? 0} answer(s)`
                              : 'Not enough data';
                            const rankSamples = Number(item.rank_samples || 0);
                            const rankTooltip = item.avg_rank != null
                              ? `Across ${rankSamples} ranked mention${rankSamples === 1 ? '' : 's'}${item.rank_p25 != null && item.rank_p75 != null ? ` (p25 #${item.rank_p25} \u2013 p75 #${item.rank_p75})` : ''}`
                              : rankSamples
                                ? `Rank was not available in the latest extracted mentions (${rankSamples} sampled)`
                                : 'Rank was not available in the latest extracted mentions';
                            const supportTooltip = `Seen in ${item.n_responses_with_brand ?? 0} answer(s) across ${item.n_prompts_with_brand ?? 0} prompt(s) \u00d7 ${item.n_engines_with_brand ?? 0} engine(s)`;
                            return (
                              <React.Fragment key={rowKey}>
                                <motion.tr
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: idx * 0.03 }}
                                  onClick={() => perEngine.length > 0 && setExpandedCompetitor((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                                  className={`group transition-colors hover:bg-slate-50/60 ${isFocus ? 'bg-brand-primary/[0.03]' : ''} ${perEngine.length > 0 ? 'cursor-pointer' : ''}`}
                                >
                                  <td className="px-6 py-3.5">
                                    <span className="text-[11px] font-semibold tabular-nums text-slate-400">{idx + 1}</span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                      {perEngine.length > 0 && (
                                        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                      )}
                                      <span className={`text-sm font-semibold ${isFocus ? 'text-brand-primary' : 'text-slate-800'}`} title={supportTooltip}>{item.brand}</span>
                                      {isFocus && <span className="rounded-md bg-brand-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-primary">You</span>}
                                      {isTarget && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Target</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${barPct}%` }}
                                          transition={{ duration: 0.6, delay: idx * 0.04, ease: 'easeOut' }}
                                          className={`h-full rounded-full ${isFocus ? 'bg-brand-primary' : 'bg-slate-300'}`}
                                        />
                                      </div>
                                      <span className={`min-w-[2.75rem] text-right text-xs font-semibold tabular-nums ${isFocus ? 'text-brand-primary' : 'text-slate-700'}`} title={supportTooltip}>{vis}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    <span className="text-xs font-semibold tabular-nums text-slate-700">{item.ai_share != null ? `${item.ai_share}%` : <span className="text-slate-300">-</span>}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    <span className="text-xs font-semibold tabular-nums text-slate-700" title={qualityTooltip}>
                                      {item.quality_score != null ? `${item.quality_score}` : <span className="text-slate-300">-</span>}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3.5 text-right">
                                    <span className="text-xs font-semibold tabular-nums text-slate-700" title={rankTooltip}>
                                      {item.avg_rank != null ? `#${item.avg_rank}` : <span className="text-slate-300">-</span>}
                                    </span>
                                  </td>
                                </motion.tr>
                                {expanded && perEngine.length > 0 && perEngine.map((pe) => (
                                  <tr key={`${rowKey}-${pe.engine}`} className="bg-slate-50/40 text-[11px]">
                                    <td className="px-6 py-2" />
                                    <td className="px-4 py-2 text-slate-500" colSpan={1}>
                                      <span className="ml-4 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{pe.engine}</span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                      <span className="tabular-nums">{pe.visibility_pct != null ? `${pe.visibility_pct}%` : '-'}</span>
                                      <span className="ml-2 text-[10px] text-slate-400">{pe.n_responses_with_brand}/{pe.n_engine_cells} answers</span>
                                    </td>
                                    <td className="px-4 py-2 text-right text-slate-500">-</td>
                                    <td className="px-4 py-2 text-right text-slate-500">-</td>
                                    <td className="px-6 py-2 text-right text-slate-600 tabular-nums">{pe.avg_rank != null ? `#${pe.avg_rank}` : '-'}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== SOURCES TAB ===== */}
            {activeSection === 'sources' && (
              <motion.div key="sources" {...sectionMotion}>
                <TopCitingSources 
                  sources={mergedSourcesRows} 
                  isLoading={sourcesIntelLoading && mergedSourcesRows.length === 0}
                  totalPrompts={projectData?.dashboard?.prompt_rankings?.length || projectData?.prompts?.length || 1} 
                  totalEngines={Object.keys(modelIdToName || {}).length || 1}
                  focusBrand={project.name} 
                />
              </motion.div>
            )}

            {/* ===== CONTENT STUDIO TAB ===== */}
            {activeSection === 'execute' && (
              <motion.div key="execute" {...sectionMotion} className="space-y-5">
                <div className="glass-card-v2 overflow-hidden">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100/80 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><Zap className="h-4 w-4" /></div>
                      <div><p className="text-sm font-semibold text-slate-800">Content Studio</p><p className="text-[11px] text-slate-400">Drafts and rewrites to edit and publish yourself</p></div>
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
                              <p className="mb-1 text-[10px] font-semibold text-slate-400">Format</p>
                              <div className="flex rounded-xl border border-slate-200/60 bg-slate-50/50 p-0.5">{EXEC_CONTENT_TYPES.map((ct) => (<button key={ct} type="button" onClick={() => setCustomBriefType(ct)} className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${customBriefType === ct ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{ct}</button>))}</div>
                            </div>
                            <div>
                              <p className="mb-1 text-[10px] font-semibold text-slate-400">AI Engine</p>
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
                      {toArray(dashboard?.recommendations?.missing_from_prompts).length > 0 && !effectiveDraftTarget && (
                        <div className="mt-5 border-t border-slate-100/80 pt-5">
                          <p className={`${lbl} mb-2`}>Suggestions from your data</p>
                          <div className="space-y-2">{toArray(dashboard?.recommendations?.missing_from_prompts).slice(0, 3).map((rec, i) => (
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
                            <Button size="sm" onClick={() => { navigator.clipboard.writeText(sanitizeProse(execContent.content)); }}><Copy className="h-3 w-3" /> Copy</Button>
                          </div>
                          <div className="glass-inset max-h-[500px] flex-1 overflow-auto rounded-xl">
                            <div className="border-b border-slate-100/80 px-5 py-4"><ProseText text={execContent.title} as="h4" className="text-base font-semibold text-slate-800" /></div>
                            <div className="px-5 py-4"><FormattedProse text={execContent.content} /></div>
                          </div>
                          {execContent.placement_advice && (
                            <div className="mt-4 rounded-xl border border-brand-primary/15 bg-brand-primary/5 px-4 py-3">
                              <p className="mb-1 text-[10px] font-semibold text-brand-primary">Publishing Strategy</p>
                              <ProseText text={execContent.placement_advice} className="text-xs leading-relaxed text-slate-700" />
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
                ) : (() => {
                  const allActions = toArray(deepAnalysis?.action_plan);
                  const opportunitiesCoverage = deepAnalysis?.coverage;
                  const planEmpty = allActions.length === 0;
                  const handleDraft = (action) => {
                    const pathDetail = action.detail || (Array.isArray(action.action_plan) ? action.action_plan.join(' ') : action.title);
                    const t = { source: 'path', headline: action.title, query: (action.trigger_signal || pathDetail || action.title).slice(0, 200), pathRec: pathDetail || action.title, contentType: 'Article' };
                    setExecDraftTarget(t);
                    setActiveSection('execute');
                  };
                  return (
                    <>
                      <div className="glass-card-v2 overflow-hidden">
                        <div className="flex items-center gap-2.5 border-b border-slate-100/80 px-6 py-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary"><Sparkles className="h-4 w-4" /></div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">Action plan</p>
                            </div>
                            <p className="text-[11px] text-slate-400">Open an item to see steps you can do this week. Early runs are directional; confidence is computed from real evidence.</p>
                          </div>
                        </div>
                        {planEmpty ? (
                          <div className="p-6">
                            <CoverageEmptyState
                              coverage={opportunitiesCoverage}
                              title="No action signal yet"
                              message="No evidence-backed actions were found yet. Run a prompt with model answers so recommendations can be tied to real responses."
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                            {allActions.map((item, idx) => (
                              <ActionPlanCard key={`action-${idx}`} item={item} projectId={id} onGenerateDraft={handleDraft} />
                            ))}
                          </div>
                        )}
                      </div>
                      {deepAnalysis?.search_intel?.enabled && (() => {
                        const points = toArray(deepAnalysis?.search_intel?.retrieval_points);
                        const domains = toArray(deepAnalysis?.search_intel?.domains);
                        return (
                          <div className="glass-card-v2 p-6">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900">Pinpointed Retrieval Points</h3>
                            </div>
                            <p className="mb-4 text-sm text-slate-500">Specific articles, threads, and videos LLMs lean on. Ranked by how many of your queries they show up in.</p>
                            <div className="mb-6 space-y-3">
                              {points.length === 0 ? (
                                <p className="px-2 text-xs italic text-slate-500">Run a fresh analysis to identify specific deep links.</p>
                              ) : (
                                points.map((item, idx) => {
                                  const supportingQueries = toArray(item.cited_for_queries);
                                  const nQueries = Number(item.n_queries || supportingQueries.length || 1);
                                  const nEngines = Number(item.n_engines || 1);
                                  const queryLabel = supportingQueries[0] || item.query || '';
                                  return (
                                    <div key={idx} className="glass-inset flex items-center justify-between gap-4 rounded-xl border border-brand-primary/15 bg-brand-primary/5 p-3.5">
                                      <div className="min-w-0">
                                        <p className="mb-0.5 text-xs font-bold text-brand-primary">
                                          {item.domain} &middot; Cited for {nQueries} {nQueries === 1 ? 'query' : 'queries'}{nEngines > 1 ? ` \u00b7 ${nEngines} engines` : ''}
                                        </p>
                                        <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                                        {queryLabel && <p className="truncate text-[10px] text-slate-500" title={supportingQueries.join(' \u00b7 ')}>e.g. &ldquo;{queryLabel}&rdquo;{supportingQueries.length > 1 ? ` (+${supportingQueries.length - 1} more)` : ''}</p>}
                                      </div>
                                      <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:shadow-md">View <ExternalLink className="h-3 w-3" /></a>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-slate-900">High-Impact Retrieval Domains</h3>
                            <p className="mb-4 text-sm text-slate-500">Domains frequently used by search-enabled LLMs for your niche. Ranked by cross-query reach.</p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {domains.length === 0 && (
                                <p className="col-span-full px-2 text-xs italic text-slate-500">No domain signal yet.</p>
                              )}
                              {domains.map((item) => {
                                const nQueries = Number(item.n_queries || 0);
                                const nEngines = Number(item.n_engines || 0);
                                const citations = Number(item.n_citations ?? item.count ?? 0);
                                return (
                                  <div key={item.domain} className="glass-card-v2 flex flex-col gap-1 p-3.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-slate-900">{item.domain}</span>
                                      <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-bold text-brand-primary">{citations} citations</span>
                                    </div>
                                    {(nQueries > 0 || nEngines > 0) && (
                                      <p className="text-[10px] text-slate-400">
                                        across {nQueries || 1} {nQueries === 1 ? 'query' : 'queries'}{nEngines ? ` \u00b7 ${nEngines} ${nEngines === 1 ? 'engine' : 'engines'}` : ''}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
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

          {runningPrompts?.[selectedPromptId] ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-brand-primary opacity-30" />
              <p className="text-sm font-semibold text-slate-700">Analysis running…</p>
              <p className="text-xs font-medium text-slate-500">Meeting endpoint as the analysis completes.</p>
              <div className="w-full max-w-md pt-2">
                <div className="relative h-10">
                  <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
                  <div className="answerdeck-runner absolute top-1/2 -translate-y-1/2">
                    <svg width="26" height="18" viewBox="0 0 52 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-brand-primary">
                      <circle cx="38" cy="10" r="5" stroke="currentColor" strokeWidth="3" />
                      <path d="M36 15 L28 22 L20 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M28 22 L32 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <path d="M26 24 L18 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <path d="M30 20 L40 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>
              <style>{`
                @keyframes answerdeckRunnerMove {
                  0% { transform: translateX(-8%) translateY(-50%); opacity: 0.0; }
                  8% { opacity: 1; }
                  92% { opacity: 1; }
                  100% { transform: translateX(108%) translateY(-50%); opacity: 0.0; }
                }
                .answerdeck-runner {
                  left: 0;
                  animation: answerdeckRunnerMove 2.2s linear infinite;
                  will-change: transform, opacity;
                }
              `}</style>
              <p className="max-w-md text-xs text-slate-500">
                We’ll show the full audit and sources once everything is generated and verified.
              </p>
            </div>
          ) : promptDetailLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-brand-primary opacity-20" /></div>
          ) : promptDetailIsError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
              <p className="font-semibold">Prompt detail could not load.</p>
              <p className="mt-1 text-red-600">{promptDetailError?.message || 'Please retry after the analysis finishes.'}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['prompt-detail', selectedPromptId] })}
              >
                Retry
              </Button>
            </div>
          ) : !promptDetailData ? (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500">No detail found for this prompt.</p>
          ) : (
              <div className="space-y-10">
                {promptDetailData.analysis_brief && (
                  <div className="glass-card-v2 p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h5 className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-brand-primary" /> Answer brief
                      </h5>
                      <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-[10px] font-semibold text-brand-primary">
                        {Math.round(Number(promptDetailData.analysis_brief.visibility_pct || 0))}% visible
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div className="glass-inset rounded-xl p-4">
                        <p className={`${lbl} mb-1`}>What happened</p>
                        <ProseText text={promptDetailData.analysis_brief.what_happened} className="text-sm leading-relaxed text-slate-800" />
                      </div>
                      <div className="glass-inset rounded-xl p-4">
                        <p className={`${lbl} mb-1`}>Why it matters</p>
                        <ProseText text={promptDetailData.analysis_brief.why_it_matters} className="text-sm leading-relaxed text-slate-700" />
                      </div>
                      <div className="glass-inset rounded-xl p-4">
                        <p className={`${lbl} mb-1`}>Next move</p>
                        <ProseText text={promptDetailData.analysis_brief.next_move} className="text-sm leading-relaxed text-slate-700" />
                      </div>
                    </div>
                    {toArray(promptDetailData.analysis_brief.evidence_points).length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {toArray(promptDetailData.analysis_brief.evidence_points).slice(0, 6).map((point, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-slate-600">
                            <ProseText text={point} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="glass-card-v2 p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h5 className="flex items-center gap-2 text-xs font-semibold text-slate-700"><FileText className="h-4 w-4 text-slate-500" /> Raw LLM responses</h5>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">{toArray(promptDetailData.raw_responses).length} models</span>
                  </div>
                  {toArray(promptDetailData.raw_responses).length === 0 ? (
                    <p className="text-sm text-slate-500">No raw model responses are available yet.</p>
                  ) : (
                    <div className="columns-1 lg:columns-2 gap-4 space-y-4">
                      {toArray(promptDetailData.raw_responses).map((response) => (
                        <details key={response.id || response.engine} className="glass-inset group overflow-hidden rounded-xl break-inside-avoid inline-block w-full">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                            <span className="truncate text-sm font-semibold text-slate-900">{modelIdToName[response.engine] || response.engine}</span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="border-t border-slate-200/60 px-4 py-4">
                            <div className="max-h-72 overflow-y-auto rounded-lg bg-white/70 p-4">
                              <FormattedProse text={response.display_response_text || response.response_text} className="text-xs" />
                            </div>
                            {toArray(response.sources).length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {toArray(response.sources).slice(0, 6).map((source) => (
                                  <a key={source} href={source} target="_blank" rel="noreferrer" className="max-w-full truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-brand-primary hover:underline">{source}</a>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
                  <div className="space-y-6">
                    <div className="glass-card-v2 p-6">
                      <h5 className="mb-6 flex items-center gap-2 text-[10px] font-bold tracking-tight text-slate-500"><BarChart2 className="h-4 w-4" /> Brand positions in model answers</h5>
                      <div className="space-y-4">{toArray(promptDetailData.brand_ranking).slice(0, 6).map((item) => (<div key={item.name} className={`flex items-center justify-between rounded-xl p-3 transition-all ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'bg-brand-primary/8 border border-brand-primary/20' : 'hover:bg-slate-50'}`}><span className={`font-bold ${item.name.toLowerCase().includes(project.name.toLowerCase()) ? 'text-brand-primary' : 'text-slate-900'}`}>{item.name}</span><div className="flex items-center gap-4"><span className="text-[10px] font-bold text-slate-500">{item.mentions} answer mentions</span><span className="text-sm font-bold tabular-nums text-slate-500">{item.avg_rank != null ? `#${item.avg_rank}` : '-'}</span></div></div>))}</div>
                    </div>
                    <div className="glass-card-v2 p-6">
                      <h5 className="mb-5 flex items-center gap-2 text-[10px] font-bold tracking-tight text-slate-400"><TrendingUp className="h-4 w-4" /> Sentiment Profile</h5>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/[0.04] p-4 text-center">
                          <p className="text-3xl font-bold tabular-nums text-brand-primary">{promptDetailData.sentiment?.positive ?? 0}</p>
                          <p className="mt-1 text-[9px] font-bold text-brand-primary">Positive</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/30 p-4 text-center">
                          <p className="text-3xl font-bold tabular-nums text-slate-700">{promptDetailData.sentiment?.neutral ?? 0}</p>
                          <p className="mt-1 text-[9px] font-bold text-slate-400">Neutral</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-4 text-center">
                          <p className="text-3xl font-bold tabular-nums text-slate-700">{promptDetailData.sentiment?.negative ?? 0}</p>
                          <p className="mt-1 text-[9px] font-bold text-slate-400">Negative</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card-v2 p-6">
                    <h5 className="mb-5 flex items-center gap-2 text-xs font-semibold text-slate-700"><CheckCircle2 className="h-4 w-4 text-slate-500" /> Evidence audit</h5>
                    <div className="space-y-4">
                      {toArray(promptDetailData.audit).length === 0 && <p className="text-sm text-slate-500">No audit findings were extracted from the current model answers.</p>}
                      {toArray(promptDetailData.audit).map((item, idx) => (
                        <div key={idx} className="glass-inset rounded-xl p-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <h6 className="text-sm font-semibold text-slate-900">{item.issue || item.title}</h6>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${item.priority === 'high' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-100 text-slate-600'}`}>{item.priority}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div><p className={`${lbl} mb-1`}>Root cause</p><div className="text-xs leading-relaxed text-slate-600">{renderTextWithLinks(item.root_cause || item.detail)}</div></div>
                            <div><p className={`${lbl} mb-1`}>Evidence</p><div className="text-xs leading-relaxed text-slate-800">{renderTextWithLinks(item.evidence || item.solution)}</div></div>
                          </div>
                          {Array.isArray(item.fix_steps) && item.fix_steps.length > 0 && (
                            <div className="mt-3">
                              <p className={`${lbl} mb-1`}>What to do this week</p>
                              <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
                                {item.fix_steps.slice(0, 4).map((step) => <li key={step}>{renderTextWithLinks(step)}</li>)}
                              </ul>
                            </div>
                          )}
                          {item.expected_impact && <p className="mt-3 text-xs text-slate-500"><span className="font-medium text-slate-600">Expected impact:</span> {item.expected_impact}</p>}
                          {(item.confidence || item.source_type) && (
                            <p className="mt-2 text-[10px] text-slate-400">
                              {item.source_type === 'measured' ? 'Measured' : item.source_type === 'evidence_derived' ? 'Evidence-derived' : 'AI analysis'}
                              {item.confidence ? ` - ${Math.round(Number(item.confidence) * 100)}% confidence` : ''}
                            </p>
                          )}
                          {item.avoid && <p className="mt-3 text-xs text-slate-500"><span className="font-medium text-slate-600">Avoid:</span> {item.avoid}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="glass-card-v2 p-6">
                  <h5 className="mb-5 flex items-center gap-2 text-xs font-semibold text-slate-700"><PlayCircle className="h-5 w-5 text-slate-500" /> Recommended execution steps</h5>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {toArray(promptDetailData.recommended_actions).map((item, idx) => (
                      <div key={idx} className="glass-inset flex flex-col justify-between rounded-xl p-5">
                        <div>
                          <h6 className="mb-2 text-sm font-semibold text-slate-900">{item.title}</h6>
                          <p className="text-xs leading-relaxed text-slate-600">{renderTextWithLinks(item.detail)}</p>
                          {toArray(item.action_plan).length > 0 && (
                            <ul className="mt-2.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
                              {toArray(item.action_plan).slice(0, 4).map((step) => <li key={step}>{renderTextWithLinks(step)}</li>)}
                            </ul>
                          )}
                        </div>
                        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:underline">Open link <ExternalLink className="h-3 w-3" /></a>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card-v2 p-8">
                  <h5 className="mb-8 flex items-center gap-2 text-[10px] font-bold tracking-tight text-slate-500"><FileText className="h-4 w-4" /> Cited Sources & Knowledge Points</h5>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{toArray(promptDetailData.sources).slice(0, 30).map((source) => (<details key={source.domain} className="glass-card-v2 group h-fit overflow-hidden transition-all hover:border-brand-primary/20"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 hover:bg-slate-50"><span className="flex items-center gap-3"><img src={`https://www.google.com/s2/favicons?domain=${source.domain.split(' ')[0]}&sz=32`} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-4 w-4 opacity-40 grayscale transition-all group-hover:opacity-100 group-hover:grayscale-0" onError={(e) => { e.target.style.display = 'none'; }} /><span className={`truncate text-sm font-bold max-w-[140px] ${source.domain.includes('(Target Content)') ? 'text-brand-primary' : 'text-slate-900'}`}>{source.domain}</span></span><span className="rounded-full border border-slate-200/60 px-2.5 py-1 text-[10px] font-bold text-slate-500 transition-all group-hover:border-brand-primary/20 group-hover:text-brand-primary">{source.mentions || 0} Hits</span></summary><ul className="space-y-4 border-t border-slate-200/60 bg-slate-50/50 px-5 pb-5 pt-3">{toArray(source.links).map((linkObj, lIdx) => (<li key={(linkObj.url || '') + lIdx} className="group/link flex flex-col gap-2">{linkObj.title && <span className="text-[11px] font-bold leading-snug text-slate-700 transition-colors group-hover/link:text-brand-primary">{linkObj.title}</span>}<div className="flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200/60 bg-white p-2.5"><ExternalLink className="h-3 w-3 shrink-0 text-slate-500" /><a href={linkObj.url} target="_blank" rel="noreferrer" className="truncate text-[10px] font-bold text-slate-500 hover:text-brand-primary" title={linkObj.url}>{linkObj.url}</a></div></li>))}</ul></details>))}</div>
                </div>
              </div>
            )}
        </motion.section>
      )}

      {improveTarget && (
        <ImprovePromptModal
          promptId={improveTarget.prompt_id}
          originalText={improveTarget.prompt_text}
          projectName={project?.name || ''}
          industry={project?.category || ''}
          onClose={() => setImproveTarget(null)}
          onAccept={async (rewritten) => {
            try {
              await api.updatePrompt(improveTarget.prompt_id, { prompt_text: rewritten });
              queryClient.invalidateQueries({ queryKey: ['prompts', id] });
              queryClient.invalidateQueries({ queryKey: ['prompt-analysis', id] });
            } finally {
              setImproveTarget(null);
            }
          }}
        />
      )}
    </div>
  );
};

function ImprovePromptModal({ promptId, originalText, projectName, industry, onClose, onAccept }) {
  const [editable, setEditable] = useState('');
  const [saving, setSaving] = useState(false);
  const improveMutation = useMutation({
    mutationFn: () =>
      api.improvePrompt(promptId, {
        prompt_text: originalText,
        focus_brand: projectName,
        industry,
      }),
    onSuccess: (data) => {
      if (data?.rewritten_prompt) setEditable(data.rewritten_prompt);
    },
  });

  useEffect(() => {
    improveMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggestion = improveMutation.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-brand-primary" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Improve this prompt</p>
              <p className="text-[11px] text-slate-400">A tighter version of your prompt for testing (same idea, cleaner words).</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Original</p>
            <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">{originalText}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-400">Rewrite</p>
            {improveMutation.isPending ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating a crisper version...
              </div>
            ) : (
              <textarea
                value={editable}
                onChange={(e) => setEditable(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            )}
            {suggestion?.reasoning && (
              <p className="mt-1 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">Why: </span>{suggestion.reasoning}
              </p>
            )}
            {typeof suggestion?.quality_score === 'number' && (
              <p className="mt-1 text-[11px] text-slate-400">Quality score: {suggestion.quality_score}</p>
            )}
          </div>

          {Array.isArray(suggestion?.alternative_angles) && suggestion.alternative_angles.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400">Alternative angles</p>
              <div className="mt-1 space-y-1">
                {suggestion.alternative_angles.map((alt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditable(alt)}
                    className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-brand-primary hover:bg-brand-primary/5"
                  >
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand-primary" />
                    <span>{alt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              if (!editable.trim() || editable.trim() === originalText.trim()) {
                onClose();
                return;
              }
              setSaving(true);
              try {
                await onAccept(editable.trim());
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || improveMutation.isPending || !editable.trim()}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
            Replace prompt
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetailView;
