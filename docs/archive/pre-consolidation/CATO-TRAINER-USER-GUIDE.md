# Cato Trainer — The Grounding Engine

> **Version**: 1.0.0 | **App**: `@radiant/cato-trainer` | **Port**: 3005

AI-powered knowledge base delivering instant, citable responses drawn exclusively from your document library. Every answer is backed by verifiable sources with ground-truth accuracy.

---

## 1. Overview

Cato Trainer uses the **Cato persona** from RADIANT/Think Tank as a subject matter expert for document libraries. Inspired by Fabric.so's knowledge management paradigm, it combines:

- **Grounded Q&A** — Ask questions, get cited answers from your documents
- **Semantic Search** — Find content by meaning, not just keywords
- **Document Intelligence** — Auto-tagging, summaries, smart links
- **Multi-Document Digest** — Synthesize insights across documents
- **Spaces** — Organize by project, topic, or team

**Key Differentiator**: Unlike general-purpose AI chat, Cato Trainer **never hallucinates**. Every response is grounded in your uploaded documents with verifiable citations.

---

## 2. Getting Started

### 2.1 Running Cato Trainer

```bash
# From the monorepo root
pnpm dev --filter @radiant/cato-trainer

# Or directly
cd apps/cato-trainer && pnpm dev
```

The app runs on **http://localhost:3005**.

### 2.2 Navigation

The left sidebar provides 7 tabs:

| Tab | Icon | Purpose |
|-----|------|---------|
| **Libraries** | Library | Create and manage knowledge bases |
| **Documents** | FileText | Browse, upload, and inspect files |
| **Spaces** | FolderOpen | Organize documents by project |
| **Search** | Search | Semantic, full-text, or hybrid search |
| **Ask Cato** | MessageSquare | Grounded Q&A with citations |
| **Digest** | Layers | Multi-document synthesis |
| **Settings** | Settings | AI model and behavior configuration |

---

## 3. Libraries

Libraries are independent knowledge bases, each with its own document corpus and embedding index.

### 3.1 Creating a Library

1. Go to **Libraries** tab
2. Click **New Library**
3. Enter a name and optional description
4. Click **Create**

### 3.2 Library Status

| Status | Meaning |
|--------|---------|
| **Pending** | Awaiting document uploads |
| **Ingesting** | Processing uploaded documents |
| **Indexing** | Building embedding vectors |
| **Ready** | Fully searchable and queryable |
| **Error** | Processing failed — check document formats |

### 3.3 Library Metrics

Each library card shows:
- **Document count** — total files uploaded
- **Chunk count** — total text segments indexed
- **Total size** — aggregate file size

---

## 4. Documents

### 4.1 Uploading

- **Drag & drop** files onto the drop zone
- **Click Upload** to use the file picker
- Supported formats: PDF, DOCX, TXT, MD, CSV, HTML

### 4.2 Document Processing

After upload, each document is:
1. **Chunked** — Split into semantically meaningful segments
2. **Embedded** — Vector representations generated for search
3. **Auto-tagged** — AI extracts topic tags
4. **Summarized** — AI generates a concise summary
5. **Smart-linked** — Relationships to other documents discovered

### 4.3 Document Detail View

Click any document to see:
- **Metadata** — size, chunk count, page count, upload time
- **Auto-tags** — AI-generated topic labels
- **AI Summary** — concise overview of content
- **Chunks** — browse all indexed text segments with page/section info
- **Smart Links** — auto-discovered relationships (references, contradicts, extends, summarizes, related)

### 4.4 Multi-Select

Use checkboxes to select multiple documents for:
- **Digest** — generate cross-document analysis
- **Scoped Chat** — limit Cato's answers to selected documents

---

## 5. Search

### 5.1 Search Modes

| Mode | How It Works | Best For |
|------|-------------|----------|
| **Semantic** | Meaning-based via embeddings | "something about quarterly performance" |
| **Full-Text** | Keyword matching with stemming | Exact terms, names, codes |
| **Hybrid** | Combined semantic + keyword scoring | General use (default) |

### 5.2 Search Results

Each result shows:
- **Relevance score** — percentage match with color coding
- **Highlighted excerpt** — matching text with terms marked
- **Source document** — title, page number, section
- **Matched terms** — keywords that contributed to the match

### 5.3 Filters

Toggle the filter panel to:
- Switch search modes
- (Future) Filter by date, tags, MIME type

---

## 6. Ask Cato — Grounded Q&A

The core feature. Ask Cato anything about your documents and get **citation-backed answers**.

### 6.1 Starting a Conversation

1. Select a library (optional — defaults to all)
2. Select specific documents (optional — narrows scope)
3. Click **Start Conversation**
4. Type your question

### 6.2 Citation System

Every Cato response includes:
- **Confidence score** — Exact Match (≥90%), High (≥70%), Moderate (≥50%), Low (<50%)
- **Source count** — number of citations backing the answer
- **Expandable citations** — click to see exact quotes, document titles, page numbers, section titles, and relevance scores

### 6.3 Suggested Prompts

The empty chat state shows example questions:
- "What are the key findings across all uploaded reports?"
- "Summarize the main policies in this library"
- "Are there any contradictions between these documents?"
- "What does the data say about quarterly performance?"

### 6.4 Context Control

You control what Cato can see:
- **Library scope** — active library limits search to that corpus
- **Space scope** — further narrows to a project collection
- **Document scope** — checkbox-selected documents only

---

## 7. Digest — Multi-Document Synthesis

Select documents (via checkboxes in Documents tab), then generate analysis.

### 7.1 Digest Types

| Type | What It Does |
|------|-------------|
| **Summary** | Comprehensive summary across selected documents |
| **Comparison** | Compare and contrast key themes and findings |
| **Contradictions** | Find conflicts and inconsistencies |
| **Timeline** | Extract chronological events and milestones |
| **Key Facts** | Most important facts and figures |
| **Action Items** | Actionable recommendations |

### 7.2 Custom Instructions

Add custom prompts to focus the analysis:
- "Focus on financial metrics and compare year-over-year trends"
- "Highlight any compliance gaps"
- "Extract only customer-facing commitments"

### 7.3 Digest Results

Each digest shows:
- **Title** — AI-generated title
- **Content** — full analysis with markdown formatting
- **Citations** — expandable source references
- **History** — previous digests accessible below

---

## 8. Settings

Configure Cato Trainer behavior:

| Setting | Description | Default |
|---------|-------------|---------|
| **AI Model** | Model for Q&A and digestion | claude-sonnet-4-20250514 |
| **Embedding Model** | Model for semantic search | text-embedding-3-large |
| **Citation Threshold** | Minimum confidence to include | 0.70 |
| **Auto-Tagging** | AI tags on upload | Enabled |
| **Smart Linking** | Auto-discover document relationships | Enabled |

---

## 9. Design System

Cato Trainer uses a **cool teal/cyan intelligence palette**:

- **Primary**: `cato-500` (#06b6d4) — teal
- **Ground-truth**: `ground-500` (#10b981) — emerald for verified citations
- **Citation tiers**: exact (emerald), high (cyan), moderate (amber), low (red)
- **Background**: Deep blue-black (#060a10) with subtle mesh grid
- **Glass panels**: Frosted dark glass with teal-tinted borders
- **Typography**: Inter for UI, Lora serif for document content, JetBrains Mono for code

---

## 10. File Structure

```
apps/cato-trainer/
├── app/
│   ├── globals.css          # Cato design system CSS
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Main page with 7-tab routing
│   └── providers.tsx        # React Query provider
├── components/
│   ├── CatoSidebar.tsx      # Left navigation sidebar (7 tabs)
│   ├── ChatPanel.tsx        # Grounded Q&A with citation cards
│   ├── SearchPanel.tsx      # Semantic/fulltext/hybrid search
│   ├── LibraryExplorer.tsx  # Library CRUD and status cards
│   ├── DocumentViewer.tsx   # Document list, detail, chunks, smart links
│   └── DigestPanel.tsx      # Multi-document synthesis engine
├── lib/
│   ├── api.ts               # Service layer — 25+ typed endpoints
│   ├── cato-trainer-store.ts # Zustand state management (30+ fields)
│   └── utils.ts             # Confidence colors, file size, time helpers
├── package.json             # @radiant/cato-trainer — port 3005
├── tailwind.config.ts       # Cato teal/cyan palette & animations
├── tsconfig.json
├── next.config.js
└── postcss.config.js
```

---

## 11. API Types Reference

| Type | Purpose |
|------|---------|
| `Library` | Knowledge base with document count, chunk count, status |
| `Document` | File with auto-tags, summary, chunk count, MIME type |
| `DocumentChunk` | Indexed text segment with page/section metadata |
| `Space` | Project-based document collection |
| `SearchQuery` | Query with mode, filters, library/space/document scope |
| `SearchResult` | Match with relevance score, highlight, matched terms |
| `ChatMessage` | Message with citations, confidence, thinking steps |
| `Citation` | Source reference with exact quote, page, section, score |
| `ChatSession` | Conversation with library/space/document scope |
| `DigestRequest` | Multi-doc analysis request with type and custom prompt |
| `DigestResult` | Generated analysis with citations |
| `SmartLink` | Auto-discovered relationship between documents |
| `CatoTrainerConfig` | Tenant-level configuration |

---

**Document maintained under RADIANT documentation policy.**
