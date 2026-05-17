import Link from 'next/link';
import { Zap, ArrowRight, BarChart3, Calendar, Users, Shield, Check } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">SeminarFlow</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link 
              href="/portal" 
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300 transition"
            >
              Client Portal
            </Link>
            <Link 
              href="/admin" 
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-lg text-sm font-medium transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-indigo-300 font-medium">Powered by Power Mailers Plus</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-5">
            Seminar marketing
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              operations simplified
            </span>
          </h1>
          
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            Track orders, manage campaigns, and deliver results for financial advisors. 
            All your seminar operations in one place.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link 
              href="/admin"
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-900 rounded-lg font-medium text-sm hover:bg-zinc-100 transition"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/portal"
              className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 text-zinc-300 rounded-lg font-medium text-sm hover:bg-zinc-800/50 transition"
            >
              Client Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Calendar className="w-5 h-5" />}
              title="Order Management"
              description="Track every seminar from submission to completion with real-time updates."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-5 h-5" />}
              title="Analytics"
              description="Deep insights into campaign performance and advisor activity."
            />
            <FeatureCard 
              icon={<Users className="w-5 h-5" />}
              title="Client Portal"
              description="Self-service portal for advisors to submit and track orders."
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Stat value="18+" label="Years" />
            <Stat value="1000+" label="Campaigns" />
            <Stat value="$100M+" label="AUM Generated" />
            <Stat value="50+" label="States" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
          <p className="text-zinc-400 mb-6">
            Access the admin dashboard to manage your seminar operations.
          </p>
          <Link 
            href="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>SeminarFlow</span>
          </div>
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Power Mailers Plus
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-5 hover:border-zinc-700/50 transition-all group">
      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4 text-zinc-400 group-hover:text-zinc-300 transition">
        {icon}
      </div>
      <h3 className="text-[15px] font-medium text-zinc-200 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl md:text-3xl font-semibold text-zinc-100">{value}</p>
      <p className="text-sm text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
