'use client';

/**
 * Tenant Picker for Think Tank Admin (v7.52.0)
 *
 * Since Think Tank Admin is now a GLOBAL platform app accessible only by
 * Pool B super_admin users, they need a way to select which tenant's
 * Think Tank configuration they are viewing/modifying.
 *
 * The picker:
 *   1. Fetches the list of all tenants from the admin API
 *   2. Allows searching/filtering tenants
 *   3. Stores selected tenant in sessionStorage + context
 *   4. Passes X-Tenant-Id header on all API calls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, ChevronDown, Search, Check, Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: string;
  status: 'active' | 'suspended' | 'pending';
  userCount: number;
}

interface TenantPickerProps {
  onTenantChange?: (tenant: Tenant | null) => void;
}

// =============================================================================
// Tenant Context (shared across the app)
// =============================================================================

const STORAGE_KEY = 'tt_admin_selected_tenant';

export function getSelectedTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.id || null;
  } catch {
    return null;
  }
}

export function getSelectedTenant(): Tenant | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function persistSelectedTenant(tenant: Tenant | null): void {
  if (typeof window === 'undefined') return;
  if (tenant) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// =============================================================================
// Component
// =============================================================================

export function TenantPicker({ onTenantChange }: TenantPickerProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load tenants from API
  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const token = typeof window !== 'undefined'
        ? JSON.parse(sessionStorage.getItem('tt_admin_session') || '{}')?.accessToken
        : null;

      const response = await fetch(`${API_URL}/api/v1/admin/tenants?limit=200&status=active`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        const tenantList = (data.tenants || data.data || []).map((t: any) => ({
          id: t.id,
          name: t.name || t.display_name || t.organization_name || t.id,
          slug: t.slug || t.organization_slug || '',
          tier: t.tier || t.subscription_tier || 'FREE',
          status: t.status || 'active',
          userCount: t.user_count || t.userCount || 0,
        }));
        setTenants(tenantList);
      }
    } catch (err) {
      console.warn('[TenantPicker] Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore persisted selection on mount
  useEffect(() => {
    const stored = getSelectedTenant();
    if (stored) {
      setSelectedTenant(stored);
    }
    loadTenants();
  }, [loadTenants]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    persistSelectedTenant(tenant);
    setIsOpen(false);
    setSearch('');
    onTenantChange?.(tenant);
  };

  const handleClear = () => {
    setSelectedTenant(null);
    persistSelectedTenant(null);
    onTenantChange?.(null);
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.id.includes(search)
  );

  const tierColors: Record<string, string> = {
    FREE: 'text-slate-400',
    STARTER: 'text-blue-400',
    PRO: 'text-violet-400',
    SCALE: 'text-amber-400',
    ENTERPRISE: 'text-emerald-400',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-sm ${
          selectedTenant
            ? 'border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20'
            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
        }`}
      >
        <Building2 className="h-4 w-4 text-violet-400 flex-shrink-0" />
        <span className="max-w-[180px] truncate">
          {selectedTenant ? selectedTenant.name : 'Select Tenant'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search tenants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white/[0.06] border border-white/10 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Tenant List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {search ? 'No tenants match your search' : 'No tenants available'}
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelect(tenant)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className={tierColors[tenant.tier] || 'text-slate-400'}>{tenant.tier}</span>
                      <span>&middot;</span>
                      <span>{tenant.userCount} users</span>
                    </div>
                  </div>
                  {selectedTenant?.id === tenant.id && (
                    <Check className="h-4 w-4 text-violet-400 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {selectedTenant && (
            <div className="p-2 border-t border-white/10">
              <button
                onClick={handleClear}
                className="w-full text-xs text-muted-foreground hover:text-white transition-colors py-1"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
