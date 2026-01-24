# RADIANT Curator User Guide

> Version 2.2.0 | January 2026
> 
> **For**: Knowledge Managers, Subject Matter Experts, Knowledge Contributors

## Table of Contents

1. [What is Curator?](#1-what-is-curator)
2. [Getting Started](#2-getting-started)
3. [Uploading Documents](#3-uploading-documents)
4. [Zero-Copy Data Connectors](#4-zero-copy-data-connectors)
5. [The Entrance Exam (Verification)](#5-the-entrance-exam-verification)
6. [Resolving Conflicts](#6-resolving-conflicts)
7. [Exploring the Knowledge Graph](#7-exploring-the-knowledge-graph)
8. [Organizing with Domains](#8-organizing-with-domains)
9. [Correcting the AI (Overrides)](#9-correcting-the-ai-overrides)
10. [Understanding Chain of Custody](#10-understanding-chain-of-custody)
11. [Tips & Best Practices](#11-tips--best-practices)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What is Curator?

### Teaching Your AI

Curator is where you **teach** your organization's AI. Instead of hoping the AI "figures out" your documents, you actively guide it—uploading knowledge, verifying its understanding, and correcting mistakes.

Think of it like onboarding a new employee:
1. **Give them the manuals** (upload documents)
2. **Quiz them** (Entrance Exam)
3. **Correct mistakes** (Overrides)
4. **Document everything** (Chain of Custody)

### What You Can Do

| Task | Description |
|------|-------------|
| 📄 **Upload Documents** | Drag-and-drop PDFs, manuals, spreadsheets |
| ✅ **Verify Knowledge** | Confirm the AI understood correctly |
| ✏️ **Correct Mistakes** | Fix anything the AI got wrong |
| 🔍 **Explore the Graph** | See how concepts connect |
| 📁 **Organize by Domain** | Group knowledge into categories |

### Your Role

| Role | What You Can Do |
|------|----------------|
| **Knowledge Manager** | Everything: upload, verify, correct, organize |
| **Contributor** | Upload documents and submit for verification |
| **Viewer** | Browse the knowledge graph (read-only) |

---

## 2. Getting Started

### Logging In

1. Open Curator from your Think Tank dashboard (or go directly to your Curator URL)
2. Sign in with your company credentials
3. You'll see the main dashboard with quick actions

### The Dashboard

When you first open Curator, you'll see:

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 DASHBOARD                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Knowledge Nodes    Documents      Verified       Pending       │
│      12,847           234           11,203          1,644        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ 📤 Upload    │  │ ✅ Verify    │  │ 🔍 Graph     │           │
│  │ Documents    │  │ Knowledge    │  │ Explorer     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ⚠️ 1,644 items awaiting verification → Review Now              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Your First Steps

1. **Create a Domain** - Organize your knowledge (e.g., "Engineering", "Safety")
2. **Upload Documents** - Drag-and-drop your manuals and specs
3. **Verify Knowledge** - Confirm the AI understood correctly
4. **Explore the Graph** - See how concepts connect

---

## 3. Uploading Documents

### Supported File Types

| Format | Extensions | Max Size |
|--------|------------|----------|
| PDF Documents | .pdf | 50 MB |
| Word Documents | .doc, .docx | 25 MB |
| Plain Text | .txt | 10 MB |
| Spreadsheets | .csv, .xlsx | 25 MB |

### How to Upload

1. Click **"Upload Documents"** from the dashboard
2. Select a **Domain** (category) for your documents
3. **Drag-and-drop** files or click to browse
4. Wait for processing (you'll see a progress bar)
5. Documents appear in the **Verification Queue**

### What Happens After Upload?

```
Your Document → AI Reads It → Creates Knowledge Nodes → Needs Your Verification
     📄              🤖                📦                      ✅
```

The AI extracts facts, procedures, and entities from your documents. But it doesn't trust itself—it puts everything in a queue for YOU to verify.

### Tips for Better Results

- **Use clear, structured documents** - Headings and bullet points help the AI
- **One topic per document** - Don't mix unrelated content
- **Include context** - "Pump 302" is clearer than just "the pump"

---

## 4. Zero-Copy Data Connectors

### What is Zero-Copy?

Instead of uploading files, you can **connect external data sources** directly. Curator creates lightweight "stub" nodes that point to the original files—the files stay where they are.

**Benefits:**
- 📁 Files stay in their original location (S3, SharePoint, etc.)
- 🔄 Automatic sync when files change
- 💾 No duplicate storage costs
- 🔐 Original security permissions preserved

### Supported Connectors

| Connector | Description |
|-----------|-------------|
| **Amazon S3** | Connect to S3 buckets |
| **Azure Blob** | Connect to Azure storage containers |
| **SharePoint** | Connect to SharePoint document libraries |
| **Google Drive** | Connect to Google Drive folders |
| **Snowflake** | Connect to Snowflake data warehouse |
| **Confluence** | Connect to Confluence wiki spaces |

### Adding a Connector

1. Go to **"Ingest Documents"** from the sidebar
2. Find **"Zero-Copy Sources"** in the left panel
3. Click **"+ Add"** to open the wizard

**Step 1: Select Source Type**
```
┌─────────────────────────────────────────────────────────────────┐
│  📡 Connect Data Source                                          │
├─────────────────────────────────────────────────────────────────┤
│  Select source type:                                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ☁️ Amazon S3 │  │ ☁️ Azure     │  │ 📁 SharePoint│          │
│  │              │  │    Blob      │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 🗂️ Google   │  │ ❄️ Snowflake │  │ 📝 Confluence│          │
│  │    Drive     │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**Step 2: Configure Connection**
- Enter a name (e.g., "Production Manuals")
- Provide connection details (bucket name, URL, etc.)
- Select target domain (optional)

**Step 3: Confirm & Connect**
- Review settings
- Click **"Connect Source"**
- Curator begins indexing metadata

### Managing Connectors

Connected sources appear in the sidebar with status indicators:

| Status | Meaning |
|--------|---------|
| 🟢 Connected | Ready, synced recently |
| 🔄 Syncing | Currently updating metadata |
| 🔴 Error | Connection issue - check credentials |

Click the **refresh icon** (🔄) to manually trigger a sync.

### Stub Nodes

When you connect a data source, Curator creates **stub nodes**—lightweight pointers to files. When someone asks about content in those files, Curator fetches the full content on-demand.

```
Stub Node: "Equipment Manual v3.pdf"
├── Location: s3://company-docs/manuals/equip_v3.pdf
├── Last Modified: Jan 24, 2026
├── Size: 2.4 MB
└── Status: Ready for expansion
```

---

## 5. The Entrance Exam (Verification)

### What is the Entrance Exam?

Before the AI can use knowledge from your documents, it has to prove it understood correctly. This is the **Entrance Exam**—the AI presents what it learned through different types of quiz cards, and you confirm or correct it.

### Three Types of Quiz Cards

The AI presents verification questions in three formats:

#### 1. Fact Check ✅

The AI shows you something it extracted and asks if it's correct.

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ FACT CHECK                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🤖 I extracted:                                                 │
│                                                                  │
│     "The maximum operating pressure for Model X is 4,500 PSI"   │
│                                                                  │
│  Is this correct?                                                │
│                                                                  │
│  Source: Pump_Manual.pdf, Page 47                               │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ ✅ Yes,    │  │ ✏️ Correct │  │ ❌ Reject  │                 │
│  │ Correct    │  │ It         │  │ Entirely   │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Logic Check 🔀

The AI shows you a relationship it **inferred** (not directly stated in the document).

```
┌─────────────────────────────────────────────────────────────────┐
│  🔀 LOGIC CHECK                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🤖 I inferred:                                                  │
│                                                                  │
│     "Pump 302 requires Filter Type A because it operates        │
│      in high-humidity conditions"                                │
│                                                                  │
│  Is this relationship correct?                                   │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ ✅ Yes,    │  │ ✏️ Correct │  │ ❌ Reject  │                 │
│  │ Valid      │  │ It         │  │ Entirely   │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Ambiguity ❓

The AI found **conflicting information** and needs you to pick the correct one.

```
┌─────────────────────────────────────────────────────────────────┐
│  ❓ AMBIGUITY                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🤖 I found conflicting information:                             │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ 🟡 Option A:                            │                    │
│  │ "Replace filter every 30 days"          │                    │
│  │ Source: Maintenance_Manual_2023.pdf     │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │ 🔵 Option B:                            │                    │
│  │ "Replace filter every 15 days"          │                    │
│  │ Source: Safety_Update_2024.pdf          │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Which is correct?                                               │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐                         │
│  │ 🟡 Option A    │  │ 🔵 Option B    │                         │
│  └────────────────┘  └────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### The "Correct It" Feature

When the AI is close but not quite right, use **"Correct It"** instead of rejecting:

1. Click **"Correct It"**
2. Enter the correct value
3. Provide a reason (required for audit trail)
4. Click **"Save Correction"**

This automatically creates a **Golden Rule** so the AI never makes the same mistake again.

```
┌─────────────────────────────────────────────────────────────────┐
│  ✏️ CORRECT THIS FACT                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Original (AI extracted):                                        │
│  ̶"̶R̶e̶p̶l̶a̶c̶e̶ ̶f̶i̶l̶t̶e̶r̶ ̶e̶v̶e̶r̶y̶ ̶3̶0̶ ̶d̶a̶y̶s̶"̶                                 │
│                                                                  │
│  Corrected Value:                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Replace filter every 15 days in Mexico City plant       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Reason (required):                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Field testing showed faster degradation due to humidity  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ⚠️ This will create a Golden Rule override.                    │
│                                                                  │
│                      [Cancel]  [Save Correction]                 │
└─────────────────────────────────────────────────────────────────┘
```

### Filtering the Verification Queue

Use the toolbar filters to focus on specific items:

| Filter | Shows |
|--------|-------|
| **All** | Everything in the queue |
| **Pending** | Items waiting for review |
| **Verified** | Items you've already approved |
| **Rejected** | Items you've rejected |

You can also filter by **card type**:
- **Fact Check** - Direct extractions
- **Logic Check** - Inferred relationships
- **Ambiguity** - Conflicting information

### Confidence Colors

| Color | Confidence | What to Do |
|-------|------------|------------|
| 🟢 Green | 90-100% | AI is confident. Usually safe to approve. |
| 🟡 Yellow | 70-89% | AI is uncertain. Review carefully. |
| 🔴 Red | Below 70% | AI is guessing. Expert review required. |

### View Source

Every verification item includes a **"View Source"** button that shows:
- Original document name
- Page number where the fact was found
- Highlighted text in context

---

## 6. Resolving Conflicts

### What is the Conflict Queue?

When the AI finds **contradictory information** across documents that it can't resolve on its own, it adds them to the **Conflict Queue** for human resolution.

### Accessing the Conflict Queue

1. Click **"Conflict Queue"** in the sidebar
2. A red badge shows how many conflicts need attention
3. Conflicts are sorted by priority (critical first)

### Conflict Types

| Type | Icon | Description |
|------|------|-------------|
| **Contradiction** | ❌ | Two facts directly contradict each other |
| **Overlap** | 🔀 | Same topic with different values |
| **Temporal** | ⏰ | Older vs newer information conflict |
| **Source Mismatch** | ⚠️ | Different sources say different things |

### Resolving a Conflict

1. Select a conflict from the list
2. Review the **side-by-side comparison**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚖️ CONFLICT RESOLUTION                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ 🟡 Version A        │  │ 🔵 Version B        │               │
│  │                     │  │                     │               │
│  │ Max pressure:       │  │ Max pressure:       │               │
│  │ 4,500 PSI           │  │ 4,000 PSI           │               │
│  │                     │  │                     │               │
│  │ Source: Manual 2023 │  │ Source: Update 2024 │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  Resolution Reason (required):                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2024 update reflects new safety standards                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Choose Resolution:                                              │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Keep A   │  │ Keep B   │  │ Merge    │  │ Defer    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

3. Choose a resolution:
   - **Keep A** - Version A supersedes Version B
   - **Keep B** - Version B supersedes Version A
   - **Merge** - Combine information from both
   - **Context Dependent** - Both are valid in different contexts
   - **Defer** - Need more information, review later

4. Enter a **reason** (required for audit trail)
5. Click to apply the resolution

### Priority Levels

| Priority | Color | Action |
|----------|-------|--------|
| **Critical** | 🔴 Red | Resolve immediately - safety/compliance |
| **High** | 🟡 Gold | Resolve soon - affects operations |
| **Medium** | 🔵 Blue | Resolve when convenient |
| **Low** | ⚪ Gray | Can wait |

---

## 7. Exploring the Knowledge Graph

### What is the Knowledge Graph?

The Knowledge Graph is a visual map of everything your AI knows. Facts, procedures, and entities are shown as **nodes** (circles), connected by **relationships** (lines).

```
      ┌─────────┐
      │ Pump 302│  (Entity - Bronze)
      └────┬────┘
           │ has_property
           ▼
    ┌──────────────┐
    │ Max Pressure │  (Fact - Green)
    │   4,500 PSI  │
    └──────┬───────┘
           │ supersedes
           ▼
    ┌──────────────┐
    │ Old Pressure │  (Deprecated - Gray)
    │   4,000 PSI  │
    └──────────────┘
```

### Node Types (What You'll See)

| Color | Type | What It Represents |
|-------|------|-------------------|
| 🟡 Gold | **Concept** | Abstract ideas or categories |
| 🟢 Green | **Fact** | Verifiable statements |
| 🔵 Blue | **Procedure** | Step-by-step processes |
| 🟤 Bronze | **Entity** | Physical objects or systems |
| 🟣 Purple | **Rule** | Constraints or requirements |

### Navigating the Graph

- **Zoom**: Scroll or use +/- buttons
- **Pan**: Click and drag the background
- **Select**: Click any node to see details
- **Filter**: Use the sidebar to show only certain types or domains

### The Traceability Inspector

When you click a node, the **Traceability Inspector** panel opens showing complete provenance:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 TRACEABILITY INSPECTOR                      [🔒 God Mode]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Content:                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Maximum operating pressure is 4,500 PSI"                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Type: Fact                 Status: ✅ Verified                 │
│  Confidence: ████████░░ 85%                                     │
│  Connections: 12 related nodes                                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────      │
│  📄 SOURCE DOCUMENT                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📄 Pump_Manual_2024.pdf                                  │    │
│  │    Page 47                              [View Source 🔗] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ─────────────────────────────────────────────────────────      │
│  ✅ VERIFIED                                                     │
│  👤 Chief Engineer Bob                                           │
│  📅 Jan 24, 2026 at 11:15 AM                                    │
│                                                                  │
│  ─────────────────────────────────────────────────────────      │
│                                                                  │
│  ┌────────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ 👑 Force       │  │ 👁️ View    │  │ 📜 Audit   │            │
│  │    Override    │  │    Source  │  │    Trail   │            │
│  └────────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Inspector Features

| Button | What It Does |
|--------|--------------|
| **Force Override** | Open "God Mode" to correct this fact |
| **View Source** | Jump to the original document and page |
| **Audit Trail** | View complete Chain of Custody history |

### Overridden Nodes

Nodes with active overrides show the **"God Mode"** badge and display both values:

```
┌─────────────────────────────────────────────────────────────────┐
│  Content:                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Replace filter every 30 days"                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  🔒 Override Active:                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Replace filter every 15 days (Mexico City plant)"       │    │
│  │ Reason: High humidity degrades filters faster            │    │
│  │ By: Safety Officer Jane • Jan 25, 2026                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Organizing with Domains

### What are Domains?

Domains are **folders** for your knowledge. They help organize thousands of facts into manageable categories.

**Example Structure:**
```
📁 Engineering
   📁 Hydraulics
      📁 Pumps
      📁 Valves
   📁 Electrical
      📁 Motors
📁 Operations
   📁 Maintenance
   📁 Safety
📁 Compliance
```

### Creating a Domain

1. Go to **"Domains"** in the sidebar
2. Click **"+ New Domain"**
3. Enter a name (e.g., "Hydraulics")
4. Optionally, select a parent domain
5. Click **"Create"**

### Domain Settings

| Setting | What It Does |
|---------|--------------|
| **Auto-categorize** | AI automatically assigns documents to this domain |
| **Require Verification** | All facts need human approval before use |
| **Retention** | Automatically archive old content after X days |

---

## 9. Correcting the AI (Overrides)

### When Should You Override?

- 📅 **Outdated info** - The manual is old, the real answer has changed
- 🏭 **Site-specific rules** - "We do it differently at THIS location"
- ❌ **AI mistakes** - The AI misunderstood something
- 📜 **Policy updates** - New company policy supersedes old docs

### How to Override

1. Find the fact in the Knowledge Graph (or during Verification)
2. Click the node to open the Traceability Inspector
3. Click **"Force Override"** (the crown button 👑)
4. Choose your **Rule Type**
5. Enter the **correct value** and **justification**
6. Set the **priority level**
7. Click **"Apply Override"**

### The Override Dialog ("God Mode")

```
┌─────────────────────────────────────────────────────────────────┐
│  👑 FORCE OVERRIDE                           "God Mode"          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Rule Type:                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 👑 Force     │  │ 🛡️ Conditional│  │ 🔗 Context   │          │
│  │ Override     │  │              │  │ Dependent    │          │
│  │ ────────────│  │ ────────────│  │ ────────────│          │
│  │ Supersedes  │  │ Applies when │  │ Varies by   │          │
│  │ ALL data    │  │ condition met│  │ context     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │ When AI says:         │  │ Force this instead:   │          │
│  │ ─────────────────────│  │ ─────────────────────│          │
│  │ "Replace filter every │  │ "Replace filter every │          │
│  │  30 days"             │  │  15 days (Mexico City │          │
│  │                       │  │  plant)"              │          │
│  └───────────────────────┘  └───────────────────────┘          │
│                                                                  │
│  Priority: ████████████████████████░░░░░░░░░░░░░░░░░ 85        │
│            Low (1)          Medium (50)        Critical (100)   │
│                                                                  │
│  Justification (required):                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Field testing showed faster filter degradation due to    │    │
│  │ humidity levels. Per Engineering approval MX-2026-004.   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Expiration: [None] ▼  (optional - leave empty for permanent)   │
│                                                                  │
│  🔒 Chain of Custody: This will create a cryptographically      │
│     signed record for audit compliance.                          │
│                                                                  │
│                        [Cancel]  [👑 Apply Override]             │
└─────────────────────────────────────────────────────────────────┘
```

### Rule Types Explained

| Type | Icon | When to Use | Example |
|------|------|-------------|---------|
| **Force Override** | 👑 | Always use my value, no exceptions | "This pump's max pressure is 4,000 PSI, period." |
| **Conditional** | 🛡️ | Use my value only when a condition is met | "When location = Mexico City, replace filter every 15 days" |
| **Context Dependent** | 🔗 | Value varies based on context | "Pressure limit varies by altitude" |

### Priority Slider

The priority determines which rule wins when multiple rules could apply:

| Priority | Label | Use Case |
|----------|-------|----------|
| **1-39** | Low | Nice-to-have preferences |
| **40-69** | Medium | Standard operational overrides |
| **70-89** | High | Important corrections |
| **90-100** | Critical | Safety/compliance rules that MUST apply |

**Example:** If two rules conflict, the one with higher priority wins.

### Golden Rules ("God Mode")

When you override a fact, it becomes a **Golden Rule**—a high-priority directive that supersedes ALL other information.

**Example:**
- Textbook says: "Replace filter every 30 days"
- Your Golden Rule: "In Mexico City, replace every 15 days"
- **Result**: AI always uses YOUR answer for that location

### Managing Overrides

Access all active overrides from **"Overrides"** in the sidebar:

- **Search** by keyword or domain
- **Filter** by status (Active, Expired, Pending Review)
- **Sort** by priority, date, or creator
- **Edit** any override (creates a new audit entry)
- **Delete** to restore original AI behavior

---

## 10. Understanding Chain of Custody

### What is Chain of Custody?

Every fact in Curator has a **history**—who added it, who verified it, who changed it. This is called the **Chain of Custody**.

Think of it like a legal document: you can always prove who touched what and when.

### Why Does This Matter?

| Reason | Benefit |
|--------|---------|
| **Accountability** | Know who verified each fact |
| **Compliance** | Audit trail for SOC 2, ISO 27001, HIPAA |
| **Trust** | Prove the AI's source for any statement |
| **Liability** | If something goes wrong, trace it back |

### Viewing Chain of Custody

1. Select any node in the Knowledge Graph
2. Click the **"History"** tab
3. See the complete timeline:

```
┌─────────────────────────────────────────────────────────────────┐
│  📜 CHAIN OF CUSTODY                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📄 Created                                                      │
│     Source: Pump_Manual_2024.pdf, Page 47                       │
│     Extracted by AI on Jan 24, 2026 at 10:30 AM                 │
│                                                                  │
│  ✅ Verified                                                     │
│     Verified by: Chief Engineer Bob                              │
│     Date: Jan 24, 2026 at 11:15 AM                              │
│     Signature: abc123...                                         │
│                                                                  │
│  ✏️ Overridden                                                   │
│     Changed by: Safety Officer Jane                              │
│     Date: Jan 25, 2026 at 9:00 AM                               │
│     Old value: "4,500 PSI"                                      │
│     New value: "4,000 PSI"                                      │
│     Reason: "Updated per 2026 standard"                         │
│                                                                  │
│  [Export as PDF]                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Exporting for Compliance

Need to prove something for an audit? Click **"Export as PDF"** to download a signed, timestamped record of the entire history.

---

## 11. Tips & Best Practices

### For Better Document Ingestion

| Tip | Why |
|-----|-----|
| **Use structured documents** | Headings and bullets help the AI understand hierarchy |
| **One topic per document** | Mixing topics confuses the AI |
| **Include model numbers** | "Pump 302" is clearer than "the pump" |
| **Keep files under 50 MB** | Large files take longer to process |

### For Efficient Verification

| Tip | Why |
|-----|-----|
| **Start with high-confidence items** | 🟢 Green items are usually quick approvals |
| **Use "Defer" liberally** | If you're not sure, let an expert handle it |
| **Check the source** | Always click "View Source" for 🔴 red items |
| **Batch similar items** | Filter by domain to process related facts together |

### For Effective Overrides

| Tip | Why |
|-----|-----|
| **Always explain your reason** | Future you (and auditors) will thank you |
| **Use expiration dates** | Temporary rules shouldn't live forever |
| **Higher priority = stronger** | Use 150+ for critical safety overrides |
| **Review periodically** | Overrides can become outdated too |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `A` | Approve current item |
| `R` | Reject current item |
| `D` | Defer current item |
| `→` | Next item in queue |
| `←` | Previous item |
| `/` | Focus search |
| `?` | Show help |

---

## 12. Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| **Upload fails** | Check file size (max 50 MB) or try a different format |
| **AI confidence is low** | Document may be unclear. Try adding context or splitting it. |
| **Graph won't load** | Too many nodes. Apply a domain filter. |
| **Can't see Curator** | Ask your admin to grant you access in Think Tank |

### Getting Help

- **In-app help**: Click the `?` icon in any screen
- **Contact your admin**: For access or permission issues
- **Support**: support@radiant.ai

---

*End of RADIANT Curator User Guide*
