'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Boxes,
  RefreshCw,
  Download,
  Shield,
  CheckCircle,
  Package,
} from 'lucide-react';
import {
  useCartridgeSystemList,
  useCartridgeInstall,
} from '@/lib/hooks/use-cartridge-system';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function CartridgeMarketplacePage() {
  const { data, isLoading, refetch } = useCartridgeSystemList({
    status: 'validated',
  });
  const installMutation = useCartridgeInstall();

  const cartridges = data?.cartridges || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartridge Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Browse validated cartridges available for installation
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
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
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cartridges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No cartridges available</p>
            <p className="text-muted-foreground">
              Upload and validate cartridges to make them available here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cartridges.map((cart) => (
            <Card key={cart.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{cart.display_name}</CardTitle>
                <CardDescription>
                  <span className="font-mono text-xs">{cart.name}@{cart.version}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {cart.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">{cart.cartridge_type}</Badge>
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
                    <span>Signed</span>
                    <span className="flex items-center gap-1">
                      {cart.signature_valid ? (
                        <><Shield className="h-3 w-3 text-green-500" /> Verified</>
                      ) : (
                        <span className="text-muted-foreground">Unsigned</span>
                      )}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => installMutation.mutate({ cartridgeId: cart.id })}
                  disabled={installMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
