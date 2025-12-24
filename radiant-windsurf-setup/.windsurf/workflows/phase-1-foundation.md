# Phase 1: Foundation

## Trigger
`/implement-phase 1` or `/phase-1`

## Sections to Implement
- **Section 0**: Shared Types & Constants (lines 691-2183)
- **Section 1**: Swift Deployment App (lines 2184-4835)
- **Section 2**: CDK Infrastructure Stacks (lines 4836-7526)

## Implementation Order

### Step 1: Create Project Scaffolds
```bash
mkdir -p RadiantDeployer/Sources/RadiantDeployer/{Models,Services,Views,Resources}
mkdir -p radiant-infrastructure/{lib/{stacks,constructs,lambdas},migrations}
```

### Step 2: Section 0 - Shared Types
Create in this order:
1. `radiant-infrastructure/lib/shared/constants.ts`
2. `radiant-infrastructure/lib/shared/types.ts`
3. `radiant-infrastructure/lib/shared/errors.ts`

### Step 3: Section 1 - Swift App
Create in this order:
1. `RadiantDeployer/Package.swift`
2. `RadiantDeployer/Sources/RadiantDeployer/RadiantDeployerApp.swift`
3. Models (in order listed in section)
4. Services (in order listed in section)
5. Views (in order listed in section)

### Step 4: Section 2 - Base CDK
Create in this order:
1. `radiant-infrastructure/package.json`
2. `radiant-infrastructure/cdk.json`
3. `radiant-infrastructure/lib/stacks/vpc-stack.ts`
4. `radiant-infrastructure/lib/stacks/cognito-stack.ts`
5. `radiant-infrastructure/lib/stacks/aurora-stack.ts`
6. Remaining stacks per section

## Verification
- [ ] Swift project builds: `cd RadiantDeployer && swift build`
- [ ] CDK synthesizes: `cd radiant-infrastructure && npx cdk synth`
- [ ] No type errors in shared definitions

## Next Phase
After verification passes, run `/implement-phase 2`
