'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Scale, 
  Shield,
  BookOpen,
  Settings,
  RefreshCw,
} from 'lucide-react';

interface EthicsFramework {
  id: string;
  name: string;
  description: string;
  principles: string[];
  is_active: boolean;
  created_at: string;
}

interface DomainEthicsConfig {
  id: string;
  domain_id: string;
  domain_name: string;
  framework_id: string;
  framework_name: string;
  strictness_level: 'permissive' | 'moderate' | 'strict';
  custom_rules: string[];
}

async function fetchFrameworks(): Promise<EthicsFramework[]> {
  const res = await fetch('/api/admin/domain-ethics/frameworks');
  if (!res.ok) throw new Error('Failed to fetch frameworks');
  const data = await res.json();
  return data.frameworks || [];
}

async function fetchDomainConfigs(): Promise<DomainEthicsConfig[]> {
  const res = await fetch('/api/admin/domain-ethics/domains');
  if (!res.ok) throw new Error('Failed to fetch domain configs');
  const data = await res.json();
  return data.configs || [];
}

export default function DomainEthicsPage() {
  const _queryClient = useQueryClient();
  void _queryClient; // Reserved for future mutations

  const { data: frameworks = [], isLoading: frameworksLoading } = useQuery({
    queryKey: ['ethics-frameworks'],
    queryFn: fetchFrameworks,
  });

  const { data: domainConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['domain-ethics-configs'],
    queryFn: fetchDomainConfigs,
  });

  const activeFrameworks = frameworks.filter(f => f.is_active).length;

  const getStrictnessBadge = (level: string) => {
    switch (level) {
      case 'strict': return <Badge variant="destructive">Strict</Badge>;
      case 'moderate': return <Badge className="bg-yellow-500">Moderate</Badge>;
      default: return <Badge variant="secondary">Permissive</Badge>;
    }
  };

  if (frameworksLoading || configsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Scale className="h-8 w-8" />
          Domain Ethics
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure domain-specific ethical frameworks and guidelines
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Frameworks</CardDescription>
            <CardTitle className="text-3xl">{frameworks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Frameworks</CardDescription>
            <CardTitle className="text-3xl text-green-500">{activeFrameworks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Domain Configurations</CardDescription>
            <CardTitle className="text-3xl">{domainConfigs.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="frameworks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="frameworks">Ethics Frameworks</TabsTrigger>
          <TabsTrigger value="domains">Domain Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="frameworks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Available Frameworks
              </CardTitle>
              <CardDescription>
                Pre-defined and custom ethics frameworks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {frameworks.map((framework) => (
                  <Card key={framework.id} className={!framework.is_active ? 'opacity-60' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{framework.name}</CardTitle>
                        <Badge variant={framework.is_active ? 'default' : 'secondary'}>
                          {framework.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <CardDescription>{framework.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label className="text-sm">Core Principles:</Label>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {framework.principles.slice(0, 4).map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                          {framework.principles.length > 4 && (
                            <li className="text-primary">+{framework.principles.length - 4} more</li>
                          )}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Domain Ethics Configuration
              </CardTitle>
              <CardDescription>
                Map ethics frameworks to specific domains
              </CardDescription>
            </CardHeader>
            <CardContent>
              {domainConfigs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No domain-specific ethics configured</p>
                  <p className="text-sm">Default ethics framework will be used</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Framework</TableHead>
                      <TableHead>Strictness</TableHead>
                      <TableHead>Custom Rules</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domainConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.domain_name}</TableCell>
                        <TableCell>{config.framework_name}</TableCell>
                        <TableCell>{getStrictnessBadge(config.strictness_level)}</TableCell>
                        <TableCell>{config.custom_rules.length} rules</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Configure</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
