import React from 'react';
import { Link } from 'react-router-dom';
import PlatformRow from './PlatformRow';

const HeroSection = () => {
  return (
    <section className="bg-white pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-brand-accent/30 text-brand-primary text-sm font-semibold mb-8 border border-brand-accent">
          <span>Introducing RankLore Analytics →</span>
        </div>

        {/* Headline & Subtext */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-800 mb-8 max-w-4xl mx-auto leading-tight">
          See when AI recommends your <span className="text-brand-primary">competitors</span> instead of you
        </h1>
        
        <p className="text-xl text-slate-500 mb-10 max-w-3xl mx-auto leading-relaxed">
          Consumers ask ChatGPT, Gemini, and Perplexity what to buy. RankLore shows whether your brand appears in those answers and how you compare.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-20 animate-fade-in-up">
          <Link to="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-center">
            Start tracking AI visibility
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-lg font-semibold transition-all">
            See how it works
          </a>
        </div>

        {/* Mock AI Interface Visual */}
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-accent/20 to-transparent -z-10 blur-3xl rounded-full transform -translate-y-20"></div>
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-200 text-left relative overflow-hidden">
            {/* Top row "Prompt" */}
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
              <div className="flex-1 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-slate-700 font-medium">"Best TVs under ₹50k"</p>
              </div>
            </div>

            {/* AI Response Card */}
            <div className="pl-14">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 rounded bg-brand-primary flex items-center justify-center text-white font-bold text-xs">AI</div>
                <span className="text-sm font-semibold text-slate-800">Assistant Response</span>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Recommended Brands</h4>
                <div className="space-y-3 mb-6">
                  {['Brand 1', 'Brand 2', 'Brand 3'].map((brand) => (
                    <div key={brand} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <span className="font-semibold text-emerald-800">{brand}</span>
                      <span className="text-emerald-600 text-xs px-2 py-1 bg-emerald-100 rounded-full">Mentioned</span>
                    </div>
                  ))}
                </div>
                
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">Your Brand</h4>
                <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-100">
                  <span className="font-semibold text-rose-800">Your Brand</span>
                  <span className="text-rose-600 text-xs px-2 py-1 bg-rose-100 rounded-full">Not mentioned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PlatformRow />
    </section>
  );
};

export default HeroSection;
