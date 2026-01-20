---
description: MANDATORY - Master policy enforcement checklist that MUST be reviewed before ANY significant work
---

# Policy Enforcement Checklist

> ⚠️ **THIS IS NOT OPTIONAL** ⚠️
> 
> This checklist MUST be mentally reviewed before ANY significant task.
> Failure to follow policies creates technical debt, compliance risks, and inconsistency.

---

## Pre-Flight Check (Before Starting Work)

### STEP 1: Scan ALL Policies (Dynamic)

**Before beginning ANY significant task, you MUST:**

1. **List all workflow files** in `/.windsurf/workflows/`
2. **Read each workflow's description** (the `description:` field in frontmatter)
3. **For each policy**, ask: "Does my current task trigger this policy?"
4. **If YES**, read that workflow file and follow its requirements

```
DYNAMIC POLICY SCAN:
1. List files in: .windsurf/workflows/*.md
2. For each file, read the description
3. If description matches task type → follow that policy
4. New policies are AUTOMATICALLY included
```

### STEP 2: Common Trigger Questions

Ask yourself these questions to identify applicable policies:

| Question | If YES, check for policies containing... |
|----------|------------------------------------------|
| UI/UX changes? | "ui", "ux", "pattern", "style" |
| Adding dependencies? | "library", "dependency", "open-source" |
| New feature? | "moat", "feature", "documentation" |
| User-facing changes? | "documentation", "admin", "guide" |
| Think Tank specific? | "thinktank" |
| AWS/CDK changes? | "cdk", "infrastructure", "aws" |
| PHI/HIPAA data? | "hipaa", "phi", "compliance", "sanitization" |
| UI text strings? | "localized", "hardcoded", "text", "i18n" |
| Production code? | "mock", "stub", "no-" |
| Build/release? | "build", "version", "auto" |

### STEP 3: Read Matching Policies

For every policy that matches your task:
1. Read the full workflow file
2. Follow ALL requirements in that workflow
3. Complete any checklists or documentation updates

---

## How New Policies Auto-Apply

**This enforcement system is DYNAMIC.**

When a new policy workflow is added to `/.windsurf/workflows/`:
1. It automatically becomes part of the policy scan
2. No manual update to this file is needed
3. The description field determines when it triggers

**Policy File Format:**
```yaml
---
description: [When this policy applies - used for matching]
---
[Policy content...]
```

The AI scans ALL `.md` files in the workflows directory and checks if their descriptions match the current task context.

---

## Post-Task Verification

**Before marking a task complete, verify:**

### Documentation Updated?
- [ ] Relevant admin guide updated (if user-facing)
- [ ] Technical docs updated (if infrastructure)
- [ ] Moat docs updated (if significant feature)

### Libraries Documented?
- [ ] Any new dependencies in `docs/OPEN-SOURCE-LIBRARIES.md`
- [ ] Flagged libraries have justification

### UI/UX Documented?
- [ ] New patterns in `docs/UI-UX-PATTERNS.md`
- [ ] Source references included
- [ ] Modification history updated

### Code Quality?
- [ ] No hardcoded text
- [ ] No mock data in production
- [ ] No stubs in production

---

## Enforcement Mechanism

### For AI Coders (Cascade/Windsurf)

**At the START of every significant task:**

1. Mentally run through the Pre-Flight Check above
2. Identify which policies apply
3. Read the relevant policy workflows
4. Follow the policies throughout the task

**At the END of every significant task:**

1. Run through Post-Task Verification
2. Ensure all documentation is updated
3. Confirm no policies were skipped

### Memory Trigger

This policy is referenced in:
- `AGENTS.md` (user rules)
- Persistent memory (retrieved automatically)

---

## What Counts as "Significant"?

A task is significant if it:

- Adds or modifies UI components
- Adds or removes npm/Swift dependencies
- Adds new features or modifies existing features
- Changes infrastructure or CDK stacks
- Affects user-facing behavior
- Touches compliance-sensitive code (PHI, billing)
- Creates new files or deletes files

A task is NOT significant if it:

- Fixes a typo
- Adds a comment
- Reformats existing code
- Updates a version number only

---

## Policy Violation Recovery

If you realize you've violated a policy mid-task:

1. **STOP** - Don't continue without fixing
2. **Document** - Update the relevant documentation NOW
3. **Note** - Add to your task summary that policy was initially missed
4. **Continue** - Resume with policies in mind

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    POLICY QUICK CHECK                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BEFORE ANY SIGNIFICANT TASK:                                │
│                                                              │
│  1. List all files in /.windsurf/workflows/                 │
│  2. Read each description field                             │
│  3. For each matching policy → follow it                    │
│                                                              │
│  NEW POLICIES AUTO-APPLY - NO MANUAL UPDATE NEEDED          │
│                                                              │
│  AFTER: Verify all docs updated before marking complete     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Matters

**Without policy enforcement:**
- Documentation becomes stale
- Patterns become inconsistent
- License compliance is unknown
- Moats are forgotten
- Technical debt accumulates

**With policy enforcement:**
- Documentation stays current
- Patterns stay consistent
- Compliance is tracked
- Competitive advantages are documented
- Quality is maintained

---

**This policy is MANDATORY and has NO EXCEPTIONS.**
