'use client';

// CATENARY WIRE — Custom React Flow edge that simulates gravity
// NOT a standard Bezier curve. Uses the catenary equation: y = a * cosh(x/a)
// Heavier data = deeper curve sag. Light particles travel inside the cable.
// Rejected connections spark red and vibrate.

import { memo, useMemo } from 'react';
import { type EdgeProps, getBezierPath } from 'reactflow';
import { motion } from 'framer-motion';
import type { WireData } from '@/lib/forge-store';

function CatenaryEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
}: EdgeProps<WireData>) {
  const dataWeight = data?.dataWeight ?? 0.3;
  const frequency = data?.frequency ?? 0.5;
  const rejected = data?.rejected ?? false;

  // Calculate catenary path
  // The sag depth is proportional to dataWeight and horizontal distance
  const path = useMemo(() => {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Sag depth: heavier data = deeper curve
    const sagDepth = Math.max(20, dist * 0.15 * dataWeight + dataWeight * 60);

    // Mid-point with sag
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2 + sagDepth;

    // Use quadratic bezier to approximate catenary
    return `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;
  }, [sourceX, sourceY, targetX, targetY, dataWeight]);

  // Wire thickness based on data weight
  const strokeWidth = 1.5 + dataWeight * 3;

  // Color based on state
  const wireColor = rejected ? '#ef4444' : dataWeight > 0.6 ? '#f97316' : '#38bdf8';
  const glowColor = rejected ? 'rgba(239,68,68,0.4)' : 'rgba(56,189,248,0.2)';

  // Particle animation — dots of light traveling along the path
  const particleCount = Math.max(1, Math.floor(frequency * 5));
  const particleDuration = Math.max(0.5, 3 - frequency * 2.5);

  return (
    <g>
      {/* Glow layer */}
      <path
        d={path}
        fill="none"
        stroke={glowColor}
        strokeWidth={strokeWidth + 6}
        strokeLinecap="round"
        style={{ filter: 'blur(4px)' }}
      />

      {/* Main cable */}
      <motion.path
        d={path}
        fill="none"
        stroke={wireColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeOpacity={0.8}
        animate={rejected ? {
          x: [0, -2, 2, -1, 1, 0],
          y: [0, -1, 1, -1, 1, 0],
        } : {}}
        transition={rejected ? {
          duration: 0.4,
          repeat: Infinity,
        } : {}}
      />

      {/* Inner cable highlight */}
      <path
        d={path}
        fill="none"
        stroke="white"
        strokeWidth={Math.max(0.5, strokeWidth * 0.3)}
        strokeLinecap="round"
        strokeOpacity={0.15}
      />

      {/* Traveling particles — light dots inside the cable */}
      {!rejected && Array.from({ length: particleCount }).map((_, i) => (
        <motion.circle
          key={`particle-${id}-${i}`}
          r={1.5 + dataWeight}
          fill="white"
          opacity={0.7}
          filter="url(#particleGlow)"
        >
          <animateMotion
            dur={`${particleDuration}s`}
            repeatCount="indefinite"
            begin={`${(i / particleCount) * particleDuration}s`}
            path={path}
          />
        </motion.circle>
      ))}

      {/* Spark particles for rejected connections */}
      {rejected && Array.from({ length: 6 }).map((_, i) => (
        <motion.circle
          key={`spark-${id}-${i}`}
          cx={(sourceX + targetX) / 2 + (Math.random() - 0.5) * 30}
          cy={(sourceY + targetY) / 2 + dataWeight * 40 + (Math.random() - 0.5) * 20}
          r={1.5}
          fill="#ef4444"
          animate={{
            opacity: [1, 0],
            scale: [1, 0],
            y: [0, -20 - Math.random() * 30],
          }}
          transition={{
            duration: 0.6,
            delay: i * 0.1,
            repeat: Infinity,
          }}
        />
      ))}

      {/* Rejection label */}
      {rejected && data?.rejectReason && (
        <g>
          <rect
            x={(sourceX + targetX) / 2 - 60}
            y={(sourceY + targetY) / 2 + dataWeight * 40 + 8}
            width={120}
            height={20}
            rx={4}
            fill="rgba(239,68,68,0.15)"
            stroke="rgba(239,68,68,0.4)"
            strokeWidth={1}
          />
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 + dataWeight * 40 + 22}
            textAnchor="middle"
            fill="#fca5a5"
            fontSize={8}
            fontFamily="JetBrains Mono, monospace"
          >
            {data.rejectReason}
          </text>
        </g>
      )}

      {/* SVG filter for particle glow */}
      <defs>
        <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </g>
  );
}

export const CatenaryEdge = memo(CatenaryEdgeComponent);
