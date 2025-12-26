"use strict";
/**
 * RADIANT v4.17.0 - AWS Region Configuration
 * SINGLE SOURCE OF TRUTH
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTI_REGION_CONFIG = exports.PRIMARY_REGION = exports.REGIONS = void 0;
exports.getMultiRegionDeployment = getMultiRegionDeployment;
exports.isValidRegion = isValidRegion;
exports.getAvailableRegions = getAvailableRegions;
exports.getGlobalRegions = getGlobalRegions;
exports.REGIONS = {
    'us-east-1': { code: 'us-east-1', name: 'US East (N. Virginia)', available: true, isGlobal: true },
    'us-west-2': { code: 'us-west-2', name: 'US West (Oregon)', available: true, isGlobal: false },
    'eu-west-1': { code: 'eu-west-1', name: 'Europe (Ireland)', available: true, isGlobal: true },
    'eu-central-1': { code: 'eu-central-1', name: 'Europe (Frankfurt)', available: true, isGlobal: false },
    'ap-northeast-1': { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', available: true, isGlobal: true },
    'ap-southeast-1': { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', available: true, isGlobal: false },
    'ap-south-1': { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', available: true, isGlobal: false },
};
exports.PRIMARY_REGION = 'us-east-1';
exports.MULTI_REGION_CONFIG = {
    primary: 'us-east-1',
    europe: 'eu-west-1',
    asia: 'ap-northeast-1',
};
function getMultiRegionDeployment(primaryRegion) {
    if (primaryRegion === 'us-east-1') {
        return ['us-east-1', 'eu-west-1', 'ap-northeast-1'];
    }
    if (primaryRegion.startsWith('eu-')) {
        return ['eu-west-1', 'us-east-1', 'ap-northeast-1'];
    }
    if (primaryRegion.startsWith('ap-')) {
        return ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
    }
    return [primaryRegion];
}
function isValidRegion(region) {
    return region in exports.REGIONS;
}
function getAvailableRegions() {
    return Object.values(exports.REGIONS).filter(r => r.available);
}
function getGlobalRegions() {
    return Object.values(exports.REGIONS).filter(r => r.isGlobal);
}
//# sourceMappingURL=regions.js.map