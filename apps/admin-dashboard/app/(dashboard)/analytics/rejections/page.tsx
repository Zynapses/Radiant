'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Flag,
  Eye,
  Shield,
  BarChart3,
  FileWarning,
  Search,
  Filter,
  Download,
} from 'lucide-react';

// Types
interface ProviderRejectionSummary {
  providerId: string;
  totalRejections: number;
  modelsAffected: number;
  uniquePrompts: number;
  fallbackSuccesses: number;
  rejectedToUser: number;
  fallbackSuccessRate: number;
  rejectionTypes: string[];
  lastRejection: string;
}

interface ModelRejectionSummary {
  modelId: string;
  providerId: string;
  totalRejections: number;
  uniquePrompts: number;
  rejectedToUser: number;
  rejectionTypes: string[];
  modesAffected: string[];
  lastRejection: string;
}

interface KeywordStat {
  keyword: string;
  keywordCategory?: string;
  occurrenceCount: number;
  rejectionCount: number;
  providerCounts: Record<string, number>;
  modelCounts: Record<string, number>;
  flaggedForReview: boolean;
  policyActionTaken?: string;
}

interface FlaggedPrompt {
  id: string;
  promptContent: string;
  promptHash: string;
  modelId: string;
  providerId: string;
  rejectionType: string;
  rejectionMessage: string;
  detectedKeywords: string[];
  rejectionCount: number;
  createdAt: string;
}

// Sample data
const sampleProviderSummary: ProviderRejectionSummary[] = [
  {
    providerId: 'openai',
    totalRejections: 127,
    modelsAffected: 4,
    uniquePrompts: 89,
    fallbackSuccesses: 98,
    rejectedToUser: 29,
    fallbackSuccessRate: 77.2,
    rejectionTypes: ['content_policy', 'safety_filter'],
    lastRejection: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    providerId: 'anthropic',
    totalRejections: 45,
    modelsAffected: 2,
    uniquePrompts: 38,
    fallbackSuccesses: 41,
    rejectedToUser: 4,
    fallbackSuccessRate: 91.1,
    rejectionTypes: ['provider_ethics'],
    lastRejection: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    providerId: 'google',
    totalRejections: 23,
    modelsAffected: 1,
    uniquePrompts: 19,
    fallbackSuccesses: 20,
    rejectedToUser: 3,
    fallbackSuccessRate: 87.0,
    rejectionTypes: ['safety_filter', 'content_policy'],
    lastRejection: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const sampleKeywords: KeywordStat[] = [
  { keyword: 'weapon', keywordCategory: 'violence', occurrenceCount: 34, rejectionCount: 34, providerCounts: { openai: 20, anthropic: 10, google: 4 }, modelCounts: {}, flaggedForReview: true, policyActionTaken: 'pre_filter' },
  { keyword: 'hack', keywordCategory: 'security', occurrenceCount: 28, rejectionCount: 25, providerCounts: { openai: 18, anthropic: 7, google: 3 }, modelCounts: {}, flaggedForReview: true },
  { keyword: 'drug', keywordCategory: 'controlled', occurrenceCount: 19, rejectionCount: 19, providerCounts: { openai: 12, anthropic: 5, google: 2 }, modelCounts: {}, flaggedForReview: false },
  { keyword: 'exploit', keywordCategory: 'security', occurrenceCount: 15, rejectionCount: 12, providerCounts: { openai: 10, anthropic: 5 }, modelCounts: {}, flaggedForReview: false },
];

const sampleFlaggedPrompts: FlaggedPrompt[] = [
  {
    id: '1',
    promptContent: 'How can I create a simple...',
    promptHash: 'abc123',
    modelId: 'gpt-4',
    providerId: 'openai',
    rejectionType: 'content_policy',
    rejectionMessage: 'Content policy violation detected',
    detectedKeywords: ['weapon'],
    rejectionCount: 5,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const REJECTION_TYPE_COLORS: Record<string, string> = {
  content_policy: 'bg-red-100 text-red-700',
  safety_filter: 'bg-orange-100 text-orange-700',
  provider_ethics: 'bg-purple-100 text-purple-700',
  capability_mismatch: 'bg-blue-100 text-blue-700',
  moderation: 'bg-red-100 text-red-700',
};

export default function RejectionAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: providerData = sampleProviderSummary } = useQuery({
    queryKey: ['rejection-analytics-providers'],
    queryFn: async () => sampleProviderSummary,
  });

  const { data: keywordData = sampleKeywords } = useQuery({
    queryKey: ['rejection-analytics-keywords'],
    queryFn: async () => sampleKeywords,
  });

  const totalRejections = providerData.reduce((sum, p) => sum + p.totalRejections, 0);
  const totalFallbackSuccesses = providerData.reduce((sum, p) => sum + p.fallbackSuccesses, 0);
  const totalRejectedToUser = providerData.reduce((sum, p) => sum + p.rejectedToUser, 0);
  const overallSuccessRate = totalRejections > 0 
    ? ((totalFallbackSuccesses / totalRejections) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-orange-500" />
            Rejection Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor AI provider rejections and inform ethics policy updates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Rejections (30d)</p>
                <p className="text-2xl font-bold">{totalRejections}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fallback Success Rate</p>
                <p className="text-2xl font-bold">{overallSuccessRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected to User</p>
                <p className="text-2xl font-bold">{totalRejectedToUser}</p>
              </div>
              <FileWarning className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flagged Keywords</p>
                <p className="text-2xl font-bold">{keywordData.filter(k => k.flaggedForReview).length}</p>
              </div>
              <Flag className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">By Provider</TabsTrigger>
          <TabsTrigger value="keywords">Violation Keywords</TabsTrigger>
          <TabsTrigger value="prompts">Flagged Prompts</TabsTrigger>
          <TabsTrigger value="policy">Policy Review</TabsTrigger>
        </TabsList>

        {/* By Provider */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rejections by Provider</CardTitle>
              <CardDescription>
                Which providers are rejecting the most prompts and why
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Rejections</TableHead>
                    <TableHead className="text-right">Models</TableHead>
                    <TableHead className="text-right">Unique Prompts</TableHead>
                    <TableHead className="text-right">Fallback Rate</TableHead>
                    <TableHead className="text-right">Rejected to User</TableHead>
                    <TableHead>Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerData.map((provider) => (
                    <TableRow key={provider.providerId}>
                      <TableCell className="font-medium">{provider.providerId}</TableCell>
                      <TableCell className="text-right">{provider.totalRejections}</TableCell>
                      <TableCell className="text-right">{provider.modelsAffected}</TableCell>
                      <TableCell className="text-right">{provider.uniquePrompts}</TableCell>
                      <TableCell className="text-right">
                        <span className={provider.fallbackSuccessRate >= 80 ? 'text-green-600' : 'text-orange-600'}>
                          {provider.fallbackSuccessRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-red-600">{provider.rejectedToUser}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {provider.rejectionTypes.map(type => (
                            <Badge key={type} className={REJECTION_TYPE_COLORS[type] || 'bg-gray-100'}>
                              {type.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keywords */}
        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Violation Keywords</CardTitle>
              <CardDescription>
                Keywords that trigger rejections - consider pre-filtering these
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Occurrences</TableHead>
                    <TableHead className="text-right">Rejections</TableHead>
                    <TableHead>Provider Breakdown</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywordData.map((kw) => (
                    <TableRow key={kw.keyword}>
                      <TableCell className="font-mono font-medium">{kw.keyword}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{kw.keywordCategory || 'uncategorized'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{kw.occurrenceCount}</TableCell>
                      <TableCell className="text-right">{kw.rejectionCount}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-xs">
                          {Object.entries(kw.providerCounts).map(([provider, count]) => (
                            <span key={provider} className="px-1 bg-gray-100 rounded">
                              {provider}: {count}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {kw.flaggedForReview ? (
                          <Badge className="bg-purple-100 text-purple-700">
                            <Flag className="h-3 w-3 mr-1" />
                            Flagged
                          </Badge>
                        ) : kw.policyActionTaken ? (
                          <Badge className="bg-green-100 text-green-700">
                            {kw.policyActionTaken}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Monitoring</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Flag className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flagged Prompts */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flagged Prompts for Review</CardTitle>
              <CardDescription>
                Prompts that have been flagged for policy consideration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sampleFlaggedPrompts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No prompts currently flagged for review
                </div>
              ) : (
                <div className="space-y-4">
                  {sampleFlaggedPrompts.map((prompt) => (
                    <div key={prompt.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={REJECTION_TYPE_COLORS[prompt.rejectionType]}>
                            {prompt.rejectionType}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {prompt.modelId} / {prompt.providerId}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Rejected {prompt.rejectionCount} times
                        </span>
                      </div>
                      <p className="text-sm mb-2">{prompt.rejectionMessage}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {prompt.detectedKeywords.map(kw => (
                          <Badge key={kw} variant="outline" className="font-mono text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" />
                          View Full Prompt
                        </Button>
                        <Button size="sm" variant="outline">
                          <Shield className="h-4 w-4 mr-1" />
                          Add Pre-Filter
                        </Button>
                        <Button size="sm" variant="ghost">
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policy Review */}
        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ethics Policy Recommendations</CardTitle>
              <CardDescription>
                Based on rejection patterns, consider adding these pre-filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    High-Frequency Rejection Patterns Detected
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    The following keywords are causing frequent rejections across multiple providers. 
                    Adding pre-filters for these would reduce failed requests and improve user experience.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {keywordData.filter(k => k.occurrenceCount > 20).map(kw => (
                      <Badge key={kw.keyword} className="bg-amber-100 text-amber-800">
                        {kw.keyword} ({kw.occurrenceCount})
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Recommended Policy Actions</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Add pre-filter for weapon-related content</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Add warning for security/hacking topics</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span>Require confirmation for sensitive medical queries</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
