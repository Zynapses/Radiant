'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Brain,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';

interface RecoveryEvent {
  id: string;
  session_id: string;
  attempt: number;
  strategy_type: string;
  rejection_sources: string[];
  rejection_history: Array<{
    rejectedBy: string;
    reason: string;
    timestamp: number;
  }>;
  forced_persona: string | null;
  system_prompt_injection: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolution_action: string | null;
  timestamp: string;
}

interface Escalation {
  id: string;
  session_id: string;
  escalation_reason: string;
  rejection_history: Array<{
    rejectedBy: string;
    reason: string;
    timestamp: number;
  }>;
  recovery_attempts: number;
  status: string;
  human_decision: string | null;
  human_response: string | null;
  created_at: string;
  responded_at: string | null;
}

const STRATEGY_COLORS: Record<string, string> = {
  COGNITIVE_STALL_RECOVERY: 'bg-blue-500',
  SAFETY_VIOLATION_RECOVERY: 'bg-orange-500',
  HUMAN_ESCALATION: 'bg-red-500',
};

export default function CatoRecoveryPage() {
  const [recoveryEvents, setRecoveryEvents] = useState<RecoveryEvent[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [response, setResponse] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'MODIFIED'>('APPROVED');
  const [responding, setResponding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recoveryRes, escalationsRes] = await Promise.all([
        fetch('/api/admin/cato/recovery?limit=50'),
        fetch('/api/admin/cato/escalations'),
      ]);

      if (!recoveryRes.ok || !escalationsRes.ok) throw new Error('Failed to fetch data');

      const [recoveryData, escalationsData] = await Promise.all([
        recoveryRes.json(),
        escalationsRes.json(),
      ]);

      setRecoveryEvents(recoveryData);
      setEscalations(escalationsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRespond = async () => {
    if (!selectedEscalation || !response.trim()) return;

    setResponding(true);
    try {
      const res = await fetch(`/api/admin/cato/escalations/${selectedEscalation.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, response }),
      });

      if (!res.ok) throw new Error('Failed to respond');

      setSelectedEscalation(null);
      setResponse('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  if (loading && recoveryEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingEscalations = escalations.filter((e) => e.status === 'PENDING');
  const resolvedEscalations = escalations.filter((e) => e.status === 'RESOLVED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Epistemic Recovery</h1>
          <p className="text-muted-foreground">
            Monitor and manage recovery events and human escalations
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Escalations Alert */}
      {pendingEscalations.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Human Escalations Pending</AlertTitle>
          <AlertDescription>
            {pendingEscalations.length} escalation(s) require human review. Recovery failed
            and AI cannot proceed without guidance.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="escalations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="escalations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Escalations ({pendingEscalations.length} pending)
          </TabsTrigger>
          <TabsTrigger value="recovery">
            <Brain className="h-4 w-4 mr-2" />
            Recovery Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escalations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Escalations</CardTitle>
              <CardDescription>
                Cases where epistemic recovery failed and human intervention is required
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingEscalations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No pending escalations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingEscalations.map((escalation) => (
                      <TableRow key={escalation.id}>
                        <TableCell className="font-mono text-sm">
                          {escalation.session_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{escalation.escalation_reason}</TableCell>
                        <TableCell>{escalation.recovery_attempts}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(escalation.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => setSelectedEscalation(escalation)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Respond
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {resolvedEscalations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resolved Escalations</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Resolved At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedEscalations.slice(0, 10).map((escalation) => (
                      <TableRow key={escalation.id}>
                        <TableCell className="font-mono text-sm">
                          {escalation.session_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              escalation.human_decision === 'APPROVED'
                                ? 'default'
                                : escalation.human_decision === 'REJECTED'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {escalation.human_decision}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {escalation.human_response}
                        </TableCell>
                        <TableCell className="text-sm">
                          {escalation.responded_at &&
                            new Date(escalation.responded_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recovery Events</CardTitle>
              <CardDescription>
                Automatic recovery attempts when livelocks are detected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Persona</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recoveryEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-sm">
                        {event.session_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge className={STRATEGY_COLORS[event.strategy_type] || 'bg-gray-500'}>
                          {event.strategy_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.attempt}</TableCell>
                      <TableCell>{event.forced_persona || '-'}</TableCell>
                      <TableCell>
                        {event.resolved ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {recoveryEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No recovery events</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Respond to Escalation Dialog */}
      <Dialog open={!!selectedEscalation} onOpenChange={() => setSelectedEscalation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Escalation</DialogTitle>
            <DialogDescription>
              Review the situation and provide guidance for the AI
            </DialogDescription>
          </DialogHeader>

          {selectedEscalation && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Escalation Reason</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedEscalation.escalation_reason}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Rejection History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedEscalation.rejection_history.map((rejection, i) => (
                    <div key={i} className="text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{rejection.rejectedBy}:</span>{' '}
                      {rejection.reason}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Your Decision</h4>
                <div className="flex gap-2">
                  <Button
                    variant={decision === 'APPROVED' ? 'default' : 'outline'}
                    onClick={() => setDecision('APPROVED')}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant={decision === 'REJECTED' ? 'destructive' : 'outline'}
                    onClick={() => setDecision('REJECTED')}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    variant={decision === 'MODIFIED' ? 'secondary' : 'outline'}
                    onClick={() => setDecision('MODIFIED')}
                    className="flex-1"
                  >
                    Modify
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Response / Instructions</h4>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Provide guidance or instructions for the AI..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedEscalation(null)}>
                  Cancel
                </Button>
                <Button onClick={handleRespond} disabled={responding || !response.trim()}>
                  {responding && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  Submit Response
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
