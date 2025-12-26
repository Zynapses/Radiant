"use strict";
/**
 * RADIANT v4.17.0 - Environment Configuration
 * SINGLE SOURCE OF TRUTH
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENVIRONMENT_LIST = exports.ENVIRONMENTS = void 0;
exports.ENVIRONMENTS = {
    dev: {
        name: 'dev',
        displayName: 'Development',
        color: '#3B82F6',
        requiresApproval: false,
        minTier: 1,
        defaultTier: 1,
    },
    staging: {
        name: 'staging',
        displayName: 'Staging',
        color: '#F59E0B',
        requiresApproval: false,
        minTier: 2,
        defaultTier: 2,
    },
    prod: {
        name: 'prod',
        displayName: 'Production',
        color: '#EF4444',
        requiresApproval: true,
        minTier: 3,
        defaultTier: 3,
    },
};
exports.ENVIRONMENT_LIST = ['dev', 'staging', 'prod'];
//# sourceMappingURL=environments.js.map