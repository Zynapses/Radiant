# RADIANT Open Source Libraries Registry

> **Dependency Tracking & License Compliance**
> 
> **Version**: 1.0 | **Date**: January 19, 2026  
> **Last Updated**: January 19, 2026

---

## Overview

This document tracks all open source libraries used by RADIANT and Think Tank. It is **MANDATORY** to update this document when libraries are added or removed.

**Policy**: See `/.windsurf/workflows/open-source-library-policy.md`

---

## License Classification

| Category | Commercial Use | Flag | Action |
|----------|---------------|------|--------|
| ✅ **Permissive** | Free for commercial use | None | Auto-approved |
| ⚠️ **Weak Copyleft** | Usually OK with dynamic linking | **⚠️ REVIEW** | Legal review recommended |
| 🔶 **Strong Copyleft** | Requires source disclosure | **🔶 COPYLEFT** | Flag for review, document justification |
| 🚨 **Non-Commercial** | NOT free for commercial use | **🚨 NON-COMMERCIAL** | Flag for immediate review |
| ❓ **Proprietary/Unknown** | Requires paid license or unknown | **❓ UNKNOWN** | Flag and verify before production |

**Note**: Flagged licenses are NOT automatically blocked. They require documentation and review to ensure proper compliance.

---

## Category 1: RADIANT Platform Internal Libraries

Libraries used internally by the RADIANT platform infrastructure.

### AWS SDK Libraries

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `@aws-sdk/client-apigatewaymanagementapi` | WebSocket API management | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-bedrock-runtime` | AWS Bedrock AI runtime | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-cloudwatch` | CloudWatch metrics | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-cloudwatch-logs` | CloudWatch logging | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-cognito-identity-provider` | User authentication | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-cost-explorer` | Cost analysis | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-dynamodb` | DynamoDB operations | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-ecs` | Container orchestration | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-eventbridge` | Event scheduling | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-kms` | Key management | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-lambda` | Lambda invocation | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-rds-data` | Aurora Data API | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-s3` | S3 storage | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-sagemaker` | ML model management | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-sagemaker-runtime` | ML inference | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-secrets-manager` | Secrets storage | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-ses` | Email sending | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-sns` | Push notifications | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-sqs` | Message queuing | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-ssm` | Parameter store | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/lib-dynamodb` | DynamoDB document client | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/s3-request-presigner` | Pre-signed S3 URLs | Apache-2.0 | 2024-01-01 | ✅ |
| `@aws-sdk/client-budgets` | Budget management | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-elasticache` | Redis/ElastiCache | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-kinesis` | Data streaming | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-neptune` | Graph database | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-opensearch` | Search service | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-opensearchserverless` | Serverless search | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-pricing` | AWS pricing API | Apache-2.0 | 2024-06-01 | ✅ |
| `@aws-sdk/client-textract` | Document OCR | Apache-2.0 | 2024-06-01 | ✅ |

### Infrastructure Libraries

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `aws-cdk-lib` | AWS Cloud Development Kit | Apache-2.0 | 2024-01-01 | ✅ |
| `constructs` | CDK constructs | Apache-2.0 | 2024-01-01 | ✅ |
| `source-map-support` | Stack trace support | MIT | 2024-01-01 | ✅ |

### Database & Caching Libraries

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `pg` | PostgreSQL client for Node.js | MIT | 2024-01-01 | ✅ |
| `redis` | Redis client v5 | MIT | 2024-01-01 | ✅ |
| `ioredis` | Redis client (alternative) | MIT | 2024-01-01 | ✅ |

### Payment Processing

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `stripe` | Stripe payment SDK | MIT | 2024-01-01 | ✅ |

### Validation & Utilities

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `zod` | TypeScript-first schema validation | MIT | 2024-01-01 | ✅ |
| `uuid` | UUID generation | MIT | 2024-01-01 | ✅ |
| `date-fns` | Date manipulation | MIT | 2024-01-01 | ✅ |

### Observability

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `@opentelemetry/api` | OpenTelemetry tracing API | Apache-2.0 | 2024-06-01 | ✅ |

### Authentication

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `jwks-rsa` | JWKS RSA key retrieval | MIT | 2024-01-01 | ✅ |

---

## Category 2: Think Tank Internal Libraries

Libraries used internally by Think Tank applications.

### React Framework

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `react` | React UI library | MIT | 2024-01-01 | ✅ |
| `react-dom` | React DOM bindings | MIT | 2024-01-01 | ✅ |
| `next` | Next.js framework | MIT | 2024-01-01 | ✅ |
| `next-themes` | Theme switching for Next.js | MIT | 2024-01-01 | ✅ |

### UI Component Libraries (Radix UI)

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `@radix-ui/react-accordion` | Accessible accordion | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-alert-dialog` | Accessible alert dialogs | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-avatar` | Avatar component | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-checkbox` | Accessible checkbox | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-collapsible` | Collapsible sections | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-dialog` | Accessible modals | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-dropdown-menu` | Dropdown menus | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-label` | Form labels | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-popover` | Popover component | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-progress` | Progress indicators | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-scroll-area` | Custom scrollbars | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-select` | Accessible select | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-separator` | Visual separator | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-slider` | Range slider | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-slot` | Slot composition | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-switch` | Toggle switch | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-tabs` | Tab navigation | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-toast` | Toast notifications | MIT | 2024-01-01 | ✅ |
| `@radix-ui/react-tooltip` | Tooltips | MIT | 2024-01-01 | ✅ |

### State Management & Data Fetching

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `@tanstack/react-query` | Server state management | MIT | 2024-01-01 | ✅ |
| `@tanstack/react-query-devtools` | React Query devtools | MIT | 2024-01-01 | ✅ |
| `zustand` | Lightweight state management with persistence | MIT | 2026-01-19 | ✅ |

### Styling & Animation

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `tailwindcss` | Utility-first CSS framework | MIT | 2024-01-01 | ✅ |
| `tailwindcss-animate` | Tailwind animation utilities | MIT | 2024-01-01 | ✅ |
| `tailwind-merge` | Merge Tailwind classes | MIT | 2024-01-01 | ✅ |
| `class-variance-authority` | Variant class management | Apache-2.0 | 2024-01-01 | ✅ |
| `clsx` | Conditional classnames | MIT | 2024-01-01 | ✅ |
| `framer-motion` | Animation library | MIT | 2024-01-01 | ✅ |
| `autoprefixer` | CSS vendor prefixing | MIT | 2024-01-01 | ✅ |
| `postcss` | CSS transformation | MIT | 2024-01-01 | ✅ |

### Forms

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `react-hook-form` | Performant forms | MIT | 2024-01-01 | ✅ |
| `@hookform/resolvers` | Form validation resolvers | MIT | 2024-01-01 | ✅ |

### Icons & Visualization

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `lucide-react` | Icon library | ISC | 2024-01-01 | ✅ |
| `recharts` | Charting library | MIT | 2024-01-01 | ✅ |
| `d3-geo` | Geographic projections | ISC | 2024-01-01 | ✅ |
| `react-simple-maps` | Map components | MIT | 2024-01-01 | ✅ |
| `topojson-client` | TopoJSON parsing | ISC | 2024-01-01 | ✅ |

### Content Rendering

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `react-markdown` | Markdown rendering in React | MIT | 2026-01-19 | ✅ |
| `react-syntax-highlighter` | Code syntax highlighting | MIT | 2026-01-19 | ✅ |

### UI Utilities

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `cmdk` | Command palette | MIT | 2024-01-01 | ✅ |
| `sonner` | Toast notifications | MIT | 2024-01-01 | ✅ |
| `react-resizable-panels` | Resizable panel layouts | MIT | 2024-01-01 | ✅ |

---

## Category 3: Orchestration / User Libraries

Libraries that users or Cato can invoke for document processing, file conversion, and AI orchestration.

### Document Processing

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `mammoth` | DOCX to HTML conversion | BSD-2-Clause | 2024-01-01 | ✅ |
| `pdf-parse` | PDF text extraction | MIT | 2024-01-01 | ✅ |
| `xlsx` | Excel file processing | Apache-2.0 | 2024-01-01 | ✅ |
| `pdfkit` | PDF generation for AI reports | MIT | 2026-01-22 | ✅ |
| `exceljs` | Excel generation for AI reports | MIT | 2026-01-22 | ✅ |

### Media Processing

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `sharp` | High-performance image processing | Apache-2.0 | 2024-01-01 | ✅ |
| `@ts-ffmpeg/fluent-ffmpeg` | FFmpeg wrapper (TypeScript fork) | MIT | 2026-01-20 | ✅ |

### Collaboration (CRDT)

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `yjs` | CRDT implementation for real-time collaboration | MIT | 2024-06-01 | ✅ |
| `y-protocols` | Yjs protocol handlers | MIT | 2024-06-01 | ✅ |

### Archiving

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `adm-zip` | ZIP file handling | MIT | 2024-01-01 | ✅ |
| `tar` | TAR archive handling | ISC | 2024-01-01 | ✅ |

### Browser Automation

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `playwright` | Browser automation for web scraping | Apache-2.0 | 2024-01-01 | ✅ |

---

## Category 4: CLI Libraries

Libraries used by the RADIANT CLI tool.

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `commander` | Command-line argument parsing | MIT | 2024-01-01 | ✅ |
| `inquirer` | Interactive CLI prompts | MIT | 2024-01-01 | ✅ |
| `chalk` | Terminal string styling | MIT | 2024-01-01 | ✅ |
| `ora` | Terminal spinners | MIT | 2024-01-01 | ✅ |
| `conf` | Configuration storage | MIT | 2024-01-01 | ✅ |
| `table` | CLI table formatting | BSD-3-Clause | 2024-01-01 | ✅ |

---

## Category 5: Swift Libraries (macOS Deployer)

Libraries used by the Swift macOS deployer application.

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `GRDB.swift` | SQLite database toolkit | MIT | 2024-01-01 | ✅ |

---

## Category 6: Development & Testing Libraries

Libraries used only in development and testing environments.

### Testing Frameworks

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `vitest` | Vite-native test runner | MIT | 2024-01-01 | ✅ |
| `@vitest/coverage-v8` | Vitest coverage with V8 | MIT | 2024-01-01 | ✅ |
| `@vitest/ui` | Vitest UI | MIT | 2024-01-01 | ✅ |
| `jest` | JavaScript testing framework | MIT | 2024-01-01 | ✅ |
| `ts-jest` | TypeScript Jest transformer | MIT | 2024-01-01 | ✅ |
| `@playwright/test` | Playwright test runner | Apache-2.0 | 2024-01-01 | ✅ |
| `@testing-library/react` | React testing utilities | MIT | 2024-01-01 | ✅ |
| `jsdom` | DOM implementation for Node.js | MIT | 2024-01-01 | ✅ |
| `chai` | Assertion library | MIT | 2024-01-01 | ✅ |

### Build Tools

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `typescript` | TypeScript compiler | Apache-2.0 | 2024-01-01 | ✅ |
| `ts-node` | TypeScript execution | MIT | 2024-01-01 | ✅ |
| `tsup` | TypeScript bundler | MIT | 2024-01-01 | ✅ |
| `esbuild` | Fast JavaScript bundler | MIT | 2024-01-01 | ✅ |
| `@vitejs/plugin-react` | Vite React plugin | MIT | 2024-01-01 | ✅ |

### Linting & Formatting

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `eslint` | JavaScript linter | MIT | 2024-01-01 | ✅ |
| `eslint-config-next` | Next.js ESLint config | MIT | 2024-01-01 | ✅ |
| `@typescript-eslint/eslint-plugin` | TypeScript ESLint rules | MIT | 2024-01-01 | ✅ |
| `@typescript-eslint/parser` | TypeScript ESLint parser | BSD-2-Clause | 2024-01-01 | ✅ |
| `husky` | Git hooks | MIT | 2024-01-01 | ✅ |
| `lint-staged` | Lint staged files | MIT | 2024-01-01 | ✅ |

### Type Definitions

| Library | Description | License | Date Added | Flag |
|---------|-------------|---------|------------|------|
| `@types/node` | Node.js type definitions | MIT | 2024-01-01 | ✅ |
| `@types/react` | React type definitions | MIT | 2024-01-01 | ✅ |
| `@types/react-dom` | React DOM type definitions | MIT | 2024-01-01 | ✅ |
| `@types/aws-lambda` | AWS Lambda type definitions | MIT | 2024-01-01 | ✅ |
| `@types/pg` | PostgreSQL type definitions | MIT | 2024-01-01 | ✅ |
| `@types/uuid` | UUID type definitions | MIT | 2024-01-01 | ✅ |
| `@types/jest` | Jest type definitions | MIT | 2024-01-01 | ✅ |
| `@types/inquirer` | Inquirer type definitions | MIT | 2024-01-01 | ✅ |
| `@types/d3-geo` | D3 Geo type definitions | MIT | 2024-01-01 | ✅ |
| `@types/topojson-client` | TopoJSON type definitions | MIT | 2024-01-01 | ✅ |
| `@types/adm-zip` | ADM-ZIP type definitions | MIT | 2024-01-01 | ✅ |
| `@types/fluent-ffmpeg` | FFmpeg type definitions | MIT | 2024-01-01 | ✅ |
| `@types/jsonwebtoken` | JWT type definitions | MIT | 2024-01-01 | ✅ |
| `@types/pdf-parse` | PDF Parse type definitions | MIT | 2024-01-01 | ✅ |
| `@types/sharp` | Sharp type definitions | MIT | 2024-01-01 | ✅ |

---

## License Summary

| License | Count | Commercial Use |
|---------|-------|----------------|
| MIT | 85+ | ✅ Free |
| Apache-2.0 | 35+ | ✅ Free |
| ISC | 5 | ✅ Free |
| BSD-2-Clause | 2 | ✅ Free |
| BSD-3-Clause | 1 | ✅ Free |

**Total Libraries**: 120+  
**🔶 Copyleft Flagged**: 0  
**🚨 Non-Commercial Flagged**: 0  
**⚠️ Review Required**: 0

---

## Adding a New Library

When adding a new library, you **MUST**:

1. **Check the license** - Identify the license type
2. **Categorize it** - Determine which category it belongs to
3. **Update this document** - Add it to the appropriate table
4. **Include all fields**: Name, Description, License, Date Added, Flag
5. **If flagged** - Document justification in "Flagged Libraries" section below

### License Classification Process

| License Type | Flag | Action |
|--------------|------|--------|
| MIT, Apache-2.0, ISC, BSD | ✅ | Auto-approved |
| LGPL-2.1, LGPL-3.0 | ⚠️ REVIEW | Flag, legal review recommended |
| MPL-2.0 | ⚠️ REVIEW | Flag, file-level copyleft |
| GPL-2.0, GPL-3.0 | 🔶 COPYLEFT | Flag, document isolation strategy |
| AGPL-3.0 | 🔶 COPYLEFT | Flag, document network usage |
| SSPL | 🚨 NON-COMMERCIAL | Flag for immediate review |
| Commons Clause | 🚨 NON-COMMERCIAL | Flag for immediate review |
| Proprietary | ❓ UNKNOWN | Flag, verify licensing terms |
| Unknown | ❓ UNKNOWN | Flag, must verify before production |

---

## Flagged Libraries

Libraries with non-permissive licenses that require documentation.

| Library | License | Flag | Justification | Reviewed By | Date |
|---------|---------|------|---------------|-------------|------|
| — | — | — | No flagged libraries yet | — | — |

---

## Removing a Library

When removing a library:

1. **Update this document** - Remove from the appropriate table
2. **Add to removal log** - Document in the "Removal History" section below
3. **Update package.json** - Remove from all relevant package files

---

## Removal History

| Library | Category | Removal Date | Reason |
|---------|----------|--------------|--------|
| `fluent-ffmpeg` | Media Processing | 2026-01-20 | Deprecated/unmaintained, replaced with `@ts-ffmpeg/fluent-ffmpeg` |
| `@types/fluent-ffmpeg` | Type Definitions | 2026-01-20 | No longer needed, replacement includes types |

---

**Policy**: This document is maintained under `/.windsurf/workflows/open-source-library-policy.md`
