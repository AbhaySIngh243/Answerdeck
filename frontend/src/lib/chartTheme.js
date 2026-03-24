export const chartTheme = {
  grid: {
    stroke: '#e2e8f0',
    strokeDasharray: '3 6',
    strokeOpacity: 0.6,
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
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
      padding: '10px 14px',
      color: '#334155',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.5,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    itemStyle: {
      fontWeight: 600,
      color: '#0f172a',
      fontSize: '12px',
    },
    labelStyle: {
      color: '#94a3b8',
      fontWeight: 500,
      fontSize: '11px',
      marginBottom: '4px',
    },
  },
  barRadius: [4, 4, 0, 0],
  barRadiusHorizontal: [0, 4, 4, 0],
  colors: {
    accent: '#2563EB',
    accentSoft: 'rgba(37,99,235,0.12)',
    accentGlow: 'rgba(37,99,235,0.06)',
    success: '#16A34A',
    danger: '#DC2626',
    muted: '#94a3b8',
  },
};
