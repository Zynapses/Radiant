/**
 * Database utility re-exports
 * Provides convenient access to database functions from utils path
 */

export {
  executeStatement,
  executeQuery,
  stringParam,
  longParam,
  doubleParam,
  boolParam,
  uuidParam,
} from '../db/client';

// Alias for compatibility
export { longParam as intParam } from '../db/client';

export { getPoolClient } from '../db/centralized-pool';
export { withDbClient as withClient } from '../db/with-client';
