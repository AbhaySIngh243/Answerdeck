import React from 'react';

const ProblemSection = () => {
  return (
    <section className="bg-slate-50 py-24 border-b border-slate-200" id="problem">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-800 mb-8 tracking-tight">
          AI assistants are the new discovery layer
        </h2>
        
        <p className="text-lg md:text-xl text-slate-500 mb-12 leading-relaxed">
          People now ask AI assistants what to buy instead of searching through pages of results.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 text-left">
          {[
            "Best TVs under ₹50k",
            "Best CRM for startups",
            "Best productivity apps"
          ].map((query, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <div className="flex items-center space-x-3 mb-2 opacity-50">
                 <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <span className="text-sm font-medium">User Prompt</span>
               </div>
               <p className="text-slate-800 font-semibold">"{query}"</p>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto space-y-6 text-lg text-slate-600 leading-relaxed text-left md:text-center border-l-4 md:border-l-0 md:border-t-4 border-brand-primary pl-6 pt-0 md:pl-0 md:pt-8">
          <p>
            AI systems generate recommendations instantly. <strong>If your brand does not appear in those answers, you are invisible in that conversation.</strong>
          </p>
          <p>
            RankLore helps you understand when you appear, when you do not, and which competitors the AI recommends instead.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
