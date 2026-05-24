import React from 'react';

const steps = [
  {
    step: '01',
    title: 'Set up your project',
    desc: 'Add your brand, site, competitors, and the buyer prompts you want to win — we help suggest prompts during onboarding.',
  },
  {
    step: '02',
    title: 'Run cross-engine analysis',
    desc: 'Answrdeck queries ChatGPT, Gemini, Perplexity, and Claude, then maps visibility %, rankings, competitor displacement, and cited sources per prompt.',
  },
  {
    step: '03',
    title: 'Execute the fixes',
    desc: 'Use prioritized recommendations, Opportunities (weekly action plans), and Content Studio drafts tied to real engine quotes — not generic SEO advice.',
    ksp: true,
  },
];

const HowItWorks = () => {
  return (
    <section className="section-band-soft py-24" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="heading-section mt-2">From measurement to shipped changes</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Three steps that match what you do inside the product today.
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
