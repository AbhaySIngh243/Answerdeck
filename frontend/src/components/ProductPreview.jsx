import React from 'react';

const ProductPreview = () => {
  return (
    <section className="section-band overflow-x-clip py-24 md:py-32" id="product">
      <div className="mx-auto mb-16 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="landing-eyebrow">Inside the product</p>
        <h2 className="heading-section mt-2">The workspace you work in every week</h2>
        <div className="accent-heading-rule" />
        <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-[#64748b] sm:text-[17px]">
          Visibility trends, competitor tables, prompt performance, Sources, Opportunities, and Content Studio — the
          same views you use after onboarding, not a marketing mockup.
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
          <img
            src="/dashboard.png"
            alt="Answrdeck project dashboard with visibility trends, competitor rankings, and prompt performance"
            className="block w-full rounded-xl border border-[#e2e8f0]"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
};

export default ProductPreview;
