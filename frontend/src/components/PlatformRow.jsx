import React from 'react';

const PlatformRow = () => {
  const platforms = ['OpenAI', 'Gemini', 'Perplexity', 'Claude'];

  return (
    <div className="w-full py-12 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-6">
          Track recommendations across
        </p>
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
          {platforms.map((platform) => (
            <div key={platform} className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
              {platform}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlatformRow;
