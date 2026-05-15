import React from 'react';
import { motion } from 'framer-motion';
import { ResponsiveLine } from '@nivo/line';
import { TrendingUp } from 'lucide-react';
import { chartTheme, BRAND_BLUE } from '../../../lib/chartTheme';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function SliceTooltip({ slice }) {
  if (!slice) return null;
  const points = Array.isArray(slice.points) ? slice.points : [];
  const date =
    slice?.points?.[0]?.data?.xFormatted || slice?.points?.[0]?.data?.x || '';
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {date}
      </p>
      <div className="mt-1 space-y-1">
        {points.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-6 text-[12px] font-semibold text-slate-800"
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.serieColor }}
              />
              {p.serieId}
            </span>
            <span className="tabular-nums">
              {Number(p.data?.yFormatted ?? p.data?.y ?? 0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function lineSeriesForVisibility(data) {
  return [
    {
      id: 'Visibility',
      data: toArray(data).map((d) => ({
        x: d.date || '-',
        y: Number(d.score ?? d.value ?? 0),
      })),
    },
  ];
}

const RANGE_CONFIG = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const MULTI_PALETTE = [
  '#2563eb', // blue  (top competitor / brand)
  '#10b981', // green
  '#f59e0b', // amber/yellow (You)
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

export default function PerformancePanel({ range, onRangeChange, dashboard }) {
  const sliceSize = range === '7d' ? 7 : 30;

  const competitorSeries = toArray(
    dashboard?.competitor_visibility_trend?.series
  );

  const allCompetitors = toArray(dashboard?.competitors);
  const targetBrandName =
    allCompetitors.find((c) => c.is_focus)?.brand || '';
  const targetBrandLower = targetBrandName.toLowerCase();
  const seriesIds = competitorSeries.map((s) => s.id || '');

  const targetSeriesId = seriesIds.find(
    (id) => id.toLowerCase() === targetBrandLower
  );

  const otherSeriesIds = seriesIds
    .filter((id) => id.toLowerCase() !== targetBrandLower)
    .slice(0, 3);

  const idsToKeep = new Set(
    [targetSeriesId, ...otherSeriesIds].filter(Boolean)
  );

  const filteredSeries =
    idsToKeep.size > 0
      ? competitorSeries.filter((s) => idsToKeep.has(s.id))
      : competitorSeries.slice(0, 4);

  const usingCompetitorTrend = filteredSeries.length >= 2;

  const singleTrendRaw =
    Array.isArray(dashboard?.visibility_trend) &&
    dashboard.visibility_trend.length
      ? dashboard.visibility_trend
      : dashboard?.quality_score_trend;
  const points = toArray(singleTrendRaw);
  const slicedSingle =
    points.length > sliceSize ? points.slice(-sliceSize) : points;
  const visibilitySeries = usingCompetitorTrend
    ? filteredSeries.map((s) => ({
        ...s,
        data: toArray(s.data)
          .slice(-sliceSize)
          .map((d) => ({
            x: d.x ?? d.date ?? '-',
            y: Number(d.y ?? d.score ?? d.value ?? 0),
          })),
      }))
    : lineSeriesForVisibility(slicedSingle);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-slate-200/60 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Visibility trend
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Movement over time (not just static comparisons).
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {RANGE_CONFIG.map((opt) => {
            const active = range === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onRangeChange(opt.value)}
                className={`rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                  active
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'border border-slate-200/60 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 px-2 py-3 sm:px-4">
        <ResponsiveLine
          data={visibilitySeries}
          margin={{ top: 20, right: 24, bottom: 52, left: 48 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 0, max: 'auto' }}
          axisBottom={{
            tickRotation: 0,
            tickPadding: 8,
            format: (value) => {
              try {
                const d = new Date(value);
                return isNaN(d.getTime())
                  ? value
                  : new Intl.DateTimeFormat('en-US', {
                      weekday: 'short',
                    }).format(d);
              } catch {
                return value;
              }
            },
          }}
          axisLeft={{
            tickValues: 5,
            tickPadding: 8,
            format: (value) => `${value}%`,
          }}
          colors={MULTI_PALETTE}
          enableArea={!usingCompetitorTrend}
          areaOpacity={0.06}
          areaBaselineValue={0}
          pointSize={8}
          pointColor="#ffffff"
          pointBorderWidth={2.5}
          pointBorderColor={{ from: 'serieColor' }}
          enablePointLabel={false}
          useMesh
          crosshairType="bottom"
          curve="monotoneX"
          lineWidth={2.5}
          enableGridX={false}
          enableSlices="x"
          sliceTooltip={SliceTooltip}
          theme={chartTheme.nivo}
          legends={
            usingCompetitorTrend
              ? [
                  {
                    anchor: 'bottom',
                    direction: 'row',
                    justify: false,
                    translateX: 0,
                    translateY: 46,
                    itemsSpacing: 16,
                    itemDirection: 'left-to-right',
                    itemWidth: 90,
                    itemHeight: 18,
                    itemOpacity: 1,
                    symbolSize: 10,
                    symbolShape: 'circle',
                  },
                ]
              : []
          }
          defs={
            usingCompetitorTrend
              ? []
              : [
                  {
                    id: 'areaGradient',
                    type: 'linearGradient',
                    colors: [
                      { offset: 0, color: BRAND_BLUE, opacity: 0.16 },
                      { offset: 100, color: BRAND_BLUE, opacity: 0 },
                    ],
                  },
                ]
          }
          fill={
            usingCompetitorTrend ? [] : [{ match: '*', id: 'areaGradient' }]
          }
        />
      </div>
    </motion.div>
  );
}
