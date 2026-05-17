'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, FileText, Users, Settings, ChevronLeft,
  Zap, Calendar, BarChart3, Bell, Search, Command, Plus,
  ChevronDown, LogOut, HelpCircle, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Orders', href: '/admin/orders', icon: FileText, badge: 67 },
  { name: 'Advisors', href: '/admin/advisors', icon: Users },
  { name: 'Calendar', href: '/admin/calendar', icon: Calendar },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-full bg-[#09090b] border-r border-zinc-800/50 transition-all duration-300 z-50 flex flex-col',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-zinc-800/50">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-[15px] tracking-tight">
                SeminarFlow
              </span>
            )}
          </Link>
        </div>

        {/* Quick Actions */}
        {!collapsed && (
          <div className="p-3">
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-400 transition-all">
              <Plus className="w-4 h-4" />
              <span>New Order</span>
              <kbd className="ml-auto text-[10px] bg-zinc-700/50 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <div className={cn("text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2", collapsed ? "text-center" : "px-3")}>
            {collapsed ? "•" : "Menu"}
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px] font-medium group relative',
                  isActive 
                    ? 'bg-zinc-800 text-white' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-full" />
                )}
                <item.icon className={cn(
                  'w-4 h-4 flex-shrink-0',
                  isActive ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-400'
                )} />
                {!collapsed && (
                  <>
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-zinc-800/50 space-y-0.5">
          <Link
            href="/admin/settings"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
          >
            <Settings className="w-4 h-4 text-zinc-500" />
            {!collapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 transition"
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={cn(
        'flex-1 transition-all duration-300 min-h-screen',
        collapsed ? 'ml-[68px]' : 'ml-[240px]'
      )}>
        {/* Top Bar */}
        <header className="h-14 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "relative transition-all",
              searchFocused ? "w-96" : "w-72"
            )}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search orders, advisors..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-12 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">⌘F</kbd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 hover:bg-zinc-800/50 rounded-lg transition group">
              <Bell className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-2 ring-[#09090b]" />
            </button>
            <button className="p-2 hover:bg-zinc-800/50 rounded-lg transition group">
              <HelpCircle className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400" />
            </button>
            <div className="w-px h-6 bg-zinc-800 mx-1" />
            <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-zinc-800/50 rounded-lg transition">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-[10px] font-bold text-white">
                PM
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
