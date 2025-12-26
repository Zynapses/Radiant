'use client';

/**
 * Think Tank Consent Manager Component
 * GDPR compliance: Display and manage user consents
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Trash2,
  UserCheck,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface UserConsent {
  id: string;
  userId: string;
  email: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'ai_training';
  granted: boolean;
  grantedAt: string | null;
  withdrawnAt: string | null;
  ipAddress: string;
  userAgent: string;
}

interface ConsentStats {
  total: number;
  granted: number;
  withdrawn: number;
  byType: {
    data_processing: number;
    marketing: number;
    analytics: number;
    ai_training: number;
  };
}

const consentTypeLabels: Record<string, string> = {
  data_processing: 'Data Processing',
  marketing: 'Marketing Communications',
  analytics: 'Analytics & Usage',
  ai_training: 'AI Model Training',
};

const consentTypeDescriptions: Record<string, string> = {
  data_processing: 'Required for core service functionality',
  marketing: 'Promotional emails and newsletters',
  analytics: 'Usage analytics and product improvement',
  ai_training: 'Use of data to improve AI models',
};

export function ThinkTankConsentManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [consentTypeFilter, setConsentTypeFilter] = useState<string>('all');
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<UserConsent | null>(null);

  const { data, isLoading, refetch } = useQuery<{ consents: UserConsent[]; stats: ConsentStats }>({
    queryKey: ['thinktank-consents', consentTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (consentTypeFilter !== 'all') {
        params.set('consentType', consentTypeFilter);
      }
      return fetch(`/api/admin/thinktank/consent?${params}`).then((r) => r.json());
    },
  });

  const withdrawConsentMutation = useMutation({
    mutationFn: ({ userId, consentType }: { userId: string; consentType: string }) =>
      fetch(`/api/admin/thinktank/consent?userId=${userId}&consentType=${consentType}`, {
        method: 'DELETE',
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank-consents'] });
      setShowWithdrawDialog(false);
      setSelectedConsent(null);
    },
  });

  const filteredConsents = data?.consents?.filter((consent) =>
    consent.email.toLowerCase().includes(search.toLowerCase()) ||
    consent.userId.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6" />
            Consent Management
          </h2>
          <p className="text-muted-foreground">
            GDPR-compliant consent tracking for Think Tank users
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Total Consents</span>
            </div>
            <p className="text-2xl font-bold">{data?.stats?.total || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Active Consents</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{data?.stats?.granted || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">Withdrawn</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{data?.stats?.withdrawn || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Data Processing</span>
            </div>
            <p className="text-2xl font-bold">{data?.stats?.byType?.data_processing || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Consent Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consent by Type</CardTitle>
          <CardDescription>Active consents grouped by purpose</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(consentTypeLabels).map(([type, label]) => (
              <div key={type} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{label}</span>
                  <Badge variant="secondary">
                    {data?.stats?.byType?.[type as keyof typeof data.stats.byType] || 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {consentTypeDescriptions[type]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Consent Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or user ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={consentTypeFilter} onValueChange={setConsentTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Consent Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="data_processing">Data Processing</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
                <SelectItem value="ai_training">AI Training</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Consent Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Granted At</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredConsents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No consent records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredConsents.map((consent) => (
                  <TableRow key={consent.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{consent.email}</p>
                        <p className="text-xs text-muted-foreground">{consent.userId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {consentTypeLabels[consent.consentType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {consent.granted ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Withdrawn
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {consent.grantedAt ? (
                        <div>
                          <p className="text-sm">
                            {format(new Date(consent.grantedAt), 'PP')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(consent.grantedAt), { addSuffix: true })}
                          </p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {consent.ipAddress}
                    </TableCell>
                    <TableCell>
                      {consent.granted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedConsent(consent);
                            setShowWithdrawDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Withdraw Consent Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Withdraw Consent
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw this consent? This action will be logged for GDPR compliance.
            </DialogDescription>
          </DialogHeader>
          {selectedConsent && (
            <div className="py-4 space-y-2">
              <p><strong>User:</strong> {selectedConsent.email}</p>
              <p><strong>Consent Type:</strong> {consentTypeLabels[selectedConsent.consentType]}</p>
              <p><strong>Originally Granted:</strong> {selectedConsent.grantedAt ? format(new Date(selectedConsent.grantedAt), 'PPp') : 'Unknown'}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedConsent) {
                  withdrawConsentMutation.mutate({
                    userId: selectedConsent.userId,
                    consentType: selectedConsent.consentType,
                  });
                }
              }}
              disabled={withdrawConsentMutation.isPending}
            >
              {withdrawConsentMutation.isPending ? 'Withdrawing...' : 'Withdraw Consent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
