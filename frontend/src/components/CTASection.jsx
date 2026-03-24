import React from 'react';
import { Link } from 'react-router-dom';

const CTASection = () => {
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

      <div id="book-demo" className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="landing-eyebrow">Pricing &amp; trial</p>
        <h2 className="heading-section mt-2">Your competitors are already optimizing for AI search.</h2>
        <div className="accent-heading-rule" />
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-[17px]">
          Every day you wait, they lock in another recommendation slot. Start tracking your AI visibility now — it takes 30 seconds.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/signup" className="btn-primary px-7 py-3.5 text-sm">
            Start free — no card required
          </Link>
          <a href="#how-it-works" className="btn-secondary px-7 py-3.5 text-sm">
            See how it works →
          </a>
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href="mailto:demo@answrdeck.com?subject=Answrdeck%20Demo%20Request"
            className="inline-flex items-center justify-center rounded-full border border-[#e2e8f0] bg-white px-10 py-4 text-[15px] font-semibold text-[#0f172a] shadow-sm transition-all hover:border-brand-primary/30 hover:shadow-md"
          >
            Book a free 30-min call
          </a>
        </div>

        <p className="mt-5 text-xs text-[#64748b]">Free plan includes 3 projects · 10 prompts per project</p>
      </div>
    </section>
  );
};

export default CTASection;
