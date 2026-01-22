'use client';

/**
 * RADIANT v5.43.0 - DIA Engine Claim Card
 * 
 * Renders individual claims with Living Ink typography and evidence links.
 * Font weight reflects confidence; stale ink fades to grayscale.
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  ChevronDown, 
  ChevronRight, 
  Link2, 
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { DIAColors, DIATypography, SegmentTypeColors } from './dia-tokens';

interface Evidence {
  evidence_id: string;
  evidence_type: string;
  tool_call_id?: string;
  evidence_snapshot: {
    tool_name?: string;
    input_summary?: string;
    output_summary?: string;
    timestamp: string;
  };
  is_volatile: boolean;
  volatility_category?: string;
}

interface Claim {
  claim_id: string;
  text: string;
  claim_type: string;
  supporting_evidence: Evidence[];
  verification_status: 'verified' | 'unverified' | 'contested';
  confidence_score: number;
  volatility_score: number;
  risk_score: number;
  primary_model: string;
  is_stale: boolean;
  staleness_age_hours?: number;
  contains_phi: boolean;
  contains_pii: boolean;
  sensitivity_level: string;
}

interface ClaimCardProps {
  claim: Claim;
  lens: 'read' | 'xray' | 'risk' | 'compliance';
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClaimHover: (claimId: string | null) => void;
  className?: string;
}

const VerificationIcons = {
  verified: CheckCircle2,
  unverified: HelpCircle,
  contested: AlertCircle,
};

const ClaimTypeLabels: Record<string, string> = {
  conclusion: 'Conclusion',
  finding: 'Finding',
  recommendation: 'Recommendation',
  warning: 'Warning',
  fact: 'Fact',
  clinical_finding: 'Clinical Finding',
  treatment_recommendation: 'Treatment',
  risk_assessment: 'Risk Assessment',
  investment_recommendation: 'Investment',
  legal_opinion: 'Legal Opinion',
  compliance_finding: 'Compliance',
  hypothesis: 'Hypothesis',
  evidence_summary: 'Evidence Summary',
};

export function ClaimCard({
  claim,
  lens,
  isExpanded,
  onToggleExpand,
  onClaimHover,
  className,
}: ClaimCardProps) {
  const VerificationIcon = VerificationIcons[claim.verification_status];
  const verificationColor = SegmentTypeColors[
    claim.is_stale ? 'stale' : claim.verification_status === 'contested' ? 'contested' : 
    claim.verification_status === 'unverified' ? 'unverified' : 'verified'
  ];

  // Living Ink: Font weight based on confidence
  const fontWeight = DIATypography.getConfidenceWeight(claim.confidence_score);
  
  // Living Ink: Color based on staleness
  const textColor = claim.is_stale ? DIAColors.inkStale : DIAColors.inkFresh;

  return (
    <div
      className={cn(
        'group rounded-lg transition-all duration-200',
        className
      )}
      style={{
        backgroundColor: isExpanded ? DIAColors.surfaceElevated : 'transparent',
        boxShadow: isExpanded ? `0 0 0 1px ${verificationColor}` : undefined,
      }}
      onMouseEnter={() => onClaimHover(claim.claim_id)}
      onMouseLeave={() => onClaimHover(null)}
    >
      {/* Claim header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Verification indicator */}
        <div
          className="mt-0.5 p-1.5 rounded-full"
          style={{ backgroundColor: `${verificationColor}20` }}
        >
          <VerificationIcon
            className="w-4 h-4"
            style={{ color: verificationColor }}
          />
        </div>

        {/* Claim content */}
        <div className="flex-1 min-w-0">
          {/* Type label and badges */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                color: DIAColors.textSecondary,
                backgroundColor: `${DIAColors.textMuted}20`,
              }}
            >
              {ClaimTypeLabels[claim.claim_type] || claim.claim_type}
            </span>

            {claim.is_stale && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  color: DIAColors.heatmapStale,
                  backgroundColor: `${DIAColors.heatmapStale}20`,
                }}
              >
                <Clock className="w-3 h-3" />
                {claim.staleness_age_hours && `${Math.round(claim.staleness_age_hours)}h`}
              </span>
            )}

            {(claim.contains_phi || claim.contains_pii) && lens === 'compliance' && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  color: DIAColors.heatmapContested,
                  backgroundColor: `${DIAColors.heatmapContested}20`,
                }}
              >
                <Shield className="w-3 h-3" />
                {claim.contains_phi ? 'PHI' : 'PII'}
              </span>
            )}

            {claim.risk_score > 0.5 && lens === 'risk' && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  color: DIAColors.heatmapUnverified,
                  backgroundColor: `${DIAColors.heatmapUnverified}20`,
                }}
              >
                <AlertTriangle className="w-3 h-3" />
                Risk {Math.round(claim.risk_score * 100)}%
              </span>
            )}
          </div>

          {/* Claim text with Living Ink styling */}
          <p
            className="text-sm leading-relaxed"
            style={{
              color: textColor,
              fontWeight,
              opacity: claim.is_stale ? 0.7 : 1,
            }}
          >
            {claim.text}
          </p>

          {/* Evidence count indicator (X-Ray lens) */}
          {lens === 'xray' && claim.supporting_evidence.length > 0 && (
            <div
              className="flex items-center gap-1 mt-2 text-xs"
              style={{ color: DIAColors.textMuted }}
            >
              <Link2 className="w-3 h-3" />
              {claim.supporting_evidence.length} evidence link{claim.supporting_evidence.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          className="p-1 rounded transition-colors hover:bg-white/5"
          style={{ color: DIAColors.textMuted }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          className="px-4 pb-4 pt-0 border-t"
          style={{ borderColor: DIAColors.islandBorder }}
        >
          {/* Confidence bar */}
          <div className="mt-4 mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: DIAColors.textMuted }}>Confidence</span>
              <span style={{ color: DIAColors.textSecondary }}>
                {Math.round(claim.confidence_score * 100)}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: DIAColors.islandBorder }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${claim.confidence_score * 100}%`,
                  backgroundColor: verificationColor,
                }}
              />
            </div>
          </div>

          {/* Evidence list */}
          {claim.supporting_evidence.length > 0 && (
            <div className="space-y-2">
              <h4
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: DIAColors.textMuted }}
              >
                Supporting Evidence
              </h4>
              {claim.supporting_evidence.map((evidence) => (
                <EvidenceItem key={evidence.evidence_id} evidence={evidence} />
              ))}
            </div>
          )}

          {/* Model attribution */}
          <div
            className="mt-4 pt-3 flex items-center justify-between text-xs"
            style={{ 
              borderTop: `1px solid ${DIAColors.islandBorder}`,
              color: DIAColors.textMuted,
            }}
          >
            <span>Source: {claim.primary_model}</span>
            {claim.volatility_score > 0 && (
              <span>Volatility: {Math.round(claim.volatility_score * 100)}%</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="rounded p-3"
      style={{ backgroundColor: `${DIAColors.canvasBackground}80` }}
    >
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Link2 className="w-3.5 h-3.5 mt-0.5" style={{ color: DIAColors.islandActiveTab }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: DIAColors.textSecondary }}>
              {evidence.evidence_snapshot.tool_name || evidence.evidence_type}
            </span>
            {evidence.is_volatile && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  color: DIAColors.heatmapStale,
                  backgroundColor: `${DIAColors.heatmapStale}15`,
                }}
              >
                {evidence.volatility_category}
              </span>
            )}
          </div>
          {evidence.evidence_snapshot.input_summary && (
            <p
              className="text-xs mt-1 truncate"
              style={{ color: DIAColors.textMuted }}
            >
              {evidence.evidence_snapshot.input_summary}
            </p>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" style={{ color: DIAColors.textMuted }} />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" style={{ color: DIAColors.textMuted }} />
        )}
      </div>

      {isExpanded && evidence.evidence_snapshot.output_summary && (
        <div
          className="mt-2 pt-2 text-xs"
          style={{ 
            borderTop: `1px solid ${DIAColors.islandBorder}`,
            color: DIAColors.textSecondary,
          }}
        >
          <pre className="whitespace-pre-wrap font-mono text-xs">
            {evidence.evidence_snapshot.output_summary}
          </pre>
        </div>
      )}
    </div>
  );
}
