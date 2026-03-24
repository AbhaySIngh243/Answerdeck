import React from 'react';

const features = [
  {
    title: 'Prompt Monitoring',
    desc: 'Track prompts across AI engines to understand user intent and brand mentions.',
    icon: (
      <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    title: 'AI Brand Detection',
    desc: 'Detect exactly when and where your brand appears in AI answers across every engine.',
    icon: (
      <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    ),
  },
  {
    title: 'Competitor Visibility',
    desc: 'See which competitors AI assistants recommend consistently over you — engine by engine.',
    icon: (
      <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Actionable Reports',
    desc: 'Not just scores — ranked action items with estimated impact so you can prioritize what to fix first.',
    icon: (
      <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
    ksp: true,
  },
];

const FeaturesSection = () => {
  return (
    <section className="border-y border-[#e2e8f0]/50 bg-white py-24" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <p className="landing-eyebrow">Features</p>
          <h2 className="heading-section mt-2">Clarity, then action</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[600px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Every insight is tied to what to do next — ranked by impact — so you can actually move your AI visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={i}
              className={`glass-card glass-card-hover group rounded-2xl border p-8 ${
                i % 2 === 0 ? 'reveal-left' : 'reveal-right'
              } ${
                f.ksp
                  ? 'card-accent-left border-brand-primary/25 bg-gradient-to-b from-brand-primary/[0.07] to-white shadow-md shadow-blue-500/5'
                  : ''
              }`}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10 transition-transform duration-300 group-hover:scale-105">
                {f.icon}
              </div>
              <h3 className="mb-2 text-xl font-bold tracking-tight text-[#0f172a] transition-colors group-hover:text-brand-primary">
                {f.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-[#64748b]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
