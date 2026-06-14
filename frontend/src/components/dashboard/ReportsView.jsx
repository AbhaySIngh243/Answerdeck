import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

import { api, downloadFile } from '../../lib/api';
import DashboardCard from './DashboardCard';
import { SkeletonTable } from './LoadingSkeleton';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const ReportsView = () => {
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: api.getOverview,
  });

  const projects = data?.projects || [];

  const handleExport = async (project, format) => {
    const key = `${project.project_id}-${format}`;
    setExporting(key);
    setExportError(null);
    try {
      const safeName = (project.name || 'report').replace(/\s+/g, '_');
      if (format === 'pdf') {
        await downloadFile(
          `/reports/project/${project.project_id}/export.pdf`,
          `${safeName}_full_report.pdf`,
        );
      } else {
        await downloadFile(
          `/reports/project/${project.project_id}/export.csv`,
          `${safeName}_full_report.csv`,
        );
      }
    } catch (err) {
      setExportError(
        err?.status >= 500
          ? 'The server is warming up or processing a large report. Please wait a moment and try again.'
          : (err?.message || 'Export failed. Please try again.'),
      );
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b border-slate-200/60 pb-5">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
        </div>
        <SkeletonTable rows={4} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="glass-card-v2 border-red-200/60 bg-red-50/60 p-5 text-sm text-red-700">
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-6xl space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="border-b border-slate-200/60 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-400">
          Download full AI visibility reports with executive summary, competitors, sources, audits, and raw model answers.
        </p>
      </motion.div>

      {projects.length === 0 ? (
        <motion.div variants={item} className="glass-card-v2 flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Reports unavailable</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">Create a project and run analysis to populate reports.</p>
        </motion.div>
      ) : (
        <motion.div variants={item}>
          {exportError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-5 py-3.5">
              <p className="text-sm text-amber-800">{exportError}</p>
              <button onClick={() => setExportError(null)} className="shrink-0 text-xs font-medium text-amber-500 hover:text-amber-700">Dismiss</button>
            </div>
          )}
          <DashboardCard title="Project Reports" icon={FileText} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100/80">
                    {['Project', 'Region', 'Prompts', 'Score', 'Export'].map((h) => (
                      <th key={h} className={`px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${h === 'Export' ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {projects.map((project) => (
                    <tr key={project.project_id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{project.name}</p>
                        <p className="text-xs text-slate-400">{project.category || 'Uncategorized'}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{project.region || 'Global'}</td>
                      <td className="px-6 py-4 text-slate-600">{project.tracked_prompts}</td>
                      <td className="px-6 py-4"><Badge variant="secondary">{project.current_score}</Badge></td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={Boolean(exporting)}
                            onClick={() => handleExport(project, 'csv')}
                          >
                            {exporting === `${project.project_id}-csv` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            )}
                            Data Export (CSV)
                          </Button>
                          <Button
                            size="sm"
                            disabled={Boolean(exporting)}
                            onClick={() => handleExport(project, 'pdf')}
                          >
                            {exporting === `${project.project_id}-pdf` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            Full Report (PDF)
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </motion.div>
      )}

      {/* Info banner */}
      <motion.div
        variants={item}
        className="glass-card-v2 flex items-start gap-3 border-brand-primary/20 bg-brand-primary/5 p-4 text-sm text-slate-600"
      >
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
        Full reports include executive summary, KPIs, visibility trends, engine breakdown, prompt performance,
        competitor intelligence, sources and citations, visibility audits, recommendations, per-prompt deep dives,
        prompt×engine matrix, and raw model answers in the appendix.
      </motion.div>
    </motion.div>
  );
};

export default ReportsView;
