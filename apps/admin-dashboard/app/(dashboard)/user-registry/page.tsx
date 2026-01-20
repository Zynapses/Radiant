'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Users, 
  Shield, 
  FileText, 
  Clock, 
  Search,
  Download,
  Trash2,
  Eye,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface UserAssignment {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  assigned_at: string;
  last_active: string;
  consent_status: 'pending' | 'granted' | 'revoked';
  data_retention_days: number;
}

interface DSARRequest {
  id: string;
  user_id: string;
  email: string;
  request_type: 'access' | 'deletion' | 'portability' | 'rectification';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
  completed_at?: string;
  notes?: string;
}

interface LegalHold {
  id: string;
  user_id: string;
  email: string;
  reason: string;
  created_by: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
}

async function fetchUserAssignments(): Promise<UserAssignment[]> {
  const res = await fetch('/api/admin/user-registry/assignments');
  if (!res.ok) throw new Error('Failed to fetch assignments');
  const data = await res.json();
  return data.assignments || [];
}

async function fetchDSARRequests(): Promise<DSARRequest[]> {
  const res = await fetch('/api/admin/user-registry/dsar');
  if (!res.ok) throw new Error('Failed to fetch DSAR requests');
  const data = await res.json();
  return data.requests || [];
}

async function fetchLegalHolds(): Promise<LegalHold[]> {
  const res = await fetch('/api/admin/user-registry/legal-holds');
  if (!res.ok) throw new Error('Failed to fetch legal holds');
  const data = await res.json();
  return data.holds || [];
}

export default function UserRegistryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAssignment | null>(null);
  const [dsarDialogOpen, setDsarDialogOpen] = useState(false);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-assignments'],
    queryFn: fetchUserAssignments,
  });

  const { data: dsarRequests = [], isLoading: dsarLoading } = useQuery({
    queryKey: ['dsar-requests'],
    queryFn: fetchDSARRequests,
  });

  const { data: legalHolds = [], isLoading: holdsLoading } = useQuery({
    queryKey: ['legal-holds'],
    queryFn: fetchLegalHolds,
  });

  const filteredAssignments = assignments.filter(a => 
    a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingDSAR = dsarRequests.filter(r => r.status === 'pending').length;
  const activeHolds = legalHolds.filter(h => h.is_active).length;

  const getConsentBadge = (status: string) => {
    switch (status) {
      case 'granted': return <Badge className="bg-green-500">Granted</Badge>;
      case 'revoked': return <Badge variant="destructive">Revoked</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getDSARStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500">Completed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          User Registry
        </h1>
        <p className="text-muted-foreground mt-1">
          GDPR/CCPA compliance, consent management, and data subject requests
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{assignments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Consent Granted</CardDescription>
            <CardTitle className="text-3xl text-green-500">
              {assignments.filter(a => a.consent_status === 'granted').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending DSAR</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{pendingDSAR}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Legal Holds</CardDescription>
            <CardTitle className="text-3xl text-red-500">{activeHolds}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Assignments</TabsTrigger>
          <TabsTrigger value="dsar">
            DSAR Requests
            {pendingDSAR > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingDSAR}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="holds">Legal Holds</TabsTrigger>
          <TabsTrigger value="consent">Consent Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Assignments</CardTitle>
                  <CardDescription>Manage user data and consent status</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Consent</TableHead>
                      <TableHead>Data Retention</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>{getConsentBadge(user.consent_status)}</TableCell>
                        <TableCell>{user.data_retention_days} days</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.last_active).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" title="View Data">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Export Data">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete Data" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dsar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Subject Access Requests
              </CardTitle>
              <CardDescription>
                Handle GDPR/CCPA data access, deletion, and portability requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dsarLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : dsarRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending DSAR requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dsarRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">{request.id.slice(0, 8)}</TableCell>
                        <TableCell>{request.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{request.request_type}</Badge>
                        </TableCell>
                        <TableCell>{getDSARStatusBadge(request.status)}</TableCell>
                        <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Process</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holds" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Legal Holds
                  </CardTitle>
                  <CardDescription>
                    Prevent data deletion for legal or compliance purposes
                  </CardDescription>
                </div>
                <Button>
                  <Lock className="h-4 w-4 mr-2" />
                  Create Hold
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {holdsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : legalHolds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active legal holds</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {legalHolds.map((hold) => (
                      <TableRow key={hold.id}>
                        <TableCell>{hold.email}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{hold.reason}</TableCell>
                        <TableCell>{hold.created_by}</TableCell>
                        <TableCell>{new Date(hold.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {hold.expires_at ? new Date(hold.expires_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          {hold.is_active ? (
                            <Badge className="bg-red-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Released</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Release</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Consent Audit Log
              </CardTitle>
              <CardDescription>
                Track all consent changes for compliance auditing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Consent audit log shows all consent grants and revocations</p>
                <Button variant="outline" className="mt-4">
                  <Download className="h-4 w-4 mr-2" />
                  Export Audit Log
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
