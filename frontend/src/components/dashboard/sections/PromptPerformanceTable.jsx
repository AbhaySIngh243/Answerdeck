import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

export default function PromptPerformanceTable({ loading, rows, onViewAll }) {
  return (
    <Card className="overflow-hidden rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
        <CardTitle>Prompt Performance</CardTitle>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View all
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead className="text-right">Visibility</TableHead>
              <TableHead className="text-right">Quality</TableHead>
              <TableHead className="text-right">Avg Rank</TableHead>
              <TableHead className="text-center">Sentiment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`sk-${idx}`}>
                    <TableCell><div className="h-3 w-44 animate-pulse rounded bg-slate-100" /></TableCell>
                    <TableCell className="text-right"><div className="ml-auto h-3 w-12 animate-pulse rounded bg-slate-100" /></TableCell>
                    <TableCell className="text-right"><div className="ml-auto h-3 w-10 animate-pulse rounded bg-slate-100" /></TableCell>
                    <TableCell className="text-right"><div className="ml-auto h-3 w-10 animate-pulse rounded bg-slate-100" /></TableCell>
                    <TableCell className="text-center"><div className="mx-auto h-4 w-14 animate-pulse rounded bg-slate-100" /></TableCell>
                  </TableRow>
                ))
              : (rows || []).slice(0, 8).map((row) => {
                  const visibility = row.visibility_pct ?? row.visibility;
                  return (
                    <TableRow key={row.prompt_id}>
                      <TableCell className="max-w-[260px] truncate font-medium text-slate-800">{row.prompt_text}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={visibility > 70 ? 'success' : visibility > 40 ? 'warning' : 'danger'}>
                          {visibility}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-500">{row.quality_score ?? '-'}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-500">{row.avg_rank ?? '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={row.sentiment === 'positive' ? 'success' : row.sentiment === 'negative' ? 'danger' : 'secondary'}>
                          {row.sentiment || 'neutral'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
