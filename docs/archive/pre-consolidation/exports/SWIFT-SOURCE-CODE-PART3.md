# RADIANT Swift Deployer - ACTUAL SOURCE CODE - Part 3

## File: Services/LocalStorageManager.swift
Full SQLCipher-encrypted local storage with backup/restore functionality.
- Schema migrations
- Deployment records CRUD
- Settings storage
- Backup rotation (keeps last 5)
- Auto-restore from backup chain
- Encryption key hierarchy (env var → 1Password → local secure file)

## File: Services/TimeoutService.swift
Operation timeout management with SSM Parameter Store sync.
- Default timeouts for CDK, migrations, health checks
- 60-second SSM polling interval
- Retry with exponential backoff
- Cancellation token support
- `execute()` wraps operations with timeout/retry

## File: Services/AuditLogger.swift
Compliance audit logging for HIPAA/SOC2.
- 75+ audit action types covering credentials, deployments, security
- JSON-line log file persistence
- Entry rotation (10,000 max)
- Export to JSON for compliance reporting

## File: Services/OnePasswordService.swift
1Password CLI integration for credential storage.
- Service Account token in Keychain
- AWS credential CRUD in RADIANT vault
- Provider API key storage (Anthropic, Groq)
- STS credential validation
- Full CLI path detection (Homebrew, system)

## File: Models/InstallationParameters.swift
Deployment parameter definitions.
- 5 tier levels (SEED→ENTERPRISE) with defaults
- AWS region enumeration
- Installation vs Instance parameters
- Parameter change tracking
- Deployment snapshots with database rollback support

## File: Models/DomainConfiguration.swift
Domain/DNS/Email configuration models.
- Domain verification with hosted zones
- DNS record types (A, CNAME, MX, TXT)
- SES email configuration (DKIM, SPF)
- ACM certificate validation
- Domain setup summary

## File: Models/AWSMonitoringModels.swift (817 lines)
Comprehensive AWS monitoring data structures:
- Lambda, Aurora, ECS metrics
- X-Ray trace summaries and service graphs
- Cost Explorer with anomaly detection
- Free tier usage tracking
- Notification targets and thresholds
- Service health status aggregation

## File: Components/MacOSComponents.swift (744 lines)
SwiftUI component library:
- Design tokens (RadiantSpacing, RadiantRadius)
- GlassSurface modifier for Liquid Glass
- GlassToolbar, ToolbarActionButton
- SidebarSection, SidebarRow
- DataListRow, InspectorPanel
- LoadingStateView, EmptyState, ErrorStateView
- ToastBanner, StandardContextMenu
