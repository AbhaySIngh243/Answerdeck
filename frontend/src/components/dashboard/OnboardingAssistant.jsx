import React, { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import { api } from '../../lib/api';
import { Button } from '../ui/button';

const STEP_TITLES = {
  1: 'Brand identity',
  2: 'Competitor discovery',
  3: 'Prompt intent map',
  4: 'Engines & grounding',
  5: 'Review & launch',
};

function normalizeContext(context) {
  if (!context || typeof context !== 'object') return {};
  const clone = {};
  Object.keys(context).forEach((key) => {
    const value = context[key];
    if (Array.isArray(value)) {
      clone[key] = value.slice(0, 10);
    } else if (typeof value === 'string') {
      clone[key] = value.slice(0, 400);
    } else if (value && typeof value === 'object') {
      try {
        clone[key] = JSON.parse(JSON.stringify(value));
      } catch {
        clone[key] = String(value);
      }
    } else {
      clone[key] = value;
    }
  });
  return clone;
}

export default function OnboardingAssistant({ projectId, step, context }) {
  const [expanded, setExpanded] = useState(true);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);

  const normalized = useMemo(() => normalizeContext(context), [context]);

  const askMutation = useMutation({
    mutationFn: (payload) => api.askOnboardingAssistant(projectId, payload),
    onSuccess: (data, variables) => {
      setHistory((prev) => [
        ...prev,
        {
          question: variables?.question || '',
          step: variables?.step || step,
          payload: data,
          at: Date.now(),
        },
      ].slice(-5));
    },
  });

  useEffect(() => {
    if (!projectId || !step) return;
    askMutation.mutate({ step, context: normalized, question: '' });
    // Only refetch on step change or projectId change, not on every context keystroke
    // to stay cheap and avoid rate limiting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, step]);

  const latest = askMutation.data || history[history.length - 1]?.payload;
  const stepTitle = STEP_TITLES[step] || `Step ${step}`;

  function handleAsk(e) {
    e.preventDefault();
    const text = question.trim();
    if (!text || askMutation.isPending) return;
    askMutation.mutate({ step, context: normalized, question: text });
    setQuestion('');
  }

  return (
    <AnimatePresence initial={false}>
      {expanded ? (
        <motion.div
          key="assistant-open"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] sm:w-[360px]"
        >
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-brand-primary/5 to-violet-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                    Setup assistant
                  </p>
                  <p className="text-xs text-slate-500">{stepTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Collapse assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-3 text-sm text-slate-700">
              {askMutation.isPending && !latest ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking through this step...
                </div>
              ) : null}

              {latest ? (
                <>
                  <div className="flex items-start gap-2 rounded-lg bg-brand-primary/5 p-3 text-sm text-slate-700">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-slate-900">Tip</p>
                      <p>{latest.tip}</p>
                    </div>
                  </div>

                  {latest.recommended_action ? (
                    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Next step
                        </p>
                        <p className="mt-0.5 text-slate-700">{latest.recommended_action}</p>
                      </div>
                    </div>
                  ) : null}

                  {Array.isArray(latest.common_mistakes) && latest.common_mistakes.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm">
                      <div className="flex items-center gap-2 text-amber-900">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          Common mistakes
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-1 text-amber-900/90">
                        {latest.common_mistakes.map((m, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-amber-500">•</span>
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {Array.isArray(latest.examples) && latest.examples.length > 0 ? (
                    <div className="rounded-lg border border-slate-200 p-3 text-xs">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Examples
                      </p>
                      <ul className="mt-1.5 space-y-1 text-slate-600">
                        {latest.examples.map((ex, i) => (
                          <li key={i} className="rounded bg-slate-50 px-2 py-1">
                            {ex}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {askMutation.isError ? (
                    <p className="text-xs text-red-500">
                      Assistant temporarily unavailable — you can still move forward.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <form
              onSubmit={handleAsk}
              className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this step..."
                className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={askMutation.isPending || !question.trim()}
                className="h-8 px-2"
              >
                {askMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="assistant-collapsed"
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => setExpanded(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-lg transition-colors hover:bg-slate-50"
        >
          <Sparkles className="h-4 w-4 text-brand-primary" />
          Setup assistant
        </motion.button>
      )}
    </AnimatePresence>
  );
}
