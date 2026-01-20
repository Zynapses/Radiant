'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Zap, Users, Terminal, Map, FileCode, LayoutDashboard, MessageSquare, Settings, Activity, DollarSign } from 'lucide-react';

export default function PolymorphicUIPage() {
  const [enableAutoMorphing, setEnableAutoMorphing] = useState(true);
  const [enableGearbox, setEnableGearbox] = useState(true);
  const [enableCostDisplay, setEnableCostDisplay] = useState(true);
  const [enableEscalation, setEnableEscalation] = useState(true);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Polymorphic UI</h1>
          <p className="text-muted-foreground">Elastic Compute with Sniper/Scout/Sage views</p>
        </div>
        <Badge variant="outline" className="gap-1"><Zap className="h-3 w-3" />PROMPT-41</Badge>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" />Configuration</TabsTrigger>
          <TabsTrigger value="views" className="gap-2"><LayoutDashboard className="h-4 w-4" />View Types</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Feature Toggles</CardTitle>
                <CardDescription>Enable or disable Polymorphic UI features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5"><Label>Auto-Morphing</Label><p className="text-xs text-muted-foreground">Automatically morph UI based on query analysis</p></div>
                  <Switch checked={enableAutoMorphing} onCheckedChange={setEnableAutoMorphing} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5"><Label>Gearbox Toggle</Label><p className="text-xs text-muted-foreground">Show Sniper/War Room mode selector</p></div>
                  <Switch checked={enableGearbox} onCheckedChange={setEnableGearbox} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5"><Label>Cost Display</Label><p className="text-xs text-muted-foreground">Show estimated cost badges</p></div>
                  <Switch checked={enableCostDisplay} onCheckedChange={setEnableCostDisplay} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5"><Label>Escalation Button</Label><p className="text-xs text-muted-foreground">Allow users to escalate Sniper → War Room</p></div>
                  <Switch checked={enableEscalation} onCheckedChange={setEnableEscalation} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Cost Summary</CardTitle>
                <CardDescription>Execution mode cost comparison</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-green-500" />
                    <div><p className="font-medium">Sniper Mode</p><p className="text-xs text-muted-foreground">Single model, fast</p></div>
                  </div>
                  <Badge variant="outline" className="text-green-500 border-green-500">$0.01/run</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    <div><p className="font-medium">War Room Mode</p><p className="text-xs text-muted-foreground">Multi-agent ensemble</p></div>
                  </div>
                  <Badge variant="outline" className="text-purple-500 border-purple-500">$0.50+/run</Badge>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground text-center">Economic Governor auto-routes based on complexity</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="views" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5 text-green-500" />Sniper View</CardTitle><CardDescription>Command Center / Terminal</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Intent:</strong> Quick commands, lookups, fast execution</p>
                <p className="text-sm"><strong>Mode:</strong> Single model with Ghost Memory (read-only)</p>
                <p className="text-sm"><strong>Cost:</strong> ~$0.01/run</p>
                <Badge variant="secondary">terminal_simple</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Map className="h-5 w-5 text-blue-500" />Scout View</CardTitle><CardDescription>Infinite Canvas / Mind Map</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Intent:</strong> Research, exploration, strategy</p>
                <p className="text-sm"><strong>Mode:</strong> Multi-agent swarm with evidence clustering</p>
                <p className="text-sm"><strong>Cost:</strong> ~$0.50+/run</p>
                <Badge variant="secondary">mindmap</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileCode className="h-5 w-5 text-orange-500" />Sage View</CardTitle><CardDescription>Split-Screen Diff Editor</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Intent:</strong> Audit, compliance, validation</p>
                <p className="text-sm"><strong>Mode:</strong> Convergent with CBF verification</p>
                <p className="text-sm"><strong>Cost:</strong> ~$0.50+/run</p>
                <Badge variant="secondary">diff_editor</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-cyan-500" />Dashboard View</CardTitle><CardDescription>Analytics & Metrics</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Intent:</strong> Data visualization, metrics queries</p>
                <p className="text-sm"><strong>Mode:</strong> Adaptive based on data complexity</p>
                <Badge variant="secondary">dashboard</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-yellow-500" />Decision Cards</CardTitle><CardDescription>HITL Mission Control</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Intent:</strong> Human-in-the-loop escalations</p>
                <p className="text-sm"><strong>Mode:</strong> Triggered by uncertainty or policy</p>
                <Badge variant="secondary">decision_cards</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-gray-500" />Chat View</CardTitle><CardDescription>Default Conversation</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><strong>Intent:</strong> Standard conversational interface</p>
                <p className="text-sm"><strong>Mode:</strong> Fallback / default view</p>
                <Badge variant="secondary">chat</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
