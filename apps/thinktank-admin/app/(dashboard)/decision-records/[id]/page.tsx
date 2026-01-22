'use client';

/**
 * RADIANT v5.43.0 - Decision Record Detail Page
 * 
 * The Living Parchment view - full artifact visualization with
 * heatmap scrollbar, control island, and claim cards.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { 
  ArrowLeft, 
  Download, 
  RefreshCw, 
  Clock,
  Lock,
  AlertTriangle,
  History,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  HeatmapScrollbar, 
  ControlIsland, 
  ClaimCard,
  DIAColors,
  DIALensType,
} from '../components';

interface DecisionArtifact {
  id: string;
  conversationId: string;
  userId: string;
  tenantId: string;
  title: string;
  summary?: string;
  status: 'active' | 'frozen' | 'archived' | 'invalidated';
  version: number;
  parentArtifactId?: string;
  artifactContent: {
    schema_version: string;
    claims: Claim[];
    dissent_events: DissentEvent[];
    volatile_queries: VolatileQuery[];
    compliance: ComplianceMetadata;
    metrics: ArtifactMetrics;
    heatmap_segments: HeatmapSegment[];
  };
  minerModel?: string;
  extractionConfidence?: number;
  extractionTimestamp: string;
  lastValidatedAt?: string;
  validationStatus: 'fresh' | 'stale' | 'verified' | 'invalidated';
  stalenessThresholdDays: number;
  heatmapData: HeatmapSegment[];
  complianceFrameworks: string[];
  phiDetected: boolean;
  piiDetected: boolean;
  dataClassification: string;
  primaryDomain?: string;
  createdAt: string;
  updatedAt: string;
  frozenAt?: string;
  contentHash?: string;
}

interface Claim {
  claim_id: string;
  text: string;
  claim_type: string;
  supporting_evidence: Evidence[];
  verification_status: 'verified' | 'unverified' | 'contested';
  confidence_score: number;
  volatility_score: number;
  risk_score: number;
  primary_model: string;
  is_stale: boolean;
  staleness_age_hours?: number;
  contains_phi: boolean;
  contains_pii: boolean;
  sensitivity_level: string;
}

interface Evidence {
  evidence_id: string;
  evidence_type: string;
  tool_call_id?: string;
  evidence_snapshot: {
    tool_name?: string;
    input_summary?: string;
    output_summary?: string;
    timestamp: string;
  };
  is_volatile: boolean;
  volatility_category?: string;
}

interface DissentEvent {
  dissent_id: string;
  contested_claim_id?: string;
  contested_position: string;
  dissenting_model: string;
  dissent_severity: string;
  resolution: string;
  is_primary_dissent: boolean;
  ghost_path_data?: {
    branch_point_position: number;
    alternate_outcome: string;
  };
}

interface VolatileQuery {
  query_id: string;
  tool_name: string;
  last_verified_at: string;
  staleness_threshold_hours: number;
  volatility_category: string;
}

interface ComplianceMetadata {
  frameworks_applicable: string[];
  hipaa?: { phi_present: boolean; phi_categories: string[] };
  soc2?: { controls_referenced: string[] };
  gdpr?: { pii_present: boolean; lawful_basis: string };
}

interface ArtifactMetrics {
  total_claims: number;
  verified_claims: number;
  unverified_claims: number;
  contested_claims: number;
  total_evidence_links: number;
  dissent_events_count: number;
  volatile_data_points: number;
  overall_confidence: number;
  overall_volatility: number;
  overall_risk: number;
  models_involved: string[];
}

interface HeatmapSegment {
  start_position: number;
  end_position: number;
  segment_type: 'verified' | 'unverified' | 'contested' | 'stale';
  intensity: number;
  claim_ids: string[];
}

export default function ArtifactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const artifactId = params.id as string;
  
  const [artifact, setArtifact] = useState<DecisionArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View state
  const [activeLens, setActiveLens] = useState<DIALensType>('read');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [expandedClaimIds, setExpandedClaimIds] = useState<Set<string>>(new Set());
  const [hoveredClaimId, setHoveredClaimId] = useState<string | null>(null);
  
  // Dialog states
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Export options
  const [exportFormat, setExportFormat] = useState<string>('pdf');
  const [redactPhi, setRedactPhi] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchArtifact = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<{ artifact: DecisionArtifact }>(
        `/api/thinktank/decision-artifacts/${artifactId}`
      );
      setArtifact(result.artifact);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch artifact:', err);
      setError(err instanceof Error ? err.message : 'Failed to load artifact');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    fetchArtifact();
  }, [fetchArtifact]);

  // Handle scroll synchronization
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const position = scrollTop / (scrollHeight - clientHeight);
    setScrollPosition(Math.max(0, Math.min(1, position)));
  }, []);

  const handleSeek = useCallback((position: number) => {
    if (!contentRef.current) return;
    const { scrollHeight, clientHeight } = contentRef.current;
    contentRef.current.scrollTop = position * (scrollHeight - clientHeight);
  }, []);

  const handleToggleExpand = useCallback((claimId: string) => {
    setExpandedClaimIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  }, []);

  const handleValidate = async () => {
    if (!artifact) return;
    
    try {
      setValidating(true);
      await api.post(`/api/thinktank/decision-artifacts/${artifactId}/validate`, {});
      await fetchArtifact();
      setShowValidateDialog(false);
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleExport = async () => {
    if (!artifact) return;
    
    try {
      setExporting(true);
      const result = await api.post<{ downloadUrl: string }>(
        `/api/thinktank/decision-artifacts/${artifactId}/export`,
        { format: exportFormat, redactPhi }
      );
      
      // Open download URL
      window.open(result.downloadUrl, '_blank');
      setShowExportDialog(false);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
        <Skeleton className="w-8 h-full" />
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Artifact</h2>
          <p className="text-muted-foreground mb-4">{error || 'Artifact not found'}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { artifactContent, heatmapData } = artifact;
  const metrics = artifactContent.metrics;

  return (
    <div className="flex h-full" style={{ backgroundColor: DIAColors.canvasBackground }}>
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ 
            backgroundColor: DIAColors.parchmentBackground,
            borderColor: DIAColors.islandBorder,
          }}
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold" style={{ color: DIAColors.textPrimary }}>
                  {artifact.title}
                </h1>
                {artifact.status === 'frozen' && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="w-3 h-3" />
                    Frozen
                  </Badge>
                )}
                {artifact.version > 1 && (
                  <Badge variant="outline">v{artifact.version}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: DIAColors.textMuted }}>
                <span>{metrics.total_claims} claims</span>
                <span>•</span>
                <span>{Math.round(metrics.overall_confidence * 100)}% confidence</span>
                {artifact.validationStatus === 'stale' && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1" style={{ color: DIAColors.heatmapStale }}>
                      <Clock className="w-3 h-3" />
                      Stale data
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/decision-records/${artifactId}/versions`)}>
                  <History className="w-4 h-4 mr-2" />
                  Version History
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Control Island */}
        <div className="flex justify-center py-4">
          <ControlIsland
            activeLens={activeLens}
            onLensChange={setActiveLens}
            validationStatus={artifact.validationStatus}
            metrics={{
              unverifiedClaims: metrics.unverified_claims,
              contestedClaims: metrics.contested_claims,
              complianceFrameworks: artifact.complianceFrameworks,
            }}
            onExport={() => setShowExportDialog(true)}
            onValidate={() => setShowValidateDialog(true)}
          />
        </div>

        {/* Scrollable content */}
        <ScrollArea 
          ref={contentRef}
          className="flex-1"
          onScroll={handleScroll}
        >
          <div 
            className="max-w-3xl mx-auto px-6 py-4 space-y-2"
            style={{ backgroundColor: DIAColors.parchmentBackground }}
          >
            {/* Summary */}
            {artifact.summary && (
              <div 
                className="p-4 rounded-lg mb-6"
                style={{ backgroundColor: DIAColors.surfaceElevated }}
              >
                <p className="text-sm" style={{ color: DIAColors.textSecondary }}>
                  {artifact.summary}
                </p>
              </div>
            )}

            {/* Ghost paths (dissent visualization) */}
            {activeLens === 'risk' && artifactContent.dissent_events.length > 0 && (
              <div 
                className="p-4 rounded-lg mb-6"
                style={{ 
                  backgroundColor: `${DIAColors.ghostPath}`,
                  border: `1px dashed ${DIAColors.heatmapUnverified}`,
                }}
              >
                <h3 
                  className="text-sm font-medium mb-2 flex items-center gap-2"
                  style={{ color: DIAColors.heatmapUnverified }}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Ghost Paths: {artifactContent.dissent_events.length} dissent event{artifactContent.dissent_events.length !== 1 ? 's' : ''}
                </h3>
                {artifactContent.dissent_events.filter(d => d.is_primary_dissent).map((dissent) => (
                  <div key={dissent.dissent_id} className="mt-2">
                    <p className="text-sm" style={{ color: DIAColors.textSecondary }}>
                      &ldquo;{dissent.contested_position}&rdquo;
                    </p>
                    <p className="text-xs mt-1" style={{ color: DIAColors.textMuted }}>
                      {dissent.dissenting_model} • {dissent.dissent_severity} • {dissent.resolution}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Claims */}
            {artifactContent.claims.map((claim) => (
              <ClaimCard
                key={claim.claim_id}
                claim={claim}
                lens={activeLens}
                isExpanded={expandedClaimIds.has(claim.claim_id)}
                onToggleExpand={() => handleToggleExpand(claim.claim_id)}
                onClaimHover={setHoveredClaimId}
              />
            ))}

            {/* Compliance section */}
            {activeLens === 'compliance' && (
              <div 
                className="p-4 rounded-lg mt-6"
                style={{ backgroundColor: DIAColors.surfaceElevated }}
              >
                <h3 
                  className="text-sm font-medium mb-3"
                  style={{ color: DIAColors.textPrimary }}
                >
                  Compliance Status
                </h3>
                <div className="space-y-2">
                  {artifact.complianceFrameworks.length === 0 ? (
                    <p className="text-sm" style={{ color: DIAColors.textMuted }}>
                      No compliance frameworks detected
                    </p>
                  ) : (
                    artifact.complianceFrameworks.map((fw) => (
                      <div key={fw} className="flex items-center justify-between">
                        <span className="text-sm uppercase" style={{ color: DIAColors.textSecondary }}>
                          {fw}
                        </span>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                    ))
                  )}
                  {artifact.phiDetected && (
                    <div 
                      className="flex items-center gap-2 mt-4 p-2 rounded"
                      style={{ backgroundColor: `${DIAColors.heatmapContested}15` }}
                    >
                      <AlertTriangle className="w-4 h-4" style={{ color: DIAColors.heatmapContested }} />
                      <span className="text-sm" style={{ color: DIAColors.heatmapContested }}>
                        PHI detected - HIPAA compliance required
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Heatmap Scrollbar */}
      <div className="p-2" style={{ backgroundColor: DIAColors.canvasBackground }}>
        <HeatmapScrollbar
          segments={heatmapData}
          currentPosition={scrollPosition}
          onSeek={handleSeek}
          className="h-full"
        />
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Decision Record</DialogTitle>
            <DialogDescription>
              Choose format and options for export
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="json">JSON Data</SelectItem>
                  <SelectItem value="hipaa_audit">HIPAA Audit Package</SelectItem>
                  <SelectItem value="soc2_evidence">SOC2 Evidence Bundle</SelectItem>
                  <SelectItem value="gdpr_dsar">GDPR DSAR Response</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {artifact.phiDetected && (
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="redact" 
                  checked={redactPhi}
                  onCheckedChange={(checked) => setRedactPhi(checked === true)}
                />
                <label htmlFor="redact" className="text-sm">
                  Redact PHI/PII data
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validate Dialog */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validate Volatile Data</DialogTitle>
            <DialogDescription>
              Re-run volatile queries to check for data changes
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will re-execute {artifactContent.volatile_queries.length} volatile queries
              to verify the artifact&apos;s data is still current.
            </p>
            {artifactContent.volatile_queries.length > 0 && (
              <div className="mt-4 space-y-2">
                {artifactContent.volatile_queries.slice(0, 5).map((q) => (
                  <div 
                    key={q.query_id}
                    className="flex items-center justify-between text-sm p-2 rounded"
                    style={{ backgroundColor: DIAColors.surfaceElevated }}
                  >
                    <span>{q.tool_name}</span>
                    <Badge variant="outline">{q.volatility_category}</Badge>
                  </div>
                ))}
                {artifactContent.volatile_queries.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    + {artifactContent.volatile_queries.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleValidate} disabled={validating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${validating ? 'animate-spin' : ''}`} />
              {validating ? 'Validating...' : 'Validate Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
