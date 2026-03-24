import React from 'react';
import { Link } from 'react-router-dom';
import PlatformRow from './PlatformRow';

const IMG = {
  chatgpt: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/ChatGPT-Logo.svg',
  gemini: 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Google_Gemini_icon_2025.svg',
  claude: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg',
  perplexity: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Perplexity_AI_Turquoise_on_White.png',
};

function HeroIllustration() {
  return (
    <div className="radar-wrapper relative hidden items-center justify-center md:flex md:scale-90 md:py-4 lg:scale-100 lg:py-0">
      <div className="radar-scene" aria-hidden>
        <div className="radar-glow" />

        <div className="circle circle-1" />
        <div className="circle circle-2" />
        <div className="circle circle-3" />
        <div className="circle circle-4" />

        <div className="sweep-container">
          <div className="sweep-wedge" />
          <div className="sweep-line" />
        </div>

        <div className="center-dot" />
        <div className="brand-center">
          <div className="brand-pill">YOUR BRAND</div>
        </div>

        <div className="icon-node ping" style={{ top: '18%', left: '22%' }}>
          <img src={IMG.chatgpt} alt="ChatGPT" />
        </div>
        <div className="icon-node ping ping-2" style={{ top: '20%', left: '72%' }}>
          <img src={IMG.gemini} alt="Gemini" />
        </div>
        <div className="icon-node ping ping-3" style={{ top: '75%', left: '75%' }}>
          <img src={IMG.perplexity} alt="Perplexity" />
        </div>
        <div className="icon-node ping ping-4" style={{ top: '78%', left: '25%' }}>
          <img src={IMG.claude} alt="Claude" />
        </div>

        <div className="orbit-dot" style={{ marginTop: '-110px', marginLeft: '20px' }} />
        <div className="orbit-dot" style={{ marginTop: '50px', marginLeft: '105px' }} />
        <div className="orbit-dot" style={{ marginTop: '-60px', marginLeft: '-100px' }} />
        <div className="orbit-dot" style={{ marginTop: '80px', marginLeft: '-55px' }} />
      </div>
    </div>
  );
}

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden hero-gradient pb-20 pt-12 md:pb-28 md:pt-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e2e8f0] to-transparent opacity-80" aria-hidden />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="z-10">
          <p className="mb-4 inline-flex items-center rounded-full border border-brand-primary/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary shadow-sm backdrop-blur-sm">
            AI visibility platform
          </p>
          <h1 className="text-[clamp(1.85rem,4.2vw+0.75rem,3.35rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#0f172a]">
            Track where your brand appears in AI search.{' '}
            <span className="text-brand-primary">Fix where it doesn&apos;t.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#334155] sm:mt-6 sm:text-lg md:text-xl">
            Most tools show you a score and call it a day. Answrdeck monitors your brand across ChatGPT, Gemini,
            Perplexity, and Claude, then gives you a clear playbook to start showing up where it matters.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <Link to="/signup" className="btn-primary text-center sm:w-auto">
              Start for free →
            </Link>
            <a href="#pricing" className="btn-secondary text-center sm:w-auto">
              Talk to founder →
            </a>
          </div>
          <p className="mt-4 text-sm font-medium text-[#64748b]">7-day free trial. Cancel anytime.</p>
        </div>

        <HeroIllustration />
      </div>
      <PlatformRow />
    </section>
  );
};

export default HeroSection;
