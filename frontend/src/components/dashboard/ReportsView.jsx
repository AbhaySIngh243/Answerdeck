import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

import { api, downloadFile } from '../../lib/api';

const ReportsView = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: api.getOverview,
  });

  const projects = data?.projects || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Reports</h1>
          <p className="text-neutral-500 mt-1">Export project-level AI visibility reports in CSV or PDF.</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center text-neutral-500">
          Create a project and run analysis to unlock reports.
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs uppercase tracking-wide text-neutral-500 border-b border-neutral-200 bg-neutral-50">
            <div className="col-span-4">Project</div>
            <div className="col-span-2">Region</div>
            <div className="col-span-2">Prompts</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-2 text-right">Export</div>
          </div>

          <div className="divide-y divide-neutral-200">
            {projects.map((project) => (
              <div key={project.project_id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                <div className="col-span-4">
                  <p className="font-semibold text-neutral-900">{project.name}</p>
                  <p className="text-xs text-neutral-500">{project.category || 'Uncategorized'}</p>
                </div>
                <div className="col-span-2 text-sm text-neutral-700">{project.region || 'Global'}</div>
                <div className="col-span-2 text-sm text-neutral-700">{project.tracked_prompts}</div>
                <div className="col-span-2 text-sm font-semibold text-neutral-900">{project.current_score}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => downloadFile(`/reports/project/${project.project_id}/export.csv`, `${project.name}-ranklore-report.csv`)}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={() => downloadFile(`/reports/project/${project.project_id}/export.pdf`, `${project.name}-ranklore-report.pdf`)}
                    className="inline-flex items-center gap-1 rounded-md bg-brand-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-secondary"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 flex items-start gap-3">
        <Download className="w-5 h-5 mt-0.5" />
        Reports include prompt rankings, competitor visibility, and recommendation summaries for stakeholder sharing.
      </div>
    </div>
  );
};

export default ReportsView;