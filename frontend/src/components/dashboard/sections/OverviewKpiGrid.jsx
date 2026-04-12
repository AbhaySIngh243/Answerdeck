import React from 'react';
import { Loader2, PlayCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { MetricTile } from '../ui/MetricTile';

export default function OverviewKpiGrid({ dashboard, prompts, enabledEngines, runAllMutation, projectId }) {
  const visibilityPct = Number(dashboard?.visibility_pct_current ?? dashboard?.current_visibility_score ?? 0);
  const qualityScore = Number(dashboard?.quality_score_current ?? dashboard?.current_visibility_score ?? 0);
  const qualityTrend = dashboard?.quality_score_trend || dashboard?.visibility_trend || [];
  const prevQuality = qualityTrend.length >= 2 ? qualityTrend[qualityTrend.length - 2]?.score : null;
  const qualityDeltaRaw = prevQuality != null ? qualityScore - prevQuality : null;
  const qualityDelta = qualityDeltaRaw != null ? Math.round(qualityDeltaRaw * 10) / 10 : null;
  const promptCount = prompts.length;
  const engineCount = enabledEngines.length;
  const competitorCount = (dashboard?.competitors || []).length;

  const cards = [
    { label: 'Visibility %', value: `${visibilityPct}%`, delta: null, deltaUp: true, sub: 'mention-rate across latest model runs' },
    {
      label: 'Quality score',
      value: `${qualityScore}%`,
      delta: qualityDelta != null ? `${qualityDelta >= 0 ? '+' : ''}${qualityDelta}%` : null,
      deltaUp: qualityDelta >= 0,
      sub: 'rank + sentiment weighted score',
    },
    { label: 'AI Engines', value: engineCount, delta: null, sub: `${competitorCount} competitors tracked` },
    { label: 'Prompts', value: promptCount, delta: null, sub: promptCount > 0 ? 'active queries' : 'no queries yet' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => (
        <MetricTile
          key={c.label}
          label={c.label}
          value={c.value}
          delta={c.delta}
          deltaUp={c.deltaUp}
          sub={c.sub}
          actions={
            c.label === 'AI Engines' ? (
              <Button
                onClick={() => runAllMutation.mutate(projectId)}
                disabled={runAllMutation.isPending || prompts.length === 0}
                size="sm"
              >
                {runAllMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
                Run All
              </Button>
            ) : null
          }
        />
      ))}
    </div>
  );
}
