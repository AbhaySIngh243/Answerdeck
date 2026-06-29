import React from 'react';

const engines = [
  {
    name: 'ChatGPT',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/ChatGPT-Logo.svg',
  },
  {
    name: 'Gemini',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Google_Gemini_icon_2025.svg',
  },
  {
    name: 'Perplexity',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Perplexity_AI_Turquoise_on_White.png',
  },
  {
    name: 'Claude',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg',
  },
];

const PlatformRow = () => {
  return (
    <div className="mt-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#94a3b8]">
          Measured across leading AI engines
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {engines.map((engine) => (
            <span
              key={engine.name}
              className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white/80 px-3.5 py-2 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-md"
            >
              <img
                src={engine.logo}
                alt=""
                className="h-4 w-4 object-contain sm:h-[18px] sm:w-[18px]"
                loading="lazy"
                decoding="async"
                aria-hidden
              />
              <span className="text-[13px] font-semibold tracking-tight text-[#334155] sm:text-sm">
                {engine.name}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformRow;
