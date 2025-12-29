'use client';

import React, { useState, useCallback } from 'react';
import { MessageSquare, Sparkles, Columns, ChevronLeft, ChevronRight } from 'lucide-react';

interface AppViewToggleProps {
  activeView: 'text' | 'app' | 'split';
  onViewChange: (view: 'text' | 'app' | 'split') => void;
  hasApp: boolean;
  appTitle?: string;
  disabled?: boolean;
}

/**
 * Toggle component to switch between text response and generated app views
 * "It transforms Think Tank from a chatbot into a dynamic software generator"
 */
export function AppViewToggle({
  activeView,
  onViewChange,
  hasApp,
  appTitle,
  disabled = false,
}: AppViewToggleProps) {
  if (!hasApp) return null;

  return (
    <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
      <button
        onClick={() => onViewChange('text')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          activeView === 'text'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="View text response"
      >
        <MessageSquare className="h-4 w-4" />
        <span>Response</span>
      </button>
      
      <button
        onClick={() => onViewChange('app')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          activeView === 'app'
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={`Use ${appTitle || 'interactive app'}`}
      >
        <Sparkles className="h-4 w-4" />
        <span>{appTitle || 'App'}</span>
      </button>
      
      <button
        onClick={() => onViewChange('split')}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          activeView === 'split'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="View both side by side"
      >
        <Columns className="h-4 w-4" />
        <span>Split</span>
      </button>
    </div>
  );
}

interface SplitViewContainerProps {
  children: [React.ReactNode, React.ReactNode];
  splitRatio?: [number, number];
  direction?: 'horizontal' | 'vertical';
  onRatioChange?: (ratio: [number, number]) => void;
}

/**
 * Container for split view with resizable panels
 */
export function SplitViewContainer({
  children,
  splitRatio = [1, 1],
  direction = 'horizontal',
  onRatioChange,
}: SplitViewContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [ratio, setRatio] = useState(splitRatio);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      
      if (direction === 'horizontal') {
        const x = e.clientX - rect.left;
        const newRatio = x / rect.width;
        const clamped = Math.max(0.2, Math.min(0.8, newRatio));
        setRatio([clamped, 1 - clamped]);
        onRatioChange?.([clamped, 1 - clamped]);
      } else {
        const y = e.clientY - rect.top;
        const newRatio = y / rect.height;
        const clamped = Math.max(0.2, Math.min(0.8, newRatio));
        setRatio([clamped, 1 - clamped]);
        onRatioChange?.([clamped, 1 - clamped]);
      }
    },
    [isDragging, direction, onRatioChange]
  );

  const [leftChild, rightChild] = children;
  const total = ratio[0] + ratio[1];
  const leftPercent = (ratio[0] / total) * 100;
  const rightPercent = (ratio[1] / total) * 100;

  return (
    <div
      className={`flex ${direction === 'vertical' ? 'flex-col' : 'flex-row'} h-full`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{ [direction === 'horizontal' ? 'width' : 'height']: `${leftPercent}%` }}
        className="overflow-auto"
      >
        {leftChild}
      </div>
      
      <div
        className={`
          ${direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
          bg-gray-200 dark:bg-gray-700 hover:bg-purple-400 dark:hover:bg-purple-500
          transition-colors flex items-center justify-center
          ${isDragging ? 'bg-purple-500' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        {direction === 'horizontal' ? (
          <div className="flex flex-col gap-0.5">
            <div className="w-0.5 h-1 bg-gray-400 rounded" />
            <div className="w-0.5 h-1 bg-gray-400 rounded" />
            <div className="w-0.5 h-1 bg-gray-400 rounded" />
          </div>
        ) : (
          <div className="flex gap-0.5">
            <div className="h-0.5 w-1 bg-gray-400 rounded" />
            <div className="h-0.5 w-1 bg-gray-400 rounded" />
            <div className="h-0.5 w-1 bg-gray-400 rounded" />
          </div>
        )}
      </div>
      
      <div
        style={{ [direction === 'horizontal' ? 'width' : 'height']: `${rightPercent}%` }}
        className="overflow-auto"
      >
        {rightChild}
      </div>
    </div>
  );
}

interface ViewTransitionProps {
  activeView: 'text' | 'app' | 'split';
  textContent: React.ReactNode;
  appContent: React.ReactNode;
  transitionDuration?: number;
  splitRatio?: [number, number];
  splitDirection?: 'horizontal' | 'vertical';
}

/**
 * Animated transition between text and app views
 */
export function ViewTransition({
  activeView,
  textContent,
  appContent,
  transitionDuration = 300,
  splitRatio = [1, 1],
  splitDirection = 'horizontal',
}: ViewTransitionProps) {
  return (
    <div className="relative w-full min-h-[200px]">
      {activeView === 'split' ? (
        <SplitViewContainer splitRatio={splitRatio} direction={splitDirection}>
          <div className="p-4 h-full">{textContent}</div>
          <div className="p-4 h-full">{appContent}</div>
        </SplitViewContainer>
      ) : (
        <>
          <div
            className={`absolute inset-0 transition-all ${
              activeView === 'text' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
            style={{ transitionDuration: `${transitionDuration}ms` }}
          >
            {textContent}
          </div>
          <div
            className={`absolute inset-0 transition-all ${
              activeView === 'app' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
            style={{ transitionDuration: `${transitionDuration}ms` }}
          >
            {appContent}
          </div>
        </>
      )}
    </div>
  );
}

export default AppViewToggle;
