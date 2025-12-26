"use strict";
/**
 * RADIANT v4.17.0 - Validation Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.isValidDomain = isValidDomain;
exports.isValidAppId = isValidAppId;
exports.isValidAWSRegion = isValidAWSRegion;
exports.isValidAWSAccountId = isValidAWSAccountId;
exports.validateTenantId = validateTenantId;
exports.sanitizeInput = sanitizeInput;
const version_1 = require("../constants/version");
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function isValidDomain(domain) {
    if (domain.includes(version_1.DOMAIN_PLACEHOLDER)) {
        return false;
    }
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(domain);
}
function isValidAppId(appId) {
    const appIdRegex = /^[a-z][a-z0-9-]{2,49}$/;
    return appIdRegex.test(appId);
}
function isValidAWSRegion(region) {
    const regionRegex = /^[a-z]{2}-[a-z]+-\d+$/;
    return regionRegex.test(region);
}
function isValidAWSAccountId(accountId) {
    const accountIdRegex = /^\d{12}$/;
    return accountIdRegex.test(accountId);
}
function validateTenantId(tenantId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(tenantId);
}
function sanitizeInput(input) {
    return input
        .trim()
        .replace(/[<>]/g, '')
        .substring(0, 10000);
}
//# sourceMappingURL=validation.js.map