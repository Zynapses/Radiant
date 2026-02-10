'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ScrollText,
  RefreshCw,
  Upload,
  Download,
  Shield,
  CheckCircle,
  XCircle,
  Package,
  Layers,
  Trash2,
} from 'lucide-react';
import { useCartridgeAudit } from '@/lib/hooks/use-cartridge-system';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  upload_initiated: <Upload className="h-4 w-4 text-blue-500" />,
  validation_passed: <CheckCircle className="h-4 w-4 text-green-500" />,
  validation_failed: <XCircle className="h-4 w-4 text-red-500" />,
  install_initiated: <Package className="h-4 w-4 text-purple-500" />,
  cartridge_installed: <CheckCircle className="h-4 w-4 text-green-500" />,
  installation_failed: <XCircle className="h-4 w-4 text-red-500" />,
  uninstall_completed: <Trash2 className="h-4 w-4 text-orange-500" />,
  resolution_completed: <Layers className="h-4 w-4 text-cyan-500" />,
  soft_rom_export_initiated: <Download className="h-4 w-4 text-indigo-500" />,
};

const ACTION_COLORS: Record<string, string> = {
  upload_initiated: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  validation_passed: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  validation_failed: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  install_initiated: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  cartridge_installed: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  installation_failed: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  uninstall_completed: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  resolution_completed: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
  soft_rom_export_initiated: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
};

export default function CartridgeAuditPage() {
  const { data, isLoading, refetch } = useCartridgeAudit({ limit: '200' });
  const audit = data?.audit || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartridge Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Complete audit trail for all cartridge operations
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            {audit.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : audit.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No audit entries yet. Actions will appear here as cartridges are managed.
            </p>
          ) : (
            <div className="space-y-2">
              {audit.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {ACTION_ICONS[entry.action] || <Shield className="h-4 w-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${ACTION_COLORS[entry.action] || ''}`}
                      >
                        {entry.action.replace(/_/g, ' ')}
                      </Badge>
                      {entry.cartridge_name && (
                        <span className="text-sm font-medium truncate">
                          {entry.cartridge_name}
                          {entry.cartridge_version && (
                            <span className="text-muted-foreground ml-1">v{entry.cartridge_version}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-hidden text-ellipsis whitespace-nowrap max-w-md">
                        {JSON.stringify(entry.details)}
                      </pre>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
