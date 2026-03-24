import React from 'react';

const PlatformRow = () => {
  const items = ['OpenAI', 'Gemini', 'Perplexity', 'Claude', 'ChatGPT', 'DeepSeek'];

  return (
    <div className="mt-16 flex min-h-14 w-full items-center overflow-hidden border-y border-[#e2e8f0] bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 backdrop-blur-sm">
      <div className="flex w-full items-center gap-3 sm:gap-4">
        <span className="whitespace-nowrap pl-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#64748b] sm:pl-6 sm:text-[11px]">
          Track recommendations across
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="flex w-[200%] animate-[marquee_22s_linear_infinite] items-center gap-10 whitespace-nowrap">
            {[...items, ...items].map((platform, idx) => (
              <span
                key={`${platform}-${idx}`}
                className="text-sm font-bold tracking-tight text-[#475569] transition-colors hover:text-brand-primary"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformRow;
