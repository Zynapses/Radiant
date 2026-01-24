'use client';

import React, { useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_CONTENT = `# Welcome to the Document Editor

This is a **rich text editor** where you can create and edit documents.

## Features
- Bold, italic, and underline formatting
- Bullet and numbered lists
- Text alignment options
- Export to various formats

Start typing to edit this document...
`;

export function DocumentView() {
  const [content, setContent] = useState(DEFAULT_CONTENT);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      <div className="flex items-center gap-1 p-2 border-b border-white/10 flex-wrap">
        <Button size="icon" variant="ghost" onClick={() => execCommand('bold')}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => execCommand('italic')}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => execCommand('underline')}>
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <Button size="icon" variant="ghost" onClick={() => execCommand('insertUnorderedList')}>
          <List className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => execCommand('insertOrderedList')}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <Button size="icon" variant="ghost" onClick={() => execCommand('justifyLeft')}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => execCommand('justifyCenter')}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => execCommand('justifyRight')}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div
          contentEditable
          className="min-h-full p-8 max-w-3xl mx-auto prose prose-invert prose-sm focus:outline-none"
          style={{ whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: content }}
          onInput={(e) => setContent(e.currentTarget.innerHTML)}
        />
      </div>
    </div>
  );
}
