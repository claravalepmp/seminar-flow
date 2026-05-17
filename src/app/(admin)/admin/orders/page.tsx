'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Search, Filter, Calendar, MapPin, Clock, Copy, Check,
  ChevronRight, ChevronDown, X, SlidersHorizontal, Download,
  ArrowUpDown, AlertTriangle, MoreHorizontal, Eye, Trash2,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: number;
  advisor: string;
  group_name: string;
  office_location: string;
  first_event_date: string | null;
  second_event_date: string | null;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  charity: string;
  landing_page_url: string;
  class_type: string;
  mailing_quantity: number;
  status: string;
  daysUntilEvent: number | null;
  isPast: boolean;
  isUrgent: boolean;
  weeksOut: number | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  in_progress: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  completed: { label: 'Mailed', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('date_asc');
  const [includePast, setIncludePast] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadOrders();
  }, [includePast]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includePast) {
        params.set('includePast', 'true');
        params.set('includeCompleted', 'true');
      }
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (order: Order) => {
    const eventDates = [order.first_event_date, order.second_event_date].filter(Boolean);
    const text = [
      `${order.advisor} / #${order.order_number}`,
      eventDates.map(d => new Date(d!).toLocaleDateString('en-US', { 
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
      })).join(' or '),
      order.venue_name,
      order.venue_address,
      order.start_time && order.end_time ? `${order.start_time} – ${order.end_time}` : '',
      order.charity,
      order.landing_page_url,
    ].filter(Boolean).join('\n');
    
    navigator.clipboard.writeText(text);
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredOrders.map(o => o.id)));
    }
  };

  let filteredOrders = orders.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.order_number.toString().includes(q) &&
          !o.advisor?.toLowerCase().includes(q) &&
          !o.group_name?.toLowerCase().includes(q) &&
          !o.venue_name?.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (status !== 'all' && o.status !== status) return false;
    return true;
  });

  filteredOrders.sort((a, b) => {
    switch (sort) {
      case 'date_asc':
        if (!a.first_event_date && !b.first_event_date) return 0;
        if (!a.first_event_date) return 1;
        if (!b.first_event_date) return -1;
        return new Date(a.first_event_date).getTime() - new Date(b.first_event_date).getTime();
      case 'date_desc':
        if (!a.first_event_date && !b.first_event_date) return 0;
        if (!a.first_event_date) return 1;
        if (!b.first_event_date) return -1;
        return new Date(b.first_event_date).getTime() - new Date(a.first_event_date).getTime();
      case 'order_desc':
        return b.order_number - a.order_number;
      default:
        return 0;
    }
  });

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Orders</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{filteredOrders.length} orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg transition">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
            <Plus className="w-3.5 h-3.5" />
            New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {['all', 'not_started', 'pending', 'ready', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                status === s 
                  ? 'bg-zinc-700 text-zinc-200' 
                  : 'text-zinc-500 hover:text-zinc-400'
              )}
            >
              {s === 'all' ? 'All' : statusConfig[s]?.label || s}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 focus:outline-none focus:border-zinc-700 appearance-none cursor-pointer"
        >
          <option value="date_asc">Date ↑</option>
          <option value="date_desc">Date ↓</option>
          <option value="order_desc">Order # ↓</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePast}
            onChange={(e) => setIncludePast(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500/50"
          />
          Past events
        </label>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800/50">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === filteredOrders.length && filteredOrders.length > 0}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500/50"
                />
              </th>
              <th className="text-left px-3 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Order</th>
              <th className="text-left px-3 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Advisor</th>
              <th className="text-left px-3 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Region</th>
              <th className="text-left px-3 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Event Date</th>
              <th className="text-left px-3 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Venue</th>
              <th className="text-left px-3 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Weeks</th>
              <th className="w-20 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-sm text-zinc-500">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500">
                  No orders found
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const config = statusConfig[order.status] || statusConfig.not_started;
                const urgencyColor = order.daysUntilEvent !== null
                  ? order.daysUntilEvent <= 7 ? 'text-rose-400'
                  : order.daysUntilEvent <= 14 ? 'text-amber-400'
                  : 'text-zinc-500'
                  : 'text-zinc-600';
                
                return (
                  <tr 
                    key={order.id} 
                    className={cn(
                      "hover:bg-zinc-800/30 transition group",
                      selected.has(order.id) && "bg-zinc-800/20"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                        className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-mono text-zinc-500">#{order.order_number}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <span className="text-sm text-zinc-200">{order.advisor}</span>
                        <p className="text-xs text-zinc-600 mt-0.5">{order.group_name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        order.office_location ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-700/50 text-zinc-500'
                      )}>
                        {order.office_location || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-zinc-400">{formatDate(order.first_event_date)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-zinc-400 truncate block max-w-[180px]">
                        {order.venue_name || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        'text-sm font-semibold',
                        order.weeksOut !== null && order.weeksOut <= 4 ? 'text-rose-400' :
                        order.weeksOut !== null && order.weeksOut <= 6 ? 'text-amber-400' :
                        'text-zinc-500'
                      )}>
                        {order.weeksOut !== null ? `${order.weeksOut}w` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleCopy(order)}
                          className={cn(
                            'p-1.5 rounded-md transition',
                            copiedId === order.id 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300'
                          )}
                          title="Copy"
                        >
                          {copiedId === order.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selection Actions */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 flex items-center gap-4 shadow-xl">
          <span className="text-sm text-zinc-300">{selected.size} selected</span>
          <div className="w-px h-5 bg-zinc-700" />
          <button className="text-sm text-zinc-400 hover:text-zinc-200 transition">Bulk Edit</button>
          <button className="text-sm text-zinc-400 hover:text-zinc-200 transition">Export</button>
          <button className="text-sm text-rose-400 hover:text-rose-300 transition">Delete</button>
          <button 
            onClick={() => setSelected(new Set())}
            className="p-1 hover:bg-zinc-700 rounded transition"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      )}
    </div>
  );
}
