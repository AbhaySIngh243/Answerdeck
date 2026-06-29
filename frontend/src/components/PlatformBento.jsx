import React from 'react';
import { BarChart3, LineChart, Search, Users } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';

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
    <section className="border-y border-[#e2e8f0]/60 bg-white py-24" id="platform">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-3xl">
          <p className="landing-eyebrow">Inside the dashboard</p>
          <h2 className="heading-section mt-2">The dashboard that turns AI mentions into next actions</h2>
          <p className="mt-6 text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Understand where your brand appears, which buyer prompts miss you, and where competitors win the answer,
            all from one workspace your team can act on immediately.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="glass-card group flex flex-col overflow-hidden rounded-[2rem] border border-brand-primary/20 bg-gradient-to-b from-brand-primary/[0.05] via-white to-white p-6 lg:p-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <BarChart3 className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-bold tracking-tight text-[#0f172a]">Multi-engine visibility dashboard</h3>
            </div>
            <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-[#64748b]">
              One place to review visibility trends across ChatGPT, Gemini, Perplexity, and Claude without bouncing
              between screenshots, spreadsheets, or manual prompt logs.
            </p>
            <ImagePlaceholder
              name="dashboard.png"
              src="/dashboard.png"
              label="Visibility trends across every engine"
              alt="Answrdeck project dashboard with visibility trends, KPIs, and prompt performance"
              aspect="16 / 9"
              className="mt-auto"
            />
          </article>

          <div className="grid gap-4">
            {cards.map((c) => (
              <article
                key={c.title}
                className="glass-card glass-card-hover group rounded-2xl border border-[#e2e8f0] p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition-transform duration-300 group-hover:scale-105">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold tracking-tight text-[#0f172a] transition-colors group-hover:text-brand-primary">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{c.desc}</p>
                  </div>
                </div>
              </article>
            ))}

            <article className="rounded-2xl border border-[#dbe4f3] bg-slate-50/80 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                Built for fast clarity
              </p>
              <h3 className="mt-3 text-lg font-bold tracking-tight text-[#0f172a]">
                See what changed, why it changed, and what to do next.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64748b]">
                Answrdeck keeps the workflow tight: monitor AI visibility, review the missed prompts, and move straight
                into the recommendations that improve coverage.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlatformBento;
