import React, { useMemo } from 'react';
import { ResponsivePie } from '@nivo/pie';

const SLICE_COLORS = [
  '#38bdf8',
  '#2563eb',
  '#84cc16',
  '#fbbf24',
  '#14b8a6',
  '#8b5cf6',
  '#3b82f6',
  '#f87171',
  '#06b6d4',
  '#a855f7',
];

function SourcesTooltip({ datum }) {
  const p = datum?.data;
  if (!p) return null;
  const others = (p.aliases || []).filter((a) => a !== p.fullName);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-[11px] font-semibold text-slate-500">{p.fullName}</p>
      <p className="text-xs font-semibold text-slate-800">
        {p.value} mentions · {p.pct}%
      </p>
      {others.length > 0 ? (
        <p className="mt-2 max-w-[240px] text-[11px] font-medium leading-snug text-slate-500">
          Grouped labels: {others.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Plain 2D donut chart for citation share — tooltips and inline list carry the detail.
 */
export default function SourcesPieChart({ data, maxItems = 10, className = '' }) {
  const { chartData, total } = useMemo(() => {
    const rows = (data || []).slice(0, maxItems);
    const sum = rows.reduce((s, d) => s + (Number(d.source_mentions) || 0), 0) || 1;
      const chartDataInner = rows.map((d, index) => {
      const v = Number(d.source_mentions) || 0;
      const fullName = d.label || d.domain || 'Unknown';
      return {
          id: fullName,
          color: SLICE_COLORS[index % SLICE_COLORS.length],
        name: fullName,
        fullName,
        value: v,
        pct: Math.round((v / sum) * 1000) / 10,
        aliases: d.mergedDomains || [fullName],
      };
    });
    return { chartData: chartDataInner, total: rows.reduce((s, d) => s + (Number(d.source_mentions) || 0), 0) };
  }, [data, maxItems]);

  if (chartData.length === 0) {
    return (
      <div className={`flex h-56 items-center justify-center text-sm text-slate-400 ${className}`}>
        No citation data yet
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="relative mx-auto w-full max-w-[320px]">
        <div className="aspect-square w-full max-h-[280px] min-h-[220px]">
          <ResponsivePie
            data={chartData}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
            innerRadius={0.6}
            padAngle={0.7}
            cornerRadius={4}
            activeOuterRadiusOffset={5}
            colors={(datum) => datum.data.color}
            borderColor="#ffffff"
            borderWidth={2}
            enableArcLabels={false}
            enableArcLinkLabels={false}
            tooltip={SourcesTooltip}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-1">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sources</p>
            <p className="text-2xl font-bold tabular-nums text-slate-800">{total}</p>
            <p className="text-[10px] font-medium text-slate-400">mentions</p>
          </div>
        </div>
      </div>

      <ul className="space-y-2 border-t border-slate-100 pt-3">
        {chartData.map((row, i) => (
          <li key={row.fullName} className="flex items-start justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-start gap-2">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full ring-1 ring-white"
                style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                aria-hidden
              />
              <span className="min-w-0 font-medium leading-snug text-slate-700" title={row.fullName}>
                {row.fullName}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              <span className="font-semibold text-slate-800">{row.value}</span>
              <span className="mx-1 text-slate-300">·</span>
              {row.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
