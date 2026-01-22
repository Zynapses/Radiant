/**
 * RADIANT v5.43.0 - DIA Engine Heatmap Generator
 * 
 * Generates heatmap segments from claims for visualization in the Living Parchment UI.
 * The heatmap provides at-a-glance trust topology of the decision artifact.
 */

import {
  Claim,
  HeatmapSegment,
  HeatmapSegmentType,
} from '@radiant/shared';

/**
 * Generates heatmap segments from positioned claims
 * Segments are merged where possible to reduce rendering complexity
 */
export function generateHeatmapSegments(claims: Claim[]): HeatmapSegment[] {
  if (claims.length === 0) return [];

  const segments: HeatmapSegment[] = [];
  
  // Sort claims by document position
  const sortedClaims = [...claims].sort(
    (a, b) => a.document_position.start_fraction - b.document_position.start_fraction
  );

  for (const claim of sortedClaims) {
    const segmentType = determineSegmentType(claim);
    const intensity = calculateIntensity(claim, segmentType);

    // Try to merge with last segment if compatible
    const lastSegment = segments[segments.length - 1];
    const canMerge = lastSegment &&
      lastSegment.segment_type === segmentType &&
      lastSegment.end_position >= claim.document_position.start_fraction - 0.01;

    if (canMerge) {
      // Extend last segment
      lastSegment.end_position = claim.document_position.end_fraction;
      lastSegment.claim_ids.push(claim.claim_id);
      lastSegment.intensity = Math.max(lastSegment.intensity, intensity);
    } else {
      // Create new segment
      segments.push({
        start_position: claim.document_position.start_fraction,
        end_position: claim.document_position.end_fraction,
        segment_type: segmentType,
        intensity,
        claim_ids: [claim.claim_id],
      });
    }
  }

  return segments;
}

/**
 * Determines the segment type based on claim properties
 * Priority: stale > contested > unverified > verified
 */
function determineSegmentType(claim: Claim): HeatmapSegmentType {
  if (claim.is_stale) return 'stale';
  if (claim.verification_status === 'contested') return 'contested';
  if (claim.verification_status === 'unverified') return 'unverified';
  return 'verified';
}

/**
 * Calculates the intensity (0-1) for visual representation
 * Different segment types use different intensity calculations
 */
function calculateIntensity(claim: Claim, segmentType: HeatmapSegmentType): number {
  switch (segmentType) {
    case 'verified':
      // Higher confidence = higher intensity (bright green)
      return claim.confidence_score;
    
    case 'unverified':
      // Lower confidence = higher intensity (brighter amber warning)
      return 1.0 - claim.confidence_score;
    
    case 'contested':
      // Higher risk = higher intensity (brighter red alert)
      return claim.risk_score;
    
    case 'stale':
      // Older staleness = higher intensity (more faded purple)
      // Max out at 1 week = 168 hours
      const maxStalenessHours = 168;
      return Math.min(1.0, (claim.staleness_age_hours || 0) / maxStalenessHours);
    
    default:
      return 0.5;
  }
}

/**
 * Recalculates heatmap after validation
 * Updates stale status based on new validation results
 */
export function updateHeatmapAfterValidation(
  segments: HeatmapSegment[],
  claims: Claim[],
  validatedQueryIds: string[]
): HeatmapSegment[] {
  // Create a map of claims that were affected by validation
  const affectedClaimIds = new Set<string>();
  
  for (const claim of claims) {
    const hasValidatedEvidence = claim.supporting_evidence.some(
      (e) => e.tool_call_id && validatedQueryIds.includes(e.tool_call_id)
    );
    if (hasValidatedEvidence) {
      affectedClaimIds.add(claim.claim_id);
    }
  }

  // Regenerate segments for affected claims
  return generateHeatmapSegments(claims);
}

/**
 * Gets summary statistics for the heatmap
 */
export function getHeatmapStats(segments: HeatmapSegment[]): {
  verifiedCoverage: number;
  unverifiedCoverage: number;
  contestedCoverage: number;
  staleCoverage: number;
  averageIntensity: number;
} {
  let verifiedLength = 0;
  let unverifiedLength = 0;
  let contestedLength = 0;
  let staleLength = 0;
  let totalIntensity = 0;

  for (const segment of segments) {
    const length = segment.end_position - segment.start_position;
    totalIntensity += segment.intensity * length;

    switch (segment.segment_type) {
      case 'verified':
        verifiedLength += length;
        break;
      case 'unverified':
        unverifiedLength += length;
        break;
      case 'contested':
        contestedLength += length;
        break;
      case 'stale':
        staleLength += length;
        break;
    }
  }

  const totalLength = verifiedLength + unverifiedLength + contestedLength + staleLength;
  
  return {
    verifiedCoverage: totalLength > 0 ? verifiedLength / totalLength : 0,
    unverifiedCoverage: totalLength > 0 ? unverifiedLength / totalLength : 0,
    contestedCoverage: totalLength > 0 ? contestedLength / totalLength : 0,
    staleCoverage: totalLength > 0 ? staleLength / totalLength : 0,
    averageIntensity: totalLength > 0 ? totalIntensity / totalLength : 0,
  };
}

/**
 * Finds segments at a specific scroll position
 * Used for magnetic scrollbar feedback
 */
export function getSegmentsAtPosition(
  segments: HeatmapSegment[],
  position: number
): HeatmapSegment[] {
  return segments.filter(
    (s) => position >= s.start_position && position <= s.end_position
  );
}

/**
 * Gets the dominant segment type at a position
 * Used to determine scrollbar haptic feedback type
 */
export function getDominantSegmentType(
  segments: HeatmapSegment[],
  position: number
): HeatmapSegmentType | null {
  const segmentsAtPos = getSegmentsAtPosition(segments, position);
  
  if (segmentsAtPos.length === 0) return null;
  
  // Priority order: stale > contested > unverified > verified
  const priority: HeatmapSegmentType[] = ['stale', 'contested', 'unverified', 'verified'];
  
  for (const type of priority) {
    if (segmentsAtPos.some((s) => s.segment_type === type)) {
      return type;
    }
  }
  
  return segmentsAtPos[0].segment_type;
}
