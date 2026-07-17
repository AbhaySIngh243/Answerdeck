import React, { useState } from 'react';
import { BarChart2, Search, Users, Globe, Zap, Sparkles, Check } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';

const modules = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart2,
    eyebrow: 'Visibility at a glance',
    heading: 'See where you stand across every engine',
    points: [
      'Centralized visibility trends and KPIs in one dashboard',
      'Slice results by AI engine and timeframe',
      'Track how visibility moves run over run',
    ],
    img: 'visibility-dashboard.webp',
    src: '/dashboard.png',
  },
  {
    id: 'prompts',
    label: 'Prompts',
    icon: Search,
    eyebrow: 'Buyer-prompt tracking',
    heading: 'Track the questions your market actually asks',
    points: [
      'Add the buyer prompts that matter. We suggest some during onboarding',
      'See mention rate and average position per prompt',
      'Compare engine-by-engine results for each question',
    ],
    img: 'prompt-discovery.webp',
  },
  {
    id: 'competitors',
    label: 'Competitors',
    icon: Users,
    eyebrow: 'Competitor analysis',
    heading: 'Know who wins the answer instead of you',
    points: [
      'See which competitors get recommended for your prompts',
      'Spot where rival brands displace you',
      'Benchmark your visibility against the players that matter',
    ],
    img: 'competitor-analysis.webp',
  },
  {
    id: 'sources',
    label: 'Sources',
    icon: Globe,
    eyebrow: 'Authority moat',
    heading: 'Find the sources AI engines trust',
    points: [
      'Discover the domains cited in answers about your category',
      'See how often your own site gets cited',
      'Spot citation gaps you can close to earn the mention',
    ],
    img: 'citation-tracker.webp',
  },
  {
    id: 'content-studio',
    label: 'Content Studio',
    icon: Zap,
    eyebrow: 'From gap to draft',
    heading: 'Turn measured gaps into publishable drafts',
    points: [
      'Generate drafts built from your actual run data',
      'Articles, blogs, and posts tied to real engine quotes',
      'Edit and review before anything goes live',
    ],
    img: 'content-studio.webp',
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    icon: Sparkles,
    eyebrow: 'Prioritized action plans',
    heading: 'Get a weekly plan, not just a score',
    points: [
      'Engine-specific next actions backed by evidence quotes',
      'Step-by-step plans prioritized by impact',
      'Clear focus on what to publish or cite next',
    ],
    img: 'action-playbook.webp',
  },
];

const stats = [
  { value: '4', label: 'AI engines tracked', sub: 'ChatGPT, Gemini, Perplexity, Claude' },
  { value: '7', label: 'Connected modules', sub: 'One workspace, end to end' },
  { value: 'PDF + CSV', label: 'Shareable exports', sub: 'Report on your terms' },
  { value: '$0', label: 'To get started', sub: 'No card required' },
];

const ProductSuiteTabs = () => {
  const [active, setActive] = useState(modules[0].id);
  const current = modules.find((m) => m.id === active) || modules[0];

  return (
    <section className="section-band py-24 md:py-32" id="product">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="landing-eyebrow">Inside the product</p>
          <h2 className="heading-section mt-2">The complete workspace for AI search</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[600px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Every module connects measurement to action — the same views you use after onboarding.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {modules.map((m) => {
            const isActive = m.id === active;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActive(m.id)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? 'border-brand-primary bg-brand-primary text-white shadow-sm shadow-blue-500/20'
                    : 'border-[#e2e8f0] bg-white text-[#475569] hover:border-brand-primary/30 hover:text-brand-primary'
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="glass-card grid grid-cols-1 items-center gap-8 rounded-3xl border border-[#e2e8f0] p-6 shadow-lg shadow-slate-900/5 lg:grid-cols-2 lg:gap-12 lg:p-10">
          <div>
            <p className="landing-eyebrow">{current.eyebrow}</p>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-[#0f172a] sm:text-3xl">
              {current.heading}
            </h3>
            <ul className="mt-7 space-y-4">
              {current.points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[15px] leading-relaxed text-[#334155]">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <ImagePlaceholder
            key={current.img}
            name={current.img}
            src={current.src}
            label={current.label}
            alt={`Answrdeck ${current.label} view`}
            aspect="16 / 11"
          />
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-6 sm:gap-6 lg:grid-cols-4 lg:p-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-brand-primary sm:text-4xl">{s.value}</p>
              <p className="mt-2 text-sm font-semibold text-[#0f172a]">{s.label}</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductSuiteTabs;
