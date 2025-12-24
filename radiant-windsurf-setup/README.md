# RADIANT v4.17.0 - Windsurf Auto-Build Setup

> **Zero hand-holding automated build system for Claude Opus 4.5**

## 🚀 Quick Start

### 1. Copy to Your Project Root

```bash
# Copy this entire folder to your project
cp -r radiant-windsurf-setup/* /path/to/your/project/
```

### 2. Open in Windsurf

Open the project folder in Windsurf IDE.

### 3. Start Building

Type in Cascade chat:
```
/implement-phase 1
```

That's it. Claude will:
1. Read the phase spec
2. Load each section
3. Create all files in order
4. Verify compilation
5. Report when ready for next phase

## 📁 What's Included

```
.
├── AGENTS.md                    # Persistent context for Claude
├── README.md                    # This file
├── split-prompt.sh              # Script that created section files
├── .windsurf/
│   ├── rules/
│   │   └── radiant-build.md     # Build rules and conventions
│   ├── workflows/
│   │   ├── orchestrator.md      # Master workflow controller
│   │   └── phase-1-foundation.md
│   └── state/
│       └── progress.json        # Tracks build progress
└── docs/
    ├── phases/                  # Phase summaries (1-9)
    │   ├── phase-1.md
    │   ├── phase-2.md
    │   └── ...
    └── sections/                # Full specs (47 files)
        ├── section-00-shared-types.md
        ├── section-01-swift-app.md
        └── ...
```

## ⚡ Commands

| Command | What It Does |
|---------|-------------|
| `/implement-phase N` | Start phase N (1-9) |
| `/continue-phase` | Resume from last stopping point |
| `/verify-phase` | Check current phase completion |
| `/auto-build` | Build all phases automatically |
| `/section N` | Jump to specific section |
| `/phase-status` | Show progress summary |

## 🔄 Workflow

```
┌─────────────────────────────────────────────────────┐
│  1. You: "/implement-phase 1"                       │
│                                                     │
│  2. Claude reads docs/phases/phase-1.md             │
│                                                     │
│  3. Claude loads docs/sections/section-00-*.md      │
│     Creates all files from that section             │
│                                                     │
│  4. Claude loads docs/sections/section-01-*.md      │
│     Creates all files from that section             │
│                                                     │
│  5. Claude loads docs/sections/section-02-*.md      │
│     Creates all files from that section             │
│                                                     │
│  6. Claude verifies: swift build, cdk synth         │
│                                                     │
│  7. Claude: "Phase 1 complete. Run /implement-phase │
│             2 to continue."                         │
│                                                     │
│  8. You: "/implement-phase 2"                       │
│     ... continues ...                               │
└─────────────────────────────────────────────────────┘
```

## 📊 Phase Overview

| Phase | Sections | Lines | Time Est. | What It Builds |
|-------|----------|-------|-----------|----------------|
| 1 | 0-2 | 6,500 | 1 hr | Foundation: Types, Swift app, Base CDK |
| 2 | 3-7 | 13,600 | 2-3 hrs | Core: AI stacks, Lambdas, Database |
| 3 | 8-9 | 5,100 | 1-2 hrs | Admin dashboard, Deployment |
| 4 | 10-17 | 1,500 | 30-45 min | AI features: Brain, Analytics |
| 5 | 18-28 | 2,400 | 1 hr | Consumer: Think Tank, Chat |
| 6 | 29-35 | 6,200 | 1.5-2 hrs | Advanced: Registry, Time Machine |
| 7 | 36-39 | 4,600 | 1-1.5 hrs | Intelligence: Neural, Workflows |
| 8 | 40-42 | 5,200 | 1.5 hrs | Hardening: Isolation, i18n |
| 9 | 43-46 | 2,000 | 45-60 min | Billing: Credits, Subscriptions |

**Total**: ~47,000 lines, ~12-15 AI-assisted hours

## 🛠️ Resuming After Session Break

Windsurf sessions can timeout. When you return:

```
/continue-phase
```

Claude reads `.windsurf/state/progress.json` and picks up exactly where it left off.

## ⚠️ If Something Goes Wrong

1. **Compilation Error**: Claude will stop and report the error. Fix it manually or say "fix the error and continue".

2. **Wrong Section**: Say `/section 5` to jump to a specific section.

3. **Start Over**: Delete `progress.json` and run `/implement-phase 1` again.

## 🔧 Customization

### Change Rules
Edit `.windsurf/rules/radiant-build.md` to adjust coding conventions.

### Skip Sections
Add section numbers to `completedSections` in `progress.json`:
```json
{
  "completedSections": [0, 1, 2, 3]
}
```

### Add Notes
```
/add-note "Remember to update API keys after phase 3"
```

## 📝 Tips

1. **Don't interrupt mid-section** - wait for section completion
2. **Check progress.json** if unsure where you are
3. **Verify each phase** before moving to next
4. **The full prompt is preserved** in `docs/RADIANT-PROMPT-32-FULL.md` if you need to reference something not in sections

## 🆘 Getting Help

If Claude seems confused:
```
Read AGENTS.md and docs/phases/phase-N.md, then continue implementing.
```

This resets context and gets Claude back on track.

---

**Built for RADIANT v4.17.0 | December 2024**
