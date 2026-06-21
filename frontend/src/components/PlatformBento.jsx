import React from 'react';
import { BarChart3, Search, Users, Globe, Zap } from 'lucide-react';
import ImagePlaceholder from './ImagePlaceholder';

const featured = {
  icon: BarChart3,
  title: 'Multi-engine visibility dashboard',
  desc: 'One view for ChatGPT, Gemini, Perplexity, and Claude. Track visibility trends, KPIs, and which models mention you versus skip you over time.',
  img: 'visibility-dashboard.webp',
  imgSrc: '/dashboard.png',
  imgLabel: 'Visibility trends across every engine',
};

const cards = [
  {
    icon: Search,
    title: 'Buyer-prompt tracking',
    desc: 'Track the real questions buyers ask in your category and see mention rate and position for each one.',
    img: 'prompt-discovery.webp',
  },
  {
    icon: Users,
    title: 'Competitor analysis',
    desc: 'See which rivals win the answer, where they displace you, and the gaps you can close.',
    img: 'competitor-analysis.webp',
  },
  {
    icon: Globe,
    title: 'Source citations',
    desc: 'Find the domains AI engines trust, how often your site is cited, and where to earn the next mention.',
    img: 'citation-tracker.webp',
  },
  {
    icon: Zap,
    title: 'Content Studio',
    desc: 'Turn measured gaps into editable drafts: articles, blogs, and posts you review before publishing.',
    img: 'content-studio.webp',
  },
];

const PlatformBento = () => {
  return (
    <section className="border-y border-[#e2e8f0]/60 bg-white py-24" id="platform">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-2xl">
          <p className="landing-eyebrow">One workspace</p>
          <h2 className="heading-section mt-2">Measure and improve AI visibility in one place</h2>
          <p className="mt-6 text-base leading-relaxed text-[#64748b] sm:text-[17px]">
            Answrdeck brings every part of your AI search workflow together: understand where you stand, see who beats
            you, and act on the same data without leaving the product.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <article className="glass-card glass-card-hover group flex flex-col overflow-hidden rounded-2xl border border-brand-primary/20 bg-gradient-to-b from-brand-primary/[0.05] to-white p-6 md:col-span-2 lg:row-span-2 lg:p-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <featured.icon className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-bold tracking-tight text-[#0f172a]">{featured.title}</h3>
            </div>
            <p className="mb-6 max-w-xl text-[15px] leading-relaxed text-[#64748b]">{featured.desc}</p>
            <ImagePlaceholder
              name={featured.img}
              src={featured.imgSrc}
              label={featured.imgLabel}
              alt="Answrdeck project dashboard with visibility trends, KPIs, and prompt performance"
              aspect="16 / 9"
              className="mt-auto"
            />
          </article>

          {cards.map((c) => (
            <article
              key={c.title}
              className="glass-card glass-card-hover group flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition-transform duration-300 group-hover:scale-105">
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold tracking-tight text-[#0f172a] transition-colors group-hover:text-brand-primary">
                  {c.title}
                </h3>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-[#64748b]">{c.desc}</p>
              <ImagePlaceholder name={c.img} aspect="16 / 9" className="mt-auto" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlatformBento;
