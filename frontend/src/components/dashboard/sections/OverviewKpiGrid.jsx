import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Cpu, Eye, Crown } from 'lucide-react';
import { MetricTile } from '../ui/MetricTile';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
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

  const cards = [
    {
      label: 'Prompts',
      value: promptCount,
      sub: promptCount > 0 ? 'Active queries tracked' : 'No prompts yet',
    },
    {
      label: 'AI Models',
      value: engineCount,
      sub: enabledEngines.length > 0 ? enabledEngines.map(e => e.name).join(', ') : 'No engines enabled',
    },
    {
      label: 'Visibility',
      value: `${visibilityPct}%`,
      sub: 'Across all prompts',
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
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      {cards.map((c) => (
        <MetricTile
          key={c.label}
          label={c.label}
          value={c.value}
          sub={c.sub}
          icon={c.icon}
          accent={c.accent}
          className="py-5"
        />
      ))}
    </motion.div>
  );
}
