'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Calendar, MapPin, Clock, Mail, Zap, 
  FileText, CheckCircle, Copy, Check, ExternalLink, Phone,
  AlertCircle, Heart, Download, Upload, Edit3, Send,
  MoreHorizontal, Paperclip, MessageSquare, History,
  Building2, User, DollarSign, Printer, Globe, Receipt
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
  first_event_room: string;
  second_event_room: string;
  third_event_room: string;
  fourth_event_room: string;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  class_type: string;
  market: string;
  office_location: string;
  mailing_quantity: number;
  mailer_type: string;
  digital_budget: number;
  landing_page_url: string;
  needs_direct_mail: boolean;
  needs_digital: boolean;
  status: string;
  proof_status: string;
  overall_priority: string;
  event_notes: string;
  daysUntilEvent: number | null;
  isPast: boolean;
  isUrgent: boolean;
  // Connected data
  advisor_data: {
    id: string;
    advisor_name: string;
    group_name: string;
    business_name: string;
    mailer_return_address: string;
    registration_phone: string;
    main_contact_name: string;
    main_contact_email: string;
    main_contact_phone: string;
    usual_mailing_quantity: number;
    default_digital_budget: number;
  } | null;
  group_data: {
    id: string;
    name: string;
    registration_phone: string;
    registration_url: string;
    responsibility: string;
  } | null;
  region_data: {
    id: string;
    name: string;
    state: string;
    default_quantity: number;
  } | null;
  charity_data: {
    id: string;
    name: string;
    short_name: string;
  } | null;
  digital_jobs: Array<{
    id: string;
    order_number: number;
    status: string;
    qa_status: string;
    tp_status: string;
    landing_page_url: string;
    max_budget: number;
  }>;
  direct_mail_jobs: Array<{
    id: string;
    job_name: string;
    status: string;
    print_date: string;
    mail_date: string;
    quantity: number;
    proof_status: string;
  }>;
  proofs: Array<{
    id: string;
    name: string;
    status: string;
    proof_status: string;
    proof_version: number;
    uploaded_at: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    status: string;
    total_invoice: number;
    sent_date: string;
    paid_date: string;
  }>;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  // From Direct_Mail_Jobs
  completed: { label: 'Mailed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  mailed: { label: 'Mailed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  pending_list: { label: 'Pending List', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  at_printer: { label: 'At Printer', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  // Legacy
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'jobs' | 'proofs' | 'invoices'>('details');

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
    ].filter(Boolean).map(d => formatDate(d)).join('\n');
    
    const timeStr = order.start_time && order.end_time 
      ? `${order.start_time} – ${order.end_time}` 
      : '';
    
    const text = [
      `${order.advisor} / #${order.order_number}`,
      eventDates,
      order.venue_name,
      order.venue_address,
      timeStr,
      order.charity_data?.name,
      order.landing_page_url,
      order.advisor_data?.registration_phone || order.group_data?.registration_phone,
      order.advisor_data?.mailer_return_address,
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

  const config = statusConfig[order.status] || statusConfig.pending;
  const eventDates = [
    { date: order.first_event_date, room: order.first_event_room },
    { date: order.second_event_date, room: order.second_event_room },
    { date: order.third_event_date, room: order.third_event_room },
    { date: order.fourth_event_date, room: order.fourth_event_room },
  ].filter(e => e.date);

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
              {order.isUrgent && (
                <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  ⚡ {order.daysUntilEvent}d left
                </span>
              )}
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800/50 -mx-6 px-6">
        {[
          { id: 'details', label: 'Details', icon: FileText },
          { id: 'jobs', label: `Jobs (${(order.digital_jobs?.length || 0) + (order.direct_mail_jobs?.length || 0)})`, icon: Printer },
          { id: 'proofs', label: `Proofs (${order.proofs?.length || 0})`, icon: Paperclip },
          { id: 'invoices', label: `Invoices (${order.invoices?.length || 0})`, icon: Receipt },
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
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <h2 className="text-sm font-medium text-zinc-300">Event Information</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  {eventDates.map((event, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Event {i + 1}</p>
                        <p className="text-sm text-zinc-200">{formatDate(event.date)}</p>
                        {event.room && <p className="text-xs text-zinc-500">{event.room}</p>}
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
                      <p className="text-sm text-zinc-200 whitespace-pre-line">{order.venue_name}</p>
                      {order.venue_address && (
                        <p className="text-xs text-zinc-500 mt-0.5 whitespace-pre-line">{order.venue_address}</p>
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
                  {order.market && (
                    <span className="text-[11px] font-medium px-2 py-1 bg-violet-500/10 text-violet-400 rounded-full">
                      {order.market}
                    </span>
                  )}
                  {order.office_location && (
                    <span className="text-[11px] font-medium px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full">
                      {order.office_location}
                    </span>
                  )}
                  {order.charity_data && (
                    <span className="text-[11px] font-medium px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {order.charity_data.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Marketing Services */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <h2 className="text-sm font-medium text-zinc-300">Marketing Services</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                {/* Direct Mail */}
                <div className={cn(
                  'p-4 rounded-xl border',
                  order.needs_direct_mail 
                    ? 'bg-amber-500/5 border-amber-500/20' 
                    : 'bg-zinc-800/30 border-zinc-800'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className={cn('w-4 h-4', order.needs_direct_mail ? 'text-amber-400' : 'text-zinc-600')} />
                    <span className={cn('text-sm font-medium', order.needs_direct_mail ? 'text-amber-400' : 'text-zinc-600')}>
                      Direct Mail
                    </span>
                  </div>
                  {order.needs_direct_mail ? (
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-white">{order.mailing_quantity.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">{order.mailer_type || 'Type TBD'}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600">Not included</p>
                  )}
                </div>

                {/* Digital */}
                <div className={cn(
                  'p-4 rounded-xl border',
                  order.needs_digital 
                    ? 'bg-blue-500/5 border-blue-500/20' 
                    : 'bg-zinc-800/30 border-zinc-800'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className={cn('w-4 h-4', order.needs_digital ? 'text-blue-400' : 'text-zinc-600')} />
                    <span className={cn('text-sm font-medium', order.needs_digital ? 'text-blue-400' : 'text-zinc-600')}>
                      Digital
                    </span>
                  </div>
                  {order.needs_digital ? (
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-white">
                        {order.digital_budget > 0 ? `$${order.digital_budget.toLocaleString()}` : 'Budget TBD'}
                      </p>
                      {order.landing_page_url && (
                        <a 
                          href={order.landing_page_url} 
                          target="_blank" 
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" />
                          Landing Page
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600">Not included</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.event_notes && (
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50">
                  <h2 className="text-sm font-medium text-zinc-300">Notes</h2>
                </div>
                <div className="p-4">
                  <p className="text-sm text-zinc-400 whitespace-pre-line">{order.event_notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Advisor Info */}
            {order.advisor_data && (
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-500" />
                    Advisor
                  </h3>
                  <Link href={`/admin/advisors/${order.advisor_data.id}`} className="text-xs text-indigo-400 hover:underline">
                    View →
                  </Link>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-white">{order.advisor_data.advisor_name}</p>
                    <p className="text-xs text-zinc-500">{order.advisor_data.business_name}</p>
                  </div>
                  {order.advisor_data.main_contact_name && (
                    <div className="text-xs">
                      <p className="text-zinc-500">Contact</p>
                      <p className="text-zinc-300">{order.advisor_data.main_contact_name}</p>
                      {order.advisor_data.main_contact_email && (
                        <a href={`mailto:${order.advisor_data.main_contact_email}`} className="text-indigo-400 hover:underline">
                          {order.advisor_data.main_contact_email}
                        </a>
                      )}
                    </div>
                  )}
                  {order.advisor_data.registration_phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3 h-3 text-zinc-500" />
                      <span className="text-zinc-300">{order.advisor_data.registration_phone}</span>
                    </div>
                  )}
                  {order.advisor_data.mailer_return_address && (
                    <div className="text-xs">
                      <p className="text-zinc-500">Return Address</p>
                      <p className="text-zinc-300 whitespace-pre-line">{order.advisor_data.mailer_return_address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Group Info */}
            {order.group_data && (
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50">
                  <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-zinc-500" />
                    Group
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-sm font-medium text-white">{order.group_data.name}</p>
                  {order.group_data.registration_phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="w-3 h-3 text-zinc-500" />
                      <span className="text-zinc-300">{order.group_data.registration_phone}</span>
                    </div>
                  )}
                  {order.group_data.registration_url && (
                    <a href={order.group_data.registration_url} target="_blank" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Registration URL
                    </a>
                  )}
                  {order.group_data.responsibility && (
                    <p className="text-xs text-zinc-500">Responsibility: {order.group_data.responsibility}</p>
                  )}
                </div>
              </div>
            )}

            {/* Region */}
            {order.region_data && (
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50">
                  <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    Region
                  </h3>
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium text-white">{order.region_data.name}</p>
                  {order.region_data.state && <p className="text-xs text-zinc-500">{order.region_data.state}</p>}
                  {order.region_data.default_quantity > 0 && (
                    <p className="text-xs text-zinc-500 mt-1">Default qty: {order.region_data.default_quantity.toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
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

      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {/* Direct Mail Jobs */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-300">Direct Mail Jobs ({order.direct_mail_jobs?.length || 0})</h3>
            </div>
            {order.direct_mail_jobs && order.direct_mail_jobs.length > 0 ? (
              <div className="divide-y divide-zinc-800/50">
                {order.direct_mail_jobs.map(job => (
                  <div key={job.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{job.job_name || `Job #${job.order_number}`}</p>
                      <p className="text-xs text-zinc-500">
                        {job.quantity?.toLocaleString()} pieces • Print: {job.print_date || 'TBD'} • Mail: {job.mail_date || 'TBD'}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[11px] font-medium px-2 py-1 rounded-full',
                      job.status === 'Mailed' ? 'bg-emerald-500/10 text-emerald-400' :
                      job.status === 'At Printer' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-amber-500/10 text-amber-400'
                    )}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-sm">No direct mail jobs</div>
            )}
          </div>

          {/* Digital Jobs */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-medium text-zinc-300">Digital Jobs ({order.digital_jobs?.length || 0})</h3>
            </div>
            {order.digital_jobs && order.digital_jobs.length > 0 ? (
              <div className="divide-y divide-zinc-800/50">
                {order.digital_jobs.map(job => (
                  <div key={job.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">Digital Campaign #{job.order_number}</p>
                      <p className="text-xs text-zinc-500">
                        Budget: ${job.max_budget?.toLocaleString() || 0} • QA: {job.qa_status || 'Pending'} • TP: {job.tp_status || 'Pending'}
                      </p>
                      {job.landing_page_url && (
                        <a href={job.landing_page_url} target="_blank" className="text-xs text-indigo-400 hover:underline">
                          {job.landing_page_url}
                        </a>
                      )}
                    </div>
                    <span className={cn(
                      'text-[11px] font-medium px-2 py-1 rounded-full',
                      job.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' :
                      job.status === 'Active' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-amber-500/10 text-amber-400'
                    )}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-sm">No digital jobs</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'proofs' && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-zinc-500" />
              Proofs
            </h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition">
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
          {order.proofs && order.proofs.length > 0 ? (
            <div className="divide-y divide-zinc-800/50">
              {order.proofs.map(proof => (
                <div key={proof.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white">{proof.name}</p>
                      <p className="text-xs text-zinc-500">
                        v{proof.proof_version || 1} • {proof.uploaded_at || 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[11px] font-medium px-2 py-1 rounded-full',
                    proof.proof_status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                    proof.proof_status === 'Revision Requested' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  )}>
                    {proof.proof_status || proof.status || 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Paperclip className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No proofs uploaded yet</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-zinc-500" />
              Invoices
            </h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition">
              <DollarSign className="w-3.5 h-3.5" />
              Create Invoice
            </button>
          </div>
          {order.invoices && order.invoices.length > 0 ? (
            <div className="divide-y divide-zinc-800/50">
              {order.invoices.map(invoice => (
                <div key={invoice.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Invoice #{invoice.invoice_number}</p>
                    <p className="text-xs text-zinc-500">
                      Sent: {invoice.sent_date || 'Not sent'} • Paid: {invoice.paid_date || 'Unpaid'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      ${invoice.total_invoice?.toLocaleString() || 0}
                    </span>
                    <span className={cn(
                      'text-[11px] font-medium px-2 py-1 rounded-full',
                      invoice.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' :
                      invoice.status === 'Overdue' ? 'bg-rose-500/10 text-rose-400' :
                      invoice.status === 'Sent' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-zinc-500/10 text-zinc-400'
                    )}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Receipt className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No invoices yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
