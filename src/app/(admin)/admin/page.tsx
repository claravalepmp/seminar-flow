'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, FileText, AlertTriangle, CheckCircle2, Clock,
  Mail, Calendar, MapPin, Copy, Check, Search, Filter, RefreshCw,
  ChevronDown, X, ExternalLink, Phone, Heart, Zap, XCircle,
  ArrowUpRight, Building2, Users, TrendingUp, Monitor, Loader2,
  ChevronRight, Send, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Order {
  id: string;
  orderNumber: number;
  status: string;
  statusCategory: string;
  advisor: string;
  groupName: string;
  officeLocation: string;
  market: string;
  firstEventDate: string | null;
  secondEventDate: string | null;
  thirdEventDate: string | null;
  fourthEventDate: string | null;
  venueName: string;
  venueAddress: string;
  firstEventRoom: string;
  startTime: string;
  endTime: string;
  charity: string;
  classType: string;
  mailingQuantity: number;
  mailerType: string;
  mailerReturnAddress: string;
  landingPageUrl: string;
  registrationPhone: string;
  clientApprovalDeadline: string | null;
  orderSentDeadline: string | null;
  needsDirectMail: boolean;
  needsDigital: boolean;
  digitalBudget: number;
  daysUntilEvent: number | null;
  daysUntilDeadline: number | null;
  isPast: boolean;
  isUrgent: boolean;
  notes: string;
}

interface Stats {
  totalOrders: number;
  activeOrders: number;
  pastOrders: number;
  urgentOrders: number;
  totalMailPieces: number;
  byStatus: Record<string, number>;
  byGroup: { name: string; active: number; past: number; urgent: number; totalMail: number }[];
  groups: string[];
}

// Status config - maps DM job status to display
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  'Not Started': { label: 'Needs Setup', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: AlertTriangle },
  'Pending Details': { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Clock },
  'All Details Added': { label: 'Ready', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  'Order Completed': { label: 'Mailed', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: CheckCircle2 },
  'Order Canceled': { label: 'Canceled', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', icon: XCircle },
  'Issues': { label: 'Issues', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: AlertTriangle },
};

// Copyable Order Card with exact format
function OrderCard({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG['Not Started'];
  const StatusIcon = config.icon;
  
  // Build event dates array
  const eventDates = [
    order.firstEventDate,
    order.secondEventDate,
    order.thirdEventDate,
    order.fourthEventDate,
  ].filter(Boolean);
  
  // Build time string
  const timeStr = order.startTime && order.endTime 
    ? `${order.startTime} – ${order.endTime}`
    : order.startTime || order.endTime || '';
  
  // Build copyable text in EXACT format requested:
  // {advisor} / #{order_number}
  // {event_dates}
  // {venue}
  // {address}
  // {time}
  // {charity}
  // {landing_page}
  // {phone}
  // {return_address}
  const copyLines = [
    `${order.advisor} / #${order.orderNumber}`,
    ...eventDates,
    order.venueName,
    order.venueAddress,
    timeStr,
    order.charity,
    order.landingPageUrl,
    order.registrationPhone,
    order.mailerReturnAddress,
  ].filter(line => line?.trim());
  
  const copyText = copyLines.join('\n');
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPastOrComplete = order.isPast || order.status === 'Order Completed';

  return (
    <div className={cn(
      "bg-[#12121a] rounded-2xl border overflow-hidden transition-all duration-300 group hover:shadow-xl",
      order.isUrgent ? "border-rose-500/50 ring-2 ring-rose-500/20 shadow-rose-500/10" : 
      order.status === 'All Details Added' ? "border-emerald-500/30 hover:border-emerald-500/50" :
      "border-zinc-800/60 hover:border-zinc-700"
    )}>
      {/* Urgency Banner */}
      {order.isUrgent && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 px-4 py-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-white animate-pulse" />
          <span className="text-white text-sm font-bold uppercase tracking-wider">
            {order.daysUntilEvent === 0 ? '🔥 TODAY!' : 
             order.daysUntilEvent === 1 ? '⚡ Tomorrow' : 
             `⏰ ${order.daysUntilEvent} days left`}
          </span>
        </div>
      )}
      
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 transition-all",
              isPastOrComplete
                ? "bg-zinc-800 text-zinc-500"
                : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
            )}>
              #{order.orderNumber}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-lg truncate">{order.advisor}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-zinc-500 truncate">{order.groupName || 'Unassigned'}</span>
                {order.officeLocation && (
                  <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    {order.officeLocation}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 border",
            config.bg, config.color, config.border
          )}>
            <StatusIcon className="w-3.5 h-3.5" />
            {config.label}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-5 pb-4 space-y-3">
        {/* Jobs Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {order.needsDirectMail && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-medium border border-amber-500/20">
              <Mail className="w-3.5 h-3.5" />
              DM {order.mailingQuantity > 0 && `• ${(order.mailingQuantity / 1000).toFixed(0)}k`}
            </span>
          )}
          {order.needsDigital && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/20">
              <Monitor className="w-3.5 h-3.5" />
              Digital
            </span>
          )}
          {order.classType && (
            <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 rounded-lg text-xs font-medium border border-violet-500/20">
              {order.classType}
            </span>
          )}
        </div>
        
        {/* Event Dates */}
        {eventDates.length > 0 && (
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-indigo-400 mt-1 shrink-0" />
            <div className="space-y-0.5">
              {eventDates.map((date, i) => (
                <p key={i} className={cn(
                  "text-sm",
                  i === 0 ? "text-white font-medium" : "text-zinc-400"
                )}>{date}</p>
              ))}
            </div>
          </div>
        )}
        
        {/* Venue */}
        {order.venueName && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-rose-400 mt-1 shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">{order.venueName}</p>
              {order.venueAddress && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{order.venueAddress}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Time */}
        {timeStr && (
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-zinc-300">{timeStr}</p>
          </div>
        )}
        
        {/* Charity */}
        {order.charity && (
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-pink-400 shrink-0" />
            <p className="text-sm text-zinc-400">{order.charity}</p>
          </div>
        )}
        
        {/* Return Address */}
        {order.mailerReturnAddress && (
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-zinc-400 whitespace-pre-line">{order.mailerReturnAddress}</p>
          </div>
        )}
        
        {/* Landing Page & Phone */}
        {(order.landingPageUrl || order.registrationPhone) && (
          <div className="flex items-center gap-4 flex-wrap">
            {order.landingPageUrl && (
              <a
                href={order.landingPageUrl.startsWith('http') ? order.landingPageUrl : `https://${order.landingPageUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Landing Page
              </a>
            )}
            {order.registrationPhone && (
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {order.registrationPhone}
              </span>
            )}
          </div>
        )}
        
        {/* Deadlines */}
        {(order.clientApprovalDeadline || order.orderSentDeadline) && (
          <div className="pt-3 border-t border-zinc-800/60">
            <div className="flex items-center gap-4 text-xs">
              {order.clientApprovalDeadline && (
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-500">Approval:</span>
                  <span className={cn(
                    "font-medium",
                    order.daysUntilDeadline !== null && order.daysUntilDeadline < 0
                      ? "text-rose-400"
                      : "text-zinc-300"
                  )}>
                    {order.clientApprovalDeadline}
                  </span>
                </div>
              )}
              {order.orderSentDeadline && (
                <div className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-500">Send:</span>
                  <span className="text-zinc-300 font-medium">{order.orderSentDeadline}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Copy Button Footer */}
      <div className="px-5 pb-5">
        <button
          onClick={handleCopy}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
            copied
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
              : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/50"
          )}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Order Details
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color = 'violet',
  subtitle,
  onClick,
  active 
}: { 
  title: string;
  value: number | string;
  icon: typeof LayoutDashboard;
  color?: 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';
  subtitle?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const colors = {
    violet: { 
      bg: 'from-violet-500/20 to-indigo-500/10', 
      icon: 'text-violet-400 bg-violet-500/20', 
      ring: 'ring-violet-500',
      glow: 'shadow-violet-500/20'
    },
    emerald: { 
      bg: 'from-emerald-500/20 to-teal-500/10', 
      icon: 'text-emerald-400 bg-emerald-500/20', 
      ring: 'ring-emerald-500',
      glow: 'shadow-emerald-500/20'
    },
    amber: { 
      bg: 'from-amber-500/20 to-orange-500/10', 
      icon: 'text-amber-400 bg-amber-500/20', 
      ring: 'ring-amber-500',
      glow: 'shadow-amber-500/20'
    },
    rose: { 
      bg: 'from-rose-500/20 to-pink-500/10', 
      icon: 'text-rose-400 bg-rose-500/20', 
      ring: 'ring-rose-500',
      glow: 'shadow-rose-500/20'
    },
    blue: { 
      bg: 'from-blue-500/20 to-cyan-500/10', 
      icon: 'text-blue-400 bg-blue-500/20', 
      ring: 'ring-blue-500',
      glow: 'shadow-blue-500/20'
    },
  };
  
  const c = colors[color];
  
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative overflow-hidden bg-[#12121a] rounded-2xl p-5 border transition-all duration-300 text-left w-full group",
        onClick ? "hover:border-zinc-700 cursor-pointer" : "cursor-default",
        active ? `border-2 ${c.ring} shadow-lg ${c.glow}` : "border-zinc-800/60"
      )}
    >
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-80",
        c.bg
      )} />
      
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          c.icon
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </button>
  );
}

// Main Dashboard Component
export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<'active' | 'past' | 'all'>('active');
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  
  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showAllWeeks) params.set('allWeeks', 'true');
      const res = await fetch(`/api/admin/orders?${params}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.orders || []);
      setStats(data.stats || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [showAllWeeks]);
  
  useEffect(() => {
    loadData();
  }, [loadData, showAllWeeks]);
  
  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = orders;
    
    // View filter
    if (viewFilter === 'active') {
      result = result.filter(o => !o.isPast && o.statusCategory !== 'completed' && o.statusCategory !== 'canceled');
    } else if (viewFilter === 'past') {
      result = result.filter(o => o.isPast || o.statusCategory === 'completed');
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    // Group filter
    if (groupFilter !== 'all') {
      result = result.filter(o => o.groupName === groupFilter);
    }
    
    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.advisor.toLowerCase().includes(q) ||
        o.orderNumber.toString().includes(q) ||
        o.venueName.toLowerCase().includes(q) ||
        o.groupName.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [orders, viewFilter, statusFilter, groupFilter, search]);
  
  // Get unique statuses for filter
  const statuses = useMemo(() => {
    const validStatuses = ['Not Started', 'Pending Details', 'All Details Added', 'Order Completed', 'Order Canceled', 'Issues'];
    return validStatuses.filter(s => orders.some(o => o.status === s));
  }, [orders]);
  
  // Get unique groups for filter
  const groups = useMemo(() => {
    return [...new Set(orders.map(o => o.groupName).filter(Boolean))].sort();
  }, [orders]);
  
  return (
    <div className="min-h-screen bg-[#08080c]">
      {/* Header */}
      <header className="bg-[#0c0c10]/80 backdrop-blur-xl border-b border-zinc-800/60 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Operations Dashboard</h1>
                <p className="text-xs text-zinc-500">Power Mailers Plus • Direct Mailing Orders</p>
              </div>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-all border border-zinc-700/50"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Error State */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Active Orders"
            value={stats?.activeOrders || 0}
            icon={FileText}
            color="violet"
            subtitle="Upcoming seminars"
            onClick={() => setViewFilter('active')}
            active={viewFilter === 'active'}
          />
          <StatCard
            title="Needs Setup"
            value={stats?.byStatus?.['Not Started'] || 0}
            icon={AlertTriangle}
            color="rose"
            subtitle="Action required"
            onClick={() => { setStatusFilter('Not Started'); setViewFilter('active'); }}
            active={statusFilter === 'Not Started'}
          />
          <StatCard
            title="Ready to Send"
            value={stats?.byStatus?.['All Details Added'] || 0}
            icon={CheckCircle2}
            color="emerald"
            subtitle="All details complete"
            onClick={() => { setStatusFilter('All Details Added'); setViewFilter('active'); }}
            active={statusFilter === 'All Details Added'}
          />
          <StatCard
            title="Completed"
            value={stats?.pastOrders || 0}
            icon={CheckCircle2}
            color="blue"
            subtitle="Past events"
            onClick={() => setViewFilter('past')}
            active={viewFilter === 'past'}
          />
          <StatCard
            title="Mail Volume"
            value={`${((stats?.totalMailPieces || 0) / 1000).toFixed(0)}k`}
            icon={Mail}
            color="amber"
            subtitle="Total pieces"
          />
        </div>
        
        {/* Filters Bar */}
        <div className="bg-[#12121a] rounded-2xl border border-zinc-800/60 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search orders, advisors, venues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-800/60 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 text-sm transition-all"
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center bg-zinc-900/50 rounded-xl border border-zinc-800/60 p-1">
              {(['active', 'past', 'all'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setViewFilter(view)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    viewFilter === view
                      ? "bg-violet-600 text-white shadow-lg"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-zinc-900/50 border border-zinc-800/60 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {statuses.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
            
            {/* Group Filter */}
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-4 py-3 bg-zinc-900/50 border border-zinc-800/60 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
            >
              <option value="all">All Groups</option>
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            
            {/* Time Range Toggle */}
            <button
              onClick={() => setShowAllWeeks(!showAllWeeks)}
              className={cn(
                "px-4 py-3 rounded-xl text-sm font-medium transition-all border flex items-center gap-2",
                showAllWeeks
                  ? "bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                  : "bg-zinc-900/50 text-zinc-400 border-zinc-800/60 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Calendar className="w-4 h-4" />
              {showAllWeeks ? 'All Future' : 'Next 6 Weeks'}
            </button>
            
            {/* Clear Filters */}
            {(search || statusFilter !== 'all' || groupFilter !== 'all' || viewFilter !== 'active') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setGroupFilter('all');
                  setViewFilter('active');
                }}
                className="px-4 py-2.5 text-zinc-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
        
        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-zinc-400 text-sm">
            Showing <span className="text-white font-semibold">{filteredOrders.length}</span> orders
          </p>
        </div>
        
        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              <p className="text-zinc-400">Loading orders from Google Sheets...</p>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-[#12121a] rounded-2xl border border-zinc-800/60 p-20 text-center">
            <FileText className="w-20 h-20 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 text-xl font-medium">No orders match your filters</p>
            <p className="text-zinc-500 text-sm mt-2">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          /* Orders Grid */
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
