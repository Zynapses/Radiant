/**
 * Validate Transition Lambda
 * 
 * Validates a tier transition request before proceeding.
 */

import { Handler } from 'aws-lambda';
import { logger } from '../shared/logging/enhanced-logger';

interface TransitionEvent {
  tenantId: string;
  fromTier: string;
  toTier: string;
  direction: 'SCALING_UP' | 'SCALING_DOWN';
  requestedBy: string;
  reason: string;
  timestamp: string;
}

export const handler: Handler<TransitionEvent, TransitionEvent> = async (event) => {
  logger.info('Validating transition:', { event });

  const { tenantId, fromTier, toTier, direction } = event;

  // Validate required fields
  if (!tenantId || !fromTier || !toTier || !direction) {
    throw new Error('Missing required fields: tenantId, fromTier, toTier, direction');
  }

  // Validate tier values
  const validTiers = ['DEV', 'STAGING', 'PRODUCTION'];
  if (!validTiers.includes(fromTier) || !validTiers.includes(toTier)) {
    throw new Error(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
  }

  // Validate direction matches tiers
  const tierOrder = { DEV: 1, STAGING: 2, PRODUCTION: 3 };
  const expectedDirection = tierOrder[toTier as keyof typeof tierOrder] > tierOrder[fromTier as keyof typeof tierOrder]
    ? 'SCALING_UP'
    : 'SCALING_DOWN';

  if (direction !== expectedDirection) {
    throw new Error(`Direction mismatch. Expected ${expectedDirection} for ${fromTier} -> ${toTier}`);
  }

  logger.info('Validation passed');
  return event;
};
