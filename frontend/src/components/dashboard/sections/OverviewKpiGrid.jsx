import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Cpu, Eye, Crown, BarChart3 } from 'lucide-react';
import { MetricTile } from '../ui/MetricTile';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export default function OverviewKpiGrid({
  dashboard,
  prompts,
  enabledEngines,
}) {
  const visibilityPct = Number(
    dashboard?.visibility_pct_current ?? dashboard?.current_visibility_score ?? 0
  );
  const promptCount = prompts.length;
  const engineCount = enabledEngines.length;
  const competitors = Array.isArray(dashboard?.competitors) ? dashboard.competitors : [];
  const topCompetitor = competitors.length
    ? [...competitors].sort(
        (a, b) =>
          Number(b.visibility_pct ?? b.visibility ?? 0) -
          Number(a.visibility_pct ?? a.visibility ?? 0)
      )[0]
    : null;

  const rankings = Array.isArray(dashboard?.prompt_rankings) ? dashboard.prompt_rankings : [];
  const rankedEntries = rankings.filter((r) => r.avg_rank != null);
  const avgPosition =
    rankedEntries.length > 0
      ? (rankedEntries.reduce((s, r) => s + Number(r.avg_rank), 0) / rankedEntries.length).toFixed(2)
      : '—';

  const cards = [
    {
      label: 'Prompts',
      value: promptCount,
      sub: 'Active queries tracked',
      icon: MessageSquare,
      accent: 'blue',
    },
    {
      label: 'AI Models',
      value: engineCount,
      sub: enabledEngines.length > 0
        ? enabledEngines.map((e) => e.name).join(', ')
        : 'No engines enabled',
      icon: Cpu,
      accent: 'purple',
    },
    {
      label: 'Visibility',
      value: `${visibilityPct}%`,
      sub: 'Across all prompts',
      icon: Eye,
      accent: 'green',
    },
    {
      label: 'Top Competitor',
      value: topCompetitor?.brand || '—',
      sub:
        topCompetitor != null
          ? `Outranks you by ${Math.max(
              0,
              Math.round(
                (Number(topCompetitor.visibility_pct ?? topCompetitor.visibility ?? 0) || 0) -
                  visibilityPct
              )
            )} visibility pts`
          : 'Run analysis to populate',
      icon: Crown,
      accent: 'amber',
    },
    {
      label: 'Your Avg Position',
      value: avgPosition,
      sub: 'Across all prompts',
      icon: BarChart3,
      accent: 'blue',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-4 lg:grid-cols-5"
    >
      {cards.map((c) => (
        <MetricTile
          key={c.label}
          label={c.label}
          value={c.value}
          sub={c.sub}
          icon={c.icon}
          accent={c.accent}
        />
      ))}
    </motion.div>
  );
}
