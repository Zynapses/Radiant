/**
 * Lambda Context Utilities
 * 
 * Provides typed minimal Lambda context for internal handler routing.
 * Replaces `{} as any` pattern with proper typing.
 */

import type { Context, Callback } from 'aws-lambda';

/**
 * Minimal Lambda context for internal handler routing.
 * Used when calling sub-handlers from within the main router.
 */
export const MINIMAL_CONTEXT: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'internal-route',
  functionVersion: '$LATEST',
  invokedFunctionArn: '',
  memoryLimitInMB: '256',
  awsRequestId: 'internal',
  logGroupName: '',
  logStreamName: '',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * No-op callback for handlers that require a callback parameter.
 */
export const NOOP_CALLBACK: Callback = () => {};

/**
 * Helper to call a sub-handler with minimal context.
 * Provides type safety while keeping the routing pattern clean.
 */
export function callSubHandler<T>(
  handler: (event: unknown, context: Context, callback: Callback) => T
): (event: unknown) => T {
  return (event) => handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
}
