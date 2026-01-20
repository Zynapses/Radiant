---
description: Policy - UI/UX patterns must be reviewed before changes and documented when modified
---

# UI/UX Patterns Documentation Policy

**MANDATORY**: This workflow has TWO requirements:

1. **BEFORE making UI changes**: Review `docs/UI-UX-PATTERNS.md`
2. **AFTER making UI changes**: Update `docs/UI-UX-PATTERNS.md`

---

## When to Trigger

This policy is triggered when:
- Adding a new UI component or pattern
- Modifying an existing component's styling or behavior
- Changing design tokens (colors, spacing, typography)
- Adding or modifying animations
- Changing layout patterns
- Modifying form behavior or validation patterns

---

## Step 1: Pre-Change Review (MANDATORY)

**BEFORE making any UI/UX changes, you MUST:**

1. Read `docs/UI-UX-PATTERNS.md`
2. Identify if an existing pattern covers your use case
3. If pattern exists:
   - Follow the documented pattern
   - If modification needed, document justification
4. If no pattern exists:
   - Check source references (shadcn/ui, Radix, etc.)
   - Plan to document new pattern after implementation

### Review Checklist

- [ ] Read relevant sections of `docs/UI-UX-PATTERNS.md`
- [ ] Checked if existing pattern applies
- [ ] Identified source reference (if new pattern)
- [ ] Have justification for any deviations

---

## Step 2: Identify the Change Type

| Change Type | Category | Example |
|-------------|----------|---------|
| **New Component** | Component Pattern | New dialog variant |
| **Style Change** | Design Token | Color palette update |
| **Animation** | Animation Pattern | New transition effect |
| **Layout** | Layout Pattern | New grid configuration |
| **Behavior** | Interaction Behavior | New keyboard shortcut |
| **Form** | Form Pattern | New validation approach |

---

## Step 3: Document the Source

If the pattern is derived from an external source, document it:

| Field | Required | Example |
|-------|----------|---------|
| **Source Name** | ✅ | shadcn/ui, Radix UI, Material Design 3 |
| **URL** | ✅ | https://ui.shadcn.com/docs/components/button |
| **Version/Date** | Optional | v0.8.0, January 2024 |
| **Modifications** | If any | "Added thermal state variant" |

---

## Step 4: Update Documentation

### For New Patterns

1. Open `docs/UI-UX-PATTERNS.md`
2. Find the appropriate category section
3. Add pattern documentation:

```markdown
### [Pattern Name]

**Source**: [Where it came from]

| Property | Value | Usage |
|----------|-------|-------|
| ... | ... | ... |

**Files**: `path/to/implementation.tsx`
```

### For Modified Patterns

1. Update the pattern section with new details
2. Add entry to "Pattern Modification History":

```markdown
| YYYY-MM-DD | [Pattern] | [What changed] | [Why] | [Your Name] |
```

### For Removed Patterns

1. Remove from the pattern section
2. Add to "Pattern Modification History" with removal reason

---

## Step 5: Verify Consistency

After making changes, verify:

- [ ] Pattern works in light mode
- [ ] Pattern works in dark mode
- [ ] Pattern is responsive (mobile → desktop)
- [ ] Pattern follows accessibility requirements
- [ ] Pattern is consistent across apps (admin-dashboard, thinktank-admin)

---

## Category Reference

| Category | Section | Examples |
|----------|---------|----------|
| **Design Tokens** | Category 1 | Colors, typography, spacing |
| **Components** | Category 2 | Button, Card, Dialog |
| **Layout** | Category 3 | Grid, Sidebar, Container |
| **Animation** | Category 4 | Framer Motion, CSS keyframes |
| **Interaction** | Category 5 | Focus, keyboard, loading |
| **Forms** | Category 6 | Validation, inputs |
| **Data Display** | Category 7 | Tables, charts, badges |
| **Navigation** | Category 8 | Tabs, breadcrumbs, menus |
| **Magic Carpet** | Category 9 | Think Tank specific |

---

## Source References

When creating new patterns, prefer these established sources:

| Source | URL | Best For |
|--------|-----|----------|
| **shadcn/ui** | https://ui.shadcn.com | React components |
| **Radix UI** | https://www.radix-ui.com | Accessible primitives |
| **Tailwind CSS** | https://tailwindcss.com | Utility classes |
| **Material Design 3** | https://m3.material.io | Design principles |
| **Atlassian** | https://atlassian.design | Enterprise patterns |
| **Shopify Polaris** | https://polaris.shopify.com | Admin patterns |
| **GitHub Primer** | https://primer.style | Developer UI |
| **Apple HIG** | https://developer.apple.com/design/ | macOS patterns |

---

## Verification Checklist

Before completing UI/UX work, verify:

- [ ] Pre-change review completed
- [ ] Pattern documented in `docs/UI-UX-PATTERNS.md`
- [ ] Source reference included (if external)
- [ ] File paths documented
- [ ] Modification history updated (if changing existing)
- [ ] Works in light/dark mode
- [ ] Responsive across breakpoints
- [ ] Accessible (keyboard, screen reader)

---

## Policy Enforcement

This policy is **MANDATORY**. AI coders MUST:

1. **Read** `docs/UI-UX-PATTERNS.md` before making UI changes
2. **Follow** existing patterns when applicable
3. **Document** new patterns after implementation
4. **Update** modification history for changes

### NEVER

- Make UI changes without reviewing existing patterns
- Deviate from established patterns without justification
- Add new patterns without documentation
- Modify patterns without updating documentation
- Copy patterns without attributing source

---

## Quick Reference: Common Tasks

### Adding a new button variant

1. Review: Category 2 → Button Variants
2. Check: Does existing variant work?
3. If new: Add variant to `buttonVariants` in `button.tsx`
4. Document: Add to Button Variants table

### Adding a new color

1. Review: Category 1 → Color System
2. Add to `globals.css` (both light and dark)
3. Add to `tailwind.config.ts` if needed
4. Document: Add to Color System table

### Adding a new animation

1. Review: Category 4 → Animation Patterns
2. Add keyframes to `tailwind.config.ts` or use Framer Motion
3. Document: Add to appropriate animation section

### Adding a new form pattern

1. Review: Category 6 → Form Patterns
2. Follow existing validation patterns (Zod + react-hook-form)
3. Document: Add to Form Patterns section

---

## AI Coder Integration

When an AI coder is working on UI:

```
1. BEFORE changes:
   - Call read_file on docs/UI-UX-PATTERNS.md
   - Identify relevant patterns
   - Follow documented patterns

2. AFTER changes:
   - Update docs/UI-UX-PATTERNS.md
   - Add source reference if new
   - Update modification history if changed
```

This ensures all UI/UX changes are traceable and consistent.
