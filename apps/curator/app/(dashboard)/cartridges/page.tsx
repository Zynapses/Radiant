'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Download, 
  Upload, 
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertTriangle,
  Shield,
  Thermometer,
  Eye,
  Trash2,
  RefreshCw,
  FileText,
  Brain,
  Zap,
  Globe,
  Lock,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface Cartridge {
  id: string;
  name: string;
  description?: string;
  version: string;
  scope: 'system' | 'tenant' | 'user';
  status: 'active' | 'archived' | 'draft';
  category: 'general' | 'domain_expert';
  thermalState: 'cold' | 'warming' | 'warm' | 'hot';
  domains: string[];
  hasLoraAdapters: boolean;
  hasCuratorKnowledge: boolean;
  hasGhostCompression: boolean;
  hasDomainExperts: boolean;
  fileSizeBytes?: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  isSigned: boolean;
  signedAt?: string;
  signedBy?: string;
  tags: string[];
}

interface CartridgeDashboard {
  totalCartridges: number;
  activeCartridges: number;
  signedCartridges: number;
  pendingVerification: number;
  byScope: {
    system: number;
    tenant: number;
    user: number;
  };
  byThermalState: {
    hot: number;
    warm: number;
    cold: number;
  };
  recentActivity: {
    action: string;
    cartridgeName: string;
    performedBy: string;
    performedAt: string;
  }[];
}

// =============================================================================
// Component
// =============================================================================

export default function CartridgesPage() {
  const [dashboard, setDashboard] = useState<CartridgeDashboard | null>(null);
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'tenant' | 'system'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadCartridges();
  }, [activeTab]);

  async function loadDashboard() {
    try {
      const res = await fetch('/api/curator/cartridges/dashboard');
      if (res.ok) {
        setDashboard(await res.json());
      }
    } catch (error) {
      console.error('Failed to load cartridge dashboard', error);
    }
  }

  async function loadCartridges() {
    setLoading(true);
    try {
      const scope = activeTab === 'my' ? 'user' : activeTab;
      const res = await fetch(`/api/curator/cartridges?scope=${scope}`);
      if (res.ok) {
        const data = await res.json();
        setCartridges(data.cartridges || []);
      }
    } catch (error) {
      console.error('Failed to load cartridges', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportCartridge(id: string) {
    try {
      const res = await fetch(`/api/curator/cartridges/${id}/export`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to export cartridge', error);
    }
  }

  const filteredCartridges = cartridges.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getThermalColor = (state: string) => {
    switch (state) {
      case 'hot': return 'text-red-400 bg-red-400/10';
      case 'warm': return 'text-amber-400 bg-amber-400/10';
      case 'cold': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'system': return <Globe className="w-4 h-4" />;
      case 'tenant': return <Shield className="w-4 h-4" />;
      case 'user': return <Brain className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-curator-gold" />
            Cartridges
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI knowledge packages
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowImportDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import .RADz
          </button>
          <button 
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-curator-gold text-black font-medium hover:bg-curator-gold/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Cartridge
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Package className="w-4 h-4" />
              Total Cartridges
            </div>
            <p className="text-2xl font-bold mt-1">{dashboard.totalCartridges}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle className="w-4 h-4" />
              Active
            </div>
            <p className="text-2xl font-bold mt-1">{dashboard.activeCartridges}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Shield className="w-4 h-4" />
              Signed
            </div>
            <p className="text-2xl font-bold mt-1">{dashboard.signedCartridges}</p>
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Thermometer className="w-4 h-4" />
              Hot
            </div>
            <p className="text-2xl font-bold mt-1 text-red-400">{dashboard.byThermalState.hot}</p>
          </div>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'my' 
                ? 'bg-curator-gold text-black' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Cartridges
          </button>
          <button
            onClick={() => setActiveTab('tenant')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tenant' 
                ? 'bg-curator-gold text-black' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Organization
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'system' 
                ? 'bg-curator-gold text-black' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            System
          </button>
        </div>

        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cartridges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-curator-gold/50"
          />
        </div>
      </div>

      {/* Cartridges Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-slate-900/50 rounded-xl border border-white/5 p-5 animate-pulse">
              <div className="h-6 bg-slate-800 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-800 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : filteredCartridges.length === 0 ? (
        <div className="bg-slate-900/50 rounded-xl border border-white/5 p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Cartridges Found</h3>
          <p className="text-muted-foreground mb-4">
            {activeTab === 'my' 
              ? 'Create your first personal cartridge to save your AI configurations.'
              : activeTab === 'tenant'
              ? 'No organization cartridges available. Contact your admin.'
              : 'No system cartridges available.'}
          </p>
          {activeTab === 'my' && (
            <button 
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-curator-gold text-black font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Cartridge
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCartridges.map((cartridge) => (
            <div 
              key={cartridge.id}
              className="bg-slate-900/50 rounded-xl border border-white/5 p-5 hover:border-curator-gold/30 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getScopeIcon(cartridge.scope)}
                  <span className={`px-2 py-0.5 rounded text-xs ${getThermalColor(cartridge.thermalState)}`}>
                    {cartridge.thermalState}
                  </span>
                  {cartridge.isSigned && (
                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400">
                      <Lock className="w-3 h-3 inline mr-1" />
                      Signed
                    </span>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 hover:bg-slate-800 rounded">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold mb-1">{cartridge.name}</h3>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {cartridge.description || 'No description'}
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                {cartridge.hasLoraAdapters && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-400">
                    LoRA
                  </span>
                )}
                {cartridge.hasCuratorKnowledge && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400">
                    Knowledge
                  </span>
                )}
                {cartridge.hasGhostCompression && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/10 text-cyan-400">
                    Ghost
                  </span>
                )}
                {cartridge.hasDomainExperts && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400">
                    Domain Expert
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>v{cartridge.version}</span>
                <span>{cartridge.domains.length} domains</span>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                <button 
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button 
                  onClick={() => exportCartridge(cartridge.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <ImportCartridgeDialog 
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => {
            setShowImportDialog(false);
            loadCartridges();
            loadDashboard();
          }}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateCartridgeDialog 
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            loadCartridges();
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Import Cartridge Dialog
// =============================================================================

function ImportCartridgeDialog({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [validateSignature, setValidateSignature] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleUpload() {
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('validateSignature', String(validateSignature));

      const res = await fetch('/api/curator/cartridges/import', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Import failed');
      }
    } catch (error) {
      alert('Import failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.radz')) {
      setFile(droppedFile);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-white/10 p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Import Cartridge</h2>
        
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? 'border-curator-gold bg-curator-gold/5' : 'border-white/10'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-8 h-8 text-curator-gold" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-2">
                Drag & drop your .RADz file here
              </p>
              <label className="inline-block px-4 py-2 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                Browse Files
                <input
                  type="file"
                  accept=".radz"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </>
          )}
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={validateSignature}
            onChange={(e) => setValidateSignature(e.target.checked)}
            className="rounded border-white/20"
          />
          <span className="text-sm">Validate cryptographic signature</span>
          <Shield className="w-4 h-4 text-green-400" />
        </label>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 py-2 rounded-lg bg-curator-gold text-black font-medium hover:bg-curator-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Create Cartridge Dialog
// =============================================================================

function CreateCartridgeDialog({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'user' | 'tenant'>('user');
  const [includeCuratorKnowledge, setIncludeCuratorKnowledge] = useState(true);
  const [includeGhostVectors, setIncludeGhostVectors] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/curator/cartridges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          scope,
          hasCuratorKnowledge: includeCuratorKnowledge,
          hasGhostCompression: includeGhostVectors,
          domains: selectedDomains,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Creation failed');
      }
    } catch (error) {
      alert('Creation failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-white/10 p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create Cartridge</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Configuration"
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-curator-gold/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this cartridge contains..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-curator-gold/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Scope</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('user')}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  scope === 'user' 
                    ? 'border-curator-gold bg-curator-gold/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <Brain className="w-4 h-4 mx-auto mb-1" />
                <span className="text-sm">Personal</span>
              </button>
              <button
                onClick={() => setScope('tenant')}
                className={`flex-1 py-2 rounded-lg border transition-colors ${
                  scope === 'tenant' 
                    ? 'border-curator-gold bg-curator-gold/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <Shield className="w-4 h-4 mx-auto mb-1" />
                <span className="text-sm">Organization</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Include</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCuratorKnowledge}
                onChange={(e) => setIncludeCuratorKnowledge(e.target.checked)}
                className="rounded border-white/20"
              />
              <span className="text-sm">Curator Knowledge Graph</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGhostVectors}
                onChange={(e) => setIncludeGhostVectors(e.target.checked)}
                className="rounded border-white/20"
              />
              <span className="text-sm">Ghost Vector Compression</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="flex-1 py-2 rounded-lg bg-curator-gold text-black font-medium hover:bg-curator-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
