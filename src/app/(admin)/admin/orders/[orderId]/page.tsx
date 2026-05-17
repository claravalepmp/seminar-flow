'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Calendar, MapPin, Clock, Mail, Zap, 
  FileText, CheckCircle, Copy, Check, ExternalLink, Phone,
  AlertCircle, Heart, Download, Upload, Edit3, Send,
  MoreHorizontal, Paperclip, MessageSquare, History
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: number;
  advisor: string;
  group_name: string;
  first_event_date: string | null;
  second_event_date: string | null;
  third_event_date: string | null;
  fourth_event_date: string | null;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  charity: string;
  class_type: string;
  mailing_quantity: number;
  mailer_type: string;
  landing_page_url: string;
  registration_phone: string;
  status: string;
  daysUntilEvent: number | null;
  isPast: boolean;
  proofs: any[];
  digitalJob: any;
  directMailJob: any;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ready: { label: 'Ready', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  pending_details: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  not_started: { label: 'Not Started', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
};

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'proofs' | 'activity'>('details');

  useEffect(() => {
    fetchOrder();
  }, [params.orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${params.orderId}`);
      if (!res.ok) throw new Error('Order not found');
      const data = await res.json();
      setOrder(data.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null, style: 'full' | 'short' = 'full') => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', 
      style === 'full' 
        ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
        : { month: 'short', day: 'numeric' }
    );
  };

  const handleCopyAll = () => {
    if (!order) return;
    
    const eventDates = [
      order.first_event_date,
      order.second_event_date,
      order.third_event_date,
      order.fourth_event_date,
    ].filter(Boolean).map(d => formatDate(d)).join(' or ');
    
    const timeStr = order.start_time && order.end_time 
      ? `${order.start_time} – ${order.end_time}` 
      : '';
    
    const text = [
      `${order.advisor} / #${order.order_number}`,
      eventDates,
      order.venue_name,
      order.venue_address,
      timeStr,
      order.charity,
      order.landing_page_url,
      order.registration_phone,
    ].filter(line => line?.trim()).join('\n');
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <AlertCircle className="w-12 h-12 text-zinc-600 mb-3" />
        <p className="text-zinc-400 mb-4">{error}</p>
        <Link href="/admin/orders" className="text-indigo-400 hover:underline text-sm">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const config = statusConfig[order.status] || statusConfig.not_started;
  const eventDates = [
    order.first_event_date,
    order.second_event_date,
    order.third_event_date,
    order.fourth_event_date,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders" className="p-2 hover:bg-zinc-800 rounded-lg transition">
            <ArrowLeft className="w-4 h-4 text-zinc-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-zinc-100">Order #{order.order_number}</h1>
              <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full border', config.bg, config.color)}>
                {config.label}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">{order.advisor} • {order.group_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition',
              copied 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'text-zinc-400 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700'
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy All'}
          </button>
          <button className="p-2 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition">
            <Edit3 className="w-4 h-4 text-zinc-500" />
          </button>
          <button className="p-2 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition">
            <MoreHorizontal className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800/50 -mx-6 px-6">
        {[
          { id: 'details', label: 'Details', icon: FileText },
          { id: 'proofs', label: 'Proofs', icon: Paperclip },
          { id: 'activity', label: 'Activity', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              activeTab === tab.id 
                ? 'border-indigo-500 text-zinc-200' 
                : 'border-transparent text-zinc-500 hover:text-zinc-400'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-4">
            {/* Event Info */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-300">Event Information</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  {eventDates.map((date, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Event {i + 1}</p>
                        <p className="text-sm text-zinc-200">{formatDate(date)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time */}
                {(order.start_time || order.end_time) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Time</p>
                      <p className="text-sm text-zinc-200">{order.start_time} – {order.end_time}</p>
                    </div>
                  </div>
                )}

                {/* Venue */}
                {order.venue_name && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Venue</p>
                      <p className="text-sm text-zinc-200">{order.venue_name}</p>
                      {order.venue_address && (
                        <p className="text-xs text-zinc-500 mt-0.5">{order.venue_address}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {order.class_type && (
                    <span className="text-[11px] font-medium px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full">
                      {order.class_type}
                    </span>
                  )}
                  {order.charity && (
                    <span className="text-[11px] font-medium px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {order.charity}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Links */}
            {(order.landing_page_url || order.registration_phone) && (
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50">
                  <h2 className="text-sm font-medium text-zinc-300">Links & Contact</h2>
                </div>
                <div className="p-4 space-y-3">
                  {order.landing_page_url && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <ExternalLink className="w-4 h-4 text-blue-400" />
                      </div>
                      <a 
                        href={order.landing_page_url} 
                        target="_blank" 
                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate"
                      >
                        {order.landing_page_url}
                      </a>
                    </div>
                  )}
                  {order.registration_phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-sm text-zinc-300">{order.registration_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Countdown */}
            {order.daysUntilEvent !== null && (
              <div className={cn(
                'rounded-xl p-4 border',
                order.isPast 
                  ? 'bg-zinc-900/50 border-zinc-800/50'
                  : order.daysUntilEvent <= 7 
                    ? 'bg-rose-500/5 border-rose-500/20'
                    : order.daysUntilEvent <= 14
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-emerald-500/5 border-emerald-500/20'
              )}>
                <p className="text-xs text-zinc-500 mb-1">
                  {order.isPast ? 'Event Completed' : 'Days Until Event'}
                </p>
                <p className={cn(
                  'text-3xl font-semibold',
                  order.isPast 
                    ? 'text-zinc-500'
                    : order.daysUntilEvent <= 7 
                      ? 'text-rose-400'
                      : order.daysUntilEvent <= 14
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                )}>
                  {order.isPast ? '✓' : order.daysUntilEvent}
                </p>
              </div>
            )}

            {/* Direct Mail */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-medium text-zinc-300">Direct Mail</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Quantity</span>
                  <span className="text-sm font-medium text-zinc-200">
                    {order.mailing_quantity?.toLocaleString() || '—'}
                  </span>
                </div>
                {order.mailer_type && (
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-500">Type</span>
                    <span className="text-sm text-zinc-300">{order.mailer_type}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Digital */}
            {order.digitalJob && (
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-medium text-zinc-300">Digital</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-500">Status</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full">
                      {order.digitalJob.status}
                    </span>
                  </div>
                  {order.digitalJob.maxBudget > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-zinc-500">Budget</span>
                      <span className="text-sm font-medium text-zinc-200">
                        ${order.digitalJob.maxBudget.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
                <Send className="w-4 h-4" />
                Send Update
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 text-zinc-300 rounded-lg text-sm font-medium transition">
                <MessageSquare className="w-4 h-4" />
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'proofs' && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-300">Proofs & Files</h2>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
          <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center">
            <Paperclip className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No proofs uploaded yet</p>
            <p className="text-xs text-zinc-600 mt-1">Drag and drop files here, or click Upload</p>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Activity Log</h2>
          <div className="space-y-4">
            <ActivityItem 
              action="Order created"
              time="May 15, 2026 at 2:30 PM"
              user="System"
            />
            <ActivityItem 
              action="Status changed to Pending"
              time="May 15, 2026 at 3:00 PM"
              user="Admin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityItem({ action, time, user }: { action: string; time: string; user: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 rounded-full bg-zinc-600 mt-2" />
      <div>
        <p className="text-sm text-zinc-300">{action}</p>
        <p className="text-xs text-zinc-500">{time} • {user}</p>
      </div>
    </div>
  );
}
