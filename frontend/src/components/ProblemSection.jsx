import React from 'react';

const painPoints = [
  {
    title: 'AI is the new shortlist',
    label: 'Shoppers ask assistants what to buy. The answer is a short list of brands — not ten blue links.',
  },
  {
    title: 'Every engine differs',
    label: 'ChatGPT, Gemini, Perplexity, and Claude do not rank you the same way. You need per-engine truth, not one score.',
  },
  {
    title: 'Insight without a next step fails',
    label: 'Knowing you are missing is not enough. You need which competitor won, which citation mattered, and what to change this week.',
  },
];

const queries = [
  'Best scheduling tools for remote teams',
  'Top CRM for a 10-person startup',
  'Which project management app has the best free tier',
];

const ProblemSection = () => {
  return (
    <section className="section-band border-y border-[#e2e8f0]/60 py-24" id="problem">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="landing-eyebrow">Why this matters</p>
          <h2 className="heading-section mt-3">Visibility is only step one</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[600px] text-base leading-relaxed text-[#64748b] sm:text-[17px] sm:leading-relaxed">
            Answrdeck is built for teams who want to move — not stare at dashboards. We measure real model answers, then
            hand you prioritized fixes grounded in what each engine actually said.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3 stagger-150">
          {painPoints.map((s) => (
            <div key={s.title} className="reveal-drop glass-card glass-card-hover relative overflow-hidden rounded-2xl p-6">
              <p className="text-lg font-extrabold leading-snug text-[#0f172a]">{s.title}</p>
              <p className="mt-3 text-[13px] leading-snug text-[#64748b]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="my-12 h-0.5 w-full bg-gradient-to-r from-transparent via-brand-primary/40 to-transparent opacity-90" />

        <div className="mx-auto max-w-[640px] rounded-2xl border border-[#e2e8f0]/80 bg-white/60 px-6 py-10 text-center shadow-sm backdrop-blur-sm sm:px-10">
          <p className="text-lg font-medium text-[#334155]">You add the buyer prompts your market uses.</p>
          <p className="mt-4 text-xl font-semibold leading-snug text-[#0f172a] sm:text-2xl sm:leading-snug">
            We run them across engines, show who gets recommended, and tell you what to publish or cite next.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Recommendations name the engine and competitor. Opportunities ship with a step-by-step plan. Content Studio
            drafts copy from your measured gaps — you review and publish.
          </p>
          <p className="mt-3 text-sm font-medium text-brand-primary">Diagnosis and execution in one workspace.</p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-3 md:grid-cols-3 stagger-150">
          {queries.map((q) => (
            <div key={q} className="reveal-drop glass-card glass-card-hover rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-brand-primary/25 bg-brand-primary/10 text-xs font-semibold text-brand-primary">
                  ?
                </span>
                <span className="truncate text-[13px] text-[#334155]">{q}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
