import React from 'react';
import BrandLogo from './BrandLogo';

const ProductPreview = () => {
  return (
    <section className="section-band overflow-x-clip py-24 md:py-32" id="product">
      <div className="mx-auto mb-16 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="landing-eyebrow">Product preview</p>
        <h2 className="heading-section mt-2">See the rankings the AI sees</h2>
        <div className="accent-heading-rule" />
        <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
          Track prompts, competitors, and AI visibility across engines in one unified dashboard.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className="glass-card glass-card-hover relative overflow-hidden rounded-2xl border border-[#e2e8f0] p-2 shadow-lg shadow-slate-900/5 ring-1 ring-black/[0.03] md:p-4"
          style={{
            transform: 'perspective(1000px) rotateX(5deg)',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
            transition: 'transform 500ms ease',
            willChange: 'transform',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'perspective(1000px) rotateX(2deg) translateY(-6px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'perspective(1000px) rotateX(5deg)';
          }}
        >
          <div className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc] md:flex-row">
            <div className="hidden w-56 flex-none border-r border-[#e2e8f0] bg-white p-5 text-left md:block">
              <div className="mb-8">
                <BrandLogo variant="lockup" size="sm" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-medium text-brand-primary">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </div>
                {['Prompts', 'Competitors', 'Reports'].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#64748b] transition-colors hover:text-[#0f172a]"
                  >
                    <span className="h-4 w-4" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 p-6 text-left md:p-10">
              <div className="mb-8 flex flex-col justify-between gap-4 border-b border-[#e2e8f0] pb-4 sm:flex-row sm:items-center">
                <h3 className="text-xl font-bold tracking-tight text-[#0f172a]">Visibility Overview</h3>
                <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs text-[#64748b]">Last 30 Days ↓</div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { label: 'Brand Mentions', val: 'Live', color: 'text-emerald-600' },
                  { label: 'Tracked Prompts', val: 'Live', color: 'text-brand-primary' },
                  { label: 'Share of Voice', val: 'Live', color: 'text-red-600' },
                ].map((m) => (
                  <div key={m.label} className="glass-card glass-card-hover rounded-xl border border-[#e2e8f0] bg-white p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">{m.label}</p>
                    <div className="flex items-end justify-between">
                      <h4 className={`text-2xl font-bold ${m.color}`}>{m.val}</h4>
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass-card glass-card-hover relative flex h-56 flex-col justify-end rounded-xl border border-[#e2e8f0] bg-white p-6">
                <p className="absolute left-6 top-5 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                  Visibility by Platform
                </p>
                <div className="mt-6 flex h-32 items-end justify-around gap-2 border-b border-[#e2e8f0] pb-2">
                  <div className="h-[40%] w-1/6 rounded-t-md bg-slate-300" style={{ borderRadius: '6px 6px 0 0' }} />
                  <div className="h-[80%] w-1/6 rounded-t-md bg-brand-primary" style={{ borderRadius: '6px 6px 0 0' }} />
                  <div className="h-[60%] w-1/6 rounded-t-md bg-slate-300" style={{ borderRadius: '6px 6px 0 0' }} />
                  <div className="h-[90%] w-1/6 rounded-t-md bg-slate-400" style={{ borderRadius: '6px 6px 0 0' }} />
                  <div className="h-[30%] w-1/6 rounded-t-md bg-slate-300" style={{ borderRadius: '6px 6px 0 0' }} />
                </div>
                <div className="mt-2 flex justify-around text-[10px] text-[#64748b]">
                  {['OpenAI', 'ChatGPT', 'Gemini', 'Perplexity', 'Claude'].map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductPreview;
