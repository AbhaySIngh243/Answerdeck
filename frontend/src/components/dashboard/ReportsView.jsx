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
      <div className="flex items-center justify-between">
        <div>
          <p className="landing-eyebrow text-left">Exports</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#0f172a]">Reports</h1>
          <p className="mt-1 text-[#64748b]">Export project-level AI visibility reports in CSV or PDF.</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-12 text-center text-[#64748b] shadow-sm">
          Create a project and run analysis to unlock reports.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-12 gap-4 border-b border-[#e2e8f0] bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-[#64748b] sm:px-6">
            <div className="col-span-4">Project</div>
            <div className="col-span-2">Region</div>
            <div className="col-span-2">Prompts</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-2 text-right">Export</div>
          </div>

          <div className="divide-y divide-[#e2e8f0]">
            {projects.map((project) => (
              <div key={project.project_id} className="grid min-w-[640px] grid-cols-12 items-center gap-4 px-4 py-4 sm:px-6">
                <div className="col-span-4">
                  <p className="font-semibold text-[#0f172a]">{project.name}</p>
                  <p className="text-xs text-[#64748b]">{project.category || 'Uncategorized'}</p>
                </div>
                <div className="col-span-2 text-sm text-slate-600">{project.region || 'Global'}</div>
                <div className="col-span-2 text-sm text-slate-600">{project.tracked_prompts}</div>
                <div className="col-span-2 text-sm font-semibold text-[#0f172a]">{project.current_score}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`/reports/project/${project.project_id}/export.csv`, `${project.name}-ranklore-report.csv`)
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`/reports/project/${project.project_id}/export.pdf`, `${project.name}-ranklore-report.pdf`)
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3b82f6]"
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-sm text-slate-700">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
        Reports include prompt rankings, competitor visibility, and recommendation summaries for stakeholder sharing.
      </div>
    </div>
  );
};

export default ReportsView;
