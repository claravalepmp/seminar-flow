'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check, Calendar, MapPin, Clock, Users,
  Mail, Monitor, Building2, Heart, Phone, ExternalLink, Loader2,
  Sparkles, CheckCircle2, AlertCircle, FileText, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Form data interface
interface OrderFormData {
  // Step 1: Event Details
  advisorName: string;
  groupName: string;
  classType: string;
  firstEventDate: string;
  secondEventDate: string;
  thirdEventDate: string;
  fourthEventDate: string;
  startTime: string;
  endTime: string;
  // Step 2: Venue & Contact
  venueName: string;
  venueAddress: string;
  charity: string;
  landingPageUrl: string;
  registrationPhone: string;
  // Step 3: Marketing Services
  needsDirectMail: boolean;
  mailingQuantity: number;
  mailerType: string;
  needsDigital: boolean;
  digitalBudget: number;
  notes: string;
}

const initialFormData: OrderFormData = {
  advisorName: '',
  groupName: '',
  classType: '',
  firstEventDate: '',
  secondEventDate: '',
  thirdEventDate: '',
  fourthEventDate: '',
  startTime: '6:00 PM',
  endTime: '8:00 PM',
  venueName: '',
  venueAddress: '',
  charity: '',
  landingPageUrl: '',
  registrationPhone: '',
  needsDirectMail: true,
  mailingQuantity: 8000,
  mailerType: '',
  needsDigital: true,
  digitalBudget: 0,
  notes: '',
};

// Lookups interface
interface Lookups {
  venues: string[];
  charities: string[];
  classTypes: string[];
  groups: string[];
  regions: string[];
}

// Step indicator component
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Event Details' },
    { num: 2, label: 'Venue & Contact' },
    { num: 3, label: 'Marketing Services' },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
              currentStep > step.num
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : currentStep === step.num
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                  : "bg-zinc-800 text-zinc-500"
            )}>
              {currentStep > step.num ? <Check className="w-5 h-5" /> : step.num}
            </div>
            <p className={cn(
              "text-xs mt-2 font-medium transition-colors",
              currentStep >= step.num ? "text-white" : "text-zinc-500"
            )}>
              {step.label}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              "w-16 h-0.5 mx-2 rounded transition-colors mt-[-20px]",
              currentStep > step.num ? "bg-emerald-500" : "bg-zinc-800"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// Form input component
function FormInput({ 
  label, 
  name, 
  value, 
  onChange, 
  type = 'text',
  placeholder,
  required,
  icon: Icon,
  suggestions,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: typeof Calendar;
  suggestions?: string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredSuggestions = suggestions?.filter(s => 
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  ).slice(0, 5);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          required={required}
          className={cn(
            "w-full py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all",
            Icon ? "pl-11 pr-4" : "px-4"
          )}
        />
      </div>
      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
          {filteredSuggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              onClick={() => {
                onChange({ target: { name, value: suggestion } } as any);
                setShowSuggestions(false);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Form select component
function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all cursor-pointer"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

// Form textarea component
function FormTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
      />
    </div>
  );
}

// Toggle switch component
function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
  color = 'violet',
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: typeof Mail;
  color?: 'violet' | 'amber' | 'blue';
}) {
  const colors = {
    violet: 'bg-violet-600',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
  };

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
        checked
          ? "bg-zinc-800/80 border-zinc-700"
          : "bg-zinc-900/30 border-zinc-800/50 opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            checked ? `${colors[color]}/20` : "bg-zinc-800"
          )}>
            <Icon className={cn(
              "w-5 h-5",
              checked ? colors[color].replace('bg-', 'text-') : "text-zinc-500"
            )} />
          </div>
        )}
        <div className="text-left">
          <p className="font-medium text-white">{label}</p>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      <div className={cn(
        "w-12 h-6 rounded-full transition-colors relative",
        checked ? colors[color] : "bg-zinc-700"
      )}>
        <div className={cn(
          "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-7" : "translate-x-1"
        )} />
      </div>
    </button>
  );
}

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load lookups
  useEffect(() => {
    fetch('/api/lookups')
      .then(r => r.json())
      .then(data => setLookups(data))
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleToggle = (name: keyof OrderFormData) => (checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    // Simulate submission - in production this would POST to an API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Show success and redirect
    alert('Order submitted successfully! Our team will review and process your request.');
    router.push('/portal');
  };

  // Validation
  const isStep1Valid = formData.advisorName && formData.firstEventDate && formData.startTime;
  const isStep2Valid = formData.venueName && formData.venueAddress;
  const isStep3Valid = formData.needsDirectMail || formData.needsDigital;

  return (
    <div className="min-h-screen bg-[#08080c]">
      {/* Header */}
      <header className="bg-[#0c0c10]/80 backdrop-blur-xl border-b border-zinc-800/60 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/portal"
              className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all border border-zinc-700/50"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">New Seminar Order</h1>
              <p className="text-xs text-zinc-500">Fill out the details for your upcoming event</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Form Card */}
        <div className="bg-[#12121a] rounded-2xl border border-zinc-800/60 p-8">
          {/* Step 1: Event Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Event Details</h2>
                  <p className="text-sm text-zinc-500">Tell us about your seminar</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormInput
                  label="Advisor Name"
                  name="advisorName"
                  value={formData.advisorName}
                  onChange={handleChange}
                  placeholder="e.g., John Smith"
                  required
                  icon={Users}
                />
                <FormSelect
                  label="Group"
                  name="groupName"
                  value={formData.groupName}
                  onChange={handleChange}
                  options={lookups?.groups || []}
                />
              </div>

              <FormSelect
                label="Class Type"
                name="classType"
                value={formData.classType}
                onChange={handleChange}
                options={lookups?.classTypes || ['R90', 'R101', 'SS101', 'Wealth 101', 'W&T 101']}
                required
              />

              <div className="grid md:grid-cols-2 gap-4">
                <FormInput
                  label="First Event Date"
                  name="firstEventDate"
                  value={formData.firstEventDate}
                  onChange={handleChange}
                  type="date"
                  required
                  icon={Calendar}
                />
                <FormInput
                  label="Second Event Date"
                  name="secondEventDate"
                  value={formData.secondEventDate}
                  onChange={handleChange}
                  type="date"
                  icon={Calendar}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormInput
                  label="Third Event Date"
                  name="thirdEventDate"
                  value={formData.thirdEventDate}
                  onChange={handleChange}
                  type="date"
                  icon={Calendar}
                />
                <FormInput
                  label="Fourth Event Date"
                  name="fourthEventDate"
                  value={formData.fourthEventDate}
                  onChange={handleChange}
                  type="date"
                  icon={Calendar}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormInput
                  label="Start Time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  placeholder="e.g., 6:00 PM"
                  required
                  icon={Clock}
                />
                <FormInput
                  label="End Time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  placeholder="e.g., 8:00 PM"
                  icon={Clock}
                />
              </div>
            </div>
          )}

          {/* Step 2: Venue & Contact */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Venue & Contact</h2>
                  <p className="text-sm text-zinc-500">Where will the seminar be held?</p>
                </div>
              </div>

              <FormInput
                label="Venue Name"
                name="venueName"
                value={formData.venueName}
                onChange={handleChange}
                placeholder="e.g., University Conference Center"
                required
                icon={Building2}
                suggestions={lookups?.venues}
              />

              <FormTextarea
                label="Venue Address"
                name="venueAddress"
                value={formData.venueAddress}
                onChange={handleChange}
                placeholder="Full street address..."
                rows={2}
              />

              <FormInput
                label="Charity Partner"
                name="charity"
                value={formData.charity}
                onChange={handleChange}
                placeholder="e.g., Local Food Bank"
                icon={Heart}
                suggestions={lookups?.charities}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <FormInput
                  label="Landing Page URL"
                  name="landingPageUrl"
                  value={formData.landingPageUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  icon={ExternalLink}
                />
                <FormInput
                  label="Registration Phone"
                  name="registrationPhone"
                  value={formData.registrationPhone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  icon={Phone}
                />
              </div>
            </div>
          )}

          {/* Step 3: Marketing Services */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Marketing Services</h2>
                  <p className="text-sm text-zinc-500">Select the services you need</p>
                </div>
              </div>

              <div className="space-y-4">
                <ToggleSwitch
                  label="Direct Mail Campaign"
                  description="Physical mailers to targeted households"
                  checked={formData.needsDirectMail}
                  onChange={handleToggle('needsDirectMail')}
                  icon={Mail}
                  color="amber"
                />

                {formData.needsDirectMail && (
                  <div className="ml-13 pl-4 border-l-2 border-amber-500/30 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          Mailing Quantity
                        </label>
                        <select
                          name="mailingQuantity"
                          value={formData.mailingQuantity}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
                        >
                          <option value="6000">6,000 pieces</option>
                          <option value="7000">7,000 pieces</option>
                          <option value="8000">8,000 pieces</option>
                          <option value="9000">9,000 pieces</option>
                          <option value="10000">10,000 pieces</option>
                        </select>
                      </div>
                      <FormInput
                        label="Mailer Type"
                        name="mailerType"
                        value={formData.mailerType}
                        onChange={handleChange}
                        placeholder="e.g., FTA R101 Bi-Fold"
                      />
                    </div>
                  </div>
                )}

                <ToggleSwitch
                  label="Digital Advertising"
                  description="Facebook, Google, and targeted online ads"
                  checked={formData.needsDigital}
                  onChange={handleToggle('needsDigital')}
                  icon={Monitor}
                  color="blue"
                />
              </div>

              <FormTextarea
                label="Additional Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any special requests or notes..."
                rows={3}
              />

              {/* Order Summary */}
              <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800/50">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Order Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Advisor</span>
                    <span className="text-white font-medium">{formData.advisorName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">First Event</span>
                    <span className="text-white font-medium">{formData.firstEventDate || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Venue</span>
                    <span className="text-white font-medium truncate ml-4">{formData.venueName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Services</span>
                    <span className="text-white font-medium">
                      {[
                        formData.needsDirectMail && `DM (${(formData.mailingQuantity / 1000).toFixed(0)}k)`,
                        formData.needsDigital && 'Digital'
                      ].filter(Boolean).join(' + ') || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800/50">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all",
                step === 1
                  ? "text-zinc-600 cursor-not-allowed"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
                  (step === 1 ? isStep1Valid : isStep2Valid)
                    ? "bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/30"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isStep3Valid || submitting}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
                  isStep3Valid && !submitting
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Order
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
