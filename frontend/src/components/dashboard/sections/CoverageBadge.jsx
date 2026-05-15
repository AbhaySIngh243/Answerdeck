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

export default function CoverageBadge({ coverage, compact = false }) {
  const c = coerceCoverage(coverage);
  if (!c) return null;
  const tier = TIER_STYLES[c.tier] ? c.tier : 'low';
  const label = c.n_responses > 0 ? (TIER_LABELS[tier] || 'Confidence') : 'No data yet';
  const detail = `n=${c.n_responses} across ${c.n_queries} ${c.n_queries === 1 ? 'query' : 'queries'} \u00d7 ${c.n_engines} ${c.n_engines === 1 ? 'engine' : 'engines'}`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TIER_STYLES[tier]}`}
      title={detail}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {compact ? `n=${c.n_responses}` : `${label} \u00b7 ${detail}`}
    </span>
  );
}

export function CoverageEmptyState({ coverage, title = 'Not enough data', message, ctaHref }) {
  const c = coerceCoverage(coverage) || { n_responses: 0, n_queries: 0, n_engines: 0, tier: 'insufficient' };
  const threshold = coverage?.thresholds?.min_responses_for_narrative ?? 8;
  const needed = Math.max(0, threshold - c.n_responses);
  return (
    <div className="glass-inset rounded-xl px-4 py-6 text-center text-sm text-slate-500">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <p>
        {message || `We need at least ${threshold} model answers before we can show this reliably.`}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        You have {c.n_responses} so far ({c.n_queries} {c.n_queries === 1 ? 'query' : 'queries'} {c.n_engines ? `\u00d7 ${c.n_engines} engines` : ''}).
        {needed > 0 ? ` Run ${needed} more model answer${needed === 1 ? '' : 's'} to unlock.` : ''}
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
  return !c || c.tier === 'insufficient';
}
