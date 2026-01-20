'use client';

/**
 * Modern Skeleton Loaders
 * 
 * Shimmer effect skeleton components for loading states.
 * Uses gradient animation for a polished feel.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-white/[0.06]',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent',
        'before:animate-shimmer',
        className
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn(
      'rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4',
      className
    )}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonMessage({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn(
      'flex gap-3',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className={cn(
        'space-y-2 max-w-[70%]',
        isUser ? 'items-end' : 'items-start'
      )}>
        <Skeleton className={cn(
          'rounded-2xl p-4',
          isUser ? 'w-48 h-12' : 'w-64 h-20'
        )} />
      </div>
    </div>
  );
}

export function SkeletonChatList() {
  return (
    <div className="space-y-4 p-4">
      <SkeletonMessage isUser={false} />
      <SkeletonMessage isUser={true} />
      <SkeletonMessage isUser={false} />
    </div>
  );
}

export function SkeletonSidebar() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
