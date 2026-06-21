import React from 'react';
import ImagePlaceholder from './ImagePlaceholder';

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
    <section className="section-band-soft py-24" id="how-it-works">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="heading-section mt-2">From measurement to shipped changes</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Three steps that match exactly what you do inside the product.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <ol className="relative space-y-8">
            <div className="absolute bottom-4 left-[1.15rem] top-4 hidden w-px bg-gradient-to-b from-brand-primary/40 via-brand-primary/20 to-transparent sm:block" aria-hidden />
            {steps.map((item, i) => (
              <li key={item.step} className="relative flex gap-5">
                <span className="z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full border border-brand-primary/30 bg-white text-sm font-bold text-brand-primary shadow-sm">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                    {item.step}
                  </p>
                  <h3 className="mt-1.5 text-xl font-bold text-[#0f172a]">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#64748b]">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-bl from-brand-primary/10 via-transparent to-transparent blur-2xl" aria-hidden />
            <div className="glass-card rounded-2xl border border-[#e2e8f0] p-3 shadow-lg shadow-slate-900/5 md:p-4">
              <div className="mb-3 flex items-center justify-between px-2 pt-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                  Project onboarding
                </span>
                <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                  Step 1
                </span>
              </div>
              <ImagePlaceholder
                name="onboarding.png"
                src="/onboarding.png"
                label="Brand, competitors, and buyer prompts setup"
                alt="Answrdeck project onboarding wizard"
                fit="natural"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
