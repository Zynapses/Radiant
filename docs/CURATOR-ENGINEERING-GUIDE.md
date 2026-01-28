# RADIANT Curator App - Engineering Documentation

> **Version**: 1.0.0  
> **Last Updated**: 2026-01-28  
> **Application**: @radiant/curator  
> **Port**: 3003

## Executive Summary

RADIANT Curator is an enterprise-grade **AI Knowledge Curation Platform** that enables organizations to teach, verify, and govern AI understanding of corporate knowledge. It implements a human-in-the-loop verification system called the **"Entrance Exam"** where AI-extracted facts must pass human review before deployment.

### Key Differentiators

| Feature | Description |
|---------|-------------|
| **Entrance Exam** | AI must prove it understands facts correctly before deployment |
| **Golden Rules (God Mode)** | Human overrides that supersede all AI learning |
| **Chain of Custody** | Cryptographic audit trail for all knowledge changes |
| **Zero-Copy Connectors** | Index metadata without moving files from source systems |
| **Conflict Resolution** | Side-by-side comparison for contradictory knowledge |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [UI Pages & Components](#ui-pages--components)
5. [Backend API Reference](#backend-api-reference)
6. [Data Models](#data-models)
7. [Core Features](#core-features)
8. [User Flows](#user-flows)
9. [State Management](#state-management)
10. [Styling System](#styling-system)
11. [Security & Audit](#security--audit)
12. [Integration Points](#integration-points)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RADIANT CURATOR                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │  Dashboard  │    │   Ingest    │    │   Verify    │    │   Graph     │ │
│   │    Page     │    │    Page     │    │    Page     │    │    Page     │ │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│          │                  │                  │                  │         │
│   ┌──────┴──────────────────┴──────────────────┴──────────────────┴──────┐  │
│   │                        Next.js App Router                            │  │
│   │                    (Client-Side Rendering)                           │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  │ REST API                                 │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │              /api/curator/* (Next.js API Routes)                     │  │
│   │                        OR                                            │  │
│   │         Lambda: packages/infrastructure/lambda/curator               │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│          ┌───────────────────────┼───────────────────────┐                  │
│          │                       │                       │                  │
│          ▼                       ▼                       ▼                  │
│   ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐       │
│   │ Golden Rules│    │  Entrance Exam   │    │  Chain of Custody   │       │
│   │  Service    │    │    Service       │    │     Service         │       │
│   └─────────────┘    └──────────────────┘    └─────────────────────┘       │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     Aurora PostgreSQL                                │  │
│   │              (Multi-tenant with RLS)                                 │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Communication Flow

```
User Action → React Component → fetch() → API Route → Service → Database
                    ↓
            State Update (useState)
                    ↓
            UI Re-render
```

---

## 2. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.1.0 | React framework with App Router |
| **React** | 18.2.x | UI library |
| **TypeScript** | 5.3.x | Type safety |
| **Tailwind CSS** | 3.4.x | Utility-first styling |
| **Radix UI** | Various | Accessible component primitives |
| **Lucide React** | 0.309.x | Icon library |
| **React Dropzone** | 14.2.x | File upload handling |
| **Recharts** | 2.10.x | Data visualization |
| **D3.js** | 7.8.x | Knowledge graph rendering |
| **Sonner** | 1.3.x | Toast notifications |
| **Framer Motion** | 11.x | Animations |
| **TanStack Query** | 5.17.x | Server state management |

### Backend

| Technology | Purpose |
|------------|---------|
| **AWS Lambda** | Serverless API handlers |
| **Aurora PostgreSQL** | Primary database with RLS |
| **AWS S3** | Document storage |
| **AWS Textract** | Document text extraction |

---

## 3. Project Structure

```
apps/curator/
├── app/
│   ├── (dashboard)/                    # Dashboard route group
│   │   ├── layout.tsx                  # Dashboard layout with sidebar
│   │   ├── page.tsx                    # Main dashboard
│   │   ├── ingest/
│   │   │   └── page.tsx                # Document ingestion
│   │   ├── verify/
│   │   │   └── page.tsx                # Knowledge verification (Entrance Exam)
│   │   ├── graph/
│   │   │   └── page.tsx                # Knowledge graph visualization
│   │   ├── domains/
│   │   │   └── page.tsx                # Domain taxonomy management
│   │   ├── overrides/
│   │   │   └── page.tsx                # Golden Rules management
│   │   ├── conflicts/
│   │   │   └── page.tsx                # Conflict resolution queue
│   │   └── history/
│   │       └── page.tsx                # Activity audit log
│   ├── globals.css                     # Global styles + Curator theme
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Landing redirect
│   └── providers.tsx                   # React Query + Theme providers
├── components/
│   └── ui/
│       ├── glass-card.tsx              # Glass morphism card component
│       └── ...                         # Additional UI components
├── lib/
│   └── utils.ts                        # Utility functions (cn, formatBytes)
├── package.json
├── tailwind.config.js                  # Custom Curator color palette
└── tsconfig.json
```

---

## 4. UI Pages & Components

### 4.1 Dashboard (`/dashboard`)

**File**: `app/(dashboard)/page.tsx`

The main entry point showing:

- **Stats Grid**: Knowledge nodes, documents ingested, verified facts, pending verification
- **Quick Actions**: Links to Ingest, Verify, and Graph pages
- **Recent Activity**: Timeline of latest curation events
- **Pending Alert**: Warning banner when items await verification

```typescript
interface DashboardStats {
  knowledgeNodes: number;
  documentsIngested: number;
  verifiedFacts: number;
  pendingVerification: number;
}

interface ActivityItem {
  id: string;
  type: 'ingestion' | 'verification' | 'override';
  message: string;
  time: string;
  status: 'success' | 'verified' | 'override' | 'pending' | 'error';
}
```

**API Endpoints Used**:
- `GET /api/curator/dashboard`
- `GET /api/curator/audit?limit=10`

---

### 4.2 Document Ingestion (`/dashboard/ingest`)

**File**: `app/(dashboard)/ingest/page.tsx`

Enables document upload and zero-copy connector management.

#### Features

1. **Drag & Drop Upload**
   - Supports PDF, DOC, DOCX, TXT, CSV
   - Progress tracking with node creation count
   - Domain categorization selection

2. **Zero-Copy Connectors**
   - S3, Azure Blob, SharePoint, Google Drive, Snowflake, Confluence
   - 3-step wizard: Select Type → Configure → Confirm
   - Stub node indexing (metadata only, files stay in place)

```typescript
type ConnectorType = 's3' | 'azure_blob' | 'sharepoint' | 'google_drive' | 'snowflake' | 'confluence';

interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: 'connected' | 'syncing' | 'error' | 'pending';
  lastSync?: string;
  stubNodesCreated: number;
}
```

**API Endpoints Used**:
- `GET /api/curator/connectors`
- `POST /api/curator/connectors`
- `POST /api/curator/connectors/:id/sync`
- `POST /api/curator/documents/upload`

---

### 4.3 Knowledge Verification (`/dashboard/verify`)

**File**: `app/(dashboard)/verify/page.tsx`

The **"Entrance Exam"** system - AI must prove it understands facts correctly.

#### Quiz Card Types

| Type | Icon | Description |
|------|------|-------------|
| `fact_check` | CheckCircle2 | Verify extracted facts |
| `logic_check` | GitBranch | Verify inferred relationships |
| `ambiguity` | HelpCircle | Choose between conflicting values |

```typescript
type QuizCardType = 'fact_check' | 'logic_check' | 'ambiguity';

interface VerificationItem {
  id: string;
  statement: string;
  source: string;
  sourcePage?: number;
  confidence: number;
  domain: string;
  status: 'pending' | 'verified' | 'rejected' | 'needs_review';
  aiReasoning?: string;
  cardType: QuizCardType;
  optionA?: string;        // For ambiguity cards
  optionB?: string;        // For ambiguity cards
  inferredRelationship?: string;  // For logic_check cards
}
```

#### User Actions

1. **Approve** (`handleVerify`) - Mark as correct
2. **Correct** (`handleCorrect`) - Fix and create Golden Rule
3. **Reject** (`handleReject`) - Mark as wrong
4. **Resolve Ambiguity** (`handleAmbiguityChoice`) - Choose A or B

**API Endpoints Used**:
- `GET /api/curator/verification`
- `POST /api/curator/verification/:id/approve`
- `POST /api/curator/verification/:id/reject`
- `POST /api/curator/verification/:id/correct`
- `POST /api/curator/verification/:id/resolve-ambiguity`

---

### 4.4 Knowledge Graph (`/dashboard/graph`)

**File**: `app/(dashboard)/graph/page.tsx`

Interactive visualization of knowledge nodes and relationships.

#### Node Types

| Type | Color | Purpose |
|------|-------|---------|
| `concept` | Gold (#D4AF37) | Abstract concepts |
| `fact` | Green (#50C878) | Verified facts |
| `procedure` | Blue (#0F52BA) | Step-by-step processes |
| `entity` | Bronze (#CD7F32) | Named entities |

#### Node Status

| Status | Visual | Description |
|--------|--------|-------------|
| `verified` | Green checkmark | Human-approved |
| `pending` | Yellow warning | Awaiting verification |
| `overridden` | Blue pen | Has Golden Rule override |

```typescript
interface GraphNode {
  id: string;
  label: string;
  type: 'concept' | 'fact' | 'procedure' | 'entity';
  status: 'verified' | 'pending' | 'overridden';
  x: number;
  y: number;
  connections: string[];
  content?: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePage?: number;
  confidence?: number;
  verifiedAt?: string;
  verifiedBy?: string;
  overrideValue?: string;
  overrideReason?: string;
  chainOfCustodyId?: string;
}
```

#### Features

1. **Traceability Inspector** - View node provenance
2. **Force Override (God Mode)** - Create human override
3. **Chain of Custody** - View cryptographic audit trail
4. **Zoom/Pan Controls** - Navigate large graphs

**API Endpoints Used**:
- `GET /api/curator/nodes`
- `POST /api/curator/nodes/:id/override`
- `GET /api/curator/chain-of-custody/:id`

---

### 4.5 Overrides (Golden Rules) (`/dashboard/overrides`)

**File**: `app/(dashboard)/overrides/page.tsx`

Management interface for human knowledge overrides.

#### Rule Types

| Type | Icon | Description |
|------|------|-------------|
| `force_override` | Crown | Supersedes ALL other data |
| `conditional` | Shield | Applies when condition is met |
| `context_dependent` | Link2 | Varies by context |

```typescript
type RuleType = 'force_override' | 'conditional' | 'context_dependent';

interface Override {
  id: string;
  originalFact: string;
  overriddenFact: string;
  reason: string;
  domain: string;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'expired' | 'pending_review';
  expiresAt?: string;
  priority: number;        // 1-100, higher = more important
  ruleType: RuleType;
  condition?: string;      // For conditional rules
  chainOfCustodyId?: string;
}
```

#### Priority Levels

| Range | Label | Color |
|-------|-------|-------|
| 90-100 | Critical | Red |
| 70-89 | High | Gold |
| 40-69 | Medium | Blue |
| 1-39 | Low | Gray |

**API Endpoints Used**:
- `GET /api/curator/golden-rules`
- `POST /api/curator/golden-rules`
- `DELETE /api/curator/golden-rules/:id`

---

### 4.6 Conflict Queue (`/dashboard/conflicts`)

**File**: `app/(dashboard)/conflicts/page.tsx`

Resolution interface for contradictory knowledge.

#### Conflict Types

| Type | Icon | Description |
|------|------|-------------|
| `contradiction` | XCircle | Direct factual contradiction |
| `overlap` | GitMerge | Overlapping but different |
| `temporal` | Clock | Different values over time |
| `source_mismatch` | AlertTriangle | Same fact, different sources |

```typescript
type ResolutionType = 'supersede_old' | 'supersede_new' | 'merge' | 'context_dependent' | 'ignore';

interface Conflict {
  id: string;
  nodeAId: string;
  nodeBId: string;
  nodeALabel: string;
  nodeBLabel: string;
  nodeAContent: string;
  nodeBContent: string;
  conflictType: 'contradiction' | 'overlap' | 'temporal' | 'source_mismatch';
  description: string;
  priority: number;
  status: 'unresolved' | 'resolved' | 'deferred';
  resolution?: ResolutionType;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
  detectedAt: string;
}
```

#### Resolution Options

1. **Keep A** - Version A supersedes B
2. **Keep B** - Version B supersedes A
3. **Merge** - Combine both versions
4. **Context Dependent** - Both valid in different contexts
5. **Defer** - Review later

**API Endpoints Used**:
- `GET /api/curator/conflicts`
- `POST /api/curator/conflicts/:id/resolve`

---

### 4.7 Domain Taxonomy (`/dashboard/domains`)

**File**: `app/(dashboard)/domains/page.tsx`

Hierarchical organization of knowledge domains.

```typescript
interface DomainNode {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  children?: DomainNode[];
}
```

#### Domain Settings

- **Auto-categorization**: Automatically assign new documents
- **Require Verification**: All facts must be verified before deployment

**API Endpoints Used**:
- `GET /api/curator/domains`
- `POST /api/curator/domains`
- `PUT /api/curator/domains/:id`
- `DELETE /api/curator/domains/:id`

---

### 4.8 Activity History (`/dashboard/history`)

**File**: `app/(dashboard)/history/page.tsx`

Complete audit log of all curation activities.

```typescript
interface HistoryEvent {
  id: string;
  type: 'ingestion' | 'verification' | 'rejection' | 'override';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  metadata?: {
    documentName?: string;
    domain?: string;
    nodesAffected?: number;
  };
}
```

**API Endpoints Used**:
- `GET /api/curator/audit`

---

## 5. Backend API Reference

**Base Path**: `/api/curator`

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Get dashboard statistics and activity |

### Domains

| Method | Path | Description |
|--------|------|-------------|
| GET | `/domains` | List all domains (tree structure) |
| POST | `/domains` | Create new domain |
| GET | `/domains/:id` | Get single domain |
| PUT | `/domains/:id` | Update domain |
| DELETE | `/domains/:id` | Delete domain |
| GET | `/domains/:id/schema` | Get domain schema |
| PUT | `/domains/:id/schema` | Update domain schema |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents` | List documents |
| POST | `/documents/upload` | Initiate upload |
| POST | `/documents/:id/complete` | Complete upload processing |

### Verification (Entrance Exam)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/verification` | Get verification queue |
| POST | `/verification/:id/approve` | Approve a fact |
| POST | `/verification/:id/reject` | Reject a fact |
| POST | `/verification/:id/defer` | Defer review |
| POST | `/verification/:id/correct` | Correct and create Golden Rule |
| POST | `/verification/:id/resolve-ambiguity` | Resolve A/B choice |

### Knowledge Graph

| Method | Path | Description |
|--------|------|-------------|
| GET | `/graph` | Get graph visualization data |
| GET | `/nodes` | List knowledge nodes |
| GET | `/nodes/:id` | Get single node |
| POST | `/nodes/:id/override` | Apply God Mode override |

### Golden Rules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/golden-rules` | List all rules |
| POST | `/golden-rules` | Create new rule |
| DELETE | `/golden-rules/:id` | Deactivate rule |
| POST | `/golden-rules/check` | Check if rule matches |

### Entrance Exams

| Method | Path | Description |
|--------|------|-------------|
| GET | `/exams` | List exams |
| POST | `/exams` | Generate new exam |
| GET | `/exams/:id` | Get exam details |
| POST | `/exams/:id/start` | Start exam |
| POST | `/exams/:id/submit` | Submit answer |
| POST | `/exams/:id/complete` | Complete exam |

### Chain of Custody

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chain-of-custody/:id` | Get audit trail |
| POST | `/chain-of-custody/:id/verify` | Verify fact integrity |
| GET | `/chain-of-custody/:id/audit` | Get detailed audit |

### Connectors (Zero-Copy)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/connectors` | List connectors |
| POST | `/connectors` | Create connector |
| DELETE | `/connectors/:id` | Delete connector |
| POST | `/connectors/:id/sync` | Trigger sync |

### Conflicts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conflicts` | List conflicts |
| POST | `/conflicts/:id/resolve` | Resolve conflict |

### Time Travel

| Method | Path | Description |
|--------|------|-------------|
| GET | `/snapshots` | List snapshots |
| GET | `/snapshots/:id` | Get snapshot |
| POST | `/snapshots/:id/restore` | Restore to snapshot |
| GET | `/graph/at-time` | Get graph at point in time |

---

## 6. Data Models

### Database Tables

```sql
-- Knowledge Nodes
curator_knowledge_nodes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  domain_id UUID,
  label TEXT NOT NULL,
  content TEXT,
  node_type TEXT,  -- concept, fact, procedure, entity
  status TEXT,     -- pending, verified, rejected, overridden
  confidence DECIMAL(5,2),
  source_document_id UUID,
  source_page INTEGER,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  override_value TEXT,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Verification Queue
curator_verification_queue (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  node_id UUID REFERENCES curator_knowledge_nodes,
  card_type TEXT,  -- fact_check, logic_check, ambiguity
  statement TEXT,
  option_a TEXT,
  option_b TEXT,
  ai_reasoning TEXT,
  priority INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Golden Rules
curator_golden_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  condition TEXT NOT NULL,
  override_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  rule_type TEXT,  -- force_override, conditional, context_dependent
  priority INTEGER DEFAULT 100,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Domains
curator_domains (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  parent_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT,
  node_count INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0,
  settings JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Documents
curator_documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  domain_id UUID,
  filename TEXT,
  file_size BIGINT,
  mime_type TEXT,
  s3_key TEXT,
  status TEXT,  -- pending, processing, complete, error
  nodes_created INTEGER DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Audit Log
curator_audit_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  action TEXT,
  user_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Connectors
curator_connectors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT,
  connector_type TEXT,
  config JSONB,
  status TEXT,
  stub_nodes_created INTEGER DEFAULT 0,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Conflicts
curator_conflicts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  node_a_id UUID,
  node_b_id UUID,
  conflict_type TEXT,
  description TEXT,
  priority INTEGER,
  status TEXT DEFAULT 'unresolved',
  resolution TEXT,
  resolution_reason TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 7. Core Features

### 7.1 Entrance Exam System

The Entrance Exam ensures AI-extracted knowledge passes human verification:

```
Document → Text Extraction → AI Analysis → Verification Queue → Human Review → Deployment
                                                  ↓
                                         [Approve / Correct / Reject]
                                                  ↓
                                    Golden Rule (if corrected)
```

### 7.2 Golden Rules (God Mode)

Human overrides that supersede AI learning:

1. **Force Override**: Always applies, highest priority
2. **Conditional**: Applies when condition matches
3. **Context Dependent**: Different values for different contexts

### 7.3 Chain of Custody

Cryptographic audit trail for knowledge provenance:

```typescript
{
  events: [
    { type: 'create', actor: 'AI', timestamp: '...', description: 'Extracted from document' },
    { type: 'verify', actor: 'john@corp.com', timestamp: '...', description: 'Verified as correct' },
    { type: 'override', actor: 'admin@corp.com', timestamp: '...', description: 'Updated value' }
  ],
  signature: 'sha256:abc123...'  // Tamper-evident hash
}
```

### 7.4 Zero-Copy Indexing

Connect to data sources without moving files:

```
[S3 Bucket] → [Metadata Scan] → [Stub Nodes] → [On-Demand Expansion]
```

- Files remain in original location
- Only metadata is indexed initially
- Full content extracted on demand

---

## 8. User Flows

### 8.1 Document Ingestion Flow

```
1. User selects domain (optional)
2. User drags/drops or browses files
3. Frontend creates upload entries with "pending" status
4. Backend receives files, stores in S3
5. Textract extracts text
6. AI analyzes and creates knowledge nodes
7. Nodes enter verification queue with "pending" status
8. UI updates progress and node count
```

### 8.2 Verification Flow

```
1. User navigates to /dashboard/verify
2. System shows pending items sorted by priority
3. User selects an item
4. Detail panel shows AI's understanding
5. User chooses: Approve / Correct / Reject
6. If Correct: Enters correct value + reason → Creates Golden Rule
7. System updates node status
8. Audit log records action
```

### 8.3 Override Flow

```
1. User navigates to /dashboard/overrides or graph node
2. User clicks "Force Override" / "God Mode"
3. Dialog opens with:
   - Rule type selection
   - Original value (readonly)
   - Override value (input)
   - Justification (required)
   - Priority slider
   - Expiration (optional)
4. User submits
5. System creates Golden Rule with Chain of Custody
6. Node status updates to "overridden"
```

---

## 9. State Management

### Client-Side State

The Curator app uses **React useState** for local component state:

```typescript
const [items, setItems] = useState<VerificationItem[]>([]);
const [loading, setLoading] = useState(true);
const [selectedItem, setSelectedItem] = useState<VerificationItem | null>(null);
```

### Data Fetching Pattern

```typescript
useEffect(() => {
  async function fetchData() {
    try {
      const res = await fetch('/api/curator/endpoint');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, [dependencies]);
```

### Optimistic Updates

```typescript
const handleAction = async (id: string) => {
  setActionLoading(id);
  try {
    const res = await fetch(`/api/curator/item/${id}/action`, { method: 'POST' });
    if (res.ok) {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'completed' } : item
        )
      );
      toast.success('Success', { description: 'Action completed.' });
    }
  } catch (error) {
    toast.error('Error', { description: 'Action failed.' });
  } finally {
    setActionLoading(null);
  }
};
```

---

## 10. Styling System

### Curator Color Palette

Defined in `tailwind.config.js`:

```javascript
colors: {
  curator: {
    gold: '#D4AF37',      // Primary accent, concepts
    emerald: '#50C878',   // Success, verified, facts
    sapphire: '#0F52BA',  // Secondary, procedures
    bronze: '#CD7F32',    // Tertiary, entities
  }
}
```

### Custom CSS Classes

Defined in `globals.css`:

```css
/* Glass morphism cards */
.glass-card {
  @apply bg-white/[0.03] backdrop-blur-xl border border-white/10;
}

/* Knowledge graph nodes */
.graph-node.verified { @apply border-curator-emerald/50; }
.graph-node.pending { @apply border-curator-gold/50; }
.graph-node.overridden { @apply border-curator-sapphire/50; }

/* Verification quiz cards */
.quiz-card.awaiting { @apply border-curator-gold/30 bg-curator-gold/5; }
.quiz-card.verified { @apply border-curator-emerald/30 bg-curator-emerald/5; }
.quiz-card.rejected { @apply border-destructive/30 bg-destructive/5; }

/* Confidence meter */
.confidence-meter { @apply h-2 bg-muted rounded-full overflow-hidden; }
.confidence-fill.high { @apply bg-curator-emerald; }
.confidence-fill.medium { @apply bg-curator-gold; }
.confidence-fill.low { @apply bg-destructive; }
```

### GlassCard Component

```typescript
// components/ui/glass-card.tsx
interface GlassCardProps {
  variant?: 'default' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  glowColor?: 'gold' | 'emerald' | 'sapphire' | 'none';
  hoverEffect?: boolean;
  children: React.ReactNode;
  className?: string;
}
```

---

## 11. Security & Audit

### Multi-Tenant Isolation

All queries use Row-Level Security (RLS):

```sql
-- Set at start of each request
SET app.current_tenant_id = '${tenantId}';

-- RLS policy
CREATE POLICY tenant_isolation ON curator_knowledge_nodes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Audit Logging

Every mutation is logged:

```typescript
await logAudit(
  tenantId,
  'entity_type',    // node, rule, domain, etc.
  entityId,
  'action',         // create, update, delete, verify, override
  userId,
  oldValue,         // Previous state (for updates)
  newValue          // New state
);
```

### Chain of Custody Signature

```typescript
const signature = crypto
  .createHash('sha256')
  .update(JSON.stringify(events))
  .digest('hex');
```

---

## 12. Integration Points

### RADIANT Platform Integration

| Integration | Purpose |
|-------------|---------|
| **Cortex** | Knowledge nodes feed into Cortex memory system |
| **Think Tank** | Curated knowledge enhances AI responses |
| **Domain Taxonomy API** | Shares domain hierarchy with Think Tank |
| **User Data Service** | Document storage tier management |

### External Connectors

| Connector | Auth Method | Data Indexed |
|-----------|-------------|--------------|
| AWS S3 | IAM Role | Object metadata, file names |
| Azure Blob | OAuth/SAS | Container contents |
| SharePoint | OAuth | Document library metadata |
| Google Drive | OAuth | File/folder structure |
| Snowflake | OAuth | Table/schema metadata |
| Confluence | OAuth | Page hierarchy |

---

## Appendix A: Running Locally

```bash
# From repository root
cd apps/curator

# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3003

# Type check
npm run type-check

# Build for production
npm run build
npm start
```

---

## Appendix B: Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000/api/curator

# AWS (for direct S3 uploads)
AWS_REGION=us-east-1
AWS_S3_BUCKET=radiant-curator-documents

# Database (for local development)
DATABASE_URL=postgresql://...
```

---

## Appendix C: Related Documentation

- [RADIANT Admin Guide](/docs/RADIANT-ADMIN-GUIDE.md) - Platform administration
- [Think Tank User Guide](/docs/THINKTANK-USER-GUIDE.md) - End-user documentation
- [Cortex Intelligence](/docs/sections/SECTION-16-CORTEX.md) - Memory system details
- [Domain Taxonomy API](/docs/API-REFERENCE.md#domain-taxonomy) - API specification

---

*Document generated for RADIANT v4.18.0 - Corporate Brain Platform*
