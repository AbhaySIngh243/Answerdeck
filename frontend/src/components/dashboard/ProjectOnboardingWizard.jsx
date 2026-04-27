import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Globe2,
  Info,
  Loader2,
  Plus,
  Rocket,
  Sparkles,
  Target,
  Wand2,
  X,
} from 'lucide-react';

import { api } from '../../lib/api';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import OnboardingAssistant from './OnboardingAssistant';

const TOTAL_STEPS = 5;

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
      'deepseek',
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

export default function ProjectOnboardingWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [suggestedCompetitors, setSuggestedCompetitors] = useState([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [customStage, setCustomStage] = useState('awareness');
  const [launchingAnalysis, setLaunchingAnalysis] = useState(false);
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
    mutationFn: async () => {
      setLaunchingAnalysis(true);
      await saveStepMutation.mutateAsync({ step: TOTAL_STEPS, data: buildStepPayload(TOTAL_STEPS) });
      await api.completeOnboarding(id);
      return api.runAllPromptAnalysis(id, {
        searchProvider: form.step4.search_provider,
      });
    },
    onSuccess: () => navigate(`/dashboard/project/${id}`),
    onSettled: () => setLaunchingAnalysis(false),
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
    onSuccess: (payload) => {
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
          next.step2 = { ...next.step2, competitors: incomingCompetitors };
        }
        return next;
      });
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
    if (currentStep === 2) return form.step2.competitors.length > 0;
    if (currentStep === 3) return form.step3.seed_prompts.length > 0;
    if (currentStep === 4) return form.step4.target_engines.length > 0;
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
    await saveStepMutation.mutateAsync({ step: currentStep, data: buildStepPayload(currentStep) });
  }

  const [suggestionsRequestedForStep, setSuggestionsRequestedForStep] = useState(0);

  useEffect(() => {
    if (!form || suggestionsMutation.isPending) return;
    const hasBrandAndIndustry = form.step1?.brand_name && form.step1?.industry;
    if (!hasBrandAndIndustry) return;

    if (
      (currentStep === 1 || currentStep === 2) &&
      suggestedCompetitors.length === 0 &&
      suggestionsRequestedForStep !== currentStep
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
      suggestionsRequestedForStep !== 3
    ) {
      setSuggestionsRequestedForStep(3);
      suggestionsMutation.mutate();
    }
  }, [
    currentStep,
    form?.step1?.brand_name,
    form?.step1?.industry,
    suggestedCompetitors.length,
    form?.step3?.seed_prompts?.length,
  ]);

  useEffect(() => {
    if (currentStep === 2 && form && form.step2.competitors.length === 0) {
      if (form.step1.competitors.length > 0) {
        updateField('step2', 'competitors', [...form.step1.competitors]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, form?.step1?.competitors]);

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
    const step2Current = form.step2.competitors;
    if (!step2Current.some((c) => c.toLowerCase() === name.toLowerCase())) {
      updateField('step2', 'competitors', [...step2Current, name]);
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
      }
    : {};

  if (isLoading || !form) {
    return (
      <div className="flex h-52 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  const isBusy =
    saveStepMutation.isPending || completeMutation.isPending || launchingAnalysis;

  const siteSummary = {
    has_domain: Boolean(form.step1.domain),
    brand: form.step1.brand_name,
    industry: form.step1.industry,
    region: form.step1.region,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-28 lg:pr-[380px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Set up your project</h1>
          <p className="text-sm text-slate-500">
            Step {currentStep} of {TOTAL_STEPS} &mdash;{' '}
            {currentStep === 1 && 'Tell us about your brand'}
            {currentStep === 2 && 'Confirm your direct competitors'}
            {currentStep === 3 && 'Pick the prompts we will track'}
            {currentStep === 4 && 'Choose AI engines & search grounding'}
            {currentStep === 5 && 'Review & launch'}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/dashboard/projects">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Projects
          </Link>
        </Button>
      </div>

      <div className="flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < currentStep ? 'bg-brand-primary' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Brand identity */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Brand identity</CardTitle>
            <CardDescription>
              How your brand shows up to the AI engines we will query.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {siteSummary.has_domain && (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <div>
                  <p className="font-semibold text-slate-700">
                    Tracking {siteSummary.brand || 'this brand'} on {form.step1.domain}
                  </p>
                  <p>
                    {siteSummary.industry || 'Industry TBD'} · {siteSummary.region || 'Region TBD'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
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
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-brand-primary hover:text-brand-primary"
                      >
                        <Plus className="h-3 w-3" /> {c}
                      </button>
                    ))}
                </div>
              )}
              {form.step1.brand_name && form.step1.industry && !suggestionsMutation.isPending && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
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
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Competitor discovery */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm competitors</CardTitle>
            <CardDescription>
              These are the brands we'll rank against in every engine answer. Aim for 4–8 true
              head-to-head competitors — not parent companies or marketplaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Competitors to track *</label>
              <TagInput
                tags={form.step2.competitors}
                onChange={(val) => updateField('step2', 'competitors', val)}
                placeholder="Type a competitor and press Enter"
              />
              <p className="text-xs text-slate-400">
                Matches your brand identity step; you can prune or extend the list here.
              </p>
            </div>

            {suggestedCompetitors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  AI suggestions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedCompetitors
                    .filter(
                      (c) =>
                        !form.step2.competitors.some((t) => t.toLowerCase() === c.toLowerCase()),
                    )
                    .slice(0, 8)
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
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Why this matters</p>
                <p>
                  A tight competitor list lets the audit say "you're losing to X on Y intent",
                  instead of a vague "you're not ranked". The AI will ground every comparison in
                  these specific names.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Prompt intent map */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Tracking prompts</CardTitle>
            <CardDescription>
              Real user questions we'll ask every engine. Aim for 3–10 prompts spread across funnel
              stages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
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
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
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
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Engines + grounding */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Engines & grounding</CardTitle>
            <CardDescription>
              Every prompt is asked to each engine below. Search grounding injects live web
              results so models cite real, verifiable pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Engines to query *</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableEngines.map((engine) => {
                  const selected = form.step4.target_engines.includes(engine.id);
                  return (
                    <label
                      key={engine.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleEngine(engine.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-primary accent-brand-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{engine.name}</p>
                        <p className="text-xs text-slate-400">{engine.model}</p>
                      </div>
                    </label>
                  );
                })}
                {availableEngines.length === 0 && (
                  <p className="col-span-2 text-sm text-slate-400">
                    No engines configured. Check your API keys on the backend.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Search grounding</p>
              <div className="space-y-1.5">
                {SEARCH_PROVIDERS.map((provider) => {
                  const selected = form.step4.search_provider === provider.id;
                  return (
                    <label
                      key={provider.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="search_provider"
                        checked={selected}
                        onChange={() => updateField('step4', 'search_provider', provider.id)}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-brand-primary accent-brand-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{provider.label}</p>
                        <p className="text-xs text-slate-500">{provider.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — Review + launch */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & launch</CardTitle>
            <CardDescription>
              We'll run your first analysis in the background. First pass takes 30–90 seconds
              depending on engine count.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</p>
                <p className="mt-1 text-slate-800">{form.step1.brand_name || '—'}</p>
                <p className="text-xs text-slate-500">
                  {form.step1.domain} · {form.step1.industry} · {form.step1.region}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Competitors ({form.step2.competitors.length})
                </p>
                <p className="mt-1 text-slate-700">
                  {form.step2.competitors.slice(0, 6).join(', ') || '—'}
                  {form.step2.competitors.length > 6 ? ', …' : ''}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Engines & grounding
                </p>
                <p className="mt-1 text-slate-700">
                  {form.step4.target_engines.map((e) => e.toUpperCase()).join(', ') || '—'}
                </p>
                <p className="text-xs text-slate-500">
                  Search: {form.step4.search_provider}
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
          </CardContent>
        </Card>
      )}

      {(saveStepMutation.isError || completeMutation.isError || launchMutation.isError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {String(
            saveStepMutation.error?.message ||
              completeMutation.error?.message ||
              launchMutation.error?.message ||
              'Failed to save onboarding step',
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setForm((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }))}
          disabled={currentStep <= 1 || isBusy}
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
              {completeMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
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

      <OnboardingAssistant projectId={id} step={currentStep} context={assistantContext} />
    </div>
  );
}
