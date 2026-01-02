'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  Plus,
  Edit,
  Sparkles,
  Brain,
  Target,
  Heart,
  Compass,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  displayName: string;
  description: string;
  scope: 'system' | 'tenant' | 'user';
  drives: {
    curiosity: number;
    achievement: number;
    service: number;
    discovery: number;
    reflection: number;
  };
  defaultGamma: number;
  isDefault: boolean;
  isActive: boolean;
}

const DRIVE_ICONS: Record<string, React.ReactNode> = {
  curiosity: <Sparkles className="h-4 w-4" />,
  achievement: <Target className="h-4 w-4" />,
  service: <Heart className="h-4 w-4" />,
  discovery: <Compass className="h-4 w-4" />,
  reflection: <Brain className="h-4 w-4" />,
};

const MOOD_COLORS: Record<string, string> = {
  balanced: 'bg-blue-500',
  scout: 'bg-green-500',
  sage: 'bg-purple-500',
  spark: 'bg-orange-500',
  guide: 'bg-teal-500',
};

interface DefaultMoodData {
  currentDefault: string;
  availableMoods: Array<{ name: string; display_name: string; description: string }>;
}

export default function CatoPersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [defaultMood, setDefaultMood] = useState<DefaultMoodData | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cato/personas');
      if (!response.ok) throw new Error('Failed to fetch personas');
      const data = await response.json();
      setPersonas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultMood = async () => {
    try {
      const response = await fetch('/api/admin/cato/default-mood');
      if (!response.ok) throw new Error('Failed to fetch default mood');
      const data = await response.json();
      setDefaultMood(data);
    } catch (err) {
      console.error('Failed to fetch default mood:', err);
    }
  };

  const saveDefaultMood = async (mood: string) => {
    setSavingDefault(true);
    try {
      const response = await fetch('/api/admin/cato/default-mood', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood }),
      });
      if (!response.ok) throw new Error('Failed to save default mood');
      await fetchDefaultMood();
    } catch (err) {
      console.error('Failed to save default mood:', err);
    } finally {
      setSavingDefault(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
    fetchDefaultMood();
  }, []);

  if (loading && personas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const systemPersonas = personas.filter((p) => p.scope === 'system');
  const tenantPersonas = personas.filter((p) => p.scope === 'tenant');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cato Personas</h1>
          <p className="text-muted-foreground">
            Manage AI moods and operating modes
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Persona
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Custom Persona</DialogTitle>
              <DialogDescription>
                Define a new AI mood for your organization
              </DialogDescription>
            </DialogHeader>
            <PersonaForm
              onSave={async (data) => {
                try {
                  const response = await fetch('/api/admin/cato/personas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                  });
                  if (!response.ok) throw new Error('Failed to create persona');
                  setIsCreateOpen(false);
                  fetchPersonas();
                } catch (err) {
                  console.error(err);
                }
              }}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tenant Default Mood Selector */}
      {defaultMood && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Tenant Default Mood
            </CardTitle>
            <CardDescription>
              Set the default operating mood for new users in your organization.
              Users can override this with their personal preference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {defaultMood.availableMoods.map((mood) => (
                <Button
                  key={mood.name}
                  variant={defaultMood.currentDefault === mood.name ? 'default' : 'outline'}
                  className={`${defaultMood.currentDefault === mood.name ? MOOD_COLORS[mood.name] : ''}`}
                  disabled={savingDefault}
                  onClick={() => saveDefaultMood(mood.name)}
                >
                  {mood.display_name}
                  {defaultMood.currentDefault === mood.name && ' ✓'}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <strong>Priority:</strong> Recovery Override → API Override → User Preference → <em>Tenant Default</em> → System Default
            </p>
          </CardContent>
        </Card>
      )}

      {/* System Personas (Moods) */}
      <div>
        <h2 className="text-xl font-semibold mb-4">System Moods</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Built-in operating modes. These cannot be edited but can be used by all tenants.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {systemPersonas.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} isEditable={false} />
          ))}
        </div>
      </div>

      {/* Tenant Personas */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Custom Personas</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Organization-specific personas you have created.
        </p>
        {tenantPersonas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No custom personas yet. Create one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tenantPersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isEditable={true}
                onEdit={() => setEditingPersona(persona)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editingPersona && (
        <Dialog open={!!editingPersona} onOpenChange={() => setEditingPersona(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Persona</DialogTitle>
              <DialogDescription>
                Modify {editingPersona.displayName}
              </DialogDescription>
            </DialogHeader>
            <PersonaForm
              initialData={editingPersona}
              onSave={async (data) => {
                try {
                  const response = await fetch(
                    `/api/admin/cato/personas/${editingPersona.id}`,
                    {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data),
                    }
                  );
                  if (!response.ok) throw new Error('Failed to update persona');
                  setEditingPersona(null);
                  fetchPersonas();
                } catch (err) {
                  console.error(err);
                }
              }}
              onCancel={() => setEditingPersona(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PersonaCard({
  persona,
  isEditable,
  onEdit,
}: {
  persona: Persona;
  isEditable: boolean;
  onEdit?: () => void;
}) {
  const moodColor = MOOD_COLORS[persona.name] || 'bg-gray-500';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full ${moodColor} flex items-center justify-center`}>
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{persona.displayName}</CardTitle>
              <CardDescription>{persona.name}</CardDescription>
            </div>
          </div>
          {isEditable && (
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{persona.description}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Default Gamma</span>
            <Badge variant="outline">{persona.defaultGamma.toFixed(1)}</Badge>
          </div>

          <div className="space-y-1">
            {Object.entries(persona.drives).map(([drive, value]) => (
              <div key={drive} className="flex items-center gap-2">
                {DRIVE_ICONS[drive]}
                <span className="text-xs capitalize flex-1">{drive}</span>
                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
                <span className="text-xs w-8 text-right">{(value * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {persona.isDefault && <Badge>Default</Badge>}
          <Badge variant={persona.scope === 'system' ? 'secondary' : 'outline'}>
            {persona.scope}
          </Badge>
          {!persona.isActive && <Badge variant="destructive">Inactive</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function PersonaForm({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: Persona;
  onSave: (data: Partial<Persona>) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    displayName: initialData?.displayName || '',
    description: initialData?.description || '',
    defaultGamma: initialData?.defaultGamma || 2.0,
    drives: initialData?.drives || {
      curiosity: 0.5,
      achievement: 0.5,
      service: 0.5,
      discovery: 0.5,
      reflection: 0.5,
    },
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Internal Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="my-persona"
            disabled={!!initialData}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="My Custom Persona"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="A brief description of this persona's behavior"
        />
      </div>

      <div className="space-y-2">
        <Label>Default Gamma: {formData.defaultGamma.toFixed(1)}</Label>
        <Slider
          value={[formData.defaultGamma]}
          onValueChange={([value]) => setFormData({ ...formData, defaultGamma: value })}
          min={0.5}
          max={5.0}
          step={0.1}
        />
        <p className="text-xs text-muted-foreground">
          Prior precision (confidence level). Higher = more confident.
        </p>
      </div>

      <div className="space-y-4">
        <Label>Drives (Active Inference C-Matrix)</Label>
        {Object.entries(formData.drives).map(([drive, value]) => (
          <div key={drive} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {DRIVE_ICONS[drive]}
                <span className="text-sm capitalize">{drive}</span>
              </div>
              <span className="text-sm">{(value * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[value]}
              onValueChange={([newValue]) =>
                setFormData({
                  ...formData,
                  drives: { ...formData.drives, [drive]: newValue },
                })
              }
              min={0}
              max={1}
              step={0.05}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
          {initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
