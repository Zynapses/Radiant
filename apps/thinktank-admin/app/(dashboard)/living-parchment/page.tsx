'use client';

/**
 * RADIANT v5.44.0 - Living Parchment Landing Page
 * 2029 Vision: Advanced sensory UI for AI-assisted decision making
 */

import React from 'react';
import Link from 'next/link';
import { 
  Shield, Users, Swords, Mountain, Brain, Eye, 
  Clock, Sparkles, GitMerge, Activity, Lightbulb,
  BarChart2, ChevronRight, Zap
} from 'lucide-react';

// =============================================================================
// FEATURE CARDS
// =============================================================================

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  href: string;
  status: 'available' | 'coming_soon';
  metrics?: { label: string; value: string }[];
}

const FEATURES: FeatureCard[] = [
  {
    id: 'war-room',
    title: 'War Room',
    description: 'Strategic Decision Theater with AI advisors, confidence terrain visualization, and decision path analysis.',
    icon: Shield,
    color: '#3b82f6',
    href: '/living-parchment/war-room',
    status: 'available',
    metrics: [
      { label: 'Active Sessions', value: '3' },
      { label: 'Avg Confidence', value: '72%' },
    ],
  },
  {
    id: 'council',
    title: 'Council of Experts',
    description: 'Multi-persona AI consultation with consensus tracking, dissent sparks, and minority reports.',
    icon: Users,
    color: '#8b5cf6',
    href: '/living-parchment/council',
    status: 'available',
    metrics: [
      { label: 'Sessions', value: '5' },
      { label: 'Avg Consensus', value: '65%' },
    ],
  },
  {
    id: 'debate',
    title: 'Debate Arena',
    description: 'Adversarial exploration with attack/defense flows, weak point detection, and steel-man generation.',
    icon: Swords,
    color: '#f97316',
    href: '/living-parchment/debate',
    status: 'available',
    metrics: [
      { label: 'Active Debates', value: '2' },
      { label: 'Resolution Rate', value: '78%' },
    ],
  },
  {
    id: 'memory-palace',
    title: 'Memory Palace',
    description: 'Navigable 3D knowledge topology with freshness fog, discovery hotspots, and connection threads.',
    icon: Brain,
    color: '#06b6d4',
    href: '/living-parchment/memory-palace',
    status: 'available',
    metrics: [
      { label: 'Knowledge Nodes', value: '1,247' },
      { label: 'Fresh', value: '89%' },
    ],
  },
  {
    id: 'oracle',
    title: 'Oracle View',
    description: 'Predictive confidence landscape with bifurcation points, ghost futures, and black swan indicators.',
    icon: Eye,
    color: '#a855f7',
    href: '/living-parchment/oracle',
    status: 'available',
    metrics: [
      { label: 'Predictions', value: '34' },
      { label: 'Black Swans', value: '2' },
    ],
  },
  {
    id: 'synthesis',
    title: 'Synthesis Engine',
    description: 'Multi-source fusion view with agreement zones, tension zones, and provenance trails.',
    icon: GitMerge,
    color: '#22c55e',
    href: '/living-parchment/synthesis',
    status: 'available',
    metrics: [
      { label: 'Sources', value: '12' },
      { label: 'Claims', value: '89' },
    ],
  },
  {
    id: 'cognitive-load',
    title: 'Cognitive Load Monitor',
    description: 'Real-time user state awareness with attention heatmaps, fatigue indicators, and adaptive UI.',
    icon: Activity,
    color: '#ec4899',
    href: '/living-parchment/cognitive',
    status: 'available',
    metrics: [
      { label: 'Current Load', value: '42%' },
      { label: 'Adaptations', value: '7' },
    ],
  },
  {
    id: 'temporal-drift',
    title: 'Temporal Drift Observatory',
    description: 'Fact evolution tracking with drift alerts, version ghosts, and citation half-lives.',
    icon: Clock,
    color: '#f59e0b',
    href: '/living-parchment/drift',
    status: 'available',
    metrics: [
      { label: 'Monitored Facts', value: '156' },
      { label: 'Drift Alerts', value: '8' },
    ],
  },
];

// =============================================================================
// BREATHING STYLES
// =============================================================================

const landingStyles = `
  @keyframes card-breathe {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
  @keyframes feature-entrance {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// =============================================================================
// FEATURE CARD COMPONENT
// =============================================================================

function FeatureCardComponent({ feature, index }: { feature: FeatureCard; index: number }) {
  const Icon = feature.icon;
  const isAvailable = feature.status === 'available';

  const baseClassName = `relative group block p-6 bg-slate-900 rounded-2xl border border-slate-800 transition-all duration-300 ${
    isAvailable 
      ? 'hover:border-slate-600 hover:bg-slate-800/50 cursor-pointer' 
      : 'opacity-60 cursor-not-allowed'
  }`;
  
  const animationStyle = { animation: `feature-entrance 0.5s ease-out ${index * 0.1}s both` as const };

  const cardInner = (
    <>
      {/* Glow effect */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${feature.color}15, transparent 70%)`,
        }}
      />

      {/* Coming soon badge */}
      {!isAvailable && (
        <div className="absolute top-4 right-4 px-2 py-1 bg-slate-700 rounded text-xs text-slate-400">
          Coming Soon
        </div>
      )}

      <div className="relative z-10">
        {/* Icon */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ 
            backgroundColor: `${feature.color}20`,
            animation: isAvailable ? 'card-breathe 4s ease-in-out infinite' : 'none',
          }}
        >
          <Icon className="w-6 h-6" style={{ color: feature.color }} />
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{feature.description}</p>

        {/* Metrics */}
        {feature.metrics && (
          <div className="flex gap-4 mb-4">
            {feature.metrics.map((metric, i) => (
              <div key={i}>
                <p className="text-xs text-slate-500">{metric.label}</p>
                <p className="text-sm font-medium text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action */}
        {isAvailable && (
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: feature.color }}>
            <span>Enter</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        )}
      </div>
    </>
  );

  if (isAvailable) {
    return (
      <Link href={feature.href} className={baseClassName} style={animationStyle}>
        {cardInner}
      </Link>
    );
  }

  return (
    <div className={baseClassName} style={animationStyle}>
      {cardInner}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function LivingParchmentPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{landingStyles}</style>

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Living Parchment</h1>
            <p className="text-slate-400">2029 Vision • Sensory AI Decision Intelligence</p>
          </div>
        </div>

        <p className="text-slate-400 max-w-2xl">
          Advanced visualization and decision support tools powered by breathing heatmaps, 
          living ink typography, and confidence terrain mapping. Transform how you make 
          decisions with AI.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, index) => (
            <FeatureCardComponent key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-6xl mx-auto mt-12">
        <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            Platform Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-2xl font-bold text-white">10</p>
              <p className="text-sm text-slate-400">Active Sessions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">89%</p>
              <p className="text-sm text-slate-400">Avg Confidence</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">1,247</p>
              <p className="text-sm text-slate-400">Knowledge Nodes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">156</p>
              <p className="text-sm text-slate-400">Monitored Facts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Design Philosophy */}
      <div className="max-w-6xl mx-auto mt-12">
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Design Philosophy
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-white mb-2">Breathing Interfaces</h3>
              <p className="text-sm text-slate-400">
                UI elements pulse with life—faster breathing indicates uncertainty, 
                slower indicates confidence. Information has a heartbeat.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Living Ink</h3>
              <p className="text-sm text-slate-400">
                Text weight varies with confidence (350-500). Stale information fades 
                to grayscale. Typography communicates trust.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-white mb-2">Ghost Paths</h3>
              <p className="text-sm text-slate-400">
                Rejected alternatives remain visible as translucent traces. 
                Every decision shows what could have been.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
