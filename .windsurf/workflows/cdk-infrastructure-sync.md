---
description: Policy - CDK infrastructure must be updated when AWS resources change
---

# CDK Infrastructure Sync Policy

**MANDATORY**: All AWS resource changes must be reflected in CDK stacks.

## When This Policy Applies

This policy is triggered when ANY of the following occur:

1. **New Lambda handlers** are created in `packages/infrastructure/lambda/`
2. **New API endpoints** are added or modified
3. **Database tables** are created via migrations
4. **New AWS resources** are needed (S3, DynamoDB, SQS, SNS, etc.)
5. **IAM permissions** need to be added or changed
6. **Environment variables** are added to Lambda functions

## Required Actions

### 1. Update CDK Stack

| If creating... | MUST update CDK in... |
|----------------|----------------------|
| Lambda handler | `lib/stacks/api-stack.ts` or appropriate stack |
| API Gateway route | `lib/stacks/api-stack.ts` |
| Database migration | Verify RLS policies work with existing CDK |
| S3 bucket | `lib/stacks/storage-stack.ts` |
| DynamoDB table | `lib/stacks/data-stack.ts` |
| Cognito resource | `lib/stacks/auth-stack.ts` |
| SageMaker resource | `lib/stacks/ai-stack.ts` |
| Step Functions | Appropriate feature stack |

### 2. Resource Limit Check

**CRITICAL**: CloudFormation has a 500 resource limit per stack.

Before adding resources, check current count:
```bash
cd packages/infrastructure
npx cdk synth --quiet 2>&1 | grep "Number of resources"
```

If approaching limit (>450):
- Use `addProxy()` instead of individual `addMethod()` calls
- Consolidate Lambda handlers with path-based routing
- Create a new nested or separate stack

### 3. CDK Patterns to Follow

#### Efficient API Routes (Use Proxy)
```typescript
// GOOD: Single proxy catches all sub-paths
resource.addProxy({
  defaultIntegration: lambdaIntegration,
  defaultMethodOptions: {
    authorizer: adminAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
  },
});

// BAD: Individual methods bloat resource count
resource.addResource('foo').addMethod('GET', integration, { ... });
resource.addResource('bar').addMethod('POST', integration, { ... });
```

#### Consolidated Lambda Handlers
```typescript
// GOOD: Single handler with path-based routing
export const handler = async (event) => {
  const path = event.path;
  if (path.includes('/foo')) return await handleFoo(event);
  if (path.includes('/bar')) return await handleBar(event);
};

// BAD: Separate Lambda per endpoint (wastes resources)
```

#### Pre-built Lambda Code
```typescript
// GOOD: Use pre-built code from lambda/dist
new lambda.Function(this, 'MyFunction', {
  handler: 'my-handler/index.handler',
  code: lambda.Code.fromAsset('lambda/dist'),
  ...
});

// AVOID: NodejsFunction with esbuild (requires esbuild installed)
new lambdaNodejs.NodejsFunction(this, 'MyFunction', { ... });
```

### 4. Verification Steps

After making CDK changes:

```bash
# 1. Build TypeScript
cd packages/infrastructure
npm run build

# 2. Build Lambda handlers
cd lambda && npm run build && cd ..

# 3. Synthesize and check resource count
npx cdk synth --quiet

# 4. Diff to see changes
npx cdk diff <stack-name>

# 5. Deploy (requires AWS credentials)
npx cdk deploy <stack-name> --require-approval never
```

### 5. Stack Dependencies

When creating new stacks, ensure proper dependencies:

```typescript
// In bin/radiant.ts
const newStack = new MyNewStack(app, `${stackPrefix}-my-stack`, {
  env,
  vpc: networkingStack.vpc,
  userPool: authStack.userPool,
  // ... other dependencies
});
newStack.addDependency(authStack);
newStack.addDependency(networkingStack);
```

### 6. Environment Variables

All Lambda environment variables must be defined in CDK:

```typescript
const commonEnv: Record<string, string> = {
  APP_ID: appId,
  ENVIRONMENT: environment,
  DATABASE_SECRET_ARN: databaseSecretArn,
  // Add new env vars here
};
```

## Examples of Violations

**VIOLATION**: Creating `lambda/new-feature/handler.ts` without adding CDK routes
**VIOLATION**: Adding API endpoints that aren't in any CDK stack
**VIOLATION**: Creating resources that exceed the 500 resource limit
**VIOLATION**: Using `NodejsFunction` when esbuild isn't configured

## Checklist

Before completing any AWS resource change:

- [ ] CDK stack updated with new resources
- [ ] Resource count checked (`npx cdk synth`)
- [ ] Lambda handlers use pre-built code pattern
- [ ] API routes use proxy pattern where possible
- [ ] Stack dependencies configured in `bin/radiant.ts`
- [ ] Environment variables added to CDK
- [ ] `npx cdk synth` passes without errors
- [ ] CHANGELOG updated with infrastructure changes
