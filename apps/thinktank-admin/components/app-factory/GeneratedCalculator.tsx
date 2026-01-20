'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calculator, DollarSign, RefreshCw, Info } from 'lucide-react';

interface CalculatorInput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'slider' | 'select' | 'checkbox' | 'date' | 'color';
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: unknown }[];
  required?: boolean;
}

interface CalculatorOutput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'chart' | 'table';
  format?: string;
}

interface CalculatorComponentProps {
  id: string;
  title: string;
  description?: string;
  inputs: CalculatorInput[];
  outputs: CalculatorOutput[];
  formula: string;
  config?: Record<string, unknown>;
  onInteraction?: (inputId: string, value: unknown) => void;
  theme?: 'light' | 'dark' | 'auto';
}

const FORMULAS: Record<string, (inputs: Record<string, number>) => Record<string, number | string>> = {
  mortgage: (inputs) => {
    const { principal, rate, years } = inputs;
    const monthlyRate = rate / 100 / 12;
    const numPayments = years * 12;
    const monthly = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    const total = monthly * numPayments;
    const interest = total - principal;
    return { monthly, total, interest };
  },
  tip: (inputs) => {
    const { bill, tipPercent, people } = inputs;
    const tip = bill * (tipPercent / 100);
    const total = bill + tip;
    const perPerson = total / people;
    return { tip, total, perPerson };
  },
  bmi: (inputs) => {
    const { weight, feet, inches } = inputs;
    const heightInches = (feet * 12) + inches;
    const bmi = (weight / (heightInches * heightInches)) * 703;
    let category = 'Normal';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi >= 25 && bmi < 30) category = 'Overweight';
    else if (bmi >= 30) category = 'Obese';
    return { bmi: parseFloat(bmi.toFixed(1)), category };
  },
  compound: (inputs) => {
    const { principal, rate, years, compound } = inputs;
    const future = principal * Math.pow((1 + (rate / 100 / compound)), compound * years);
    const earnings = future - principal;
    return { future, earnings };
  },
  roi: (inputs) => {
    const { initial, final } = inputs;
    const gain = final - initial;
    const roi = ((final - initial) / initial) * 100;
    return { roi: parseFloat(roi.toFixed(2)), gain };
  },
  discount: (inputs) => {
    const { original, discount } = inputs;
    const savings = original * (discount / 100);
    const sale = original - savings;
    return { sale, savings };
  },
  percentage: (inputs) => {
    const { value, percentage } = inputs;
    const result = value * (percentage / 100);
    const remaining = value - result;
    return { result, remaining };
  },
  generic: (inputs) => {
    const { value1, value2, operation } = inputs;
    let result = value1;
    if (operation === 1) result = value1 + value2;
    else if (operation === 2) result = value1 - value2;
    else if (operation === 3) result = value1 * value2;
    else if (operation === 4) result = value2 !== 0 ? value1 / value2 : 0;
    return { result };
  },
};

/**
 * Interactive Calculator Component
 */
export function GeneratedCalculator({
  title,
  description,
  inputs,
  outputs,
  formula,
  onInteraction,
}: CalculatorComponentProps) {
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    inputs.forEach(input => {
      values[input.id] = input.defaultValue ?? (input.type === 'number' || input.type === 'slider' ? 0 : '');
    });
    return values;
  }, [inputs]);

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [results, setResults] = useState<Record<string, number | string>>({});

  useEffect(() => {
    const formulaFn = FORMULAS[formula];
    if (formulaFn) {
      const numericInputs: Record<string, number> = {};
      Object.entries(values).forEach(([key, val]) => {
        numericInputs[key] = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      });
      const computed = formulaFn(numericInputs);
      setResults(computed);
    }
  }, [values, formula]);

  const handleInputChange = useCallback((inputId: string, value: unknown) => {
    setValues(prev => ({ ...prev, [inputId]: value }));
    onInteraction?.(inputId, value);
  }, [onInteraction]);

  const handleReset = useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  const formatOutput = (value: number | string | undefined, format?: string): string => {
    if (value === undefined) return '—';
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'number':
      default:
        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              {description && <p className="text-sm text-white/80">{description}</p>}
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Reset to defaults"
          >
            <RefreshCw className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {inputs.map(input => (
          <div key={input.id} className="space-y-2">
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>{input.label}</span>
              {input.type === 'slider' && (
                <span className="text-purple-600 dark:text-purple-400 font-mono">
                  {values[input.id]?.toString()}
                  {input.id.toLowerCase().includes('rate') || input.id.toLowerCase().includes('percent') ? '%' : ''}
                </span>
              )}
            </label>
            
            {input.type === 'number' && (
              <div className="relative">
                {input.id.toLowerCase().includes('price') || input.id.toLowerCase().includes('amount') || 
                 input.id.toLowerCase().includes('cost') || input.id.toLowerCase().includes('principal') ||
                 input.id.toLowerCase().includes('initial') || input.id.toLowerCase().includes('final') ||
                 input.id.toLowerCase().includes('bill') || input.id.toLowerCase().includes('original') ? (
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                ) : null}
                <input
                  type="number"
                  value={values[input.id] as number}
                  onChange={(e) => handleInputChange(input.id, parseFloat(e.target.value) || 0)}
                  min={input.min}
                  max={input.max}
                  step={input.step}
                  className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                    input.id.toLowerCase().includes('price') || input.id.toLowerCase().includes('amount') ? 'pl-8' : ''
                  }`}
                />
              </div>
            )}
            
            {input.type === 'slider' && (
              <div className="space-y-1">
                <input
                  type="range"
                  value={values[input.id] as number}
                  onChange={(e) => handleInputChange(input.id, parseFloat(e.target.value))}
                  min={input.min ?? 0}
                  max={input.max ?? 100}
                  step={input.step ?? 1}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{input.min ?? 0}</span>
                  <span>{input.max ?? 100}</span>
                </div>
              </div>
            )}
            
            {input.type === 'select' && input.options && (
              <select
                value={values[input.id] as string}
                onChange={(e) => {
                  const option = input.options?.find(o => String(o.value) === e.target.value);
                  handleInputChange(input.id, option?.value ?? e.target.value);
                }}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {input.options.map(option => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700" />

      <div className="p-5 bg-gray-50 dark:bg-gray-900/50">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Results</h4>
        <div className={`grid gap-4 ${outputs.length === 1 ? 'grid-cols-1' : outputs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {outputs.map(output => (
            <div
              key={output.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{output.label}</p>
              <p className={`text-xl font-bold ${
                output.format === 'currency' ? 'text-green-600 dark:text-green-400' :
                output.format === 'percentage' ? 'text-purple-600 dark:text-purple-400' :
                'text-gray-900 dark:text-white'
              }`}>
                {formatOutput(results[output.id], output.format)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 bg-purple-50 dark:bg-purple-900/20 border-t border-purple-100 dark:border-purple-800">
        <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
          <Info className="h-3.5 w-3.5" />
          <span>Interactive calculator • Values update in real-time</span>
        </div>
      </div>
    </div>
  );
}

export default GeneratedCalculator;
