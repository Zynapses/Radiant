---
description: How to add or update unit tests and ensure they appear in QA UI
---

# Adding Unit Tests Workflow

When creating or updating unit tests, follow these steps to ensure they are discoverable in the QA sections.

## 1. Create Test Files

Place test files in the appropriate location:
- **Admin Dashboard**: `apps/admin-dashboard/__tests__/**/*.test.ts`
- **Infrastructure**: `packages/infrastructure/__tests__/**/*.test.ts`
- **Shared Package**: `packages/shared/__tests__/**/*.test.ts`

## 2. Update Package.json (if new package)

Ensure the package has a `test` script in `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 3. Update Swift Deployer QA Section

**REQUIRED**: If adding a new test suite category, update the `UnitTestSuite` enum in:
`apps/swift-deployer/Sources/RadiantDeployer/Views/SettingsView.swift`

```swift
enum UnitTestSuite: String, CaseIterable {
    case all = "All Tests"
    case adminDashboard = "Admin Dashboard"
    case infrastructure = "Infrastructure"
    case shared = "Shared Package"
    // ADD NEW SUITES HERE
}
```

Also update:
- `suiteIcon(for:)` - Add icon for new suite
- `suiteDescription(for:)` - Add description for new suite
- `testCommand(for:projectRoot:)` - Add command/path for new suite

## 4. Verify Tests Run

```bash
# Run from package directory
npm run test

# Or from root for all tests
npm run test
```

## 5. Verify in QA UI

1. Build and run Swift Deployer
2. Go to Settings → QA & Testing → Unit Tests
3. Verify new test suite appears in list
4. Run tests to confirm they execute correctly

## Checklist

- [ ] Test files created in correct location
- [ ] Package has `test` script
- [ ] Swift deployer `UnitTestSuite` enum updated (if new suite)
- [ ] `suiteIcon`, `suiteDescription`, `testCommand` updated (if new suite)
- [ ] Tests pass locally
- [ ] Tests visible in QA UI
