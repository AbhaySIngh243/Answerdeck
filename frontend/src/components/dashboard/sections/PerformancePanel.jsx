import React from 'react';
import { motion } from 'framer-motion';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import { chartTheme, BRAND_BLUE } from '../../../lib/chartTheme';

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function CustomTooltip({ point }) {
  if (!point) return null;
  return (
    <div className="glass-card-v2 px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{point.data?.x || point.data?.xFormatted}</p>
      <p className="text-lg font-bold tabular-nums text-slate-900">{point.data?.y ?? point.data?.yFormatted}</p>
    </div>
  );
}

function BarTooltip({ id, value, indexValue }) {
  return (
    <div className="glass-card-v2 px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{indexValue}</p>
      <p className="text-lg font-bold tabular-nums text-slate-900">{value}%</p>
    </div>
  );
}

function lineSeriesForVisibility(data) {
  return [{
    id: 'Quality Score',
    data: toArray(data).map((d) => ({ x: d.date || '-', y: Number(d.score ?? d.value ?? 0) })),
  }];
}

function lineSeriesForRankings(rows) {
  return [{
    id: 'Avg Rank',
    data: toArray(rows).slice(0, 12).map((r, i) => ({
      x: r.prompt_text?.slice(0, 20) + (r.prompt_text?.length > 20 ? '\u2026' : '') || `P${i + 1}`,
      y: Number(r.avg_rank ?? 0),
    })),
  }];
}

const TAB_CONFIG = [
  { value: 'visibility', label: 'Quality Score', icon: TrendingUp },
  { value: 'rankings', label: 'Rankings', icon: Activity },
  { value: 'engines', label: 'Engines', icon: BarChart3 },
];

export default function PerformancePanel({ mode, onModeChange, dashboard, promptAnalysisRows }) {
  const visibilitySeries = lineSeriesForVisibility(
    Array.isArray(dashboard?.quality_score_trend)
      ? dashboard.quality_score_trend
      : dashboard?.visibility_trend,
  );
  const rankingSeries = lineSeriesForRankings(promptAnalysisRows);
  const engineRows = (
    toArray(dashboard?.engine_visibility).length > 0
      ? toArray(dashboard?.engine_visibility).slice(0, 10).map((row) => ({
          brand: String(row.engine || 'Unknown').toUpperCase(),
          visibility: Number(row.visibility_pct ?? 0),
        }))
      : toArray(dashboard?.competitors).slice(0, 10).map((row) => ({
          brand: row.brand || 'Unknown',
          visibility: Number(row.visibility_pct ?? 0),
        }))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card-v2 overflow-hidden"
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Performance Analytics</h3>
        </div>
        <div className="flex rounded-xl border border-slate-200/60 bg-slate-50/50 p-0.5">
          {TAB_CONFIG.map((tab) => {
            const active = mode === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onModeChange(tab.value)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-80 px-2 py-3 sm:px-4">
        {mode === 'visibility' ? (
          <ResponsiveLine
            data={visibilitySeries}
            margin={{ top: 24, right: 24, bottom: 48, left: 48 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 100 }}
            axisBottom={{ tickRotation: -20, tickPadding: 8 }}
            axisLeft={{ tickValues: 5, tickPadding: 8 }}
            colors={[BRAND_BLUE]}
            enableArea
            areaOpacity={0.08}
            areaBaselineValue={0}
            pointSize={8}
            pointColor="#ffffff"
            pointBorderWidth={2.5}
            pointBorderColor={BRAND_BLUE}
            enablePointLabel={false}
            useMesh
            crosshairType="bottom"
            curve="monotoneX"
            lineWidth={2.5}
            enableGridX={false}
            tooltip={CustomTooltip}
            theme={chartTheme.nivo}
            defs={[{
              id: 'areaGradient',
              type: 'linearGradient',
              colors: [
                { offset: 0, color: BRAND_BLUE, opacity: 0.2 },
                { offset: 100, color: BRAND_BLUE, opacity: 0 },
              ],
            }]}
            fill={[{ match: '*', id: 'areaGradient' }]}
          />
        ) : mode === 'rankings' ? (
          <ResponsiveLine
            data={rankingSeries}
            margin={{ top: 24, right: 24, bottom: 72, left: 48 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 1, max: 'auto', reverse: true }}
            axisBottom={{ tickRotation: -28, tickPadding: 8 }}
            axisLeft={{ tickValues: 5, tickPadding: 8 }}
            colors={['#10b981']}
            pointSize={8}
            pointColor="#ffffff"
            pointBorderWidth={2.5}
            pointBorderColor="#10b981"
            enableArea
            areaOpacity={0.06}
            useMesh
            crosshairType="bottom"
            curve="monotoneX"
            lineWidth={2.5}
            enableGridX={false}
            tooltip={CustomTooltip}
            theme={chartTheme.nivo}
            defs={[{
              id: 'greenGradient',
              type: 'linearGradient',
              colors: [
                { offset: 0, color: '#10b981', opacity: 0.15 },
                { offset: 100, color: '#10b981', opacity: 0 },
              ],
            }]}
            fill={[{ match: '*', id: 'greenGradient' }]}
          />
        ) : (
          <ResponsiveBar
            data={engineRows}
            keys={['visibility']}
            indexBy="brand"
            margin={{ top: 20, right: 24, bottom: 40, left: 100 }}
            layout="horizontal"
            colors={[BRAND_BLUE]}
            axisBottom={{ tickSize: 0, tickPadding: 8 }}
            axisLeft={{ tickSize: 0, tickPadding: 12 }}
            labelSkipWidth={28}
            labelSkipHeight={12}
            labelTextColor="#ffffff"
            theme={chartTheme.nivo}
            borderRadius={6}
            padding={0.35}
            enableGridY={false}
            tooltip={BarTooltip}
            defs={[{
              id: 'barGradient',
              type: 'linearGradient',
              colors: [
                { offset: 0, color: BRAND_BLUE },
                { offset: 100, color: '#60a5fa' },
              ],
            }]}
            fill={[{ match: '*', id: 'barGradient' }]}
          />
        )}
      </div>
    </motion.div>
  );
}
