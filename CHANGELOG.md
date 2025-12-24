# Changelog

All notable changes to RADIANT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.17.0] - 2024-12-24

### Added

#### Infrastructure
- 36 database migrations covering all platform features
- 9 CDK stacks for AWS deployment
- Docker Compose for local development
- LocalStack integration for AWS service emulation

#### Lambda Services
- Billing service with 7-tier subscription model
- Storage billing with tiered pricing
- Localization service with AI translation
- Configuration management with tenant overrides
- Migration approval with dual-admin workflow
- Neural orchestration patterns
- Feedback learning system
- Workflow proposals

#### Admin Dashboard
- 14 fully functional pages
- Models management
- Providers management with health monitoring
- Billing & credits dashboard
- Storage usage monitoring
- Localization management
- Configuration editor
- Migration approval workflow
- Audit logs viewer
- Notifications center
- User settings

#### Developer Experience
- GitHub Actions CI/CD pipelines
- Dependabot configuration
- Pre-commit hooks with secret detection
- OpenAPI 3.1 specification
- Playwright E2E tests
- Vitest unit tests
- Comprehensive documentation

### Security
- Row-level security (RLS) on all tenant tables
- Dual-admin approval for production migrations
- MFA support for administrators
- Secret scanning in pre-commit hooks

## [4.16.0] - 2024-12-01

### Added
- Initial Swift Deployer app structure
- Base CDK infrastructure
- Core database schema

## [4.15.0] - 2024-11-15

### Added
- Project initialization
- Monorepo structure with pnpm workspaces

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 4.17.0 | 2024-12-24 | Full platform implementation |
| 4.16.0 | 2024-12-01 | Swift Deployer, base CDK |
| 4.15.0 | 2024-11-15 | Project initialization |
