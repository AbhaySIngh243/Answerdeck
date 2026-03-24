import React from 'react';

const stats = [
  { num: '63%', label: 'of consumers now use AI assistants for product discovery (2024)' },
  { num: 'Top 3', label: 'AI engines mention only the top 3 brands in most category responses' },
  { num: '0 clicks', label: "AI answers require no click-through. If you're not named, you're gone." },
];

const queries = ['Best TVs under ₹50k', 'Best CRM for startups', 'Best productivity apps'];

const ProblemSection = () => {
  return (
    <section className="section-band border-y border-[#e2e8f0]/60 py-24" id="problem">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="landing-eyebrow">The shift happening right now</p>
          <h2 className="heading-section mt-3">AI assistants are the new discovery layer</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[600px] text-base leading-relaxed text-[#64748b] sm:text-[17px] sm:leading-relaxed">
            People no longer scroll through Google results. They ask ChatGPT, Gemini, and Perplexity what to buy — and trust the
            answer instantly.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-3 stagger-150">
          {stats.map((s) => (
            <div key={s.num} className="reveal-drop glass-card glass-card-hover relative overflow-hidden rounded-2xl p-6">
              <p className="text-4xl font-extrabold leading-none text-[#0f172a]">{s.num}</p>
              <p className="mt-3 text-[13px] leading-snug text-[#64748b]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="my-12 h-0.5 w-full bg-gradient-to-r from-transparent via-brand-primary/40 to-transparent opacity-90" />

        <div className="mx-auto max-w-[640px] rounded-2xl border border-[#e2e8f0]/80 bg-white/60 px-6 py-10 text-center shadow-sm backdrop-blur-sm sm:px-10">
          <p className="text-lg font-medium text-[#334155]">AI systems generate recommendations instantly.</p>
          <p className="mt-4 text-xl font-semibold leading-snug text-[#0f172a] sm:text-2xl sm:leading-snug">
            If your brand doesn&apos;t appear in those answers, you are invisible in that conversation.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Most tools stop there — they show you a score and leave you guessing. Answrdeck shows you exactly what to change, ranked
            by impact.
          </p>
          <p className="mt-3 text-sm font-medium text-brand-primary">Not just data. A clear action plan.</p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-3 md:grid-cols-3 stagger-150">
          {queries.map((q) => (
            <div key={q} className="reveal-drop glass-card glass-card-hover rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-brand-primary/25 bg-brand-primary/10 text-xs font-semibold text-brand-primary">
                  U
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
