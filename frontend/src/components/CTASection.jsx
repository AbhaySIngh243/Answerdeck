import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { PENDING_CASHFREE_PLAN_KEY } from '../lib/subscriptionCheckout';
import {
  billingCycleNote,
  billingCurrency,
  formatPlanPrice,
  planAmountFromHealth,
} from '../lib/billingDisplay';
import { api } from '../lib/api';
import { SUPPORT_EMAIL_HELLO } from '../lib/supportEmails';

const CTASection = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { data: billingHealth } = useQuery({
    queryKey: ['billing', 'health'],
    queryFn: api.getBillingHealth,
    staleTime: 120_000,
  });

  const currency = billingCurrency(billingHealth);
  const standardAmount = planAmountFromHealth(billingHealth, 'standard');
  const proAmount = planAmountFromHealth(billingHealth, 'pro');
  const standardPrice = formatPlanPrice(standardAmount, currency);
  const proPrice = formatPlanPrice(proAmount, currency);

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

  return (
    <section
      id="pricing"
      className="relative overflow-x-clip border-t border-[#e2e8f0]/60 bg-white py-24 md:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 100%, rgba(37,99,235,0.1), transparent 72%), radial-gradient(ellipse 50% 40% at 20% 0%, rgba(219,234,254,0.35), transparent 55%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div id="book-demo" className="mx-auto max-w-3xl text-center">
          <p className="landing-eyebrow">Pricing</p>
          <h2 className="heading-section mt-2">Start measuring free. Scale when you are ready.</h2>
          <div className="accent-heading-rule mx-auto" />
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Run your first prompts on the free plan, then upgrade when you need more projects and buyer questions
            tracked. Same dashboard, recommendations, and Content Studio on every tier.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/signup" className="btn-primary px-7 py-3.5 text-sm">
              Start free — no card required
            </Link>
            <a href="#how-it-works" className="btn-secondary px-7 py-3.5 text-sm">
              See how it works
            </a>
          </div>

          <p className="mt-5 text-xs text-[#64748b]">
            Free plan includes <strong className="font-semibold text-[#475569]">1 project</strong> and{' '}
            <strong className="font-semibold text-[#475569]">3 prompts</strong> per project.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Free</p>
            <p className="mt-3 flex items-baseline gap-1 text-[#0f172a]">
              <span className="text-3xl font-bold tracking-tight">{formatPlanPrice(0, currency)}</span>
              <span className="text-sm font-medium text-[#64748b]">/mo</span>
            </p>
            <p className="mt-2 text-sm text-[#64748b]">See your AI visibility on one brand. No card required.</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>1 project</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>3 prompts per project</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>Full dashboard &amp; recommendations</span>
              </li>
            </ul>
            <Link
              to="/signup"
              className="btn-secondary mt-8 w-full px-4 py-3.5 text-center text-sm font-semibold"
            >
              Start free
            </Link>
          </div>

          {/* Standard */}
          <div className="flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Standard</p>
            <p className="mt-3 flex items-baseline gap-1 text-[#0f172a]">
              <span className="text-3xl font-bold tracking-tight">{standardPrice}</span>
              <span className="text-sm font-medium text-[#64748b]">/mo</span>
            </p>
            <p className="mt-2 text-sm text-[#64748b]">One brand, full analysis stack. Recommendations and drafts included.</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>1 project</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>10 prompts per project</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>Dashboard, Sources, Opportunities &amp; Content Studio</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => queueCheckout('standard')}
              className="btn-primary mt-8 w-full px-4 py-3.5 text-sm"
            >
              Start Standard
            </button>
          </div>

          {/* Pro */}
          <div className="flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Pro</p>
            <p className="mt-3 flex items-baseline gap-1 text-[#0f172a]">
              <span className="text-3xl font-bold tracking-tight">{proPrice}</span>
              <span className="text-sm font-medium text-[#64748b]">/mo</span>
            </p>
            <p className="mt-2 text-sm text-[#64748b]">For teams tracking multiple brands or markets.</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>3 projects</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>10 prompts per project</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>Everything in Standard</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => queueCheckout('pro')}
              className="btn-primary mt-8 w-full px-4 py-3.5 text-sm"
            >
              Start Pro
            </button>
          </div>

          {/* Custom */}
          <div className="flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Custom</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[#0f172a]">Let&apos;s talk</p>
            <p className="mt-2 text-sm text-[#64748b]">Higher volume, invoice billing, or hands-on onboarding. We&apos;ll scope it together.</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>Unlimited projects &amp; prompts (by agreement)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>Dedicated onboarding</span>
              </li>
              <li className="flex gap-2">
                <span className="text-brand-primary">✓</span>
                <span>Custom integrations</span>
              </li>
            </ul>
            <a
              href={`mailto:${SUPPORT_EMAIL_HELLO}?subject=Answrdeck%20Custom%20Plan`}
              className="btn-secondary mt-8 w-full px-4 py-3.5 text-center text-sm font-semibold"
            >
              Contact sales
            </a>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-[#94a3b8]">
          {billingCycleNote(currency)} You can end the plan from Settings; access continues until your paid period ends.
        </p>
      </div>
    </section>
  );
};

export default CTASection;
