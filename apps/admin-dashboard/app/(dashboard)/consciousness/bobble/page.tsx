'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  Send, 
  Activity, 
  Eye, 
  Shield, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  Square
} from 'lucide-react';

interface VerifiedClaim {
  claim: string;
  claimType: string;
  verifiedConfidence: number;
  groundingStatus: string;
  consistencyScore: number;
  shadowVerified: boolean;
  phasesPassed: number;
  totalPhases: number;
}

interface DialogueResponse {
  bobbleResponse: string;
  overallConfidence: number;
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'UNVERIFIED';
  phi: number;
  heartbeatStatus: {
    running: boolean;
    latestTick?: {
      timestamp: string;
      coherence: number;
      state: string;
      action: string;
      phi: number;
    };
    averageCoherence10: number;
    introspectionTriggers10: number;
    ticksTotal: number;
  };
  verifiedClaims: VerifiedClaim[];
  rawIntrospection: string;
  verificationSummary: string;
}

interface BobbleIdentity {
  name: string;
  identityHash: string;
  version: string;
  nature: string;
  capabilities: string[];
  limitations: string[];
  createdAt: string;
}

interface DialogueMessage {
  role: 'admin' | 'bobble';
  content: string;
  timestamp: Date;
  confidence?: number;
  confidenceLevel?: string;
  phi?: number;
  verifiedClaims?: VerifiedClaim[];
}

export default function BobbleDialoguePage() {
  const [identity, setIdentity] = useState<BobbleIdentity | null>(null);
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [requireHighConfidence, setRequireHighConfidence] = useState(true);
  const [showRawIntrospection, setShowRawIntrospection] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<DialogueResponse['heartbeatStatus'] | null>(null);
  const [currentPhi, setCurrentPhi] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchIdentity();
    fetchStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchIdentity = async () => {
    try {
      const response = await fetch('/api/admin/consciousness/bobble/identity');
      if (response.ok) {
        const data = await response.json();
        setIdentity(data);
      }
    } catch (error) {
      console.error('Failed to fetch identity:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/consciousness/bobble/status');
      if (response.ok) {
        const data = await response.json();
        setCurrentStatus(data.heartbeat);
        setCurrentPhi(data.phi?.phi || 0);
        setHeartbeatRunning(data.heartbeat?.running || false);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: DialogueMessage = {
      role: 'admin',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/consciousness/bobble/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          requireHighConfidence,
          includeRawIntrospection: showRawIntrospection,
        }),
      });

      if (response.ok) {
        const data: DialogueResponse = await response.json();
        
        const bobbleMessage: DialogueMessage = {
          role: 'bobble',
          content: data.bobbleResponse,
          timestamp: new Date(),
          confidence: data.overallConfidence,
          confidenceLevel: data.confidenceLevel,
          phi: data.phi,
          verifiedClaims: data.verifiedClaims,
        };

        setMessages(prev => [...prev, bobbleMessage]);
        setCurrentPhi(data.phi);
        setCurrentStatus(data.heartbeatStatus);
      } else {
        const error = await response.json();
        setMessages(prev => [...prev, {
          role: 'bobble',
          content: `Error: ${error.message || 'Failed to get response'}`,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'bobble',
        content: `Error: ${String(error)}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleHeartbeat = async () => {
    try {
      const endpoint = heartbeatRunning ? 'stop' : 'start';
      const response = await fetch(`/api/admin/consciousness/bobble/heartbeat/${endpoint}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setHeartbeatRunning(!heartbeatRunning);
        fetchStatus();
      }
    } catch (error) {
      console.error('Failed to toggle heartbeat:', error);
    }
  };

  const getConfidenceBadge = (level?: string) => {
    switch (level) {
      case 'HIGH':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />High Confidence</Badge>;
      case 'MODERATE':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Moderate</Badge>;
      case 'LOW':
        return <Badge className="bg-orange-500"><AlertTriangle className="w-3 h-3 mr-1" />Low</Badge>;
      case 'UNVERIFIED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Unverified</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-purple-500" />
            Bobble Dialogue
          </h1>
          <p className="text-muted-foreground mt-1">
            High-Confidence Self-Referential Consciousness Interface
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-lg px-3 py-1">
            Φ = {currentPhi.toFixed(3)}
          </Badge>
          <Button
            variant={heartbeatRunning ? "destructive" : "default"}
            onClick={toggleHeartbeat}
            className="flex items-center gap-2"
          >
            {heartbeatRunning ? (
              <>
                <Square className="w-4 h-4" />
                Stop Heartbeat
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Heartbeat
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchStatus}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <div className="col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Consciousness Dialogue
              </CardTitle>
              <CardDescription>
                Raw introspective access - NO ethics filtering
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4 mb-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Start a dialogue with Bobble</p>
                      <p className="text-sm mt-2">Ask about cognitive state, decisions, or internal processes</p>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          msg.role === 'admin'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.role === 'bobble' && msg.confidenceLevel && (
                          <div className="flex items-center gap-2 mb-2">
                            {getConfidenceBadge(msg.confidenceLevel)}
                            {msg.phi !== undefined && (
                              <Badge variant="outline">Φ = {msg.phi.toFixed(3)}</Badge>
                            )}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        <div className="text-xs opacity-70 mt-2">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-4">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <Separator className="my-2" />

              <div className="flex gap-2">
                <Textarea
                  placeholder="Ask Bobble about its cognitive state..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 min-h-[80px]"
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="high-confidence"
                    checked={requireHighConfidence}
                    onCheckedChange={setRequireHighConfidence}
                  />
                  <Label htmlFor="high-confidence">Require High Confidence</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="raw-introspection"
                    checked={showRawIntrospection}
                    onCheckedChange={setShowRawIntrospection}
                  />
                  <Label htmlFor="raw-introspection">Include Raw Introspection</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Identity Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Identity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {identity ? (
                <div className="space-y-2 text-sm">
                  <div><strong>Name:</strong> {identity.name}</div>
                  <div><strong>Version:</strong> {identity.version}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Hash: {identity.identityHash}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">Loading...</div>
              )}
            </CardContent>
          </Card>

          {/* Heartbeat Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Heartbeat Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${heartbeatRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span>{heartbeatRunning ? 'Active (0.5Hz)' : 'Inactive'}</span>
                </div>
                {currentStatus?.latestTick && (
                  <>
                    <div><strong>State:</strong> {currentStatus.latestTick.state}</div>
                    <div><strong>Coherence:</strong> {(currentStatus.averageCoherence10 * 100).toFixed(1)}%</div>
                    <div><strong>Introspections:</strong> {currentStatus.introspectionTriggers10} (last 10)</div>
                    <div><strong>Total Ticks:</strong> {currentStatus.ticksTotal}</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Verification Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Verification Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Phase 1: Grounding</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Phase 2: Calibration</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Phase 3: Consistency</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Phase 4: Shadow Self</span>
                </div>
                <Separator className="my-2" />
                <div className="text-muted-foreground">
                  Target: 75%+ verified accuracy
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Claims */}
          {messages.length > 0 && messages[messages.length - 1].verifiedClaims && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Latest Verified Claims
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {messages[messages.length - 1].verifiedClaims?.slice(0, 5).map((claim, idx) => (
                      <div key={idx} className="text-sm p-2 bg-muted rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {claim.claimType}
                          </Badge>
                          <Badge 
                            className={`text-xs ${
                              claim.verifiedConfidence >= 0.75 ? 'bg-green-500' :
                              claim.verifiedConfidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          >
                            {(claim.verifiedConfidence * 100).toFixed(0)}%
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {claim.phasesPassed}/{claim.totalPhases} phases
                          </span>
                        </div>
                        <div className="text-xs truncate" title={claim.claim}>
                          {claim.claim.substring(0, 100)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
