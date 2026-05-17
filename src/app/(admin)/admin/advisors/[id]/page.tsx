'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, User, Building2, Mail, Phone, Calendar,
  FileText, AlertCircle, ChevronRight, CheckCircle2, 
  Clock, Plus, Send, MoreHorizontal, Edit3, ExternalLink,
  MapPin, Heart, DollarSign, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Advisor {
  id: string;
  advisor_name: string;
  group_name: string;
  business_name: string;
  business_website: string;
  business_address: string;
  business_city: string;
  business_state: string;
  mailer_return_address: string;
  registration_phone: string;
  website_registration_direct: string;
  website_registration_digital: string;
  main_contact_name: string;
  main_contact_email: string;
  main_contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  cc_emails: string;
  usual_mailing_quantity: number;
  default_digital_budget: number;
  direct_mailer_rate: number;
  order_instructions: string;
  client_notes: string;
  ein: string;
  disclaimer: string;
  preferred_mailer_topics: string;
  mailer_type_used: string;
  direct_mail_discounts: string;
  start_orders_before_paid: boolean;
  non_profit_status: boolean;
  group_data: {
    id: string;
    name: string;
    website: string;
    registration_phone: string;
    registration_url: string;
    address: string;
    responsibility: string;
  } | null;
  orderCount: number;
  activeOrderCount: number;
  totalMailQuantity: number;
  orders: Array<{
    id: string;
    order_number: number;
    first_event_date: string | null;
    venue_name: string;
    class_type: string;
    mailing_quantity: number;
    status: string;
    daysUntil: number | null;
    isPast: boolean;
  }>;
  venues: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
  }>;
  charities: Array<{
    id: string;
    name: string;
    short_name: string;
  }>;
}

interface Stats {
  activeOrders: number;
  pastOrders: number;
  totalOrders: number;
  totalMailQuantity: number;
}

export default function AdvisorDetailPage() {
  const params = useParams();
  const [advisor, setAdvisor] = useState<Advisor | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    fetchAdvisor();
  }, [params.id]);

  const fetchAdvisor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/advisors/${params.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load');
      }
      const data = await res.json();
      setAdvisor(data.advisor);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !advisor) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <AlertCircle className="w-12 h-12 text-zinc-600 mb-3" />
        <p className="text-zinc-400 mb-4">{error || 'Advisor not found'}</p>
        <Link href="/admin/advisors" className="text-indigo-400 hover:underline text-sm">
          ← Back to Advisors
        </Link>
      </div>
    );
  }

  const orders = advisor.orders || [];
  const activeOrders = orders.filter(o => !o.isPast && o.status !== 'completed' && o.status !== 'cancelled');
  const pastOrders = orders.filter(o => o.isPast || o.status === 'completed');
  const displayOrders = activeTab === 'upcoming' ? activeOrders : pastOrders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/advisors" className="p-2 hover:bg-zinc-800 rounded-lg transition">
            <ArrowLeft className="w-4 h-4 text-zinc-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-emerald-400">
                {advisor.advisor_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">{advisor.advisor_name}</h1>
              <p className="text-sm text-zinc-500">{advisor.group_name} • {advisor.business_name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg transition">
            <Send className="w-3.5 h-3.5" />
            Message
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-3.5 h-3.5" />
            New Order
          </button>
          <button className="p-2 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition">
            <Edit3 className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <MiniStat label="Active" value={stats?.activeOrders || 0} highlight />
            <MiniStat label="Past" value={stats?.pastOrders || 0} />
            <MiniStat label="Total" value={stats?.totalOrders || 0} />
            <MiniStat label="Mail Volume" value={(stats?.totalMailQuantity || 0).toLocaleString()} />
          </div>

          {/* Orders */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="flex border-b border-zinc-800/50">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition',
                  activeTab === 'upcoming' 
                    ? 'border-indigo-500 text-zinc-200' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-400'
                )}
              >
                Upcoming ({activeOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition',
                  activeTab === 'past' 
                    ? 'border-indigo-500 text-zinc-200' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-400'
                )}
              >
                Past ({pastOrders.length})
              </button>
            </div>

            {displayOrders.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No {activeTab} orders</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {displayOrders.map((order) => {
                  const urgencyColor = order.daysUntil !== null
                    ? order.daysUntil <= 7 ? 'text-rose-400 bg-rose-500/10'
                    : order.daysUntil <= 14 ? 'text-amber-400 bg-amber-500/10'
                    : 'text-emerald-400 bg-emerald-500/10'
                    : 'text-zinc-500 bg-zinc-700/50';
                  
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-500 w-12">#{order.order_number}</span>
                        <div>
                          <p className="text-sm text-zinc-200">{order.venue_name || 'Venue TBD'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-zinc-500">{formatDate(order.first_event_date)}</span>
                            {order.class_type && (
                              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">
                                {order.class_type}
                              </span>
                            )}
                            {order.mailing_quantity > 0 && (
                              <span className="text-[10px] text-zinc-500">
                                {(order.mailing_quantity / 1000).toFixed(0)}k mail
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {order.daysUntil !== null && !order.isPast && (
                          <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full', urgencyColor)}>
                            {order.daysUntil}d
                          </span>
                        )}
                        {(order.isPast || order.status === 'completed') && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Venues */}
          {advisor.venues && advisor.venues.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-medium text-zinc-300">Venues ({advisor.venues.length})</h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {advisor.venues.map(venue => (
                  <div key={venue.id} className="px-4 py-3">
                    <p className="text-sm text-zinc-200">{venue.name}</p>
                    <p className="text-xs text-zinc-500">{venue.address}, {venue.city}, {venue.state}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charities */}
          {advisor.charities && advisor.charities.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-medium text-zinc-300">Charities ({advisor.charities.length})</h3>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {advisor.charities.map(charity => (
                  <span key={charity.id} className="text-xs px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full">
                    {charity.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-300">Contact</h3>
              <button className="p-1 hover:bg-zinc-800 rounded transition">
                <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {advisor.business_name && (
                <ContactItem icon={Building2} label="Business" value={advisor.business_name} />
              )}
              {advisor.main_contact_name && (
                <ContactItem icon={User} label="Contact" value={advisor.main_contact_name} />
              )}
              {advisor.main_contact_email && (
                <ContactItem 
                  icon={Mail} 
                  label="Email" 
                  value={advisor.main_contact_email}
                  href={`mailto:${advisor.main_contact_email}`}
                />
              )}
              {advisor.main_contact_phone && (
                <ContactItem 
                  icon={Phone} 
                  label="Phone" 
                  value={advisor.main_contact_phone}
                  href={`tel:${advisor.main_contact_phone}`}
                />
              )}
              {advisor.registration_phone && (
                <ContactItem icon={Phone} label="Registration" value={advisor.registration_phone} />
              )}
              {advisor.business_website && (
                <ContactItem 
                  icon={Globe} 
                  label="Website" 
                  value={advisor.business_website}
                  href={advisor.business_website}
                />
              )}
              {advisor.mailer_return_address && (
                <div className="pt-2 border-t border-zinc-800/50">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Return Address</p>
                  <p className="text-xs text-zinc-400 whitespace-pre-line">{advisor.mailer_return_address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Contact */}
          {advisor.secondary_contact_name && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <h3 className="text-sm font-medium text-zinc-300">Secondary Contact</h3>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm text-zinc-200">{advisor.secondary_contact_name}</p>
                {advisor.secondary_contact_email && (
                  <a href={`mailto:${advisor.secondary_contact_email}`} className="text-xs text-indigo-400 hover:underline block">
                    {advisor.secondary_contact_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Defaults */}
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <h3 className="text-sm font-medium text-zinc-300">Defaults</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Usual Mail Qty</span>
                <span className="text-sm text-zinc-200">
                  {advisor.usual_mailing_quantity > 0 
                    ? advisor.usual_mailing_quantity.toLocaleString() 
                    : '—'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Digital Budget</span>
                <span className="text-sm text-zinc-200">
                  {advisor.default_digital_budget > 0 
                    ? `$${advisor.default_digital_budget.toLocaleString()}`
                    : '—'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Mailer Rate</span>
                <span className="text-sm text-zinc-200">
                  {advisor.direct_mailer_rate > 0 
                    ? `$${advisor.direct_mailer_rate.toFixed(2)}`
                    : '—'
                  }
                </span>
              </div>
              {advisor.mailer_type_used && (
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Mailer Type</span>
                  <span className="text-sm text-zinc-200">{advisor.mailer_type_used}</span>
                </div>
              )}
            </div>
          </div>

          {/* Group Info */}
          {advisor.group_data && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-zinc-500" />
                  Group
                </h3>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium text-white">{advisor.group_data.name}</p>
                {advisor.group_data.registration_phone && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {advisor.group_data.registration_phone}
                  </p>
                )}
                {advisor.group_data.registration_url && (
                  <a href={advisor.group_data.registration_url} target="_blank" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Registration URL
                  </a>
                )}
                {advisor.group_data.responsibility && (
                  <p className="text-xs text-zinc-500">Responsibility: {advisor.group_data.responsibility}</p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {(advisor.order_instructions || advisor.client_notes) && (
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <h3 className="text-sm font-medium text-zinc-300">Notes</h3>
              </div>
              <div className="p-4 space-y-3">
                {advisor.order_instructions && (
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Order Instructions</p>
                    <p className="text-xs text-zinc-400 whitespace-pre-line">{advisor.order_instructions}</p>
                  </div>
                )}
                {advisor.client_notes && (
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Client Notes</p>
                    <p className="text-xs text-zinc-400 whitespace-pre-line">{advisor.client_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn(
        "text-lg font-semibold mt-0.5",
        highlight ? "text-indigo-400" : "text-zinc-200"
      )}>
        {value}
      </p>
    </div>
  );
}

function ContactItem({ 
  icon: Icon, 
  label, 
  value, 
  href 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  href?: string;
}) {
  const content = (
    <>
      <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-zinc-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</p>
        <p className={cn(
          "text-sm truncate",
          href ? "text-indigo-400" : "text-zinc-300"
        )}>
          {value}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} className="flex items-center gap-2.5 hover:bg-zinc-800/50 -mx-2 px-2 py-1 rounded-lg transition">
        {content}
      </a>
    );
  }

  return <div className="flex items-center gap-2.5">{content}</div>;
}
