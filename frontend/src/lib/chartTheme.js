export const BRAND_BLUE = '#2563eb';
export const BRAND_BLUE_LIGHT = '#3b82f6';
export const SUCCESS = '#10b981';
export const WARNING = '#f59e0b';
export const DANGER = '#ef4444';

export const CHART_COLORS = [
  '#2563eb', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#84cc16',
];

export const GRADIENT_COLORS = [
  { from: '#2563eb', to: '#60a5fa' },
  { from: '#8b5cf6', to: '#a78bfa' },
  { from: '#06b6d4', to: '#67e8f9' },
  { from: '#10b981', to: '#6ee7b7' },
  { from: '#f59e0b', to: '#fcd34d' },
];

export const chartTheme = {
  grid: {
    stroke: '#f1f5f9',
    strokeDasharray: '4 4',
    strokeOpacity: 1,
  },
  axisTick: {
    fontSize: 11,
    fontWeight: 500,
    fill: '#94a3b8',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  axisLine: {
    stroke: '#e2e8f0',
    strokeWidth: 1,
  },
  tooltip: {
    contentStyle: {
      background: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(226, 232, 240, 0.7)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)',
      backdropFilter: 'blur(12px)',
      padding: '12px 16px',
      color: '#334155',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.6,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    itemStyle: {
      fontWeight: 600,
      color: '#0f172a',
      fontSize: '13px',
    },
    labelStyle: {
      color: '#94a3b8',
      fontWeight: 500,
      fontSize: '11px',
      marginBottom: '4px',
    },
  },
  barRadius: [6, 6, 0, 0],
  barRadiusHorizontal: [0, 6, 6, 0],
  colors: {
    accent: BRAND_BLUE,
    accentSoft: 'rgba(37,99,235,0.12)',
    accentGlow: 'rgba(37,99,235,0.06)',
    success: SUCCESS,
    danger: DANGER,
    muted: '#94a3b8',
  },
  nivo: {
    textColor: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter, system-ui, sans-serif',
    axis: {
      domain: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
      ticks: {
        line: { stroke: 'transparent', strokeWidth: 0 },
        text: { fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 },
      },
      legend: {
        text: { fill: '#64748b', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600 },
      },
    },
    grid: {
      line: { stroke: '#f1f5f9', strokeWidth: 1, strokeDasharray: '4 4' },
    },
    tooltip: {
      container: {
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(226, 232, 240, 0.6)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(12px)',
        color: '#334155',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '10px 14px',
      },
    },
    crosshair: {
      line: { stroke: '#2563eb', strokeWidth: 1, strokeOpacity: 0.35 },
    },
    annotations: {
      text: { fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600 },
    },
  },
};
