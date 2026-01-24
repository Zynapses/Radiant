'use client';

import React, { useState } from 'react';
import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CalculatorView() {
  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setMemory(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (memory === null) {
      setMemory(inputValue);
    } else if (operator) {
      const currentValue = memory || 0;
      let result = 0;

      switch (operator) {
        case '+': result = currentValue + inputValue; break;
        case '-': result = currentValue - inputValue; break;
        case '×': result = currentValue * inputValue; break;
        case '÷': result = inputValue !== 0 ? currentValue / inputValue : 0; break;
        default: result = inputValue;
      }

      setDisplay(String(result));
      setMemory(result);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = () => {
    if (!operator || memory === null) return;
    performOperation('=');
    setOperator(null);
  };

  const buttons = [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '⌫', '='],
  ];

  const handleButton = (btn: string) => {
    if (btn >= '0' && btn <= '9') inputDigit(btn);
    else if (btn === '.') inputDecimal();
    else if (btn === 'C') clear();
    else if (btn === '⌫') setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
    else if (btn === '±') setDisplay(String(parseFloat(display) * -1));
    else if (btn === '%') setDisplay(String(parseFloat(display) / 100));
    else if (btn === '=') calculate();
    else performOperation(btn);
  };

  return (
    <div className="h-full flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-80 bg-slate-800/80 rounded-2xl p-4 shadow-2xl">
        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
          <div className="text-right">
            <div className="text-xs text-slate-500 h-4">
              {memory !== null && operator && `${memory} ${operator}`}
            </div>
            <div className="text-3xl font-light text-white truncate">
              {display}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {buttons.flat().map((btn) => (
            <Button
              key={btn}
              variant="ghost"
              className={cn(
                'h-14 text-lg font-medium rounded-xl transition-all',
                btn === '0' && 'col-span-1',
                ['÷', '×', '-', '+', '='].includes(btn)
                  ? 'bg-violet-600 hover:bg-violet-500 text-white'
                  : ['C', '±', '%'].includes(btn)
                  ? 'bg-slate-600 hover:bg-slate-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              )}
              onClick={() => handleButton(btn)}
            >
              {btn === '⌫' ? <Delete className="h-5 w-5" /> : btn}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
