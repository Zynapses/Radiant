"use strict";
/**
 * RADIANT v4.17.0 - Billing/Metering Types
 * SINGLE SOURCE OF TRUTH
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PRICING = void 0;
exports.DEFAULT_PRICING = {
    defaultMargin: 0.40,
    minimumCharge: 0.01,
    currencyCode: 'USD',
    tierDiscounts: [
        { minTokens: 1_000_000, discountPercent: 5 },
        { minTokens: 10_000_000, discountPercent: 10 },
        { minTokens: 100_000_000, discountPercent: 15 },
    ],
};
//# sourceMappingURL=billing.types.js.map