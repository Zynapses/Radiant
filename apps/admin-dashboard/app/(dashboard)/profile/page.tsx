'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Send,
  Bell,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Star,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContactType = 'email' | 'phone';
type ContactLabel = 'work' | 'personal' | 'on_call' | 'backup' | 'custom';
type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'expired';

interface UserContact {
  id: string;
  contactType: ContactType;
  label: ContactLabel;
  customLabel?: string;
  value: string;
  countryCode?: string;
  isPrimary: boolean;
  isLoginContact: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  verificationAttempts: number;
  verificationExpiresAt?: string;
}

interface UserProfile {
  userId: string;
  bio?: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  profileComplete: boolean;
  contacts: UserContact[];
}

interface ContactRoute {
  id: string;
  alertCategory: string;
  minSeverity: number;
  contactId: string;
  contactSnapshot: { contactType: ContactType; value: string; label: string };
  enabled: boolean;
}

type TabKey = 'profile' | 'contacts' | 'alert-routing';

const API_BASE = '/api/profile';

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  verified: 'text-green-400',
  pending: 'text-yellow-400',
  unverified: 'text-slate-500',
  expired: 'text-red-400',
};

const VERIFICATION_ICONS: Record<VerificationStatus, typeof CheckCircle> = {
  verified: CheckCircle,
  pending: Clock,
  unverified: XCircle,
  expired: AlertTriangle,
};

const ALERT_CATEGORIES = [
  { value: '*', label: 'All Categories' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'security', label: 'Security' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'application', label: 'Application' },
  { value: 'ai_model', label: 'AI / Model' },
  { value: 'data', label: 'Data' },
  { value: 'billing', label: 'Billing' },
  { value: 'performance', label: 'Performance' },
  { value: 'availability', label: 'Availability' },
  { value: 'tenant', label: 'Tenant' },
];

const SEVERITY_OPTIONS = [
  { value: 1, label: 'SEV 1 — Critical', color: 'text-red-400' },
  { value: 2, label: 'SEV 2 — Major', color: 'text-orange-400' },
  { value: 3, label: 'SEV 3 — Moderate', color: 'text-yellow-400' },
  { value: 4, label: 'SEV 4 — Low', color: 'text-blue-400' },
  { value: 5, label: 'SEV 5 — Info', color: 'text-slate-400' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [routes, setRoutes] = useState<ContactRoute[]>([]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(API_BASE);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sentinel/routes`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch (err) {
      console.error('Routes fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchRoutes();
  }, [fetchProfile, fetchRoutes]);

  const tabs: { key: TabKey; label: string; icon: typeof User; badge?: string }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    {
      key: 'contacts',
      label: 'Contacts',
      icon: Phone,
      badge: profile ? `${profile.contacts.length}/6` : undefined,
    },
    { key: 'alert-routing', label: 'Alert Routing', icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-indigo-600 rounded-lg"><User className="h-7 w-7" /></span>
            My Profile
          </h1>
          <p className="text-slate-400 mt-1">Manage your contacts, verification, and alert routing</p>
        </div>
        {profile && !profile.profileComplete && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-medium">Profile incomplete — verify phone &amp; email</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && profile && <ProfileTab profile={profile} onUpdate={fetchProfile} />}
      {activeTab === 'contacts' && profile && <ContactsTab contacts={profile.contacts} onUpdate={fetchProfile} />}
      {activeTab === 'alert-routing' && profile && (
        <AlertRoutingTab routes={routes} contacts={profile.contacts} onUpdate={fetchRoutes} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Tab
// ---------------------------------------------------------------------------

function ProfileTab({ profile, onUpdate }: { profile: UserProfile; onUpdate: () => void }) {
  const [bio, setBio] = useState(profile.bio || '');
  const [timezone, setTimezone] = useState(profile.timezone);
  const [locale, setLocale] = useState(profile.locale);
  const [dateFormat, setDateFormat] = useState(profile.dateFormat);
  const [timeFormat, setTimeFormat] = useState(profile.timeFormat);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, timezone, locale, dateFormat, timeFormat }),
      });
      onUpdate();
    } catch (err) {
      console.error('Profile save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Completion Status */}
      <div className={`p-4 rounded-lg border ${profile.profileComplete ? 'bg-green-600/10 border-green-500/20' : 'bg-yellow-600/10 border-yellow-500/20'}`}>
        <div className="flex items-center gap-3">
          {profile.profileComplete ? (
            <CheckCircle className="h-5 w-5 text-green-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          )}
          <div>
            <div className={`text-sm font-medium ${profile.profileComplete ? 'text-green-300' : 'text-yellow-300'}`}>
              {profile.profileComplete ? 'Profile Complete' : 'Profile Incomplete'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Email verified: {profile.emailVerified ? '✅' : '❌'} | Phone verified: {profile.phoneVerified ? '✅' : '❌'}
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Bio</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          rows={3}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder="Tell us about yourself..."
        />
      </div>

      {/* Timezone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'].map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Locale</label>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            {['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP', 'zh-CN', 'es-ES', 'pt-BR'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date/Time Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Date Format</label>
          <select
            value={dateFormat}
            onChange={e => setDateFormat(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Time Format</label>
          <select
            value={timeFormat}
            onChange={e => setTimeFormat(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="12h">12-hour (AM/PM)</option>
            <option value="24h">24-hour</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts Tab
// ---------------------------------------------------------------------------

function ContactsTab({ contacts, onUpdate }: { contacts: UserContact[]; onUpdate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<ContactType>('email');
  const [addValue, setAddValue] = useState('');
  const [addLabel, setAddLabel] = useState<ContactLabel>('work');
  const [addCountry, setAddCountry] = useState('US');
  const [addPrimary, setAddPrimary] = useState(false);
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [sendingCodeId, setSendingCodeId] = useState<string | null>(null);

  const emails = contacts.filter(c => c.contactType === 'email');
  const phones = contacts.filter(c => c.contactType === 'phone');

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactType: addType,
          value: addValue,
          label: addLabel,
          countryCode: addType === 'phone' ? addCountry : undefined,
          isPrimary: addPrimary,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddValue('');
        onUpdate();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Add contact error:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleSendCode = async (contactId: string) => {
    setSendingCodeId(contactId);
    try {
      const res = await fetch(`${API_BASE}/contacts/${contactId}/send-code`, { method: 'POST' });
      if (res.ok) {
        setVerifyingId(contactId);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Send code error:', err);
    } finally {
      setSendingCodeId(null);
    }
  };

  const handleVerify = async (contactId: string) => {
    try {
      const res = await fetch(`${API_BASE}/contacts/${contactId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerifyingId(null);
        setVerifyCode('');
        onUpdate();
      } else {
        alert(`Verification failed: ${data.error || 'Invalid code'}. Attempts remaining: ${data.attemptsRemaining}`);
      }
    } catch (err) {
      console.error('Verify error:', err);
    }
  };

  const handleRemove = async (contactId: string) => {
    if (!confirm('Remove this contact? Any SENTINEL alert routes using it will also be removed.')) return;
    try {
      const res = await fetch(`${API_BASE}/contacts/${contactId}`, { method: 'DELETE' });
      if (res.ok) {
        onUpdate();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Remove contact error:', err);
    }
  };

  const renderContact = (contact: UserContact) => {
    const StatusIcon = VERIFICATION_ICONS[contact.verificationStatus];
    return (
      <div key={contact.id} className="flex items-center gap-3 p-3 bg-slate-900/50 border border-white/5 rounded-lg">
        <div className="flex-shrink-0">
          {contact.contactType === 'email' ? (
            <Mail className="h-5 w-5 text-blue-400" />
          ) : (
            <Phone className="h-5 w-5 text-green-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium truncate">{contact.value}</span>
            {contact.isPrimary && (
              <Star className="h-3 w-3 text-yellow-400 flex-shrink-0" />
            )}
            {contact.isLoginContact && (
              <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded flex-shrink-0">Login</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{contact.label}</span>
            <StatusIcon className={`h-3 w-3 ${VERIFICATION_COLORS[contact.verificationStatus]}`} />
            <span className={`text-xs ${VERIFICATION_COLORS[contact.verificationStatus]}`}>
              {contact.verificationStatus}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {contact.verificationStatus !== 'verified' && (
            <button
              onClick={() => handleSendCode(contact.id)}
              disabled={sendingCodeId === contact.id}
              className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
              title="Send verification code"
            >
              {sendingCodeId === contact.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          )}
          {!contact.isLoginContact && (
            <button
              onClick={() => handleRemove(contact.id)}
              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              title="Remove contact"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* Verification input */}
        {verifyingId === contact.id && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="text"
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              className="w-24 bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-white text-center tracking-wider focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => handleVerify(contact.id)}
              disabled={verifyCode.length !== 6}
              className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Email contacts */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-400" />
            Email Addresses ({emails.length}/3)
          </h3>
        </div>
        <div className="space-y-2">
          {emails.map(renderContact)}
          {emails.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No email contacts added</p>
          )}
        </div>
      </div>

      {/* Phone contacts */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-400" />
            Phone Numbers ({phones.length}/3)
          </h3>
        </div>
        <div className="space-y-2">
          {phones.map(renderContact)}
          {phones.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No phone numbers added — at least one verified phone is required for MFA</p>
          )}
        </div>
      </div>

      {/* Add Contact */}
      {contacts.length < 6 && (
        <div>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          ) : (
            <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white">Add New Contact</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Type</label>
                  <select
                    value={addType}
                    onChange={e => setAddType(e.target.value as ContactType)}
                    className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white"
                  >
                    <option value="email" disabled={emails.length >= 3}>Email {emails.length >= 3 ? '(max reached)' : ''}</option>
                    <option value="phone" disabled={phones.length >= 3}>Phone {phones.length >= 3 ? '(max reached)' : ''}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Label</label>
                  <select
                    value={addLabel}
                    onChange={e => setAddLabel(e.target.value as ContactLabel)}
                    className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white"
                  >
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="on_call">On-Call</option>
                    <option value="backup">Backup</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                {addType === 'phone' && (
                  <div className="w-20">
                    <label className="block text-xs text-slate-400 mb-1">Country</label>
                    <select
                      value={addCountry}
                      onChange={e => setAddCountry(e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white"
                    >
                      <option value="US">US</option>
                      <option value="GB">GB</option>
                      <option value="DE">DE</option>
                      <option value="FR">FR</option>
                      <option value="JP">JP</option>
                      <option value="AU">AU</option>
                      <option value="CA">CA</option>
                    </select>
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">
                    {addType === 'email' ? 'Email Address' : 'Phone Number (E.164)'}
                  </label>
                  <input
                    type={addType === 'email' ? 'email' : 'tel'}
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    placeholder={addType === 'email' ? 'alice@company.com' : '+15551234567'}
                    className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={addPrimary}
                  onChange={e => setAddPrimary(e.target.checked)}
                  className="rounded border-white/20"
                />
                Set as primary {addType}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={adding || !addValue}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Contact'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddValue(''); }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert Routing Tab
// ---------------------------------------------------------------------------

function AlertRoutingTab({ routes, contacts, onUpdate }: {
  routes: ContactRoute[];
  contacts: UserContact[];
  onUpdate: () => void;
}) {
  const verifiedContacts = contacts.filter(c => c.verificationStatus === 'verified');
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState('*');
  const [newSeverity, setNewSeverity] = useState(3);
  const [newContactId, setNewContactId] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddRoute = async () => {
    if (!newContactId) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/sentinel/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertCategory: newCategory, minSeverity: newSeverity, contactId: newContactId }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewContactId('');
        onUpdate();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Add route error:', err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await fetch(`${API_BASE}/sentinel/routes/${routeId}`, { method: 'DELETE' });
      onUpdate();
    } catch (err) {
      console.error('Delete route error:', err);
    }
  };

  const handleToggleRoute = async (routeId: string, enabled: boolean) => {
    try {
      await fetch(`${API_BASE}/sentinel/routes/${routeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      onUpdate();
    } catch (err) {
      console.error('Toggle route error:', err);
    }
  };

  // Coverage analysis
  const allCategories = ALERT_CATEGORIES.filter(c => c.value !== '*').map(c => c.value);
  const coveredCategories = new Set(routes.filter(r => r.enabled).map(r => r.alertCategory));
  const hasWildcard = coveredCategories.has('*');
  const uncoveredCategories = hasWildcard ? [] : allCategories.filter(c => !coveredCategories.has(c));
  const hasSev1Coverage = routes.some(r => r.enabled && r.minSeverity >= 1);

  return (
    <div className="space-y-6">
      {/* Coverage Summary */}
      <div className={`p-4 rounded-lg border ${hasSev1Coverage && uncoveredCategories.length === 0 ? 'bg-green-600/10 border-green-500/20' : 'bg-yellow-600/10 border-yellow-500/20'}`}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Alert Routing Coverage</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Active Routes</span>
            <div className="text-white font-medium">{routes.filter(r => r.enabled).length} / {routes.length}</div>
          </div>
          <div>
            <span className="text-slate-500">SEV 1 Coverage</span>
            <div className={hasSev1Coverage ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
              {hasSev1Coverage ? '✅ Covered' : '❌ Not covered'}
            </div>
          </div>
          <div>
            <span className="text-slate-500">Uncovered Categories</span>
            <div className={uncoveredCategories.length === 0 ? 'text-green-400 font-medium' : 'text-yellow-400 font-medium'}>
              {uncoveredCategories.length === 0 ? '✅ All covered' : uncoveredCategories.join(', ')}
            </div>
          </div>
        </div>
      </div>

      {verifiedContacts.length === 0 && (
        <div className="bg-yellow-600/10 border border-yellow-500/20 rounded-lg p-4 text-center">
          <AlertTriangle className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-yellow-300 text-sm font-medium">No verified contacts</p>
          <p className="text-slate-400 text-xs mt-1">Verify at least one email or phone before creating alert routes</p>
        </div>
      )}

      {/* Routes List */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Routing Rules ({routes.length})</h3>
          {verifiedContacts.length > 0 && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Rule
            </button>
          )}
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="p-3 border-b border-white/10 bg-slate-900/30 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                >
                  {ALERT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Min Severity</label>
                <select
                  value={newSeverity}
                  onChange={e => setNewSeverity(parseInt(e.target.value))}
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                >
                  {SEVERITY_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Send To</label>
                <select
                  value={newContactId}
                  onChange={e => setNewContactId(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="">Select contact...</option>
                  {verifiedContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contactType === 'phone' ? '📱' : '📧'} {c.label}: {c.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddRoute}
                disabled={adding || !newContactId}
                className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Create Rule'}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-2 py-1 bg-slate-700 text-white text-xs rounded">Cancel</button>
            </div>
          </div>
        )}

        {/* Route rows */}
        <div className="divide-y divide-white/5">
          {routes.map(route => (
            <div key={route.id} className="p-3 flex items-center gap-3 hover:bg-slate-900/30">
              <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Category</span>
                  <div className="text-white font-medium">
                    {route.alertCategory === '*' ? 'All' : route.alertCategory}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Min Severity</span>
                  <div className={SEVERITY_OPTIONS.find(s => s.value === route.minSeverity)?.color || 'text-white'}>
                    SEV {route.minSeverity}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Send To</span>
                  <div className="text-white flex items-center gap-1">
                    {route.contactSnapshot.contactType === 'phone' ? (
                      <Phone className="h-3 w-3 text-green-400" />
                    ) : (
                      <Mail className="h-3 w-3 text-blue-400" />
                    )}
                    <span className="truncate">{route.contactSnapshot.value}</span>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={route.enabled}
                  onChange={e => handleToggleRoute(route.id, e.target.checked)}
                  className="rounded border-white/20"
                />
                {route.enabled ? 'On' : 'Off'}
              </label>
              <button
                onClick={() => handleDeleteRoute(route.id)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {routes.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
              No alert routing rules configured. Add rules to receive SENTINEL alerts on specific contacts.
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-slate-800/30 border border-white/5 rounded-lg p-4 text-xs text-slate-400">
        <h4 className="text-slate-300 font-medium mb-2">How Alert Routing Works</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li>When SENTINEL fires an alert, it checks your routing rules</li>
          <li>Rules match by <strong>category</strong> (or &quot;All&quot;) and <strong>minimum severity</strong></li>
          <li>Matching contacts receive SMS (phone) or email directly</li>
          <li>This is <strong>in addition to</strong> PagerDuty/Slack escalation — your personal routing</li>
          <li>Only <strong>verified contacts</strong> can be used in routing rules</li>
        </ul>
      </div>
    </div>
  );
}
