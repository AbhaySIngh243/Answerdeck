import React from 'react';
import { ArrowRight, BarChart3, CheckCircle2, MessageSquareText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const highlights = [
  'See where your brand is recommended across ChatGPT, Gemini, Perplexity, and Claude.',
  'Spot the prompts where you are invisible before your buyers do.',
  'Turn each weak answer into a clear next step inside the same workspace.',
];

const proofPoints = [
  {
    icon: MessageSquareText,
    title: 'Real answer tracking',
    description: 'We measure actual AI answers, not vague proxy scores.',
  },
  {
    icon: BarChart3,
    title: 'One dashboard',
    description: 'Visibility, prompts, competitors, and recommendations stay in one view.',
  },
  {
    icon: Sparkles,
    title: 'Start free',
    description: 'Run your first prompts without a card and see the product on live data.',
  },
];

const PhoneShowcaseSection = () => {
  return (
    <section className="relative overflow-hidden bg-white py-24 md:py-28" id="proof">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 22%, rgba(37,99,235,0.14), transparent 22%), linear-gradient(180deg, rgba(248,250,252,0.9) 0%, rgba(255,255,255,1) 46%, rgba(248,250,252,0.92) 100%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="landing-eyebrow">What buyers see</p>
          <h2 className="heading-section mt-2">See the answer before your buyers do</h2>
          <div className="accent-heading-rule mx-auto" />
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Buyers ask assistants for recommendations before they open a search results page. Answrdeck helps you see
            those answers, understand when you are missing, and respond with the right fixes.
          </p>
        </div>

        <div className="mt-14 grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary shadow-sm backdrop-blur-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              Start free
            </div>

            <p className="mt-7 max-w-xl text-lg font-semibold leading-relaxed text-[#0f172a] sm:text-xl">
              When an assistant answers a buyer prompt, you should know whether your brand showed up, who replaced
              you, and what to fix next.
            </p>

            <div className="mt-8 space-y-3">
              {highlights.map((item) => (
                <div key={item} className="glass-card flex gap-3 rounded-2xl border border-[#dbe4f3] px-4 py-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-brand-primary" />
                  <p className="text-sm leading-relaxed text-[#334155]">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((item) => (
                <article key={item.title} className="rounded-2xl border border-[#e2e8f0] bg-white/92 p-4 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-[#0f172a]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{item.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link to="/signup" className="btn-primary text-center">
                Start free
              </Link>
              <a href="#platform" className="btn-secondary text-center">
                See the dashboard
              </a>
            </div>
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <img
              src="/phone-footer.png"
              alt="Answrdeck monitors buyer prompts across ChatGPT, Gemini, Perplexity, and Claude"
              className="block h-auto w-full max-w-full"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PhoneShowcaseSection;
