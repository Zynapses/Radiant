'use client';

/**
 * RADIANT v5.43.0 - DIA Engine Heatmap Scrollbar
 * 
 * The "breathing" heatmap scrollbar - a visual representation of the document's
 * trust topology. Provides at-a-glance understanding of verification status.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DIAColors, SegmentTypeColors, DIAAnimations } from './dia-tokens';

interface HeatmapSegment {
  start_position: number;
  end_position: number;
  segment_type: 'verified' | 'unverified' | 'contested' | 'stale';
  intensity: number;
  claim_ids: string[];
}

interface HeatmapScrollbarProps {
  segments: HeatmapSegment[];
  currentPosition: number;
  onSeek: (position: number) => void;
  className?: string;
}

export function HeatmapScrollbar({
  segments,
  currentPosition,
  onSeek,
  className,
}: HeatmapScrollbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [breathingPhase, setBreathingPhase] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState<HeatmapSegment | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Breathing animation - the scrollbar "breathes" to indicate document health
  useEffect(() => {
    let frame: number;
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      setBreathingPhase(elapsed);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Calculate breathing opacity for a segment
  const getBreathingOpacity = useCallback((segment: HeatmapSegment) => {
    const config = segment.segment_type === 'verified'
      ? DIAAnimations.breathingVerified
      : segment.segment_type === 'contested'
        ? DIAAnimations.breathingContested
        : DIAAnimations.breathingDefault;

    const cyclePosition = (breathingPhase % config.duration) / config.duration;
    const breathing = Math.sin(cyclePosition * Math.PI * 2) * config.amplitude;
    
    return Math.max(0.3, Math.min(1, segment.intensity * (0.6 + breathing)));
  }, [breathingPhase]);

  // Handle mouse move for hover effects
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = y / rect.height;

    setHoverY(y);

    const segment = segments.find(
      (s) => position >= s.start_position && position <= s.end_position
    );
    setHoveredSegment(segment || null);

    // If dragging, update position
    if (isDragging) {
      const clampedPosition = Math.max(0, Math.min(1, position));
      onSeek(clampedPosition);
    }
  }, [segments, isDragging, onSeek]);

  // Handle click to seek
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = Math.max(0, Math.min(1, y / rect.height));
    onSeek(position);
  }, [onSeek]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle mouse up
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-7 rounded-lg cursor-pointer select-none',
        'transition-shadow duration-300',
        isDragging && 'shadow-lg',
        className
      )}
      style={{ backgroundColor: `${DIAColors.surfaceElevated}80` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredSegment(null);
        setHoverY(null);
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Heatmap segments with breathing effect */}
      {segments.map((segment, idx) => {
        const opacity = getBreathingOpacity(segment);
        const color = SegmentTypeColors[segment.segment_type];
        const top = `${segment.start_position * 100}%`;
        const height = `${(segment.end_position - segment.start_position) * 100}%`;

        // Convert opacity to hex for gradient
        const opacityHex70 = Math.round(opacity * 0.7 * 255).toString(16).padStart(2, '0');
        const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');

        return (
          <div
            key={idx}
            className="absolute left-0 right-0 rounded transition-all duration-300"
            style={{
              top,
              height,
              background: `linear-gradient(to right, ${color}${opacityHex70}, ${color}${opacityHex})`,
            }}
          />
        );
      })}

      {/* Position indicator (thumb) */}
      <div
        className="absolute left-1 right-1 h-1.5 rounded transition-all duration-150"
        style={{
          top: `calc(${currentPosition * 100}% - 3px)`,
          backgroundColor: DIAColors.textPrimary,
          boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
        }}
      />

      {/* Hover tooltip */}
      {hoveredSegment && hoverY !== null && (
        <div
          className="absolute right-8 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap z-50 pointer-events-none"
          style={{
            top: hoverY - 12,
            backgroundColor: DIAColors.surfaceElevated,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: SegmentTypeColors[hoveredSegment.segment_type] }}
          />
          <span className="font-medium capitalize" style={{ color: DIAColors.textPrimary }}>
            {hoveredSegment.segment_type}
          </span>
          <span style={{ color: DIAColors.textMuted }}>
            {hoveredSegment.claim_ids.length} claim{hoveredSegment.claim_ids.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
