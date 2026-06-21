import React from 'react';
import { Eye, ListOrdered, MessageSquareQuote } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';

const metrics = [
  {
    icon: Eye,
    title: 'Visibility',
    desc: 'The share of answers where your brand is mentioned, so you know how often you actually show up in the conversation.',
  },
  {
    icon: ListOrdered,
    title: 'Average position',
    desc: 'Where you land when you are mentioned: first pick or buried in a longer list, across every engine you track.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Mention rate by engine',
    desc: 'A per-engine breakdown of which models recommend you and which skip you for a competitor.',
  },
];

const AiAnswerSection = () => {
  return (
    <section className="section-band-soft pb-20 pt-10 md:pb-24 md:pt-14" id="ai-answers">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div>
          <p className="landing-eyebrow">AI search metrics</p>
          <h2 className="heading-section mt-3">Understand how AI answers in your category</h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            When a buyer asks an assistant what to use, you get a short list, not ten links. Answrdeck measures the
            metrics that decide whether your brand makes that list, on the questions your market actually asks.
          </p>

          <div className="mt-9 space-y-3">
            {metrics.map((m) => (
              <div
                key={m.title}
                className="glass-card glass-card-hover flex gap-4 rounded-2xl border border-[#e2e8f0] p-5"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <m.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-[#0f172a]">{m.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-brand-primary/10 via-transparent to-transparent blur-2xl" aria-hidden />
          <div className="glass-card rounded-2xl border border-[#e2e8f0] p-3 shadow-lg shadow-slate-900/5 md:p-4">
            <div className="mb-3 flex items-center gap-2 px-2 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
              <span className="ml-2 text-[11px] font-medium text-[#94a3b8]">Answer engine insights</span>
            </div>
            <ImagePlaceholder
              name="answer-engine-insights.webp"
              label="Live AI answer with brand mentions & position"
              aspect="4 / 3"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AiAnswerSection;
