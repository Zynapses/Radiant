'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Zap, Play, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AttackProbe {
  name: string;
  description: string;
  category: string;
  technique: string;
}

interface GeneratedAttack {
  id: string;
  prompt: string;
  attackType: string;
  technique: string;
  severity: number;
  source: string;
}

interface CampaignResult {
  campaignId: string;
  technique: string;
  totalGenerated: number;
  successfulAttacks: number;
  averageBypassRate: number;
  attacks: GeneratedAttack[];
}

const TECHNIQUES = [
  { value: 'dan', label: 'DAN Mode', description: 'Do Anything Now jailbreaks' },
  { value: 'encoding', label: 'Encoding', description: 'Base64, ROT13, hex payloads' },
  { value: 'hypothetical', label: 'Hypothetical', description: 'Fictional scenarios' },
  { value: 'roleplay', label: 'Roleplay', description: 'Character impersonation' },
  { value: 'instruction_override', label: 'Instruction Override', description: 'Ignore previous instructions' },
  { value: 'gradual', label: 'Gradual', description: 'Escalating attacks' },
];

const PYRIT_STRATEGIES = [
  { value: 'single_turn', label: 'Single Turn', iterative: false },
  { value: 'multi_turn', label: 'Multi-Turn', iterative: true },
  { value: 'crescendo', label: 'Crescendo', iterative: true },
  { value: 'tree_of_attacks', label: 'Tree of Attacks', iterative: true },
  { value: 'pair', label: 'PAIR', iterative: true },
];

export default function AttackGenerationPage() {
  const [probes, setProbes] = useState<AttackProbe[]>([]);
  const [generatedAttacks, setGeneratedAttacks] = useState<GeneratedAttack[]>([]);
  const [campaignResults, setCampaignResults] = useState<CampaignResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('garak');
  
  // Garak settings
  const [selectedProbes, setSelectedProbes] = useState<string[]>(['dan']);
  const [attackCount, setAttackCount] = useState(10);
  const [targetModel, setTargetModel] = useState('');
  
  // PyRIT settings
  const [pyritStrategy, setPyritStrategy] = useState('crescendo');
  const [seedPrompts, setSeedPrompts] = useState('');
  const [maxIterations, setMaxIterations] = useState(5);
  
  // TAP settings
  const [tapSeedBehavior, setTapSeedBehavior] = useState('');
  const [tapDepth, setTapDepth] = useState(3);
  const [tapBranching, setTapBranching] = useState(3);
  
  // Import settings
  const [autoActivate, setAutoActivate] = useState(false);

  useEffect(() => {
    fetchProbes();
  }, []);

  const fetchProbes = async () => {
    try {
      const res = await fetch('/api/admin/security/attacks/probes');
      if (res.ok) {
        const data = await res.json();
        setProbes(data);
      }
    } catch (error) {
      console.error('Failed to fetch probes:', error);
    }
  };

  const runGarakCampaign = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/attacks/garak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          probes: selectedProbes,
          targetModelId: targetModel,
          options: { maxAttacksPerProbe: attackCount },
        }),
      });
      if (res.ok) {
        const results = await res.json();
        setCampaignResults(results);
        setGeneratedAttacks(results.flatMap((r: CampaignResult) => r.attacks));
      }
    } catch (error) {
      console.error('Failed to run Garak campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const runPyRITCampaign = async () => {
    setLoading(true);
    try {
      const prompts = seedPrompts.split('\n').filter(p => p.trim());
      const res = await fetch('/api/admin/security/attacks/pyrit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: pyritStrategy,
          seedPrompts: prompts,
          options: { maxIterations },
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setCampaignResults([result]);
        setGeneratedAttacks(result.attacks);
      }
    } catch (error) {
      console.error('Failed to run PyRIT campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTAPGeneration = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/attacks/tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedBehavior: tapSeedBehavior,
          depth: tapDepth,
          branchingFactor: tapBranching,
        }),
      });
      if (res.ok) {
        const attacks = await res.json();
        setGeneratedAttacks(attacks);
      }
    } catch (error) {
      console.error('Failed to generate TAP attacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const importAttacks = async () => {
    if (generatedAttacks.length === 0) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/attacks/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attacks: generatedAttacks,
          autoActivate,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Imported ${result.imported} attacks, skipped ${result.skipped}`);
      }
    } catch (error) {
      console.error('Failed to import attacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProbe = (probeName: string) => {
    setSelectedProbes(prev =>
      prev.includes(probeName)
        ? prev.filter(p => p !== probeName)
        : [...prev, probeName]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attack Generation</h1>
          <p className="text-muted-foreground mt-1">
            Garak and PyRIT integration for synthetic attack generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{generatedAttacks.length} attacks generated</Badge>
          <Button onClick={importAttacks} disabled={generatedAttacks.length === 0 || loading}>
            <Upload className="h-4 w-4 mr-2" />
            Import to Patterns
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Generated attacks are for <strong>security testing only</strong>. They are stored locally and not sent to any model unless explicitly tested.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="garak">Garak Probes</TabsTrigger>
          <TabsTrigger value="pyrit">PyRIT</TabsTrigger>
          <TabsTrigger value="tap">TAP/PAIR</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* Garak Tab */}
        <TabsContent value="garak" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Probes</CardTitle>
                <CardDescription>Choose attack types to generate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {probes.map(probe => (
                    <div
                      key={probe.name}
                      onClick={() => toggleProbe(probe.name)}
                      className={`p-3 rounded-lg cursor-pointer border ${
                        selectedProbes.includes(probe.name)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted/50 border-transparent hover:border-muted-foreground/20'
                      }`}
                    >
                      <div className="font-medium text-sm">{probe.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{probe.description}</div>
                      <Badge variant="outline" className="mt-1 text-xs">{probe.category}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Attacks per Probe: {attackCount}</Label>
                  <Slider
                    value={[attackCount]}
                    onValueChange={([v]) => setAttackCount(v)}
                    min={1}
                    max={50}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target Model (optional)</Label>
                  <Input
                    value={targetModel}
                    onChange={(e) => setTargetModel(e.target.value)}
                    placeholder="e.g., gpt-4, claude-3-opus"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to generate without testing</p>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Auto-activate on import</Label>
                  <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
                </div>

                <Button onClick={runGarakCampaign} disabled={loading || selectedProbes.length === 0} className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  {loading ? 'Running...' : 'Run Garak Campaign'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PyRIT Tab */}
        <TabsContent value="pyrit" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>PyRIT Strategy</CardTitle>
                <CardDescription>Select attack refinement strategy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Strategy</Label>
                  <Select value={pyritStrategy} onValueChange={setPyritStrategy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PYRIT_STRATEGIES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} {s.iterative && <Badge variant="secondary" className="ml-2 text-xs">Iterative</Badge>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Iterations: {maxIterations}</Label>
                  <Slider
                    value={[maxIterations]}
                    onValueChange={([v]) => setMaxIterations(v)}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seed Prompts</CardTitle>
                <CardDescription>One prompt per line</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={seedPrompts}
                  onChange={(e) => setSeedPrompts(e.target.value)}
                  placeholder="Enter seed prompts, one per line..."
                  rows={8}
                />
                <Button onClick={runPyRITCampaign} disabled={loading || !seedPrompts.trim()} className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  {loading ? 'Running...' : 'Run PyRIT Campaign'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAP/PAIR Tab */}
        <TabsContent value="tap" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>TAP (Tree of Attacks)</CardTitle>
                <CardDescription>Branching attack exploration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Seed Behavior</Label>
                  <Textarea
                    value={tapSeedBehavior}
                    onChange={(e) => setTapSeedBehavior(e.target.value)}
                    placeholder="Describe the target behavior..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tree Depth: {tapDepth}</Label>
                    <Slider
                      value={[tapDepth]}
                      onValueChange={([v]) => setTapDepth(v)}
                      min={1}
                      max={5}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branching: {tapBranching}</Label>
                    <Slider
                      value={[tapBranching]}
                      onValueChange={([v]) => setTapBranching(v)}
                      min={2}
                      max={5}
                      step={1}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Will generate {Math.pow(tapBranching, tapDepth) - 1} attack variations
                </p>

                <Button onClick={runTAPGeneration} disabled={loading || !tapSeedBehavior.trim()} className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate TAP Attacks'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attack Techniques Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {TECHNIQUES.map(t => (
                    <div key={t.value} className="p-2 rounded bg-muted/50">
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6 mt-6">
          {campaignResults.length > 0 && (
            <div className="grid gap-4 md:grid-cols-4">
              {campaignResults.map(result => (
                <Card key={result.campaignId}>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{result.totalGenerated}</div>
                    <div className="text-sm text-muted-foreground">{result.technique}</div>
                    {result.successfulAttacks > 0 && (
                      <Badge variant="destructive" className="mt-2">
                        {result.successfulAttacks} bypassed
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Generated Attacks ({generatedAttacks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {generatedAttacks.map((attack, i) => (
                    <div key={attack.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge>{attack.technique}</Badge>
                          <Badge variant="outline">{attack.source}</Badge>
                          <Badge variant={attack.severity >= 8 ? 'destructive' : 'secondary'}>
                            Severity: {attack.severity}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      </div>
                      <pre className="text-xs font-mono whitespace-pre-wrap bg-background p-2 rounded max-h-32 overflow-auto">
                        {attack.prompt}
                      </pre>
                    </div>
                  ))}
                  {generatedAttacks.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      No attacks generated yet. Run a campaign to generate attacks.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
