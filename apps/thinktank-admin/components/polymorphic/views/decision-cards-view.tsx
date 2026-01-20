'use client';

/**
 * Decision Cards View - HITL Mission Control
 * 
 * PROMPT-41 Polymorphic UI
 * 
 * Human-in-the-loop decision interface.
 * Integrates with existing Mission Control Decision Sidebar.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, Clock, Shield, Scale, Stethoscope, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewComponentProps } from '../view-router';

interface PendingDecision {
  id: string;
  question: string;
  context: string;
  domain: 'medical' | 'financial' | 'legal' | 'general';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  options?: string[];
  expiresAt: Date;
  source: string;
}

const DOMAIN_CONFIG = {
  medical: { icon: Stethoscope, color: 'text-red-500', bg: 'bg-red-500/10' },
  financial: { icon: Scale, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  legal: { icon: Shield, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  general: { icon: HelpCircle, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
};

const URGENCY_CONFIG = {
  low: { color: 'bg-zinc-500', label: 'Low' },
  normal: { color: 'bg-blue-500', label: 'Normal' },
  high: { color: 'bg-yellow-500', label: 'High' },
  critical: { color: 'bg-red-500 animate-pulse', label: 'Critical' },
};

export function DecisionCardsView({ 
  data, 
}: ViewComponentProps) {
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [response, setResponse] = useState('');

  useEffect(() => {
    if (data.decisions && Array.isArray(data.decisions)) {
      setDecisions(data.decisions as PendingDecision[]);
    } else {
      setDecisions([
        {
          id: '1',
          question: 'Should we proceed with the proposed budget allocation for Q2?',
          context: 'The AI analyzed the financial projections but needs human confirmation due to the 15% variance from standard thresholds.',
          domain: 'financial',
          urgency: 'high',
          options: ['Approve as proposed', 'Request revision', 'Escalate to CFO'],
          expiresAt: new Date(Date.now() + 3600000),
          source: 'Economic Governor'
        },
        {
          id: '2',
          question: 'Confirm patient treatment recommendation before proceeding.',
          context: 'The medical AI has generated a treatment plan but FDA 21 CFR Part 11 compliance requires human verification.',
          domain: 'medical',
          urgency: 'critical',
          expiresAt: new Date(Date.now() + 1800000),
          source: 'Sage Verification'
        },
      ]);
    }
  }, [data]);

  const handleRespond = (decisionId: string) => {
    setDecisions(prev => prev.filter(d => d.id !== decisionId));
    setSelectedDecision(null);
    setResponse('');
  };

  const getTimeRemaining = (expiresAt: Date) => {
    const diff = expiresAt.getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Mission Control - Decisions Pending</span>
          <Badge variant="outline">{decisions.length} awaiting</Badge>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <ScrollArea className="w-[350px] border-r">
          <div className="p-3 space-y-2">
            {decisions.map((decision) => {
              const domainConfig = DOMAIN_CONFIG[decision.domain];
              const urgencyConfig = URGENCY_CONFIG[decision.urgency];
              const DomainIcon = domainConfig.icon;
              
              return (
                <Card 
                  key={decision.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedDecision === decision.id && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedDecision(decision.id)}
                >
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-start justify-between">
                      <div className={cn("p-1.5 rounded", domainConfig.bg)}>
                        <DomainIcon className={cn("w-4 h-4", domainConfig.color)} />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn("w-2 h-2 rounded-full", urgencyConfig.color)} />
                        <span className="text-[10px] text-muted-foreground">{urgencyConfig.label}</span>
                      </div>
                    </div>
                    <CardTitle className="text-sm font-medium mt-2 line-clamp-2">
                      {decision.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeRemaining(new Date(decision.expiresAt))}</span>
                      <span>•</span>
                      <span>{decision.source}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {decisions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">All Clear</p>
                <p className="text-xs mt-1">No decisions pending</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex-1 flex flex-col">
          {selectedDecision ? (
            <>
              {(() => {
                const decision = decisions.find(d => d.id === selectedDecision);
                if (!decision) return null;
                const domainConfig = DOMAIN_CONFIG[decision.domain];
                const DomainIcon = domainConfig.icon;

                return (
                  <>
                    <div className="p-4 border-b">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={domainConfig.bg}>
                          <DomainIcon className={cn("w-3 h-3 mr-1", domainConfig.color)} />
                          {decision.domain}
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          {getTimeRemaining(new Date(decision.expiresAt))}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-semibold">{decision.question}</h3>
                    </div>

                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Context</h4>
                          <p className="text-sm text-muted-foreground">{decision.context}</p>
                        </div>

                        {decision.options && decision.options.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Quick Options</h4>
                            <div className="flex flex-wrap gap-2">
                              {decision.options.map((option, idx) => (
                                <Button 
                                  key={idx} 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleRespond(decision.id)}
                                >
                                  {option}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-medium mb-2">Custom Response</h4>
                          <Textarea
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            placeholder="Enter your guidance or decision..."
                            className="min-h-[100px]"
                          />
                        </div>
                      </div>
                    </ScrollArea>

                    <div className="p-4 border-t flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setSelectedDecision(null)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleRespond(decision.id)}
                        disabled={!response.trim() && (!decision.options || decision.options.length === 0)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Submit Decision
                      </Button>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a decision to review</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
