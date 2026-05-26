import React from 'react';
import { Loader2 } from 'lucide-react';

export default function AnalysisLaunchScreen({
  title = 'Your first prompt is under analysis.',
  subtitle = 'It might take 1 to 2 minutes.',
  detail,
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-full max-w-xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-white px-3 py-1.5 text-xs font-semibold text-brand-primary shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analysis running
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p>
        {detail ? <p className="mt-2 text-xs text-slate-400">{detail}</p> : null}

        <div className="mx-auto mt-8 w-full max-w-md">
          <div className="relative h-12">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
            <div className="answerdeck-launch-runner absolute top-1/2 -translate-y-1/2">
              <svg
                width="34"
                height="24"
                viewBox="0 0 52 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-brand-primary"
                aria-hidden="true"
              >
                <circle cx="38" cy="10" r="5" stroke="currentColor" strokeWidth="3" />
                <path d="M36 15 L28 22 L20 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28 22 L32 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M26 24 L18 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M30 20 L40 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes answerdeckLaunchRunnerMove {
          0% { transform: translateX(-8%) translateY(-50%); opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translateX(108%) translateY(-50%); opacity: 0; }
        }
        .answerdeck-launch-runner {
          left: 0;
          animation: answerdeckLaunchRunnerMove 2.2s linear infinite;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
