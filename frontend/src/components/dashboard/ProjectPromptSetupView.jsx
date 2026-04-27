import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, PlusCircle } from 'lucide-react';

import { api } from '../../lib/api';
import { SectionScaffold, StatePanel } from './ui/SectionScaffold';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

function buildSuggestedPrompts(project) {
  const categoryTokens = String(project?.category || 'software')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const category = categoryTokens.join(' ') || 'software';

  return [
    `Which are the best ${category} options`,
    `Recommended ${category} tools for teams like us`,
    `Best ${category} options for tight budgets`,
  ];
}

export default function ProjectPromptSetupView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
  const safeExistingPrompts = Array.isArray(existingPrompts) ? existingPrompts : [];

  const { data: billing } = useQuery({
    queryKey: ['billing', 'me'],
    queryFn: api.getBillingMe,
    staleTime: 60_000,
  });
  const maxPrompts = billing?.limits?.max_prompts_per_project ?? 3;

  const {
    data: suggestedPayload,
    isLoading: suggestedLoading,
    error: suggestedError,
  } = useQuery({
    queryKey: ['project-suggested-prompts', id, project?.website_url, project?.name, project?.category, project?.region],
    queryFn: () => api.getSuggestedPrompts(id, 3),
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
      queryClient.invalidateQueries({ queryKey: ['billing', 'me'] });
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
    const existingSet = new Set(safeExistingPrompts.map((p) => String(p.prompt_text || '').toLowerCase()));
    const deduped = [];
    for (const text of [...selectedSuggested, ...customPrompts]) {
      const normalized = text.toLowerCase();
      if (!existingSet.has(normalized) && !deduped.some((item) => item.toLowerCase() === normalized)) {
        deduped.push(text);
      }
    }
    return deduped.slice(0, Math.max(0, maxPrompts - safeExistingPrompts.length));
  }, [customPrompts, safeExistingPrompts, selectedSuggested, maxPrompts]);

  const totalAfterSave = safeExistingPrompts.length + combinedPrompts.length;
  const canSave = combinedPrompts.length > 0 && totalAfterSave <= maxPrompts;

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm">Preparing prompt suggestions...</p>
      </div>
    );
  }

  if (error || !project) {
    return <StatePanel variant="danger" title="Failed to load project details" description={error?.message || 'Please try again.'} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionScaffold
        title={`Choose prompts for ${project.name}`}
        description="Pick suggested prompts, add custom prompts, then continue to analysis."
        actions={(
          <Button variant="secondary" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
        )}
      />

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Suggested prompts</CardTitle>
          <CardDescription>
            Suggestions use your website text, project category, and region when we can fetch them; they are not live web search results.
            {suggestedPayload?.source ? ` Source: ${suggestedPayload.source}.` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Custom prompts</CardTitle>
          <CardDescription>Add one prompt per line.</CardDescription>
        </CardHeader>
        <CardContent>
        <Textarea
          value={customPromptsInput}
          onChange={(event) => setCustomPromptsInput(event.target.value)}
          rows={5}
          placeholder={`How does ${project.name} compare to alternatives?\nBest ${project.category || 'industry'} options for teams`}
        />
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Review</CardTitle>
          <CardDescription>
          {combinedPrompts.length} new prompts will be added ({totalAfterSave}/{maxPrompts} total after saving).
          </CardDescription>
        </CardHeader>
        <CardContent>

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
          <Button type="button" variant="secondary" onClick={() => navigate(`/dashboard/project/${id}`)}>
            Skip for now
          </Button>
          <Button
            type="button"
            disabled={savePromptsMutation.isPending || !canSave}
            onClick={() => savePromptsMutation.mutate(combinedPrompts)}
          >
            {savePromptsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
            Save prompts and continue
          </Button>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
