"use strict";
/**
 * RADIANT v4.17.0 - Compliance/PHI Types
 * SINGLE SOURCE OF TRUTH
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PHI_CONFIG = void 0;
exports.DEFAULT_PHI_CONFIG = {
    mode: 'auto',
    categories: ['name', 'date', 'phone', 'email', 'ssn', 'mrn', 'address'],
    autoSanitize: true,
    allowReidentification: false,
    logSanitization: true,
    retentionDays: 365,
};
//# sourceMappingURL=compliance.types.js.map