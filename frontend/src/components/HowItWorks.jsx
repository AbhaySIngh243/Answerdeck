import React from 'react';

const HowItWorks = () => {
  const steps = [
    {
      step: '01',
      title: 'Track prompts',
      desc: 'Monitor the questions customers ask AI assistants about your category.'
    },
    {
      step: '02',
      title: 'Analyze AI answers',
      desc: 'RankLore captures responses from multiple AI engines and detects which brands appear.'
    },
    {
      step: '03',
      title: 'Understand visibility',
      desc: 'See where your brand ranks and where competitors dominate.'
    }
  ];

  return (
    <section className="py-24 bg-white" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-800 tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            Three simple steps to measure and optimize your brand's AI presence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-slate-100 z-0"></div>

          {steps.map((item, index) => (
            <div key={index} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative z-10 hover:shadow-md transition-shadow">
               <div className="w-16 h-16 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary font-bold text-2xl mb-6 shadow-sm">
                  {item.step}
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-3">{item.title}</h3>
               <p className="text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
