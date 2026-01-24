'use client';

/**
 * DataGrid Morphed View
 * Interactive spreadsheet when chat morphs into data mode
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Download, Upload, Filter, SortAsc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataGridViewProps {
  initialData?: Record<string, unknown>[];
  onDataChange?: (data: Record<string, unknown>[]) => void;
}

const DEFAULT_DATA = [
  { id: 1, name: 'Item 1', value: 100, status: 'Active' },
  { id: 2, name: 'Item 2', value: 250, status: 'Pending' },
  { id: 3, name: 'Item 3', value: 75, status: 'Active' },
  { id: 4, name: 'Item 4', value: 320, status: 'Completed' },
  { id: 5, name: 'Item 5', value: 180, status: 'Active' },
];

export function DataGridView({ initialData, onDataChange }: DataGridViewProps) {
  const [data, setData] = useState<Record<string, unknown>[]>(
    initialData || DEFAULT_DATA
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  const handleCellClick = (rowIndex: number, col: string) => {
    setSelectedCell({ row: rowIndex, col });
    setEditValue(String(data[rowIndex][col] || ''));
  };

  const handleCellChange = (value: string) => {
    if (!selectedCell) return;
    
    const newData = [...data];
    newData[selectedCell.row] = {
      ...newData[selectedCell.row],
      [selectedCell.col]: value,
    };
    setData(newData);
    onDataChange?.(newData);
  };

  const handleAddRow = () => {
    const newRow: Record<string, unknown> = {};
    columns.forEach(col => {
      newRow[col] = col === 'id' ? data.length + 1 : '';
    });
    const newData = [...data, newRow];
    setData(newData);
    onDataChange?.(newData);
  };

  const handleDeleteRow = (index: number) => {
    const newData = data.filter((_, i) => i !== index);
    setData(newData);
    onDataChange?.(newData);
    setSelectedCell(null);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <Button size="sm" variant="outline" onClick={handleAddRow}>
          <Plus className="h-4 w-4 mr-1" /> Add Row
        </Button>
        <Button size="sm" variant="outline">
          <Filter className="h-4 w-4 mr-1" /> Filter
        </Button>
        <Button size="sm" variant="outline">
          <SortAsc className="h-4 w-4 mr-1" /> Sort
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-800/50 sticky top-0">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase border-b border-white/10"
                >
                  {col}
                </th>
              ))}
              <th className="w-10 border-b border-white/10" />
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-white/5 hover:bg-white/5"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={cn(
                      'px-4 py-2 text-sm cursor-pointer transition-colors',
                      selectedCell?.row === rowIndex && selectedCell?.col === col
                        ? 'bg-violet-500/20 ring-1 ring-violet-500'
                        : 'hover:bg-white/10'
                    )}
                    onClick={() => handleCellClick(rowIndex, col)}
                  >
                    {selectedCell?.row === rowIndex && selectedCell?.col === col ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setEditValue(e.target.value);
                          handleCellChange(e.target.value);
                        }}
                        className="h-6 px-1 py-0 text-sm bg-transparent border-none focus:ring-0 text-white w-full outline-none"
                        autoFocus
                        onBlur={() => setSelectedCell(null)}
                        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && setSelectedCell(null)}
                      />
                    ) : (
                      <span className="text-slate-300">{String(row[col] || '')}</span>
                    )}
                  </td>
                ))}
                <td className="px-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-slate-500 hover:text-red-400"
                    onClick={() => handleDeleteRow(rowIndex)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-slate-500">
        <span>{data.length} rows</span>
        <span>{columns.length} columns</span>
        {selectedCell && (
          <span>
            Editing: Row {selectedCell.row + 1}, Column {selectedCell.col}
          </span>
        )}
      </div>
    </div>
  );
}
