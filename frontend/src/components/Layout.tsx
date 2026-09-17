import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Clock, Send, Users, Settings, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { apiClient } from '../api/client';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  
  const { data: stats } = useQuery({
    queryKey: ['emailStats'],
    queryFn: async () => {
      const res = await apiClient.get('/api/emails/stats');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const navItems = [
    { to: '/scheduled', icon: <Clock size={18} />, label: 'Scheduled', badge: stats?.scheduled ?? '-' },
    { to: '/sent', icon: <Send size={18} />, label: 'Sent', badge: stats?.sent ?? '-' },
    { to: '/senders', icon: <Users size={18} />, label: 'Senders' },
    { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  // Close sidebar on route change on mobile
  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header inside Sidebar */}
        <div className="px-6 py-5 flex items-center justify-between md:block">
          <img src="/logo.png" alt="ReachInbox Scheduler" className="h-8 object-contain" />
          <button 
            className="md:hidden text-slate-500 hover:text-slate-700" 
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Profile Block */}
        <div className="mx-4 px-3 py-2 bg-slate-50 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold">
                  {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name || 'Anonymous User'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </div>

        {/* Compose Button */}
        <div className="px-4 mt-6 mb-8">
          <Link 
            to="/compose" 
            className="w-full flex justify-center items-center py-2 rounded-full border border-green-500 text-green-600 font-medium hover:bg-green-50 transition-colors"
          >
            Compose
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Core</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive 
                    ? 'bg-green-50 text-slate-900 font-semibold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`
              }
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              {item.badge && (
                <span className="text-xs text-slate-400 font-normal">{item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="text-slate-600 hover:text-slate-900 focus:outline-none" 
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <img src="/logo.png" alt="ReachInbox Scheduler" className="h-8 object-contain" />
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold">
                {user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </header>

        {/* Main Area */}
        <main className="flex-1 overflow-y-auto bg-white p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

