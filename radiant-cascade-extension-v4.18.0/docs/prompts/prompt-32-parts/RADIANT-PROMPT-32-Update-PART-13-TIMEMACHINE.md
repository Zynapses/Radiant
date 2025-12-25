# SECTION 32: TIME MACHINE CORE - DATABASE & SERVICE LAYER (v4.0.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Version: 4.0.0 | Apple Time Machine-inspired chat history for Think Tank**
> **NEVER lose a chat or file - everything is preserved and recoverable forever**

---

## 32.1 Time Machine Design Philosophy

### Inspired by Apple Time Machine's Best Parts

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    APPLE TIME MACHINE INSPIRATION                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                             â”‚
â”‚  WHAT WE'RE BORROWING:                                                      â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                                                    â”‚
â”‚  1. Visual "fly back through time" - messages recede into the past         â”‚
â”‚  2. Calendar-based navigation - pick any date to jump to                   â”‚
â”‚  3. Timeline bar on the side - scrub to any point                          â”‚
â”‚  4. One-click restore - instantly recover anything                         â”‚
â”‚  5. "Enter Time Machine" mode - separate from normal view                  â”‚
â”‚  6. Everything is automatic - no manual "save" needed                      â”‚
â”‚  7. Never delete anything - space is cheap, data is priceless             â”‚
â”‚                                                                             â”‚
â”‚  RADIANT IMPROVEMENTS:                                                      â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                                                      â”‚
â”‚  1. Works for chat AND files (unified versioning)                          â”‚
â”‚  2. API-first - client apps can build their own Time Machine UI            â”‚
â”‚  3. AI-aware - simplified API lets AI help users navigate history          â”‚
â”‚  4. Real-time - see changes as they happen, not just hourly backups        â”‚
â”‚  5. Granular - restore single message OR entire conversation               â”‚
â”‚  6. Searchable - find that thing you said 3 months ago                     â”‚
â”‚                                                                             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### The Golden Rules

1. **AUTOMATIC** - Every action creates a snapshot. Users never "save."
2. **INVISIBLE** - Hidden until needed. Default UI is just simple chat.
3. **COMPLETE** - Messages, files, edits, metadata - everything versioned.
4. **INSTANT** - Restore happens in milliseconds, not minutes.
5. **FOREVER** - Nothing is ever truly deleted. Soft-delete only.

---

## 32.2 Core Types

```typescript
// packages/shared/src/types/time-machine.ts

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIME MACHINE CORE TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type SnapshotTrigger = 
  | 'message_sent'       // User sent a message
  | 'message_received'   // AI responded
  | 'message_edited'     // User edited a message
  | 'message_deleted'    // User "deleted" (soft) a message
  | 'file_uploaded'      // User uploaded a file
  | 'file_generated'     // AI generated a file
  | 'file_deleted'       // User "deleted" (soft) a file
  | 'chat_renamed'       // Chat title changed
  | 'restore_performed'  // User restored from history
  | 'manual_snapshot';   // User explicitly saved a point

export type RestoreScope = 
  | 'full_chat'          // Restore entire chat to that point
  | 'single_message'     // Restore just one message
  | 'single_file'        // Restore just one file
  | 'message_range'      // Restore a range of messages
  | 'files_only';        // Restore all files, keep messages

export type MediaStatus = 
  | 'active'             // Currently visible to user
  | 'processing'         // Being uploaded/processed
  | 'archived'           // Moved to cold storage (still retrievable)
  | 'soft_deleted';      // User "deleted" but still exists

export type ExportFormat = 'zip' | 'json' | 'markdown' | 'pdf' | 'html';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SNAPSHOT - Point in time capture of chat state
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface TimeMachineSnapshot {
  id: string;
  chatId: string;
  tenantId: string;
  
  // Version info
  version: number;                    // Monotonically increasing
  timestamp: string;                  // ISO 8601 with milliseconds
  
  // State summary at this point
  messageCount: number;
  fileCount: number;
  totalTokens: number;
  
  // What triggered this snapshot
  trigger: SnapshotTrigger;
  triggerDetails?: {
    messageId?: string;
    fileId?: string;
    description?: string;
  };
  
  // Lineage
  previousSnapshotId?: string;
  restoredFromSnapshotId?: string;    // If this was created by a restore
  
  // Integrity
  checksum: string;                   // SHA-256 of content
  
  // Metadata
  createdAt: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MESSAGE VERSION - Every edit creates a new version
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface MessageVersion {
  id: string;
  messageId: string;                  // Stable ID across versions
  tenantId: string;
  snapshotId: string;
  
  // Content
  content: string;
  role: 'user' | 'assistant' | 'system';
  modelId?: string;
  
  // Version info
  version: number;
  isActive: boolean;                  // Is this the current version?
  isSoftDeleted: boolean;
  
  // Edit tracking
  editReason?: string;
  editedBy?: string;
  
  // Timestamps
  createdAt: string;
  supersededAt?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MEDIA VAULT - Every file version preserved forever
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface MediaVaultFile {
  id: string;
  chatId: string;
  tenantId: string;
  messageId?: string;
  snapshotId: string;
  
  // File identity
  originalName: string;               // What user named it
  displayName: string;                // What's shown in UI
  
  // S3 storage with versioning
  s3Bucket: string;
  s3Key: string;
  s3VersionId: string;                // Critical for immutability
  
  // File properties
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  
  // Preview
  thumbnailS3Key?: string;
  previewGenerated: boolean;
  
  // Version info
  version: number;
  previousVersionId?: string;
  
  // Source
  source: 'user_upload' | 'ai_generated' | 'system';
  
  // Status
  status: MediaStatus;
  
  // AI-enhanced metadata
  extractedText?: string;             // For searchability
  aiDescription?: string;             // AI-generated description
  
  // Timestamps
  createdAt: string;
  archivedAt?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIMELINE - Complete history of a chat
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface ChatTimeline {
  chatId: string;
  chatTitle: string;
  
  // Current state
  currentVersion: number;
  currentMessageCount: number;
  currentFileCount: number;
  
  // History
  snapshots: TimeMachineSnapshot[];
  
  // Aggregates
  totalSnapshots: number;
  totalMediaBytes: number;
  oldestSnapshot: string;             // ISO timestamp
  newestSnapshot: string;
  
  // Calendar data for navigation
  snapshotsByDate: Record<string, number>;  // "2024-12-23" -> count
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RESTORE REQUEST/RESULT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface RestoreRequest {
  chatId: string;
  targetSnapshotId: string;
  scope: RestoreScope;
  
  // For partial restores
  messageIds?: string[];
  fileIds?: string[];
  
  // Reason tracking
  reason?: string;
}

export interface RestoreResult {
  success: boolean;
  newSnapshotId: string;
  
  // What was restored
  messagesRestored: number;
  filesRestored: number;
  
  // The new current state
  newVersion: number;
  
  // For undo
  previousSnapshotId: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXPORT BUNDLE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface ExportBundle {
  id: string;
  chatId: string;
  tenantId: string;
  userId: string;
  
  // Scope
  fromSnapshotId?: string;            // null = from beginning
  toSnapshotId: string;
  
  // Format
  format: ExportFormat;
  includeMedia: boolean;
  includeVersionHistory: boolean;
  
  // File
  s3Key: string;
  sizeBytes: number;
  downloadCount: number;
  
  // Expiry
  expiresAt: string;
  
  // Status
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'failed';
  errorMessage?: string;
  
  // Timestamps
  createdAt: string;
  completedAt?: string;
}
```

---

## 32.3 Database Schema

```sql
-- Migration 013: Time Machine for Think Tank
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- CHAT SNAPSHOTS - Point-in-time state captures (like Time Machine backups)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE tm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  chat_id UUID NOT NULL REFERENCES thinktank_chats(id) ON DELETE CASCADE,
  
  -- Version info
  version INTEGER NOT NULL,
  snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- State summary
  message_count INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  
  -- Trigger
  trigger TEXT NOT NULL CHECK (trigger IN (
    'message_sent', 'message_received', 'message_edited', 'message_deleted',
    'file_uploaded', 'file_generated', 'file_deleted', 'chat_renamed',
    'restore_performed', 'manual_snapshot'
  )),
  trigger_message_id UUID,
  trigger_file_id UUID,
  trigger_description TEXT,
  
  -- Lineage
  previous_snapshot_id UUID REFERENCES tm_snapshots(id),
  restored_from_snapshot_id UUID REFERENCES tm_snapshots(id),
  
  -- Integrity
  checksum TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(chat_id, version)
);

-- Indexes for Time Machine navigation
CREATE INDEX idx_tm_snapshots_chat_version ON tm_snapshots(chat_id, version DESC);
CREATE INDEX idx_tm_snapshots_chat_timestamp ON tm_snapshots(chat_id, snapshot_timestamp DESC);
CREATE INDEX idx_tm_snapshots_date ON tm_snapshots(DATE(snapshot_timestamp), chat_id);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MESSAGE VERSIONS - Every edit preserved
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE tm_message_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  message_id UUID NOT NULL,           -- Stable ID across versions
  snapshot_id UUID NOT NULL REFERENCES tm_snapshots(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  model_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Version info
  version INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_soft_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Edit tracking
  edit_reason TEXT,
  edited_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  original_created_at TIMESTAMPTZ NOT NULL,  -- When message was first created
  
  -- Constraints
  UNIQUE(message_id, version)
);

-- Indexes for message lookup
CREATE INDEX idx_tm_messages_message_id ON tm_message_versions(message_id, version DESC);
CREATE INDEX idx_tm_messages_snapshot ON tm_message_versions(snapshot_id);
CREATE INDEX idx_tm_messages_active ON tm_message_versions(message_id) WHERE is_active = TRUE;
CREATE INDEX idx_tm_messages_search ON tm_message_versions USING gin(to_tsvector('english', content));

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MEDIA VAULT - Every file version preserved forever
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE tm_media_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  chat_id UUID NOT NULL REFERENCES thinktank_chats(id) ON DELETE CASCADE,
  message_id UUID,                    -- Can be NULL for chat-level files
  snapshot_id UUID NOT NULL REFERENCES tm_snapshots(id) ON DELETE CASCADE,
  
  -- File identity
  original_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  
  -- S3 storage (with versioning enabled on bucket)
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_version_id TEXT NOT NULL,        -- S3 object version for immutability
  
  -- File properties
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  
  -- Preview
  thumbnail_s3_key TEXT,
  preview_generated BOOLEAN DEFAULT FALSE,
  
  -- Version info
  version INTEGER NOT NULL,
  previous_version_id UUID REFERENCES tm_media_vault(id),
  
  -- Source
  source TEXT NOT NULL CHECK (source IN ('user_upload', 'ai_generated', 'system')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'processing', 'archived', 'soft_deleted'
  )),
  
  -- AI-enhanced metadata
  extracted_text TEXT,
  ai_description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(chat_id, original_name, version)
);

-- Indexes for media lookup
CREATE INDEX idx_tm_media_chat ON tm_media_vault(chat_id);
CREATE INDEX idx_tm_media_snapshot ON tm_media_vault(snapshot_id);
CREATE INDEX idx_tm_media_name ON tm_media_vault(chat_id, original_name, version DESC);
CREATE INDEX idx_tm_media_search ON tm_media_vault USING gin(
  to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(ai_description, ''))
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MESSAGE-MEDIA REFERENCES - Links messages to specific file versions
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE tm_message_media_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_version_id UUID NOT NULL REFERENCES tm_message_versions(id) ON DELETE CASCADE,
  media_vault_id UUID NOT NULL REFERENCES tm_media_vault(id) ON DELETE CASCADE,
  
  -- Display order and type
  display_order INTEGER NOT NULL DEFAULT 0,
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'attachment',     -- User attached this file
    'inline',         -- Embedded in message content
    'result',         -- AI-generated result
    'reference'       -- Referenced but not attached
  )),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(message_version_id, media_vault_id)
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RESTORE LOG - Audit trail for all restores
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE tm_restore_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  chat_id UUID NOT NULL REFERENCES thinktank_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- What was restored
  from_snapshot_id UUID NOT NULL REFERENCES tm_snapshots(id),
  to_snapshot_id UUID NOT NULL REFERENCES tm_snapshots(id),
  
  -- Scope
  scope TEXT NOT NULL CHECK (scope IN (
    'full_chat', 'single_message', 'single_file', 'message_range', 'files_only'
  )),
  
  -- Items restored
  message_ids UUID[],
  file_ids UUID[],
  messages_restored INTEGER DEFAULT 0,
  files_restored INTEGER DEFAULT 0,
  
  -- Reason
  reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- EXPORT BUNDLES - Track export requests
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE TABLE tm_export_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  chat_id UUID NOT NULL REFERENCES thinktank_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Scope
  from_snapshot_id UUID REFERENCES tm_snapshots(id),
  to_snapshot_id UUID NOT NULL REFERENCES tm_snapshots(id),
  
  -- Format
  format TEXT NOT NULL CHECK (format IN ('zip', 'json', 'markdown', 'pdf', 'html')),
  include_media BOOLEAN DEFAULT TRUE,
  include_version_history BOOLEAN DEFAULT FALSE,
  
  -- File
  s3_key TEXT,
  size_bytes BIGINT DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'ready', 'expired', 'failed'
  )),
  error_message TEXT,
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ROW LEVEL SECURITY
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ALTER TABLE tm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_message_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_media_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_message_media_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_restore_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_export_bundles ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tm_snapshots_tenant ON tm_snapshots 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tm_message_versions_tenant ON tm_message_versions 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tm_media_vault_tenant ON tm_media_vault 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tm_message_media_refs_tenant ON tm_message_media_refs
  USING (EXISTS (
    SELECT 1 FROM tm_message_versions mv 
    WHERE mv.id = tm_message_media_refs.message_version_id 
    AND mv.tenant_id = current_setting('app.current_tenant_id')::UUID
  ));

CREATE POLICY tm_restore_log_tenant ON tm_restore_log 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tm_export_bundles_tenant ON tm_export_bundles 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- VIEWS FOR COMMON QUERIES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Current state view (what users see in normal mode)
CREATE VIEW tm_current_messages AS
SELECT 
  mv.message_id,
  mv.content,
  mv.role,
  mv.model_id,
  mv.metadata,
  mv.version,
  mv.original_created_at,
  mv.created_at as version_created_at,
  s.chat_id,
  s.tenant_id
FROM tm_message_versions mv
JOIN tm_snapshots s ON mv.snapshot_id = s.id
WHERE mv.is_active = TRUE AND mv.is_soft_deleted = FALSE;

-- Files with version count
CREATE VIEW tm_files_with_versions AS
SELECT 
  mv.*,
  (SELECT COUNT(*) FROM tm_media_vault 
   WHERE chat_id = mv.chat_id AND original_name = mv.original_name) as version_count
FROM tm_media_vault mv
WHERE mv.status = 'active';

-- Calendar view for timeline navigation
CREATE VIEW tm_calendar_view AS
SELECT 
  chat_id,
  DATE(snapshot_timestamp) as snapshot_date,
  COUNT(*) as snapshot_count,
  MIN(snapshot_timestamp) as first_snapshot,
  MAX(snapshot_timestamp) as last_snapshot
FROM tm_snapshots
GROUP BY chat_id, DATE(snapshot_timestamp)
ORDER BY snapshot_date DESC;
```

---

## 32.4 Time Machine Service (Core Business Logic)

```typescript
// packages/functions/src/services/time-machine.service.ts

import { Pool, PoolClient } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import {
  TimeMachineSnapshot,
  MessageVersion,
  MediaVaultFile,
  ChatTimeline,
  RestoreRequest,
  RestoreResult,
  ExportBundle,
  SnapshotTrigger,
  RestoreScope,
  ExportFormat,
} from '@radiant/shared';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIME MACHINE SERVICE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export class TimeMachineService {
  private pool: Pool;
  private s3: S3Client;
  private bucketName: string;
  
  constructor(pool: Pool) {
    this.pool = pool;
    this.s3 = new S3Client({});
    this.bucketName = process.env.MEDIA_VAULT_BUCKET!;
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SNAPSHOT CREATION (Automatic on every action)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async createSnapshot(params: {
    chatId: string;
    tenantId: string;
    trigger: SnapshotTrigger;
    triggerMessageId?: string;
    triggerFileId?: string;
    triggerDescription?: string;
  }): Promise<TimeMachineSnapshot> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET app.current_tenant_id = '${params.tenantId}'`);
      
      // Get previous snapshot
      const prevResult = await client.query(`
        SELECT id, version FROM tm_snapshots 
        WHERE chat_id = $1 
        ORDER BY version DESC LIMIT 1
      `, [params.chatId]);
      
      const prevSnapshot = prevResult.rows[0];
      const newVersion = prevSnapshot ? prevSnapshot.version + 1 : 1;
      
      // Count current state
      const countsResult = await client.query(`
        SELECT 
          (SELECT COUNT(DISTINCT message_id) FROM tm_message_versions mv
           JOIN tm_snapshots s ON mv.snapshot_id = s.id
           WHERE s.chat_id = $1 AND mv.is_active = TRUE AND mv.is_soft_deleted = FALSE) as message_count,
          (SELECT COUNT(*) FROM tm_media_vault 
           WHERE chat_id = $1 AND status = 'active') as file_count,
          (SELECT COALESCE(SUM((metadata->>'tokens')::bigint), 0) FROM tm_message_versions mv
           JOIN tm_snapshots s ON mv.snapshot_id = s.id
           WHERE s.chat_id = $1 AND mv.is_active = TRUE) as total_tokens
      `, [params.chatId]);
      
      const counts = countsResult.rows[0];
      
      // Compute checksum of current state
      const checksum = await this.computeChatChecksum(client, params.chatId);
      
      // Create snapshot
      const result = await client.query(`
        INSERT INTO tm_snapshots (
          tenant_id, chat_id, version, message_count, file_count, total_tokens,
          trigger, trigger_message_id, trigger_file_id, trigger_description,
          previous_snapshot_id, checksum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        params.tenantId,
        params.chatId,
        newVersion,
        parseInt(counts.message_count) || 0,
        parseInt(counts.file_count) || 0,
        parseInt(counts.total_tokens) || 0,
        params.trigger,
        params.triggerMessageId,
        params.triggerFileId,
        params.triggerDescription,
        prevSnapshot?.id,
        checksum,
      ]);
      
      await client.query('COMMIT');
      
      return this.mapSnapshotRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async computeChatChecksum(client: PoolClient, chatId: string): Promise<string> {
    const result = await client.query(`
      SELECT mv.message_id, mv.content, mv.role, mv.version
      FROM tm_message_versions mv
      JOIN tm_snapshots s ON mv.snapshot_id = s.id
      WHERE s.chat_id = $1 AND mv.is_active = TRUE AND mv.is_soft_deleted = FALSE
      ORDER BY mv.original_created_at ASC
    `, [chatId]);
    
    const hash = createHash('sha256');
    for (const row of result.rows) {
      hash.update(`${row.message_id}:${row.content}:${row.role}:${row.version}|`);
    }
    return hash.digest('hex');
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MESSAGE VERSIONING
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async saveMessageVersion(params: {
    chatId: string;
    tenantId: string;
    messageId: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    modelId?: string;
    metadata?: Record<string, unknown>;
    isEdit?: boolean;
    editReason?: string;
    editedBy?: string;
  }): Promise<MessageVersion> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET app.current_tenant_id = '${params.tenantId}'`);
      
      // Get or create snapshot
      let snapshot = await this.getLatestSnapshot(client, params.chatId);
      if (!snapshot) {
        // Create initial snapshot
        await client.query('COMMIT');
        snapshot = await this.createSnapshot({
          chatId: params.chatId,
          tenantId: params.tenantId,
          trigger: params.role === 'user' ? 'message_sent' : 'message_received',
        });
        await client.query('BEGIN');
        await client.query(`SET app.current_tenant_id = '${params.tenantId}'`);
      }
      
      // Get previous version of this message (if editing)
      const prevResult = await client.query(`
        SELECT id, version FROM tm_message_versions 
        WHERE message_id = $1 AND is_active = TRUE
        ORDER BY version DESC LIMIT 1
      `, [params.messageId]);
      
      const prevVersion = prevResult.rows[0];
      const newVersion = prevVersion ? prevVersion.version + 1 : 1;
      
      // If editing, mark previous as superseded
      if (prevVersion) {
        await client.query(`
          UPDATE tm_message_versions 
          SET is_active = FALSE, superseded_at = NOW()
          WHERE id = $1
        `, [prevVersion.id]);
      }
      
      // Insert new version
      const result = await client.query(`
        INSERT INTO tm_message_versions (
          tenant_id, message_id, snapshot_id, content, role, model_id,
          metadata, version, is_active, edit_reason, edited_by, original_created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, 
          COALESCE((SELECT original_created_at FROM tm_message_versions WHERE message_id = $2 LIMIT 1), NOW())
        )
        RETURNING *
      `, [
        params.tenantId,
        params.messageId,
        snapshot.id,
        params.content,
        params.role,
        params.modelId,
        JSON.stringify(params.metadata || {}),
        newVersion,
        params.editReason,
        params.editedBy,
      ]);
      
      await client.query('COMMIT');
      
      // Create snapshot for this change
      await this.createSnapshot({
        chatId: params.chatId,
        tenantId: params.tenantId,
        trigger: params.isEdit ? 'message_edited' : (params.role === 'user' ? 'message_sent' : 'message_received'),
        triggerMessageId: params.messageId,
      });
      
      return this.mapMessageVersionRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async softDeleteMessage(params: {
    chatId: string;
    tenantId: string;
    messageId: string;
    deletedBy: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET app.current_tenant_id = '${params.tenantId}'`);
      
      // Mark as soft deleted (NEVER actually delete)
      await client.query(`
        UPDATE tm_message_versions 
        SET is_soft_deleted = TRUE, superseded_at = NOW()
        WHERE message_id = $1 AND is_active = TRUE
      `, [params.messageId]);
      
      await client.query('COMMIT');
      
      // Create snapshot
      await this.createSnapshot({
        chatId: params.chatId,
        tenantId: params.tenantId,
        trigger: 'message_deleted',
        triggerMessageId: params.messageId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MEDIA VAULT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async uploadFile(params: {
    chatId: string;
    tenantId: string;
    messageId?: string;
    file: {
      name: string;
      data: Buffer;
      mimeType: string;
    };
    source: 'user_upload' | 'ai_generated' | 'system';
  }): Promise<MediaVaultFile> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET app.current_tenant_id = '${params.tenantId}'`);
      
      // Get or create snapshot
      let snapshot = await this.getLatestSnapshot(client, params.chatId);
      if (!snapshot) {
        await client.query('COMMIT');
        snapshot = await this.createSnapshot({
          chatId: params.chatId,
          tenantId: params.tenantId,
          trigger: 'file_uploaded',
        });
        await client.query('BEGIN');
        await client.query(`SET app.current_tenant_id = '${params.tenantId}'`);
      }
      
      // Check for existing versions
      const existingResult = await client.query(`
        SELECT id, version FROM tm_media_vault 
        WHERE chat_id = $1 AND original_name = $2
        ORDER BY version DESC LIMIT 1
      `, [params.chatId, params.file.name]);
      
      const existing = existingResult.rows[0];
      const newVersion = existing ? existing.version + 1 : 1;
      
      // Compute checksum
      const checksum = createHash('sha256').update(params.file.data).digest('hex');
      
      // Generate S3 key
      const fileId = uuid();
      const s3Key = `${params.tenantId}/${params.chatId}/${fileId}/${params.file.name}`;
      
      // Upload to S3 (bucket has versioning enabled)
      const putResult = await this.s3.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: params.file.data,
        ContentType: params.file.mimeType,
        Metadata: {
          'chat-id': params.chatId,
          'original-name': params.file.name,
          'version': String(newVersion),
          'checksum': checksum,
        },
      }));
      
      // Insert into media vault
      const result = await client.query(`
        INSERT INTO tm_media_vault (
          tenant_id, chat_id, message_id, snapshot_id, original_name, display_name,
          s3_bucket, s3_key, s3_version_id, mime_type, size_bytes, checksum_sha256,
          version, previous_version_id, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        params.tenantId,
        params.chatId,
        params.messageId,
        snapshot.id,
        params.file.name,
        params.file.name,
        this.bucketName,
        s3Key,
        putResult.VersionId!,
        params.file.mimeType,
        params.file.data.length,
        checksum,
        newVersion,
        existing?.id,
        params.source,
      ]);
      
      await client.query('COMMIT');
      
      // Create snapshot
      await this.createSnapshot({
        chatId: params.chatId,
        tenantId: params.tenantId,
        trigger: params.source === 'user_upload' ? 'file_uploaded' : 'file_generated',
        triggerFileId: result.rows[0].id,
      });
      
      return this.mapMediaVaultRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getFileDownloadUrl(fileId: string, expiresIn = 3600): Promise<string> {
    const result = await this.pool.query(`
      SELECT s3_bucket, s3_key, s3_version_id FROM tm_media_vault WHERE id = $1
    `, [fileId]);
    
    if (!result.rows[0]) {
      throw new Error('File not found');
    }
    
    const { s3_bucket, s3_key, s3_version_id } = result.rows[0];
    
    const command = new GetObjectCommand({
      Bucket: s3_bucket,
      Key: s3_key,
      VersionId: s3_version_id,
    });
    
    return getSignedUrl(this.s3, command, { expiresIn });
  }
  
  async getFileVersions(chatId: string, fileName: string): Promise<MediaVaultFile[]> {
    const result = await this.pool.query(`
      SELECT * FROM tm_media_vault 
      WHERE chat_id = $1 AND original_name = $2
      ORDER BY version DESC
    `, [chatId, fileName]);
    
    return result.rows.map(row => this.mapMediaVaultRow(row));
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TIMELINE NAVIGATION (The "fly back through time" experience)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async getTimeline(chatId: string, tenantId: string): Promise<ChatTimeline> {
    await this.pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    // Get chat info
    const chatResult = await this.pool.query(`
      SELECT title FROM thinktank_chats WHERE id = $1
    `, [chatId]);
    
    // Get all snapshots
    const snapshotsResult = await this.pool.query(`
      SELECT * FROM tm_snapshots 
      WHERE chat_id = $1
      ORDER BY version ASC
    `, [chatId]);
    
    // Get calendar data
    const calendarResult = await this.pool.query(`
      SELECT snapshot_date::text, snapshot_count
      FROM tm_calendar_view
      WHERE chat_id = $1
    `, [chatId]);
    
    // Get total media size
    const sizeResult = await this.pool.query(`
      SELECT COALESCE(SUM(size_bytes), 0) as total_size
      FROM tm_media_vault
      WHERE chat_id = $1
    `, [chatId]);
    
    const snapshots = snapshotsResult.rows.map(row => this.mapSnapshotRow(row));
    const currentSnapshot = snapshots[snapshots.length - 1];
    
    const snapshotsByDate: Record<string, number> = {};
    for (const row of calendarResult.rows) {
      snapshotsByDate[row.snapshot_date] = parseInt(row.snapshot_count);
    }
    
    return {
      chatId,
      chatTitle: chatResult.rows[0]?.title || 'Untitled Chat',
      currentVersion: currentSnapshot?.version || 0,
      currentMessageCount: currentSnapshot?.messageCount || 0,
      currentFileCount: currentSnapshot?.fileCount || 0,
      snapshots,
      totalSnapshots: snapshots.length,
      totalMediaBytes: parseInt(sizeResult.rows[0].total_size) || 0,
      oldestSnapshot: snapshots[0]?.timestamp || new Date().toISOString(),
      newestSnapshot: currentSnapshot?.timestamp || new Date().toISOString(),
      snapshotsByDate,
    };
  }
  
  async getChatAtSnapshot(chatId: string, snapshotId: string, tenantId: string): Promise<{
    snapshot: TimeMachineSnapshot;
    messages: MessageVersion[];
    files: MediaVaultFile[];
  }> {
    await this.pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    // Get snapshot
    const snapshotResult = await this.pool.query(`
      SELECT * FROM tm_snapshots WHERE id = $1
    `, [snapshotId]);
    
    if (!snapshotResult.rows[0]) {
      throw new Error('Snapshot not found');
    }
    
    // Get messages at this snapshot
    // This requires understanding the chain - we need messages that were active AT this snapshot
    const messagesResult = await this.pool.query(`
      WITH snapshot_chain AS (
        SELECT id, version FROM tm_snapshots
        WHERE chat_id = $1 AND version <= (SELECT version FROM tm_snapshots WHERE id = $2)
      )
      SELECT DISTINCT ON (mv.message_id) mv.*
      FROM tm_message_versions mv
      WHERE mv.snapshot_id IN (SELECT id FROM snapshot_chain)
        AND NOT mv.is_soft_deleted
      ORDER BY mv.message_id, mv.version DESC
    `, [chatId, snapshotId]);
    
    // Get files at this snapshot
    const filesResult = await this.pool.query(`
      WITH snapshot_chain AS (
        SELECT id, version FROM tm_snapshots
        WHERE chat_id = $1 AND version <= (SELECT version FROM tm_snapshots WHERE id = $2)
      )
      SELECT DISTINCT ON (mf.original_name) mf.*
      FROM tm_media_vault mf
      WHERE mf.snapshot_id IN (SELECT id FROM snapshot_chain)
        AND mf.status != 'soft_deleted'
      ORDER BY mf.original_name, mf.version DESC
    `, [chatId, snapshotId]);
    
    return {
      snapshot: this.mapSnapshotRow(snapshotResult.rows[0]),
      messages: messagesResult.rows.map(row => this.mapMessageVersionRow(row)),
      files: filesResult.rows.map(row => this.mapMediaVaultRow(row)),
    };
  }
  
  async getSnapshotsByDate(chatId: string, date: string, tenantId: string): Promise<TimeMachineSnapshot[]> {
    await this.pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const result = await this.pool.query(`
      SELECT * FROM tm_snapshots 
      WHERE chat_id = $1 AND DATE(snapshot_timestamp) = $2
      ORDER BY snapshot_timestamp ASC
    `, [chatId, date]);
    
    return result.rows.map(row => this.mapSnapshotRow(row));
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RESTORE (One-click recovery)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async restore(request: RestoreRequest, userId: string, tenantId: string): Promise<RestoreResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET app.current_tenant_id = '${tenantId}'`);
      
      // Get target snapshot state
      const targetState = await this.getChatAtSnapshot(request.chatId, request.targetSnapshotId, tenantId);
      
      // Get current snapshot for logging
      const currentSnapshot = await this.getLatestSnapshot(client, request.chatId);
      
      let messagesRestored = 0;
      let filesRestored = 0;
      
      switch (request.scope) {
        case 'full_chat':
          // Restore all messages and files
          messagesRestored = await this.restoreMessages(client, targetState.messages, request.chatId, tenantId);
          filesRestored = await this.restoreFiles(client, targetState.files, request.chatId, tenantId);
          break;
          
        case 'single_message':
          if (request.messageIds?.length) {
            const targetMessages = targetState.messages.filter(m => request.messageIds!.includes(m.messageId));
            messagesRestored = await this.restoreMessages(client, targetMessages, request.chatId, tenantId);
          }
          break;
          
        case 'single_file':
          if (request.fileIds?.length) {
            const targetFiles = targetState.files.filter(f => request.fileIds!.includes(f.id));
            filesRestored = await this.restoreFiles(client, targetFiles, request.chatId, tenantId);
          }
          break;
          
        case 'files_only':
          filesRestored = await this.restoreFiles(client, targetState.files, request.chatId, tenantId);
          break;
      }
      
      await client.query('COMMIT');
      
      // Create restore snapshot
      const newSnapshot = await this.createSnapshot({
        chatId: request.chatId,
        tenantId,
        trigger: 'restore_performed',
        triggerDescription: `Restored to version ${targetState.snapshot.version}`,
      });
      
      // Log the restore
      await this.pool.query(`
        INSERT INTO tm_restore_log (
          tenant_id, chat_id, user_id, from_snapshot_id, to_snapshot_id,
          scope, message_ids, file_ids, messages_restored, files_restored, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        tenantId,
        request.chatId,
        userId,
        request.targetSnapshotId,
        newSnapshot.id,
        request.scope,
        request.messageIds || [],
        request.fileIds || [],
        messagesRestored,
        filesRestored,
        request.reason,
      ]);
      
      return {
        success: true,
        newSnapshotId: newSnapshot.id,
        messagesRestored,
        filesRestored,
        newVersion: newSnapshot.version,
        previousSnapshotId: currentSnapshot?.id || '',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async restoreMessages(
    client: PoolClient, 
    messages: MessageVersion[], 
    chatId: string, 
    tenantId: string
  ): Promise<number> {
    // Deactivate current versions
    await client.query(`
      UPDATE tm_message_versions 
      SET is_active = FALSE, superseded_at = NOW()
      WHERE message_id IN (
        SELECT DISTINCT message_id FROM tm_message_versions mv
        JOIN tm_snapshots s ON mv.snapshot_id = s.id
        WHERE s.chat_id = $1 AND mv.is_active = TRUE
      )
    `, [chatId]);
    
    // Get latest snapshot
    const snapshot = await this.getLatestSnapshot(client, chatId);
    
    // Insert restored versions as new active versions
    for (const msg of messages) {
      await client.query(`
        INSERT INTO tm_message_versions (
          tenant_id, message_id, snapshot_id, content, role, model_id,
          metadata, version, is_active, edit_reason, original_created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 
          (SELECT COALESCE(MAX(version), 0) + 1 FROM tm_message_versions WHERE message_id = $2),
          TRUE, 'Restored from Time Machine', $8)
      `, [
        tenantId,
        msg.messageId,
        snapshot?.id,
        msg.content,
        msg.role,
        msg.modelId,
        JSON.stringify(msg.metadata || {}),
        msg.createdAt,
      ]);
    }
    
    return messages.length;
  }
  
  private async restoreFiles(
    client: PoolClient,
    files: MediaVaultFile[],
    chatId: string,
    tenantId: string
  ): Promise<number> {
    // Mark current files as soft deleted
    await client.query(`
      UPDATE tm_media_vault 
      SET status = 'soft_deleted'
      WHERE chat_id = $1 AND status = 'active'
    `, [chatId]);
    
    // Get latest snapshot
    const snapshot = await this.getLatestSnapshot(client, chatId);
    
    // "Restore" files by creating new active versions pointing to same S3 objects
    for (const file of files) {
      await client.query(`
        INSERT INTO tm_media_vault (
          tenant_id, chat_id, message_id, snapshot_id, original_name, display_name,
          s3_bucket, s3_key, s3_version_id, mime_type, size_bytes, checksum_sha256,
          version, previous_version_id, source, status, extracted_text, ai_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          (SELECT COALESCE(MAX(version), 0) + 1 FROM tm_media_vault WHERE chat_id = $2 AND original_name = $5),
          $13, $14, 'active', $15, $16)
      `, [
        tenantId,
        chatId,
        file.messageId,
        snapshot?.id,
        file.originalName,
        file.displayName,
        file.s3Bucket,
        file.s3Key,
        file.s3VersionId,
        file.mimeType,
        file.sizeBytes,
        file.checksumSha256,
        file.id,
        file.source,
        file.extractedText,
        file.aiDescription,
      ]);
    }
    
    return files.length;
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SEARCH (Find that thing from 3 months ago)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async searchMessages(chatId: string, query: string, tenantId: string): Promise<MessageVersion[]> {
    await this.pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const result = await this.pool.query(`
      SELECT DISTINCT ON (mv.message_id) mv.*, 
        ts_rank(to_tsvector('english', mv.content), plainto_tsquery('english', $2)) as rank
      FROM tm_message_versions mv
      JOIN tm_snapshots s ON mv.snapshot_id = s.id
      WHERE s.chat_id = $1 
        AND to_tsvector('english', mv.content) @@ plainto_tsquery('english', $2)
      ORDER BY mv.message_id, rank DESC, mv.version DESC
      LIMIT 50
    `, [chatId, query]);
    
    return result.rows.map(row => this.mapMessageVersionRow(row));
  }
  
  async searchFiles(chatId: string, query: string, tenantId: string): Promise<MediaVaultFile[]> {
    await this.pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const result = await this.pool.query(`
      SELECT DISTINCT ON (original_name) *,
        ts_rank(
          to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(ai_description, '')),
          plainto_tsquery('english', $2)
        ) as rank
      FROM tm_media_vault
      WHERE chat_id = $1 
        AND (
          original_name ILIKE '%' || $2 || '%'
          OR to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(ai_description, '')) 
             @@ plainto_tsquery('english', $2)
        )
      ORDER BY original_name, rank DESC, version DESC
      LIMIT 50
    `, [chatId, query]);
    
    return result.rows.map(row => this.mapMediaVaultRow(row));
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // EXPORT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  async createExportBundle(params: {
    chatId: string;
    tenantId: string;
    userId: string;
    format: ExportFormat;
    includeMedia: boolean;
    includeVersionHistory: boolean;
    fromSnapshotId?: string;
  }): Promise<string> {
    // Get current snapshot
    const currentResult = await this.pool.query(`
      SELECT id FROM tm_snapshots 
      WHERE chat_id = $1 
      ORDER BY version DESC LIMIT 1
    `, [params.chatId]);
    
    const bundleId = uuid();
    
    await this.pool.query(`
      INSERT INTO tm_export_bundles (
        id, tenant_id, chat_id, user_id, from_snapshot_id, to_snapshot_id,
        format, include_media, include_version_history, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    `, [
      bundleId,
      params.tenantId,
      params.chatId,
      params.userId,
      params.fromSnapshotId,
      currentResult.rows[0]?.id,
      params.format,
      params.includeMedia,
      params.includeVersionHistory,
    ]);
    
    // Trigger async export via SQS - see Section 33.5 for export queue handler
    // await sqs.send(new SendMessageCommand({
    //   QueueUrl: process.env.EXPORT_QUEUE_URL,
    //   MessageBody: JSON.stringify({ chatId, format, includeMedia }),
    // }));
    
    return bundleId;
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // HELPERS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  private async getLatestSnapshot(client: PoolClient, chatId: string): Promise<TimeMachineSnapshot | null> {
    const result = await client.query(`
      SELECT * FROM tm_snapshots 
      WHERE chat_id = $1 
      ORDER BY version DESC LIMIT 1
    `, [chatId]);
    
    return result.rows[0] ? this.mapSnapshotRow(result.rows[0]) : null;
  }
  
  private mapSnapshotRow(row: any): TimeMachineSnapshot {
    return {
      id: row.id,
      chatId: row.chat_id,
      tenantId: row.tenant_id,
      version: row.version,
      timestamp: row.snapshot_timestamp,
      messageCount: row.message_count,
      fileCount: row.file_count,
      totalTokens: row.total_tokens,
      trigger: row.trigger,
      triggerDetails: {
        messageId: row.trigger_message_id,
        fileId: row.trigger_file_id,
        description: row.trigger_description,
      },
      previousSnapshotId: row.previous_snapshot_id,
      restoredFromSnapshotId: row.restored_from_snapshot_id,
      checksum: row.checksum,
      createdAt: row.created_at,
    };
  }
  
  private mapMessageVersionRow(row: any): MessageVersion {
    return {
      id: row.id,
      messageId: row.message_id,
      tenantId: row.tenant_id,
      snapshotId: row.snapshot_id,
      content: row.content,
      role: row.role,
      modelId: row.model_id,
      version: row.version,
      isActive: row.is_active,
      isSoftDeleted: row.is_soft_deleted,
      editReason: row.edit_reason,
      editedBy: row.edited_by,
      createdAt: row.created_at,
      supersededAt: row.superseded_at,
    };
  }
  
  private mapMediaVaultRow(row: any): MediaVaultFile {
    return {
      id: row.id,
      chatId: row.chat_id,
      tenantId: row.tenant_id,
      messageId: row.message_id,
      snapshotId: row.snapshot_id,
      originalName: row.original_name,
      displayName: row.display_name,
      s3Bucket: row.s3_bucket,
      s3Key: row.s3_key,
      s3VersionId: row.s3_version_id,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      checksumSha256: row.checksum_sha256,
      thumbnailS3Key: row.thumbnail_s3_key,
      previewGenerated: row.preview_generated,
      version: row.version,
      previousVersionId: row.previous_version_id,
      source: row.source,
      status: row.status,
      extractedText: row.extracted_text,
      aiDescription: row.ai_description,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
    };
  }
}
```

---

## 32.5 Complex API Handlers (Service Layer Exposure)

```typescript
// packages/functions/src/handlers/thinktank/time-machine.handlers.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeMachineService } from '../../services/time-machine.service';
import { pool } from '../../utils/db';
import { RestoreScope, ExportFormat } from '@radiant/shared';

const service = new TimeMachineService(pool);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

function getUserContext(event: APIGatewayProxyEvent) {
  return {
    userId: event.requestContext.authorizer?.claims?.sub,
    tenantId: event.requestContext.authorizer?.claims?.['custom:tenant_id'],
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIMELINE ENDPOINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /api/thinktank/chats/:chatId/time-machine
export async function getTimeline(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    
    if (!chatId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId required' }) };
    }
    
    const timeline = await service.getTimeline(chatId, tenantId);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(timeline),
    };
  } catch (error: any) {
    console.error('getTimeline error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// GET /api/thinktank/chats/:chatId/time-machine/snapshots/:snapshotId
export async function getChatAtSnapshot(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    const snapshotId = event.pathParameters?.snapshotId;
    
    if (!chatId || !snapshotId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and snapshotId required' }) };
    }
    
    const state = await service.getChatAtSnapshot(chatId, snapshotId, tenantId);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(state),
    };
  } catch (error: any) {
    console.error('getChatAtSnapshot error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// GET /api/thinktank/chats/:chatId/time-machine/calendar/:date
export async function getSnapshotsByDate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    const date = event.pathParameters?.date;  // YYYY-MM-DD
    
    if (!chatId || !date) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and date required' }) };
    }
    
    const snapshots = await service.getSnapshotsByDate(chatId, date, tenantId);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ snapshots }),
    };
  } catch (error: any) {
    console.error('getSnapshotsByDate error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RESTORE ENDPOINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// POST /api/thinktank/chats/:chatId/time-machine/restore
export async function restoreFromSnapshot(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { userId, tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    const body = JSON.parse(event.body || '{}');
    
    if (!chatId || !body.snapshotId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and snapshotId required' }) };
    }
    
    const result = await service.restore({
      chatId,
      targetSnapshotId: body.snapshotId,
      scope: (body.scope || 'full_chat') as RestoreScope,
      messageIds: body.messageIds,
      fileIds: body.fileIds,
      reason: body.reason,
    }, userId, tenantId);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('restoreFromSnapshot error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MEDIA VAULT ENDPOINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /api/thinktank/chats/:chatId/time-machine/files
export async function getFiles(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    
    if (!chatId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId required' }) };
    }
    
    const result = await pool.query(`
      SELECT * FROM tm_files_with_versions
      WHERE chat_id = $1
      ORDER BY created_at DESC
    `, [chatId]);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ files: result.rows }),
    };
  } catch (error: any) {
    console.error('getFiles error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// GET /api/thinktank/chats/:chatId/time-machine/files/:fileName/versions
export async function getFileVersions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    const fileName = decodeURIComponent(event.pathParameters?.fileName || '');
    
    if (!chatId || !fileName) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and fileName required' }) };
    }
    
    const versions = await service.getFileVersions(chatId, fileName);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ versions }),
    };
  } catch (error: any) {
    console.error('getFileVersions error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// GET /api/thinktank/files/:fileId/download
export async function downloadFile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const fileId = event.pathParameters?.fileId;
    
    if (!fileId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'fileId required' }) };
    }
    
    const url = await service.getFileDownloadUrl(fileId);
    
    return {
      statusCode: 302,
      headers: { ...corsHeaders, Location: url },
      body: '',
    };
  } catch (error: any) {
    console.error('downloadFile error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SEARCH ENDPOINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /api/thinktank/chats/:chatId/time-machine/search
export async function search(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    const query = event.queryStringParameters?.q;
    const type = event.queryStringParameters?.type || 'all';  // 'messages', 'files', 'all'
    
    if (!chatId || !query) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and q (query) required' }) };
    }
    
    const results: { messages?: any[]; files?: any[] } = {};
    
    if (type === 'all' || type === 'messages') {
      results.messages = await service.searchMessages(chatId, query, tenantId);
    }
    
    if (type === 'all' || type === 'files') {
      results.files = await service.searchFiles(chatId, query, tenantId);
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(results),
    };
  } catch (error: any) {
    console.error('search error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXPORT ENDPOINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// POST /api/thinktank/chats/:chatId/time-machine/export
export async function createExport(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { userId, tenantId } = getUserContext(event);
    const chatId = event.pathParameters?.chatId;
    const body = JSON.parse(event.body || '{}');
    
    if (!chatId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId required' }) };
    }
    
    const bundleId = await service.createExportBundle({
      chatId,
      tenantId,
      userId,
      format: (body.format || 'zip') as ExportFormat,
      includeMedia: body.includeMedia !== false,
      includeVersionHistory: body.includeVersionHistory === true,
      fromSnapshotId: body.fromSnapshotId,
    });
    
    return {
      statusCode: 202,
      headers: corsHeaders,
      body: JSON.stringify({ 
        bundleId,
        status: 'pending',
        message: 'Export is being prepared. Check status at /api/thinktank/exports/:bundleId',
      }),
    };
  } catch (error: any) {
    console.error('createExport error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

// GET /api/thinktank/exports/:bundleId
export async function getExportStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const bundleId = event.pathParameters?.bundleId;
    
    if (!bundleId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'bundleId required' }) };
    }
    
    const result = await pool.query(`
      SELECT * FROM tm_export_bundles WHERE id = $1
    `, [bundleId]);
    
    if (!result.rows[0]) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'Export not found' }) };
    }
    
    const bundle = result.rows[0];
    
    // If ready, generate download URL
    let downloadUrl: string | undefined;
    if (bundle.status === 'ready' && bundle.s3_key) {
      downloadUrl = await service.getFileDownloadUrl(bundle.s3_key);
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        bundleId: bundle.id,
        status: bundle.status,
        format: bundle.format,
        sizeBytes: bundle.size_bytes,
        downloadUrl,
        expiresAt: bundle.expires_at,
        createdAt: bundle.created_at,
        completedAt: bundle.completed_at,
        errorMessage: bundle.error_message,
      }),
    };
  } catch (error: any) {
    console.error('getExportStatus error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}
```

---

## 32.6 API Routes Configuration

```typescript
// packages/functions/src/routes/time-machine.routes.ts

import { Router } from './router';
import * as handlers from '../handlers/thinktank/time-machine.handlers';

export function registerTimeMachineRoutes(router: Router) {
  // Timeline
  router.get('/api/thinktank/chats/:chatId/time-machine', handlers.getTimeline);
  router.get('/api/thinktank/chats/:chatId/time-machine/snapshots/:snapshotId', handlers.getChatAtSnapshot);
  router.get('/api/thinktank/chats/:chatId/time-machine/calendar/:date', handlers.getSnapshotsByDate);
  
  // Restore
  router.post('/api/thinktank/chats/:chatId/time-machine/restore', handlers.restoreFromSnapshot);
  
  // Files
  router.get('/api/thinktank/chats/:chatId/time-machine/files', handlers.getFiles);
  router.get('/api/thinktank/chats/:chatId/time-machine/files/:fileName/versions', handlers.getFileVersions);
  router.get('/api/thinktank/files/:fileId/download', handlers.downloadFile);
  
  // Search
  router.get('/api/thinktank/chats/:chatId/time-machine/search', handlers.search);
  
  // Export
  router.post('/api/thinktank/chats/:chatId/time-machine/export', handlers.createExport);
  router.get('/api/thinktank/exports/:bundleId', handlers.getExportStatus);
}
```


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 33: TIME MACHINE UI & SIMPLIFIED AI API (v4.0.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Version: 4.0.0 | The visual "fly back through time" experience + AI-friendly API**

---

## 33.1 Simplified AI API for Time Machine

The AI API allows client apps to let their AI assistants help users navigate history naturally.

```typescript
// packages/functions/src/handlers/thinktank/ai-time-machine.handlers.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TimeMachineService } from '../../services/time-machine.service';
import { pool } from '../../utils/db';

const service = new TimeMachineService(pool);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AI-FRIENDLY SIMPLIFIED API
// These endpoints return human-readable summaries that AI can relay to users
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * GET /api/ai/chats/:chatId/history/summary
 * 
 * Returns a human-readable summary of chat history that an AI can present.
 * 
 * Example response:
 * {
 *   "summary": "This conversation has 47 snapshots over 3 days. You've exchanged 
 *               156 messages and shared 8 files. The oldest point you can restore 
 *               to is December 20th at 2:34 PM.",
 *   "highlights": [
 *     "December 22: Major file update - report_final.xlsx",
 *     "December 21: Long discussion about project requirements",
 *     "December 20: Conversation started"
 *   ],
 *   "canRestore": true,
 *   "oldestDate": "2024-12-20",
 *   "newestDate": "2024-12-23"
 * }
 */
export async function getHistorySummary(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const chatId = event.pathParameters?.chatId;
    const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];
    
    if (!chatId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId required' }) };
    }
    
    const timeline = await service.getTimeline(chatId, tenantId);
    
    // Generate human-readable summary
    const dayCount = Object.keys(timeline.snapshotsByDate).length;
    const oldestDate = new Date(timeline.oldestSnapshot).toLocaleDateString('en-US', { 
      month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    });
    
    // Generate highlights from significant snapshots
    const highlights: string[] = [];
    const fileSnapshots = timeline.snapshots.filter(s => 
      s.trigger === 'file_uploaded' || s.trigger === 'file_generated'
    );
    const restoreSnapshots = timeline.snapshots.filter(s => s.trigger === 'restore_performed');
    
    // Add recent file activity
    if (fileSnapshots.length > 0) {
      const recent = fileSnapshots[fileSnapshots.length - 1];
      const date = new Date(recent.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      highlights.push(`${date}: File activity (${timeline.currentFileCount} files total)`);
    }
    
    // Add restore activity
    if (restoreSnapshots.length > 0) {
      highlights.push(`You've restored from history ${restoreSnapshots.length} time(s)`);
    }
    
    // Add conversation start
    if (timeline.snapshots.length > 0) {
      const first = timeline.snapshots[0];
      const date = new Date(first.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      highlights.push(`${date}: Conversation started`);
    }
    
    const summary = `This conversation has ${timeline.totalSnapshots} snapshots over ${dayCount} day${dayCount !== 1 ? 's' : ''}. ` +
      `You've exchanged ${timeline.currentMessageCount} messages and shared ${timeline.currentFileCount} file${timeline.currentFileCount !== 1 ? 's' : ''}. ` +
      `The oldest point you can restore to is ${oldestDate}.`;
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        summary,
        highlights,
        canRestore: timeline.totalSnapshots > 1,
        oldestDate: timeline.oldestSnapshot.split('T')[0],
        newestDate: timeline.newestSnapshot.split('T')[0],
        stats: {
          totalSnapshots: timeline.totalSnapshots,
          messageCount: timeline.currentMessageCount,
          fileCount: timeline.currentFileCount,
          totalMediaBytes: timeline.totalMediaBytes,
        },
      }),
    };
  } catch (error: any) {
    console.error('getHistorySummary error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

/**
 * POST /api/ai/chats/:chatId/history/find
 * 
 * Natural language search through history.
 * 
 * Request:
 * { "query": "that spreadsheet from last week" }
 * 
 * Response:
 * {
 *   "found": true,
 *   "description": "I found 'budget_2024.xlsx' from December 18th. Would you like me to restore it or download the current version?",
 *   "items": [
 *     { "type": "file", "name": "budget_2024.xlsx", "date": "2024-12-18", "id": "..." }
 *   ],
 *   "suggestedActions": ["restore", "download", "show_versions"]
 * }
 */
export async function findInHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const chatId = event.pathParameters?.chatId;
    const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];
    const body = JSON.parse(event.body || '{}');
    
    if (!chatId || !body.query) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and query required' }) };
    }
    
    // Search both messages and files
    const [messages, files] = await Promise.all([
      service.searchMessages(chatId, body.query, tenantId),
      service.searchFiles(chatId, body.query, tenantId),
    ]);
    
    const items: Array<{
      type: 'message' | 'file';
      name?: string;
      preview?: string;
      date: string;
      id: string;
    }> = [];
    
    // Add top file results
    for (const file of files.slice(0, 3)) {
      items.push({
        type: 'file',
        name: file.displayName,
        date: file.createdAt.split('T')[0],
        id: file.id,
      });
    }
    
    // Add top message results
    for (const msg of messages.slice(0, 3)) {
      items.push({
        type: 'message',
        preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        date: msg.createdAt.split('T')[0],
        id: msg.messageId,
      });
    }
    
    // Generate description
    let description = '';
    if (items.length === 0) {
      description = `I couldn't find anything matching "${body.query}" in your chat history.`;
    } else if (files.length > 0 && messages.length === 0) {
      description = `I found ${files.length} file${files.length !== 1 ? 's' : ''} matching "${body.query}". ` +
        `The most recent is '${files[0].displayName}' from ${new Date(files[0].createdAt).toLocaleDateString()}.`;
    } else if (messages.length > 0 && files.length === 0) {
      description = `I found ${messages.length} message${messages.length !== 1 ? 's' : ''} mentioning "${body.query}".`;
    } else {
      description = `I found ${files.length} file${files.length !== 1 ? 's' : ''} and ${messages.length} message${messages.length !== 1 ? 's' : ''} ` +
        `related to "${body.query}".`;
    }
    
    const suggestedActions: string[] = [];
    if (files.length > 0) {
      suggestedActions.push('download', 'show_versions');
    }
    if (messages.length > 0) {
      suggestedActions.push('jump_to_message');
    }
    if (items.length > 0) {
      suggestedActions.push('restore');
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        found: items.length > 0,
        description,
        items,
        suggestedActions,
      }),
    };
  } catch (error: any) {
    console.error('findInHistory error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

/**
 * POST /api/ai/chats/:chatId/history/restore
 * 
 * AI-assisted restore with natural language confirmation.
 * 
 * Request:
 * { 
 *   "action": "restore_file",
 *   "fileId": "...",
 *   "confirmed": true
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "I've restored 'budget_2024.xlsx' to the version from December 18th. Your current version has been saved and you can restore it anytime.",
 *   "undoAvailable": true,
 *   "undoSnapshotId": "..."
 * }
 */
export async function aiRestore(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const chatId = event.pathParameters?.chatId;
    const userId = event.requestContext.authorizer?.claims?.sub;
    const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];
    const body = JSON.parse(event.body || '{}');
    
    if (!chatId || !body.action) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and action required' }) };
    }
    
    // Require confirmation for restore actions
    if (!body.confirmed) {
      let confirmMessage = '';
      
      switch (body.action) {
        case 'restore_file':
          confirmMessage = "I'll restore this file to the selected version. Your current version will be saved and you can always get it back. Confirm?";
          break;
        case 'restore_message':
          confirmMessage = "I'll restore this message to how it was at the selected point. Confirm?";
          break;
        case 'restore_all':
          confirmMessage = "I'll restore the entire conversation to the selected point. All your current messages and files will be saved and recoverable. Confirm?";
          break;
        default:
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Unknown action' }) };
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          needsConfirmation: true,
          message: confirmMessage,
          action: body.action,
        }),
      };
    }
    
    // Perform the restore
    let result;
    let message = '';
    
    switch (body.action) {
      case 'restore_file':
        result = await service.restore({
          chatId,
          targetSnapshotId: body.snapshotId,
          scope: 'single_file',
          fileIds: [body.fileId],
          reason: 'AI-assisted restore',
        }, userId, tenantId);
        message = `I've restored the file. Your previous version has been saved - snapshot ${result.previousSnapshotId.substring(0, 8)}.`;
        break;
        
      case 'restore_message':
        result = await service.restore({
          chatId,
          targetSnapshotId: body.snapshotId,
          scope: 'single_message',
          messageIds: [body.messageId],
          reason: 'AI-assisted restore',
        }, userId, tenantId);
        message = `I've restored the message. Your edit history is preserved.`;
        break;
        
      case 'restore_all':
        result = await service.restore({
          chatId,
          targetSnapshotId: body.snapshotId,
          scope: 'full_chat',
          reason: 'AI-assisted restore',
        }, userId, tenantId);
        message = `I've restored the conversation to that point. ${result.messagesRestored} messages and ${result.filesRestored} files were restored. ` +
          `Don't worry - everything from before is saved and you can restore it anytime.`;
        break;
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message,
        undoAvailable: true,
        undoSnapshotId: result?.previousSnapshotId,
        newVersion: result?.newVersion,
      }),
    };
  } catch (error: any) {
    console.error('aiRestore error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}

/**
 * GET /api/ai/chats/:chatId/history/compare
 * 
 * Compare two points in time - useful for "what changed since..."
 * 
 * Query params: from=snapshotId&to=snapshotId (or "current")
 * 
 * Response:
 * {
 *   "summary": "Between December 18th and now: 12 new messages, 2 files updated, 1 file added.",
 *   "changes": {
 *     "messagesAdded": 12,
 *     "messagesEdited": 3,
 *     "messagesDeleted": 1,
 *     "filesAdded": ["report_v2.xlsx"],
 *     "filesUpdated": ["budget.xlsx", "notes.md"],
 *     "filesDeleted": []
 *   }
 * }
 */
export async function compareSnapshots(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const chatId = event.pathParameters?.chatId;
    const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];
    const fromId = event.queryStringParameters?.from;
    const toId = event.queryStringParameters?.to || 'current';
    
    if (!chatId || !fromId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'chatId and from snapshot required' }) };
    }
    
    // Get states at both points
    const fromState = await service.getChatAtSnapshot(chatId, fromId, tenantId);
    
    let toState;
    if (toId === 'current') {
      const timeline = await service.getTimeline(chatId, tenantId);
      const currentSnapshotId = timeline.snapshots[timeline.snapshots.length - 1]?.id;
      toState = await service.getChatAtSnapshot(chatId, currentSnapshotId, tenantId);
    } else {
      toState = await service.getChatAtSnapshot(chatId, toId, tenantId);
    }
    
    // Calculate differences
    const fromMessageIds = new Set(fromState.messages.map(m => m.messageId));
    const toMessageIds = new Set(toState.messages.map(m => m.messageId));
    
    const messagesAdded = toState.messages.filter(m => !fromMessageIds.has(m.messageId)).length;
    const messagesRemoved = fromState.messages.filter(m => !toMessageIds.has(m.messageId)).length;
    
    const fromFileNames = new Set(fromState.files.map(f => f.originalName));
    const toFileNames = new Set(toState.files.map(f => f.originalName));
    
    const filesAdded = toState.files.filter(f => !fromFileNames.has(f.originalName)).map(f => f.originalName);
    const filesRemoved = fromState.files.filter(f => !toFileNames.has(f.originalName)).map(f => f.originalName);
    
    // Files that exist in both but may have been updated
    const filesUpdated = toState.files
      .filter(toFile => {
        const fromFile = fromState.files.find(f => f.originalName === toFile.originalName);
        return fromFile && fromFile.version < toFile.version;
      })
      .map(f => f.originalName);
    
    const fromDate = new Date(fromState.snapshot.timestamp).toLocaleDateString('en-US', { 
      month: 'long', day: 'numeric' 
    });
    
    let summary = `Between ${fromDate} and now: `;
    const parts: string[] = [];
    
    if (messagesAdded > 0) parts.push(`${messagesAdded} new message${messagesAdded !== 1 ? 's' : ''}`);
    if (filesUpdated.length > 0) parts.push(`${filesUpdated.length} file${filesUpdated.length !== 1 ? 's' : ''} updated`);
    if (filesAdded.length > 0) parts.push(`${filesAdded.length} file${filesAdded.length !== 1 ? 's' : ''} added`);
    if (messagesRemoved > 0) parts.push(`${messagesRemoved} message${messagesRemoved !== 1 ? 's' : ''} removed`);
    
    summary += parts.length > 0 ? parts.join(', ') + '.' : 'no changes.';
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        summary,
        changes: {
          messagesAdded,
          messagesRemoved,
          filesAdded,
          filesUpdated,
          filesRemoved,
        },
        fromSnapshot: {
          id: fromState.snapshot.id,
          timestamp: fromState.snapshot.timestamp,
          version: fromState.snapshot.version,
        },
        toSnapshot: {
          id: toState.snapshot.id,
          timestamp: toState.snapshot.timestamp,
          version: toState.snapshot.version,
        },
      }),
    };
  } catch (error: any) {
    console.error('compareSnapshots error:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
}
```

---

## 33.2 AI API Routes

```typescript
// packages/functions/src/routes/ai-time-machine.routes.ts

import { Router } from './router';
import * as handlers from '../handlers/thinktank/ai-time-machine.handlers';

export function registerAITimeMachineRoutes(router: Router) {
  // Summary and discovery
  router.get('/api/ai/chats/:chatId/history/summary', handlers.getHistorySummary);
  router.post('/api/ai/chats/:chatId/history/find', handlers.findInHistory);
  
  // AI-assisted restore
  router.post('/api/ai/chats/:chatId/history/restore', handlers.aiRestore);
  
  // Comparison
  router.get('/api/ai/chats/:chatId/history/compare', handlers.compareSnapshots);
}
```

---

## 33.3 Time Machine Visual UI Components

```tsx
// apps/thinktank/src/components/time-machine/time-machine-overlay.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, RotateCcw, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTimeline, useChatAtSnapshot, useRestore } from '@/hooks/use-time-machine';
import { formatDistanceToNow, format, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimeMachineOverlayProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Time Machine Overlay
 * 
 * Apple Time Machine-inspired visual experience:
 * - Messages stack backwards into "space" with perspective
 * - Timeline bar on the right edge
 * - Calendar picker for jumping to dates
 * - Current state at front, past fading into background
 */
export function TimeMachineOverlay({ chatId, isOpen, onClose }: TimeMachineOverlayProps) {
  const { data: timeline, isLoading } = useTimeline(chatId);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar'>('timeline');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const { data: snapshotState } = useChatAtSnapshot(chatId, selectedSnapshotId || undefined);
  const restoreMutation = useRestore();
  
  // Set initial snapshot to latest
  useEffect(() => {
    if (timeline?.snapshots.length && !selectedSnapshotId) {
      setSelectedSnapshotId(timeline.snapshots[timeline.snapshots.length - 1].id);
    }
  }, [timeline, selectedSnapshotId]);
  
  if (!isOpen) return null;
  
  const currentIndex = timeline?.snapshots.findIndex(s => s.id === selectedSnapshotId) ?? -1;
  const selectedSnapshot = timeline?.snapshots[currentIndex];
  
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!timeline) return;
    
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(timeline.snapshots.length - 1, currentIndex + 1);
    
    setSelectedSnapshotId(timeline.snapshots[newIndex].id);
  };
  
  const handleRestore = async () => {
    if (!selectedSnapshotId || !timeline) return;
    
    const isLatest = currentIndex === timeline.snapshots.length - 1;
    if (isLatest) return; // Can't restore to current
    
    await restoreMutation.mutateAsync({
      chatId,
      snapshotId: selectedSnapshotId,
      scope: 'full_chat',
    });
    
    onClose();
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        {/* Starfield background (like Time Machine) */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="stars" />
        </div>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
              <X className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Time Machine</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="text-white"
            >
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="text-white"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </div>
        </div>
        
        {/* Main content area */}
        <div className="absolute inset-0 pt-16 pb-24 px-4 flex">
          {/* Message stack with 3D perspective */}
          <div className="flex-1 relative perspective-1000">
            <MessageStack
              messages={snapshotState?.messages || []}
              files={snapshotState?.files || []}
              isLoading={isLoading}
            />
          </div>
          
          {/* Right sidebar - Timeline or Calendar */}
          <div className="w-64 ml-4">
            {viewMode === 'timeline' ? (
              <TimelineBar
                snapshots={timeline?.snapshots || []}
                selectedId={selectedSnapshotId}
                onSelect={setSelectedSnapshotId}
              />
            ) : (
              <CalendarPicker
                snapshotsByDate={timeline?.snapshotsByDate || {}}
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  // Find first snapshot on that date
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const snapshot = timeline?.snapshots.find(s => 
                    s.timestamp.startsWith(dateStr)
                  );
                  if (snapshot) {
                    setSelectedSnapshotId(snapshot.id);
                  }
                }}
              />
            )}
          </div>
        </div>
        
        {/* Bottom control bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {/* Navigation arrows */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate('prev')}
                disabled={currentIndex <= 0}
                className="bg-white/10 border-white/20 text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate('next')}
                disabled={currentIndex >= (timeline?.snapshots.length || 0) - 1}
                className="bg-white/10 border-white/20 text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Snapshot info */}
            <div className="text-center text-white">
              {selectedSnapshot && (
                <>
                  <div className="text-lg font-medium">
                    {format(parseISO(selectedSnapshot.timestamp), 'MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-white/60">
                    {format(parseISO(selectedSnapshot.timestamp), 'h:mm a')} Â· 
                    Version {selectedSnapshot.version} of {timeline?.totalSnapshots}
                  </div>
                </>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white"
                disabled={currentIndex === (timeline?.snapshots.length || 0) - 1}
                onClick={handleRestore}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MESSAGE STACK - 3D perspective view of messages receding into the past
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function MessageStack({ 
  messages, 
  files, 
  isLoading 
}: { 
  messages: any[];
  files: any[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/60">Loading history...</div>
      </div>
    );
  }
  
  return (
    <div className="relative h-full overflow-hidden">
      {/* 3D perspective container */}
      <div 
        className="absolute inset-0 flex flex-col-reverse items-center justify-end pb-8"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {messages.map((message, index) => {
          // Calculate 3D positioning - newer messages at front, older recede
          const depth = index * 0.5; // How far "back" this message is
          const scale = Math.max(0.3, 1 - depth * 0.1);
          const opacity = Math.max(0.2, 1 - depth * 0.15);
          const blur = Math.min(depth * 0.5, 3);
          const yOffset = index * 60; // Vertical stacking
          const zOffset = -depth * 100; // Depth positioning
          
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity, y: yOffset }}
              className={cn(
                "w-full max-w-2xl p-4 rounded-lg mb-2",
                message.role === 'user' 
                  ? 'bg-blue-600/80 ml-auto mr-0' 
                  : 'bg-gray-700/80 mr-auto ml-0'
              )}
              style={{
                transform: `scale(${scale}) translateZ(${zOffset}px)`,
                filter: `blur(${blur}px)`,
              }}
            >
              <div className="text-sm text-white/60 mb-1">
                {message.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className="text-white">
                {message.content.length > 200 
                  ? message.content.substring(0, 200) + '...'
                  : message.content}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Files bar at bottom */}
      {files.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60">
          <div className="flex gap-2 overflow-x-auto">
            {files.map(file => (
              <div 
                key={file.id}
                className="flex-shrink-0 px-3 py-2 bg-white/10 rounded-lg text-white text-sm"
              >
                ðŸ“Ž {file.displayName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIMELINE BAR - Visual timeline of snapshots
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function TimelineBar({
  snapshots,
  selectedId,
  onSelect,
}: {
  snapshots: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Group snapshots by date
  const groupedByDate: Record<string, any[]> = {};
  for (const snapshot of snapshots) {
    const date = snapshot.timestamp.split('T')[0];
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(snapshot);
  }
  
  return (
    <div ref={containerRef} className="h-full overflow-y-auto pr-2">
      {Object.entries(groupedByDate).reverse().map(([date, dateSnapshots]) => (
        <div key={date} className="mb-4">
          <div className="text-xs text-white/40 mb-2 sticky top-0 bg-black/50 py-1">
            {format(parseISO(date), 'MMM d, yyyy')}
          </div>
          <div className="space-y-1">
            {dateSnapshots.map(snapshot => (
              <button
                key={snapshot.id}
                onClick={() => onSelect(snapshot.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg transition-colors",
                  "text-sm text-white/80 hover:bg-white/10",
                  selectedId === snapshot.id && "bg-white/20 ring-1 ring-white/40"
                )}
              >
                <div className="font-medium">
                  {format(parseISO(snapshot.timestamp), 'h:mm a')}
                </div>
                <div className="text-xs text-white/50">
                  {snapshot.messageCount} messages Â· {snapshot.fileCount} files
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CALENDAR PICKER - Jump to any date
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function CalendarPicker({
  snapshotsByDate,
  selectedDate,
  onSelectDate,
}: {
  snapshotsByDate: Record<string, number>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(selectedDate);
  
  // Generate calendar grid
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  
  return (
    <div className="bg-white/5 rounded-lg p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
          className="text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-white font-medium">
          {format(viewMonth, 'MMMM yyyy')}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
          className="text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs text-white/40">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={i} />;
          }
          
          const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
          const dateStr = format(date, 'yyyy-MM-dd');
          const hasSnapshots = snapshotsByDate[dateStr] > 0;
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          
          return (
            <button
              key={i}
              onClick={() => hasSnapshots && onSelectDate(date)}
              disabled={!hasSnapshots}
              className={cn(
                "aspect-square flex items-center justify-center rounded-full text-sm",
                "transition-colors",
                hasSnapshots 
                  ? "text-white hover:bg-white/20 cursor-pointer" 
                  : "text-white/20 cursor-not-allowed",
                isSelected && "bg-blue-600 text-white",
                isToday && !isSelected && "ring-1 ring-white/40"
              )}
            >
              {day}
              {hasSnapshots && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 33.4 Time Machine Entry Button

```tsx
// apps/thinktank/src/components/time-machine/time-machine-button.tsx

'use client';

import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TimeMachineOverlay } from './time-machine-overlay';

interface TimeMachineButtonProps {
  chatId: string;
}

/**
 * Time Machine Entry Button
 * 
 * Small, unobtrusive button that opens the full Time Machine experience.
 * Hidden in the chat header, only visible on hover or in Advanced mode.
 */
export function TimeMachineButton({ chatId }: TimeMachineButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-4 w-4 mr-1.5" />
            <span className="text-xs">Time Machine</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Browse and restore chat history</p>
        </TooltipContent>
      </Tooltip>
      
      <TimeMachineOverlay
        chatId={chatId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
```

---

## 33.5 React Hooks for Time Machine

```typescript
// apps/thinktank/src/hooks/use-time-machine.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChatTimeline, RestoreResult, RestoreScope } from '@radiant/shared';

// Get full timeline
export function useTimeline(chatId: string | undefined) {
  return useQuery({
    queryKey: ['time-machine', 'timeline', chatId],
    queryFn: async () => {
      const response = await api.get<ChatTimeline>(`/thinktank/chats/${chatId}/time-machine`);
      return response.data;
    },
    enabled: !!chatId,
    staleTime: 30000, // 30 seconds
  });
}

// Get chat state at specific snapshot
export function useChatAtSnapshot(chatId: string | undefined, snapshotId: string | undefined) {
  return useQuery({
    queryKey: ['time-machine', 'snapshot', chatId, snapshotId],
    queryFn: async () => {
      const response = await api.get(`/thinktank/chats/${chatId}/time-machine/snapshots/${snapshotId}`);
      return response.data;
    },
    enabled: !!chatId && !!snapshotId,
  });
}

// Get snapshots for a specific date
export function useSnapshotsByDate(chatId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['time-machine', 'date', chatId, date],
    queryFn: async () => {
      const response = await api.get(`/thinktank/chats/${chatId}/time-machine/calendar/${date}`);
      return response.data.snapshots;
    },
    enabled: !!chatId && !!date,
  });
}

// Restore mutation
export function useRestore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      chatId, 
      snapshotId, 
      scope = 'full_chat',
      messageIds,
      fileIds,
      reason,
    }: {
      chatId: string;
      snapshotId: string;
      scope?: RestoreScope;
      messageIds?: string[];
      fileIds?: string[];
      reason?: string;
    }) => {
      const response = await api.post<RestoreResult>(`/thinktank/chats/${chatId}/time-machine/restore`, {
        snapshotId,
        scope,
        messageIds,
        fileIds,
        reason,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['time-machine', 'timeline', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chat', variables.chatId] });
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatId] });
    },
  });
}

// Search in history
export function useHistorySearch(chatId: string | undefined, query: string) {
  return useQuery({
    queryKey: ['time-machine', 'search', chatId, query],
    queryFn: async () => {
      const response = await api.get(`/thinktank/chats/${chatId}/time-machine/search`, {
        params: { q: query },
      });
      return response.data;
    },
    enabled: !!chatId && query.length > 2,
  });
}

// File versions
export function useFileVersions(chatId: string | undefined, fileName: string | undefined) {
  return useQuery({
    queryKey: ['time-machine', 'file-versions', chatId, fileName],
    queryFn: async () => {
      const response = await api.get(`/thinktank/chats/${chatId}/time-machine/files/${encodeURIComponent(fileName!)}/versions`);
      return response.data.versions;
    },
    enabled: !!chatId && !!fileName,
  });
}

// Create export
export function useCreateExport() {
  return useMutation({
    mutationFn: async ({
      chatId,
      format = 'zip',
      includeMedia = true,
      includeVersionHistory = false,
    }: {
      chatId: string;
      format?: 'zip' | 'json' | 'markdown' | 'pdf' | 'html';
      includeMedia?: boolean;
      includeVersionHistory?: boolean;
    }) => {
      const response = await api.post(`/thinktank/chats/${chatId}/time-machine/export`, {
        format,
        includeMedia,
        includeVersionHistory,
      });
      return response.data;
    },
  });
}
```

---

## 33.6 CDK Infrastructure Updates

```typescript
// packages/cdk/src/stacks/time-machine-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

interface TimeMachineStackProps extends cdk.StackProps {
  environment: string;
  thinktankApi: apigateway.RestApi;
  thinktankLambda: lambda.Function;
}

export class TimeMachineStack extends cdk.Stack {
  public readonly mediaVaultBucket: s3.Bucket;
  
  constructor(scope: Construct, id: string, props: TimeMachineStackProps) {
    super(scope, id, props);
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // MEDIA VAULT BUCKET - S3 with versioning, never delete
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    this.mediaVaultBucket = new s3.Bucket(this, 'MediaVault', {
      bucketName: `radiant-media-vault-${props.environment}-${cdk.Aws.ACCOUNT_ID}`,
      
      // CRITICAL: Enable versioning for true immutability
      versioned: true,
      
      // Security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      
      // CORS for direct uploads
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        exposedHeaders: ['ETag', 'x-amz-version-id'],
        maxAge: 3600,
      }],
      
      // Lifecycle: Move to cheaper storage, NEVER delete
      lifecycleRules: [{
        id: 'TransitionToIntelligentTiering',
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(30),
        }],
        noncurrentVersionTransitions: [{
          storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
          transitionAfter: cdk.Duration.days(90),
        }],
        // NO expiration - keep forever
      }],
      
      // Transfer acceleration
      transferAcceleration: true,
      
      // RETAIN even if stack deleted
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // Deny delete actions (belt and suspenders)
    this.mediaVaultBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'DenyObjectDeletion',
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
      resources: [this.mediaVaultBucket.arnForObjects('*')],
      conditions: {
        StringNotEquals: {
          'aws:PrincipalArn': [
            `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/radiant-gdpr-deletion-role`,
          ],
        },
      },
    }));
    
    // Grant Lambda read/write (but not delete)
    this.mediaVaultBucket.grantReadWrite(props.thinktankLambda);
    props.thinktankLambda.addEnvironment('MEDIA_VAULT_BUCKET', this.mediaVaultBucket.bucketName);
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // API ROUTES
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    const api = props.thinktankApi;
    const lambdaIntegration = new apigateway.LambdaIntegration(props.thinktankLambda);
    
    // Time Machine base
    const chatsResource = api.root.addResource('chats');
    const chatResource = chatsResource.addResource('{chatId}');
    const timeMachineResource = chatResource.addResource('time-machine');
    
    // Timeline
    timeMachineResource.addMethod('GET', lambdaIntegration);
    
    // Snapshots
    const snapshotsResource = timeMachineResource.addResource('snapshots');
    snapshotsResource.addResource('{snapshotId}').addMethod('GET', lambdaIntegration);
    
    // Calendar
    timeMachineResource.addResource('calendar').addResource('{date}').addMethod('GET', lambdaIntegration);
    
    // Restore
    timeMachineResource.addResource('restore').addMethod('POST', lambdaIntegration);
    
    // Files
    const filesResource = timeMachineResource.addResource('files');
    filesResource.addMethod('GET', lambdaIntegration);
    filesResource.addResource('{fileName}').addResource('versions').addMethod('GET', lambdaIntegration);
    
    // Search
    timeMachineResource.addResource('search').addMethod('GET', lambdaIntegration);
    
    // Export
    timeMachineResource.addResource('export').addMethod('POST', lambdaIntegration);
    
    // File download
    api.root.addResource('files').addResource('{fileId}').addResource('download').addMethod('GET', lambdaIntegration);
    
    // Export status
    api.root.addResource('exports').addResource('{bundleId}').addMethod('GET', lambdaIntegration);
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // AI API ROUTES
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    const aiResource = api.root.addResource('ai');
    const aiChatsResource = aiResource.addResource('chats').addResource('{chatId}');
    const historyResource = aiChatsResource.addResource('history');
    
    historyResource.addResource('summary').addMethod('GET', lambdaIntegration);
    historyResource.addResource('find').addMethod('POST', lambdaIntegration);
    historyResource.addResource('restore').addMethod('POST', lambdaIntegration);
    historyResource.addResource('compare').addMethod('GET', lambdaIntegration);
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // OUTPUTS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    new cdk.CfnOutput(this, 'MediaVaultBucketName', {
      value: this.mediaVaultBucket.bucketName,
      description: 'Time Machine Media Vault S3 Bucket',
    });
  }
}
```

---

## 33.7 Integration with Think Tank Chat

```tsx
// apps/thinktank/src/components/chat/chat-header.tsx (updated)

import { TimeMachineButton } from '../time-machine/time-machine-button';

export function ChatHeader({ chatId, title }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <h1 className="font-semibold">{title || 'New Chat'}</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Time Machine - hidden until hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <TimeMachineButton chatId={chatId} />
        </div>
        
        {/* Other header actions */}
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 34: DATABASE-DRIVEN ORCHESTRATION ENGINE (v4.1.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **CRITICAL: This section replaces ALL hardcoded model configurations with database-driven management.**
> **All model configs, workflows, and orchestration parameters are stored in PostgreSQL.**
> **Administrators can add/edit/delete models entirely through the Admin Dashboard UI.**

---

## 34.1 DATABASE SCHEMA

### packages/database/migrations/034_orchestration_engine.sql

```sql
-- ============================================================================
-- RADIANT v4.1.0 - DATABASE-DRIVEN ORCHESTRATION ENGINE
-- ============================================================================
-- This migration creates the foundation for dynamic model management.
-- ALL model configurations are stored in PostgreSQL - NO HARDCODING.
-- ============================================================================

-- AI Model Registry (Replaces hardcoded TypeScript configs)
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  specialty VARCHAR(50),
  provider_type VARCHAR(20) NOT NULL DEFAULT 'self_hosted',
  
  deployment_config JSONB NOT NULL DEFAULT '{}',
  parameters BIGINT DEFAULT 0,
  accuracy VARCHAR(200),
  benchmark TEXT,
  capabilities TEXT[] DEFAULT '{}',
  input_formats TEXT[] DEFAULT '{}',
  output_formats TEXT[] DEFAULT '{}',
  architecture JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  
  thermal_config JSONB NOT NULL DEFAULT '{"defaultState":"OFF","scaleToZeroAfterMinutes":15,"warmupTimeSeconds":60,"minInstances":0,"maxInstances":2}',
  current_thermal_state VARCHAR(20) DEFAULT 'OFF',
  last_thermal_change TIMESTAMPTZ,
  
  pricing_config JSONB NOT NULL DEFAULT '{"hourlyRate":0,"perRequest":0,"markup":0.75}',
  
  min_tier INTEGER DEFAULT 1,
  requires_gpu BOOLEAN DEFAULT false,
  gpu_memory_gb INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active',
  version VARCHAR(50),
  repository VARCHAR(500),
  release_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES administrators(id),
  updated_by UUID REFERENCES administrators(id)
);

-- License Tracking
CREATE TABLE IF NOT EXISTS model_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
  license_type VARCHAR(50) NOT NULL,
  license_spdx VARCHAR(50) NOT NULL,
  license_url VARCHAR(500),
  commercial_use BOOLEAN DEFAULT true,
  commercial_notes TEXT,
  attribution_required BOOLEAN DEFAULT false,
  attribution_text TEXT,
  share_alike BOOLEAN DEFAULT false,
  compliance_status VARCHAR(20) DEFAULT 'compliant',
  last_compliance_review TIMESTAMPTZ,
  reviewed_by UUID REFERENCES administrators(id),
  compliance_notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Dependencies
CREATE TABLE IF NOT EXISTS model_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) NOT NULL,
  dependency_name VARCHAR(200) NOT NULL,
  dependency_size_gb DECIMAL(10,2),
  dependency_license VARCHAR(50),
  required BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Definitions
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  dag_definition JSONB NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  default_parameters JSONB NOT NULL DEFAULT '{}',
  timeout_seconds INTEGER DEFAULT 3600,
  max_retries INTEGER DEFAULT 3,
  min_tier INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  requires_audit_trail BOOLEAN DEFAULT false,
  hipaa_compliant BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES administrators(id)
);

-- Workflow Tasks
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  task_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) NOT NULL,
  model_id UUID REFERENCES ai_models(id),
  service_id VARCHAR(100),
  config JSONB NOT NULL DEFAULT '{}',
  input_mapping JSONB DEFAULT '{}',
  output_mapping JSONB DEFAULT '{}',
  sequence_order INTEGER DEFAULT 0,
  depends_on TEXT[] DEFAULT '{}',
  condition_expression TEXT,
  timeout_seconds INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, task_id)
);

-- Workflow Parameters
CREATE TABLE IF NOT EXISTS workflow_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  parameter_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  description TEXT,
  data_type VARCHAR(50) NOT NULL,
  default_value JSONB,
  validation_rules JSONB DEFAULT '{}',
  ui_component VARCHAR(50) DEFAULT 'text',
  ui_config JSONB DEFAULT '{}',
  user_configurable BOOLEAN DEFAULT true,
  admin_only BOOLEAN DEFAULT false,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, parameter_name)
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  input_parameters JSONB NOT NULL DEFAULT '{}',
  resolved_parameters JSONB DEFAULT '{}',
  output_data JSONB,
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  estimated_cost_usd DECIMAL(10,4),
  actual_cost_usd DECIMAL(10,4),
  checkpoint_data JSONB,
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Executions
CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  task_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_number INTEGER DEFAULT 1,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  error_code VARCHAR(50),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  resource_usage JSONB DEFAULT '{}',
  cost_usd DECIMAL(10,4),
  model_id UUID REFERENCES ai_models(id),
  model_endpoint VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orchestration Audit Log
CREATE TABLE IF NOT EXISTS orchestration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES administrators(id),
  actor_type VARCHAR(20) DEFAULT 'admin',
  previous_state JSONB,
  new_state JSONB,
  change_summary TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_models_category ON ai_models(category);
CREATE INDEX IF NOT EXISTS idx_ai_models_status ON ai_models(status, enabled);
CREATE INDEX IF NOT EXISTS idx_model_licenses_model ON model_licenses(model_id);
CREATE INDEX IF NOT EXISTS idx_model_licenses_compliance ON model_licenses(compliance_status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_audit_time ON orchestration_audit_log(created_at DESC);

-- Function: Get full model config (replaces hardcoded lookups)
CREATE OR REPLACE FUNCTION get_model_config(p_model_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', m.model_id,
    'name', m.name,
    'displayName', m.display_name,
    'description', m.description,
    'category', m.category,
    'providerType', m.provider_type,
    'deployment', m.deployment_config,
    'thermal', m.thermal_config,
    'pricing', m.pricing_config,
    'parameters', m.parameters,
    'accuracy', m.accuracy,
    'minTier', m.min_tier,
    'requiresGpu', m.requires_gpu,
    'status', m.status,
    'version', m.version,
    'currentThermalState', m.current_thermal_state,
    'licenses', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', l.id, 'type', l.license_type, 'spdx', l.license_spdx,
        'commercialUse', l.commercial_use, 'complianceStatus', l.compliance_status
      )), '[]'::jsonb)
      FROM model_licenses l WHERE l.model_id = m.id
    ),
    'dependencies', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', d.dependency_name, 'type', d.dependency_type,
        'sizeGb', d.dependency_size_gb, 'required', d.required
      )), '[]'::jsonb)
      FROM model_dependencies d WHERE d.model_id = m.id
    )
  ) INTO result
  FROM ai_models m
  WHERE m.model_id = p_model_id AND m.enabled = true;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get workflow config
CREATE OR REPLACE FUNCTION get_workflow_config(p_workflow_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', w.workflow_id,
    'name', w.name,
    'description', w.description,
    'category', w.category,
    'version', w.version,
    'dag', w.dag_definition,
    'inputSchema', w.input_schema,
    'defaultParameters', w.default_parameters,
    'timeout', w.timeout_seconds,
    'minTier', w.min_tier,
    'tasks', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'taskId', t.task_id, 'name', t.name, 'type', t.task_type,
        'modelId', (SELECT model_id FROM ai_models WHERE id = t.model_id),
        'config', t.config, 'dependsOn', t.depends_on, 'timeout', t.timeout_seconds
      ) ORDER BY t.sequence_order), '[]'::jsonb)
      FROM workflow_tasks t WHERE t.workflow_id = w.id
    ),
    'parameters', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.parameter_name, 'displayName', p.display_name,
        'type', p.data_type, 'default', p.default_value,
        'validation', p.validation_rules, 'uiComponent', p.ui_component
      ) ORDER BY p.sequence_order), '[]'::jsonb)
      FROM workflow_parameters p WHERE p.workflow_id = w.id
    )
  ) INTO result
  FROM workflow_definitions w
  WHERE w.workflow_id = p_workflow_id AND w.enabled = true;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Audit Trigger
CREATE OR REPLACE FUNCTION log_model_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO orchestration_audit_log (entity_type, entity_id, action, new_state, change_summary, actor_id)
    VALUES ('model', NEW.id, 'created', to_jsonb(NEW), 'Model ' || NEW.display_name || ' created', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO orchestration_audit_log (entity_type, entity_id, action, previous_state, new_state, change_summary, actor_id)
    VALUES ('model', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), 'Model ' || NEW.display_name || ' updated', NEW.updated_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO orchestration_audit_log (entity_type, entity_id, action, previous_state, change_summary)
    VALUES ('model', OLD.id, 'deleted', to_jsonb(OLD), 'Model ' || OLD.display_name || ' deleted');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_models_audit_trigger ON ai_models;
CREATE TRIGGER ai_models_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON ai_models
FOR EACH ROW EXECUTE FUNCTION log_model_changes();

-- Row Level Security
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_models_read ON ai_models FOR SELECT TO authenticated
  USING (enabled = true AND status IN ('active', 'beta'));

CREATE POLICY workflow_executions_owner ON workflow_executions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid()));
```

---

## 34.2 ALPHAFOLD 2 SEED DATA

### packages/database/migrations/034a_seed_alphafold2.sql

```sql
-- ============================================================================
-- ALPHAFOLD 2 - Nobel Prize-Winning Protein Folding Model
-- ============================================================================

INSERT INTO ai_models (
  model_id, name, display_name, description, category, specialty, provider_type,
  deployment_config, parameters, accuracy, benchmark, capabilities,
  input_formats, output_formats, architecture, performance_metrics,
  thermal_config, pricing_config, min_tier, requires_gpu, gpu_memory_gb,
  status, version, repository, release_date
) VALUES (
  'alphafold2',
  'alphafold2',
  'AlphaFold 2',
  'Nobel Prize-winning protein structure prediction with near-experimental accuracy. Won CASP14 with 92.4 median GDT_TS.',
  'scientific_protein',
  'protein_folding',
  'self_hosted',
  '{
    "image": "pytorch-inference:2.1-gpu-py310-cu121-ubuntu22.04",
    "instanceType": "ml.g5.12xlarge",
    "environment": {"MODEL_NAME": "alphafold2_ptm", "JAX_PLATFORM_NAME": "gpu"},
    "modelDataUrl": "s3://radiant-models/alphafold2/params_2022-12-06.tar",
    "resourceRequirements": {"minGpuMemoryGB": 16, "recommendedGpuMemoryGB": 96, "databaseStorageGB": 2620}
  }'::JSONB,
  93000000,
  'GDT > 90 on CASP14, 92.4 median GDT_TS, 0.96Ã… median backbone RMSD',
  'CASP14: Won 88/97 targets, far exceeding all other methods.',
  ARRAY['protein_folding', 'structure_prediction', 'confidence_estimation', 'multimer_prediction'],
  ARRAY['text/fasta', 'text/plain', 'application/json'],
  ARRAY['application/pdb', 'application/mmcif', 'application/json'],
  '{"evoformerBlocks": 48, "structureBlocks": 8, "recyclingIterations": 4}'::JSONB,
  '{"inferenceTime100Residues": 4.9, "inferenceTime500Residues": 29, "maxResiduesG5_12xlarge": 2500}'::JSONB,
  '{"defaultState": "OFF", "scaleToZeroAfterMinutes": 10, "warmupTimeSeconds": 180, "minInstances": 0, "maxInstances": 2}'::JSONB,
  '{"hourlyRate": 14.28, "perRequest": 2.00, "perResidueOver500": 0.002, "markup": 0.75}'::JSONB,
  4, true, 96, 'active', '2.3.2', 'https://github.com/google-deepmind/alphafold', '2023-04-05'
) ON CONFLICT (model_id) DO UPDATE SET updated_at = NOW();

-- Insert licenses
DO $$
DECLARE alphafold2_id UUID;
BEGIN
  SELECT id INTO alphafold2_id FROM ai_models WHERE model_id = 'alphafold2';
  
  INSERT INTO model_licenses (model_id, license_type, license_spdx, license_url, commercial_use, attribution_required, attribution_text, compliance_status)
  VALUES 
    (alphafold2_id, 'source_code', 'Apache-2.0', 'https://github.com/google-deepmind/alphafold/blob/main/LICENSE', true, true, 'AlphaFold source code Â© DeepMind Technologies Limited', 'compliant'),
    (alphafold2_id, 'model_weights', 'CC-BY-4.0', 'https://creativecommons.org/licenses/by/4.0/', true, true, 'Jumper, J. et al. Nature 596, 583â€“589 (2021). https://doi.org/10.1038/s41586-021-03819-2', 'compliant'),
    (alphafold2_id, 'database', 'CC-BY-SA-4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', true, true, 'BFD database - Steinegger M. and SÃ¶ding J.', 'compliant')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO model_dependencies (model_id, dependency_type, dependency_name, dependency_size_gb, dependency_license, required)
  VALUES
    (alphafold2_id, 'database', 'BFD', 1800, 'CC-BY-SA-4.0', true),
    (alphafold2_id, 'database', 'UniRef90', 103, 'CC-BY-4.0', true),
    (alphafold2_id, 'database', 'MGnify', 120, 'CC0-1.0', true),
    (alphafold2_id, 'database', 'PDB70', 56, 'CC0-1.0', true),
    (alphafold2_id, 'database', 'PDB mmCIF', 238, 'CC0-1.0', true)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert protein folding workflow
INSERT INTO workflow_definitions (
  workflow_id, name, description, category, version, dag_definition, input_schema, output_schema,
  default_parameters, timeout_seconds, max_retries, min_tier, requires_audit_trail
) VALUES (
  'protein_folding_alphafold2',
  'AlphaFold 2 Protein Folding Pipeline',
  'Complete protein structure prediction using AlphaFold 2 with MSA generation, template search, structure prediction, and Amber relaxation.',
  'scientific',
  '1.0.0',
  '{"nodes":[{"id":"validate_input","type":"validation"},{"id":"msa_generation","type":"task","modelId":"alphafold2"},{"id":"template_search","type":"task","modelId":"alphafold2"},{"id":"structure_prediction","type":"task","modelId":"alphafold2"},{"id":"relaxation","type":"task","modelId":"alphafold2"},{"id":"confidence_analysis","type":"task","modelId":"alphafold2"}],"edges":[{"from":"validate_input","to":"msa_generation"},{"from":"validate_input","to":"template_search"},{"from":"msa_generation","to":"structure_prediction"},{"from":"template_search","to":"structure_prediction"},{"from":"structure_prediction","to":"relaxation"},{"from":"structure_prediction","to":"confidence_analysis"}]}'::JSONB,
  '{"type":"object","required":["sequence"],"properties":{"sequence":{"type":"string","minLength":16,"maxLength":2700}}}'::JSONB,
  '{"type":"object","properties":{"structures":{"type":"array"},"confidence":{"type":"object"}}}'::JSONB,
  '{"numModels":5,"recyclingIterations":4,"relaxStructure":true,"useTemplates":true}'::JSONB,
  7200, 2, 4, true
) ON CONFLICT (workflow_id) DO UPDATE SET updated_at = NOW();
```

---

## 34.3 ORCHESTRATION ENGINE SERVICE

### packages/services/orchestration/OrchestrationEngine.ts

```typescript
/**
 * RADIANT v4.1.0 - Database-Driven Orchestration Engine
 * 
 * KEY PRINCIPLE: ZERO HARDCODING
 * All model configs stored in ai_models table - retrieved via get_model_config()
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface ModelConfig {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  providerType: 'self_hosted' | 'external';
  deployment: Record<string, any>;
  thermal: { defaultState: string; scaleToZeroAfterMinutes: number; warmupTimeSeconds: number; minInstances: number; maxInstances: number };
  pricing: { hourlyRate: number; perRequest: number; markup: number };
  parameters: number;
  minTier: number;
  requiresGpu: boolean;
  status: string;
  currentThermalState?: string;
  licenses: Array<{ id: string; type: string; spdx: string; commercialUse: boolean; complianceStatus: string }>;
  dependencies: Array<{ name: string; type: string; sizeGb?: number; required: boolean }>;
}

export class OrchestrationEngine extends EventEmitter {
  private pool: Pool;
  private modelCache: Map<string, { config: ModelConfig; timestamp: number }> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  /**
   * Get model config from database - REPLACES hardcoded TypeScript configs
   */
  async getModelConfig(modelId: string): Promise<ModelConfig | null> {
    const cached = this.modelCache.get(modelId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.config;
    }

    const result = await this.pool.query('SELECT get_model_config($1) as config', [modelId]);
    if (result.rows[0]?.config) {
      const config = result.rows[0].config as ModelConfig;
      this.modelCache.set(modelId, { config, timestamp: Date.now() });
      return config;
    }
    return null;
  }

  /**
   * List models with filters - Used by Admin Dashboard
   */
  async listModels(filters?: { category?: string; status?: string; minTier?: number; providerType?: string }): Promise<ModelConfig[]> {
    let query = `SELECT get_model_config(model_id) as config FROM ai_models WHERE enabled = true`;
    const params: any[] = [];
    let idx = 1;

    if (filters?.category) { query += ` AND category = $${idx++}`; params.push(filters.category); }
    if (filters?.status) { query += ` AND status = $${idx++}`; params.push(filters.status); }
    if (filters?.minTier) { query += ` AND min_tier <= $${idx++}`; params.push(filters.minTier); }
    if (filters?.providerType) { query += ` AND provider_type = $${idx++}`; params.push(filters.providerType); }

    query += ` ORDER BY category, display_name`;
    const result = await this.pool.query(query, params);
    return result.rows.map(r => r.config).filter(Boolean);
  }

  /**
   * Create model via Admin Dashboard - NO code deployment needed
   */
  async createModel(input: any, adminId: string): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO ai_models (
          model_id, name, display_name, description, category, specialty,
          provider_type, deployment_config, parameters, accuracy, benchmark,
          capabilities, input_formats, output_formats, thermal_config, pricing_config,
          min_tier, requires_gpu, gpu_memory_gb, status, version, repository, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        RETURNING id
      `, [
        input.modelId, input.name, input.displayName, input.description,
        input.category, input.specialty, input.providerType || 'self_hosted',
        JSON.stringify(input.deployment || {}), input.parameters || 0,
        input.accuracy, input.benchmark, input.capabilities || [],
        input.inputFormats || [], input.outputFormats || [],
        JSON.stringify(input.thermal || {}), JSON.stringify(input.pricing || {}),
        input.minTier || 1, input.requiresGpu || false, input.gpuMemoryGb || 0,
        input.status || 'active', input.version, input.repository, adminId
      ]);

      const modelUuid = result.rows[0].id;

      // Insert licenses
      for (const license of (input.licenses || [])) {
        await client.query(
          `INSERT INTO model_licenses (model_id, license_type, license_spdx, license_url, commercial_use, attribution_text) VALUES ($1,$2,$3,$4,$5,$6)`,
          [modelUuid, license.type, license.spdx, license.url, license.commercialUse ?? true, license.attribution]
        );
      }

      // Insert dependencies
      for (const dep of (input.dependencies || [])) {
        await client.query(
          `INSERT INTO model_dependencies (model_id, dependency_type, dependency_name, dependency_size_gb, dependency_license, required) VALUES ($1,$2,$3,$4,$5,$6)`,
          [modelUuid, dep.type, dep.name, dep.sizeGb, dep.license, dep.required ?? true]
        );
      }

      await client.query('COMMIT');
      this.modelCache.delete(input.modelId);
      this.emit('model:created', { modelId: input.modelId, adminId });
      return modelUuid;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update model via Admin Dashboard
   */
  async updateModel(modelId: string, updates: any, adminId: string): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      displayName: 'display_name', description: 'description', category: 'category',
      status: 'status', minTier: 'min_tier', version: 'version'
    };

    for (const [key, col] of Object.entries(fields)) {
      if (updates[key] !== undefined) { sets.push(`${col} = $${idx++}`); params.push(updates[key]); }
    }

    if (updates.deployment) { sets.push(`deployment_config = $${idx++}`); params.push(JSON.stringify(updates.deployment)); }
    if (updates.thermal) { sets.push(`thermal_config = $${idx++}`); params.push(JSON.stringify(updates.thermal)); }
    if (updates.pricing) { sets.push(`pricing_config = $${idx++}`); params.push(JSON.stringify(updates.pricing)); }

    if (sets.length === 0) return;

    sets.push(`updated_at = NOW()`, `updated_by = $${idx++}`);
    params.push(adminId, modelId);

    await this.pool.query(`UPDATE ai_models SET ${sets.join(', ')} WHERE model_id = $${idx}`, params);
    this.modelCache.delete(modelId);
    this.emit('model:updated', { modelId, adminId });
  }

  /**
   * Delete model (soft delete)
   */
  async deleteModel(modelId: string, adminId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ai_models SET enabled = false, status = 'disabled', updated_at = NOW(), updated_by = $2 WHERE model_id = $1`,
      [modelId, adminId]
    );
    this.modelCache.delete(modelId);
    this.emit('model:deleted', { modelId, adminId });
  }

  /**
   * Get workflow config from database
   */
  async getWorkflowConfig(workflowId: string): Promise<any> {
    const result = await this.pool.query('SELECT get_workflow_config($1) as config', [workflowId]);
    return result.rows[0]?.config || null;
  }

  /**
   * Execute workflow with parameters
   */
  async executeWorkflow(workflowId: string, tenantId: string, userId: string, parameters: Record<string, any>): Promise<string> {
    const workflow = await this.getWorkflowConfig(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const resolvedParams = { ...workflow.defaultParameters, ...parameters };

    const result = await this.pool.query(`
      INSERT INTO workflow_executions (workflow_id, tenant_id, user_id, status, input_parameters, resolved_parameters, started_at)
      VALUES ((SELECT id FROM workflow_definitions WHERE workflow_id = $1), $2, $3, 'running', $4, $5, NOW())
      RETURNING id
    `, [workflowId, tenantId, userId, JSON.stringify(parameters), JSON.stringify(resolvedParams)]);

    const executionId = result.rows[0].id;
    this.emit('workflow:started', { executionId, workflowId, tenantId, userId });
    return executionId;
  }

  /**
   * Get license summary for compliance dashboard
   */
  async getLicenseSummary(): Promise<{ totalModels: number; commercialOk: number; reviewNeeded: number; nonCompliant: number; expiringIn30Days: number }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT m.id) as total_models,
        COUNT(DISTINCT CASE WHEN NOT EXISTS (SELECT 1 FROM model_licenses l2 WHERE l2.model_id = m.id AND l2.commercial_use = false) THEN m.id END) as commercial_ok,
        COUNT(DISTINCT CASE WHEN l.compliance_status = 'review_needed' THEN m.id END) as review_needed,
        COUNT(DISTINCT CASE WHEN l.compliance_status = 'non_compliant' THEN m.id END) as non_compliant,
        COUNT(DISTINCT CASE WHEN l.expires_at IS NOT NULL AND l.expires_at < NOW() + INTERVAL '30 days' THEN m.id END) as expiring_soon
      FROM ai_models m LEFT JOIN model_licenses l ON m.id = l.model_id WHERE m.enabled = true
    `);
    return {
      totalModels: parseInt(result.rows[0].total_models),
      commercialOk: parseInt(result.rows[0].commercial_ok),
      reviewNeeded: parseInt(result.rows[0].review_needed),
      nonCompliant: parseInt(result.rows[0].non_compliant),
      expiringIn30Days: parseInt(result.rows[0].expiring_soon),
    };
  }

  refreshCache(): void {
    this.modelCache.clear();
  }
}

let instance: OrchestrationEngine | null = null;
export function getOrchestrationEngine(pool: Pool): OrchestrationEngine {
  if (!instance) instance = new OrchestrationEngine(pool);
  return instance;
}
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 35: ADMIN DASHBOARD - MODEL & LICENSE MANAGEMENT UI (v4.1.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Full CRUD UI for managing AI models through the Admin Dashboard.**
> **Administrators can add/edit/delete models without any code changes.**

---

## 35.1 MODEL MANAGEMENT PAGE

### apps/admin-dashboard/app/(dashboard)/models/page.tsx

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModelTable } from '@/components/models/model-table';
import { ModelForm } from '@/components/models/model-form';
import { LicensePanel } from '@/components/models/license-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';

export default function ModelsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: models, isLoading, refetch } = useQuery({
    queryKey: ['models', categoryFilter],
    queryFn: async () => {
      const params = categoryFilter !== 'all' ? `?category=${categoryFilter}` : '';
      const response = await api.get(`/api/v2/admin/models${params}`);
      return response.data;
    },
  });

  const { data: licenseSummary } = useQuery({
    queryKey: ['license-summary'],
    queryFn: async () => (await api.get('/api/v2/admin/models/licenses/summary')).data,
  });

  const createModelMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v2/admin/models', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setShowAddModel(false);
      toast({ title: 'Model Created', description: 'New model added to registry.' });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: (modelId: string) => api.delete(`/api/v2/admin/models/${modelId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      toast({ title: 'Model Deleted' });
    },
  });

  const filteredModels = models?.filter((m: any) => 
    m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.modelId.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Models</h1>
          <p className="text-muted-foreground">
            Database-driven model management - no code changes needed!
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Dialog open={showAddModel} onOpenChange={setShowAddModel}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Model</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New AI Model</DialogTitle>
              </DialogHeader>
              <ModelForm 
                onSubmit={(data) => createModelMutation.mutate(data)}
                isLoading={createModelMutation.isPending}
                onCancel={() => setShowAddModel(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Models</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{licenseSummary?.totalModels || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Commercial OK</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{licenseSummary?.commercialOk || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Review Needed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{licenseSummary?.reviewNeeded || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring Soon</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{licenseSummary?.expiringIn30Days || 0}</div></CardContent>
        </Card>
      </div>

      {(licenseSummary?.nonCompliant || 0) > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-800">License Compliance Alert</h3>
              <p className="text-red-700">{licenseSummary?.nonCompliant} model(s) have non-compliant licenses.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="licenses">Licenses</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Categories</option>
              <option value="scientific_protein">ðŸ§¬ Protein Folding</option>
              <option value="vision_detection">ðŸ‘ï¸ Object Detection</option>
              <option value="audio_stt">ðŸŽ¤ Speech-to-Text</option>
              <option value="medical_imaging">ðŸ¥ Medical Imaging</option>
              <option value="llm">ðŸ¤– LLM</option>
            </select>
          </div>

          <ModelTable 
            models={filteredModels} 
            isLoading={isLoading}
            onEdit={setEditingModel}
            onDelete={(id) => confirm('Delete model?') && deleteModelMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="licenses"><LicensePanel /></TabsContent>
        <TabsContent value="workflows"><p className="text-muted-foreground">Workflow management coming soon...</p></TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 35.2 API ENDPOINTS

### packages/lambda/admin/orchestration.ts

```typescript
/**
 * RADIANT v4.1.0 - Admin Orchestration API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { getOrchestrationEngine } from '@radiant/services/orchestration';
import { requirePermission } from '../auth/permissions';
import { createResponse, createErrorResponse } from '../utils/response';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const listModels: APIGatewayProxyHandler = async (event) => {
  try {
    await requirePermission(event, 'models:read');
    const { category, status, minTier, providerType } = event.queryStringParameters || {};
    const engine = getOrchestrationEngine(pool);
    const models = await engine.listModels({ category, status, minTier: minTier ? parseInt(minTier) : undefined, providerType });
    return createResponse(200, models);
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const getModel: APIGatewayProxyHandler = async (event) => {
  try {
    await requirePermission(event, 'models:read');
    const modelId = event.pathParameters?.modelId;
    if (!modelId) return createResponse(400, { error: 'Model ID required' });
    
    const engine = getOrchestrationEngine(pool);
    const model = await engine.getModelConfig(modelId);
    if (!model) return createResponse(404, { error: 'Model not found' });
    return createResponse(200, model);
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const createModel: APIGatewayProxyHandler = async (event) => {
  try {
    const admin = await requirePermission(event, 'models:write');
    const data = JSON.parse(event.body || '{}');
    const engine = getOrchestrationEngine(pool);
    const modelUuid = await engine.createModel(data, admin.id);
    return createResponse(201, { id: modelUuid, modelId: data.modelId, message: 'Model created' });
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const updateModel: APIGatewayProxyHandler = async (event) => {
  try {
    const admin = await requirePermission(event, 'models:write');
    const modelId = event.pathParameters?.modelId;
    if (!modelId) return createResponse(400, { error: 'Model ID required' });
    
    const updates = JSON.parse(event.body || '{}');
    const engine = getOrchestrationEngine(pool);
    await engine.updateModel(modelId, updates, admin.id);
    return createResponse(200, { success: true });
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const deleteModel: APIGatewayProxyHandler = async (event) => {
  try {
    const admin = await requirePermission(event, 'models:write');
    const modelId = event.pathParameters?.modelId;
    if (!modelId) return createResponse(400, { error: 'Model ID required' });
    
    const engine = getOrchestrationEngine(pool);
    await engine.deleteModel(modelId, admin.id);
    return createResponse(200, { success: true });
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const getLicenseSummary: APIGatewayProxyHandler = async (event) => {
  try {
    await requirePermission(event, 'models:read');
    const engine = getOrchestrationEngine(pool);
    const summary = await engine.getLicenseSummary();
    return createResponse(200, summary);
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const listWorkflows: APIGatewayProxyHandler = async (event) => {
  try {
    await requirePermission(event, 'workflows:read');
    const result = await pool.query(`
      SELECT workflow_id, name, description, category, version, min_tier
      FROM workflow_definitions WHERE enabled = true ORDER BY category, name
    `);
    return createResponse(200, result.rows);
  } catch (error: any) {
    return createErrorResponse(error);
  }
};

export const executeWorkflow: APIGatewayProxyHandler = async (event) => {
  try {
    const admin = await requirePermission(event, 'workflows:execute');
    const workflowId = event.pathParameters?.workflowId;
    if (!workflowId) return createResponse(400, { error: 'Workflow ID required' });
    
    const { tenantId, userId, parameters } = JSON.parse(event.body || '{}');
    const engine = getOrchestrationEngine(pool);
    const executionId = await engine.executeWorkflow(workflowId, tenantId, userId, parameters);
    return createResponse(202, { executionId, status: 'started' });
  } catch (error: any) {
    return createErrorResponse(error);
  }
};
```

---

## 35.3 VERIFICATION COMMANDS

```bash
# Apply orchestration migration
psql $DATABASE_URL -f packages/database/migrations/034_orchestration_engine.sql

# Apply AlphaFold 2 seed data
psql $DATABASE_URL -f packages/database/migrations/034a_seed_alphafold2.sql

# Verify AlphaFold 2 is in registry
psql $DATABASE_URL -c "SELECT model_id, display_name, status FROM ai_models WHERE model_id = 'alphafold2'"

# Verify licenses
psql $DATABASE_URL -c "SELECT m.display_name, l.license_spdx, l.commercial_use FROM model_licenses l JOIN ai_models m ON l.model_id = m.id WHERE m.model_id = 'alphafold2'"

# Test get_model_config function
psql $DATABASE_URL -c "SELECT get_model_config('alphafold2')" | head -50

# Test get_workflow_config function
psql $DATABASE_URL -c "SELECT get_workflow_config('protein_folding_alphafold2')" | head -50

# Verify audit log is recording
psql $DATABASE_URL -c "SELECT entity_type, action, change_summary, created_at FROM orchestration_audit_log ORDER BY created_at DESC LIMIT 5"
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 36: UNIFIED MODEL REGISTRY & SYNC SERVICE (v4.2.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Section 36 of 37** | Depends on: Sections 0-35 | Creates: Unified registry, sync service, complete model catalog

## 36.1 OVERVIEW

This section creates:
1. **Unified Model Registry** - SQL view combining ALL 106 models (50+ external + 56 self-hosted)
2. **Registry Sync Service** - Automated Lambda for provider/model synchronization
3. **Complete Self-Hosted Model Catalog** - 56 models with full metadata
4. **Orchestration Model Selection** - Smart selection algorithm with thermal awareness
5. **Health Monitoring** - Provider/endpoint health tracking

---

## 36.2 DATABASE SCHEMA

### packages/database/migrations/036_unified_model_registry.sql

```sql
-- ============================================================================
-- RADIANT v4.2.0 - Unified Model Registry Migration
-- ============================================================================
-- Combines external providers (21) and self-hosted models (56+) into single view
-- Provides orchestration engine with complete model selection metadata
-- ============================================================================

-- ============================================================================
-- SELF-HOSTED MODELS CATALOG (56 models)
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_hosted_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Categorization
    category VARCHAR(50) NOT NULL,  -- vision, audio, scientific, medical, geospatial, 3d, llm
    specialty VARCHAR(50) NOT NULL, -- object_detection, protein_folding, etc.
    
    -- Capabilities & Modalities
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    input_modalities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    output_modalities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    primary_mode VARCHAR(20) NOT NULL DEFAULT 'inference',
    
    -- SageMaker Configuration
    sagemaker_image VARCHAR(500) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    gpu_memory_gb INTEGER NOT NULL,
    environment JSONB NOT NULL DEFAULT '{}',
    model_data_url TEXT,
    
    -- Model Specs
    parameters BIGINT,
    accuracy VARCHAR(100),
    benchmark VARCHAR(255),
    context_window INTEGER,
    max_output INTEGER,
    
    -- I/O Formats
    input_formats TEXT[] NOT NULL DEFAULT '{}',
    output_formats TEXT[] NOT NULL DEFAULT '{}',
    
    -- Licensing
    license VARCHAR(100) NOT NULL,
    license_url TEXT,
    commercial_use_allowed BOOLEAN NOT NULL DEFAULT true,
    commercial_use_notes TEXT,
    attribution_required BOOLEAN NOT NULL DEFAULT false,
    
    -- Pricing (75% markup on SageMaker costs)
    hourly_rate DECIMAL(10,4) NOT NULL,
    per_request DECIMAL(10,6),
    per_image DECIMAL(10,6),
    per_minute_audio DECIMAL(10,6),
    per_minute_video DECIMAL(10,6),
    per_3d_model DECIMAL(10,4),
    markup_percent DECIMAL(5,2) NOT NULL DEFAULT 75.00,
    
    -- Tier Requirements
    min_tier INTEGER NOT NULL DEFAULT 3,  -- Self-hosted requires Tier 3+
    
    -- Thermal Defaults
    default_thermal_state VARCHAR(20) NOT NULL DEFAULT 'COLD',
    warmup_time_seconds INTEGER NOT NULL DEFAULT 60,
    scale_to_zero_minutes INTEGER NOT NULL DEFAULT 15,
    min_instances INTEGER NOT NULL DEFAULT 0,
    max_instances INTEGER NOT NULL DEFAULT 3,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    enabled BOOLEAN NOT NULL DEFAULT true,
    deprecated BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_self_hosted_category ON self_hosted_models(category);
CREATE INDEX idx_self_hosted_specialty ON self_hosted_models(specialty);
CREATE INDEX idx_self_hosted_status ON self_hosted_models(status);
CREATE INDEX idx_self_hosted_enabled ON self_hosted_models(enabled);

-- ============================================================================
-- PROVIDER HEALTH MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(50) NOT NULL REFERENCES providers(id),
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    
    -- Health Status
    status VARCHAR(20) NOT NULL DEFAULT 'unknown', -- healthy, degraded, unhealthy, unknown
    avg_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    error_rate DECIMAL(5, 2),
    success_rate DECIMAL(5, 2),
    
    -- Last Check
    last_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(provider_id, region)
);

CREATE INDEX idx_provider_health_provider ON provider_health(provider_id);
CREATE INDEX idx_provider_health_status ON provider_health(status);

-- ============================================================================
-- REGISTRY SYNC LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS registry_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type VARCHAR(50) NOT NULL, -- full, health, pricing, models
    
    -- Results
    providers_updated INTEGER NOT NULL DEFAULT 0,
    models_added INTEGER NOT NULL DEFAULT 0,
    models_updated INTEGER NOT NULL DEFAULT 0,
    models_deprecated INTEGER NOT NULL DEFAULT 0,
    errors TEXT[],
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, completed, failed
    error_message TEXT
);

CREATE INDEX idx_registry_sync_type ON registry_sync_log(sync_type);
CREATE INDEX idx_registry_sync_status ON registry_sync_log(status);
CREATE INDEX idx_registry_sync_started ON registry_sync_log(started_at DESC);

-- ============================================================================
-- UNIFIED MODEL REGISTRY VIEW
-- ============================================================================

CREATE OR REPLACE VIEW unified_model_registry AS
-- External Provider Models
SELECT 
    m.id::TEXT AS id,
    m.provider_id,
    p.display_name AS provider_name,
    m.model_id,
    m.litellm_id,
    m.name,
    m.display_name,
    m.description,
    
    -- Hosting Type
    'external' AS hosting_type,
    
    -- Category & Modality
    m.category,
    m.capabilities,
    m.input_modalities,
    m.output_modalities,
    
    -- Primary Mode (derived)
    CASE 
        WHEN 'chat' = ANY(m.capabilities) THEN 'chat'
        WHEN 'completion' = ANY(m.capabilities) THEN 'completion'
        WHEN 'embedding' = ANY(m.capabilities) OR m.category = 'embedding' THEN 'embedding'
        WHEN m.category = 'image_generation' THEN 'image'
        WHEN m.category = 'video_generation' THEN 'video'
        WHEN m.category IN ('audio_generation', 'text_to_speech') THEN 'audio'
        WHEN m.category = 'speech_to_text' THEN 'transcription'
        WHEN m.category = 'search' THEN 'search'
        WHEN m.category = '3d_generation' THEN '3d'
        ELSE 'other'
    END AS primary_mode,
    
    -- Context & Limits
    m.context_window,
    m.max_output,
    
    -- Pricing
    m.pricing_type,
    m.input_cost_per_1k,
    m.output_cost_per_1k,
    m.cost_per_request,
    m.cost_per_second,
    m.cost_per_image,
    m.cost_per_minute,
    m.markup_rate,
    
    -- Self-Hosted Specific (NULL for external)
    NULL::VARCHAR AS instance_type,
    NULL::INTEGER AS gpu_memory_gb,
    NULL::VARCHAR AS thermal_state,
    NULL::BOOLEAN AS is_transitioning,
    NULL::INTEGER AS warmup_time_seconds,
    
    -- Status
    m.enabled,
    m.deprecated,
    ph.status AS health_status,
    ph.avg_latency_ms,
    ph.error_rate,
    
    -- Compliance
    p.compliance,
    NULL::VARCHAR AS license,
    TRUE AS commercial_use_allowed,
    
    -- Tier
    1 AS min_tier,  -- External available to all tiers
    
    -- Timestamps
    m.created_at,
    m.updated_at

FROM models m
JOIN providers p ON m.provider_id = p.id
LEFT JOIN provider_health ph ON p.id = ph.provider_id AND ph.region = 'us-east-1'
WHERE m.enabled = true AND p.enabled = true

UNION ALL

-- Self-Hosted Models
SELECT 
    sh.id::TEXT AS id,
    'self_hosted' AS provider_id,
    'RADIANT Self-Hosted' AS provider_name,
    sh.model_id,
    'sagemaker/' || sh.model_id AS litellm_id,
    sh.name,
    sh.display_name,
    sh.description,
    
    -- Hosting Type
    'self_hosted' AS hosting_type,
    
    -- Category & Modality
    sh.category,
    sh.capabilities,
    sh.input_modalities,
    sh.output_modalities,
    sh.primary_mode,
    
    -- Context & Limits
    sh.context_window,
    sh.max_output,
    
    -- Pricing
    'per_hour'::VARCHAR AS pricing_type,
    NULL::NUMERIC AS input_cost_per_1k,
    NULL::NUMERIC AS output_cost_per_1k,
    sh.per_request AS cost_per_request,
    NULL::NUMERIC AS cost_per_second,
    sh.per_image AS cost_per_image,
    sh.per_minute_audio AS cost_per_minute,
    sh.markup_percent / 100 AS markup_rate,
    
    -- Self-Hosted Specific
    sh.instance_type,
    sh.gpu_memory_gb,
    ts.current_state AS thermal_state,
    ts.is_transitioning,
    sh.warmup_time_seconds,
    
    -- Status
    sh.enabled,
    sh.deprecated,
    CASE WHEN ts.current_state IN ('WARM', 'HOT') THEN 'healthy' ELSE 'unknown' END AS health_status,
    NULL::INTEGER AS avg_latency_ms,
    NULL::NUMERIC AS error_rate,
    
    -- Compliance
    ARRAY[]::TEXT[] AS compliance,
    sh.license,
    sh.commercial_use_allowed,
    
    -- Tier
    sh.min_tier,
    
    -- Timestamps
    sh.created_at,
    sh.updated_at

FROM self_hosted_models sh
LEFT JOIN thermal_states ts ON sh.model_id = ts.model_id
WHERE sh.enabled = true;

-- Index on the view (for performance)
CREATE INDEX IF NOT EXISTS idx_models_hosting_type ON models((CASE WHEN is_self_hosted THEN 'self_hosted' ELSE 'external' END));

-- ============================================================================
-- MODEL SELECTION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION select_model(
    p_task VARCHAR(20),
    p_input_modalities TEXT[],
    p_output_modalities TEXT[],
    p_tenant_tier INTEGER,
    p_prefer_hosting VARCHAR(20) DEFAULT 'any',
    p_required_capabilities TEXT[] DEFAULT '{}'::TEXT[],
    p_min_context_window INTEGER DEFAULT NULL,
    p_require_hipaa BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    model_id VARCHAR,
    display_name VARCHAR,
    hosting_type VARCHAR,
    provider_name VARCHAR,
    primary_mode VARCHAR,
    thermal_state VARCHAR,
    warmup_required BOOLEAN,
    warmup_time_seconds INTEGER,
    health_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.model_id,
        u.display_name,
        u.hosting_type,
        u.provider_name,
        u.primary_mode,
        u.thermal_state,
        (u.hosting_type = 'self_hosted' AND u.thermal_state = 'COLD') AS warmup_required,
        u.warmup_time_seconds,
        u.health_status
    FROM unified_model_registry u
    WHERE 
        -- Task/mode match
        u.primary_mode = p_task
        -- Modality match
        AND p_input_modalities <@ u.input_modalities
        AND p_output_modalities <@ u.output_modalities
        -- Tier eligibility
        AND u.min_tier <= p_tenant_tier
        -- Not unhealthy
        AND (u.health_status IS NULL OR u.health_status != 'unhealthy')
        -- Hosting preference
        AND (p_prefer_hosting = 'any' OR u.hosting_type = p_prefer_hosting)
        -- Required capabilities
        AND (p_required_capabilities = '{}'::TEXT[] OR p_required_capabilities <@ u.capabilities)
        -- Context window
        AND (p_min_context_window IS NULL OR u.context_window >= p_min_context_window)
        -- HIPAA compliance
        AND (NOT p_require_hipaa OR 'HIPAA' = ANY(u.compliance))
    ORDER BY 
        -- Prefer HOT > WARM > COLD for latency
        CASE u.thermal_state
            WHEN 'HOT' THEN 0
            WHEN 'WARM' THEN 1
            WHEN 'COLD' THEN 2
            ELSE 3
        END,
        -- Then by latency
        u.avg_latency_ms ASC NULLS LAST,
        -- Then by health
        CASE u.health_status
            WHEN 'healthy' THEN 0
            WHEN 'degraded' THEN 1
            ELSE 2
        END
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_self_hosted_models_updated_at
    BEFORE UPDATE ON self_hosted_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_health_updated_at
    BEFORE UPDATE ON provider_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA INSERT
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_by) 
VALUES ('036', 'unified_model_registry', 'system')
ON CONFLICT (version) DO NOTHING;
```

---

## 36.3 SELF-HOSTED MODEL SEED DATA

### packages/database/migrations/036a_seed_self_hosted_models.sql

```sql
-- ============================================================================
-- RADIANT v4.2.0 - Self-Hosted Models Seed Data (56 Models)
-- ============================================================================

-- ============================================================================
-- COMPUTER VISION MODELS (13 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_image, min_tier) VALUES

-- Classification (4)
('efficientnet-b0', 'efficientnet-b0', 'EfficientNet-B0', 'Lightweight image classification model', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 2, 5300000, '77.1% ImageNet Top-1', 'Apache-2.0', true, 1.30, 0.001, 3),
('efficientnetv2-l', 'efficientnetv2-l', 'EfficientNetV2-L', 'State-of-the-art classification with improved training efficiency', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 118000000, '85.7% ImageNet Top-1', 'Apache-2.0', true, 2.47, 0.002, 3),
('convnext-xl', 'convnext-xl', 'ConvNeXt-XL', 'Pure ConvNet achieving transformer-level performance', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 350000000, '87.8% ImageNet Top-1', 'Apache-2.0', true, 2.66, 0.003, 3),
('vit-l-14', 'vit-l-14', 'ViT-L/14', 'Vision Transformer Large with 14x14 patches', 'vision', 'classification', ARRAY['image_classification', 'feature_extraction'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 10, 304000000, '88.0% ImageNet Top-1', 'Apache-2.0', true, 2.66, 0.003, 3),

-- Detection (4)
('yolov8m', 'yolov8m', 'YOLOv8m', 'Medium YOLOv8 for real-time object detection', 'vision', 'detection', ARRAY['object_detection', 'real_time'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 25900000, '50.2% COCO mAP', 'AGPL-3.0', false, 1.30, 0.002, 3),
('yolov8x', 'yolov8x', 'YOLOv8x', 'Extra-large YOLOv8 for maximum accuracy', 'vision', 'detection', ARRAY['object_detection', 'high_accuracy'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 68200000, '53.9% COCO mAP', 'AGPL-3.0', false, 2.47, 0.003, 3),
('yolo11m', 'yolo11m', 'YOLO11m', 'Latest YOLO generation with improved architecture', 'vision', 'detection', ARRAY['object_detection', 'real_time'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 6, 20100000, '51.5% COCO mAP', 'AGPL-3.0', false, 2.47, 0.002, 3),
('detr-resnet-101', 'detr-resnet-101', 'DETR-ResNet-101', 'End-to-end transformer detector', 'vision', 'detection', ARRAY['object_detection', 'panoptic_segmentation'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 60000000, '44.9% COCO mAP', 'Apache-2.0', true, 2.47, 0.003, 3),

-- Segmentation (2)
('sam-vit-h', 'sam-vit-h', 'SAM-ViT-H', 'Segment Anything Model - ViT-Huge backbone', 'vision', 'segmentation', ARRAY['instance_segmentation', 'interactive'], ARRAY['image'], ARRAY['json', 'image'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 636000000, 'SOTA on zero-shot', 'Apache-2.0', true, 2.66, 0.005, 3),
('sam-2', 'sam-2', 'SAM 2', 'Segment Anything Model 2 - video and image segmentation', 'vision', 'segmentation', ARRAY['instance_segmentation', 'video_segmentation', 'interactive'], ARRAY['image', 'video'], ARRAY['json', 'image'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 800000000, 'SOTA video segmentation', 'Apache-2.0', true, 3.55, 0.008, 3),

-- Embedding (1)
('clip-vit-l', 'clip-vit-l', 'CLIP-ViT-L', 'Contrastive Language-Image Pre-training', 'vision', 'embedding', ARRAY['image_embedding', 'text_embedding', 'zero_shot'], ARRAY['image', 'text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 428000000, 'SOTA zero-shot classification', 'MIT', true, 2.47, 0.001, 3),

-- OCR (2)
('paddleocr-v4', 'paddleocr-v4', 'PaddleOCR-v4', 'Multi-language OCR with detection and recognition', 'vision', 'ocr', ARRAY['text_detection', 'text_recognition', 'multilingual'], ARRAY['image'], ARRAY['json', 'text'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 15000000, '95%+ accuracy', 'Apache-2.0', true, 1.30, 0.002, 3),
('trocr-large', 'trocr-large', 'TrOCR-Large', 'Transformer-based OCR for handwritten text', 'vision', 'ocr', ARRAY['text_recognition', 'handwriting'], ARRAY['image'], ARRAY['text'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 558000000, 'SOTA handwriting', 'MIT', true, 2.47, 0.003, 3);

-- ============================================================================
-- AUDIO/SPEECH MODELS (6 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_minute_audio, min_tier) VALUES

('whisper-large-v3', 'whisper-large-v3', 'Whisper-Large-v3', 'OpenAI multilingual speech recognition', 'audio', 'stt', ARRAY['transcription', 'translation', 'language_detection'], ARRAY['audio'], ARRAY['text', 'json'], 'transcription', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 10, 1550000000, '4.2% WER', 'MIT', true, 2.66, 0.006, 3),
('whisper-large-v3-turbo', 'whisper-large-v3-turbo', 'Whisper-Large-v3-Turbo', 'Faster Whisper with minimal accuracy loss', 'audio', 'stt', ARRAY['transcription', 'fast'], ARRAY['audio'], ARRAY['text', 'json'], 'transcription', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 6, 809000000, '5.0% WER', 'MIT', true, 2.47, 0.004, 3),
('wav2vec2-xlsr-53', 'wav2vec2-xlsr-53', 'Wav2Vec2-XLSR-53', 'Cross-lingual speech representation', 'audio', 'stt', ARRAY['transcription', 'multilingual', 'self_supervised'], ARRAY['audio'], ARRAY['text'], 'transcription', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 317000000, 'Multilingual', 'MIT', true, 2.47, 0.005, 3),
('titanet-l', 'titanet-l', 'TitaNet-L', 'NVIDIA speaker embedding and verification', 'audio', 'speaker_id', ARRAY['speaker_embedding', 'speaker_verification'], ARRAY['audio'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 23000000, '99%+ accuracy', 'Apache-2.0', true, 1.30, 0.003, 3),
('pyannote-diarization-3.1', 'pyannote-diarization-3.1', 'pyannote Speaker Diarization 3.1', 'State-of-the-art speaker diarization', 'audio', 'diarization', ARRAY['speaker_diarization', 'vad'], ARRAY['audio'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 6, 50000000, 'SOTA diarization', 'MIT', true, 2.47, 0.005, 3),
('speecht5-tts', 'speecht5-tts', 'SpeechT5 TTS', 'Microsoft text-to-speech synthesis', 'audio', 'tts', ARRAY['text_to_speech', 'voice_synthesis'], ARRAY['text'], ARRAY['audio'], 'audio', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 143000000, 'Natural voice', 'MIT', true, 1.30, 0.004, 3);

-- ============================================================================
-- SCIENTIFIC COMPUTING MODELS (8 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_request, min_tier) VALUES

('alphafold2', 'alphafold2', 'AlphaFold 2', 'Nobel Prize-winning protein structure prediction', 'scientific', 'protein_folding', ARRAY['protein_folding', 'structure_prediction'], ARRAY['sequence'], ARRAY['pdb', 'json'], 'inference', 'alphafold2:2.3.2-gpu', 'ml.g5.12xlarge', 96, 93000000, '92.4 GDT (CASP14)', 'Apache-2.0', true, 14.28, 2.50, 4),
('esm2-650m', 'esm2-650m', 'ESM-2 (650M)', 'Meta protein language model - medium', 'scientific', 'protein_embedding', ARRAY['protein_embedding', 'structure_prediction'], ARRAY['sequence'], ARRAY['embedding', 'json'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 650000000, 'SOTA embeddings', 'MIT', true, 2.66, 0.05, 3),
('esm2-3b', 'esm2-3b', 'ESM-2 (3B)', 'Meta protein language model - large', 'scientific', 'protein_embedding', ARRAY['protein_embedding', 'structure_prediction'], ARRAY['sequence'], ARRAY['embedding', 'json'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.12xlarge', 48, 3000000000, 'SOTA embeddings', 'MIT', true, 14.28, 0.15, 4),
('esmfold', 'esmfold', 'ESMFold', 'Single-sequence protein structure prediction', 'scientific', 'protein_folding', ARRAY['protein_folding', 'fast'], ARRAY['sequence'], ARRAY['pdb', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 20, 700000000, 'Near AlphaFold2', 'MIT', true, 3.55, 0.50, 3),
('rosettafold2', 'rosettafold2', 'RoseTTAFold2', 'Protein complex structure prediction', 'scientific', 'protein_complex', ARRAY['protein_folding', 'complex_prediction'], ARRAY['sequence'], ARRAY['pdb', 'json'], 'inference', 'rosettafold2:latest-gpu', 'ml.p4d.24xlarge', 160, 100000000, 'SOTA complexes', 'BSD-3-Clause', true, 57.35, 5.00, 5),
('alphageometry', 'alphageometry', 'AlphaGeometry', 'Olympiad-level geometry reasoning', 'scientific', 'math_reasoning', ARRAY['geometry_reasoning', 'theorem_proving'], ARRAY['text'], ARRAY['text', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 270000000, 'IMO Silver level', 'Apache-2.0', true, 2.66, 0.10, 3),
('muzero', 'muzero', 'MuZero', 'DeepMind model-based planning', 'scientific', 'planning', ARRAY['planning', 'game_playing', 'decision_making'], ARRAY['state'], ARRAY['action', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 50000000, 'Superhuman games', 'Apache-2.0', true, 3.55, 0.05, 4),
('graphormer', 'graphormer', 'Graphormer', 'Transformer for molecular property prediction', 'scientific', 'molecular', ARRAY['molecular_property', 'graph_learning'], ARRAY['smiles', 'graph'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 47000000, 'SOTA molecular', 'MIT', true, 2.47, 0.02, 3);

-- ============================================================================
-- MEDICAL IMAGING MODELS (6 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_image, min_tier) VALUES

('nnunet', 'nnunet', 'nnU-Net', 'Self-configuring medical image segmentation', 'medical', 'segmentation', ARRAY['medical_segmentation', 'auto_configure'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'nnunet:v2-gpu', 'ml.g5.4xlarge', 16, 31000000, 'SOTA 23+ challenges', 'Apache-2.0', true, 3.55, 0.05, 4),
('medsam', 'medsam', 'MedSAM', 'Segment Anything for Medical Images', 'medical', 'segmentation', ARRAY['medical_segmentation', 'interactive', 'universal'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 93000000, 'Universal medical', 'Apache-2.0', true, 2.66, 0.03, 3),
('med-sam2', 'med-sam2', 'Med-SAM2', 'Medical SAM 2 for 3D and video', 'medical', 'segmentation', ARRAY['medical_segmentation', '3d_segmentation', 'video'], ARRAY['image', 'video'], ARRAY['image', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 150000000, 'SOTA 3D medical', 'Apache-2.0', true, 3.55, 0.05, 4),
('biomedclip', 'biomedclip', 'BiomedCLIP', 'Medical image-text embeddings', 'medical', 'embedding', ARRAY['medical_embedding', 'image_text', 'zero_shot'], ARRAY['image', 'text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 400000000, 'SOTA medical CLIP', 'MIT', true, 2.47, 0.01, 3),
('chexnet', 'chexnet', 'CheXNet', 'Chest X-ray pathology detection', 'medical', 'classification', ARRAY['chest_xray', 'pathology_detection'], ARRAY['image'], ARRAY['json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 4, 7000000, 'Radiologist-level', 'MIT', true, 1.30, 0.01, 3),
('monai-vista3d', 'monai-vista3d', 'MONAI VISTA-3D', '3D medical image segmentation foundation', 'medical', 'segmentation', ARRAY['3d_segmentation', 'ct', 'mri'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'monai:1.3-gpu', 'ml.g5.12xlarge', 48, 200000000, 'SOTA 3D', 'Apache-2.0', true, 14.28, 0.10, 4);

-- ============================================================================
-- GEOSPATIAL MODELS (4 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_image, min_tier) VALUES

('prithvi-100m', 'prithvi-100m', 'Prithvi-100M', 'NASA/IBM geospatial foundation model', 'geospatial', 'foundation', ARRAY['satellite_analysis', 'multi_temporal', 'change_detection'], ARRAY['image'], ARRAY['embedding', 'json'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 100000000, 'SOTA satellite', 'Apache-2.0', true, 2.47, 0.02, 3),
('prithvi-600m', 'prithvi-600m', 'Prithvi-600M', 'NASA/IBM large geospatial model', 'geospatial', 'foundation', ARRAY['satellite_analysis', 'multi_temporal', 'segmentation'], ARRAY['image'], ARRAY['embedding', 'image'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.4xlarge', 16, 600000000, 'SOTA satellite', 'Apache-2.0', true, 3.55, 0.05, 4),
('satmae', 'satmae', 'SatMAE', 'Self-supervised satellite image analysis', 'geospatial', 'foundation', ARRAY['satellite_analysis', 'self_supervised'], ARRAY['image'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 300000000, 'Strong transfer', 'MIT', true, 2.66, 0.03, 3),
('geosam', 'geosam', 'GeoSAM', 'Segment Anything for geospatial', 'geospatial', 'segmentation', ARRAY['satellite_segmentation', 'interactive'], ARRAY['image'], ARRAY['image', 'json'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 93000000, 'SOTA geo', 'Apache-2.0', true, 2.66, 0.03, 3);

-- ============================================================================
-- 3D/RECONSTRUCTION MODELS (5 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_3d_model, min_tier) VALUES

('nerfstudio-nerfacto', 'nerfstudio-nerfacto', 'Nerfstudio Nerfacto', 'Real-time NeRF scene reconstruction', '3d', 'nerf', ARRAY['nerf', 'scene_reconstruction'], ARRAY['image'], ARRAY['mesh', 'video'], 'inference', 'nerfstudio:0.3-gpu', 'ml.g5.4xlarge', 16, 5000000, 'High quality NeRF', 'Apache-2.0', true, 3.55, 1.00, 4),
('3dgs', '3dgs', '3D Gaussian Splatting', 'Real-time radiance field rendering', '3d', 'splatting', ARRAY['gaussian_splatting', 'real_time_rendering'], ARRAY['image'], ARRAY['splat', 'video'], 'inference', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 12, 1000000, 'SOTA real-time', 'INRIA', true, 2.66, 0.50, 3),
('instant-ngp', 'instant-ngp', 'Instant-NGP', 'NVIDIA instant neural graphics primitives', '3d', 'nerf', ARRAY['nerf', 'fast_training'], ARRAY['image'], ARRAY['mesh', 'video'], 'inference', 'instant-ngp:latest-gpu', 'ml.g5.2xlarge', 10, 2000000, 'Fast NeRF', 'NVIDIA', true, 2.66, 0.30, 3),
('point-e', 'point-e', 'Point-E', 'OpenAI text-to-3D point cloud', '3d', 'generation', ARRAY['text_to_3d', 'point_cloud'], ARRAY['text'], ARRAY['ply', 'json'], '3d', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 40000000, 'Fast text-to-3D', 'MIT', true, 2.47, 0.20, 3),
('shap-e', 'shap-e', 'Shap-E', 'OpenAI text/image to 3D mesh', '3d', 'generation', ARRAY['text_to_3d', 'image_to_3d', 'mesh_generation'], ARRAY['text', 'image'], ARRAY['obj', 'glb'], '3d', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 8, 300000000, '3D asset generation', 'MIT', true, 2.47, 0.25, 3);

-- ============================================================================
-- LLM/EMBEDDINGS MODELS (14 models)
-- ============================================================================

INSERT INTO self_hosted_models (model_id, name, display_name, description, category, specialty, capabilities, input_modalities, output_modalities, primary_mode, sagemaker_image, instance_type, gpu_memory_gb, context_window, max_output, parameters, accuracy, license, commercial_use_allowed, hourly_rate, per_request, min_tier) VALUES

-- Large LLMs
('llama-3.3-70b', 'llama-3.3-70b', 'Llama 3.3 70B', 'Meta latest flagship LLM', 'llm', 'chat', ARRAY['chat', 'reasoning', 'function_calling'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.48xlarge', 160, 128000, 8192, 70000000000, 'SOTA open', 'Llama-3.3', true, 35.63, 0.05, 5),
('llama-3.2-11b-vision', 'llama-3.2-11b-vision', 'Llama 3.2 11B Vision', 'Meta multimodal LLM', 'llm', 'vision_chat', ARRAY['chat', 'vision', 'reasoning'], ARRAY['text', 'image'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.12xlarge', 48, 128000, 4096, 11000000000, 'SOTA vision', 'Llama-3.2', true, 14.28, 0.02, 4),
('mistral-7b-v0.3', 'mistral-7b-v0.3', 'Mistral 7B v0.3', 'Mistral efficient base model', 'llm', 'chat', ARRAY['chat', 'completion', 'function_calling'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.2xlarge', 16, 32000, 4096, 7000000000, 'Efficient 7B', 'Apache-2.0', true, 2.66, 0.005, 3),
('mixtral-8x7b', 'mixtral-8x7b', 'Mixtral 8x7B', 'Mistral mixture of experts', 'llm', 'chat', ARRAY['chat', 'completion', 'moe'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.12xlarge', 96, 32000, 4096, 46700000000, 'SOTA MoE', 'Apache-2.0', true, 14.28, 0.01, 4),
('qwen2.5-72b', 'qwen2.5-72b', 'Qwen2.5 72B', 'Alibaba flagship LLM', 'llm', 'chat', ARRAY['chat', 'reasoning', 'coding'], ARRAY['text'], ARRAY['text'], 'chat', 'huggingface-llm:2.0-gpu', 'ml.g5.48xlarge', 160, 128000, 8192, 72000000000, 'SOTA multilingual', 'Qwen', true, 35.63, 0.05, 5),

-- Code Models
('codellama-70b', 'codellama-70b', 'CodeLlama 70B', 'Meta code-specialized LLM', 'llm', 'code', ARRAY['code_generation', 'code_completion', 'infilling'], ARRAY['text'], ARRAY['text'], 'completion', 'huggingface-llm:2.0-gpu', 'ml.g5.48xlarge', 160, 100000, 16384, 70000000000, 'SOTA code', 'Llama-2', true, 35.63, 0.03, 5),
('starcoder2-15b', 'starcoder2-15b', 'StarCoder2 15B', 'BigCode multi-language code model', 'llm', 'code', ARRAY['code_generation', 'code_completion', 'multi_language'], ARRAY['text'], ARRAY['text'], 'completion', 'huggingface-llm:2.0-gpu', 'ml.g5.4xlarge', 32, 16000, 8192, 15000000000, 'Strong code', 'BigCode-OpenRAIL-M', true, 3.55, 0.008, 4),
('deepseek-coder-33b', 'deepseek-coder-33b', 'DeepSeek Coder 33B', 'DeepSeek coding specialist', 'llm', 'code', ARRAY['code_generation', 'code_completion'], ARRAY['text'], ARRAY['text'], 'completion', 'huggingface-llm:2.0-gpu', 'ml.g5.12xlarge', 72, 16000, 8192, 33000000000, 'SOTA code', 'DeepSeek', true, 14.28, 0.015, 4),

-- Embeddings
('bge-large-en', 'bge-large-en', 'BGE-Large-EN', 'BAAI general embedding model', 'llm', 'embedding', ARRAY['text_embedding', 'retrieval'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 2, 512, NULL, 335000000, 'SOTA MTEB', 'MIT', true, 1.30, 0.0005, 3),
('bge-m3', 'bge-m3', 'BGE-M3', 'Multi-lingual multi-function embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'multilingual', 'sparse_embedding'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 4, 8192, NULL, 568000000, 'SOTA multilingual', 'MIT', true, 2.47, 0.0008, 3),
('e5-mistral-7b', 'e5-mistral-7b', 'E5-Mistral-7B', 'Mistral-based embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'long_context'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 16, 32000, NULL, 7000000000, 'Strong long-context', 'MIT', true, 2.66, 0.002, 3),
('jina-embeddings-v3', 'jina-embeddings-v3', 'Jina Embeddings v3', 'Jina multi-task embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'multilingual', 'multimodal'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.xlarge', 4, 8192, NULL, 570000000, 'Versatile', 'Apache-2.0', true, 2.47, 0.0006, 3),
('mxbai-embed-large', 'mxbai-embed-large', 'mxbai-embed-large', 'Mixedbread high-quality embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'retrieval'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g4dn.xlarge', 2, 512, NULL, 335000000, 'High quality', 'Apache-2.0', true, 1.30, 0.0005, 3),
('gte-qwen2-7b', 'gte-qwen2-7b', 'GTE-Qwen2-7B', 'Alibaba instruction-tuned embeddings', 'llm', 'embedding', ARRAY['text_embedding', 'instruction_following'], ARRAY['text'], ARRAY['embedding'], 'embedding', 'pytorch-inference:2.1-transformers4.36-gpu-py310-cu121-ubuntu22.04', 'ml.g5.2xlarge', 16, 32000, NULL, 7000000000, 'SOTA instruction', 'Apache-2.0', true, 2.66, 0.002, 3);

-- Update schema migrations
INSERT INTO schema_migrations (version, name, applied_by) 
VALUES ('036a', 'seed_self_hosted_models', 'system')
ON CONFLICT (version) DO NOTHING;
```

---

## 36.4 REGISTRY SYNC SERVICE

### packages/infrastructure/lambda/registry-sync/handler.ts

```typescript
/**
 * RADIANT v4.2.0 - Registry Sync Service
 * 
 * Automated synchronization of model registry:
 * - Daily full sync of provider model lists
 * - 5-minute health checks for all providers
 * - Weekly pricing updates
 * - Self-hosted endpoint validation
 */

import { Pool } from 'pg';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SageMakerClient, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const eventBridge = new EventBridgeClient({});
const sagemaker = new SageMakerClient({});

// ============================================================================
// SYNC TYPES
// ============================================================================

type SyncType = 'full' | 'health' | 'pricing' | 'thermal';

interface SyncResult {
  syncId: string;
  type: SyncType;
  providersUpdated: number;
  modelsAdded: number;
  modelsUpdated: number;
  modelsDeprecated: number;
  errors: string[];
  durationMs: number;
}

// ============================================================================
// PROVIDER SYNC HANDLERS
// ============================================================================

async function syncProviderModels(providerId: string): Promise<{ added: number; updated: number }> {
  // Provider-specific model discovery
  switch (providerId) {
    case 'openai':
      return syncOpenAIModels();
    case 'anthropic':
      return syncAnthropicModels();
    case 'google':
      return syncGoogleModels();
    // ... other providers
    default:
      return { added: 0, updated: 0 };
  }
}

async function syncOpenAIModels(): Promise<{ added: number; updated: number }> {
  // OpenAI has a models endpoint
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
  });
  
  if (!response.ok) return { added: 0, updated: 0 };
  
  const data = await response.json();
  let added = 0, updated = 0;
  
  for (const model of data.data) {
    const existing = await pool.query(
      'SELECT id FROM models WHERE provider_id = $1 AND model_id = $2',
      ['openai', model.id]
    );
    
    if (existing.rows.length === 0) {
      // New model discovered - flag for admin review
      await pool.query(`
        INSERT INTO registry_sync_log (sync_type, status, error_message)
        VALUES ('models', 'pending_review', $1)
      `, [`New OpenAI model discovered: ${model.id}`]);
      added++;
    }
  }
  
  return { added, updated };
}

async function syncAnthropicModels(): Promise<{ added: number; updated: number }> {
  // Anthropic doesn't have a public models endpoint
  // Sync from known model list
  const KNOWN_ANTHROPIC_MODELS = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
  ];
  
  // Check for any unknown models in our database
  const result = await pool.query(
    'SELECT model_id FROM models WHERE provider_id = $1',
    ['anthropic']
  );
  
  const knownIds = new Set(KNOWN_ANTHROPIC_MODELS);
  let deprecated = 0;
  
  for (const row of result.rows) {
    if (!knownIds.has(row.model_id)) {
      // Model may be deprecated
      await pool.query(
        'UPDATE models SET deprecated = true WHERE provider_id = $1 AND model_id = $2',
        ['anthropic', row.model_id]
      );
      deprecated++;
    }
  }
  
  return { added: 0, updated: deprecated };
}

async function syncGoogleModels(): Promise<{ added: number; updated: number }> {
  // Google Gemini models
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`
    );
    
    if (!response.ok) return { added: 0, updated: 0 };
    
    const data = await response.json();
    // Process discovered models...
    return { added: 0, updated: 0 };
  } catch (error) {
    return { added: 0, updated: 0 };
  }
}

// ============================================================================
// HEALTH CHECK HANDLERS
// ============================================================================

async function checkProviderHealth(providerId: string): Promise<void> {
  const provider = await pool.query(
    'SELECT api_base_url FROM providers WHERE id = $1',
    [providerId]
  );
  
  if (provider.rows.length === 0) return;
  
  const startTime = Date.now();
  let status = 'healthy';
  let errorMessage: string | null = null;
  
  try {
    // Simple health check - ping the API
    const response = await fetch(`${provider.rows[0].api_base_url}/models`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      status = response.status >= 500 ? 'unhealthy' : 'degraded';
    }
  } catch (error: any) {
    status = 'unhealthy';
    errorMessage = error.message;
  }
  
  const latencyMs = Date.now() - startTime;
  
  await pool.query(`
    INSERT INTO provider_health (provider_id, status, avg_latency_ms, last_check_at, last_error)
    VALUES ($1, $2, $3, NOW(), $4)
    ON CONFLICT (provider_id, region) DO UPDATE SET
      status = EXCLUDED.status,
      avg_latency_ms = (provider_health.avg_latency_ms * 0.7 + EXCLUDED.avg_latency_ms * 0.3)::INTEGER,
      last_check_at = NOW(),
      last_success_at = CASE WHEN EXCLUDED.status = 'healthy' THEN NOW() ELSE provider_health.last_success_at END,
      last_failure_at = CASE WHEN EXCLUDED.status != 'healthy' THEN NOW() ELSE provider_health.last_failure_at END,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
  `, [providerId, status, latencyMs, errorMessage]);
}

async function checkSageMakerEndpoints(): Promise<void> {
  const models = await pool.query(
    'SELECT model_id FROM self_hosted_models WHERE enabled = true'
  );
  
  for (const model of models.rows) {
    try {
      const endpoint = await sagemaker.send(new DescribeEndpointCommand({
        EndpointName: `radiant-${model.model_id}`
      }));
      
      const status = endpoint.EndpointStatus === 'InService' ? 'WARM' : 
                     endpoint.EndpointStatus === 'Creating' ? 'COLD' : 'OFF';
      
      await pool.query(`
        UPDATE thermal_states SET 
          current_state = $1,
          is_transitioning = $2,
          updated_at = NOW()
        WHERE model_id = $3
      `, [status, endpoint.EndpointStatus === 'Creating', model.model_id]);
    } catch (error) {
      // Endpoint doesn't exist - model is OFF
      await pool.query(`
        UPDATE thermal_states SET 
          current_state = 'OFF',
          is_transitioning = false,
          updated_at = NOW()
        WHERE model_id = $1
      `, [model.model_id]);
    }
  }
}

// ============================================================================
// MAIN SYNC HANDLER
// ============================================================================

export async function handler(event: any): Promise<SyncResult> {
  const syncType: SyncType = event.syncType || 'full';
  const startTime = Date.now();
  
  // Create sync log entry
  const logResult = await pool.query(`
    INSERT INTO registry_sync_log (sync_type, status)
    VALUES ($1, 'running')
    RETURNING id
  `, [syncType]);
  const syncId = logResult.rows[0].id;
  
  let providersUpdated = 0;
  let modelsAdded = 0;
  let modelsUpdated = 0;
  let modelsDeprecated = 0;
  const errors: string[] = [];
  
  try {
    // Get all enabled providers
    const providers = await pool.query(
      'SELECT id FROM providers WHERE enabled = true'
    );
    
    for (const provider of providers.rows) {
      try {
        switch (syncType) {
          case 'full':
            const result = await syncProviderModels(provider.id);
            modelsAdded += result.added;
            modelsUpdated += result.updated;
            await checkProviderHealth(provider.id);
            providersUpdated++;
            break;
            
          case 'health':
            await checkProviderHealth(provider.id);
            providersUpdated++;
            break;
            
          case 'pricing':
            // Pricing sync - use Section 31 pricing endpoints
            // POST /api/admin/models/{id}/pricing to update
            // await this.syncModelPricing(model.id, pricingData);
            break;
        }
      } catch (error: any) {
        errors.push(`${provider.id}: ${error.message}`);
      }
    }
    
    // Check self-hosted endpoints for thermal sync
    if (syncType === 'thermal' || syncType === 'full') {
      await checkSageMakerEndpoints();
    }
    
    // Refresh materialized view if exists
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY unified_model_stats')
      .catch(() => {}); // Ignore if view doesn't exist
    
    const durationMs = Date.now() - startTime;
    
    // Update sync log
    await pool.query(`
      UPDATE registry_sync_log SET
        status = 'completed',
        providers_updated = $1,
        models_added = $2,
        models_updated = $3,
        models_deprecated = $4,
        errors = $5,
        completed_at = NOW(),
        duration_ms = $6
      WHERE id = $7
    `, [providersUpdated, modelsAdded, modelsUpdated, modelsDeprecated, errors, durationMs, syncId]);
    
    // Emit completion event
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'radiant.registry',
        DetailType: 'RegistrySyncCompleted',
        Detail: JSON.stringify({
          syncId,
          syncType,
          providersUpdated,
          modelsAdded,
          modelsUpdated,
          modelsDeprecated,
          durationMs,
          errors
        })
      }]
    }));
    
    return {
      syncId,
      type: syncType,
      providersUpdated,
      modelsAdded,
      modelsUpdated,
      modelsDeprecated,
      errors,
      durationMs
    };
    
  } catch (error: any) {
    await pool.query(`
      UPDATE registry_sync_log SET
        status = 'failed',
        error_message = $1,
        completed_at = NOW()
      WHERE id = $2
    `, [error.message, syncId]);
    
    throw error;
  }
}
```

---

## 36.5 CDK INFRASTRUCTURE

### packages/infrastructure/lib/stacks/registry-sync-stack.ts

```typescript
/**
 * RADIANT v4.2.0 - Registry Sync CDK Stack
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface RegistrySyncStackProps extends cdk.StackProps {
  databaseUrl: string;
  vpcId: string;
}

export class RegistrySyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RegistrySyncStackProps) {
    super(scope, id, props);

    // Registry Sync Lambda
    const syncLambda = new lambda.Function(this, 'RegistrySyncLambda', {
      functionName: 'radiant-registry-sync',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/registry-sync'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        DATABASE_URL: props.databaseUrl,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
      },
    });

    // Daily full sync (00:00 UTC)
    new events.Rule(this, 'DailyFullSync', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'full' })
      })],
    });

    // Health check every 5 minutes
    new events.Rule(this, 'HealthCheck', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'health' })
      })],
    });

    // Thermal state sync every 5 minutes
    new events.Rule(this, 'ThermalSync', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'thermal' })
      })],
    });

    // Weekly pricing sync (Sunday 00:00 UTC)
    new events.Rule(this, 'WeeklyPricingSync', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0', weekDay: 'SUN' }),
      targets: [new targets.LambdaFunction(syncLambda, {
        event: events.RuleTargetInput.fromObject({ syncType: 'pricing' })
      })],
    });
  }
}
```

---

## 36.6 ORCHESTRATION ENGINE MODEL SELECTION

### packages/infrastructure/lambda/orchestration/model-selector.ts

```typescript
/**
 * RADIANT v4.2.0 - Orchestration Model Selection
 * 
 * Smart model selection using unified registry with:
 * - Thermal state awareness (prefer HOT > WARM > COLD)
 * - Health status filtering
 * - Tier-based eligibility
 * - Capability matching
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================================================
// TYPES
// ============================================================================

export interface ModelSelectionCriteria {
  // Required
  task: 'chat' | 'completion' | 'embedding' | 'image' | 'video' | 'audio' | 'transcription' | 'search' | '3d' | 'inference';
  inputModality: string[];
  outputModality: string[];
  
  // Tenant context
  tenantTier: 1 | 2 | 3 | 4 | 5;
  
  // Preferences
  preferHosting?: 'external' | 'self_hosted' | 'any';
  preferProvider?: string[];
  maxLatencyMs?: number;
  maxCostPerRequest?: number;
  
  // Requirements
  requiredCapabilities?: string[];
  minContextWindow?: number;
  requireHIPAA?: boolean;
}

export interface SelectedModel {
  modelId: string;
  displayName: string;
  hostingType: 'external' | 'self_hosted';
  providerName: string;
  primaryMode: string;
  thermalState: string | null;
  warmupRequired: boolean;
  warmupTimeSeconds: number | null;
  healthStatus: string;
  litellmId: string;
}

// ============================================================================
// MODEL SELECTOR
// ============================================================================

export class ModelSelector {
  async selectModel(criteria: ModelSelectionCriteria): Promise<SelectedModel | null> {
    // Use the database function for initial selection
    const result = await pool.query(`
      SELECT * FROM select_model($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      criteria.task,
      criteria.inputModality,
      criteria.outputModality,
      criteria.tenantTier,
      criteria.preferHosting || 'any',
      criteria.requiredCapabilities || [],
      criteria.minContextWindow || null,
      criteria.requireHIPAA || false
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const selected = result.rows[0];
    
    // Get full model details
    const modelDetails = await pool.query(`
      SELECT litellm_id FROM unified_model_registry 
      WHERE model_id = $1
    `, [selected.model_id]);

    return {
      modelId: selected.model_id,
      displayName: selected.display_name,
      hostingType: selected.hosting_type,
      providerName: selected.provider_name,
      primaryMode: selected.primary_mode,
      thermalState: selected.thermal_state,
      warmupRequired: selected.warmup_required,
      warmupTimeSeconds: selected.warmup_time_seconds,
      healthStatus: selected.health_status || 'unknown',
      litellmId: modelDetails.rows[0]?.litellm_id || selected.model_id
    };
  }

  async selectWithFallback(criteria: ModelSelectionCriteria): Promise<SelectedModel> {
    // Try primary selection
    const primary = await this.selectModel(criteria);
    if (primary && !primary.warmupRequired) {
      return primary;
    }

    // If primary requires warmup, try to find a ready alternative
    if (primary?.warmupRequired) {
      const alternative = await this.selectModel({
        ...criteria,
        preferHosting: 'external' // External providers are always ready
      });
      
      if (alternative) {
        // Trigger warmup of self-hosted model in background
        this.triggerWarmup(primary.modelId);
        return alternative;
      }
    }

    // No alternatives - return primary (may require warmup)
    if (primary) {
      return primary;
    }

    // Fallback to default model for task
    return this.getDefaultModel(criteria.task, criteria.tenantTier);
  }

  private async triggerWarmup(modelId: string): Promise<void> {
    // Trigger warmup via thermal manager
    await pool.query(`
      UPDATE thermal_states SET 
        target_state = 'WARM',
        is_transitioning = true,
        updated_at = NOW()
      WHERE model_id = $1 AND current_state = 'COLD'
    `, [modelId]);
  }

  private async getDefaultModel(task: string, tier: number): Promise<SelectedModel> {
    // Default models by task
    const defaults: Record<string, string> = {
      'chat': 'gpt-4o-mini',
      'completion': 'gpt-4o-mini',
      'embedding': 'text-embedding-3-small',
      'image': 'dall-e-3',
      'video': 'runway-gen3-alpha-turbo',
      'audio': 'tts-1',
      'transcription': 'whisper-1',
      'search': 'perplexity-sonar',
      '3d': 'meshy-v3',
      'inference': 'gpt-4o'
    };

    const modelId = defaults[task] || 'gpt-4o-mini';
    
    const result = await pool.query(`
      SELECT * FROM unified_model_registry WHERE model_id = $1
    `, [modelId]);

    if (result.rows.length === 0) {
      throw new Error(`Default model ${modelId} not found in registry`);
    }

    const model = result.rows[0];
    return {
      modelId: model.model_id,
      displayName: model.display_name,
      hostingType: model.hosting_type,
      providerName: model.provider_name,
      primaryMode: model.primary_mode,
      thermalState: model.thermal_state,
      warmupRequired: false,
      warmupTimeSeconds: null,
      healthStatus: model.health_status || 'unknown',
      litellmId: model.litellm_id
    };
  }
}

export const modelSelector = new ModelSelector();
```

---

## 36.7 ADMIN API ENDPOINTS

### packages/infrastructure/lambda/admin/registry-admin.ts

```typescript
/**
 * RADIANT v4.2.0 - Registry Admin API
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const listAllModels: APIGatewayProxyHandler = async (event) => {
  const { category, hostingType, status } = event.queryStringParameters || {};
  
  let query = 'SELECT * FROM unified_model_registry WHERE 1=1';
  const params: any[] = [];
  
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  if (hostingType) {
    params.push(hostingType);
    query += ` AND hosting_type = $${params.length}`;
  }
  if (status) {
    params.push(status === 'enabled');
    query += ` AND enabled = $${params.length}`;
  }
  
  query += ' ORDER BY hosting_type, category, display_name';
  
  const result = await pool.query(query, params);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      total: result.rows.length,
      external: result.rows.filter(r => r.hosting_type === 'external').length,
      selfHosted: result.rows.filter(r => r.hosting_type === 'self_hosted').length,
      models: result.rows
    })
  };
};

export const getRegistryStats: APIGatewayProxyHandler = async () => {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE hosting_type = 'external') AS external_count,
      COUNT(*) FILTER (WHERE hosting_type = 'self_hosted') AS self_hosted_count,
      COUNT(*) FILTER (WHERE health_status = 'healthy') AS healthy_count,
      COUNT(*) FILTER (WHERE health_status = 'unhealthy') AS unhealthy_count,
      COUNT(*) FILTER (WHERE thermal_state = 'HOT') AS hot_count,
      COUNT(*) FILTER (WHERE thermal_state = 'WARM') AS warm_count,
      COUNT(*) FILTER (WHERE thermal_state = 'COLD') AS cold_count,
      COUNT(DISTINCT category) AS category_count,
      COUNT(DISTINCT provider_name) AS provider_count
    FROM unified_model_registry
  `);
  
  return {
    statusCode: 200,
    body: JSON.stringify(stats.rows[0])
  };
};

export const getSyncHistory: APIGatewayProxyHandler = async () => {
  const result = await pool.query(`
    SELECT * FROM registry_sync_log 
    ORDER BY started_at DESC 
    LIMIT 50
  `);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result.rows)
  };
};

export const triggerSync: APIGatewayProxyHandler = async (event) => {
  const { syncType } = JSON.parse(event.body || '{}');
  
  // Invoke sync lambda
  const lambda = require('@aws-sdk/client-lambda');
  const client = new lambda.LambdaClient({});
  
  await client.send(new lambda.InvokeCommand({
    FunctionName: 'radiant-registry-sync',
    InvocationType: 'Event',
    Payload: JSON.stringify({ syncType: syncType || 'full' })
  }));
  
  return {
    statusCode: 202,
    body: JSON.stringify({ message: 'Sync triggered', syncType })
  };
};
```

---

## 36.8 VERIFICATION COMMANDS

```bash
# Apply unified registry migration
psql $DATABASE_URL -f packages/database/migrations/036_unified_model_registry.sql

# Seed self-hosted models
psql $DATABASE_URL -f packages/database/migrations/036a_seed_self_hosted_models.sql

# Verify self-hosted models count (should be 56)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM self_hosted_models"

# Verify unified registry view works
psql $DATABASE_URL -c "SELECT COUNT(*), hosting_type FROM unified_model_registry GROUP BY hosting_type"

# Test model selection function
psql $DATABASE_URL -c "SELECT * FROM select_model('chat', ARRAY['text'], ARRAY['text'], 3, 'any', '{}', NULL, false)"

# Verify provider health table
psql $DATABASE_URL -c "SELECT provider_id, status, avg_latency_ms FROM provider_health"

# Check sync log
psql $DATABASE_URL -c "SELECT sync_type, status, providers_updated, models_added FROM registry_sync_log ORDER BY started_at DESC LIMIT 5"

# Test API endpoints
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://admin-api.example.com/api/v2/admin/registry/models

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://admin-api.example.com/api/v2/admin/registry/stats
```

---

## Section 36 Summary

RADIANT v4.2.0 (PROMPT-16) adds **Unified Model Registry & Sync Service**:

### Section 36: Unified Model Registry (v4.2.0)

1. **Database Schema** (036_unified_model_registry.sql)
   - `self_hosted_models` - Complete catalog of 56 SageMaker models
   - `provider_health` - Real-time health monitoring per provider
   - `registry_sync_log` - Sync operation history
   - `unified_model_registry` - SQL VIEW combining ALL 106 models
   - `select_model()` - Smart selection function with thermal awareness

2. **Self-Hosted Model Seed Data** (036a_seed_self_hosted_models.sql)
   - 13 Computer Vision models (EfficientNet, YOLO, SAM, CLIP, etc.)
   - 6 Audio/Speech models (Whisper, TitaNet, pyannote, etc.)
   - 8 Scientific models (AlphaFold 2, ESM-2, RoseTTAFold2, etc.)
   - 6 Medical Imaging models (nnU-Net, MedSAM, CheXNet, etc.)
   - 4 Geospatial models (Prithvi, SatMAE, GeoSAM)
   - 5 3D/Reconstruction models (Nerfstudio, 3DGS, Point-E, etc.)
   - 14 LLM/Embedding models (Llama, Mistral, Qwen, BGE, etc.)

3. **Registry Sync Service** (registry-sync/handler.ts)
   - Daily full sync of provider model lists
   - 5-minute health checks for all providers
   - 5-minute thermal state sync for self-hosted
   - Weekly pricing updates
   - EventBridge events for sync completion

4. **CDK Infrastructure** (registry-sync-stack.ts)
   - Lambda function for sync operations
   - EventBridge rules for scheduled syncs
   - IAM permissions for SageMaker access

5. **Model Selector** (model-selector.ts)
   - `selectModel()` - Primary selection with criteria matching
   - `selectWithFallback()` - Fallback to external if warmup needed
   - Thermal state awareness (HOT > WARM > COLD)
   - Health status filtering

6. **Admin API Endpoints**
   - `GET /api/v2/admin/registry/models` - List all models
   - `GET /api/v2/admin/registry/stats` - Registry statistics
   - `GET /api/v2/admin/registry/sync/history` - Sync history
   - `POST /api/v2/admin/registry/sync` - Trigger manual sync

### Design Philosophy (v4.2.0)

- **Unified View** - Single source of truth for ALL 106 models
- **hosting_type Field** - Clear 'external' vs 'self_hosted' distinction
- **Automated Sync** - Daily provider sync, 5-min health checks
- **Thermal-Aware** - Prefer ready models, warmup in background
- **Complete Metadata** - Every field needed for orchestration

### Also includes all v4.1.0 features:
- Database-Driven Orchestration Engine
- AlphaFold 2 Integration
- License Management & Compliance
- Admin Model CRUD

### Also includes all v4.0.0 features:
- Time Machine visual history
- Media Vault with S3 versioning
- Export bundles

### Also includes all v3.8.0 features:
- User Model Selection (15 Standard + 15 Novel)
- Admin Editable Pricing
- Cost Transparency per message
- Model Favorites

---

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 37: FEEDBACK LEARNING SYSTEM & NEURAL ENGINE LOOP (v4.3.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **Dependencies:** Sections 0-36, especially 11 (Brain) and 13 (Neural Engine)
> **Creates:** Complete feedback loop from user signals â†’ Neural Engine â†’ Brain decisions

---

## 37.1 Feedback System Overview

The Feedback Learning System creates a closed-loop where user feedback continuously improves AI routing decisions. The system captures both explicit feedback (thumbs up/down) and implicit signals (regenerate, copy, abandon), ties each to a complete execution manifest, and feeds everything into the Neural Engine which advises the Brain.

### Architecture Flow

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                           FEEDBACK LEARNING LOOP                                 â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                 â”‚
â”‚  User Request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º   â”‚
â”‚       â”‚                                                                         â”‚
â”‚       â–¼                                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                         RADIANT BRAIN                                    â”‚   â”‚
â”‚  â”‚  â€¢ Consults Neural Engine for recommendations                            â”‚   â”‚
â”‚  â”‚  â€¢ Considers user/tenant/global learning                                 â”‚   â”‚
â”‚  â”‚  â€¢ Applies confidence thresholds                                         â”‚   â”‚
â”‚  â”‚  â€¢ Selects orchestration â†’ services â†’ models                             â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚       â”‚                                                                         â”‚
â”‚       â–¼                                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                     EXECUTION MANIFEST                                   â”‚   â”‚
â”‚  â”‚  Records: output_id, models[], versions[], orchestration_id,             â”‚   â”‚
â”‚  â”‚           services[], thermal_states{}, provider_health{},               â”‚   â”‚
â”‚  â”‚           brain_reasoning, latency_ms, cost, timestamp                   â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚       â”‚                                                                         â”‚
â”‚       â–¼                                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                         AI RESPONSE                                      â”‚   â”‚
â”‚  â”‚  Delivered to user with output_id for feedback reference                 â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚       â”‚                                                                         â”‚
â”‚       â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”‚
â”‚       â–¼                       â–¼                               â–¼                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”‚
â”‚  â”‚   EXPLICIT   â”‚      â”‚   IMPLICIT   â”‚              â”‚    VOICE     â”‚          â”‚
â”‚  â”‚  ðŸ‘ ðŸ‘Ž + cat â”‚      â”‚  regenerate  â”‚              â”‚  ðŸŽ¤ any lang â”‚          â”‚
â”‚  â”‚  + text      â”‚      â”‚  copy/share  â”‚              â”‚  transcribe  â”‚          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â”‚  abandon     â”‚              â”‚  translate   â”‚          â”‚
â”‚       â”‚                â”‚  switch modelâ”‚              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â”‚
â”‚       â”‚                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                     â”‚                   â”‚
â”‚       â”‚                       â”‚                             â”‚                   â”‚
â”‚       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                   â”‚
â”‚                               â–¼                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                       NEURAL ENGINE                                      â”‚   â”‚
â”‚  â”‚  â€¢ Aggregates feedback by model/orchestration/service                    â”‚   â”‚
â”‚  â”‚  â€¢ Updates model scores (individual â†’ tenant â†’ global)                   â”‚   â”‚
â”‚  â”‚  â€¢ Applies confidence thresholds and decay                               â”‚   â”‚
â”‚  â”‚  â€¢ Generates routing recommendations                                     â”‚   â”‚
â”‚  â”‚  â€¢ Tracks A/B experiment outcomes                                        â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚       â”‚                                                                         â”‚
â”‚       â–¼                                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                    BRAIN INTELLIGENCE                                    â”‚   â”‚
â”‚  â”‚  Real-time: Neural recommendations inform next Brain decision            â”‚   â”‚
â”‚  â”‚  Batch: Nightly aggregation updates routing weights                      â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Learning Scope Hierarchy

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                          TIERED LEARNING SCOPE                                   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                 â”‚
â”‚  Priority 1: USER SCOPE (Most Personalized)                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  â€¢ Alice's feedback improves Alice's experience                           â”‚ â”‚
â”‚  â”‚  â€¢ Fast adaptation to individual preferences                              â”‚ â”‚
â”‚  â”‚  â€¢ Requires minimum ~20 feedback samples for confidence                   â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                    â”‚                                            â”‚
â”‚                                    â–¼                                            â”‚
â”‚  Priority 2: TENANT SCOPE (Organization-Wide)                                   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  â€¢ Company X's employees collectively train Company X's Brain             â”‚ â”‚
â”‚  â”‚  â€¢ Isolated from Company Y (privacy boundary)                             â”‚ â”‚
â”‚  â”‚  â€¢ Captures organizational preferences (e.g., "we prefer Claude")         â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                    â”‚                                            â”‚
â”‚                                    â–¼                                            â”‚
â”‚  Priority 3: GLOBAL SCOPE (Platform-Wide, Anonymized)                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  â€¢ Aggregate patterns: "Claude wins 73% for legal tasks"                  â”‚ â”‚
â”‚  â”‚  â€¢ Cold start defaults for new users/tenants                              â”‚ â”‚
â”‚  â”‚  â€¢ Configurable opt-in/opt-out per tenant                                 â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 37.2 Feedback Database Schema

```sql
-- migrations/037_feedback_learning_system.sql

-- ============================================================================
-- EXECUTION MANIFESTS: Full provenance for every AI output
-- ============================================================================

CREATE TABLE execution_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    output_id VARCHAR(100) UNIQUE NOT NULL,  -- Reference ID for feedback
    
    -- Context
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    conversation_id UUID REFERENCES thinktank_conversations(id),
    message_id UUID REFERENCES thinktank_messages(id),
    
    -- What was requested
    request_type VARCHAR(50) NOT NULL,  -- 'chat', 'completion', 'orchestration', 'service'
    task_type VARCHAR(50),  -- 'code', 'creative', 'analysis', 'medical', etc.
    domain_mode VARCHAR(50),  -- Think Tank domain mode if applicable
    input_prompt_hash VARCHAR(64),  -- SHA-256 of input for deduplication
    input_tokens INTEGER,
    input_language VARCHAR(10),  -- Detected input language (ISO 639-1)
    
    -- What was used (THE MANIFEST)
    models_used TEXT[] NOT NULL,
    model_versions JSONB DEFAULT '{}',  -- {"claude-sonnet-4": "20241022", ...}
    orchestration_id UUID REFERENCES workflow_definitions(id),
    orchestration_name VARCHAR(100),
    services_used TEXT[],  -- ['perception', 'medical', ...]
    thermal_states_at_execution JSONB DEFAULT '{}',  -- {"whisper-large-v3": "HOT", ...}
    provider_health_at_execution JSONB DEFAULT '{}',  -- {"anthropic": {"latency_ms": 150, "error_rate": 0.01}, ...}
    
    -- Brain's decision
    brain_reasoning TEXT,  -- Why Brain chose this path
    brain_confidence DECIMAL(3, 2),  -- 0.00-1.00
    was_user_override BOOLEAN DEFAULT false,  -- User manually selected model
    
    -- Outcome metrics
    output_tokens INTEGER,
    total_latency_ms INTEGER,
    time_to_first_token_ms INTEGER,
    total_cost DECIMAL(10, 6),
    was_streamed BOOLEAN DEFAULT false,
    
    -- For multi-step orchestrations
    step_count INTEGER DEFAULT 1,
    step_details JSONB DEFAULT '[]',  -- [{model, latency, tokens, cost}, ...]
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_confidence CHECK (brain_confidence >= 0 AND brain_confidence <= 1)
);

CREATE INDEX idx_exec_manifest_output ON execution_manifests(output_id);
CREATE INDEX idx_exec_manifest_tenant_user ON execution_manifests(tenant_id, user_id);
CREATE INDEX idx_exec_manifest_conversation ON execution_manifests(conversation_id);
CREATE INDEX idx_exec_manifest_models ON execution_manifests USING GIN(models_used);
CREATE INDEX idx_exec_manifest_task ON execution_manifests(task_type);
CREATE INDEX idx_exec_manifest_created ON execution_manifests(created_at DESC);

-- ============================================================================
-- EXPLICIT FEEDBACK: Thumbs up/down with optional categories
-- ============================================================================

CREATE TYPE feedback_rating AS ENUM ('positive', 'negative', 'neutral');
CREATE TYPE feedback_category AS ENUM (
    'accuracy',      -- Factually correct
    'relevance',     -- Answered the question
    'tone',          -- Appropriate style
    'format',        -- Good structure/formatting
    'speed',         -- Fast enough
    'safety',        -- Appropriate content
    'creativity',    -- Novel/interesting
    'completeness',  -- Fully addressed request
    'other'
);

CREATE TABLE feedback_explicit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to execution
    output_id VARCHAR(100) NOT NULL REFERENCES execution_manifests(output_id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- The feedback
    rating feedback_rating NOT NULL,
    categories feedback_category[] DEFAULT '{}',  -- What specifically was good/bad
    comment_text TEXT,  -- Optional text feedback
    comment_language VARCHAR(10),  -- Detected language of comment
    
    -- Metadata
    feedback_source VARCHAR(50) DEFAULT 'thinktank',  -- 'thinktank', 'api', 'admin'
    user_agent TEXT,
    client_timestamp TIMESTAMPTZ,  -- When user clicked
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- One feedback per output per user
    UNIQUE(output_id, user_id)
);

CREATE INDEX idx_feedback_explicit_output ON feedback_explicit(output_id);
CREATE INDEX idx_feedback_explicit_tenant ON feedback_explicit(tenant_id);
CREATE INDEX idx_feedback_explicit_rating ON feedback_explicit(rating);
CREATE INDEX idx_feedback_explicit_created ON feedback_explicit(created_at DESC);

-- ============================================================================
-- IMPLICIT FEEDBACK: Behavioral signals (higher volume, weighted less)
-- ============================================================================

CREATE TYPE implicit_signal_type AS ENUM (
    'regenerate',           -- User clicked regenerate (negative)
    'copy_response',        -- User copied response (positive)
    'share_response',       -- User shared response (very positive)
    'export_response',      -- User exported (positive)
    'continue_conversation',-- User sent follow-up (neutral-positive)
    'abandon_conversation', -- User left without follow-up (weak negative)
    'abandon_mid_response', -- User stopped streaming (negative)
    'manual_model_switch',  -- User changed model (negative for current)
    'edit_and_resend',      -- User edited their prompt (neutral)
    'response_time_short',  -- Quick reply = engaged (positive)
    'response_time_long',   -- Slow reply = confused/distracted (neutral)
    'scroll_to_end',        -- Read full response (positive)
    'scroll_bounce',        -- Scrolled away quickly (negative)
    'favorite_added',       -- Added to favorites (very positive)
    'report_content'        -- Reported for review (very negative)
);

CREATE TABLE feedback_implicit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to execution
    output_id VARCHAR(100) NOT NULL REFERENCES execution_manifests(output_id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- The signal
    signal_type implicit_signal_type NOT NULL,
    signal_value JSONB DEFAULT '{}',  -- Additional context (e.g., time_to_next_message_ms)
    
    -- Computed sentiment score (-1.0 to +1.0)
    sentiment_score DECIMAL(3, 2) NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_implicit_output ON feedback_implicit(output_id);
CREATE INDEX idx_feedback_implicit_tenant ON feedback_implicit(tenant_id);
CREATE INDEX idx_feedback_implicit_signal ON feedback_implicit(signal_type);
CREATE INDEX idx_feedback_implicit_created ON feedback_implicit(created_at DESC);

-- ============================================================================
-- VOICE FEEDBACK: Multi-language voice input with transcription
-- ============================================================================

CREATE TABLE feedback_voice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to execution
    output_id VARCHAR(100) NOT NULL REFERENCES execution_manifests(output_id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Audio storage
    audio_s3_key VARCHAR(500) NOT NULL,
    audio_duration_seconds DECIMAL(8, 2),
    audio_format VARCHAR(20),  -- 'webm', 'mp3', 'wav', etc.
    
    -- Transcription
    transcription_text TEXT,
    original_language VARCHAR(10),  -- Detected language (ISO 639-1)
    translated_text TEXT,  -- English translation if not English
    transcription_confidence DECIMAL(3, 2),
    transcription_model VARCHAR(50),  -- 'whisper-large-v3', etc.
    
    -- Sentiment analysis of voice feedback
    sentiment_score DECIMAL(3, 2),  -- -1.0 to +1.0
    inferred_rating feedback_rating,
    inferred_categories feedback_category[],
    
    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_voice_output ON feedback_voice(output_id);
CREATE INDEX idx_feedback_voice_status ON feedback_voice(processing_status);

-- ============================================================================
-- NEURAL MODEL SCORES: Learned effectiveness per model/task/scope
-- ============================================================================

CREATE TYPE learning_scope AS ENUM ('user', 'tenant', 'global');

CREATE TABLE neural_model_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope (null = global)
    scope learning_scope NOT NULL,
    tenant_id UUID REFERENCES tenants(id),  -- null for global
    user_id UUID REFERENCES users(id),      -- null for tenant/global
    
    -- What we're scoring
    model_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(50),  -- null = overall score for model
    domain_mode VARCHAR(50),  -- null = all domains
    
    -- Aggregated scores (0.0 to 1.0)
    effectiveness_score DECIMAL(4, 3) NOT NULL DEFAULT 0.500,
    accuracy_score DECIMAL(4, 3),
    relevance_score DECIMAL(4, 3),
    speed_score DECIMAL(4, 3),
    
    -- Statistics
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    implicit_positive_count INTEGER DEFAULT 0,
    implicit_negative_count INTEGER DEFAULT 0,
    total_feedback_count INTEGER DEFAULT 0,
    
    -- Confidence in this score (based on sample size)
    confidence DECIMAL(3, 2) DEFAULT 0.00,
    
    -- Model version tracking
    last_model_version VARCHAR(50),
    score_decay_applied_at TIMESTAMPTZ,  -- When we last decayed old scores
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique per scope/model/task combination
    UNIQUE NULLS NOT DISTINCT (scope, tenant_id, user_id, model_id, task_type, domain_mode)
);

CREATE INDEX idx_neural_scores_model ON neural_model_scores(model_id);
CREATE INDEX idx_neural_scores_scope ON neural_model_scores(scope);
CREATE INDEX idx_neural_scores_tenant ON neural_model_scores(tenant_id);
CREATE INDEX idx_neural_scores_effectiveness ON neural_model_scores(effectiveness_score DESC);

-- ============================================================================
-- NEURAL ROUTING RECOMMENDATIONS: Brain reads these for decisions
-- ============================================================================

CREATE TABLE neural_routing_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope
    scope learning_scope NOT NULL,
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    
    -- Recommendation context
    task_type VARCHAR(50) NOT NULL,
    domain_mode VARCHAR(50),
    input_characteristics JSONB DEFAULT '{}',  -- {requires_vision, requires_audio, token_estimate_range, ...}
    
    -- The recommendation
    recommended_model VARCHAR(100) NOT NULL,
    recommended_orchestration_id UUID REFERENCES workflow_definitions(id),
    recommended_services TEXT[],
    
    -- Alternatives (ordered by score)
    alternative_models TEXT[],
    
    -- Confidence
    recommendation_confidence DECIMAL(3, 2) NOT NULL,
    sample_size INTEGER,  -- How much data this is based on
    
    -- Reasoning (for debugging/transparency)
    reasoning TEXT,
    
    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ,  -- null = no expiry
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_neural_rec_active ON neural_routing_recommendations(is_active, scope);
CREATE INDEX idx_neural_rec_task ON neural_routing_recommendations(task_type, domain_mode);
CREATE INDEX idx_neural_rec_tenant ON neural_routing_recommendations(tenant_id);

-- ============================================================================
-- USER TRUST SCORES: Anti-gaming feedback weighting
-- ============================================================================

CREATE TABLE user_trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Trust factors
    trust_score DECIMAL(3, 2) NOT NULL DEFAULT 0.50,  -- 0.00-1.00
    account_age_days INTEGER,
    total_feedback_count INTEGER DEFAULT 0,
    feedback_diversity_score DECIMAL(3, 2),  -- How varied their feedback is
    feedback_alignment_score DECIMAL(3, 2),  -- How aligned with population
    
    -- Flags
    is_outlier BOOLEAN DEFAULT false,
    outlier_reason TEXT,
    is_rate_limited BOOLEAN DEFAULT false,
    rate_limit_until TIMESTAMPTZ,
    
    -- Last update
    last_feedback_at TIMESTAMPTZ,
    last_trust_calculation_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_trust_scores_tenant ON user_trust_scores(tenant_id);
CREATE INDEX idx_trust_scores_outlier ON user_trust_scores(is_outlier);

-- ============================================================================
-- A/B TESTING: Measure if routing changes improve outcomes
-- ============================================================================

CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'paused', 'completed', 'cancelled');

CREATE TABLE ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Experiment definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    hypothesis TEXT,
    
    -- Scope
    tenant_id UUID REFERENCES tenants(id),  -- null = all tenants
    
    -- What we're testing
    experiment_type VARCHAR(50) NOT NULL,  -- 'model_routing', 'orchestration', 'service'
    control_config JSONB NOT NULL,  -- The current/default behavior
    treatment_config JSONB NOT NULL,  -- The new behavior being tested
    
    -- Traffic allocation
    traffic_percentage DECIMAL(5, 2) DEFAULT 10.00,  -- % of users in treatment
    
    -- Status
    status experiment_status NOT NULL DEFAULT 'draft',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    -- Results
    control_sample_size INTEGER DEFAULT 0,
    treatment_sample_size INTEGER DEFAULT 0,
    control_positive_rate DECIMAL(5, 4),
    treatment_positive_rate DECIMAL(5, 4),
    statistical_significance DECIMAL(5, 4),  -- p-value
    effect_size DECIMAL(5, 4),  -- Cohen's d
    winner VARCHAR(20),  -- 'control', 'treatment', 'inconclusive'
    
    created_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX idx_ab_experiments_tenant ON ab_experiments(tenant_id);

CREATE TABLE ab_experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Assignment
    variant VARCHAR(20) NOT NULL,  -- 'control' or 'treatment'
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(experiment_id, user_id)
);

CREATE INDEX idx_ab_assignments_experiment ON ab_experiment_assignments(experiment_id);
CREATE INDEX idx_ab_assignments_user ON ab_experiment_assignments(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE execution_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_explicit ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_implicit ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_voice ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_model_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_routing_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY exec_manifest_isolation ON execution_manifests 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY feedback_explicit_isolation ON feedback_explicit 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY feedback_implicit_isolation ON feedback_implicit 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY feedback_voice_isolation ON feedback_voice 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY neural_scores_isolation ON neural_model_scores 
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY neural_rec_isolation ON neural_routing_recommendations 
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY trust_scores_isolation ON user_trust_scores 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY ab_experiments_isolation ON ab_experiments 
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY ab_assignments_isolation ON ab_experiment_assignments 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get aggregated feedback score for an output
CREATE OR REPLACE FUNCTION get_feedback_score(p_output_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
    explicit_score DECIMAL;
    implicit_score DECIMAL;
    combined_score DECIMAL;
    result JSONB;
BEGIN
    -- Get explicit feedback
    SELECT 
        CASE rating 
            WHEN 'positive' THEN 1.0 
            WHEN 'negative' THEN -1.0 
            ELSE 0.0 
        END INTO explicit_score
    FROM feedback_explicit
    WHERE output_id = p_output_id
    LIMIT 1;
    
    -- Get average implicit feedback
    SELECT AVG(sentiment_score) INTO implicit_score
    FROM feedback_implicit
    WHERE output_id = p_output_id;
    
    -- Combine (explicit weighted 3x)
    combined_score := COALESCE(
        (COALESCE(explicit_score, 0) * 3 + COALESCE(implicit_score, 0)) / 
        CASE 
            WHEN explicit_score IS NOT NULL AND implicit_score IS NOT NULL THEN 4
            WHEN explicit_score IS NOT NULL THEN 3
            WHEN implicit_score IS NOT NULL THEN 1
            ELSE 1
        END,
        0
    );
    
    result := jsonb_build_object(
        'explicit_score', explicit_score,
        'implicit_score', implicit_score,
        'combined_score', combined_score,
        'has_explicit', explicit_score IS NOT NULL,
        'has_implicit', implicit_score IS NOT NULL
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Get best model recommendation for context
CREATE OR REPLACE FUNCTION get_neural_recommendation(
    p_tenant_id UUID,
    p_user_id UUID,
    p_task_type VARCHAR,
    p_domain_mode VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    model_id VARCHAR,
    confidence DECIMAL,
    scope learning_scope,
    reasoning TEXT
) AS $$
BEGIN
    -- Try user-specific first, then tenant, then global
    RETURN QUERY
    SELECT 
        r.recommended_model,
        r.recommendation_confidence,
        r.scope,
        r.reasoning
    FROM neural_routing_recommendations r
    WHERE r.is_active = true
    AND (r.valid_until IS NULL OR r.valid_until > NOW())
    AND r.task_type = p_task_type
    AND (r.domain_mode IS NULL OR r.domain_mode = p_domain_mode)
    AND (
        (r.scope = 'user' AND r.tenant_id = p_tenant_id AND r.user_id = p_user_id) OR
        (r.scope = 'tenant' AND r.tenant_id = p_tenant_id AND r.user_id IS NULL) OR
        (r.scope = 'global' AND r.tenant_id IS NULL AND r.user_id IS NULL)
    )
    ORDER BY 
        CASE r.scope 
            WHEN 'user' THEN 1 
            WHEN 'tenant' THEN 2 
            WHEN 'global' THEN 3 
        END,
        r.recommendation_confidence DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Calculate implicit signal sentiment
CREATE OR REPLACE FUNCTION get_implicit_sentiment(p_signal_type implicit_signal_type)
RETURNS DECIMAL AS $$
BEGIN
    RETURN CASE p_signal_type
        WHEN 'copy_response' THEN 0.7
        WHEN 'share_response' THEN 0.9
        WHEN 'export_response' THEN 0.6
        WHEN 'favorite_added' THEN 0.9
        WHEN 'continue_conversation' THEN 0.3
        WHEN 'scroll_to_end' THEN 0.2
        WHEN 'response_time_short' THEN 0.2
        WHEN 'regenerate' THEN -0.8
        WHEN 'manual_model_switch' THEN -0.6
        WHEN 'abandon_conversation' THEN -0.3
        WHEN 'abandon_mid_response' THEN -0.7
        WHEN 'scroll_bounce' THEN -0.4
        WHEN 'report_content' THEN -1.0
        WHEN 'edit_and_resend' THEN 0.0
        WHEN 'response_time_long' THEN 0.0
        ELSE 0.0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 37.3 Shared Types for Feedback System

```typescript
// packages/shared/src/types/feedback.types.ts

/**
 * RADIANT v4.3.0 - Feedback System Types
 */

// ============================================================================
// EXECUTION MANIFEST
// ============================================================================

export interface ExecutionManifest {
    id: string;
    outputId: string;  // Unique reference for feedback
    
    // Context
    tenantId: string;
    userId: string;
    conversationId?: string;
    messageId?: string;
    
    // Request
    requestType: 'chat' | 'completion' | 'orchestration' | 'service';
    taskType?: TaskType;
    domainMode?: DomainMode;
    inputPromptHash?: string;
    inputTokens?: number;
    inputLanguage?: string;
    
    // THE MANIFEST - What was used
    modelsUsed: string[];
    modelVersions: Record<string, string>;
    orchestrationId?: string;
    orchestrationName?: string;
    servicesUsed: string[];
    thermalStatesAtExecution: Record<string, ThermalState>;
    providerHealthAtExecution: Record<string, ProviderHealthSnapshot>;
    
    // Brain decision
    brainReasoning?: string;
    brainConfidence: number;
    wasUserOverride: boolean;
    
    // Outcome
    outputTokens?: number;
    totalLatencyMs: number;
    timeToFirstTokenMs?: number;
    totalCost: number;
    wasStreamed: boolean;
    
    // Multi-step
    stepCount: number;
    stepDetails: ExecutionStep[];
    
    createdAt: Date;
}

export interface ExecutionStep {
    stepIndex: number;
    modelId: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
}

export interface ProviderHealthSnapshot {
    latencyMs: number;
    errorRate: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
}

export type TaskType = 
    | 'chat' 
    | 'code' 
    | 'analysis' 
    | 'creative' 
    | 'vision' 
    | 'audio'
    | 'medical'
    | 'legal'
    | 'research'
    | 'translation';

export type DomainMode = 
    | 'general'
    | 'medical'
    | 'legal'
    | 'code'
    | 'creative'
    | 'research'
    | 'business';

// ============================================================================
// EXPLICIT FEEDBACK
// ============================================================================

export type FeedbackRating = 'positive' | 'negative' | 'neutral';

export type FeedbackCategory = 
    | 'accuracy'
    | 'relevance'
    | 'tone'
    | 'format'
    | 'speed'
    | 'safety'
    | 'creativity'
    | 'completeness'
    | 'other';

export interface ExplicitFeedback {
    id: string;
    outputId: string;
    tenantId: string;
    userId: string;
    
    rating: FeedbackRating;
    categories: FeedbackCategory[];
    commentText?: string;
    commentLanguage?: string;
    
    feedbackSource: 'thinktank' | 'api' | 'admin';
    createdAt: Date;
}

export interface FeedbackSubmission {
    outputId: string;
    rating: FeedbackRating;
    categories?: FeedbackCategory[];
    commentText?: string;
}

// ============================================================================
// IMPLICIT FEEDBACK
// ============================================================================

export type ImplicitSignalType =
    | 'regenerate'
    | 'copy_response'
    | 'share_response'
    | 'export_response'
    | 'continue_conversation'
    | 'abandon_conversation'
    | 'abandon_mid_response'
    | 'manual_model_switch'
    | 'edit_and_resend'
    | 'response_time_short'
    | 'response_time_long'
    | 'scroll_to_end'
    | 'scroll_bounce'
    | 'favorite_added'
    | 'report_content';

export interface ImplicitFeedback {
    id: string;
    outputId: string;
    tenantId: string;
    userId: string;
    
    signalType: ImplicitSignalType;
    signalValue: Record<string, unknown>;
    sentimentScore: number;  // -1.0 to +1.0
    
    createdAt: Date;
}

export interface ImplicitSignalSubmission {
    outputId: string;
    signalType: ImplicitSignalType;
    signalValue?: Record<string, unknown>;
}

// ============================================================================
// VOICE FEEDBACK
// ============================================================================

export interface VoiceFeedback {
    id: string;
    outputId: string;
    tenantId: string;
    userId: string;
    
    audioS3Key: string;
    audioDurationSeconds: number;
    audioFormat: string;
    
    transcriptionText?: string;
    originalLanguage?: string;
    translatedText?: string;
    transcriptionConfidence?: number;
    transcriptionModel?: string;
    
    sentimentScore?: number;
    inferredRating?: FeedbackRating;
    inferredCategories?: FeedbackCategory[];
    
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    processedAt?: Date;
    
    createdAt: Date;
}

// ============================================================================
// NEURAL LEARNING
// ============================================================================

export type LearningScope = 'user' | 'tenant' | 'global';

export interface NeuralModelScore {
    id: string;
    scope: LearningScope;
    tenantId?: string;
    userId?: string;
    
    modelId: string;
    taskType?: TaskType;
    domainMode?: DomainMode;
    
    effectivenessScore: number;  // 0.0-1.0
    accuracyScore?: number;
    relevanceScore?: number;
    speedScore?: number;
    
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    implicitPositiveCount: number;
    implicitNegativeCount: number;
    totalFeedbackCount: number;
    
    confidence: number;  // 0.0-1.0
    
    updatedAt: Date;
}

export interface NeuralRecommendation {
    id: string;
    scope: LearningScope;
    tenantId?: string;
    userId?: string;
    
    taskType: TaskType;
    domainMode?: DomainMode;
    inputCharacteristics: Record<string, unknown>;
    
    recommendedModel: string;
    recommendedOrchestrationId?: string;
    recommendedServices: string[];
    alternativeModels: string[];
    
    recommendationConfidence: number;
    sampleSize: number;
    reasoning: string;
    
    isActive: boolean;
    validFrom: Date;
    validUntil?: Date;
}

// ============================================================================
// TRUST & ANTI-GAMING
// ============================================================================

export interface UserTrustScore {
    id: string;
    tenantId: string;
    userId: string;
    
    trustScore: number;  // 0.0-1.0
    accountAgeDays: number;
    totalFeedbackCount: number;
    feedbackDiversityScore: number;
    feedbackAlignmentScore: number;
    
    isOutlier: boolean;
    outlierReason?: string;
    isRateLimited: boolean;
    rateLimitUntil?: Date;
    
    updatedAt: Date;
}

// ============================================================================
// A/B TESTING
// ============================================================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface ABExperiment {
    id: string;
    name: string;
    description?: string;
    hypothesis?: string;
    
    tenantId?: string;
    experimentType: 'model_routing' | 'orchestration' | 'service';
    controlConfig: Record<string, unknown>;
    treatmentConfig: Record<string, unknown>;
    
    trafficPercentage: number;
    status: ExperimentStatus;
    
    controlSampleSize: number;
    treatmentSampleSize: number;
    controlPositiveRate?: number;
    treatmentPositiveRate?: number;
    statisticalSignificance?: number;
    effectSize?: number;
    winner?: 'control' | 'treatment' | 'inconclusive';
    
    startedAt?: Date;
    endedAt?: Date;
}

// Import existing types
import { ThermalState } from './ai.types';
```

Update the shared types index:

```typescript
// packages/shared/src/types/index.ts

// Add to existing exports
export * from './feedback.types';
```

---

## 37.4 API Endpoints Summary

### Feedback Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/feedback/explicit` | Submit thumbs up/down with optional categories |
| POST | `/api/v2/feedback/implicit` | Record implicit signal (regenerate, copy, etc.) |
| POST | `/api/v2/feedback/voice` | Upload voice feedback (multipart) |
| GET | `/api/v2/feedback/stats/{outputId}` | Get aggregated feedback for output |

### Neural Engine Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/neural/recommendation` | Get Neural Engine recommendation |
| GET | `/api/v2/neural/scores` | Get model scores for context |
| POST | `/api/v2/neural/learn` | Trigger learning for output (internal) |

### Voice Processing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/voice/transcribe` | Transcribe audio to text (any language) |
| POST | `/api/v2/voice/translate` | Translate text to English |

### Service Layer (Client Apps)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/service/feedback/config` | Get feedback widget configuration |
| POST | `/api/v2/service/feedback/implicit/batch` | Batch submit implicit signals |
| GET | `/api/v2/service/feedback/conversation/{id}/summary` | Get conversation feedback summary |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/admin/feedback/stats` | Feedback analytics dashboard |
| GET | `/api/v2/admin/experiments` | List A/B experiments |
| POST | `/api/v2/admin/experiments` | Create A/B experiment |
| PUT | `/api/v2/admin/experiments/{id}` | Update experiment status |
| GET | `/api/v2/admin/trust-scores` | View user trust scores |

---

## 37.5 Implicit Signal Sentiment Mapping

| Signal Type | Sentiment Score | Interpretation |
|-------------|-----------------|----------------|
| `favorite_added` | +0.9 | Very positive - user values this response |
| `share_response` | +0.9 | Very positive - worth sharing |
| `copy_response` | +0.7 | Positive - useful enough to copy |
| `export_response` | +0.6 | Positive - keeping for later |
| `continue_conversation` | +0.3 | Neutral-positive - engaged |
| `scroll_to_end` | +0.2 | Weak positive - read full response |
| `response_time_short` | +0.2 | Weak positive - quick engagement |
| `edit_and_resend` | 0.0 | Neutral - refining question |
| `response_time_long` | 0.0 | Neutral - thinking/distracted |
| `abandon_conversation` | -0.3 | Weak negative - may be done or frustrated |
| `scroll_bounce` | -0.4 | Negative - didn't read response |
| `manual_model_switch` | -0.6 | Negative - current model wasn't working |
| `abandon_mid_response` | -0.7 | Negative - stopped streaming early |
| `regenerate` | -0.8 | Negative - response wasn't good |
| `report_content` | -1.0 | Very negative - safety/quality issue |

---

## 37.6 Learning Weighting Formula

Combined feedback score for model scoring:

```
weighted_score = (
    (explicit_score Ã— 3.0 Ã— trust_weight) +
    (implicit_score Ã— 1.0) +
    (voice_score Ã— 2.0 Ã— trust_weight)
) / total_weight
```

Where:
- `explicit_score`: -1.0 to +1.0 from thumbs rating
- `implicit_score`: Average of implicit signal sentiments
- `voice_score`: Sentiment analysis of transcribed voice feedback
- `trust_weight`: 0.1 to 1.0 based on user trust score

Model effectiveness update:

```
new_score = (current_score Ã— current_count + weighted_score) / (current_count + 1)
confidence = min(total_count / min_sample_size, 1.0)
```

---

## Summary

RADIANT v4.3.0 (PROMPT-17) adds **Feedback Learning System & Neural Engine Loop**:

### Section 37: Feedback Learning System (v4.3.0)

1. **Database Schema** (037_feedback_learning_system.sql)
   - `execution_manifests` - Full provenance for every AI output
   - `feedback_explicit` - Thumbs up/down with categories
   - `feedback_implicit` - Behavioral signals (regenerate, copy, abandon, etc.)
   - `feedback_voice` - Multi-language voice feedback with transcription
   - `neural_model_scores` - Learned effectiveness per model/task/scope
   - `neural_routing_recommendations` - Brain advice from Neural Engine
   - `user_trust_scores` - Anti-gaming trust levels
   - `ab_experiments` - A/B testing experiments

2. **Learning Scopes**
   - User-level: Personal preferences, fastest adaptation
   - Tenant-level: Organization-wide patterns, privacy isolated
   - Global-level: Platform defaults, cold start handling

3. **Signal Types**
   - Explicit: Thumbs up/down + 8 feedback categories + text comments
   - Implicit: 15 behavioral signals (regenerate, copy, share, abandon, etc.)
   - Voice: Multi-language voice feedback with Whisper transcription

4. **Neural Engine Integration**
   - Brain consults Neural Engine before every routing decision
   - Neural scores weighted at 35% in model selection
   - Real-time + nightly batch learning

5. **Anti-Gaming Protection**
   - User trust scores (0.0-1.0)
   - Rate limiting (50 feedback/hour)
   - Outlier detection (deviation from population)
   - Account age weighting

6. **A/B Testing Framework**
   - Create experiments comparing routing strategies
   - Automatic user assignment to control/treatment
   - Statistical significance tracking

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
