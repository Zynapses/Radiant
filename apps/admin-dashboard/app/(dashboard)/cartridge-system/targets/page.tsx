'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  useCartridgeTargets,
  useCartridgeTargetSpecs,
} from '@/lib/hooks/use-cartridge-system';

function TargetCard({ target }: { target: { id: string; service_key: string; display_name: string; description?: string; required_sections: string[]; optional_sections: string[]; is_active: boolean } }) {
  const [expanded, setExpanded] = useState(false);
  const { data: specsData, isLoading: specsLoading } = useCartridgeTargetSpecs(
    expanded ? target.service_key : ''
  );

  const sections = (specsData as any)?.sections || [];

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <div>
              <CardTitle className="text-lg">{target.display_name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{target.service_key}</code>
                <Badge variant={target.is_active ? 'default' : 'secondary'}>
                  {target.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {(target.required_sections || []).length} required, {(target.optional_sections || []).length} optional
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4">
          {target.description && (
            <p className="text-sm text-muted-foreground mb-4">{target.description}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm font-medium mr-2">Required:</span>
            {(target.required_sections || []).map((s: string) => (
              <Badge key={s} variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {s}
              </Badge>
            ))}
            {(target.required_sections || []).length === 0 && (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm font-medium mr-2">Optional:</span>
            {(target.optional_sections || []).map((s: string) => (
              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </div>

          {specsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : sections.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Section Specifications</h4>
              {sections.map((spec: any) => (
                <div key={spec.id} className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{spec.display_name}</span>
                    <Badge variant={spec.is_required_for_target ? 'destructive' : 'outline'} className="text-xs">
                      {spec.is_required_for_target ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                  {spec.description && (
                    <p className="text-xs text-muted-foreground mb-2">{spec.description}</p>
                  )}
                  <div className="space-y-1">
                    {(Array.isArray(spec.file_specs) ? spec.file_specs : JSON.parse(spec.file_specs || '[]')).map((fs: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <code className="bg-background px-1 rounded">{fs.filename}</code>
                        <span className="text-muted-foreground">{fs.format}</span>
                        {fs.required && <Badge variant="destructive" className="text-[10px] h-4">req</Badge>}
                        {fs.max_size_mb && <span className="text-muted-foreground">max {fs.max_size_mb}MB</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

export default function CartridgeTargetsPage() {
  const { data, isLoading, refetch } = useCartridgeTargets();
  const targets = data?.targets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Target Service Registry</h1>
          <p className="text-muted-foreground mt-1">
            Pluggable target services that cartridges can deliver intelligence to
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : targets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No target services registered</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {targets.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))}
        </div>
      )}
    </div>
  );
}
