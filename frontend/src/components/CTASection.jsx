import React from 'react';
import { Link } from 'react-router-dom';

const CTASection = () => {
  return (
    <section className="bg-brand-accent py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-6">
          Time to learn the lore
        </h2>
        <p className="text-xl text-slate-700 max-w-2xl mx-auto mb-10 leading-relaxed">
          Understand how AI assistants recommend brands and where you stand. Start growing your AI-driven visibility today.
        </p>
        <Link to="/dashboard" className="inline-block px-8 py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
          Start tracking AI visibility
        </Link>
      </div>
    </section>
  );
};

export default CTASection;
