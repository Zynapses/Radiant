'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, RefreshCw, Plus, UserPlus, Shield, Mail, Clock,
  MoreVertical, Check, X, Search, ChevronDown,
} from 'lucide-react';

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  apps: string[];
  lastActiveAt: string | null;
  createdAt: string;
  mfaEnabled: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  apps: string[];
  status: string;
  sentAt: string;
  expiresAt: string;
}

const API = '/api/tenant-admin/users';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantUsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('standard_user');

  const load = useCallback(async () => {
    try {
      const [usersData, invData] = await Promise.all([
        fetchApi('/list').catch(() => ({ users: [] })),
        fetchApi('/invitations').catch(() => ({ invitations: [] })),
      ]);
      setUsers(usersData.users || usersData || []);
      setInvitations(invData.invitations || invData || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendInvitation = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await fetchApi('/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, apps: ['think_tank'] }),
      });
      setInviteEmail('');
      setShowInviteForm(false);
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const toggleUserStatus = async (userId: string, status: string) => {
    try {
      await fetchApi(`/${userId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const filteredUsers = searchQuery
    ? users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>;
  }

  const activeCount = users.filter(u => u.status === 'active').length;
  const pendingInvites = invitations.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="h-7 w-7 text-violet-400" />
            Team Members
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage users and invitations for your organization</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInviteForm(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
          <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-blue-400" /><span className="text-xs text-slate-400">Total Users</span></div>
          <div className="text-2xl font-bold text-white">{users.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-xs text-slate-400">Active</span></div>
          <div className="text-2xl font-bold text-white">{activeCount}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Mail className="h-4 w-4 text-yellow-400" /><span className="text-xs text-slate-400">Pending Invites</span></div>
          <div className="text-2xl font-bold text-white">{pendingInvites}</div>
        </div>
      </div>

      {showInviteForm && (
        <div className="bg-slate-800/30 border border-violet-700/30 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Invite New User</h3>
          <div className="flex gap-3">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@company.com"
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              <option value="viewer">Viewer</option>
              <option value="standard_user">Standard User</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={sendInvitation} disabled={!inviteEmail.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg">
              Send Invite
            </button>
            <button onClick={() => setShowInviteForm(false)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['users', 'invitations'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'users' ? `Team Members (${users.length})` : `Invitations (${invitations.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users..."
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white" />
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-3 text-slate-400 font-medium">User</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Role</th>
                  <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                  <th className="text-center p-3 text-slate-400 font-medium">MFA</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Apps</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Last Active</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">No users found</td></tr>
                ) : filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/30">
                    <td className="p-3">
                      <div className="text-white font-medium">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="p-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{user.role}</span></td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${user.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {user.mfaEnabled ? <Shield className="h-4 w-4 text-emerald-400 mx-auto" /> : <span className="text-xs text-slate-600">Off</span>}
                    </td>
                    <td className="p-3 text-xs text-slate-400">{user.apps?.join(', ') || '-'}</td>
                    <td className="p-3 text-xs text-slate-400">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : 'Never'}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => toggleUserStatus(user.id, user.status === 'active' ? 'disabled' : 'active')}
                        className={`text-xs px-2 py-1 rounded ${user.status === 'active' ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50' : 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50'}`}>
                        {user.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invitations' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Email</th>
                <th className="text-left p-3 text-slate-400 font-medium">Role</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-left p-3 text-slate-400 font-medium">Sent</th>
                <th className="text-left p-3 text-slate-400 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {invitations.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No invitations</td></tr>
              ) : invitations.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/30">
                  <td className="p-3 text-white">{inv.email}</td>
                  <td className="p-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{inv.role}</span></td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' : inv.status === 'accepted' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-400">{new Date(inv.sentAt).toLocaleDateString()}</td>
                  <td className="p-3 text-xs text-slate-400">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
