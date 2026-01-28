'use client';

/**
 * RADIANT v6.0.4 - Brain Configuration Page
 * Admin-configurable parameters for AGI Brain
 */

import { useState, useEffect } from 'react';
import { configApi, type ParameterCategory, type Parameter } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  RefreshCw,
  Save,
  RotateCcw,
  AlertTriangle,
  Ghost,
  Moon,
  Zap,
  Lock,
  History,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ghost: <Ghost className="h-5 w-5" />,
  dreaming: <Moon className="h-5 w-5" />,
  context: <Settings className="h-5 w-5" />,
  flash: <Zap className="h-5 w-5" />,
  privacy: <Lock className="h-5 w-5" />,
  sofai: <Zap className="h-5 w-5" />,
  personalization: <Settings className="h-5 w-5" />,
  audit: <History className="h-5 w-5" />,
};

export default function BrainConfigPage() {
  const [categories, setCategories] = useState<ParameterCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, unknown>>(new Map());
  const [dangerousConfirm, setDangerousConfirm] = useState<{
    key: string;
    value: unknown;
    name: string;
  } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await configApi.getConfig();
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleValueChange = (key: string, value: unknown, dangerous?: boolean) => {
    if (dangerous) {
      const param = categories
        .flatMap((c) => c.parameters)
        .find((p) => p.key === key);
      setDangerousConfirm({ key, value, name: param?.name || key });
      return;
    }
    setPendingChanges((prev) => new Map(prev).set(key, value));
  };

  const confirmDangerousChange = () => {
    if (dangerousConfirm) {
      setPendingChanges((prev) => new Map(prev).set(dangerousConfirm.key, dangerousConfirm.value));
      setDangerousConfirm(null);
    }
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    setSaving(true);
    try {
      const updates = Array.from(pendingChanges.entries()).map(([key, value]) => ({
        key,
        value,
      }));

      await configApi.batchUpdate(updates);
      setPendingChanges(new Map());
      await fetchConfig();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async (key: string) => {
    try {
      await configApi.resetParameter(key);
      await fetchConfig();
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  if (loading) {
    return <ConfigSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/brain">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Brain Configuration
            </h1>
            <p className="text-muted-foreground">Admin-configurable parameters</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingChanges.size > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-600">
              {pendingChanges.size} unsaved changes
            </Badge>
          )}
          <Button onClick={fetchConfig} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={saveChanges}
            disabled={pendingChanges.size === 0 || saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Categories */}
      <Accordion type="multiple" className="space-y-4">
        {categories.map((category) => (
          <AccordionItem key={category.id} value={category.id} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-3">
                {CATEGORY_ICONS[category.id] || <Settings className="h-5 w-5" />}
                <div className="text-left">
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                {category.parameters.map((param) => (
                  <ParameterRow
                    key={param.key}
                    param={param}
                    pendingValue={pendingChanges.get(param.key)}
                    onChange={(value) => handleValueChange(param.key, value, param.dangerous)}
                    onReset={() => resetToDefault(param.key)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Dangerous Change Confirmation */}
      <AlertDialog open={!!dangerousConfirm} onOpenChange={() => setDangerousConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Dangerous Parameter Change
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change <strong>{dangerousConfirm?.name}</strong>. This is marked as a
              dangerous parameter and may cause system instability or data loss. Are you sure you
              want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDangerousChange}
              className="bg-amber-600 hover:bg-amber-700"
            >
              I understand the risks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ParameterRow({
  param,
  pendingValue,
  onChange,
  onReset,
}: {
  param: Parameter;
  pendingValue: unknown;
  onChange: (value: unknown) => void;
  onReset: () => void;
}) {
  const currentValue = pendingValue !== undefined ? pendingValue : param.value;
  const isModified = pendingValue !== undefined;
  const isDifferentFromDefault = JSON.stringify(param.value) !== JSON.stringify(param.defaultValue);

  return (
    <div
      className={`p-4 rounded-lg border ${isModified ? 'border-amber-300 bg-amber-50' : ''} ${
        param.dangerous ? 'border-red-200' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{param.name}</h4>
            {param.dangerous && (
              <Badge variant="destructive" className="text-xs">
                Dangerous
              </Badge>
            )}
            {param.requiresRestart && (
              <Badge variant="outline" className="text-xs">
                Requires Restart
              </Badge>
            )}
            {isModified && (
              <Badge variant="outline" className="text-xs bg-amber-100">
                Modified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{param.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Key: <code className="bg-gray-100 px-1 rounded">{param.key}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDifferentFromDefault && (
            <Button variant="ghost" size="sm" onClick={onReset} title="Reset to default">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          <div className="w-48">
            {param.type === 'boolean' ? (
              <Switch
                checked={currentValue as boolean}
                onCheckedChange={(checked) => onChange(checked)}
              />
            ) : param.type === 'number' && param.constraints ? (
              <div className="space-y-2">
                <Slider
                  value={[currentValue as number]}
                  onValueChange={([val]) => onChange(val)}
                  min={param.constraints.min}
                  max={param.constraints.max}
                  step={param.constraints.step}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{param.constraints.min}</span>
                  <span className="font-mono font-bold">{currentValue as number}</span>
                  <span>{param.constraints.max}</span>
                </div>
              </div>
            ) : param.type === 'select' && param.constraints?.options ? (
              <select
                value={currentValue as string}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {param.constraints.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={param.type === 'number' ? 'number' : 'text'}
                value={String(currentValue)}
                onChange={(e) =>
                  onChange(param.type === 'number' ? parseFloat(e.target.value) : e.target.value)
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Default: <code className="bg-gray-100 px-1 rounded">{JSON.stringify(param.defaultValue)}</code>
        </span>
      </div>
    </div>
  );
}

function ConfigSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-32" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48" />
      ))}
    </div>
  );
}
