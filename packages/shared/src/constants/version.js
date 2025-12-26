"use strict";
/**
 * RADIANT Version Constants
 * SINGLE SOURCE OF TRUTH for version numbers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMAIN_PLACEHOLDER = exports.MIN_VERSIONS = exports.VERSION = exports.RADIANT_VERSION = void 0;
exports.isDomainConfigured = isDomainConfigured;
exports.RADIANT_VERSION = '4.17.0';
exports.VERSION = {
    major: 4,
    minor: 17,
    patch: 0,
    full: '4.17.0',
    build: process.env.BUILD_NUMBER || 'local',
    date: '2024-12',
};
exports.MIN_VERSIONS = {
    node: '20.0.0',
    npm: '10.0.0',
    cdk: '2.120.0',
    postgres: '15.0',
    swift: '5.9',
    macos: '13.0',
    xcode: '15.0',
};
exports.DOMAIN_PLACEHOLDER = 'YOUR_DOMAIN.com';
function isDomainConfigured(domain) {
    return !domain.includes(exports.DOMAIN_PLACEHOLDER);
}
//# sourceMappingURL=version.js.map