'use client';

/**
 * RADIANT v5.43.0 - DIA Engine Control Island
 * 
 * Floating lens selector for transforming the document view.
 * NO TAB NAVIGATION - lens switching transforms content in-place.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { FileText, Eye, AlertTriangle, Shield, Upload, RefreshCw } from 'lucide-react';
import { DIAColors, DIALenses, DIALensType } from './dia-tokens';

interface ControlIslandProps {
  activeLens: DIALensType;
  onLensChange: (lens: DIALensType) => void;
  validationStatus: string;
  metrics: {
    unverifiedClaims: number;
    contestedClaims: number;
    complianceFrameworks: string[];
  };
  onExport: () => void;
  onValidate: () => void;
  className?: string;
}

const LensIcons: Record<DIALensType, typeof FileText> = {
  read: FileText,
  xray: Eye,
  risk: AlertTriangle,
  compliance: Shield,
};

export function ControlIsland({
  activeLens,
  onLensChange,
  validationStatus,
  metrics,
  onExport,
  onValidate,
  className,
}: ControlIslandProps) {
  const getBadgeCount = (lens: DIALensType): number | null => {
    switch (lens) {
      case 'xray':
        return metrics.unverifiedClaims > 0 ? metrics.unverifiedClaims : null;
      case 'risk':
        return metrics.contestedClaims > 0 ? metrics.contestedClaims : null;
      case 'compliance':
        return metrics.complianceFrameworks.length > 0 ? metrics.complianceFrameworks.length : null;
      default:
        return null;
    }
  };

  const getBadgeColor = (lens: DIALensType): string => {
    switch (lens) {
      case 'xray':
        return DIAColors.heatmapUnverified;
      case 'risk':
        return DIAColors.heatmapContested;
      default:
        return DIAColors.islandActiveTab;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-0 px-2 py-1.5 rounded-full',
        className
      )}
      style={{
        backgroundColor: DIAColors.islandBackground,
        border: `1px solid ${DIAColors.islandBorder}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Lens buttons */}
      {(Object.keys(DIALenses) as DIALensType[]).map((lensKey) => {
        const lens = DIALenses[lensKey];
        const Icon = LensIcons[lensKey];
        const badge = getBadgeCount(lensKey);
        const isActive = activeLens === lensKey;

        return (
          <button
            key={lensKey}
            onClick={() => onLensChange(lensKey)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium',
              'transition-all duration-200',
              isActive ? 'text-white' : 'text-white/50 hover:text-white/70'
            )}
            style={isActive ? { backgroundColor: DIAColors.islandActiveTab } : {}}
            title={lens.description}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lens.label}</span>
            {badge !== null && (
              <span
                className="px-1.5 py-0.5 text-xs font-semibold text-white rounded-full"
                style={{ backgroundColor: getBadgeColor(lensKey) }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}

      {/* Divider */}
      <div
        className="w-px h-6 mx-2"
        style={{ backgroundColor: DIAColors.islandBorder }}
      />

      {/* Export button */}
      <button
        onClick={onExport}
        className="p-2 text-white/70 hover:text-white transition-colors"
        title="Export artifact"
      >
        <Upload className="w-4 h-4" />
      </button>

      {/* Validate button (shown if stale) */}
      {validationStatus === 'stale' && (
        <button
          onClick={onValidate}
          className="p-2 transition-colors animate-pulse"
          style={{ color: DIAColors.heatmapStale }}
          title="Verify stale data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
