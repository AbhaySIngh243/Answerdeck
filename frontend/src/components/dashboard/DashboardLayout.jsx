import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, BarChart3, Settings } from 'lucide-react';

const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-68 bg-white border-r border-slate-200/60 shadow-xl flex flex-col z-20">
        <div className="h-20 flex items-center px-8 border-b border-slate-100">
          <NavLink to="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.02]">
            <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/30 group-hover:rotate-6 transition-transform">
              <div className="w-4 h-4 bg-white rounded-full shadow-inner"></div>
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Ranklore</span>
          </NavLink>
        </div>
        
        <nav className="p-6 space-y-2 flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 ml-3">Main Navigation</p>
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand-primary'
              }`
            }
          >
            <FolderKanban className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Projects</span>
          </NavLink>
          
          <NavLink
            to="/dashboard/reports"
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-brand-primary'
              }`
            }
          >
            <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Reports</span>
          </NavLink>

          <div className="pt-6 mt-6 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 ml-3">Account</p>
            <NavLink
              to="/dashboard/settings"
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-brand-primary'
                }`
              }
            >
              <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
              <span>Settings</span>
            </NavLink>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#FBFDFF]">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-10 shadow-sm">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.2em]">Dashboard / Active Project</h2>
          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
               <span className="text-xs font-bold text-slate-900">John Doe</span>
               <span className="text-[10px] font-bold text-slate-400">Enterprise Plan</span>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-sm font-black text-white shadow-lg shadow-brand-primary/20 ring-4 ring-slate-50 transition-transform hover:scale-110 cursor-pointer">
                U
             </div>
          </div>
        </header>
        <div className="p-10 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
