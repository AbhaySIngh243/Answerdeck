import React from 'react';

const ProductPreview = () => {
  return (
    <section className="bg-white py-24 md:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-800 tracking-tight mb-6">
          See the rankings the AI sees
        </h2>
        <p className="text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
          Track prompts, competitors, and AI visibility across engines in one clean, unified dashboard.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl border border-slate-200/60 shadow-2xl bg-slate-50/50 p-2 md:p-4 overflow-hidden transform hover:-translate-y-1 transition-transform duration-500">
          
          {/* Dashboard Frame */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
            
            {/* Sidebar Mock */}
            <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-6 hidden md:block text-left">
               <div className="text-lg font-bold text-slate-800 tracking-tight mb-8">
                Rank<span className="text-brand-primary">Lore</span>
               </div>
               <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-brand-primary font-medium bg-brand-accent/30 px-3 py-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    <span>Dashboard</span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-500 font-medium px-3 py-2 hover:bg-slate-100 rounded-lg cursor-pointer">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Prompts</span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-500 font-medium px-3 py-2 hover:bg-slate-100 rounded-lg cursor-pointer">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <span>Competitors</span>
                  </div>
               </div>
            </div>

            {/* Dashboard Content Mock */}
            <div className="flex-1 p-6 md:p-10 text-left bg-white">
               <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Visibility Overview</h3>
                  <div className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50">
                    Last 30 Days v
                  </div>
               </div>

               {/* Metric Cards Mock */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-2">Brand Mentions</p>
                    <div className="flex items-end justify-between">
                       <h4 className="text-3xl font-bold text-slate-800">1,248</h4>
                       <span className="text-emerald-500 text-sm font-semibold mb-1">+12%</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-2">Tracked Prompts</p>
                    <div className="flex items-end justify-between">
                       <h4 className="text-3xl font-bold text-slate-800">430</h4>
                       <span className="text-brand-primary text-sm font-semibold mb-1">+45</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-2">Share of Voice</p>
                    <div className="flex items-end justify-between">
                       <h4 className="text-3xl font-bold text-slate-800">14.2%</h4>
                       <span className="text-rose-500 text-sm font-semibold mb-1">-2.1%</span>
                    </div>
                  </div>
               </div>

               {/* Chart Mock area */}
               <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 h-64 flex flex-col justify-end relative shadow-sm">
                 <p className="text-slate-500 text-sm font-medium absolute top-6 left-6">Visibility by Platform</p>
                 {/* Fake Chart bars */}
                 <div className="flex items-end justify-around space-x-2 h-40 mt-8 opacity-80 pb-2 border-b border-slate-200">
                    <div className="w-1/6 bg-blue-300 rounded-t-sm h-[40%]"></div>
                    <div className="w-1/6 bg-brand-primary rounded-t-sm h-[80%]"></div>
                    <div className="w-1/6 bg-indigo-400 rounded-t-sm h-[60%]"></div>
                    <div className="w-1/6 bg-emerald-400 rounded-t-sm h-[90%]"></div>
                    <div className="w-1/6 bg-purple-400 rounded-t-sm h-[30%]"></div>
                 </div>
                 <div className="flex justify-around text-xs font-semibold text-slate-400 mt-3 pt-2">
                   <span>OpenAI</span>
                   <span>ChatGPT</span>
                   <span>Gemini</span>
                   <span>Perplexity</span>
                   <span>Claude</span>
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
