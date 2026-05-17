'use client';

import { useEffect, useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  MapPin, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: number;
  advisor: string;
  first_event_date: string | null;
  venue_name: string;
  start_time: string;
  daysUntilEvent: number | null;
}

export default function CalendarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders?includePast=true&includeCompleted=true');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  // Group orders by date
  const ordersByDate = orders.reduce((acc, order) => {
    if (order.first_event_date) {
      const dateKey = order.first_event_date.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(order);
    }
    return acc;
  }, {} as Record<string, Order[]>);

  const renderCalendarDays = () => {
    const days = [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Empty cells for days before start
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-28 bg-white/[0.01]" />);
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOrders = ordersByDate[dateStr] || [];
      const isToday = dateStr === todayStr;
      
      days.push(
        <div
          key={day}
          className={cn(
            'h-28 p-2 border-t border-white/5 hover:bg-white/[0.02] transition relative',
            isToday && 'bg-violet-500/5'
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              'text-sm font-medium',
              isToday 
                ? 'w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center'
                : 'text-white/60'
            )}>
              {day}
            </span>
            {dayOrders.length > 0 && (
              <span className="text-xs text-violet-400 font-medium">{dayOrders.length}</span>
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {dayOrders.slice(0, 2).map((order) => (
              <div
                key={order.id}
                className={cn(
                  'text-xs px-2 py-1 rounded truncate',
                  order.daysUntilEvent !== null && order.daysUntilEvent <= 7
                    ? 'bg-rose-500/20 text-rose-300'
                    : order.daysUntilEvent !== null && order.daysUntilEvent <= 14
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-violet-500/20 text-violet-300'
                )}
              >
                #{order.order_number} {order.advisor}
              </div>
            ))}
            {dayOrders.length > 2 && (
              <div className="text-xs text-white/40 px-2">+{dayOrders.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-white/40 mt-1">Event schedule overview</p>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-white/5 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </button>
          <h2 className="text-xl font-semibold text-white min-w-[200px] text-center">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-white/5 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5 text-white/60" />
          </button>
        </div>
        <button
          onClick={today}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm font-medium transition"
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-white/5">
          {dayNames.map((day) => (
            <div key={day} className="px-4 py-3 text-center">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                {day}
              </span>
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        {loading ? (
          <div className="h-[600px] flex items-center justify-center text-white/40">
            Loading calendar...
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        )}
      </div>

      {/* Upcoming Events List */}
      <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold text-white">Upcoming This Month</h3>
        </div>
        <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
          {orders
            .filter(o => {
              if (!o.first_event_date) return false;
              const d = new Date(o.first_event_date);
              return d.getMonth() === month && d.getFullYear() === year && d >= new Date();
            })
            .slice(0, 10)
            .map((order) => (
              <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">#{order.order_number}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{order.advisor}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <CalendarIcon className="w-3 h-3" />
                        {new Date(order.first_event_date!).toLocaleDateString('en-US', { 
                          weekday: 'short', month: 'short', day: 'numeric' 
                        })}
                      </span>
                      {order.venue_name && (
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <MapPin className="w-3 h-3" />
                          {order.venue_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {order.daysUntilEvent !== null && (
                  <span className={cn(
                    'px-2 py-1 rounded-lg text-xs font-bold',
                    order.daysUntilEvent <= 7 ? 'bg-rose-500/20 text-rose-400' :
                    order.daysUntilEvent <= 14 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  )}>
                    {order.daysUntilEvent}d
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
