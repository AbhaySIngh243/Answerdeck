import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Waypoints, Eye, Trophy, BarChart3 } from 'lucide-react';
import { MetricTile } from '../ui/MetricTile';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export default function OverviewKpiGrid({
  dashboard,
  prompts,
  enabledEngines,
  metricsLoading = false,
}) {
  const visibilityPct = metricsLoading
    ? null
    : Number(
        dashboard?.visibility_pct_current ?? dashboard?.current_visibility_score ?? 0
      );
  const promptCount = prompts.length;
  const engineCount = enabledEngines.length;
  const competitors = metricsLoading ? [] : (Array.isArray(dashboard?.competitors) ? dashboard.competitors : []);
  const topCompetitor = competitors.length
    ? [...competitors].sort(
        (a, b) =>
          Number(b.visibility_pct ?? b.visibility ?? 0) -
          Number(a.visibility_pct ?? a.visibility ?? 0)
      )[0]
    : null;

  const rankings = metricsLoading ? [] : (Array.isArray(dashboard?.prompt_rankings) ? dashboard.prompt_rankings : []);
  const rankedEntries = rankings.filter((r) => r.avg_rank != null);
  const avgPosition = metricsLoading
    ? '…'
    : rankedEntries.length > 0
      ? (rankedEntries.reduce((s, r) => s + Number(r.avg_rank), 0) / rankedEntries.length).toFixed(2)
      : '—';

  const cards = [
    {
      label: 'Prompts',
      value: promptCount,
      sub: 'Active queries tracked',
      icon: FileText,
    },
    {
      label: 'AI Models',
      value: engineCount,
      sub: enabledEngines.length > 0
        ? enabledEngines.map((e) => e.name).join(', ')
        : 'No engines enabled',
      icon: Waypoints,
    },
    {
      label: 'Visibility',
      value: metricsLoading ? '…' : `${visibilityPct}%`,
      sub: metricsLoading ? 'Loading metrics…' : 'Across all prompts',
      icon: Eye,
    },
    {
      label: 'Top Competitor',
      value: metricsLoading ? '…' : (topCompetitor?.brand || '—'),
      sub: metricsLoading
        ? 'Loading metrics…'
        : topCompetitor != null
          ? `Outranks you by ${Math.max(
              0,
              Math.round(
                (Number(topCompetitor.visibility_pct ?? topCompetitor.visibility ?? 0) || 0) -
                  (visibilityPct ?? 0)
              )
            )} visibility pts`
          : 'Run analysis to populate',
      icon: Trophy,
      valueClassName: 'truncate',
    },
    {
      label: 'Your Avg Position',
      value: avgPosition,
      sub: 'Across all prompts',
      icon: BarChart3,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3 lg:grid-cols-5"
    >
      {cards.map((c) => (
        <MetricTile
          key={c.label}
          label={c.label}
          value={c.value}
          sub={c.sub}
          icon={c.icon}
          valueClassName={c.valueClassName}
        />
      ))}
    </motion.div>
  );
}
