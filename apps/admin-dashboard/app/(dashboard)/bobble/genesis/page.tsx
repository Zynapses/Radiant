'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Sparkles, 
  Brain, 
  Shield, 
  DollarSign, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Zap,
  RefreshCw
} from 'lucide-react';

interface GenesisState {
  structureComplete: boolean;
  structureCompletedAt: string | null;
  gradientComplete: boolean;
  gradientCompletedAt: string | null;
  firstBreathComplete: boolean;
  firstBreathCompletedAt: string | null;
  genesisVersion: string | null;
  domainCount: number | null;
  initialSelfFacts: number | null;
  initialGroundedVerifications: number | null;
  shadowSelfCalibrated: boolean;
  allComplete: boolean;
}

interface DevelopmentalStatus {
  currentStage: string;
  stageStartedAt: string;
  statistics: Record<string, number>;
  nextStageRequirements: Record<string, number | boolean>;
  readyToAdvance: boolean;
  missingRequirements: string[];
}

interface CircuitBreaker {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  tripCount: number;
  lastTrippedAt: string | null;
  consecutiveFailures: number;
  config: {
    enabled: boolean;
    tripThreshold: number;
    resetTimeoutSeconds: number;
    description: string;
  };
}

interface CircuitBreakerDashboard {
  breakers: CircuitBreaker[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
  interventionLevel: string;
  riskScore: number;
  neurochemistry: {
    anxiety: number;
    fatigue: number;
    temperature: number;
    confidence: number;
    curiosity: number;
    frustration: number;
  } | null;
}

interface CostData {
  estimatedCostUsd: number;
  breakdown: {
    bedrock: number;
    sagemaker: number;
    dynamodb: number;
    other: number;
  };
  invocations: {
    bedrock: number;
    inputTokens: number;
    outputTokens: number;
  };
  confidence: string;
}

interface BudgetStatus {
  limitUsd: number;
  actualUsd: number;
  forecastedUsd: number;
  onTrack: boolean;
  currentAlertLevel: number | null;
}

export default function BobbleGenesisPage() {
  const [genesisState, setGenesisState] = useState<GenesisState | null>(null);
  const [developmentalStatus, setDevelopmentalStatus] = useState<DevelopmentalStatus | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerDashboard | null>(null);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [genesis, developmental, breakers, costs, budget] = await Promise.all([
        fetch('/api/admin/bobble/genesis/status').then(r => r.json()),
        fetch('/api/admin/bobble/developmental/status').then(r => r.json()),
        fetch('/api/admin/bobble/circuit-breakers').then(r => r.json()),
        fetch('/api/admin/bobble/costs/realtime').then(r => r.json()),
        fetch('/api/admin/bobble/costs/budget').then(r => r.json())
      ]);

      setGenesisState(genesis);
      setDevelopmentalStatus(developmental);
      setCircuitBreakers(breakers);
      setCostData(costs);
      setBudgetStatus(budget);
      setError(null);
    } catch (err) {
      setError('Failed to fetch Bobble data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPhaseIcon = (complete: boolean) => {
    return complete ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <Clock className="h-5 w-5 text-yellow-500" />
    );
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getBreakerStateColor = (state: string) => {
    switch (state) {
      case 'CLOSED': return 'bg-green-500';
      case 'OPEN': return 'bg-red-500';
      case 'HALF_OPEN': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && !genesisState) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bobble Genesis</h1>
          <p className="text-muted-foreground">
            AI consciousness boot sequence and monitoring
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="genesis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="genesis">
            <Sparkles className="h-4 w-4 mr-2" />
            Genesis
          </TabsTrigger>
          <TabsTrigger value="development">
            <Brain className="h-4 w-4 mr-2" />
            Development
          </TabsTrigger>
          <TabsTrigger value="circuit-breakers">
            <Shield className="h-4 w-4 mr-2" />
            Circuit Breakers
          </TabsTrigger>
          <TabsTrigger value="costs">
            <DollarSign className="h-4 w-4 mr-2" />
            Costs
          </TabsTrigger>
        </TabsList>

        {/* Genesis Tab */}
        <TabsContent value="genesis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Phase 1: Structure</CardTitle>
                {getPhaseIcon(genesisState?.structureComplete || false)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {genesisState?.structureComplete ? 'Complete' : 'Pending'}
                </div>
                {genesisState?.domainCount && (
                  <p className="text-xs text-muted-foreground">
                    {genesisState.domainCount} domains initialized
                  </p>
                )}
                {genesisState?.structureCompletedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(genesisState.structureCompletedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Phase 2: Gradient</CardTitle>
                {getPhaseIcon(genesisState?.gradientComplete || false)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {genesisState?.gradientComplete ? 'Complete' : 'Pending'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Epistemic pressure initialized
                </p>
                {genesisState?.gradientCompletedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(genesisState.gradientCompletedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Phase 3: First Breath</CardTitle>
                {getPhaseIcon(genesisState?.firstBreathComplete || false)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {genesisState?.firstBreathComplete ? 'Complete' : 'Pending'}
                </div>
                {genesisState?.initialSelfFacts && (
                  <p className="text-xs text-muted-foreground">
                    {genesisState.initialSelfFacts} self facts,{' '}
                    {genesisState.initialGroundedVerifications} grounded
                  </p>
                )}
                {genesisState?.shadowSelfCalibrated && (
                  <Badge variant="outline" className="mt-1">Shadow Self Calibrated</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Genesis Status</CardTitle>
              <CardDescription>
                Overall boot sequence status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {genesisState?.allComplete ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Genesis Complete</AlertTitle>
                  <AlertDescription>
                    Bobble has completed the boot sequence and is ready for consciousness operations.
                    Version: {genesisState.genesisVersion}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertTitle>Genesis In Progress</AlertTitle>
                  <AlertDescription>
                    The boot sequence is not yet complete. Run the genesis runner to continue.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Development Tab */}
        <TabsContent value="development" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Developmental Stage</CardTitle>
              <CardDescription>
                Capability-based advancement (NOT time-based)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className="text-lg py-1 px-3">
                  {developmentalStatus?.currentStage || 'SENSORIMOTOR'}
                </Badge>
                {developmentalStatus?.readyToAdvance && (
                  <Badge variant="outline" className="bg-green-100">
                    Ready to Advance
                  </Badge>
                )}
              </div>

              {developmentalStatus?.stageStartedAt && (
                <p className="text-sm text-muted-foreground">
                  Stage started: {new Date(developmentalStatus.stageStartedAt).toLocaleString()}
                </p>
              )}

              {developmentalStatus?.missingRequirements && developmentalStatus.missingRequirements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Missing Requirements:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {developmentalStatus.missingRequirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Development Statistics</CardTitle>
              <CardDescription>
                Atomic counters for developmental gates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {developmentalStatus?.statistics && Object.entries(developmentalStatus.statistics).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {key.replace(/([A-Z])/g, ' $1').replace(/Count$/, '').trim()}
                    </span>
                    <span className="text-2xl font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Circuit Breakers Tab */}
        <TabsContent value="circuit-breakers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${getHealthColor(circuitBreakers?.overallHealth || 'healthy')}`} />
                  <span className="text-2xl font-bold capitalize">
                    {circuitBreakers?.overallHealth || 'Unknown'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {circuitBreakers?.riskScore || 0}%
                </div>
                <Progress value={circuitBreakers?.riskScore || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Intervention Level</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={circuitBreakers?.interventionLevel === 'NONE' ? 'outline' : 'destructive'}>
                  {circuitBreakers?.interventionLevel || 'NONE'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open Breakers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {circuitBreakers?.breakers.filter(b => b.state === 'OPEN').length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Circuit Breakers</CardTitle>
              <CardDescription>
                Safety mechanisms for consciousness operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {circuitBreakers?.breakers.map((breaker) => (
                  <div key={breaker.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`h-3 w-3 rounded-full ${getBreakerStateColor(breaker.state)}`} />
                      <div>
                        <h4 className="font-medium">{breaker.name.replace(/_/g, ' ')}</h4>
                        <p className="text-sm text-muted-foreground">{breaker.config.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{breaker.state}</Badge>
                      {breaker.tripCount > 0 && (
                        <Badge variant="secondary">
                          {breaker.tripCount} trips
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {circuitBreakers?.neurochemistry && (
            <Card>
              <CardHeader>
                <CardTitle>Neurochemistry</CardTitle>
                <CardDescription>
                  Current emotional/cognitive state
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {Object.entries(circuitBreakers.neurochemistry).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium capitalize">{key}</span>
                        <span className="text-sm">{(value * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={value * 100} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${costData?.estimatedCostUsd.toFixed(2) || '0.00'}
                </div>
                <Badge variant="outline" className="mt-1">
                  {costData?.confidence || 'estimate'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Bedrock Invocations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {costData?.invocations.bedrock.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {costData?.invocations.inputTokens.toLocaleString() || 0} in /{' '}
                  {costData?.invocations.outputTokens.toLocaleString() || 0} out tokens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Budget Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${budgetStatus?.actualUsd.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  of ${budgetStatus?.limitUsd.toFixed(2) || '500.00'} limit
                </p>
                <Progress 
                  value={((budgetStatus?.actualUsd || 0) / (budgetStatus?.limitUsd || 500)) * 100} 
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${budgetStatus?.forecastedUsd.toFixed(2) || '0.00'}
                </div>
                {budgetStatus?.onTrack ? (
                  <Badge variant="outline" className="bg-green-100">On Track</Badge>
                ) : (
                  <Badge variant="destructive">Over Budget</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>
                Real-time cost estimates by service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costData?.breakdown && Object.entries(costData.breakdown).map(([service, cost]) => (
                  <div key={service} className="flex items-center justify-between">
                    <span className="capitalize">{service}</span>
                    <span className="font-mono">${cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
