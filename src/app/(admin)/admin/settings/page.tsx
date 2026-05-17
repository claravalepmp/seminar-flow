'use client';

import { useState } from 'react';
import { 
  User, Bell, Shield, Database, Mail, Palette, 
  Check, ChevronRight, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsSections = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Manage your account settings',
    icon: User,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Configure email and push notifications',
    icon: Bell,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect to Airtable, Google Sheets, and more',
    icon: Database,
  },
  {
    id: 'email',
    title: 'Email Templates',
    description: 'Customize email templates for clients',
    icon: Mail,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize the dashboard look and feel',
    icon: Palette,
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Manage access and permissions',
    icon: Shield,
  },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 mt-1">Manage your preferences</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
            <nav className="p-2">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                    activeSection === section.id
                      ? 'bg-violet-500/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                >
                  <section.icon className={cn(
                    'w-5 h-5',
                    activeSection === section.id ? 'text-violet-400' : 'text-white/40'
                  )} />
                  <span className="font-medium">{section.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeSection === 'profile' && <ProfileSettings />}
          {activeSection === 'notifications' && <NotificationSettings />}
          {activeSection === 'integrations' && <IntegrationSettings />}
          {activeSection === 'email' && <EmailSettings />}
          {activeSection === 'appearance' && <AppearanceSettings />}
          {activeSection === 'security' && <SecuritySettings />}
        </div>
      </div>
    </div>
  );
}

function ProfileSettings() {
  return (
    <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="font-semibold text-white">Profile Settings</h2>
        <p className="text-white/40 text-sm mt-1">Manage your account information</p>
      </div>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">PMP</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Power Mailers Plus</h3>
            <p className="text-white/40 text-sm">Admin Account</p>
            <button className="text-violet-400 text-sm font-medium mt-2 hover:text-violet-300">
              Change avatar
            </button>
          </div>
        </div>
        
        <div className="grid gap-4">
          <InputField label="Company Name" value="Power Mailers Plus" />
          <InputField label="Email" value="admin@powermailers.com" type="email" />
          <InputField label="Phone" value="(555) 123-4567" type="tel" />
        </div>
        
        <button className="px-4 py-2 bg-violet-500 text-white rounded-xl font-medium text-sm hover:bg-violet-600 transition">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="font-semibold text-white">Notification Settings</h2>
        <p className="text-white/40 text-sm mt-1">Choose what you want to be notified about</p>
      </div>
      <div className="p-6 space-y-4">
        <ToggleSetting 
          label="New Order Alerts" 
          description="Get notified when a new order is placed"
          defaultOn
        />
        <ToggleSetting 
          label="Urgent Deadline Reminders" 
          description="Reminders for events within 14 days"
          defaultOn
        />
        <ToggleSetting 
          label="Proof Approvals" 
          description="When a client approves or requests changes"
          defaultOn
        />
        <ToggleSetting 
          label="Weekly Summary" 
          description="Weekly overview of all activity"
        />
      </div>
    </div>
  );
}

function IntegrationSettings() {
  return (
    <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="font-semibold text-white">Integrations</h2>
        <p className="text-white/40 text-sm mt-1">Connect external services</p>
      </div>
      <div className="p-6 space-y-4">
        <IntegrationItem 
          name="Airtable" 
          description="Database for orders and advisors"
          connected
        />
        <IntegrationItem 
          name="Google Sheets" 
          description="Sync data from spreadsheets"
          connected
        />
        <IntegrationItem 
          name="Slack" 
          description="Team notifications"
        />
        <IntegrationItem 
          name="Zapier" 
          description="Automation workflows"
        />
      </div>
    </div>
  );
}

function EmailSettings() {
  return (
    <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="font-semibold text-white">Email Templates</h2>
        <p className="text-white/40 text-sm mt-1">Customize client communications</p>
      </div>
      <div className="p-6 space-y-4">
        <TemplateItem name="Order Confirmation" lastEdited="2 days ago" />
        <TemplateItem name="Proof Ready" lastEdited="1 week ago" />
        <TemplateItem name="Event Reminder" lastEdited="3 days ago" />
        <TemplateItem name="Campaign Complete" lastEdited="2 weeks ago" />
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="font-semibold text-white">Appearance</h2>
        <p className="text-white/40 text-sm mt-1">Customize the look and feel</p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">Theme</label>
          <div className="flex gap-3">
            <button className="w-20 h-14 rounded-xl bg-[#0f0f12] border-2 border-violet-500 flex items-center justify-center">
              <Check className="w-5 h-5 text-violet-400" />
            </button>
            <button className="w-20 h-14 rounded-xl bg-white border border-white/20 opacity-50 cursor-not-allowed" />
          </div>
          <p className="text-xs text-white/40 mt-2">Light mode coming soon</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-white/80 mb-3">Accent Color</label>
          <div className="flex gap-3">
            <button className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 border-2 border-white/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </button>
            <button className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500" />
            <button className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500" />
            <button className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="bg-[#1a1a24] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="font-semibold text-white">Security</h2>
        <p className="text-white/40 text-sm mt-1">Manage access and permissions</p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-white/80 mb-3">Password</h3>
          <button className="px-4 py-2 bg-white/5 text-white/80 rounded-xl text-sm font-medium hover:bg-white/10 transition">
            Change Password
          </button>
        </div>
        
        <ToggleSetting 
          label="Two-Factor Authentication" 
          description="Add an extra layer of security"
        />
        
        <div>
          <h3 className="text-sm font-medium text-white/80 mb-3">Sessions</h3>
          <p className="text-white/40 text-sm">You're currently logged in on 1 device</p>
          <button className="text-rose-400 text-sm font-medium mt-2 hover:text-rose-300">
            Sign out all devices
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, type = 'text' }: { label: string; value: string; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/60 mb-2">{label}</label>
      <input
        type={type}
        defaultValue={value}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition"
      />
    </div>
  );
}

function ToggleSetting({ label, description, defaultOn }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn || false);
  
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-white/40 text-sm">{description}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          'w-12 h-7 rounded-full transition-all',
          on ? 'bg-violet-500' : 'bg-white/10'
        )}
      >
        <div className={cn(
          'w-5 h-5 rounded-full bg-white transition-all',
          on ? 'translate-x-6' : 'translate-x-1'
        )} />
      </button>
    </div>
  );
}

function IntegrationItem({ name, description, connected }: { name: string; description: string; connected?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <Database className="w-5 h-5 text-white/40" />
        </div>
        <div>
          <p className="text-white font-medium">{name}</p>
          <p className="text-white/40 text-sm">{description}</p>
        </div>
      </div>
      {connected ? (
        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium">
          Connected
        </span>
      ) : (
        <button className="px-3 py-1 bg-white/5 text-white/60 rounded-lg text-xs font-medium hover:bg-white/10 transition">
          Connect
        </button>
      )}
    </div>
  );
}

function TemplateItem({ name, lastEdited }: { name: string; lastEdited: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group cursor-pointer hover:bg-white/[0.02] -mx-6 px-6">
      <div>
        <p className="text-white font-medium">{name}</p>
        <p className="text-white/40 text-sm">Last edited {lastEdited}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-violet-400 transition" />
    </div>
  );
}
