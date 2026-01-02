'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Shield,
  Lock,
} from 'lucide-react';

interface AuditEntry {
  id: string;
  entry_type: string;
  entry_content: Record<string, unknown>;
  merkle_hash: string;
  timestamp: string;
}

interface VerificationResult {
  isValid: boolean;
  lastValidSequence: number;
  errors: string[];
}

const ENTRY_TYPE_COLORS: Record<string, string> = {
  action_approved: 'bg-green-500',
  cbf_violation: 'bg-red-500',
  recovery_triggered: 'bg-orange-500',
  persona_override: 'bg-blue-500',
  escalation_created: 'bg-purple-500',
};

export default function CatoAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const fetchAuditEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }

      const response = await fetch(`/api/admin/cato/audit?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit entries');
      const data = await response.json();
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  const searchEntries = async () => {
    if (!searchQuery.trim()) {
      fetchAuditEntries();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/cato/audit/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery, limit: 100 }),
      });
      if (!response.ok) throw new Error('Failed to search');
      const data = await response.json();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const response = await fetch('/api/admin/cato/audit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Verification failed');
      const result = await response.json();
      setVerificationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchAuditEntries();
  }, [fetchAuditEntries]);

  const entryTypes = Array.from(new Set(entries.map((e) => e.entry_type)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground">
            Cryptographically verified, append-only action log
          </p>
        </div>
        <Button onClick={verifyChain} disabled={verifying}>
          {verifying ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Shield className="h-4 w-4 mr-2" />
          )}
          Verify Chain Integrity
        </Button>
      </div>

      {/* Immutable Notice */}
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Append-Only Audit Trail</AlertTitle>
        <AlertDescription>
          This audit trail uses Merkle trees for cryptographic verification. Entries cannot
          be modified or deleted. Each entry contains a hash of the previous entry, creating
          an unbreakable chain of evidence.
        </AlertDescription>
      </Alert>

      {/* Verification Result */}
      {verificationResult && (
        <Alert variant={verificationResult.isValid ? 'default' : 'destructive'}>
          {verificationResult.isValid ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>
            {verificationResult.isValid ? 'Chain Valid' : 'Chain Integrity Error'}
          </AlertTitle>
          <AlertDescription>
            {verificationResult.isValid ? (
              `All ${verificationResult.lastValidSequence} entries verified successfully.`
            ) : (
              <>
                Verification failed at sequence {verificationResult.lastValidSequence}.
                <br />
                Errors: {verificationResult.errors.join(', ')}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchEntries()}
              />
              <Button onClick={searchEntries} variant="secondary">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {entryTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchAuditEntries} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Audit Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Entries</CardTitle>
          <CardDescription>{entries.length} entries shown</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Merkle Hash</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge
                      className={ENTRY_TYPE_COLORS[entry.entry_type] || 'bg-gray-500'}
                    >
                      {entry.entry_type.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(entry.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.merkle_hash.slice(0, 16)}...
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No audit entries found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Entry Details</DialogTitle>
            <DialogDescription>
              {selectedEntry?.entry_type.replace(/_/g, ' ')} at{' '}
              {selectedEntry && new Date(selectedEntry.timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Merkle Hash</h4>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {selectedEntry.merkle_hash}
                </code>
              </div>

              <div>
                <h4 className="font-medium mb-2">Entry Content</h4>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(selectedEntry.entry_content, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
