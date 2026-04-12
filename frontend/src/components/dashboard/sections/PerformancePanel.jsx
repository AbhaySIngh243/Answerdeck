import React from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveLine } from '@nivo/line';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import { chartTheme } from '../../../lib/chartTheme';

function lineSeriesForVisibility(data) {
  return [
    {
      id: 'Quality Score',
      data: (data || []).map((d) => ({ x: d.date || '-', y: Number(d.score ?? d.value ?? 0) })),
    },
  ];
}

function lineSeriesForRankings(rows) {
  return [
    {
      id: 'Avg Rank',
      data: (rows || []).slice(0, 12).map((r, index) => ({
        x: r.prompt_text?.slice(0, 24) + (r.prompt_text?.length > 24 ? '…' : '') || `Prompt ${index + 1}`,
        y: Number(r.avg_rank ?? 0),
      })),
    },
  ];
}

export default function PerformancePanel({ mode, onModeChange, dashboard, promptAnalysisRows }) {
  const visibilitySeries = lineSeriesForVisibility(dashboard?.quality_score_trend || dashboard?.visibility_trend || []);
  const rankingSeries = lineSeriesForRankings(promptAnalysisRows);
  const engineRows = (dashboard?.competitors || []).slice(0, 10).map((row) => ({
    brand: row.brand || 'Unknown',
    visibility: Number(row.visibility_pct ?? 0),
  }));

  return (
    <Card className="overflow-hidden rounded-xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <CardTitle>Performance</CardTitle>
        <Tabs value={mode} onValueChange={onModeChange}>
          <TabsList>
            <TabsTrigger value="visibility">Quality Score</TabsTrigger>
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
            <TabsTrigger value="engines">Engines</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="h-72 p-4">
        {mode === 'visibility' ? (
          <ResponsiveLine
            data={visibilitySeries}
            margin={{ top: 20, right: 20, bottom: 45, left: 45 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 100 }}
            axisBottom={{ tickRotation: -20 }}
            axisLeft={{ tickValues: 5 }}
            colors={['#2563eb']}
            enableArea
            areaOpacity={0.1}
            pointSize={6}
            useMesh
            theme={chartTheme.nivo}
          />
        ) : mode === 'rankings' ? (
          <ResponsiveLine
            data={rankingSeries}
            margin={{ top: 20, right: 20, bottom: 70, left: 45 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 1, max: 'auto', reverse: true }}
            axisBottom={{ tickRotation: -24 }}
            axisLeft={{ tickValues: 5 }}
            colors={['#16a34a']}
            pointSize={6}
            enableArea
            areaOpacity={0.08}
            useMesh
            theme={chartTheme.nivo}
          />
        ) : (
          <ResponsiveBar
            data={engineRows}
            keys={['visibility']}
            indexBy="brand"
            margin={{ top: 18, right: 16, bottom: 36, left: 92 }}
            layout="horizontal"
            colors={['#2563eb']}
            axisBottom={{ tickSize: 0, tickPadding: 8 }}
            axisLeft={{ tickSize: 0, tickPadding: 8 }}
            labelSkipWidth={32}
            labelSkipHeight={12}
            theme={chartTheme.nivo}
            borderRadius={4}
          />
        )}
      </CardContent>
    </Card>
  );
}
