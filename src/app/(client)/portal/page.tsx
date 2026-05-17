'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  Plus, Calendar, Clock, MapPin, ChevronRight, Copy, Check,
  FileText, CheckCircle2, Mail, RefreshCw, AlertTriangle, Zap,
  ExternalLink, Building2, Monitor, Phone, Heart, Loader2,
  ArrowRight, Sparkles, Send, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  orderNumber: number;
  status: string;
  statusCategory: string;
  advisor: string;
  groupName: string;
  officeLocation: string;
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
  mailerReturnAddress: string;
  landingPageUrl: string;
  registrationPhone: string;
  clientApprovalDeadline: string | null;
  orderSentDeadline: string | null;
  needsDirectMail: boolean;
  needsDigital: boolean;
  digitalBudget: number;
  daysUntilEvent: number | null;
  isPast: boolean;
  isUrgent: boolean;
}

interface Stats {
  activeOrders: number;
  pastOrders: number;
  totalMailVolume: number;
  upcomingUrgent: number;
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  'Not Started': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  'Pending Details': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'All Details Added': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Order Completed': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

// Order Card with Copy functionality and Job status
function OrderCard({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);
  
  const eventDates = [
    order.firstEventDate, 
    order.secondEventDate, 
    order.thirdEventDate, 
    order.fourthEventDate
  ].filter(Boolean);
  
  const timeStr = order.startTime && order.endTime 
    ? `${order.startTime} – ${order.endTime}` 
    : order.startTime || order.endTime || '';

  // Build copyable text in exact format
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
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPastOrComplete = order.isPast || order.status === 'Order Completed';

  return (
    <div className={cn(
      "bg-[#12121a] rounded-2xl border overflow-hidden transition-all duration-300 group hover:shadow-xl",
      order.isUrgent ? "border-rose-500/50 ring-2 ring-rose-500/20 shadow-rose-500/10" : 
      "border-zinc-800/60 hover:border-zinc-700"
    )}>
      {/* Urgency Banner */}
      {order.isUrgent && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 px-4 py-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-white animate-pulse" />
          <span className="text-white text-sm font-bold uppercase tracking-wider">
            {order.daysUntilEvent === 0 ? '🔥 Event Today!' : 
             order.daysUntilEvent === 1 ? '⚡ Tomorrow' : 
             `⏰ ${order.daysUntilEvent} days until event`}
          </span>
        </div>
      )}
      
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg',
              isPastOrComplete
                ? 'bg-zinc-800 text-zinc-500'
                : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
            )}>
              #{order.orderNumber}
            </div>
            <div>
              <p className="font-bold text-white text-lg">{order.venueName || 'Venue TBD'}</p>
              <p className="text-sm text-zinc-500">{order.groupName || order.advisor}</p>
            </div>
          </div>
          
          {/* Days Badge */}
          {!isPastOrComplete && order.daysUntilEvent !== null && (
            <span className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-bold border',
              order.daysUntilEvent <= 7 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
              order.daysUntilEvent <= 14 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              order.daysUntilEvent <= 21 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            )}>
              {order.daysUntilEvent}d
            </span>
          )}
          
          {isPastOrComplete && (
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          )}
        </div>
      </div>
      
      {/* Jobs Status - Connected to Client Side */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {order.needsDirectMail && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-xl text-xs font-semibold border border-amber-500/20">
              <Mail className="w-3.5 h-3.5" />
              Direct Mail
              {order.mailingQuantity > 0 && (
                <span className="text-amber-300">• {(order.mailingQuantity / 1000).toFixed(0)}k pcs</span>
              )}
            </span>
          )}
          {order.needsDigital && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-xl text-xs font-semibold border border-blue-500/20">
              <Monitor className="w-3.5 h-3.5" />
              Digital Ads
            </span>
          )}
          {order.classType && (
            <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 rounded-lg text-xs font-medium border border-violet-500/20">
              {order.classType}
            </span>
          )}
        </div>
      </div>
      
      {/* Event Details */}
      <div className="px-5 pb-4 space-y-2.5">
        {eventDates.length > 0 && (
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              {eventDates.map((d, i) => (
                <p key={i} className={cn(
                  "text-sm",
                  i === 0 ? "text-white font-medium" : "text-zinc-400"
                )}>{d}</p>
              ))}
            </div>
          </div>
        )}
        
        {order.venueAddress && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <p className="text-sm text-zinc-400 line-clamp-2">{order.venueAddress}</p>
          </div>
        )}
        
        {timeStr && (
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-sm text-zinc-300">{timeStr}</p>
          </div>
        )}
        
        {order.charity && (
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-pink-400 shrink-0" />
            <p className="text-sm text-zinc-400">{order.charity}</p>
          </div>
        )}
        
        {order.landingPageUrl && (
          <div className="flex items-center gap-3">
            <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
            <a 
              href={order.landingPageUrl.startsWith('http') ? order.landingPageUrl : `https://${order.landingPageUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 truncate transition-colors"
            >
              {order.landingPageUrl.replace(/^https?:\/\//, '').slice(0, 40)}
            </a>
          </div>
        )}
        
        {order.registrationPhone && (
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-zinc-400">{order.registrationPhone}</p>
          </div>
        )}
      </div>
      
      {/* Deadlines */}
      {(order.clientApprovalDeadline || order.orderSentDeadline) && (
        <div className="px-5 pb-4">
          <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
            <div className="flex items-center gap-4 text-xs">
              {order.clientApprovalDeadline && (
                <div className="flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-500">Approval:</span>
                  <span className="text-zinc-300 font-medium">{order.clientApprovalDeadline}</span>
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
        </div>
      )}
      
      {/* Copy Button */}
      <div className="px-5 pb-5">
        <button
          onClick={handleCopy}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
            copied 
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
              : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/50'
          )}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Order Details'}
        </button>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'active' | 'past'>('active');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [groups, setGroups] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('view', view);
      if (selectedGroup) params.set('group', selectedGroup);
      
      const res = await fetch(`/api/client/orders?${params}`);
      const data = await res.json();
      
      setOrders(data.orders || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [view, selectedGroup]);

  // Load groups on mount
  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => {
        setGroups(data.groups || []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-[#08080c]">
      {/* Header */}
      <header className="bg-[#0c0c10]/80 backdrop-blur-xl border-b border-zinc-800/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">My Seminars</h1>
                <p className="text-xs text-zinc-500">Power Mailers Plus • Client Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Group Selector */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-4 py-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all cursor-pointer"
              >
                <option value="">All Groups</option>
                {groups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all border border-zinc-700/50"
              >
                <RefreshCw className={cn('w-4 h-4 text-zinc-400', loading && 'animate-spin')} />
              </button>
              
              <Link
                href="/portal/orders/new"
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Order
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button 
            className={cn(
              "bg-[#12121a] rounded-2xl p-5 border-2 cursor-pointer transition-all text-left group",
              view === 'active' 
                ? 'border-violet-500 shadow-lg shadow-violet-500/20' 
                : 'border-zinc-800/60 hover:border-zinc-700'
            )}
            onClick={() => setView('active')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                view === 'active' ? 'bg-violet-500/20' : 'bg-zinc-800'
              )}>
                <Calendar className={cn(
                  "w-6 h-6 transition-colors",
                  view === 'active' ? 'text-violet-400' : 'text-zinc-500'
                )} />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stats?.activeOrders || 0}</p>
                <p className="text-zinc-500 text-xs">Upcoming</p>
              </div>
            </div>
          </button>
          
          <div className="bg-[#12121a] rounded-2xl p-5 border border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-rose-400">{stats?.upcomingUrgent || 0}</p>
                <p className="text-zinc-500 text-xs">Urgent</p>
              </div>
            </div>
          </div>
          
          <button 
            className={cn(
              "bg-[#12121a] rounded-2xl p-5 border-2 cursor-pointer transition-all text-left group",
              view === 'past' 
                ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' 
                : 'border-zinc-800/60 hover:border-zinc-700'
            )}
            onClick={() => setView('past')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                view === 'past' ? 'bg-emerald-500/20' : 'bg-zinc-800'
              )}>
                <CheckCircle2 className={cn(
                  "w-6 h-6 transition-colors",
                  view === 'past' ? 'text-emerald-400' : 'text-zinc-500'
                )} />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stats?.pastOrders || 0}</p>
                <p className="text-zinc-500 text-xs">Completed</p>
              </div>
            </div>
          </button>
          
          <div className="bg-[#12121a] rounded-2xl p-5 border border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">
                  {((stats?.totalMailVolume || 0) / 1000).toFixed(0)}k
                </p>
                <p className="text-zinc-500 text-xs">Mail Volume</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setView('active')}
            className={cn(
              'px-6 py-3 rounded-xl text-sm font-semibold transition-all',
              view === 'active' 
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' 
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700/50'
            )}
          >
            Upcoming Events
          </button>
          <button
            onClick={() => setView('past')}
            className={cn(
              'px-6 py-3 rounded-xl text-sm font-semibold transition-all',
              view === 'past' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' 
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700/50'
            )}
          >
            Past Events
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              <p className="text-zinc-400">Loading your seminars...</p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-[#12121a] rounded-2xl border border-zinc-800/60 p-20 text-center">
            <FileText className="w-20 h-20 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 text-xl font-medium mb-2">
              {view === 'active' ? 'No upcoming seminars' : 'No past seminars'}
            </p>
            <p className="text-zinc-500 mb-6">
              {view === 'active' ? 'Create a new order to schedule your next seminar' : 'Your completed seminars will appear here'}
            </p>
            {view === 'active' && (
              <Link
                href="/portal/orders/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-violet-500/30 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Your First Order
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          /* Orders Grid */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
