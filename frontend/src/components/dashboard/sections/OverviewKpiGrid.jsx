import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Waypoints, Eye, BarChart3 } from 'lucide-react';
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
      hint: 'Number of active queries you are tracking across AI engines.',
    },
    {
      label: 'AI Models',
      value: engineCount,
      sub: enabledEngines.length > 0
        ? enabledEngines.map((e) => e.name).join(', ')
        : 'No engines enabled',
      icon: Waypoints,
      hint: 'AI engines (ChatGPT, Perplexity, Gemini, etc.) analyzing your tracked prompts.',
    },
    {
      label: 'Visibility',
      value: metricsLoading ? '…' : `${visibilityPct}%`,
      sub: metricsLoading ? 'Loading metrics…' : 'Across all prompts',
      icon: Eye,
      hint: 'Percentage of (prompt × engine) cells where your brand was explicitly named in the answer text.',
    },
    {
      label: 'Your Avg Position',
      value: avgPosition,
      sub: 'Across all prompts',
      icon: BarChart3,
      hint: 'Average rank when your brand is named. #1 = first mentioned; higher numbers = mentioned later in the answer.',
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {cards.map((c) => (
        <MetricTile
          key={c.label}
          label={c.label}
          value={c.value}
          sub={c.sub}
          hint={c.hint}
          icon={c.icon}
          valueClassName={c.valueClassName}
        />
      ))}
    </motion.div>
  );
}
