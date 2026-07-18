import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Minus } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import PlatformRow from './PlatformRow';
import RevealSection from './RevealSection';
import RequestDemoDialog from './RequestDemoDialog';
import { useAuth } from '../contexts/AuthContext';
import { PENDING_CASHFREE_PLAN_KEY } from '../lib/subscriptionCheckout';
import { formatPlanPrice, MARKETING_PLAN_AMOUNTS_USD } from '../lib/billingDisplay';
import { SUPPORT_EMAIL_HELLO } from '../lib/supportEmails';

const comparisonGroups = [
  {
    group: 'Tracking',
    rows: [
      { label: 'Projects (brands)', free: '1', standard: '1', pro: '3', custom: 'Unlimited*' },
      { label: 'Prompts per project', free: '3', standard: '10', pro: '10', custom: 'Custom' },
      { label: 'ChatGPT, Gemini, Perplexity & Claude', free: true, standard: true, pro: true, custom: true },
      { label: 'Competitor tracking', free: true, standard: true, pro: true, custom: true },
    ],
  },
  {
    group: 'Insight',
    rows: [
      { label: 'Visibility dashboard & trends', free: true, standard: true, pro: true, custom: true },
      { label: 'Prompt-level performance', free: true, standard: true, pro: true, custom: true },
      { label: 'Sources & citation intelligence', free: false, standard: true, pro: true, custom: true },
    ],
  },
  {
    group: 'Action',
    rows: [
      { label: 'Evidence-backed recommendations', free: true, standard: true, pro: true, custom: true },
      { label: 'Opportunities plans', free: false, standard: true, pro: true, custom: true },
      { label: 'Content Studio drafts', free: false, standard: true, pro: true, custom: true },
    ],
  },
  {
    group: 'Support',
    rows: [
      { label: 'Email support', free: true, standard: true, pro: true, custom: true },
      { label: 'Dedicated onboarding', free: false, standard: false, pro: false, custom: true },
      { label: 'Custom integrations & invoicing', free: false, standard: false, pro: false, custom: true },
    ],
  },
];

const faqs = [
  {
    q: 'Do all plans track the same AI engines?',
    a: 'Yes. Every plan, including Free, measures your brand across ChatGPT, Gemini, Perplexity, and Claude. Higher tiers unlock more projects, more prompts, and the full action workflow (Sources, Opportunities, Content Studio), not a different set of engines.',
  },
  {
    q: 'Can I start without a credit card?',
    a: 'Yes. The Free plan needs no card and includes 1 project with 3 prompts, plus the full dashboard and recommendations. It exists so you can see your real AI visibility before paying anything.',
  },
  {
    q: 'How does billing work?',
    a: 'Prices shown are in USD. Checkout runs as a one-time monthly payment via Cashfree. Pay again each month to renew, no lock-in. Custom plans can be scoped with invoice billing.',
  },
  {
    q: 'Which plan is right for me?',
    a: 'Free to validate the signal. Standard when one brand needs the full stack: 10 prompts, Sources, Opportunities, and Content Studio. Pro when you manage up to 3 brands or markets. Custom for higher volume, dedicated onboarding, or integrations.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Since billing is a monthly payment rather than a locked contract, you can move up or down whenever your month renews. Your projects and history stay intact.',
  },
];

function CellValue({ value }) {
  if (value === true) return <Check className="mx-auto h-4.5 w-4.5 text-brand-primary" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4.5 w-4.5 text-[#cbd5e1]" aria-label="Not included" />;
  return <span className="text-sm font-semibold text-[#0f172a]">{value}</span>;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [demoOpen, setDemoOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const freePrice = formatPlanPrice(0, 'USD');
  const standardPrice = formatPlanPrice(MARKETING_PLAN_AMOUNTS_USD.standard, 'USD');
  const proPrice = formatPlanPrice(MARKETING_PLAN_AMOUNTS_USD.pro, 'USD');

  const queueCheckout = (planKey) => {
    try {
      sessionStorage.setItem(PENDING_CASHFREE_PLAN_KEY, planKey);
    } catch {
      /* ignore */
    }
    if (isSignedIn) {
      navigate('/dashboard');
      return;
    }
    navigate('/signup');
  };

  const plans = [
    {
      key: 'free',
      name: 'Free',
      price: freePrice,
      suffix: '/mo',
      tagline: 'Prove the signal',
      blurb: 'See what AI actually says about your brand. No card required.',
      features: [
        '1 project',
        '3 prompts per project',
        'All 4 AI engines',
        'Full dashboard & recommendations',
      ],
      cta: { label: 'Start free', onClick: () => navigate('/signup'), kind: 'secondary' },
    },
    {
      key: 'standard',
      name: 'Standard',
      price: standardPrice,
      suffix: '/mo',
      tagline: 'The full workflow',
      blurb: 'One brand, the complete loop, from measurement to shipped fixes.',
      features: [
        '1 project',
        '10 prompts per project',
        'Sources & citation intelligence',
        'Opportunities plans',
        'Content Studio drafts',
      ],
      cta: { label: 'Start Standard', onClick: () => queueCheckout('standard'), kind: 'primary' },
    },
    {
      key: 'pro',
      name: 'Pro',
      price: proPrice,
      suffix: '/mo',
      tagline: 'Multiple brands',
      blurb: 'For teams tracking several brands, products, or markets at once.',
      featured: true,
      features: [
        '3 projects',
        '10 prompts per project',
        'Everything in Standard',
        'Multi-brand comparison',
      ],
      cta: { label: 'Start Pro', onClick: () => queueCheckout('pro'), kind: 'primary' },
    },
    {
      key: 'custom',
      name: 'Custom',
      price: "Let's talk",
      suffix: null,
      tagline: 'Your terms',
      blurb: 'Volume, invoice billing, integrations, or hands-on onboarding.',
      features: [
        'Unlimited projects & prompts*',
        'Dedicated onboarding',
        'Custom integrations',
        'Priority support',
      ],
      cta: {
        label: 'Contact sales',
        href: `mailto:${SUPPORT_EMAIL_HELLO}?subject=Answrdeck%20Custom%20Plan`,
        kind: 'secondary',
      },
    },
  ];

  return (
    <>
      <Navbar />
      <main className="landing-flow">
        {/* Hero + plans in one visual block */}
        <section className="landing-section relative overflow-hidden hero-gradient pb-4 pt-12 md:pt-16">
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="landing-eyebrow">Pricing</p>
              <h1 className="mt-3 text-[clamp(2rem,4.2vw+0.75rem,3.35rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#0f172a]">
                Know what AI says about you.{' '}
                <span className="text-brand-primary">Then change it.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#334155] sm:text-lg">
                Every plan measures across ChatGPT, Gemini, Perplexity, and Claude. No seats to count, no engines
                paywalled, no quote-only pricing games.
              </p>
            </div>
          </div>
        </section>

        <RevealSection as="section" className="landing-section relative bg-transparent pb-14 pt-10 md:pb-16" delay={40}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-transparent via-white/70 to-white"
            aria-hidden
          />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <div
                  key={plan.key}
                  className={`relative flex h-full flex-col rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 ${
                    plan.featured
                      ? 'bg-[#0f172a] text-white shadow-[0_24px_60px_rgba(15,23,42,0.25)]'
                      : 'glass-card border border-[#e2e8f0] hover:shadow-md'
                  }`}
                >
                  {plan.featured ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/30">
                      Most popular
                    </span>
                  ) : null}
                  <div className="flex items-baseline justify-between">
                    <p
                      className={`text-sm font-bold uppercase tracking-wider ${
                        plan.featured ? 'text-white' : 'text-[#0f172a]'
                      }`}
                    >
                      {plan.name}
                    </p>
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        plan.featured ? 'text-blue-300' : 'text-brand-primary'
                      }`}
                    >
                      {plan.tagline}
                    </p>
                  </div>
                  <p className={`mt-4 flex items-baseline gap-1 ${plan.featured ? 'text-white' : 'text-[#0f172a]'}`}>
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    {plan.suffix ? (
                      <span className={`text-sm font-medium ${plan.featured ? 'text-slate-400' : 'text-[#64748b]'}`}>
                        {plan.suffix}
                      </span>
                    ) : null}
                  </p>
                  <p className={`mt-2.5 text-sm leading-relaxed ${plan.featured ? 'text-slate-300' : 'text-[#64748b]'}`}>
                    {plan.blurb}
                  </p>
                  <ul className={`mt-6 flex-1 space-y-2.5 text-sm ${plan.featured ? 'text-slate-200' : 'text-[#334155]'}`}>
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-blue-400' : 'text-brand-primary'}`}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.cta.href ? (
                    <a
                      href={plan.cta.href}
                      className="btn-secondary mt-8 w-full px-4 py-3 text-center text-sm font-semibold"
                    >
                      {plan.cta.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={plan.cta.onClick}
                      className={`mt-8 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                        plan.featured
                          ? 'bg-brand-primary text-white shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 hover:bg-[#3b82f6]'
                          : plan.cta.kind === 'primary-dark'
                            ? 'bg-[#0f172a] text-white hover:bg-black'
                            : 'border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]'
                      }`}
                    >
                      {plan.cta.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-[#94a3b8]">
              * Custom limits by agreement. Prices shown in USD; checkout may settle in local currency via Cashfree.
            </p>
            <PlatformRow />
          </div>
        </RevealSection>

        {/* Comparison */}
        <RevealSection as="section" className="landing-section section-band-soft py-14 md:py-20" delay={80}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="landing-eyebrow">Compare</p>
              <h2 className="heading-section mt-2">Every plan, side by side</h2>
              <div className="accent-heading-rule" />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="w-[38%] px-4 py-4 text-sm font-semibold text-[#64748b] sm:px-6">Feature</th>
                    {['Free', 'Standard', 'Pro', 'Custom'].map((h) => (
                      <th key={h} className="px-3 py-4 text-center">
                        <span
                          className={`text-sm font-bold ${
                            h === 'Pro'
                              ? 'rounded-full bg-brand-primary px-3 py-1 text-white'
                              : 'text-[#0f172a]'
                          }`}
                        >
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonGroups.map((group) => (
                    <React.Fragment key={group.group}>
                      <tr className="bg-slate-50/80">
                        <td
                          colSpan={5}
                          className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary sm:px-6"
                        >
                          {group.group}
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.label} className="border-b border-[#f1f5f9] last:border-0">
                          <td className="px-4 py-3.5 text-sm text-[#334155] sm:px-6">{row.label}</td>
                          <td className="px-3 py-3.5 text-center">
                            <CellValue value={row.free} />
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <CellValue value={row.standard} />
                          </td>
                          <td className="bg-brand-primary/[0.03] px-3 py-3.5 text-center">
                            <CellValue value={row.pro} />
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <CellValue value={row.custom} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealSection>

        {/* Value framing */}
        <RevealSection as="section" className="landing-section bg-white py-14 md:py-20" delay={100}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'One customer pays for it',
                  body: 'A single deal influenced by an AI recommendation covers months of Standard. The question is whether that recommendation names you or a competitor.',
                },
                {
                  title: 'Cheaper than not knowing',
                  body: 'Most teams discover they are invisible on their highest-intent prompts within the first run. Finding that out on the Free plan costs nothing.',
                },
                {
                  title: 'No enterprise theater',
                  body: 'No “book a call to see the price” walls, no per-seat math, no engines locked behind top tiers. What you see here is what you pay.',
                },
              ].map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-[#dbe4f3] bg-slate-50/80 p-7 transition-colors hover:border-brand-primary/25 hover:bg-white"
                >
                  <h3 className="text-lg font-bold tracking-tight text-[#0f172a]">{card.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#64748b]">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* FAQ */}
        <RevealSection as="section" className="landing-section section-band-soft py-14 md:py-20" delay={120}>
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <p className="landing-eyebrow">FAQ</p>
              <h2 className="heading-section mt-2">Before you decide</h2>
              <div className="accent-heading-rule" />
            </div>
            <div className="space-y-3">
              {faqs.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div key={item.q} className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/80"
                      onClick={() => setOpenFaq(open ? -1 : i)}
                      aria-expanded={open}
                    >
                      <span className="flex-1 text-sm font-semibold text-[#0f172a] sm:text-base">{item.q}</span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-[#94a3b8] transition-transform duration-200 ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {open ? (
                      <div className="border-t border-[#f1f5f9] px-5 py-4">
                        <p className="text-sm leading-relaxed text-[#64748b]">{item.a}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </RevealSection>

        {/* CTA */}
        <section className="landing-section relative overflow-x-clip bg-white py-14 md:py-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 70% 55% at 50% 100%, rgba(37,99,235,0.1), transparent 72%)',
            }}
          />
          <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="landing-eyebrow">Next step</p>
            <h2 className="heading-section mt-2">Run your first three prompts free</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#64748b]">
              Ten minutes from signup, you&apos;ll know which engines recommend you, and which quietly recommend
              someone else. Prefer a walkthrough? We&apos;ll show you live.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup" className="btn-primary px-7 py-3.5 text-sm">
                Start free
              </Link>
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="btn-secondary inline-flex items-center gap-2 px-7 py-3.5 text-sm"
              >
                Request demo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <RequestDemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
}
