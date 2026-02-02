'use client';

/**
 * DomainDisplay - Domain Detection Display Component
 * 
 * Shows the detected domain with:
 * - Breadcrumb path (e.g., Legal › Contracts › SaaS)
 * - Confidence indicator
 * - Related domains
 * - Domain icon
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Scale,
  Stethoscope,
  Code,
  Briefcase,
  GraduationCap,
  Palette,
  FlaskConical,
  Building2,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';
import type { Domain } from '@/lib/axiom/types';

interface DomainDisplayProps {
  domain: Domain;
  showRelated?: boolean;
  showConfidence?: boolean;
  compact?: boolean;
  className?: string;
  onDomainClick?: (domain: Domain) => void;
}

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  legal: Scale,
  medical: Stethoscope,
  medicine: Stethoscope,
  healthcare: Stethoscope,
  technology: Code,
  software: Code,
  engineering: Code,
  business: Briefcase,
  finance: Briefcase,
  education: GraduationCap,
  learning: GraduationCap,
  creative: Palette,
  art: Palette,
  design: Palette,
  science: FlaskConical,
  research: FlaskConical,
  enterprise: Building2,
  default: Sparkles,
};

const DOMAIN_COLORS: Record<string, string> = {
  legal: 'text-amber-500 bg-amber-500/10',
  medical: 'text-red-500 bg-red-500/10',
  medicine: 'text-red-500 bg-red-500/10',
  healthcare: 'text-red-500 bg-red-500/10',
  technology: 'text-blue-500 bg-blue-500/10',
  software: 'text-blue-500 bg-blue-500/10',
  engineering: 'text-blue-500 bg-blue-500/10',
  business: 'text-emerald-500 bg-emerald-500/10',
  finance: 'text-emerald-500 bg-emerald-500/10',
  education: 'text-purple-500 bg-purple-500/10',
  learning: 'text-purple-500 bg-purple-500/10',
  creative: 'text-pink-500 bg-pink-500/10',
  art: 'text-pink-500 bg-pink-500/10',
  design: 'text-pink-500 bg-pink-500/10',
  science: 'text-cyan-500 bg-cyan-500/10',
  research: 'text-cyan-500 bg-cyan-500/10',
  enterprise: 'text-slate-500 bg-slate-500/10',
  default: 'text-indigo-500 bg-indigo-500/10',
};

function getDomainIcon(path: string[]): React.ElementType {
  for (const segment of path) {
    const key = segment.toLowerCase();
    if (DOMAIN_ICONS[key]) {
      return DOMAIN_ICONS[key];
    }
  }
  return DOMAIN_ICONS.default;
}

function getDomainColor(path: string[]): string {
  for (const segment of path) {
    const key = segment.toLowerCase();
    if (DOMAIN_COLORS[key]) {
      return DOMAIN_COLORS[key];
    }
  }
  return DOMAIN_COLORS.default;
}

function formatDomainSegment(segment: string): string {
  return segment
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function DomainDisplay({
  domain,
  showRelated = true,
  showConfidence = true,
  compact = false,
  className,
  onDomainClick,
}: DomainDisplayProps) {
  const Icon = getDomainIcon(domain.path);
  const colorClass = getDomainColor(domain.path);
  const confidencePercent = Math.round(domain.confidence * 100);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
          colorClass.split(' ')[1],
          className
        )}
      >
        <Icon className={cn('h-4 w-4', colorClass.split(' ')[0])} />
        <span className="text-sm font-medium">{domain.displayName || domain.name}</span>
        {showConfidence && (
          <span className="text-xs text-muted-foreground">{confidencePercent}%</span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-2', className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Domain Detected
        </span>
        {showConfidence && (
          <motion.span
            key={confidencePercent}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              confidencePercent >= 85 ? 'bg-green-500/20 text-green-400' :
              confidencePercent >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-orange-500/20 text-orange-400'
            )}
          >
            {confidencePercent}% confident
          </motion.span>
        )}
      </div>

      <div 
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          colorClass.split(' ')[1],
          onDomainClick && 'cursor-pointer hover:opacity-80 transition-opacity'
        )}
        onClick={() => onDomainClick?.(domain)}
        role={onDomainClick ? 'button' : undefined}
        tabIndex={onDomainClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (onDomainClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onDomainClick(domain);
          }
        }}
      >
        <div className={cn('p-2 rounded-lg', colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm font-medium flex-wrap">
            {domain.path.map((segment, index) => (
              <span key={index} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
                )}
                <span className={index === domain.path.length - 1 ? '' : 'text-muted-foreground'}>
                  {formatDomainSegment(segment)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRelated && domain.relatedDomains && domain.relatedDomains.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Info className="h-3 w-3" />
            <span>Related: {domain.relatedDomains.slice(0, 3).join(', ')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DomainDisplay;
