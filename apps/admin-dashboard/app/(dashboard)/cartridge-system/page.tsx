'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Upload,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Play,
  Trash2,
} from 'lucide-react';
import {
  useCartridgeSystemList,
  useCartridgeUpload,
  useCartridgeValidate,
  useCartridgeInstall,
  useCartridgeUninstall,
} from '@/lib/hooks/use-cartridge-system';

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  uploaded: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  validating: { variant: 'secondary', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  validated: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  active: { variant: 'default', icon: <Play className="h-3 w-3" /> },
  installed: { variant: 'default', icon: <Package className="h-3 w-3" /> },
  archived: { variant: 'outline', icon: <Trash2 className="h-3 w-3" /> },
};

const TYPE_COLORS: Record<string, string> = {
  firmware: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  base: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  domain: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  tenant: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  community: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  personality: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  knowledge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  soft_rom: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function CartridgeSystemPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    display_name: '',
    version: '1.0.0',
    cartridge_type: 'domain',
    targets: ['omega'],
    description: '',
  });

  const filters: Record<string, string> = {};
  if (typeFilter !== 'all') filters.type = typeFilter;
  if (statusFilter !== 'all') filters.status = statusFilter;

  const { data, isLoading, refetch } = useCartridgeSystemList(
    Object.keys(filters).length > 0 ? filters : undefined
  );
  const uploadMutation = useCartridgeUpload();
  const validateMutation = useCartridgeValidate();
  const installMutation = useCartridgeInstall();
  const uninstallMutation = useCartridgeUninstall();

  const cartridges = data?.cartridges || [];

  const handleUpload = async () => {
    try {
      const result = await uploadMutation.mutateAsync(uploadForm);
      setShowUploadDialog(false);
      setUploadForm({ name: '', display_name: '', version: '1.0.0', cartridge_type: 'domain', targets: ['omega'], description: '' });
      window.open(result.upload_url, '_blank');
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Universal Cartridge System</h1>
          <p className="text-muted-foreground mt-1">
            Manage .RADz portable AI intelligence packages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Cartridge
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="firmware">Firmware</SelectItem>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="domain">Domain</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
            <SelectItem value="community">Community</SelectItem>
            <SelectItem value="personality">Personality</SelectItem>
            <SelectItem value="knowledge">Knowledge</SelectItem>
            <SelectItem value="soft_rom">Soft ROM</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="validating">Validating</SelectItem>
            <SelectItem value="validated">Validated</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cartridges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No cartridges found</p>
            <p className="text-muted-foreground">Upload your first .RADz cartridge to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cartridges.map((cart) => {
            const statusBadge = STATUS_BADGES[cart.status] || STATUS_BADGES.uploaded;
            const typeClass = TYPE_COLORS[cart.cartridge_type] || '';

            return (
              <Card key={cart.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{cart.display_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs">{cart.name}@{cart.version}</span>
                      </CardDescription>
                    </div>
                    <Badge variant={statusBadge.variant} className="flex items-center gap-1 ml-2">
                      {statusBadge.icon}
                      {cart.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeClass}`}>
                      {cart.cartridge_type}
                    </span>
                    {cart.targets.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Size</span>
                      <span>{formatBytes(cart.total_size_bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sections</span>
                      <span>{cart.sections_present?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Signature</span>
                      <span className="flex items-center gap-1">
                        {cart.signature_valid ? (
                          <><Shield className="h-3 w-3 text-green-500" /> Valid</>
                        ) : (
                          <><AlertTriangle className="h-3 w-3 text-yellow-500" /> Unsigned</>
                        )}
                      </span>
                    </div>
                    {cart.install_count !== undefined && (
                      <div className="flex justify-between">
                        <span>Installations</span>
                        <span>{cart.install_count}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    {cart.status === 'uploaded' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => validateMutation.mutate(cart.id)}
                        disabled={validateMutation.isPending}
                      >
                        Validate
                      </Button>
                    )}
                    {cart.status === 'validated' && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => installMutation.mutate({ cartridgeId: cart.id })}
                        disabled={installMutation.isPending}
                      >
                        Install
                      </Button>
                    )}
                    {cart.status === 'active' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => uninstallMutation.mutate(cart.id)}
                        disabled={uninstallMutation.isPending}
                      >
                        Uninstall
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Cartridge</DialogTitle>
            <DialogDescription>
              Register a new .RADz cartridge. You will receive a pre-signed URL to upload the file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cart-name">Internal Name</Label>
              <Input
                id="cart-name"
                placeholder="medical-cortex-v2"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cart-display">Display Name</Label>
              <Input
                id="cart-display"
                placeholder="Medical CORTEX v2"
                value={uploadForm.display_name}
                onChange={(e) => setUploadForm({ ...uploadForm, display_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cart-version">Version</Label>
                <Input
                  id="cart-version"
                  placeholder="1.0.0"
                  value={uploadForm.version}
                  onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={uploadForm.cartridge_type}
                  onValueChange={(v) => setUploadForm({ ...uploadForm, cartridge_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                    <SelectItem value="personality">Personality</SelectItem>
                    <SelectItem value="knowledge">Knowledge</SelectItem>
                    <SelectItem value="firmware">Firmware</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Target Services</Label>
              <div className="flex flex-wrap gap-2">
                {['omega', 'cortex', 'cato', 'tenant', 'global'].map((target) => (
                  <Button
                    key={target}
                    variant={uploadForm.targets.includes(target) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const targets = uploadForm.targets.includes(target)
                        ? uploadForm.targets.filter((t) => t !== target)
                        : [...uploadForm.targets, target];
                      setUploadForm({ ...uploadForm, targets });
                    }}
                  >
                    {target}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cart-desc">Description</Label>
              <Input
                id="cart-desc"
                placeholder="Optional description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadForm.name || !uploadForm.display_name || uploadForm.targets.length === 0 || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Creating...' : 'Get Upload URL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
