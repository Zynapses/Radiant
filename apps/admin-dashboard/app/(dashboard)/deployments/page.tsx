'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ArrowUpRight,
  History,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Deployment {
  id: string;
  version: string;
  environment: string;
  status: 'pending' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  startedAt: string;
  completedAt: string | null;
  startedBy: string;
  duration: number | null;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
  deploying: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-100' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
  rolled_back: { icon: History, color: 'text-orange-500', bg: 'bg-orange-100' },
};

export default function DeploymentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');

  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: ['deployments', statusFilter, environmentFilter],
    queryFn: async () => {
      // Mock data - in production would fetch from API
      return [
        {
          id: '1',
          version: '4.18.0',
          environment: 'production',
          status: 'completed',
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
          startedBy: 'admin@example.com',
          duration: 1800,
        },
        {
          id: '2',
          version: '4.18.0',
          environment: 'staging',
          status: 'completed',
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(),
          startedBy: 'dev@example.com',
          duration: 1200,
        },
        {
          id: '3',
          version: '4.17.0',
          environment: 'production',
          status: 'rolled_back',
          startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
          startedBy: 'admin@example.com',
          duration: 3600,
        },
      ];
    },
  });

  const completedCount = deployments?.filter(d => d.status === 'completed').length || 0;
  const failedCount = deployments?.filter(d => d.status === 'failed' || d.status === 'rolled_back').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            Deployments
          </h2>
          <p className="text-muted-foreground">View and manage deployment history</p>
        </div>
        <Button>
          <ArrowUpRight className="h-4 w-4 mr-2" />
          New Deployment
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deployments</CardDescription>
            <CardTitle className="text-3xl">{deployments?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-3xl text-green-500">{completedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed/Rolled Back</CardDescription>
            <CardTitle className="text-3xl text-red-500">{failedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl">
              {deployments?.length ? Math.round((completedCount / deployments.length) * 100) : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Deployment History</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="rolled_back">Rolled Back</SelectItem>
                </SelectContent>
              </Select>
              <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments?.map((deployment) => {
                  const config = statusConfig[deployment.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={deployment.id} data-testid="deployment-row">
                      <TableCell className="font-medium">v{deployment.version}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{deployment.environment}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${config.color}`} />
                          <span className="capitalize">{deployment.status.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(deployment.startedAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {deployment.duration ? `${Math.round(deployment.duration / 60)}m` : '-'}
                      </TableCell>
                      <TableCell>{deployment.startedBy}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
