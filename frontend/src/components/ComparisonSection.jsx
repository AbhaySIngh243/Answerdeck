import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';

const rows = [
  {
    label: 'Multi-engine prompt runs',
    with: 'Run across ChatGPT, Gemini, Perplexity & Claude in one pass',
    without: 'Paste prompts into each assistant, one at a time',
  },
  {
    label: 'Visibility & mention rate',
    with: 'Scored automatically with average position per prompt',
    without: 'Hand-tally which answers mention you',
  },
  {
    label: 'Competitor displacement',
    with: 'See exactly who wins the answer instead of you',
    without: 'Guess which rivals get recommended',
  },
  {
    label: 'Source & citation tracking',
    with: 'Cited domains mapped to your visibility gaps',
    without: 'Hours of manual research across answers',
  },
  {
    label: 'Prioritized recommendations',
    with: 'Ranked next actions backed by real engine quotes',
    without: 'Generic SEO advice with no evidence',
  },
  {
    label: 'Content drafts from gaps',
    with: 'Editable drafts generated from your run data',
    without: 'Start every piece from a blank page',
  },
  {
    label: 'Shareable reports',
    with: 'Export to PDF or CSV in seconds',
    without: 'Rebuild slides by hand each week',
  },
];

const ComparisonSection = () => {
  return (
    <section className="border-y border-[#e2e8f0]/60 bg-white py-24" id="why-answrdeck">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="landing-eyebrow">Why Answrdeck</p>
          <h2 className="heading-section mt-2">Stop tracking AI visibility the hard way</h2>
          <div className="accent-heading-rule" />
          <p className="mx-auto mt-6 max-w-[600px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Manual AI search monitoring eats hours every week and still leaves gaps. Answrdeck does the measurement and
            hands you the next move.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] shadow-sm">
          <div className="grid grid-cols-3 border-b border-[#e2e8f0] bg-slate-50/80">
            <div className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8] sm:px-6" />
            <div className="border-x border-[#e2e8f0] bg-brand-primary/[0.06] px-4 py-4 text-center text-sm font-bold text-brand-primary sm:px-6">
              With Answrdeck
            </div>
            <div className="px-4 py-4 text-center text-sm font-bold text-[#64748b] sm:px-6">
              Without Answrdeck
            </div>
          </div>

          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-3 ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
            >
              <div className="flex items-center px-4 py-4 text-[13px] font-semibold text-[#0f172a] sm:px-6 sm:text-sm">
                {r.label}
              </div>
              <div className="flex items-start gap-2 border-x border-[#e2e8f0] bg-brand-primary/[0.04] px-4 py-4 sm:px-6">
                <Check className="mt-0.5 h-4 w-4 flex-none text-brand-primary" strokeWidth={3} />
                <span className="text-[13px] leading-snug text-[#334155]">{r.with}</span>
              </div>
              <div className="flex items-start gap-2 px-4 py-4 sm:px-6">
                <X className="mt-0.5 h-4 w-4 flex-none text-[#cbd5e1]" strokeWidth={3} />
                <span className="text-[13px] leading-snug text-[#94a3b8]">{r.without}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link to="/signup" className="btn-primary px-7 py-3.5 text-sm">
            Start free, no card required
          </Link>
          <a href="#product" className="btn-secondary px-7 py-3.5 text-sm">
            See the workspace
          </a>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
