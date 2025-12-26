/**
 * RADIANT Version Constants
 * SINGLE SOURCE OF TRUTH for version numbers
 */
export declare const RADIANT_VERSION = "4.18.0";
export declare const VERSION: {
    readonly major: 4;
    readonly minor: 17;
    readonly patch: 0;
    readonly full: "4.18.0";
    readonly build: string;
    readonly date: "2024-12";
};
export declare const MIN_VERSIONS: {
    readonly node: "20.0.0";
    readonly npm: "10.0.0";
    readonly cdk: "2.120.0";
    readonly postgres: "15.0";
    readonly swift: "5.9";
    readonly macos: "13.0";
    readonly xcode: "15.0";
};
export declare const DOMAIN_PLACEHOLDER = "YOUR_DOMAIN.com";
export declare function isDomainConfigured(domain: string): boolean;
//# sourceMappingURL=version.d.ts.map