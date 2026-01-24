'use client';

import React, { useState } from 'react';
import { Play, Copy, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_CODE = `// Welcome to the Code Editor
// Write your code here and run it!

function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

export function CodeEditorView() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const runCode = () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.map(String).join(' '));
    
    try {
      // eslint-disable-next-line no-new-func
      new Function(code)();
      setOutput(logs);
    } catch (err) {
      setOutput([`Error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    }
    
    console.log = originalLog;
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Button size="sm" onClick={runCode}>
          <Play className="h-4 w-4 mr-1" /> Run
        </Button>
        <Button size="sm" variant="outline" onClick={copyCode}>
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1 text-xs text-slate-500 bg-slate-800/50 border-b border-white/10">
            script.js
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 p-4 bg-slate-900/50 text-slate-300 font-mono text-sm resize-none outline-none"
            spellCheck={false}
          />
        </div>

        <div className="w-80 border-l border-white/10 flex flex-col">
          <div className="px-3 py-1 text-xs text-slate-500 bg-slate-800/50 border-b border-white/10">
            Output
          </div>
          <div className="flex-1 p-4 font-mono text-sm overflow-auto">
            {output.length === 0 ? (
              <span className="text-slate-500">Click Run to execute code...</span>
            ) : (
              output.map((line, i) => (
                <div key={i} className="text-green-400">{line}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
