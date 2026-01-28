'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Mail, 
  UserPlus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  invited_by: string;
  accepted_at?: string;
}

async function fetchInvitations(): Promise<Invitation[]> {
  const res = await fetch('/api/admin/invitations');
  if (!res.ok) throw new Error('Failed to fetch invitations');
  const data = await res.json();
  return data.data || [];
}

async function createInvitation(data: { email: string; role: string; tenant_id: string }): Promise<void> {
  const res = await fetch('/api/admin/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create invitation');
}

async function revokeInvitation(id: string): Promise<void> {
  const res = await fetch(`/api/admin/invitations/${id}/revoke`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to revoke invitation');
}

async function resendInvitation(id: string): Promise<void> {
  const res = await fetch(`/api/admin/invitations/${id}/resend`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resend invitation');
}

export default function InvitationsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newTenant, setNewTenant] = useState('');
  void setNewTenant; // Reserved for tenant selection input

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: fetchInvitations,
  });

  const createMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation sent successfully');
      setDialogOpen(false);
      setNewEmail('');
      setNewRole('user');
    },
    onError: () => toast.error('Failed to send invitation'),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation revoked');
    },
    onError: () => toast.error('Failed to revoke invitation'),
  });

  const resendMutation = useMutation({
    mutationFn: resendInvitation,
    onSuccess: () => toast.success('Invitation resent'),
    onError: () => toast.error('Failed to resend invitation'),
  });

  const pendingCount = invitations.filter(i => i.status === 'pending').length;
  const acceptedCount = invitations.filter(i => i.status === 'accepted').length;
  const expiredCount = invitations.filter(i => i.status === 'expired').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="bg-green-500">Accepted</Badge>;
      case 'expired': return <Badge variant="secondary">Expired</Badge>;
      case 'revoked': return <Badge variant="destructive">Revoked</Badge>;
      default: return <Badge className="bg-blue-500">Pending</Badge>;
    }
  };

  const handleCreate = () => {
    if (!newEmail) {
      toast.error('Email is required');
      return;
    }
    createMutation.mutate({ email: newEmail, role: newRole, tenant_id: newTenant });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Invitations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user invitations and track acceptance status
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Invitation</DialogTitle>
              <DialogDescription>
                Invite a new user to join the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Invitations</CardDescription>
            <CardTitle className="text-3xl">{invitations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl text-blue-500">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Accepted</CardDescription>
            <CardTitle className="text-3xl text-green-500">{acceptedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expired</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{expiredCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invitations</CardTitle>
          <CardDescription>Track invitation status and manage pending invites</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invitations yet</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                Send First Invitation
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{inv.tenant_name}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resendMutation.mutate(inv.id)}
                            title="Resend"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => revokeMutation.mutate(inv.id)}
                            title="Revoke"
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
