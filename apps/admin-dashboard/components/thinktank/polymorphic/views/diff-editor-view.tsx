'use client';

/**
 * Diff Editor View (Sage Mode - Verification View)
 * 
 * PROMPT-41 Polymorphic UI
 * 
 * Split-screen validation with source attribution.
 * Left: Content being verified. Right: Source documents with confidence.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCode, CheckCircle, AlertTriangle, XCircle, ExternalLink, Shield, Book, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewComponentProps } from '../view-router';

interface SourceDocument {
  id: string;
  title: string;
  excerpt: string;
  url?: string;
  confidence: number;
  verificationStatus: 'verified' | 'uncertain' | 'unverified';
  matchedClaims: string[];
}

interface ClaimVerification {
  id: string;
  claim: string;
  status: 'verified' | 'uncertain' | 'hallucination_risk';
  sources: string[];
  confidence: number;
}

const STATUS_CONFIG = {
  verified: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Verified' },
  uncertain: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Uncertain' },
  hallucination_risk: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Risk' },
  unverified: { icon: AlertTriangle, color: 'text-zinc-500', bg: 'bg-zinc-500/10', label: 'Unverified' },
};

export function DiffEditorView({ 
  data, 
  projectId,
  sessionId, 
  mode,
  domainHint,
  onUpdateView,
  onEscalate 
}: ViewComponentProps) {
  const [content, setContent] = useState('');
  const [claims, setClaims] = useState<ClaimVerification[]>([]);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('sources');

  // Initialize from data payload
  useEffect(() => {
    if (data.content) setContent(String(data.content));
    if (data.claims && Array.isArray(data.claims)) {
      setClaims(data.claims as ClaimVerification[]);
    }
    if (data.sources && Array.isArray(data.sources)) {
      setSources(data.sources as SourceDocument[]);
    }

    // Demo data if empty
    if (!data.content) {
      setContent(`The quarterly revenue increased by 15% compared to the previous period. 
      
Market analysis indicates strong growth potential in the APAC region, with projected expansion of 25% over the next fiscal year.

The compliance review has been completed and all regulatory requirements have been met according to the latest audit.`);
      
      setClaims([
        { 
          id: '1', 
          claim: 'quarterly revenue increased by 15%', 
          status: 'verified', 
          sources: ['s1', 's2'], 
          confidence: 0.95 
        },
        { 
          id: '2', 
          claim: 'projected expansion of 25% in APAC', 
          status: 'uncertain', 
          sources: ['s3'], 
          confidence: 0.72 
        },
        { 
          id: '3', 
          claim: 'all regulatory requirements have been met', 
          status: 'hallucination_risk', 
          sources: [], 
          confidence: 0.45 
        },
      ]);

      setSources([
        { 
          id: 's1', 
          title: 'Q3 Financial Report', 
          excerpt: 'Total revenue reached $45.2M, representing a 15.3% increase YoY...', 
          confidence: 0.98, 
          verificationStatus: 'verified',
          matchedClaims: ['1']
        },
        { 
          id: 's2', 
          title: 'Board Meeting Minutes', 
          excerpt: 'CFO presented quarterly results showing 15% revenue growth...', 
          confidence: 0.92, 
          verificationStatus: 'verified',
          matchedClaims: ['1']
        },
        { 
          id: 's3', 
          title: 'Market Analysis Draft', 
          excerpt: 'APAC projections range from 18-28% depending on macro conditions...', 
          confidence: 0.75, 
          verificationStatus: 'uncertain',
          matchedClaims: ['2']
        },
      ]);
    }
  }, [data]);

  const getDomainIcon = () => {
    switch (domainHint) {
      case 'medical': return Shield;
      case 'financial': return Scale;
      case 'legal': return Book;
      default: return FileCode;
    }
  };

  const DomainIcon = getDomainIcon();

  const overallConfidence = claims.length > 0 
    ? claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length 
    : 0;

  const verifiedCount = claims.filter(c => c.status === 'verified').length;
  const riskCount = claims.filter(c => c.status === 'hallucination_risk').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <DomainIcon className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Sage Mode - Verification View</span>
          {domainHint && domainHint !== 'general' && (
            <Badge variant="outline" className="text-xs capitalize">
              {domainHint} Compliance
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs">{verifiedCount} verified</span>
          </div>
          {riskCount > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs">{riskCount} at risk</span>
            </div>
          )}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              overallConfidence >= 0.8 && "bg-green-500/10 text-green-600",
              overallConfidence >= 0.6 && overallConfidence < 0.8 && "bg-yellow-500/10 text-yellow-600",
              overallConfidence < 0.6 && "bg-red-500/10 text-red-600",
            )}
          >
            {Math.round(overallConfidence * 100)}% confidence
          </Badge>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Content with highlighted claims */}
        <div className="flex-1 border-r">
          <div className="p-3 border-b bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">Content Under Review</span>
          </div>
          <ScrollArea className="h-[calc(100%-44px)]">
            <div className="p-4 space-y-4">
              {content.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="text-sm leading-relaxed">
                  {paragraph}
                </p>
              ))}

              {/* Claims List */}
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-xs font-medium text-muted-foreground mb-3">Extracted Claims</h4>
                <div className="space-y-2">
                  {claims.map((claim) => {
                    const config = STATUS_CONFIG[claim.status];
                    const Icon = config.icon;
                    return (
                      <Card 
                        key={claim.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedClaim === claim.id && "ring-2 ring-primary",
                          config.bg
                        )}
                        onClick={() => setSelectedClaim(claim.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", config.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{claim.claim}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px]">
                                  {config.label}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {claim.sources.length} source{claim.sources.length !== 1 ? 's' : ''}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round(claim.confidence * 100)}% confidence
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Sources */}
        <div className="w-[400px] flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b h-11 bg-muted/20 px-2">
              <TabsTrigger value="sources" className="text-xs">
                Sources ({sources.length})
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">
                Audit Trail
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sources" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {sources.map((source) => {
                    const config = STATUS_CONFIG[source.verificationStatus];
                    const Icon = config.icon;
                    const isRelatedToSelected = selectedClaim && source.matchedClaims.includes(selectedClaim);
                    
                    return (
                      <Card 
                        key={source.id}
                        className={cn(
                          "transition-all",
                          isRelatedToSelected && "ring-2 ring-primary"
                        )}
                      >
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Icon className={cn("w-4 h-4", config.color)} />
                              {source.title}
                            </CardTitle>
                            {source.url && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {source.excerpt}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full",
                                  source.confidence >= 0.8 && "bg-green-500",
                                  source.confidence >= 0.6 && source.confidence < 0.8 && "bg-yellow-500",
                                  source.confidence < 0.6 && "bg-red-500",
                                )}
                                style={{ width: `${source.confidence * 100}%` }} 
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(source.confidence * 100)}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {sources.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No sources found</p>
                      <p className="text-xs mt-1">This claim may be unverified</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="audit" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Verification started</span>
                    <span className="ml-auto">2m ago</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>3 claims extracted</span>
                    <span className="ml-auto">1m ago</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Source retrieval complete</span>
                    <span className="ml-auto">30s ago</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>1 claim flagged for review</span>
                    <span className="ml-auto">10s ago</span>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
