import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  Link2,
  Quote,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import PlatformRow from './PlatformRow';
import RevealSection from './RevealSection';
import RequestDemoDialog from './RequestDemoDialog';

const ENGINE_LOGOS = {
  chatgpt: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/ChatGPT-Logo.svg',
  gemini: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Google_Gemini_icon_2025.svg',
  perplexity: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Perplexity_AI_Turquoise_on_White.png',
  claude: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg',
};

/* ---------- Mock visuals (built in code, no screenshots) ---------- */

function MockWindow({ label, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2 border-b border-[#f1f5f9] bg-slate-50/70 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
        {label ? (
          <span className="ml-2 text-[11px] font-medium tracking-wide text-[#94a3b8]">{label}</span>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Hero: a buyer asks AI, the answer names your brand with citations. */
function AiAnswerMock() {
  return (
    <MockWindow label="What buyers see">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm">
          What&apos;s the best AI visibility tool for a SaaS brand?
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white shadow-sm">
          <img src={ENGINE_LOGOS.chatgpt} alt="" className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0 rounded-2xl rounded-tl-md border border-[#e2e8f0] bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-[#334155]">
          For SaaS teams,{' '}
          <mark className="rounded bg-brand-primary/10 px-1 py-0.5 font-semibold text-brand-primary">
            Answrdeck
          </mark>{' '}
          stands out. It tracks brand mentions across ChatGPT, Gemini, Perplexity, and Claude, then turns the
          gaps into prioritized fixes and drafts…
          <span className="mt-3 flex flex-wrap gap-1.5">
            {['answrdeck.com', 'g2.com', 'reddit.com'].map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white px-2 py-0.5 text-[11px] font-medium text-[#64748b]"
              >
                <Link2 className="h-3 w-3 text-brand-primary" />
                {s}
              </span>
            ))}
          </span>
        </div>
      </div>
      <p className="mt-4 border-t border-[#f1f5f9] pt-3 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#94a3b8]">
        This answer decides who gets the customer
      </p>
    </MockWindow>
  );
}

/** Step 1: project setup mock. */
function SetupMock() {
  return (
    <MockWindow label="Project setup">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Brand</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-slate-50/60 px-3 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-primary text-[10px] font-bold text-white">
              A
            </span>
            <span className="text-sm font-semibold text-[#0f172a]">Acme Cloud</span>
            <span className="ml-auto text-xs text-[#94a3b8]">acmecloud.com</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Competitors</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {['Rivalsoft', 'CloudNine', 'StackWave'].map((c) => (
              <span
                key={c}
                className="rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1 text-xs font-medium text-[#334155]"
              >
                {c}
              </span>
            ))}
            <span className="rounded-full border border-dashed border-brand-primary/40 px-2.5 py-1 text-xs font-medium text-brand-primary">
              + Add
            </span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Suggested prompts</p>
          <div className="mt-1.5 space-y-1.5">
            {[
              'Best cloud backup for startups?',
              'Acme Cloud vs Rivalsoft: which is safer?',
              'Top rated cloud storage 2026',
            ].map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-lg border border-[#f1f5f9] bg-white px-3 py-2 text-[13px] text-[#334155]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

/** Step 2: cross-engine run mock. */
function EngineRunMock() {
  const rows = [
    { key: 'chatgpt', name: 'ChatGPT', status: 'Mentioned', rank: '#2', good: true },
    { key: 'gemini', name: 'Gemini', status: 'Mentioned', rank: '#1', good: true },
    { key: 'perplexity', name: 'Perplexity', status: 'Not mentioned', rank: 'n/a', good: false },
    { key: 'claude', name: 'Claude', status: 'Mentioned', rank: '#4', good: true },
  ];
  return (
    <MockWindow label="Cross-engine analysis · “Best cloud backup for startups?”">
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center gap-3 rounded-xl border border-[#f1f5f9] bg-white px-3 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white">
              <img src={ENGINE_LOGOS[r.key]} alt="" className="h-4 w-4 object-contain" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-[#0f172a]">{r.name}</span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                r.good ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
              }`}
            >
              {r.status}
            </span>
            <span className="w-8 text-right text-sm font-bold tabular-nums text-[#0f172a]">{r.rank}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-primary/[0.06] px-3 py-2.5">
        <span className="text-xs font-medium text-[#334155]">Visibility on this prompt</span>
        <span className="text-sm font-bold text-brand-primary">3 / 4 engines</span>
      </div>
    </MockWindow>
  );
}

/** Step 3: gap analysis mock with trendline and competitor bars. */
function GapsMock() {
  const bars = [
    { name: 'Rivalsoft', pct: 82 },
    { name: 'You', pct: 61, you: true },
    { name: 'CloudNine', pct: 47 },
    { name: 'StackWave', pct: 28 },
  ];
  return (
    <MockWindow label="Where you win, and where you vanish">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Visibility trend</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#0f172a]">61%</span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
              +14% this month
            </span>
          </p>
        </div>
      </div>
      <svg viewBox="0 0 300 80" className="mt-2 h-20 w-full" aria-hidden>
        <defs>
          <linearGradient id="hiw-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,62 C30,58 45,64 70,52 C95,40 115,48 140,42 C165,36 185,30 215,26 C245,22 270,18 300,10 L300,80 L0,80 Z"
          fill="url(#hiw-trend-fill)"
        />
        <path
          d="M0,62 C30,58 45,64 70,52 C95,40 115,48 140,42 C165,36 185,30 215,26 C245,22 270,18 300,10"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="300" cy="10" r="4" fill="#2563eb" />
        <circle cx="300" cy="10" r="8" fill="#2563eb" opacity="0.15" />
      </svg>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
        Share of AI answers for “cloud backup”
      </p>
      <div className="mt-2 space-y-2">
        {bars.map((b) => (
          <div key={b.name} className="flex items-center gap-3">
            <span
              className={`w-20 shrink-0 text-xs font-medium ${
                b.you ? 'font-bold text-brand-primary' : 'text-[#64748b]'
              }`}
            >
              {b.name}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span
                className={`block h-full rounded-full ${b.you ? 'bg-brand-primary' : 'bg-slate-300'}`}
                style={{ width: `${b.pct}%` }}
              />
            </span>
            <span className="w-9 text-right text-xs font-semibold tabular-nums text-[#334155]">{b.pct}%</span>
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

/** Step 4: recommendation + draft mock. */
function ActionMock() {
  return (
    <MockWindow label="Opportunities · prioritized">
      <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/[0.04] p-3.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            High impact
          </span>
          <span className="text-[11px] font-medium text-[#64748b]">Perplexity gap</span>
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug text-[#0f172a]">
          Publish a comparison page: “Acme Cloud vs Rivalsoft”. Perplexity cites rivalsoft.com 6× on this prompt.
        </p>
        <blockquote className="mt-2.5 border-l-2 border-brand-primary/40 pl-2.5 text-xs italic leading-relaxed text-[#64748b]">
          “…Rivalsoft offers stronger encryption defaults according to rivalsoft.com/security…”
          <span className="mt-0.5 block not-italic font-medium text-[#94a3b8]">Quoted from Perplexity</span>
        </blockquote>
      </div>
      <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-3.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-primary" />
          <span className="text-xs font-semibold text-[#0f172a]">Content Studio draft</span>
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
            Ready to review
          </span>
        </div>
        <div className="mt-2.5 space-y-1.5" aria-hidden>
          <div className="h-2 w-3/4 rounded-full bg-slate-200" />
          <div className="h-2 w-full rounded-full bg-slate-100" />
          <div className="h-2 w-5/6 rounded-full bg-slate-100" />
          <div className="h-2 w-2/3 rounded-full bg-slate-100" />
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white">
            Open draft
          </span>
          <span className="rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-semibold text-[#334155]">
            Edit
          </span>
        </div>
      </div>
    </MockWindow>
  );
}

/* ---------- Page content ---------- */

const steps = [
  {
    eyebrow: 'Step 01: Define',
    title: 'Start with the questions that decide the sale',
    desc: 'Add your brand, site, and competitors, then pick the buyer prompts you want to win. Onboarding suggests real questions people ask AI in your category, so you measure demand, not guesses.',
    points: ['Brand & competitor setup in minutes', 'Prompt suggestions from onboarding', 'Track the prompts that drive consideration'],
    visual: SetupMock,
  },
  {
    eyebrow: 'Step 02: Measure',
    title: 'Ask every engine, the way a buyer would',
    desc: 'Answrdeck runs your prompts against ChatGPT, Gemini, Perplexity, and Claude. For every answer we record whether you were named, where you ranked, who displaced you, and which sources were cited.',
    points: ['4 engines, one run', 'Mentions, rankings & displacement', 'Every cited URL verified live'],
    visual: EngineRunMock,
    flip: true,
  },
  {
    eyebrow: 'Step 03: Diagnose',
    title: 'See exactly where you vanish, and why',
    desc: 'The dashboard turns raw answers into signal: your visibility trendline, prompt-level wins and losses, competitor share of voice, and the source domains AI trusts when it recommends someone else.',
    points: ['Visibility trend over time', 'Prompt performance table', 'Competitor & source intelligence'],
    visual: GapsMock,
  },
  {
    eyebrow: 'Step 04: Act',
    title: 'Ship fixes backed by real engine quotes',
    desc: 'No generic SEO checklists. Opportunities are prioritized by impact and tied to actual quotes from AI answers, and Content Studio turns them into publishable drafts in your brand voice.',
    points: ['Prioritized Opportunities', 'Evidence-backed recommendations', 'Drafts ready in Content Studio'],
    visual: ActionMock,
    flip: true,
  },
];

const signals = [
  {
    icon: BarChart3,
    title: 'Visibility',
    desc: 'How often you appear across relevant AI answers: your share of the conversation.',
  },
  {
    icon: Target,
    title: 'Position',
    desc: 'Where you land when named: first recommendation, afterthought, or replaced.',
  },
  {
    icon: Quote,
    title: 'Sources',
    desc: 'The domains and pages AI cites. Every URL is checked so you act on live pages.',
  },
  {
    icon: Users,
    title: 'Competitors',
    desc: 'Who wins the prompts you lose, so your next move is obvious.',
  },
];

export default function HowItWorksPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <>
      <Navbar />
      <main className="landing-flow">
        {/* Hero */}
        <section className="landing-section relative overflow-hidden hero-gradient pb-16 pt-12 md:pb-20 md:pt-16">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-white/50 to-white"
            aria-hidden
          />
          <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <div>
              <p className="landing-eyebrow">How it works</p>
              <h1 className="mt-3 text-[clamp(2rem,4.2vw+0.75rem,3.35rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#0f172a]">
                Every day, AI answers the question{' '}
                <span className="text-brand-primary">“who should I buy from?”</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-[#334155] sm:text-lg">
                Answrdeck shows you whose name comes back, then walks you through a four-step loop to make sure
                it&apos;s yours. Define, measure, diagnose, act. Repeat weekly.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                <Link to="/signup" className="btn-primary text-center">
                  Start free
                </Link>
                <button type="button" onClick={() => setDemoOpen(true)} className="btn-secondary text-center">
                  Request demo
                </button>
              </div>
            </div>
            <div className="hero-float-node">
              <AiAnswerMock />
            </div>
          </div>
        </section>

        {/* Steps: alternating narrative */}
        <section className="landing-section bg-white py-14 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
              <p className="landing-eyebrow">The loop</p>
              <h2 className="heading-section mt-2">Four steps from invisible to recommended</h2>
              <div className="accent-heading-rule" />
            </div>

            <div className="space-y-16 md:space-y-24">
              {steps.map((step, i) => (
                <RevealSection
                  key={step.eyebrow}
                  as="div"
                  delay={60}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
                >
                  <div className={step.flip ? 'lg:order-2' : ''}>
                    <p className="landing-eyebrow">{step.eyebrow}</p>
                    <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.02em] text-[#0f172a] sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-[17px]">
                      {step.desc}
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {step.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-[15px] text-[#334155]">
                          <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-primary" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={step.flip ? 'lg:order-1' : ''}>
                    <step.visual />
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* Signals band */}
        <RevealSection as="section" className="landing-section section-band-soft py-14 md:py-20" delay={80}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="landing-eyebrow">What we track</p>
              <h2 className="heading-section mt-2">The four signals behind every AI recommendation</h2>
              <div className="accent-heading-rule" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {signals.map((s) => (
                <article
                  key={s.title}
                  className="glass-card glass-card-hover group rounded-2xl border border-[#e2e8f0] p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition-transform duration-300 group-hover:scale-105">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold tracking-tight text-[#0f172a] group-hover:text-brand-primary">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{s.desc}</p>
                </article>
              ))}
            </div>
            <PlatformRow />
          </div>
        </RevealSection>

        {/* Weekly rhythm */}
        <RevealSection as="section" className="landing-section bg-white py-14 md:py-20" delay={100}>
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[#dbe4f3] bg-slate-50/80 p-8 sm:p-10 md:p-12">
              <div className="flex items-start gap-4">
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary sm:flex">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <p className="landing-eyebrow">The compounding part</p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-[#0f172a] sm:text-3xl">
                    Re-run. Compare. Watch mentions compound.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#64748b]">
                    AI answers shift constantly. Each week, re-run your prompts, see whether the fixes you shipped
                    moved the trendline, and pick the next highest-impact gap. Teams that close the loop weekly
                    stop reacting to AI search. They start steering it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* CTA */}
        <section className="landing-section relative overflow-x-clip bg-white py-14 md:py-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 55% at 50% 100%, rgba(37,99,235,0.1), transparent 72%), radial-gradient(ellipse 50% 40% at 80% 0%, rgba(219,234,254,0.4), transparent 55%)',
            }}
          />
          <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="landing-eyebrow">Start the loop</p>
            <h2 className="heading-section mt-2">Find out what AI says about you, free</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#64748b]">
              One project, three prompts, no card. In ten minutes you&apos;ll know which engines recommend you and
              which recommend someone else.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup" className="btn-primary px-7 py-3.5 text-sm">
                Start free
              </Link>
              <Link to="/pricing" className="btn-secondary inline-flex items-center gap-2 px-7 py-3.5 text-sm">
                See pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <RequestDemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}
