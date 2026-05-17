'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Search, Users, Mail, Phone, Building2, ChevronRight,
  Plus, Download, MoreHorizontal, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Advisor {
  id: string;
  advisor_name: string;
  group_name: string;
  business_name?: string;
  main_contact_email?: string;
  main_contact_phone?: string;
  orderCount?: number;
  activeOrderCount?: number;
  totalMailQuantity?: number;
}

export default function AdvisorsPage() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    loadAdvisors();
  }, []);

  const loadAdvisors = async () => {
    try {
      const res = await fetch('/api/admin/advisors');
      const data = await res.json();
      setAdvisors(data.advisors || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdvisors = advisors.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.advisor_name?.toLowerCase().includes(q) ||
           a.group_name?.toLowerCase().includes(q) ||
           a.business_name?.toLowerCase().includes(q);
  });

  // Group by group_name
  const groupedAdvisors = filteredAdvisors.reduce((acc, advisor) => {
    const group = advisor.group_name || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(advisor);
    return acc;
  }, {} as Record<string, Advisor[]>);

  const sortedGroups = Object.keys(groupedAdvisors).sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Advisors</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{advisors.length} advisors across {sortedGroups.length} groups</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg transition">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-3.5 h-3.5" />
            Add Advisor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search advisors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg transition">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : sortedGroups.length === 0 ? (
        <div className="text-center py-16 text-sm text-zinc-500">No advisors found</div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((group) => (
            <div key={group} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              {/* Group Header */}
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-200">{group}</span>
                  <span className="text-[10px] bg-zinc-700/50 text-zinc-400 px-1.5 py-0.5 rounded-full">
                    {groupedAdvisors[group].length}
                  </span>
                </div>
                <button className="p-1 hover:bg-zinc-800 rounded transition">
                  <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              {/* Advisors */}
              <div className="divide-y divide-zinc-800/50">
                {groupedAdvisors[group].map((advisor) => (
                  <Link
                    key={advisor.id}
                    href={`/admin/advisors/${advisor.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-emerald-400">
                          {advisor.advisor_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{advisor.advisor_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {advisor.main_contact_email && (
                            <span className="flex items-center gap-1 text-xs text-zinc-500">
                              <Mail className="w-3 h-3" />
                              {advisor.main_contact_email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {advisor.activeOrderCount !== undefined && advisor.activeOrderCount > 0 && (
                        <span className="text-[10px] font-medium bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-full">
                          {advisor.activeOrderCount} active
                        </span>
                      )}
                      {advisor.orderCount !== undefined && (
                        <span className="text-xs text-zinc-500">
                          {advisor.orderCount} total
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
