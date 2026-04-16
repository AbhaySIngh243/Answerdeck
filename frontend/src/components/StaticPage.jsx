import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrandLogo from './BrandLogo';
import Footer from './Footer';

export default function StaticPage({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Home">
            <BrandLogo variant="lockup" size="xs" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
          Answerdeck
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-500">{subtitle}</p>
        ) : null}
        <div className="prose-answerdeck mt-10 space-y-6 text-[15px] leading-relaxed text-slate-700">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
