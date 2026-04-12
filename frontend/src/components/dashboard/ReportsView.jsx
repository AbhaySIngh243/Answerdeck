import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

import { api, downloadFile } from '../../lib/api';
import { SectionScaffold, StatePanel } from './ui/SectionScaffold';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const ReportsView = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: api.getOverview,
  });

  const projects = data?.projects || [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error.message}</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionScaffold title="Reports" description="Export project-level AI visibility reports in CSV or PDF." />

      {projects.length === 0 ? (
        <StatePanel title="Reports unavailable" description="Create a project and run analysis to unlock reports." />
      ) : (
        <Card className="overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Prompts</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.project_id}>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{project.name}</p>
                      <p className="text-xs text-slate-500">{project.category || 'Uncategorized'}</p>
                    </TableCell>
                    <TableCell>{project.region || 'Global'}</TableCell>
                    <TableCell>{project.tracked_prompts}</TableCell>
                    <TableCell><Badge variant="secondary">{project.current_score}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => downloadFile(`/reports/project/${project.project_id}/export.csv`, `${project.name}-ranklore-report.csv`)}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => downloadFile(`/reports/project/${project.project_id}/export.pdf`, `${project.name}-ranklore-report.pdf`)}
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-sm text-slate-700">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
        Reports include prompt rankings, competitor visibility, and recommendation summaries for stakeholder sharing.
      </div>
    </div>
  );
};

export default ReportsView;
