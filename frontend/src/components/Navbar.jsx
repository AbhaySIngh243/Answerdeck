import React from 'react';
import { Link } from 'react-router-dom';
const Navbar = () => {
  return (
    <nav className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center cursor-pointer">
            <span className="text-xl font-bold tracking-tight text-slate-800">
              Rank<span className="text-brand-primary">Lore</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">Features</a>
            <a href="#how-it-works" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">How it works</a>
            <a href="#pricing" className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">Pricing</a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="hidden md:block text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
              Log in
            </Link>
            <Link to="/dashboard" className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
