import React from 'react';

const steps = [
  {
    step: '01',
    title: 'Track',
    desc: 'Monitor every question customers ask AI assistants about your category — across ChatGPT, Gemini, Perplexity, and Claude.',
  },
  {
    step: '02',
    title: 'Analyze',
    desc: "See exactly where your brand appears, where it doesn't, and which competitors dominate each engine.",
  },
  {
    step: '03',
    title: 'Act',
    desc: 'Get a prioritized action plan: specific content changes, schema updates, and positioning moves ranked by impact.',
    ksp: true,
  },
];

const HowItWorks = () => {
  return (
    <section className="section-band-soft py-24" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="heading-section mt-2">From invisible to recommended</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Three steps that actually move the needle.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-[54px] hidden border-t border-dashed border-brand-primary/25 md:block" />

          <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className={`reveal-scale glass-card glass-card-hover rounded-2xl border p-6 transition-shadow duration-300 ${
                  item.ksp
                    ? 'card-accent-left border-brand-primary/30 bg-gradient-to-b from-brand-primary/[0.05] to-white shadow-md shadow-blue-500/5'
                    : 'border-[#e2e8f0] bg-white'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-xs font-semibold text-brand-primary">
                  {item.step}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[#0f172a]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
