import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Gauge, Cpu, MessageSquare, Loader2, PlayCircle, Link2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { MetricTile } from '../ui/MetricTile';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export default function OverviewKpiGrid({
  dashboard,
  prompts,
  enabledEngines,
  runAllMutation,
  projectId,
}) {
  const visibilityPct = Number(
    dashboard?.visibility_pct_current ?? dashboard?.current_visibility_score ?? 0
  );
  const qualityScore = Number(
    dashboard?.quality_score_current ?? dashboard?.current_visibility_score ?? 0
  );
  const qualityTrend = dashboard?.quality_score_trend || dashboard?.visibility_trend || [];
  const prevQuality = qualityTrend.length >= 2 ? qualityTrend[qualityTrend.length - 2]?.score : null;
  const qualityDeltaRaw = prevQuality != null ? qualityScore - prevQuality : null;
  const qualityDelta = qualityDeltaRaw != null ? Math.round(qualityDeltaRaw * 10) / 10 : null;
  const promptCount = prompts.length;
  const engineCount = enabledEngines.length;
  const competitorCount = (dashboard?.competitors || []).length;
  const hasWebsite = Boolean(dashboard?.project?.website_url?.trim());
  const siteCitedPct = Number(dashboard?.official_site_cited_pct ?? 0);

  const cards = [
    { label: 'Answer visibility', value: `${visibilityPct}%`, delta: null, deltaUp: true, sub: 'brand in model answers', icon: Eye, accent: 'blue' },
    {
      label: 'Site in citations',
      value: hasWebsite ? `${siteCitedPct}%` : '—',
      delta: null,
      deltaUp: true,
      sub: hasWebsite ? 'URLs on your domain' : 'add project website',
      icon: Link2,
      accent: 'amber',
    },
    { label: 'Quality Score', value: `${qualityScore}%`, delta: qualityDelta != null ? `${qualityDelta >= 0 ? '+' : ''}${qualityDelta}%` : null, deltaUp: qualityDelta >= 0, sub: 'rank + sentiment', icon: Gauge, accent: 'green' },
    { label: 'AI Engines', value: engineCount, delta: null, sub: `${competitorCount} competitors`, icon: Cpu, accent: 'purple' },
    { label: 'Prompts', value: promptCount, delta: null, sub: promptCount > 0 ? 'active queries' : 'none yet', icon: MessageSquare, accent: 'amber' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="visible" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => (
        <MetricTile
          key={c.label}
          label={c.label}
          value={c.value}
          delta={c.delta}
          deltaUp={c.deltaUp}
          sub={c.sub}
          icon={c.icon}
          accent={c.accent}
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
    </motion.div>
  );
}
