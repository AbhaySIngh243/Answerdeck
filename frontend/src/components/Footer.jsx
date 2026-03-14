import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 md:mb-12">
          
          {/* Branding & Tagline */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
               <span className="text-xl font-bold tracking-tight text-slate-800">
                Rank<span className="text-brand-primary">Lore</span>
              </span>
            </div>
            <p className="text-slate-500 text-sm max-w-xs">
              RankLore helps brands understand how AI recommends products.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Product</h3>
            <ul className="space-y-3">
              <li><a href="#features" className="text-slate-500 hover:text-brand-primary transition-colors text-sm">Features</a></li>
              <li><a href="#pricing" className="text-slate-500 hover:text-brand-primary transition-colors text-sm">Pricing</a></li>
              <li><a href="#docs" className="text-slate-500 hover:text-brand-primary transition-colors text-sm">Docs</a></li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Company</h3>
            <ul className="space-y-3">
              <li><a href="#about" className="text-slate-500 hover:text-brand-primary transition-colors text-sm">About</a></li>
              <li><a href="#contact" className="text-slate-500 hover:text-brand-primary transition-colors text-sm">Contact</a></li>
            </ul>
          </div>

        </div>
        
        <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} RankLore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
