import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, PlusCircle } from 'lucide-react';

import { api } from '../../lib/api';

const MAX_PROMPTS_PER_PROJECT = 10;

function buildSuggestedPrompts(project) {
  const brand = project?.name || 'our brand';
  const industry = project?.category || 'our industry';
  const region = project?.region || 'Global';

  return [
    `Best ${industry} tools in ${region}`,
    `${brand} alternatives and competitors`,
    `Is ${brand} good for small businesses?`,
    `${brand} pricing and features comparison`,
    `Top platforms for ${industry} teams`,
    `${brand} reviews and user feedback`,
    `How to choose the right ${industry} platform`,
  ];
}

export default function ProjectPromptSetupView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
    enabled: Boolean(id),
  });

  const { data: existingPrompts = [] } = useQuery({
    queryKey: ['prompts', id],
    queryFn: () => api.getPrompts(id),
    enabled: Boolean(id),
  });

  const {
    data: suggestedPayload,
    isLoading: suggestedLoading,
    error: suggestedError,
  } = useQuery({
    queryKey: ['project-suggested-prompts', id, project?.website_url, project?.name, project?.category, project?.region],
    queryFn: () => api.getSuggestedPrompts(id, 10),
    enabled: Boolean(id) && Boolean(project),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const suggestedPrompts = useMemo(() => {
    const remote = Array.isArray(suggestedPayload?.prompts)
      ? suggestedPayload.prompts
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : [];
    if (remote.length > 0) return remote;
    return buildSuggestedPrompts(project);
  }, [project, suggestedPayload?.prompts]);
  const [selectedPromptIndexes, setSelectedPromptIndexes] = useState(() => new Set([0, 1, 2]));
  const [customPromptsInput, setCustomPromptsInput] = useState('');

  const savePromptsMutation = useMutation({
    mutationFn: async (promptTexts) => {
      const selectedModels = [];
      await Promise.all(
        promptTexts.map((text) =>
          api.createPrompt(id, {
            prompt_text: text,
            country: project?.region || '',
            selected_models: selectedModels,
            prompt_type: 'Auto',
            is_active: true,
          })
        )
      );
    },
    onSuccess: () => {
      navigate(`/dashboard/project/${id}`);
    },
  });

  const selectedSuggested = useMemo(
    () => suggestedPrompts.filter((_, index) => selectedPromptIndexes.has(index)),
    [selectedPromptIndexes, suggestedPrompts]
  );

  const customPrompts = useMemo(
    () =>
      customPromptsInput
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [customPromptsInput]
  );

  const combinedPrompts = useMemo(() => {
    const existingSet = new Set(existingPrompts.map((p) => String(p.prompt_text || '').toLowerCase()));
    const deduped = [];
    for (const text of [...selectedSuggested, ...customPrompts]) {
      const normalized = text.toLowerCase();
      if (!existingSet.has(normalized) && !deduped.some((item) => item.toLowerCase() === normalized)) {
        deduped.push(text);
      }
    }
    return deduped.slice(0, Math.max(0, MAX_PROMPTS_PER_PROJECT - existingPrompts.length));
  }, [customPrompts, existingPrompts, selectedSuggested]);

  const totalAfterSave = existingPrompts.length + combinedPrompts.length;
  const canSave = combinedPrompts.length > 0 && totalAfterSave <= MAX_PROMPTS_PER_PROJECT;

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm">Preparing prompt suggestions...</p>
      </div>
    );
  }

  if (error || !project) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error?.message || 'Failed to load project details.'}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-primary">Project setup</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Choose prompts for {project.name}</h1>
          <p className="mt-1 text-sm text-slate-600">Pick suggested prompts, add your custom prompts, then continue to analysis.</p>
        </div>
        <Link to="/dashboard" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Suggested prompts</h2>
        <p className="mt-1 text-xs text-slate-500">
          Website-aware prompts generated from your site content and external search signals.
          {suggestedPayload?.source ? ` Source: ${suggestedPayload.source}.` : ''}
        </p>
        {suggestedLoading ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary" />
            Scanning website and refining suggestions...
          </p>
        ) : null}
        {suggestedError ? (
          <p className="mt-2 text-[11px] text-amber-700">
            Could not load website-based suggestions, showing fallback prompts.
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {suggestedPrompts.map((prompt, index) => {
            const checked = selectedPromptIndexes.has(index);
            return (
              <label key={prompt} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-brand-primary/40">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setSelectedPromptIndexes((prev) => {
                      const next = new Set(prev);
                      if (event.target.checked) next.add(index);
                      else next.delete(index);
                      return next;
                    });
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-slate-700">{prompt}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Custom prompts</h2>
        <p className="mt-1 text-xs text-slate-500">Add one prompt per line.</p>
        <textarea
          value={customPromptsInput}
          onChange={(event) => setCustomPromptsInput(event.target.value)}
          rows={5}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/15"
          placeholder={`How does ${project.name} compare to alternatives?\nBest ${project.category || 'industry'} options for teams`}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Review</h2>
        <p className="mt-1 text-xs text-slate-500">
          {combinedPrompts.length} new prompts will be added ({totalAfterSave}/{MAX_PROMPTS_PER_PROJECT} total after saving).
        </p>

        <ul className="mt-3 space-y-1.5">
          {combinedPrompts.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
          {combinedPrompts.length === 0 ? <li className="text-xs text-slate-500">Select at least one prompt to continue.</li> : null}
        </ul>

        {savePromptsMutation.isError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{savePromptsMutation.error?.message || 'Could not save prompts.'}</div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/project/${id}`)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={savePromptsMutation.isPending || !canSave}
            onClick={() => savePromptsMutation.mutate(combinedPrompts)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savePromptsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
            Save prompts and continue
          </button>
        </div>
      </div>
    </div>
  );
}
