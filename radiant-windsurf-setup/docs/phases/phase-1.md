# Phase 1: Foundation

**Estimated Lines**: ~6,500  
**Estimated Time**: 40-60 AI-assisted minutes  
**Dependencies**: None (start here)

## Sections

### Section 0: Shared Types & Constants
**File**: `docs/sections/section-00-shared-types.md`  
**Creates**:
- `radiant-infrastructure/lib/shared/constants.ts` - RADIANT_VERSION, config
- `radiant-infrastructure/lib/shared/types.ts` - All TypeScript interfaces
- `radiant-infrastructure/lib/shared/errors.ts` - Typed error classes

**Key Types Defined**:
- TenantConfig, ApplicationConfig
- ModelProvider, ModelCapability
- SubscriptionTier, BillingConfig
- DeploymentEnvironment

### Section 1: Swift Deployment App
**File**: `docs/sections/section-01-swift-app.md`  
**Creates** (in order):
1. `RadiantDeployer/Package.swift`
2. `RadiantDeployer/Sources/RadiantDeployer/RadiantDeployerApp.swift`
3. `Models/` - DeploymentConfig, Credential, etc.
4. `Services/` - CredentialService, DeploymentService, etc.
5. `Views/` - MainView, DeploymentView, etc.

**Key Features**:
- SQLCipher secure credential storage
- AWS CLI integration
- Real-time deployment progress
- Multi-environment support

### Section 2: CDK Infrastructure Stacks
**File**: `docs/sections/section-02-cdk-base.md`  
**Creates**:
- `radiant-infrastructure/package.json`
- `radiant-infrastructure/cdk.json`
- VPC Stack (multi-AZ, NAT gateways)
- Cognito Stack (user pools, app clients)
- Aurora Stack (PostgreSQL, read replicas)
- S3 Stack (buckets, lifecycle policies)
- Base API Gateway Stack

## Verification Commands

```bash
# Verify Swift builds
cd RadiantDeployer && swift build

# Verify CDK synthesizes
cd radiant-infrastructure && npm install && npx cdk synth

# Check for type errors
npx tsc --noEmit
```

## Success Criteria

- [ ] Swift project compiles without errors
- [ ] All CDK stacks synthesize successfully
- [ ] Shared types are importable from all stacks
- [ ] No hardcoded version strings

## Next Steps

After Phase 1 verification passes:
```
/implement-phase 2
```
