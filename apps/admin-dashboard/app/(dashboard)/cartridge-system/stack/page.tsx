'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Layers,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  useCartridgeStack,
  useCartridgeResolved,
  useCartridgeReorder,
  useExportSoftRom,
} from '@/lib/hooks/use-cartridge-system';

export default function CartridgeStackPage() {
  const { data: stackData, isLoading: stackLoading, refetch: refetchStack } = useCartridgeStack();
  const { data: resolvedData, isLoading: resolvedLoading } = useCartridgeResolved();
  const reorderMutation = useCartridgeReorder();
  const exportMutation = useExportSoftRom();

  const stack = stackData?.stack || [];
  const resolved = resolvedData?.resolved;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newStack = [...stack];
    const temp = newStack[index].stack_priority;
    newStack[index].stack_priority = newStack[index - 1].stack_priority;
    newStack[index - 1].stack_priority = temp;

    reorderMutation.mutate(
      newStack.map((s) => ({
        installation_id: s.id,
        stack_priority: s.stack_priority,
      }))
    );
  };

  const handleMoveDown = (index: number) => {
    if (index === stack.length - 1) return;
    const newStack = [...stack];
    const temp = newStack[index].stack_priority;
    newStack[index].stack_priority = newStack[index + 1].stack_priority;
    newStack[index + 1].stack_priority = temp;

    reorderMutation.mutate(
      newStack.map((s) => ({
        installation_id: s.id,
        stack_priority: s.stack_priority,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartridge Stack & Resolution</h1>
          <p className="text-muted-foreground mt-1">
            View and manage the installed cartridge stack. Higher priority = applied first (tenant prevails).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchStack()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Soft ROM
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stack Order */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Installation Stack
            </CardTitle>
            <CardDescription>
              Cartridges are applied top-down. Drag or use arrows to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stackLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : stack.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No cartridges installed. Install one from the Installed page.
              </p>
            ) : (
              <div className="space-y-2">
                {stack.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || reorderMutation.isPending}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === stack.length - 1 || reorderMutation.isPending}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {item.display_name || item.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>v{item.version}</span>
                        <span>Priority: {item.stack_priority}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.cartridge_type}
                        </Badge>
                      </div>
                    </div>
                    <Badge
                      variant={item.installation_status === 'active' ? 'default' : 'secondary'}
                    >
                      {item.installation_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolved State */}
        <Card>
          <CardHeader>
            <CardTitle>Resolution Result</CardTitle>
            <CardDescription>
              Effective configuration after stacking resolution (tenant prevails).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resolvedLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !resolved ? (
              <p className="text-muted-foreground text-center py-8">
                No resolution computed yet. Install cartridges to trigger resolution.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Resolved at: {new Date(resolved.resolved_at).toLocaleString()}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Section Sources</h4>
                  <div className="space-y-1.5">
                    {Object.entries(resolved.resolved_sections || {}).map(([section, source]) => {
                      const src = source as { cartridge_name: string; cartridge_type: string; priority: number };
                      return (
                        <div key={section} className="flex items-center justify-between text-sm">
                          <span className="font-mono">{section}</span>
                          <span className="flex items-center gap-1.5">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {src.cartridge_name}
                            <Badge variant="outline" className="text-xs ml-1">
                              P{src.priority}
                            </Badge>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {resolved.resolved_firmware && Object.keys(resolved.resolved_firmware).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Firmware (Safety Floor)
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                      {JSON.stringify(resolved.resolved_firmware, null, 2)}
                    </pre>
                  </div>
                )}

                {resolved.resolution_log?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Resolution Log</h4>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                      {resolved.resolution_log.join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
