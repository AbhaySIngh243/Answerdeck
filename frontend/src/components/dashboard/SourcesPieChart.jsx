import React, { useMemo, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

const PALETTE = [
  { fill: '#2563eb', stroke: '#1d4ed8' },
  { fill: '#7c3aed', stroke: '#6d28d9' },
  { fill: '#0891b2', stroke: '#0e7490' },
  { fill: '#0d9488', stroke: '#0f766e' },
  { fill: '#6366f1', stroke: '#4f46e5' },
  { fill: '#8b5cf6', stroke: '#7c3aed' },
  { fill: '#0ea5e9', stroke: '#0284c7' },
  { fill: '#94a3b8', stroke: '#64748b' },
  { fill: '#a78bfa', stroke: '#8b5cf6' },
  { fill: '#64748b', stroke: '#475569' },
];

function ActiveShape(props) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
        cornerRadius={4}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.15}
        cornerRadius={4}
      />
    </g>
  );
}

const legendItem = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0 },
};

export default function SourcesPieChart({ data, maxItems = 10, className = '' }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const { chartData, total } = useMemo(() => {
    const rows = (data || []).slice(0, maxItems);
    const sum = rows.reduce((s, d) => s + (Number(d.source_mentions) || 0), 0) || 1;
    const items = rows.map((d, index) => {
      const v = Number(d.source_mentions) || 0;
      const fullName = d.label || d.domain || 'Unknown';
      return {
        name: fullName,
        value: v,
        pct: Math.round((v / sum) * 1000) / 10,
        fill: PALETTE[index % PALETTE.length].fill,
        stroke: PALETTE[index % PALETTE.length].stroke,
        aliases: d.mergedDomains || [fullName],
      };
    });
    return {
      chartData: items,
      total: rows.reduce((s, d) => s + (Number(d.source_mentions) || 0), 0),
    };
  }, [data, maxItems]);

  const onEnter = useCallback((_, index) => setActiveIndex(index), []);
  const onLeave = useCallback(() => setActiveIndex(-1), []);

  if (chartData.length === 0) {
    return (
      <div className={`flex h-56 flex-col items-center justify-center text-center ${className}`}>
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
          <Globe className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium text-slate-400">No citation data yet</p>
        <p className="mt-0.5 text-xs text-slate-400">Run an analysis to see sources</p>
      </div>
    );
  }

  const hoveredItem = activeIndex >= 0 ? chartData[activeIndex] : null;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Chart + center label */}
      <div className="relative mx-auto w-full max-w-[280px]">
        <ResponsiveContainer width="100%" aspect={1}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="85%"
              paddingAngle={2}
              cornerRadius={5}
              dataKey="value"
              strokeWidth={0}
              activeIndex={activeIndex}
              activeShape={ActiveShape}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  opacity={activeIndex === -1 || activeIndex === index ? 1 : 0.4}
                  style={{ transition: 'opacity 0.2s ease' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center metric */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {hoveredItem ? (
              <motion.div
                key={hoveredItem.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {hoveredItem.value}
                </p>
                <p className="max-w-[120px] truncate text-[10px] font-semibold text-slate-500">
                  {hoveredItem.name}
                </p>
                <p className="text-[10px] font-bold tabular-nums text-brand-primary">
                  {hoveredItem.pct}%
                </p>
              </motion.div>
            ) : (
              <div>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                  {total}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Total Mentions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        className="mt-4 space-y-0.5"
      >
        {chartData.map((row, i) => (
          <motion.div
            key={row.name}
            variants={legendItem}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(-1)}
            className={`group flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 transition-all ${
              activeIndex === i
                ? 'bg-slate-50/80'
                : 'hover:bg-slate-50/50'
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: row.fill }}
            />
            <span
              className={`min-w-0 flex-1 truncate text-[13px] font-medium transition-colors ${
                activeIndex === i ? 'text-slate-900' : 'text-slate-600'
              }`}
              title={row.name}
            >
              {row.name}
            </span>
            <div className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
              <span className={`text-sm font-bold ${activeIndex === i ? 'text-slate-900' : 'text-slate-700'}`}>
                {row.value}
              </span>
              <span className={`text-[11px] ${activeIndex === i ? 'text-brand-primary font-semibold' : 'text-slate-400'}`}>
                {row.pct}%
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
