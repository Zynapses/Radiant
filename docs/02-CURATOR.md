# Curator — Complete Reference

**Knowledge Management • Verification • Engineering**

*RADIANT v7.63.0 — Generated March 16, 2026*

---

## Table of Contents

- **Part I: User Guide**
- **Part II: Engineering Guide**

---


---

## Part I: User Guide

> Version 3.0.0 | February 2026
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
11. [Managing Cartridges](#11-managing-cartridges)
12. [Tips & Best Practices](#12-tips--best-practices)
13. [Troubleshooting](#13-troubleshooting)

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

## 11. Managing Cartridges

### What Are Cartridges?

**Cartridges** are portable AI knowledge packages (.RADz files) that bundle everything your AI has learned:

| Component | Description |
|-----------|-------------|
| **Curator Knowledge** | Verified facts from your Knowledge Graph |
| **Ghost Vectors** | Learned patterns and preferences |
| **LoRA Adapters** | Fine-tuned model behaviors |
| **Domain Experts** | Specialized reasoning capabilities |
| **Overrides** | Your corrections and rules |

Think of cartridges like a brain backup—everything the AI knows, packaged for transfer. Each cartridge maps to a biological brain region (e.g., Memory → Hippocampus for RAG pipelines, Domain Expertise → Nucleus for vertical knowledge). Curator Knowledge is a key component within the Memory (Hippocampus) cartridge specialization. For the full brain-mapped taxonomy, see [24-CARTRIDGE-SPECIALIZATIONS.md](./24-CARTRIDGE-SPECIALIZATIONS.md).

### Why Use Cartridges?

| Use Case | How Cartridges Help |
|----------|---------------------|
| **Backup & Recovery** | Export your knowledge before major changes |
| **Share Expertise** | Send your AI configuration to a colleague |
| **New Deployments** | Clone your setup to a new environment |
| **M&A Integration** | Transfer AI expertise during acquisitions |
| **Disaster Recovery** | Restore from cartridge if something goes wrong |

### The Cartridges Dashboard

Navigate to **Cartridges** in the sidebar to see:

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 CARTRIDGES                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Total          Active         Signed          Hot              │
│     12             10             8              3               │
│                                                                  │
│  [My Cartridges] [Organization] [System]                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │ 📦 Engineering Knowledge Pack          v2.1.0      │         │
│  │    Contains: Knowledge, Ghost, LoRA               │         │
│  │    Thermal: 🔥 HOT    Signed: ✅                  │         │
│  │    [View] [Export]                                │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cartridge Scopes

| Scope | Who Can See | Who Can Create |
|-------|-------------|----------------|
| **Personal** | Only you | You |
| **Organization** | Everyone in your org | Tenant Admins |
| **System** | All tenants | Radiant Admins |

### Creating a Cartridge

1. Click **"Create Cartridge"**
2. Enter a **name** and **description**
3. Choose **scope** (Personal or Organization)
4. Select what to include:
   - ✅ Curator Knowledge Graph (your verified facts)
   - ✅ Ghost Vector Compression (learned patterns)
   - ✅ Domain selections
5. Click **"Create"**

The cartridge will be built with all your selected components.

### Exporting a Cartridge

1. Find the cartridge you want to export
2. Click **"Export"**
3. Download the **.RADz file**

The exported cartridge includes:
- All selected knowledge and configurations
- **Cryptographic signature** (dual-signed by you and the platform)
- **Metadata** (version, timestamp, checksums)

### Importing a Cartridge

1. Click **"Import .RADz"**
2. Drag-and-drop your .RADz file (or click to browse)
3. Choose whether to **validate signature**:
   - ✅ **Recommended**: Ensures the cartridge hasn't been tampered with
   - Verifies both author and platform signatures
4. Click **"Import"**

If signature validation fails, you'll see:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ SIGNATURE VERIFICATION FAILED                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   This cartridge could not be verified:                         │
│                                                                  │
│   ❌ Author signature: INVALID                                   │
│   ✅ Platform signature: Valid                                   │
│   ❌ Hash mismatch: Content may have been modified              │
│                                                                  │
│   [Cancel Import]  [Import Anyway (Not Recommended)]            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cartridge Thermal States

Cartridges have thermal states indicating their usage:

| State | Icon | Meaning |
|-------|------|---------|
| **Hot** | 🔥 | Actively being used, high inference volume |
| **Warm** | 🌡️ | Ready for use, moderate activity |
| **Cold** | ❄️ | Not recently used, may take longer to load |

The system automatically manages thermal states based on usage patterns.

### Cartridge Signatures (PKI)

Every cartridge exported from Curator is **cryptographically signed**:

| Signature | Who Signs | What It Proves |
|-----------|-----------|----------------|
| **Author** | You (via your tenant CA) | You created this cartridge |
| **Platform** | RADIANT (via Root CA) | RADIANT verified and counter-signed |

This dual-signature ensures:
- **Authenticity**: The cartridge is from who it claims to be from
- **Integrity**: The content hasn't been modified
- **Non-repudiation**: The author can't deny creating it

### Federation: Cross-Cluster Trust

If your organization has multiple RADIANT clusters (e.g., commercial + government), cartridges from trusted clusters can be imported:

1. Admin adds the other cluster's Root CA to trusted roots
2. Cartridges from that cluster are now verifiable
3. Import as normal—signatures will validate against trusted CAs

This enables secure AI knowledge transfer across independent RADIANT deployments.

### Cluster Compatibility

Each cartridge includes compatibility information to ensure safe imports:

| Field | Purpose |
|-------|---------|
| **Source Cluster** | Where the cartridge was created |
| **Minimum Version** | Lowest RADIANT version that can use it |
| **Compatible Apps** | Which apps can use it (Curator, Think Tank, etc.) |
| **Required Features** | Features needed (Ghost Vectors, LoRA, etc.) |
| **Environment** | production/staging/development |

**What Gets Checked on Import**:
1. **Version**: Your cluster must meet the minimum version
2. **Apps**: The app you're importing into must be supported
3. **Features**: All required features must be available
4. **Environment**: Cannot import staging/dev cartridges into production

If compatibility fails, you'll see a detailed message explaining what's missing:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ COMPATIBILITY CHECK FAILED                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Source: Radiant Commercial US-East v6.2.0                     │
│   Target: Radiant Government v6.0.0                             │
│                                                                  │
│   ❌ Version: Requires 6.2.0, cluster is 6.0.0                   │
│   ✅ Apps: curator, thinktank supported                         │
│   ❌ Features: Missing 'axiom_scorers'                           │
│   ✅ Environment: production → production                        │
│                                                                  │
│   [Cancel Import]                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Tips & Best Practices

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

## 13. Troubleshooting

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


---

## Part II: Engineering Guide

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



---

*Consolidated from 2 source documents (0 not found). 2,071 source lines.*
