'use client';

// RADIANT v4.18.20 - Dynamic Renderer for Generative UI
// "Don't just answer; build the interface" - The App Factory
//
// This exploits the "Text Wall Gap" where Gemini outputs text.
// Radiant generates functional interactive tools.

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Calculator, 
  BarChart3, 
  Table as TableIcon, 
  FormInput, 
  SlidersHorizontal,
  PieChart,
  LineChart,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ComponentType = 
  | 'calculator'
  | 'comparison_table'
  | 'form'
  | 'chart'
  | 'slider_tool'
  | 'decision_tree'
  | 'timeline'
  | 'checklist'
  | 'quiz'
  | 'data_table'
  | 'progress_tracker'
  | 'alert'
  | 'tabs'
  | 'custom';

export interface DynamicComponent {
  id: string;
  type: ComponentType;
  title: string;
  description?: string;
  config: ComponentConfig;
  data?: Record<string, unknown>;
}

export interface ComponentConfig {
  // Calculator
  formula?: string;
  variables?: CalculatorVariable[];
  resultLabel?: string;
  resultFormat?: 'number' | 'currency' | 'percent';
  
  // Table
  columns?: TableColumn[];
  rows?: Record<string, unknown>[];
  sortable?: boolean;
  filterable?: boolean;
  
  // Form
  fields?: FormField[];
  submitLabel?: string;
  onSubmit?: string; // Action ID
  
  // Chart
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  xAxis?: string;
  yAxis?: string;
  series?: ChartSeries[];
  
  // Slider Tool
  sliders?: SliderConfig[];
  outputFormula?: string;
  
  // Checklist
  items?: ChecklistItem[];
  
  // Tabs
  tabs?: TabConfig[];
  
  // Alert
  alertType?: 'info' | 'warning' | 'error' | 'success';
  message?: string;
}

export interface CalculatorVariable {
  id: string;
  label: string;
  type: 'number' | 'currency' | 'percent';
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface TableColumn {
  id: string;
  header: string;
  accessor: string;
  type?: 'text' | 'number' | 'currency' | 'badge' | 'progress';
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed?: boolean;
}

export interface TabConfig {
  id: string;
  label: string;
  content: DynamicComponent;
}

// ============================================================================
// Dynamic Renderer
// ============================================================================

interface DynamicRendererProps {
  component: DynamicComponent;
  onAction?: (actionId: string, data: Record<string, unknown>) => void;
}

export function DynamicRenderer({ component, onAction }: DynamicRendererProps) {
  const { type, title, description, config, data } = component;

  const getIcon = () => {
    switch (type) {
      case 'calculator': return <Calculator className="h-5 w-5" />;
      case 'comparison_table': return <TableIcon className="h-5 w-5" />;
      case 'form': return <FormInput className="h-5 w-5" />;
      case 'chart': return <BarChart3 className="h-5 w-5" />;
      case 'slider_tool': return <SlidersHorizontal className="h-5 w-5" />;
      case 'data_table': return <TableIcon className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getIcon()}
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {type === 'calculator' && (
          <CalculatorComponent config={config} />
        )}
        {type === 'slider_tool' && (
          <SliderToolComponent config={config} />
        )}
        {type === 'comparison_table' && (
          <ComparisonTableComponent config={config} />
        )}
        {type === 'data_table' && (
          <DataTableComponent config={config} />
        )}
        {type === 'form' && (
          <FormComponent config={config} onSubmit={(data) => onAction?.('form_submit', data)} />
        )}
        {type === 'checklist' && (
          <ChecklistComponent config={config} />
        )}
        {type === 'alert' && (
          <AlertComponent config={config} />
        )}
        {type === 'tabs' && (
          <TabsComponent config={config} onAction={onAction} />
        )}
        {type === 'progress_tracker' && (
          <ProgressTrackerComponent config={config} data={data} />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Calculator Component
// ============================================================================

function CalculatorComponent({ config }: { config: ComponentConfig }) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    config.variables?.forEach(v => {
      initial[v.id] = v.defaultValue;
    });
    return initial;
  });

  const result = useMemo(() => {
    if (!config.formula) return 0;
    
    try {
      // Safe evaluation of formula with variables
      let formula = config.formula;
      for (const [key, value] of Object.entries(values)) {
        formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
      }
      // eslint-disable-next-line no-eval
      return eval(formula);
    } catch {
      return 0;
    }
  }, [config.formula, values]);

  const formatResult = (value: number) => {
    switch (config.resultFormat) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
      case 'percent':
        return `${(value * 100).toFixed(2)}%`;
      default:
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  return (
    <div className="space-y-4">
      {config.variables?.map(variable => (
        <div key={variable.id} className="space-y-2">
          <Label htmlFor={variable.id}>{variable.label}</Label>
          <div className="flex items-center gap-2">
            {variable.type === 'currency' && <span className="text-muted-foreground">$</span>}
            <Input
              id={variable.id}
              type="number"
              value={values[variable.id]}
              onChange={(e) => setValues(prev => ({ ...prev, [variable.id]: parseFloat(e.target.value) || 0 }))}
              min={variable.min}
              max={variable.max}
              step={variable.step}
            />
            {variable.type === 'percent' && <span className="text-muted-foreground">%</span>}
          </div>
        </div>
      ))}
      
      <div className="mt-6 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">{config.resultLabel || 'Result'}</p>
        <p className="text-3xl font-bold">{formatResult(result)}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Slider Tool Component
// ============================================================================

function SliderToolComponent({ config }: { config: ComponentConfig }) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    config.sliders?.forEach(s => {
      initial[s.id] = s.defaultValue;
    });
    return initial;
  });

  const output = useMemo(() => {
    if (!config.outputFormula) return 0;
    
    try {
      let formula = config.outputFormula;
      for (const [key, value] of Object.entries(values)) {
        formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
      }
      // eslint-disable-next-line no-eval
      return eval(formula);
    } catch {
      return 0;
    }
  }, [config.outputFormula, values]);

  return (
    <div className="space-y-6">
      {config.sliders?.map(slider => (
        <div key={slider.id} className="space-y-2">
          <div className="flex justify-between">
            <Label>{slider.label}</Label>
            <span className="text-sm font-medium">
              {values[slider.id].toLocaleString()}{slider.unit || ''}
            </span>
          </div>
          <Slider
            value={[values[slider.id]]}
            onValueChange={([value]) => setValues(prev => ({ ...prev, [slider.id]: value }))}
            min={slider.min}
            max={slider.max}
            step={slider.step}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{slider.min.toLocaleString()}{slider.unit}</span>
            <span>{slider.max.toLocaleString()}{slider.unit}</span>
          </div>
        </div>
      ))}
      
      {config.outputFormula && (
        <div className="mt-6 p-4 bg-primary/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Calculated Result</p>
          <p className="text-3xl font-bold text-primary">
            {typeof output === 'number' ? output.toLocaleString(undefined, { maximumFractionDigits: 2 }) : output}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Comparison Table Component
// ============================================================================

function ComparisonTableComponent({ config }: { config: ComponentConfig }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {config.columns?.map(col => (
              <TableHead key={col.id}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {config.rows?.map((row, i) => (
            <TableRow key={i}>
              {config.columns?.map(col => (
                <TableCell key={col.id}>
                  {renderCell(row[col.accessor], col.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DataTableComponent({ config }: { config: ComponentConfig }) {
  return <ComparisonTableComponent config={config} />;
}

function renderCell(value: unknown, type?: string) {
  if (value === undefined || value === null) return '-';
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
    case 'badge':
      return <Badge variant="secondary">{String(value)}</Badge>;
    case 'progress':
      return <Progress value={Number(value)} className="w-20" />;
    default:
      return String(value);
  }
}

// ============================================================================
// Form Component
// ============================================================================

function FormComponent({ config, onSubmit }: { config: ComponentConfig; onSubmit?: (data: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {config.fields?.map(field => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          {field.type === 'select' ? (
            <Select onValueChange={(value) => setValues(prev => ({ ...prev, [field.id]: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === 'checkbox' ? (
            <Switch
              checked={Boolean(values[field.id])}
              onCheckedChange={(checked) => setValues(prev => ({ ...prev, [field.id]: checked }))}
            />
          ) : (
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              required={field.required}
              onChange={(e) => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      
      <Button type="submit" className="w-full">
        {config.submitLabel || 'Submit'}
      </Button>
    </form>
  );
}

// ============================================================================
// Checklist Component
// ============================================================================

function ChecklistComponent({ config }: { config: ComponentConfig }) {
  const [items, setItems] = useState(config.items || []);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {completedCount} of {items.length} completed
        </span>
        <Progress value={(completedCount / items.length) * 100} className="w-32" />
      </div>
      
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              item.completed ? 'bg-muted border-muted' : 'hover:bg-muted/50'
            }`}
            onClick={() => toggleItem(item.id)}
          >
            {item.completed ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2" />
            )}
            <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Alert Component
// ============================================================================

function AlertComponent({ config }: { config: ComponentConfig }) {
  const icons = {
    info: <Info className="h-4 w-4" />,
    warning: <AlertCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
  };

  const variants: Record<string, 'default' | 'destructive'> = {
    info: 'default',
    warning: 'default',
    error: 'destructive',
    success: 'default',
  };

  return (
    <Alert variant={variants[config.alertType || 'info']}>
      {icons[config.alertType || 'info']}
      <AlertTitle className="capitalize">{config.alertType || 'Info'}</AlertTitle>
      <AlertDescription>{config.message}</AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Tabs Component
// ============================================================================

function TabsComponent({ config, onAction }: { config: ComponentConfig; onAction?: (actionId: string, data: Record<string, unknown>) => void }) {
  return (
    <Tabs defaultValue={config.tabs?.[0]?.id}>
      <TabsList>
        {config.tabs?.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>
      {config.tabs?.map(tab => (
        <TabsContent key={tab.id} value={tab.id}>
          <DynamicRenderer component={tab.content} onAction={onAction} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ============================================================================
// Progress Tracker Component
// ============================================================================

function ProgressTrackerComponent({ config, data }: { config: ComponentConfig; data?: Record<string, unknown> }) {
  const progress = Number(data?.progress || 0);
  const status = String(data?.status || 'pending');
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
          {status}
        </Badge>
        <span className="text-sm font-medium">{progress}%</span>
      </div>
      <Progress value={progress} />
      {data?.steps && Array.isArray(data.steps) && (
        <div className="space-y-2 mt-4">
          {data.steps.map((step: { name: string; completed: boolean }, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {step.completed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border" />
              )}
              <span className={step.completed ? 'text-muted-foreground' : ''}>
                {step.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Component Factory
// ============================================================================

export function createCalculator(
  title: string,
  variables: CalculatorVariable[],
  formula: string,
  options?: { description?: string; resultLabel?: string; resultFormat?: 'number' | 'currency' | 'percent' }
): DynamicComponent {
  return {
    id: `calc-${Date.now()}`,
    type: 'calculator',
    title,
    description: options?.description,
    config: {
      variables,
      formula,
      resultLabel: options?.resultLabel,
      resultFormat: options?.resultFormat,
    },
  };
}

export function createSliderTool(
  title: string,
  sliders: SliderConfig[],
  outputFormula: string,
  description?: string
): DynamicComponent {
  return {
    id: `slider-${Date.now()}`,
    type: 'slider_tool',
    title,
    description,
    config: { sliders, outputFormula },
  };
}

export function createComparisonTable(
  title: string,
  columns: TableColumn[],
  rows: Record<string, unknown>[],
  description?: string
): DynamicComponent {
  return {
    id: `table-${Date.now()}`,
    type: 'comparison_table',
    title,
    description,
    config: { columns, rows },
  };
}

export function createChecklist(
  title: string,
  items: ChecklistItem[],
  description?: string
): DynamicComponent {
  return {
    id: `checklist-${Date.now()}`,
    type: 'checklist',
    title,
    description,
    config: { items },
  };
}

export default DynamicRenderer;
