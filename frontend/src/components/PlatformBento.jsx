import React from 'react';
import { LineChart, Search, Users } from 'lucide-react';

const cards = [
  {
    icon: LineChart,
    title: 'Visibility trendline',
    desc: 'See how often your brand gets mentioned and whether that direction is improving week over week.',
  },
  {
    icon: Search,
    title: 'Prompt-level view',
    desc: 'Track the buyer questions that matter instead of staring at one blended score.',
  },
  {
    icon: Users,
    title: 'Competitor gaps',
    desc: 'Find which competitor gets recommended when you do not, so the next move is obvious.',
  },
];

const PlatformBento = () => {
  return (
    <section className="landing-section bg-white py-12 md:py-14" id="platform">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="landing-eyebrow">Inside the dashboard</p>
          <h2 className="heading-section mt-2">The dashboard that turns AI mentions into next actions</h2>
          <p className="mt-6 text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Understand where your brand appears, which buyer prompts miss you, and where competitors win the answer,
            all from one workspace your team can act on immediately.
          </p>
        </div>

        <div className="group/visual mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#e2e8f0] shadow-lg shadow-slate-900/[0.06]">
          <img
            src="/dashboard.png"
            alt="Answrdeck project dashboard with visibility trends, KPIs, and prompt performance"
            className="block h-auto w-full"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <article
              key={c.title}
              className="glass-card glass-card-hover group rounded-2xl border border-[#e2e8f0] p-6"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition-transform duration-300 group-hover:scale-105">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold tracking-tight text-[#0f172a] transition-colors group-hover:text-brand-primary">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{c.desc}</p>
            </article>
          ))}
        </div>

        <article className="mt-4 rounded-2xl border border-[#dbe4f3] bg-slate-50/80 p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Built for fast clarity
          </p>
          <h3 className="mt-3 text-lg font-bold tracking-tight text-[#0f172a]">
            See what changed, why it changed, and what to do next.
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#64748b]">
            Answrdeck keeps the workflow tight: monitor AI visibility, review the missed prompts, and move straight
            into the recommendations that improve coverage.
          </p>
        </article>
      </div>
    </section>
  );
};

export default PlatformBento;
