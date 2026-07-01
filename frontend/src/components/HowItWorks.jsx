import React from 'react';
import PlatformRow from './PlatformRow';

const steps = [
  {
    step: 'Step 1',
    title: 'Set up your project',
    desc: 'Add your brand, site, competitors, and the buyer prompts you want to win. We help suggest relevant prompts during onboarding.',
  },
  {
    step: 'Step 2',
    title: 'Run cross-engine analysis',
    desc: 'Answrdeck queries ChatGPT, Gemini, Perplexity, and Claude, then maps visibility, rankings, competitor displacement, and cited sources per prompt.',
  },
  {
    step: 'Step 3',
    title: 'Execute the fixes',
    desc: 'Work prioritized recommendations, Opportunities plans, and Content Studio drafts tied to real engine quotes, not generic SEO advice.',
  },
];

const HowItWorks = () => {
  return (
    <section className="landing-section section-band-soft py-12 md:py-14" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="heading-section mt-2">From measurement to shipped changes</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Three steps that match exactly what you do inside the product.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5">
          {steps.map((item, i) => (
            <li
              key={item.step}
              className="glass-card relative rounded-2xl border border-[#e2e8f0] p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-primary/30 bg-white text-sm font-bold text-brand-primary shadow-sm">
                {i + 1}
              </span>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                {item.step}
              </p>
              <h3 className="mt-1.5 text-lg font-bold text-[#0f172a]">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#64748b]">{item.desc}</p>
            </li>
          ))}
        </ol>

        <div className="group/visual mt-8 overflow-hidden rounded-2xl border border-[#e2e8f0] shadow-lg shadow-slate-900/[0.06]">
          <img
            src="/onboarding.png"
            alt="Answrdeck project onboarding wizard"
            className="block h-auto w-full"
            loading="lazy"
            decoding="async"
          />
        </div>

        <PlatformRow />
      </div>
    </section>
  );
};

export default HowItWorks;
