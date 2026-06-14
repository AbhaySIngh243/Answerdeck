import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Plus,
  Rocket,
  Send,
  Sparkles,
  Target,
  Wand2,
  X,
} from 'lucide-react';

import { api, waitForAnalysisJob } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import BrandLogo from '../BrandLogo';
import AnalysisLaunchScreen from './AnalysisLaunchScreen';

const TOTAL_STEPS = 5;
const STEP_FLOW = [1, 3, 4, 5];
const DISPLAY_TOTAL = STEP_FLOW.length;

function displayIndexFor(step) {
  const idx = STEP_FLOW.indexOf(step);
  return idx >= 0 ? idx + 1 : 1;
}

function previousFlowStep(step) {
  const idx = STEP_FLOW.indexOf(step);
  if (idx <= 0) return STEP_FLOW[0];
  return STEP_FLOW[idx - 1];
}

const BRAND_PRIORITIES = [
  { id: 'visibility', label: 'Brand visibility', description: 'How often is your brand mentioned vs competitors?' },
  { id: 'positioning', label: 'Positioning strength', description: 'Is your brand positioned as a leader or alternative?' },
  { id: 'sentiment', label: 'Sentiment & trust', description: 'Is the tone positive, neutral, or negative?' },
  { id: 'differentiation', label: 'Differentiation', description: 'Are your unique strengths being highlighted?' },
  { id: 'accuracy', label: 'Factual accuracy', description: 'Are facts about your brand correct?' },
];

const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional', description: 'Formal, authoritative, business-focused' },
  { id: 'friendly', label: 'Friendly & approachable', description: 'Conversational, warm, accessible' },
  { id: 'innovative', label: 'Innovative', description: 'Cutting-edge, bold, forward-thinking' },
  { id: 'trustworthy', label: 'Trustworthy', description: 'Reliable, secure, proven' },
  { id: 'playful', label: 'Playful', description: 'Fun, quirky, personality-driven' },
];

const INDUSTRIES = [
  'Technology',
  'SaaS / Software',
  'E-Commerce',
  'Finance & Banking',
  'Healthcare',
  'Education',
  'Marketing & Advertising',
  'Real Estate',
  'Travel & Hospitality',
  'Food & Beverage',
  'Automotive',
  'Retail',
  'Media & Entertainment',
  'Telecommunications',
  'Energy',
  'Manufacturing',
  'Legal',
  'Consulting',
  'Non-Profit',
  'Other',
];

const REGIONS = [
  'Global',
  'United States',
  'United Kingdom',
  'Europe',
  'India',
  'Canada',
  'Australia',
  'Southeast Asia',
  'Middle East',
  'Latin America',
  'Africa',
];

const FUNNEL_STAGES = ['awareness', 'consideration', 'decision'];
const FUNNEL_DESCRIPTIONS = {
  awareness: 'People exploring the category for the first time.',
  consideration: 'People comparing specific options and shortlisting.',
  decision: 'People about to buy and validating their final pick.',
};

const SEARCH_PROVIDERS = [
  {
    id: 'auto',
    label: 'Auto (recommended)',
    description: 'Uses Serper (Google) when available; falls back to Perplexity search.',
  },
  { id: 'serper', label: 'Serper (Google)', description: 'Google SERP for high-accuracy grounding.' },
  { id: 'perplexity', label: 'Perplexity', description: 'Live web results via Perplexity.' },
  { id: 'none', label: 'No grounding', description: 'Use raw engine responses without search context.' },
];

const STEP_HELP = {
  1: {
    heading: 'Make this brand findable',
    summary: 'Two minutes of context here sharpens every later analysis.',
    tips: [
      {
        title: 'Use the name customers say',
        body: 'Plain-language brand name — not the legal entity or holding company.',
      },
      {
        title: 'Use your primary domain',
        body: 'Your main marketing site (not an app.* subdomain or staging URL).',
      },
      {
        title: '4–8 head-to-head competitors',
        body: 'Direct alternatives buyers compare against — not marketplaces or parents.',
      },
    ],
  },
  3: {
    heading: 'Pick the prompts that matter',
    summary: 'These are the questions we will ask every AI engine, on repeat.',
    tips: [
      {
        title: 'Use customer phrasing',
        body: 'Real questions buyers type, not your marketing copy.',
      },
      {
        title: 'Cover the full funnel',
        body: 'Mix awareness, consideration, and decision-stage prompts.',
      },
      {
        title: 'Skip your brand name',
        body: 'We want to see how engines answer cold — without you in the prompt.',
      },
    ],
  },
  4: {
    heading: 'Anchor the analysis',
    summary: 'A clearer brand strategy means sharper, more useful audits.',
    tips: [
      {
        title: 'One-sentence promise',
        body: 'Why customers pick you over the alternatives — in plain language.',
      },
      {
        title: 'Concrete differentiators',
        body: 'Specific strengths the AI should look for in answers.',
      },
      {
        title: 'Pick a few priorities',
        body: 'The 2–3 things you care about most — not everything.',
      },
    ],
  },
  5: {
    heading: 'Ready to launch',
    summary: 'First analysis usually takes 30–90 seconds depending on engine count.',
    tips: [
      {
        title: 'Everything is editable',
        body: 'Prompts, competitors, and strategy can all be tuned after launch.',
      },
      {
        title: 'Where to look next',
        body: 'Open your project to see the first visibility audit when it lands.',
      },
      {
        title: 'Need a hand?',
        body: 'Use the ask box below — we can refine prompts or priorities for you.',
      },
    ],
  },
};

function OnboardingHelpPanel({ projectId, step, context }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);

  const helpEntry = STEP_HELP[step] || STEP_HELP[1];

  const askMutation = useMutation({
    mutationFn: (payload) => api.askOnboardingAssistant(projectId, payload),
    onSuccess: (data) => setAnswer(data),
  });

  useEffect(() => {
    setAnswer(null);
    setQuestion('');
    askMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function handleAsk(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || askMutation.isPending) return;
    askMutation.mutate({ step, context, question: text });
  }

  return (
    <aside className="relative flex min-h-screen w-full min-w-0 flex-col overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute -right-32 -top-24 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <BrandLogo
          variant="mark"
          size="sm"
          className="rounded-2xl bg-white/95 p-2 shadow-lg shadow-black/30"
        />
        <span className="text-[10px] font-semibold tracking-wide text-blue-200/70">
          Step {displayIndexFor(step)} of {DISPLAY_TOTAL}
        </span>
      </div>

      <div className="relative mt-10 w-full max-w-xl lg:max-w-none">
        <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {helpEntry.heading}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{helpEntry.summary}</p>

        <ul className="mt-6 space-y-3">
          {helpEntry.tips.map((tip) => (
            <li
              key={tip.title}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-400/15 text-blue-200">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{tip.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{tip.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-auto pt-8">
        {answer ? (
          <div className="mb-3 max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-xs leading-5 text-slate-200">
            {answer.tip ? (
              <p className="text-sm font-medium text-white">{answer.tip}</p>
            ) : null}
            {answer.recommended_action ? (
              <p className="mt-2">
                <span className="font-semibold text-blue-200">Next step:</span>{' '}
                {answer.recommended_action}
              </p>
            ) : null}
            {Array.isArray(answer.examples) && answer.examples.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                {answer.examples.slice(0, 3).map((ex, i) => (
                  <li key={i} className="rounded bg-white/[0.05] px-2 py-1">
                    {ex}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={handleAsk}
          className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-3 py-2 focus-within:border-blue-300/60 focus-within:bg-white/[0.08]"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-blue-200" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this step…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!question.trim() || askMutation.isPending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
            aria-label="Ask"
          >
            {askMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </form>
        {askMutation.isError ? (
          <p className="mt-2 text-[11px] text-red-300">
            {askMutation.error?.message ||
              'Assistant is offline right now — you can still keep moving.'}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-slate-400">
            Suggestions are auto-generated based on your brand context. Ask if you need custom ideas.
          </p>
        )}
      </div>
    </aside>
  );
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeStringList(parsed);
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function normalizeObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function dedupeTrimmed(values, maxItems = 8) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const text = String(raw || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function defaultFormState(project) {
  const onboarding = project?.onboarding || {};
  const steps = onboarding?.steps || {};

  // Legacy projects stored seed_prompts under step "2"; prefer new step "3".
  const legacySeedPrompts = steps?.['2']?.seed_prompts || [];
  const step3SeedPrompts = steps?.['3']?.seed_prompts || legacySeedPrompts;
  const step1Competitors = normalizeStringList(steps?.['1']?.competitors || project?.competitors);
  const step2Competitors = normalizeStringList(steps?.['2']?.competitors || project?.competitors);
  const step3Prompts = normalizeStringList(step3SeedPrompts);
  const step3PromptStages = normalizeObject(steps?.['3']?.prompt_stages);
  const step4Engines = normalizeStringList(
    steps?.['4']?.target_engines || steps?.['3']?.target_engines || [
      'chatgpt',
      'claude',
      'perplexity',
      'gemini',
    ],
  );

  return {
    step: Math.min(TOTAL_STEPS, Number(onboarding?.current_step || 1) || 1),
    step1: {
      brand_name: steps?.['1']?.brand_name || project?.name || '',
      domain: steps?.['1']?.domain || project?.website_url || '',
      industry: steps?.['1']?.industry || project?.category || '',
      region: steps?.['1']?.region || project?.region || 'Global',
      competitors: step1Competitors,
    },
    step2: {
      competitors: step2Competitors,
      competitor_notes: normalizeObject(steps?.['2']?.competitor_notes),
    },
    step3: {
      seed_prompts: step3Prompts,
      prompt_stages: step3PromptStages,
      funnel_stage: steps?.['3']?.funnel_stage || steps?.['2']?.funnel_stage || 'awareness',
    },
    step4: {
      target_engines: step4Engines,
      search_provider: steps?.['4']?.search_provider || 'auto',
      // New brand strategy fields
      value_proposition: steps?.['4']?.value_proposition || '',
      target_audience: steps?.['4']?.target_audience || '',
      key_differentiators: normalizeStringList(steps?.['4']?.key_differentiators || []),
      messaging_priorities: normalizeStringList(steps?.['4']?.messaging_priorities || []),
      brand_tone: steps?.['4']?.brand_tone || '',
      analysis_priorities: normalizeStringList(steps?.['4']?.analysis_priorities || ['visibility', 'positioning']),
    },
    step5: { acknowledged: Boolean(steps?.['5']?.acknowledged) },
  };
}

function TagInput({ tags, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  function commitValue(value) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue('');
      return;
    }
    onChange([...tags, trimmed]);
    setInputValue('');
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    commitValue(inputValue);
  }

  function removeTag(index) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-brand-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-primary/15">
      {tags.map((tag, i) => (
        <Badge key={`${tag}-${i}`} variant="default" className="gap-1 pl-2 pr-1">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="rounded-full p-0.5 hover:bg-brand-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && commitValue(inputValue)}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="min-w-[140px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}

function promptQualityScore(prompt, brandName) {
  const text = String(prompt || '').trim();
  if (!text) return { score: 0, label: 'empty', reasons: ['Write a prompt.'] };
  const words = text.split(/\s+/).filter(Boolean);
  const reasons = [];
  let score = 60;

  if (words.length < 5) {
    score -= 25;
    reasons.push('Too short — aim for 5–12 words.');
  } else if (words.length > 14) {
    score -= 15;
    reasons.push('Too long — trim toward ~8 words.');
  } else {
    score += 10;
  }

  const lower = text.toLowerCase();
  const brandLower = String(brandName || '').toLowerCase().trim();
  if (brandLower && brandLower.length >= 2 && lower.includes(brandLower)) {
    score -= 35;
    reasons.push('Remove your brand name — test how LLMs answer without it.');
  }

  if (/\b(vs|versus)\b/.test(lower)) {
    score -= 15;
    reasons.push('Avoid "vs" / "versus" — pure comparison prompts rank poorly.');
  }

  if (/\b(best|top|recommended|affordable|cheap|budget|for)\b/.test(lower)) {
    score += 10;
  } else {
    reasons.push('Add intent keywords like "best", "top", or "for <audience>".');
  }

  const clamped = Math.max(0, Math.min(100, score));
  const label = clamped >= 80 ? 'strong' : clamped >= 60 ? 'good' : clamped >= 40 ? 'weak' : 'needs work';
  return { score: clamped, label, reasons };
}

async function invalidateProjectQueries(queryClient, projectId, promptId) {
  const keys = [
    ['project', projectId],
    ['project-core', projectId],
    ['project-dashboard', projectId],
    ['prompts', projectId],
    ['prompt-analysis', projectId],
    ['deep-analysis', projectId],
    ['sources-intelligence', projectId],
    ['competitor-intelligence', projectId],
    ['intel-summary', projectId],
    ['global-audit', projectId],
    ['billing', 'me'],
  ];
  if (promptId) keys.push(['prompt-detail', promptId]);
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export default function ProjectOnboardingWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [suggestedCompetitors, setSuggestedCompetitors] = useState([]);
  const [suggestionsFetchState, setSuggestionsFetchState] = useState('idle');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customStage, setCustomStage] = useState('awareness');
  const [launchingAnalysis, setLaunchingAnalysis] = useState(false);
  const [launchDetail, setLaunchDetail] = useState('');
  const [promptError, setPromptError] = useState('');

  const currentStep = form?.step || 1;

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
    enabled: Boolean(id),
  });

  const { data: enginesData } = useQuery({
    queryKey: ['engines'],
    queryFn: () => api.getEngines(),
  });

  const availableEngines = useMemo(
    () => (enginesData?.available_engines || []).filter((e) => e.enabled),
    [enginesData],
  );

  useEffect(() => {
    if (project && !form) setForm(defaultFormState(project));
  }, [project, form]);

  const saveStepMutation = useMutation({
    mutationFn: ({ step, data }) => api.updateOnboardingStep(id, { step, data }),
    onSuccess: (payload) => {
      const nextStep = Number(payload?.project?.onboarding_current_step || currentStep + 1);
      setForm((prev) => ({ ...prev, step: Math.min(TOTAL_STEPS, nextStep) }));
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await saveStepMutation.mutateAsync({ step: TOTAL_STEPS, data: buildStepPayload(TOTAL_STEPS) });
      return api.completeOnboarding(id);
    },
    onSuccess: () => navigate(`/dashboard/project/${id}`),
  });

  const launchMutation = useMutation({
    onMutate: () => {
      setLaunchingAnalysis(true);
      setLaunchDetail('Saving your setup and preparing the first prompt.');
    },
    mutationFn: async () => {
      await saveStepMutation.mutateAsync({ step: TOTAL_STEPS, data: buildStepPayload(TOTAL_STEPS) });
      const completed = await api.completeOnboarding(id);
      const prompts = Array.isArray(completed?.prompts) ? completed.prompts : [];
      const firstPrompt = prompts[0];
      if (!firstPrompt?.id) {
        throw new Error('No onboarding prompt was available to run.');
      }

      setLaunchDetail('Running the first prompt across your selected engines.');
      const firstRun = await api.runPromptAnalysis(firstPrompt.id, {
        searchProvider: form.step4.search_provider,
      });
      if (firstRun?.job_id) {
        await waitForAnalysisJob(firstRun.job_id);
      }
      setLaunchDetail('Refreshing your dashboard with the first result.');
      await invalidateProjectQueries(queryClient, id, firstPrompt.id);

      const remainingPrompts = prompts.slice(1).filter((prompt) => prompt?.id);
      const backgroundRuns = await Promise.allSettled(
        remainingPrompts.map((prompt) =>
          api
            .runPromptAnalysis(prompt.id, { searchProvider: form.step4.search_provider })
            .then((run) => ({ prompt_id: prompt.id, job_id: run?.job_id }))
        )
      );
      const analysisJobs = backgroundRuns
        .filter((result) => result.status === 'fulfilled' && result.value?.job_id)
        .map((result) => result.value);

      return { analysisJobs, firstPromptId: firstPrompt.id };
    },
    onSuccess: (payload) => {
      navigate(`/dashboard/project/${id}`, {
        state: {
          analysisJobs: Array.isArray(payload?.analysisJobs) ? payload.analysisJobs : [],
        },
      });
    },
    onSettled: () => {
      setLaunchingAnalysis(false);
      setLaunchDetail('');
    },
  });

  const buildSuggestionContext = useCallback(() => {
    const s = form?.step1 || {};
    return {
      hint: s.industry || '',
      brand_name: s.brand_name || '',
      domain: s.domain || '',
      industry: s.industry || '',
      region: s.region || '',
      competitors: s.competitors || [],
    };
  }, [form]);

  const suggestionsMutation = useMutation({
    mutationFn: () => api.getOnboardingSuggestions(id, buildSuggestionContext()),
    onMutate: () => {
      setSuggestionsFetchState('loading');
    },
    onSuccess: (payload) => {
      setSuggestionsFetchState('success');
      setSuggestedPrompts(payload?.suggested_prompts || []);
      const incomingCompetitors = dedupeTrimmed(payload?.suggested_competitors || [], 8);
      setSuggestedCompetitors(incomingCompetitors);

      // Auto-fill competitor tags only when empty (user preference: don't overwrite).
      setForm((prev) => {
        if (!prev) return prev;
        const currentIndustry = String(prev.step1?.industry || '').trim();
        const suggestedIndustry = String(payload?.suggested_industry || '').trim();
        const shouldApplyIndustry = !currentIndustry && suggestedIndustry;

        const current = Array.isArray(prev.step1?.competitors) ? prev.step1.competitors : [];
        const shouldApplyCompetitors = current.length === 0 && incomingCompetitors.length > 0;
        if (!shouldApplyIndustry && !shouldApplyCompetitors) return prev;

        const next = { ...prev };
        if (shouldApplyIndustry) {
          next.step1 = { ...next.step1, industry: suggestedIndustry };
        }
        if (shouldApplyCompetitors) {
          next.step1 = { ...next.step1, competitors: incomingCompetitors };
        }
        return next;
      });
    },
    onError: () => {
      setSuggestionsFetchState('error');
    },
  });

  const improvePromptMutation = useMutation({
    mutationFn: ({ prompt, funnel_stage }) =>
      api.draftPrompt({
        prompt_text: prompt,
        focus_brand: form?.step1?.brand_name || '',
        industry: form?.step1?.industry || '',
        funnel_stage,
      }),
  });

  const canContinue = useMemo(() => {
    if (!form) return false;
    if (currentStep === 1) {
      const s = form.step1;
      return Boolean(
        s.brand_name && s.domain && s.industry && s.region && s.competitors.length > 0,
      );
    }
    if (currentStep === 3) return form.step3.seed_prompts.length > 0;
    if (currentStep === 4) {
      return (
        form.step4.value_proposition.trim().length > 0 &&
        form.step4.analysis_priorities.length > 0
      );
    }
    if (currentStep === 5) return true;
    return false;
  }, [form, currentStep]);

  function buildStepPayload(step) {
    if (!form) return {};
    if (step === 1) return { ...form.step1 };
    if (step === 2) return { ...form.step2 };
    if (step === 3) return { ...form.step3 };
    if (step === 4) return { ...form.step4 };
    if (step === 5) return { acknowledged: true };
    return {};
  }

  function updateField(stepKey, field, value) {
    setForm((prev) => ({ ...prev, [stepKey]: { ...prev[stepKey], [field]: value } }));
  }

  async function handleNext() {
    if (currentStep === 1) {
      await saveStepMutation.mutateAsync({
        step: 1,
        data: buildStepPayload(1),
      });
      await saveStepMutation.mutateAsync({
        step: 2,
        data: { competitors: form.step1.competitors },
      });
      return;
    }
    await saveStepMutation.mutateAsync({ step: currentStep, data: buildStepPayload(currentStep) });
  }

  const [suggestionsRequestedForStep, setSuggestionsRequestedForStep] = useState(0);

  useEffect(() => {
    if (!form || suggestionsMutation.isPending) return;
    const hasBrandAndSite = form.step1?.brand_name?.trim() && form.step1?.domain?.trim();
    if (!hasBrandAndSite) return;

    if (
      currentStep === 1 &&
      suggestedCompetitors.length === 0 &&
      suggestionsRequestedForStep !== currentStep &&
      suggestionsFetchState !== 'error'
    ) {
      const timer = setTimeout(() => {
        setSuggestionsRequestedForStep(currentStep);
        suggestionsMutation.mutate();
      }, 600);
      return () => clearTimeout(timer);
    }

    if (
      currentStep === 3 &&
      form.step3?.seed_prompts?.length === 0 &&
      suggestionsRequestedForStep !== 3 &&
      suggestionsFetchState !== 'error'
    ) {
      setSuggestionsRequestedForStep(3);
      suggestionsMutation.mutate();
    }
  }, [
    currentStep,
    form?.step1?.brand_name,
    form?.step1?.domain,
    form?.step1?.industry,
    suggestedCompetitors.length,
    form?.step3?.seed_prompts?.length,
    suggestionsMutation.isPending,
    suggestionsRequestedForStep,
    suggestionsFetchState,
  ]);

  function togglePromptSelection(prompt, stage = form?.step3?.funnel_stage || 'awareness') {
    if (!form) return;
    const current = form.step3.seed_prompts;
    const stages = { ...(form.step3.prompt_stages || {}) };
    if (current.includes(prompt)) {
      updateField(
        'step3',
        'seed_prompts',
        current.filter((p) => p !== prompt),
      );
      delete stages[prompt];
      updateField('step3', 'prompt_stages', stages);
    } else {
      updateField('step3', 'seed_prompts', [...current, prompt]);
      stages[prompt] = stage;
      updateField('step3', 'prompt_stages', stages);
    }
  }

  function addCustomPrompt() {
    setPromptError('');
    const text = customPrompt.trim();
    if (!text) return;
    const { score, reasons } = promptQualityScore(text, form?.step1?.brand_name);
    if (score < 40) {
      setPromptError(reasons[0] || 'Prompt looks weak; refine and try again.');
      return;
    }
    if (!form.step3.seed_prompts.includes(text)) {
      const stages = { ...(form.step3.prompt_stages || {}) };
      stages[text] = customStage;
      updateField('step3', 'seed_prompts', [...form.step3.seed_prompts, text]);
      updateField('step3', 'prompt_stages', stages);
    }
    setCustomPrompt('');
  }

  async function polishPrompt() {
    const text = customPrompt.trim();
    if (!text) return;
    try {
      const result = await improvePromptMutation.mutateAsync({
        prompt: text,
        funnel_stage: customStage,
      });
      if (result?.rewritten_prompt) setCustomPrompt(result.rewritten_prompt);
    } catch {
      /* ignore — user can still add as-is */
    }
  }

  function toggleEngine(engineId) {
    const current = form.step4.target_engines;
    if (current.includes(engineId)) {
      updateField('step4', 'target_engines', current.filter((e) => e !== engineId));
    } else {
      updateField('step4', 'target_engines', [...current, engineId]);
    }
  }

  function addSuggestedCompetitor(name) {
    const step1Current = form.step1.competitors;
    if (!step1Current.some((c) => c.toLowerCase() === name.toLowerCase())) {
      updateField('step1', 'competitors', [...step1Current, name]);
    }
  }

  const assistantContext = form
    ? {
        step: currentStep,
        brand_name: form.step1.brand_name,
        domain: form.step1.domain,
        industry: form.step1.industry,
        region: form.step1.region,
        competitors: form.step1.competitors,
        seed_prompts: form.step3.seed_prompts,
        funnel_stage: form.step3.funnel_stage,
        target_engines: form.step4.target_engines,
        search_provider: form.step4.search_provider,
        value_proposition: form.step4.value_proposition,
        target_audience: form.step4.target_audience,
        key_differentiators: form.step4.key_differentiators,
        brand_tone: form.step4.brand_tone,
        analysis_priorities: form.step4.analysis_priorities,
      }
    : {};

  if (isLoading || !form) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <div className="relative">
          <div className="absolute -inset-3 animate-pulse rounded-full bg-brand-primary/10" />
          <Loader2 className="relative h-8 w-8 animate-spin text-brand-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">Retrieving your brand tracking settings…</p>
          <p className="text-xs text-slate-400">This can take a moment if the server is waking up.</p>
        </div>
      </div>
    );
  }

  if (launchingAnalysis) {
    return (
      <AnalysisLaunchScreen
        title="Your first prompt is under analysis."
        subtitle="It might take 1 to 2 minutes."
        detail={launchDetail}
      />
    );
  }

  const isBusy =
    saveStepMutation.isPending || completeMutation.isPending || launchingAnalysis;

  const displayStep = displayIndexFor(currentStep);
  const stepHeadlines = {
    1: { eyebrow: 'Brand identity', title: 'Tell us about your brand' },
    3: { eyebrow: 'Tracking prompts', title: 'Pick the prompts we will track' },
    4: { eyebrow: 'Brand strategy', title: 'Define your brand strategy' },
    5: { eyebrow: 'Review', title: 'Review and launch' },
  };
  const headline = stepHeadlines[currentStep] || stepHeadlines[1];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
        <main className="flex min-h-screen flex-col overflow-y-auto px-4 py-8 sm:px-8 md:px-12 lg:px-16 lg:py-12">
          <div className="flex w-full max-w-4xl flex-1 flex-col self-start">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-brand-primary">
                  {headline.eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                  {headline.title}
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Step {displayStep} of {DISPLAY_TOTAL}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to="/dashboard/projects">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Projects
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex gap-2">
              {STEP_FLOW.map((flowStep) => {
                const reached = STEP_FLOW.indexOf(flowStep) <= STEP_FLOW.indexOf(currentStep);
                return (
                  <div
                    key={flowStep}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      reached ? 'bg-brand-primary' : 'bg-slate-200'
                    }`}
                  />
                );
              })}
            </div>

            <div className="mt-10 space-y-6">
      {currentStep === 1 && (
        <section className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Brand name *</label>
                <Input
                  value={form.step1.brand_name}
                  onChange={(e) => updateField('step1', 'brand_name', e.target.value)}
                  placeholder="e.g. Acme Inc"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Public website *</label>
                <Input
                  value={form.step1.domain}
                  onChange={(e) => updateField('step1', 'domain', e.target.value)}
                  placeholder="e.g. acme.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Industry *</label>
                <Input
                  list="answerdeck-industries"
                  value={form.step1.industry}
                  onChange={(e) => updateField('step1', 'industry', e.target.value)}
                  placeholder="Start typing (e.g. SaaS / Software)"
                />
                <datalist id="answerdeck-industries">
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind} />
                  ))}
                </datalist>
                {suggestionsMutation.isPending && !form.step1.industry?.trim() && (
                  <p className="flex items-center gap-2 text-xs text-brand-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Inferring industry from your website…
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Region *</label>
                <Select
                  value={form.step1.region}
                  onChange={(e) => updateField('step1', 'region', e.target.value)}
                >
                  <option value="">Select region</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Competitors *{' '}
                <span className="font-normal text-slate-400">(press Enter to add)</span>
              </label>
              <TagInput
                tags={form.step1.competitors}
                onChange={(val) => updateField('step1', 'competitors', val)}
                placeholder="Type a competitor name and press Enter"
              />
              {suggestionsMutation.isPending && suggestedCompetitors.length === 0 && (
                <div className="flex items-center gap-2 pt-1 text-xs text-brand-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Finding likely competitors from your brand and site...
                </div>
              )}
              {suggestionsFetchState === 'error' && suggestedCompetitors.length === 0 && (
                <p className="pt-1 text-xs text-amber-700">
                  Could not reach AI suggestions right now. Add competitors manually or tap the
                  button below to retry.
                </p>
              )}
              {suggestionsFetchState === 'success' &&
                suggestedCompetitors.length === 0 &&
                !suggestionsMutation.isPending && (
                  <p className="pt-1 text-xs text-slate-500">
                    No competitor suggestions yet — type names above or retry with AI.
                  </p>
                )}
              {suggestedCompetitors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs text-slate-400">AI-suggested:</span>
                  {suggestedCompetitors
                    .filter(
                      (c) => !form.step1.competitors.some((t) => t.toLowerCase() === c.toLowerCase()),
                    )
                    .slice(0, 6)
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => addSuggestedCompetitor(c)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:border-brand-primary hover:text-brand-primary"
                      >
                        <Plus className="h-3 w-3" /> {c}
                      </button>
                    ))}
                </div>
              )}
              {form.step1.brand_name && form.step1.domain && !suggestionsMutation.isPending && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSuggestionsFetchState('idle');
                    setSuggestionsRequestedForStep(0);
                    suggestionsMutation.mutate();
                  }}
                  className="mt-1"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  {suggestedCompetitors.length > 0
                    ? 'Refresh AI suggestions'
                    : 'Suggest competitors with AI'}
                </Button>
              )}
            </div>
        </section>
      )}

      {currentStep === 3 && (
        <section className="space-y-5">
            {suggestionsMutation.isPending && (
              <div className="flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-3 text-sm text-brand-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating prompt suggestions based on your brand...
              </div>
            )}

            {suggestedPrompts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">AI-suggested prompts</p>
                <div className="space-y-1.5">
                  {suggestedPrompts.map((prompt) => {
                    const selected = form.step3.seed_prompts.includes(prompt);
                    const quality = promptQualityScore(prompt, form.step1.brand_name);
                    return (
                      <label
                        key={prompt}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          selected
                            ? 'border-brand-primary bg-brand-primary/5'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePromptSelection(prompt, form.step3.funnel_stage)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-primary accent-brand-primary"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-slate-700">{prompt}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Quality: {quality.label} ({quality.score})
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {!suggestionsMutation.isPending && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => suggestionsMutation.mutate()}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Regenerate suggestions
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-700">Add a custom prompt</p>
              <div className="flex flex-wrap items-center gap-2">
                {FUNNEL_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setCustomStage(stage)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      customStage === stage
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
                <span className="text-[11px] text-slate-400">
                  {FUNNEL_DESCRIPTIONS[customStage]}
                </span>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder='e.g. "Best project management tool for remote teams"'
                  rows={2}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addCustomPrompt();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={polishPrompt}
                    disabled={!customPrompt.trim() || improvePromptMutation.isPending}
                  >
                    {improvePromptMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={addCustomPrompt}
                    disabled={!customPrompt.trim()}
                    size="sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {customPrompt ? (
                <p className="text-[11px] text-slate-400">
                  Quality: {(() => {
                    const q = promptQualityScore(customPrompt, form.step1.brand_name);
                    return `${q.label} (${q.score})`;
                  })()}
                </p>
              ) : null}
              {promptError ? (
                <p className="text-[11px] text-red-500">{promptError}</p>
              ) : null}
            </div>

            {form.step3.seed_prompts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">
                  Selected ({form.step3.seed_prompts.length})
                </p>
                {form.step3.seed_prompts.map((p) => {
                  const stage = form.step3.prompt_stages?.[p] || form.step3.funnel_stage;
                  const quality = promptQualityScore(p, form.step1.brand_name);
                  return (
                    <div
                      key={p}
                      className="flex items-start gap-2 rounded-lg border border-brand-primary bg-brand-primary/5 p-2.5 text-sm text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      <div className="flex-1">
                        <p>{p}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {stage} · quality {quality.score}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePromptSelection(p, stage)}
                        className="rounded p-0.5 text-slate-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
        </section>
      )}

      {currentStep === 4 && (
        <section className="space-y-5">
          <p className="text-sm text-slate-500">
            Help us understand what makes your brand unique so our analysis can be more contextual and actionable.
          </p>
            {/* Value Proposition */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                What is your core value proposition? *
              </label>
              <p className="text-xs text-slate-400">
                In one sentence, why should customers choose you over alternatives?
              </p>
              <Textarea
                value={form.step4.value_proposition}
                onChange={(e) => updateField('step4', 'value_proposition', e.target.value)}
                placeholder="e.g. We help mid-size teams automate complex workflows without writing code..."
                rows={2}
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Who is your primary target audience?
              </label>
              <p className="text-xs text-slate-400">
                Describe the personas, roles, or segments you most want to reach.
              </p>
              <Textarea
                value={form.step4.target_audience}
                onChange={(e) => updateField('step4', 'target_audience', e.target.value)}
                placeholder="e.g. Operations managers at 50-500 person SaaS companies who are drowning in manual processes..."
                rows={2}
              />
            </div>

            {/* Key Differentiators */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Key differentiators
                <span className="font-normal text-slate-400"> (press Enter to add)</span>
              </label>
              <p className="text-xs text-slate-400">
                What specific strengths, features, or capabilities set you apart?
              </p>
              <TagInput
                tags={form.step4.key_differentiators}
                onChange={(val) => updateField('step4', 'key_differentiators', val)}
                placeholder="e.g. 24/7 human support, SOC 2 certified, no-code setup"
              />
            </div>

            {/* Brand Tone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                How would you describe your brand's tone of voice?
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TONE_OPTIONS.map((tone) => {
                  const selected = form.step4.brand_tone === tone.id;
                  return (
                    <label
                      key={tone.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="brand_tone"
                        checked={selected}
                        onChange={() => updateField('step4', 'brand_tone', tone.id)}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-brand-primary accent-brand-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{tone.label}</p>
                        <p className="text-xs text-slate-500">{tone.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Analysis Priorities */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                What matters most in your analysis? *
              </label>
              <p className="text-xs text-slate-400">
                Select the metrics you want us to prioritize in your reports.
              </p>
              <div className="space-y-1.5">
                {BRAND_PRIORITIES.map((priority) => {
                  const selected = form.step4.analysis_priorities.includes(priority.id);
                  return (
                    <label
                      key={priority.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const current = form.step4.analysis_priorities;
                          if (current.includes(priority.id)) {
                            updateField(
                              'step4',
                              'analysis_priorities',
                              current.filter((id) => id !== priority.id),
                            );
                          } else {
                            updateField('step4', 'analysis_priorities', [...current, priority.id]);
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-primary accent-brand-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{priority.label}</p>
                        <p className="text-xs text-slate-500">{priority.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

        </section>
      )}

      {currentStep === 5 && (
        <section className="space-y-5">
          <p className="text-sm text-slate-500">
            We will run your first analysis in the background. First pass takes 30–90 seconds depending on engine count.
          </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Brand</p>
                <p className="mt-1 text-slate-800">{form.step1.brand_name || '—'}</p>
                <p className="text-xs text-slate-500">
                  {form.step1.domain} · {form.step1.industry} · {form.step1.region}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">
                  Competitors ({form.step1.competitors.length})
                </p>
                <p className="mt-1 text-slate-700">
                  {form.step1.competitors.slice(0, 6).join(', ') || '—'}
                  {form.step1.competitors.length > 6 ? ', …' : ''}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">
                  Prompts ({form.step3.seed_prompts.length})
                </p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {form.step3.seed_prompts.slice(0, 5).map((p) => (
                    <li key={p} className="flex items-start gap-1.5">
                      <Target className="mt-0.5 h-3 w-3 shrink-0 text-brand-primary" />
                      <span>{p}</span>
                    </li>
                  ))}
                  {form.step3.seed_prompts.length > 5 ? (
                    <li className="text-slate-400">
                      + {form.step3.seed_prompts.length - 5} more
                    </li>
                  ) : null}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">
                  Brand strategy
                </p>
                <p className="mt-1 text-slate-700 line-clamp-2">
                  {form.step4.value_proposition || '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {form.step4.key_differentiators.length} differentiators ·{' '}
                  {form.step4.analysis_priorities.length} priorities
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm">
              <p className="font-medium text-slate-800">Ready to launch</p>
              <p className="mt-1 text-slate-600">
                We will run <strong>{form.step3.seed_prompts.length}</strong> prompt
                {form.step3.seed_prompts.length !== 1 ? 's' : ''} across{' '}
                <strong>{form.step4.target_engines.length}</strong> engine
                {form.step4.target_engines.length !== 1 ? 's' : ''}, verify cited URLs, and surface
                the first audit on your project dashboard.
              </p>
            </div>
        </section>
      )}
            </div>

            {(saveStepMutation.isError || completeMutation.isError || launchMutation.isError) && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {String(
                  saveStepMutation.error?.message ||
                    completeMutation.error?.message ||
                    launchMutation.error?.message ||
                    'Failed to save onboarding step',
                )}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between border-t border-slate-200/70 pt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    step: previousFlowStep(prev?.step || 1),
                  }))
                }
                disabled={currentStep === STEP_FLOW[0] || isBusy}
              >
                Back
              </Button>
              {currentStep < TOTAL_STEPS ? (
                <Button type="button" onClick={handleNext} disabled={!canContinue || isBusy}>
                  {saveStepMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => completeMutation.mutate()}
                    disabled={!canContinue || isBusy}
                  >
                    {completeMutation.isPending && (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Save without running
                  </Button>
                  <Button
                    type="button"
                    onClick={() => launchMutation.mutate()}
                    disabled={!canContinue || isBusy}
                  >
                    {launchingAnalysis ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="mr-1 h-4 w-4" />
                    )}
                    Launch first analysis
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>

        <OnboardingHelpPanel projectId={id} step={currentStep} context={assistantContext} />
      </div>
    </div>
  );
}
