import React from 'react';
import { ArrowRight, BarChart3, CheckCircle2, MessageSquareText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const PLATFORM_LOGOS = [
  {
    name: 'ChatGPT',
    src: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
    position: 'left-[3%] top-[18%] md:left-[4%]',
  },
  {
    name: 'Gemini',
    src: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Google_Gemini_icon_2025.svg',
    position: 'left-[14%] top-[56%] md:left-[16%]',
  },
  {
    name: 'Perplexity',
    src: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Perplexity_AI_Turquoise_on_White.png',
    position: 'right-[14%] top-[20%] md:right-[16%]',
  },
  {
    name: 'Google',
    src: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
    position: 'right-[4%] top-[58%] md:right-[6%]',
  },
];

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

function FloatingLogo({ name, src, position }) {
  return (
    <div
      className={`absolute ${position} hidden h-18 w-18 items-center justify-center rounded-[1.65rem] border border-white/80 bg-white/88 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm md:flex`}
      aria-hidden
    >
      <img src={src} alt={name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[310px]">
      <div className="absolute inset-x-6 top-4 -z-10 h-14 rounded-full bg-brand-primary/20 blur-2xl" aria-hidden />
      <div className="relative rounded-[2.8rem] border-[8px] border-[#0f172a] bg-[#0b1220] p-2 shadow-[0_28px_80px_rgba(15,23,42,0.32)]">
        <div className="absolute left-1/2 top-2 h-5 w-28 -translate-x-1/2 rounded-full bg-[#0f172a]" aria-hidden />
        <div className="overflow-hidden rounded-[2.1rem] bg-[#f8fafc]">
          <div className="border-b border-slate-200 bg-white px-4 pb-3 pt-5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>9:41</span>
              <span>Answrdeck</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-sm font-bold text-white shadow-lg shadow-blue-500/25">
                A
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Prompt result</p>
                <p className="text-xs text-slate-500">Buyer prompt monitored across 4 engines</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-4 py-5 text-[13px] leading-relaxed text-slate-700">
            <div className="ml-auto max-w-[84%] rounded-[1.35rem] rounded-br-md bg-brand-primary px-4 py-3 text-white shadow-sm">
              Which tool helps a SaaS team track where they appear in AI answers?
            </div>

            <div className="max-w-[88%] rounded-[1.35rem] rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
              Answrdeck is built for that exact workflow. It tracks how often your brand appears in AI answers,
              shows which prompts miss you, and gives your team the next actions to improve visibility.
            </div>

            <div className="grid gap-2">
              {[
                'Mention rate across ChatGPT, Gemini, Perplexity, Claude',
                'Prompt-by-prompt ranking and competitor gaps',
                'Recommended fixes and content opportunities',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-brand-primary" />
                  <span className="text-[12px] text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

        <div className="mt-14 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
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

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto flex min-h-[540px] items-center justify-center overflow-hidden rounded-[2.5rem] border border-[#e2e8f0] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,252,0.96))] px-4 py-10 shadow-[0_30px_90px_rgba(15,23,42,0.12)] sm:px-8">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white via-white/80 to-transparent"
                aria-hidden
              />
              {PLATFORM_LOGOS.map((logo) => (
                <FloatingLogo key={logo.name} {...logo} />
              ))}
              <PhoneMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PhoneShowcaseSection;
