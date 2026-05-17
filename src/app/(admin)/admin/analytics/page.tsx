'use client';

import { useEffect, useState } from 'react';
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart,
  Calendar, Mail, Zap, Users, FileText, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  totalOrders: number;
  activeOrders: number;
  pastOrCompleted: number;
  urgentOrders: number;
  totalAdvisors: number;
  digitalJobs: number;
  directMailJobs: number;
  byStatus: {
    completed: number;
    ready: number;
    pending: number;
    not_started: number;
  };
}

interface Order {
  id: string;
  order_number: number;
  advisor: string;
  group_name: string;
  first_event_date: string | null;
  mailing_quantity: number;
  status: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/orders?includePast=true&includeCompleted=true'),
      ]);
      setStats(await statsRes.json());
      const data = await ordersRes.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const totalMailVolume = orders.reduce((sum, o) => sum + (o.mailing_quantity || 0), 0);
  
  // Orders by month
  const ordersByMonth = orders.reduce((acc, o) => {
    if (o.first_event_date) {
      const month = new Date(o.first_event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      acc[month] = (acc[month] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Orders by group
  const ordersByGroup = orders.reduce((acc, o) => {
    const group = o.group_name || 'Other';
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedGroups = Object.entries(ordersByGroup)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Status distribution
  const statusData = stats?.byStatus || { completed: 0, ready: 0, pending: 0, not_started: 0 };
  const totalStatusCount = Object.values(statusData).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-white/40 mt-1">Performance metrics and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Orders"
          value={stats?.totalOrders || 0}
          icon={FileText}
          color="violet"
        />
        <MetricCard
          label="Total Advisors"
          value={stats?.totalAdvisors || 0}
          icon={Users}
          color="emerald"
        />
        <MetricCard
          label="Mail Volume"
          value={totalMailVolume.toLocaleString()}
          icon={Mail}
          color="blue"
        />
        <MetricCard
          label="Digital Jobs"
          value={stats?.digitalJobs || 0}
          icon={Zap}
          color="amber"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-violet-400" />
              Order Status Distribution
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <StatusBar 
                label="Completed" 
                count={statusData.completed} 
                total={totalStatusCount} 
                color="emerald"
              />
              <StatusBar 
                label="Ready" 
                count={statusData.ready} 
                total={totalStatusCount} 
                color="blue"
              />
              <StatusBar 
                label="Pending" 
                count={statusData.pending} 
                total={totalStatusCount} 
                color="amber"
              />
              <StatusBar 
                label="Not Started" 
                count={statusData.not_started} 
                total={totalStatusCount} 
                color="slate"
              />
            </div>
          </div>
        </div>

        {/* Top Groups */}
        <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400" />
              Top Groups by Orders
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {sortedGroups.map(([group, count], i) => (
                <div key={group} className="flex items-center gap-4">
                  <span className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                    i === 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white' :
                    i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white' :
                    i === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' :
                    'bg-white/5 text-white/60'
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{group}</span>
                      <span className="text-white/60 text-sm">{count} orders</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                        style={{ width: `${(count / (sortedGroups[0]?.[1] || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-400" />
            Events by Month
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-end gap-2 h-48">
            {Object.entries(ordersByMonth)
              .slice(-12)
              .map(([month, count]) => {
                const maxCount = Math.max(...Object.values(ordersByMonth));
                const height = (count / maxCount) * 100;
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-gradient-to-t from-violet-500 to-fuchsia-500 rounded-t-lg min-h-[4px] transition-all hover:opacity-80"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-center">
                      <p className="text-xs text-white/40">{month}</p>
                      <p className="text-xs font-bold text-white/60">{count}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStat 
          label="Active Now" 
          value={stats?.activeOrders || 0} 
          subtext="upcoming events"
        />
        <QuickStat 
          label="Urgent" 
          value={stats?.urgentOrders || 0} 
          subtext="within 14 days"
          highlight
        />
        <QuickStat 
          label="Completed" 
          value={stats?.pastOrCompleted || 0} 
          subtext="past events"
        />
        <QuickStat 
          label="Avg. Mail Qty" 
          value={Math.round(totalMailVolume / (orders.length || 1)).toLocaleString()} 
          subtext="per order"
        />
      </div>
    </div>
  );
}

function MetricCard({ 
  label, value, icon: Icon, color 
}: { 
  label: string; 
  value: number | string; 
  icon: any; 
  color: 'violet' | 'emerald' | 'amber' | 'blue';
}) {
  const colors = {
    violet: 'from-violet-500 to-fuchsia-500',
    emerald: 'from-emerald-500 to-cyan-500',
    amber: 'from-amber-500 to-orange-500',
    blue: 'from-blue-500 to-indigo-500',
  };
  
  return (
    <div className="bg-[#1a1a24] rounded-2xl p-5 border border-white/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-sm">{label}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
        </div>
        <div className={cn(
          'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center',
          colors[color]
        )}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusBar({ 
  label, count, total, color 
}: { 
  label: string; 
  count: number; 
  total: number; 
  color: 'emerald' | 'blue' | 'amber' | 'slate';
}) {
  const colors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-500',
  };
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/80 text-sm">{label}</span>
        <span className="text-white/60 text-sm">{count} ({percentage}%)</span>
      </div>
      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all', colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function QuickStat({ 
  label, value, subtext, highlight 
}: { 
  label: string; 
  value: number | string; 
  subtext: string; 
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-2xl p-5 border',
      highlight 
        ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20'
        : 'bg-[#1a1a24] border-white/5'
    )}>
      <p className="text-white/50 text-sm">{label}</p>
      <p className={cn(
        'text-2xl font-bold mt-1',
        highlight ? 'text-amber-400' : 'text-white'
      )}>
        {value}
      </p>
      <p className="text-white/30 text-xs mt-1">{subtext}</p>
    </div>
  );
}
