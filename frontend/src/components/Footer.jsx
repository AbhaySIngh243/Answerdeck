import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features', external: false },
  { label: 'Pricing', href: '/#pricing', external: false },
  { label: 'How it works', href: '/#how-it-works', external: false },
];

const COMPANY_LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
];

const Footer = () => {
  return (
    <footer className="relative border-t border-[#e2e8f0] bg-white/95 py-12 backdrop-blur-md md:py-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/25 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-1 gap-8 md:mb-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-4">
              <Link to="/" aria-label="Answrdeck home">
                <BrandLogo variant="lockup" size="md" />
              </Link>
            </div>
            <p className="max-w-xs text-[13px] leading-relaxed text-[#64748b]">
              Stop guessing. Start appearing. Answrdeck helps brands understand and optimize how AI
              recommends products.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f172a]">
              Product
            </h3>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-[13px] text-[#64748b] transition-colors hover:text-brand-primary"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f172a]">
              Company
            </h3>
            <ul className="space-y-3">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-[13px] text-[#64748b] transition-colors hover:text-brand-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-[#e2e8f0] pt-8 md:flex-row">
          <p className="text-xs text-[#64748b]">
            &copy; {new Date().getFullYear()} Answrdeck. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#64748b]">
            <Link to="/terms" className="transition-colors hover:text-brand-primary">
              Terms
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-brand-primary">
              Privacy
            </Link>
            <a
              href="mailto:hello@answerdeck.com"
              className="transition-colors hover:text-brand-primary"
            >
              hello@answerdeck.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
