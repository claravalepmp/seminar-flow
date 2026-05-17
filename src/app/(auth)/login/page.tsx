'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAdvisors, getAdvisorGroups, initDB, type AdvisorGroup } from '@/lib/db';
import type { Advisor } from '@/types';

function LoginForm() {
  const [advisors, setAdvisors] = useState<(Advisor & { group?: AdvisorGroup })[]>([]);
  const [selectedAdvisor, setSelectedAdvisor] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'client' | 'admin'>('client');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    initDB();
    const groups = getAdvisorGroups();
    const allAdvisors = getAdvisors().map(a => ({
      ...a,
      group: groups.find(g => g.group_id === a.group_id)
    }));
    setAdvisors(allAdvisors);
  }, []);

  // Demo/skip mode bypass
  useEffect(() => {
    const shouldSkip = searchParams.get('demo') === 'true' || searchParams.get('skip') === 'true';
    const skipAdmin = searchParams.get('admin') === 'true';
    
    if (shouldSkip) {
      if (skipAdmin) {
        localStorage.setItem('admin_token', 'demo_admin_token');
        router.push('/admin');
      } else {
        const demoAdvisor = advisors.find(a => a.advisor_id === 'demo') || {
          advisor_id: 'demo',
          email: 'demo@powermailers.com',
          advisor_name: 'Demo User',
          company_name: 'Demo Financial Group',
        };
        localStorage.setItem('advisor', JSON.stringify(demoAdvisor));
        router.push('/portal');
      }
    }
  }, [searchParams, router, advisors]);

  const handleClientLogin = () => {
    if (!selectedAdvisor) {
      setError('Please select an advisor');
      return;
    }
    
    const advisor = advisors.find(a => a.advisor_id === selectedAdvisor);
    if (advisor) {
      localStorage.setItem('advisor', JSON.stringify(advisor));
      router.push('/portal');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('admin_token', data.token);
        router.push('/admin');
      } else {
        setError('Invalid admin password');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Group advisors by group
  const advisorsByGroup = advisors.reduce((acc, advisor) => {
    const groupName = advisor.group?.name || 'Other';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(advisor);
    return acc;
  }, {} as Record<string, typeof advisors>);

  return (
    <div className="card p-8 max-w-md w-full mx-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">
          <span className="text-[#6AC0E5]">POWER</span>
          <span className="text-[#CCBFBC]">MAILERS</span>
        </h1>
        <p className="text-gray-600 mt-2">Sign in to manage your seminars</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setMode('client')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'client' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
          }`}
        >
          Client Portal
        </button>
        <button
          onClick={() => setMode('admin')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'admin' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
          }`}
        >
          Admin
        </button>
      </div>

      {mode === 'client' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Advisor
            </label>
            <select
              value={selectedAdvisor}
              onChange={(e) => setSelectedAdvisor(e.target.value)}
              className="input"
            >
              <option value="">Choose an advisor...</option>
              {Object.entries(advisorsByGroup).map(([groupName, groupAdvisors]) => (
                <optgroup key={groupName} label={groupName}>
                  {groupAdvisors.map(advisor => (
                    <option key={advisor.advisor_id} value={advisor.advisor_id}>
                      {advisor.advisor_name} — {advisor.company_name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            onClick={handleClientLogin}
            className="w-full btn btn-primary py-3"
          >
            Sign In as Client
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Testing mode — select any advisor to login
          </p>
        </div>
      ) : (
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="input"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary py-3"
          >
            {loading ? 'Signing in...' : 'Sign In as Admin'}
          </button>

          {/* Quick admin bypass for testing */}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('admin_token', 'demo_admin_token');
              router.push('/admin');
            }}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Skip → Demo Admin
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDF1EC]">
      <Suspense fallback={
        <div className="card p-8 max-w-md w-full mx-4 text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
