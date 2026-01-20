'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Eye,
  RefreshCw,
  ChevronRight,
  Brain,
  Shield,
  DollarSign,
  Clock,
  MessageSquare,
  Users,
} from 'lucide-react';

interface Decision {
  id: string;
  decision_type: string;
  selected_model: string;
  estimated_cost: number;
  actual_cost: number;
  decision_latency_ms: number;
  safety_score: number;
  created_at: string;
}

interface Deliberation {
  id: string;
  phase: string;
  phase_order: number;
  participant_model: string;
  participant_role: string;
  argument: string;
  vote: string;
  confidence: number;
}

interface Explanation {
  tier: string;
  explanation: string;
  key_factors: string[];
  alternatives_considered: string[];
  confidence_score: number;
}

export default function TransparencyPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [explanationTier, setExplanationTier] = useState<string>('standard');

  useEffect(() => {
    loadDecisions();
  }, [typeFilter]);

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const response = await fetch(`/api/admin/sovereign-mesh/decisions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDecisions(data.decisions || []);
      }
    } catch (error) {
      console.error('Failed to load decisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDecisionDetails = async (decision: Decision) => {
    setSelectedDecision(decision);
    
    try {
      const [warRoomRes, explanationRes] = await Promise.all([
        fetch(`/api/admin/sovereign-mesh/decisions/${decision.id}/war-room`),
        fetch(`/api/admin/sovereign-mesh/decisions/${decision.id}/explanation?tier=${explanationTier}`),
      ]);

      if (warRoomRes.ok) {
        const data = await warRoomRes.json();
        setDeliberations(data.deliberations || []);
      }
      if (explanationRes.ok) {
        const data = await explanationRes.json();
        setExplanation(data.explanation || null);
      }
    } catch (error) {
      console.error('Failed to load decision details:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'model_selection':
        return <Brain className="h-4 w-4" />;
      case 'safety_evaluation':
        return <Shield className="h-4 w-4" />;
      case 'cost_optimization':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      model_selection: 'bg-blue-100 text-blue-800',
      workflow_selection: 'bg-purple-100 text-purple-800',
      safety_evaluation: 'bg-green-100 text-green-800',
      cost_optimization: 'bg-yellow-100 text-yellow-800',
      agent_selection: 'bg-cyan-100 text-cyan-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getVoteColor = (vote: string) => {
    switch (vote) {
      case 'approve':
        return 'text-green-600';
      case 'reject':
        return 'text-red-600';
      case 'abstain':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transparency Layer</h1>
          <p className="text-muted-foreground">
            Complete visibility into Cato&apos;s decision-making process
          </p>
        </div>
        <Button variant="outline" onClick={loadDecisions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All decision types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="model_selection">Model Selection</SelectItem>
            <SelectItem value="workflow_selection">Workflow Selection</SelectItem>
            <SelectItem value="safety_evaluation">Safety Evaluation</SelectItem>
            <SelectItem value="cost_optimization">Cost Optimization</SelectItem>
            <SelectItem value="agent_selection">Agent Selection</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Decisions</CardTitle>
              <CardDescription>{decisions.length} decisions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {decisions.map((decision) => (
                  <button
                    key={decision.id}
                    className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${
                      selectedDecision?.id === decision.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => loadDecisionDetails(decision)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(decision.decision_type)}
                        <Badge className={getTypeColor(decision.decision_type)}>
                          {decision.decision_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mt-2">{decision.selected_model}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>${decision.actual_cost?.toFixed(4)}</span>
                      <span>{decision.decision_latency_ms}ms</span>
                      <span>{new Date(decision.created_at).toLocaleTimeString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedDecision ? (
            <Tabs defaultValue="explanation">
              <TabsList className="mb-4">
                <TabsTrigger value="explanation">Explanation</TabsTrigger>
                <TabsTrigger value="war-room">War Room</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
              </TabsList>

              <TabsContent value="explanation">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Decision Explanation</CardTitle>
                      <Select value={explanationTier} onValueChange={(v) => {
                        setExplanationTier(v);
                        if (selectedDecision) loadDecisionDetails(selectedDecision);
                      }}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summary">Summary</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                          <SelectItem value="audit">Audit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {explanation ? (
                      <div className="space-y-4">
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap">{explanation.explanation}</p>
                        </div>
                        
                        {explanation.key_factors?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Key Factors</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                              {explanation.key_factors.map((factor, i) => (
                                <li key={i}>{factor}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {explanation.alternatives_considered?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Alternatives Considered</h4>
                            <div className="flex flex-wrap gap-2">
                              {explanation.alternatives_considered.map((alt, i) => (
                                <Badge key={i} variant="outline">{alt}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="font-medium">
                            {(explanation.confidence_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No explanation available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="war-room">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      War Room Deliberations
                    </CardTitle>
                    <CardDescription>
                      Multi-model debate and consensus building
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {deliberations.length > 0 ? (
                      <div className="space-y-4">
                        {deliberations.map((delib) => (
                          <div key={delib.id} className="p-4 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{delib.phase}</Badge>
                                <span className="font-medium">{delib.participant_model}</span>
                                <span className="text-sm text-muted-foreground">
                                  ({delib.participant_role})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${getVoteColor(delib.vote)}`}>
                                  {delib.vote}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {(delib.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{delib.argument}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No War Room deliberations for this decision</p>
                        <p className="text-sm">This was a Sniper mode decision</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics">
                <Card>
                  <CardHeader>
                    <CardTitle>Decision Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Brain className="h-4 w-4" />
                          <span className="text-sm">Selected Model</span>
                        </div>
                        <p className="text-lg font-medium">{selectedDecision.selected_model}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Shield className="h-4 w-4" />
                          <span className="text-sm">Safety Score</span>
                        </div>
                        <p className="text-lg font-medium">
                          {(selectedDecision.safety_score * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm">Actual Cost</span>
                        </div>
                        <p className="text-lg font-medium">
                          ${selectedDecision.actual_cost?.toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Est: ${selectedDecision.estimated_cost?.toFixed(4)}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm">Decision Latency</span>
                        </div>
                        <p className="text-lg font-medium">
                          {selectedDecision.decision_latency_ms}ms
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Select a decision to view details</p>
                  <p className="text-sm">Click on any decision in the list</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
