---
description: Policy - All user-facing apps MUST use the unified profile system. No custom profile implementations allowed.
---

# User Profile Consistency Policy

## When This Policy Applies

This policy applies whenever you:
- Add or modify user profile fields
- Add a new user-facing app (Think Tank, Curator, Genesis, Dojo, etc.)
- Modify authentication or user identity types
- Add phone/email contact management features
- Modify MFA or verification flows

## Requirements

### 1. Unified Contact Directory
- All user contacts (emails + phones) MUST be stored in the `user_contacts` table
- Maximum 3 emails + 3 phones per user (enforced by DB trigger)
- ALL contacts MUST be verified before use in any routing or MFA
- Login email MUST be verified and cannot be deleted
- At least 1 verified phone REQUIRED for all users (MFA)

### 2. Shared Types
- Use types from `packages/shared/src/types/user-profile.types.ts`
- NEVER define local profile types in individual apps
- NEVER duplicate `UserContact`, `UserProfile`, or verification types

### 3. Shared API
- All profile operations MUST go through `/api/profile` endpoints
- NEVER build app-specific profile endpoints
- Contact verification MUST use `ContactVerificationService`
- Phone verification uses Amazon SNS (Transactional SMS)
- Email verification uses Amazon SES

### 4. Shared UI Component
- All apps MUST use the shared profile component for profile editing
- NEVER build app-specific profile edit forms
- Profile page MUST show verification status for all contacts
- Unverified contacts MUST show a "Verify" button

### 5. Phone Verification Flow
- 6-digit code, expires in 10 minutes
- Maximum 3 attempts per code, then 10-minute cooldown
- Codes are bcrypt-hashed in the database
- Rate limited per user
- Sent via Amazon SNS (Transactional SMS type)

### 6. SENTINEL Alert Routing
- Only VERIFIED contacts can be used in alert routing rules
- Removing a contact MUST cascade-delete its routing rules
- Alert routing resolves contacts via `resolve_sentinel_contacts()` DB function

### 7. Profile Completeness
- `profileComplete` = has verified email + verified phone + display name + timezone
- Incomplete profiles show a persistent banner in all apps
- Profile completion status updated automatically on verification

## Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/user-profile.types.ts` | All profile and contact types |
| `packages/infrastructure/migrations/V2026_02_07_012__user_profile_and_admin_roles.sql` | Database schema |
| `packages/infrastructure/lambda/shared/services/contact-verification.service.ts` | Verification + CRUD + routing |
| `packages/infrastructure/lambda/admin/profile.ts` | Profile API Lambda |
| `apps/admin-dashboard/app/(dashboard)/profile/page.tsx` | Admin profile UI |

## Checklist

```
□ Using shared types from user-profile.types.ts?
□ Using /api/profile endpoints (not custom)?
□ Using ContactVerificationService for verification?
□ Enforcing verified-only for routing/MFA?
□ Login email protected from deletion?
□ Last verified phone protected from deletion?
□ Profile completion banner shown when incomplete?
□ E.164 format enforced for phone numbers?
```
