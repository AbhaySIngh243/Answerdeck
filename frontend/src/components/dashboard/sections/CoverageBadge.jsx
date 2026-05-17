import React from 'react';

const TIER_STYLES = {
  insufficient: 'bg-amber-50 text-amber-700 ring-amber-100',
  low: 'bg-amber-50 text-amber-700 ring-amber-100',
  moderate: 'bg-slate-100 text-slate-600 ring-slate-200',
  high: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
};

const TIER_LABELS = {
  insufficient: 'Early signal',
  low: 'Low confidence',
  moderate: 'Confidence: moderate',
  high: 'Confidence: high',
};

function coerceCoverage(coverage) {
  if (!coverage || typeof coverage !== 'object') return null;
  const n_responses = Number(coverage.n_responses ?? 0) || 0;
  const n_queries = Number(coverage.n_queries_with_responses ?? coverage.n_prompts ?? 0) || 0;
  const n_engines = Number(coverage.n_engines ?? 0) || 0;
  const tier = String(coverage.tier || '').toLowerCase() || (n_responses ? 'low' : 'insufficient');
  return { n_responses, n_queries, n_engines, tier };
}

function evidenceDetail(c) {
  const answerLabel = `${c.n_responses} model ${c.n_responses === 1 ? 'answer' : 'answers'}`;
  const queryLabel = `${c.n_queries} ${c.n_queries === 1 ? 'query' : 'queries'}`;
  const engineLabel = `${c.n_engines} ${c.n_engines === 1 ? 'engine' : 'engines'}`;
  return `${answerLabel} across ${queryLabel} and ${engineLabel}`;
}

export default function CoverageBadge({ coverage, compact = false }) {
  const c = coerceCoverage(coverage);
  if (!c) return null;
  const tier = TIER_STYLES[c.tier] ? c.tier : 'low';
  const label = c.n_responses > 0 ? (TIER_LABELS[tier] || 'Confidence') : 'No data yet';
  const detail = evidenceDetail(c);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TIER_STYLES[tier]}`}
      title={detail}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {compact ? `${c.n_responses} answers` : `${label} - ${detail}`}
    </span>
  );
}

export function CoverageEmptyState({ coverage, title = 'No evidence yet', message, ctaHref }) {
  const c = coerceCoverage(coverage) || { n_responses: 0, n_queries: 0, n_engines: 0, tier: 'insufficient' };
  return (
    <div className="glass-inset rounded-xl px-4 py-6 text-center text-sm text-slate-500">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <p>
        {message || 'Run one prompt with model answers to generate evidence-backed analysis.'}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Current evidence: {evidenceDetail(c)}.
      </p>
      {ctaHref && (
        <a href={ctaHref} className="mt-3 inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
          Run more prompts
        </a>
      )}
    </div>
  );
}

export function isInsufficient(coverage) {
  const c = coerceCoverage(coverage);
  return !c || c.n_responses <= 0;
}
