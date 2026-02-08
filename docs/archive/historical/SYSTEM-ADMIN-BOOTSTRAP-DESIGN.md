# System Admin Bootstrap — Design Document

> **Version**: v7.38.1 | **Status**: PROPOSAL — Awaiting approval  
> **Depends on**: v7.38.0 System Admin Separation (completed)  
> **Author**: AI Build Agent + Robert Long

---

## Table of Contents

1. [Decisions & Rationale](#1-decisions--rationale)
2. [How the First Super Admin Gets In](#2-how-the-first-super-admin-gets-in)
3. [How the Second Super Admin Gets In](#3-how-the-second-super-admin-gets-in)
4. [What Already Exists vs What Needs to Be Built](#4-what-already-exists-vs-what-needs-to-be-built)
5. [Implementation Plan](#5-implementation-plan)

---

## 1. Decisions & Rationale

### Decision 1: Bootstrap Auth — IAM Credentials (Deployer's AWS Role)

**Decision**: The `/admin/system/bootstrap` endpoint uses **AWS IAM auth** (the deployer's existing AWS credentials), not a pre-shared token.

**Why**:
- The Swift Deployer already possesses valid AWS credentials — it just used them to deploy 14 CDK stacks. No new secret to create, rotate, or leak.
- IAM auth is the strongest auth available. A pre-shared token stored in Secrets Manager would be a weaker, redundant mechanism sitting on top of the same AWS credentials needed to read it.
- The bootstrap endpoint is called **exactly once** per deployment. It rejects all subsequent calls (the `bootstrap_system_admin()` SQL function fails if any `active` or `pending_setup` admin exists). So there is no ongoing credential to manage.
- CDK already outputs the Pool B User Pool ID and the Admin API URL as stack outputs. The deployer reads these outputs, then makes two AWS SDK calls: one to Cognito, one to the API. Both use the same IAM role.

**What this means concretely**: The Admin API Gateway has a second authorizer (`AWS_IAM`) on the `/admin/system/bootstrap` route only. All other admin routes use the Cognito Pool B authorizer. The IAM authorizer is locked to the deployer's IAM role ARN.

---

### Decision 2: Email Delivery — Custom SES Template (Branded)

**Decision**: Temporary credentials are delivered via a **custom SES email template**, not Cognito's built-in messaging.

**Why**:
- Cognito's built-in email is limited to **50 emails/day in sandbox mode**. Every new AWS account starts in sandbox. You'd have to request production SES access before your first deployment could work — a chicken-and-egg problem.
- The `AutoSetupService` already configures SES (step 4 in its setup flow — see `setupSES(config:)` in `AutoSetupService.swift`). SES is ready before the admin Lambda ever runs.
- Custom templates let us brand the email ("Welcome to RADIANT — Your System Admin Account") with clear instructions instead of Cognito's generic "Your verification code is 123456" text.
- We control the email content, so we can include: the Admin Dashboard URL, the temporary password, instructions for first login, and expected setup steps.

**What this means concretely**: The Swift Deployer calls `SES.sendTemplatedEmail()` after creating the Cognito user. The template is deployed as part of the CDK stack (an `aws_ses.CfnTemplate` resource). Cognito is configured with `emailConfiguration.emailSendingAccount = 'DEVELOPER'` pointing to the verified SES identity.

---

### Decision 3: Setup Wizard — Invite Backup Admin During Setup

**Decision**: The first-run setup wizard includes a **step 5** that invites a second system admin. This step is strongly encouraged but not strictly required.

**Why**:
- **Bus factor**: If the sole super_admin loses their authenticator app, phone, or forgets their password, there is no recovery path. Cognito Pool B has no "forgot password" flow for users who haven't completed MFA setup. AWS console access could reset the Cognito user, but that requires a different person with AWS root/IAM access — which may not be the same person.
- **Separation of duties**: Enterprise customers expect at least two people with super_admin access. Auditors will flag a single-admin deployment.
- **The DB trigger `prevent_last_super_admin_removal` protects against demotion/deactivation — but not against Cognito lockout.** The trigger is a safety net at the database level. It cannot help if the human can't authenticate at all.
- **Why "encouraged but not required"**: Dev/staging environments legitimately run with one admin. Forcing a second admin email that doesn't exist yet would block deployments unnecessarily.

**What this means concretely**: Step 5 of the setup wizard shows an "Invite Backup Admin" form with an email field and role selector. If the admin skips it, a persistent warning banner appears on the dashboard: "⚠ You are the only super_admin. Invite a backup admin from Settings → System Admins." The second admin receives the same SES email with temporary credentials and goes through their own independent setup wizard.

---

### Decision 4: CLI Alternative — Yes, Build It

**Decision**: Build a `radiant admin bootstrap` CLI command in addition to the Swift Deployer UI.

**Why**:
- **Headless deployments**: CI/CD pipelines (GitHub Actions, CodePipeline, Jenkins) cannot run a macOS SwiftUI app. The CLI enables fully automated deployments.
- **Low marginal effort**: The CLI makes the same two SDK calls as the Swift Deployer (Cognito `AdminCreateUser` + API Gateway POST). The Lambda endpoint is identical. It's a thin wrapper.
- **Existing CLI package**: `packages/cli/` already exists with infrastructure for commands. Adding a subcommand is straightforward.
- **Recovery scenarios**: If the Swift Deployer has issues, the CLI provides an alternative path to bootstrap.

**What this means concretely**: `npx @radiant/cli admin bootstrap --email admin@example.com --name "Jane Doe"` executes the same bootstrap flow. It reads CDK outputs from CloudFormation, calls Cognito, calls the bootstrap API, and prints the result.

---

### Decision 5: MFA Method — SMS/Phone Code (Not Authenticator App)

**Decision**: All users (system admins and tenant users) use **SMS-based MFA** via phone number, not TOTP authenticator apps.

**Why**:
- **Simpler onboarding**: No app installation required. Every admin has a phone. Not every admin has Google Authenticator or 1Password.
- **Fewer support tickets**: Lost/replaced phone with SMS MFA = port your number. Lost TOTP secret = locked out, needs admin reset.
- **Single verification step**: Phone verification and MFA enrollment become the same step — verify phone number via SMS code, and that phone is now your MFA device. This eliminates one entire setup wizard step.
- **Good enough for now**: SMS MFA is accepted by SOC2, HIPAA, and most compliance frameworks. TOTP/FIDO2 can be added as an upgrade later without changing the architecture.
- **SNS already configured**: The `AutoSetupService` sets up SNS for SMS (step 5 in its setup flow). The infrastructure is ready.

**What this means concretely**: Cognito Pool B (and Pool A) are configured with `mfaConfiguration = 'ON'` and `enabledMfas = ['SMS_MFA']`. The setup wizard combines phone verification + MFA enrollment into a single step. On future logins, Cognito sends an SMS code challenge automatically.

**Future upgrade path**: Add `SOFTWARE_TOKEN_MFA` to `enabledMfas` and let admins choose their preferred method in profile settings. No migration needed — Cognito supports mixed MFA methods per user.

---

## 2. How the First Super Admin Gets In

This is the complete step-by-step flow from zero to a working super_admin session. Nothing is glossed over.

### Phase A: During Deployment (Swift Deployer / CLI)

The deployer (person running the Swift Deployer app or CLI) provides their email address before deployment begins. This happens in the installation wizard, alongside choosing tier, region, and domain.

```
┌─────────────────────────────────────────────────────────────┐
│  SWIFT DEPLOYER                                              │
│                                                              │
│  Step 1 of 6: Configuration                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Tier:    [GROWTH ▼]                                     │ │
│  │  Region:  [us-east-1 ▼]                                  │ │
│  │  Domain:  [admin.acme.com        ]                       │ │
│  │                                                          │ │
│  │  ── Bootstrap Admin ──────────────────────────────────── │ │
│  │  Email:   [jane@acme.com         ]  ← NEW FIELD          │ │
│  │  Name:    [Jane Doe              ]  ← NEW FIELD          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                              [Next →]        │
└─────────────────────────────────────────────────────────────┘
```

The email and name are stored in `InstallationParameters.bootstrapAdminEmail` and `.bootstrapAdminName`. These are used after CDK deployment completes.

### Phase B: Post-CDK Bootstrap (Automated — No Human Interaction)

After all 14 CDK stacks deploy and migrations run, the deployer executes `createInitialAdmin()` (currently a stub). Here's exactly what happens:

```
Step 1: Read CDK stack outputs
    ├── SystemAdminUserPoolId     (from AdminStack)
    ├── SystemAdminUserPoolClientId
    └── AdminApiUrl               (from AdminStack)

Step 2: Create Cognito user in Pool B
    AWS SDK call: CognitoIdentityProvider.AdminCreateUser({
        UserPoolId: <SystemAdminUserPoolId>,
        Username: "jane@acme.com",
        TemporaryPassword: <auto-generated by Cognito, 20+ chars>,
        UserAttributes: [
            { Name: "email",              Value: "jane@acme.com" },
            { Name: "email_verified",     Value: "true" },
            { Name: "custom:admin_pool",  Value: "system" },
            { Name: "custom:admin_role",  Value: "super_admin" },
            { Name: "custom:is_bootstrap", Value: "true" },
            { Name: "custom:status",      Value: "pending_setup" },
            { Name: "custom:display_name", Value: "Jane Doe" }
        ],
        MessageAction: "SUPPRESS"  ← We send our own email via SES
    })
    
    Returns: { User: { Username: "abc-123-def", Attributes: [...] } }
    The Username IS the Cognito `sub` (the unique ID).

Step 3: Create database row via Admin API
    HTTP POST https://<AdminApiUrl>/admin/system/bootstrap
    Auth: AWS IAM (SigV4 signed with deployer credentials)
    Body: {
        "cognitoUserId": "abc-123-def",
        "email": "jane@acme.com",
        "displayName": "Jane Doe"
    }
    
    The Lambda handler calls SystemAdminService.bootstrapFirstAdmin()
    which calls the SQL function bootstrap_system_admin().
    
    This creates a row in system_admins:
    ┌───────────────────────────────────────────────────────────┐
    │  id:              "uuid-001"                               │
    │  cognito_user_id: "abc-123-def"                            │
    │  email:           "jane@acme.com"                          │
    │  display_name:    "Jane Doe"                               │
    │  role:            super_admin                               │
    │  is_bootstrap:    true                                      │
    │  status:          pending_setup    ← NOT active yet         │
    │  mfa_enabled:     true                                      │
    │  phone_verified:  false                                     │
    │  email_verified:  false                                     │
    └───────────────────────────────────────────────────────────┘
    
    The SQL function FAILS if any active/pending admin exists.
    This endpoint can only succeed once per deployment.

Step 4: Send welcome email via SES
    AWS SDK call: SES.sendTemplatedEmail({
        Source: "noreply@<domain>",
        Destination: { ToAddresses: ["jane@acme.com"] },
        Template: "RadiantSystemAdminWelcome",
        TemplateData: JSON.stringify({
            adminName: "Jane Doe",
            dashboardUrl: "https://admin.acme.com",
            temporaryPassword: <the temp password from step 2>,
            setupInstructions: "..."
        })
    })

Step 5: Deployer shows success
    "✅ Bootstrap admin created. Check jane@acme.com for login credentials."
```

**At this point, the admin account exists in Cognito and in the database, but with `status = 'pending_setup'`. The admin has NOT logged in yet. They have a temporary password in their email.**

### Phase C: First Login (Human — In Browser)

Jane opens the email, clicks the dashboard link, and sees the Radiant Admin login page.

```
Step 1: Jane enters email + temporary password
    
    Cognito response: NEW_PASSWORD_REQUIRED challenge
    (Cognito forces a password change on first login for AdminCreateUser accounts)

Step 2: Jane picks a new password (16+ chars, mixed case, digits, symbols)
    
    AWS SDK call: CognitoIdentityProvider.RespondToAuthChallenge({
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        ChallengeResponses: {
            USERNAME: "jane@acme.com",
            NEW_PASSWORD: "MySecure!Password#2026"
        }
    })
    
    Cognito response: SUCCESS + tokens (id_token, access_token, refresh_token)
    These are Pool B tokens.

Step 3: Dashboard middleware checks setup status
    
    GET /admin/system/setup-status
    Auth: Pool B id_token (Bearer)
    
    Response: { status: "pending_setup", setupSteps: {
        passwordChanged: true,   ← just did this
        mfaEnrolled: false,
        phoneVerified: false,
        profileCompleted: false
    }}
    
    Middleware sees pending_setup → REDIRECTS to /setup wizard
    (The admin cannot access ANY dashboard page until setup completes)
```

### Phase D: Setup Wizard (Human — In Browser)

```
┌──────────────────────────────────────────────────────────────────────┐
│  RADIANT ADMIN — First-Time Setup                                    │
│                                                                      │
│  ✅ Step 1: Password Changed                                         │
│  ⬜ Step 2: Verify Phone + Enable SMS MFA                            │
│  ⬜ Step 3: Complete Profile                                          │
│  ⬜ Step 4: Invite Backup Admin (recommended)                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Step 2: Phone Verification + MFA Enrollment (Combined)**

SMS MFA means phone verification and MFA enrollment are the same step. Verifying the phone number registers it as the MFA device.

```
    Jane enters her phone number: +1-555-867-5309
    
    POST /admin/system/verify-phone
    Body: { phoneNumber: "+15558675309" }
    
    Lambda:
      1. Updates Cognito user phone attribute:
         CognitoIdentityProvider.AdminUpdateUserAttributes({
             UserPoolId: <Pool B>,
             Username: "jane@acme.com",
             UserAttributes: [
                 { Name: "phone_number", Value: "+15558675309" },
                 { Name: "phone_number_verified", Value: "false" }
             ]
         })
      2. Creates system_admin_contacts row (type: phone, status: unverified)
      3. Sends verification SMS via Cognito:
         CognitoIdentityProvider.GetUserAttributeVerificationCode({
             AccessToken: <from auth>,
             AttributeName: "phone_number"
         })
         Cognito sends SMS via SNS: "RADIANT code: 847291"
    
    Jane enters the code from her phone.
    
    POST /admin/system/verify-phone/confirm
    Body: { code: "847291" }
    
    Lambda:
      1. Verifies with Cognito:
         CognitoIdentityProvider.VerifyUserAttribute({
             AccessToken: <from auth>,
             AttributeName: "phone_number",
             Code: "847291"
         })
      2. Enables SMS MFA for this user:
         CognitoIdentityProvider.AdminSetUserMFAPreference({
             UserPoolId: <Pool B>,
             Username: "jane@acme.com",
             SMSMfaSettings: { Enabled: true, PreferredMfa: true }
         })
      3. Updates contact: verification_status = 'verified'
      4. Updates system_admins: phone_verified = true, mfa_enabled = true,
         mfa_method = 'sms'
      5. Creates default SENTINEL alert routing:
         INSERT INTO system_admin_alert_routing (
             admin_id, alert_category, min_severity,
             contact_id, contact_type, contact_value
         ) VALUES
             (<admin_id>, '*', 1, <contact_id>, 'phone', '+15558675309'),
             (<admin_id>, '*', 3, <email_contact_id>, 'email', 'jane@acme.com');
         
         This means: SEV 1-2 → phone/SMS, SEV 3-5 → email
    
    ✅ Phone verified + SMS MFA enabled in one step.
    ✅ Future logins: Cognito auto-sends SMS code after password.
    ✅ Jane will receive SENTINEL alerts via SMS and email.
```

**Step 3: Profile Completion**

```
    Jane reviews/updates: display name, timezone, locale.
    
    POST /admin/system/complete-setup
    Body: { displayName: "Jane Doe", timezone: "America/New_York", locale: "en-US" }
    
    Lambda calls SystemAdminService.completeSetup(adminId):
      UPDATE system_admins
      SET status = 'active',
          setup_completed_at = NOW(),
          display_name = 'Jane Doe',
          timezone = 'America/New_York',
          locale = 'en-US'
      WHERE id = <admin_id> AND status = 'pending_setup'
    
    Audit log: action = 'setup_completed'
    
    ✅ Status is now 'active'. Jane has full super_admin access.
```

**Step 4: Invite Backup Admin (see Section 3 below)**

---

## 3. How the Second Super Admin Gets In

The second admin is created by the first admin — either during the setup wizard (step 5) or later from the System Admins management page.

### The Invitation Flow

```
Jane (super_admin, active) invites bob@acme.com as a second super_admin.

┌──────────────────────────────────────────────────────────────┐
│  Step 5: Invite Backup Admin                                  │
│                                                               │
│  ⚠ You are the only super_admin. We strongly recommend        │
│    inviting at least one backup admin.                        │
│                                                               │
│  Email:  [bob@acme.com          ]                             │
│  Role:   [super_admin ▼]                                      │
│  Name:   [Bob Smith             ]                             │
│                                                               │
│              [Skip]            [Send Invite →]                │
└──────────────────────────────────────────────────────────────┘

POST /admin/system/admins/invite
Auth: Pool B token (Jane's — must be super_admin to create super_admin)
Body: {
    email: "bob@acme.com",
    displayName: "Bob Smith",
    role: "super_admin"
}
```

### What Happens Server-Side

```
Step 1: Permission check
    extractSystemAdminContext(event) → Jane's Pool B token
    requireSystemSuperAdmin(ctx) → passes (Jane is super_admin)

Step 2: Create Cognito user in Pool B
    CognitoIdentityProvider.AdminCreateUser({
        UserPoolId: <same Pool B>,
        Username: "bob@acme.com",
        UserAttributes: [
            { Name: "email",               Value: "bob@acme.com" },
            { Name: "email_verified",      Value: "true" },
            { Name: "custom:admin_pool",   Value: "system" },
            { Name: "custom:admin_role",   Value: "super_admin" },
            { Name: "custom:is_bootstrap", Value: "false" },
            { Name: "custom:status",       Value: "pending_setup" },
            { Name: "custom:display_name", Value: "Bob Smith" }
        ],
        MessageAction: "SUPPRESS"
    })
    Returns: { User: { Username: "xyz-789-ghi" } }

Step 3: Create database row
    SystemAdminService.create({
        cognitoUserId: "xyz-789-ghi",
        email: "bob@acme.com",
        displayName: "Bob Smith",
        role: "super_admin"
    }, createdBy: Jane's admin ID)
    
    This is NOT bootstrap_system_admin() — that function is one-time only.
    This is SystemAdminService.create() which:
      - Checks that the creator (Jane) is super_admin
      - INSERTs into system_admins with status = 'pending_setup'
      - Writes audit log: action = 'admin_created', performed_by = Jane

Step 4: Send invitation email via SES
    Same RadiantSystemAdminWelcome template.
    Bob receives: dashboard URL, temporary password, setup instructions.
```

### Bob's First Login

**Bob goes through the exact same Phase C + Phase D as Jane did:**

1. Login with temp password → NEW_PASSWORD_REQUIRED → pick new password
2. Middleware detects `pending_setup` → redirect to `/setup`
3. Phone verification + SMS MFA enrollment (combined — same as Jane)
4. Profile completion → status changes to `active`
5. Step 4 (invite backup admin) is skipped — there are already 2 super_admins

**Bob's setup wizard does NOT show "Invite Backup Admin"** because the system already has ≥2 super_admins. The check is:

```sql
SELECT COUNT(*) FROM system_admins 
WHERE role = 'super_admin' AND status IN ('active', 'pending_setup');
-- If >= 2, skip step 4
```

### Key Differences: First Admin vs Second Admin

| Aspect | First Admin (Bootstrap) | Second Admin (Invited) |
|--------|------------------------|----------------------|
| **Who creates it** | Swift Deployer / CLI (automated) | Existing super_admin (human, via UI) |
| **API endpoint** | `POST /admin/system/bootstrap` (IAM auth) | `POST /admin/system/admins/invite` (Pool B auth) |
| **SQL function** | `bootstrap_system_admin()` — fails if any admin exists | `SystemAdminService.create()` — requires creator to be super_admin |
| **`is_bootstrap` flag** | `true` | `false` |
| **`created_by` field** | `NULL` (no prior admin exists) | UUID of the creating admin |
| **Can be called again** | No — one-time only | Yes — unlimited invitations |
| **Setup wizard step 4** | Shows "Invite Backup Admin" | Hidden (≥2 admins exist) |
| **Cognito user creation** | Deployer's IAM credentials | Lambda's IAM role (on behalf of existing admin) |

---

## 4. What Already Exists vs What Needs to Be Built

### Already Built (v7.38.0)

| Component | Location | Status |
|-----------|----------|--------|
| `bootstrap_system_admin()` SQL function | `V2026_02_07_015__system_admin_separation.sql` | ✅ Done |
| `prevent_last_super_admin_removal` trigger | Same migration | ✅ Done |
| `SystemAdminService.bootstrapFirstAdmin()` | `system-admin-auth.ts` | ✅ Done |
| `SystemAdminService.create()` | `system-admin-auth.ts` | ✅ Done |
| `SystemAdminService.completeSetup()` | `system-admin-auth.ts` | ✅ Done |
| `SystemAdminService.recordLogin()` | `system-admin-auth.ts` | ✅ Done |
| `SystemAdminService.recordFailedLogin()` | `system-admin-auth.ts` | ✅ Done |
| Pool B auth middleware (`extractSystemAdminContext`) | `system-admin-auth.ts` | ✅ Done |
| Permission/role checks | `system-admin-auth.ts` | ✅ Done |
| Cognito Pool B (CDK) | `admin-stack.ts` | ✅ Done |
| Contact verification methods | `contact-verification.service.ts` | ✅ Done |
| Dual SENTINEL resolution | `sentinel-notifier.service.ts` | ✅ Done |

### Needs to Be Built

| Component | Location | Description |
|-----------|----------|-------------|
| **Swift: `bootstrapAdminEmail`/`Name` fields** | `InstallationParameters.swift` | Add fields to installation config |
| **Swift: Bootstrap service** | `Services/SystemAdminBootstrapService.swift` | Cognito AdminCreateUser + API call + SES email |
| **Swift: Wire `createInitialAdmin()`** | `DeploymentService.swift` (line 1263) | Currently a stub — call bootstrap service |
| **CDK: SES email template** | `admin-stack.ts` | `RadiantSystemAdminWelcome` template resource |
| **CDK: IAM authorizer on bootstrap route** | `admin-stack.ts` | `AWS_IAM` auth on `/admin/system/bootstrap` only |
| **Lambda: System admin handler** | `lambda/admin/system-admin.ts` | Route handler for bootstrap, setup, invite, CRUD |
| **Lambda: Setup status endpoint** | Same handler | `GET /admin/system/setup-status` |
| **Lambda: MFA enrollment endpoints** | Same handler | `POST /enroll-mfa`, `POST /enroll-mfa/verify` |
| **Lambda: Phone verification endpoints** | Same handler | `POST /verify-phone`, `POST /verify-phone/confirm` |
| **Lambda: Complete setup endpoint** | Same handler | `POST /complete-setup` |
| **Lambda: Invite admin endpoint** | Same handler | `POST /admins/invite` |
| **Dashboard: Setup wizard page** | `app/(dashboard)/setup/page.tsx` | Multi-step wizard component |
| **Dashboard: Middleware redirect** | `middleware.ts` | Detect `pending_setup` → redirect to `/setup` |
| **CLI: `admin bootstrap` command** | `packages/cli/src/commands/admin-bootstrap.ts` | Headless bootstrap alternative |

---

## 5. Implementation Plan

### Phase 1: Lambda Handler + API Endpoints (Backend)

Create `lambda/admin/system-admin.ts` with all 8 routes. This is the core — everything else calls into it.

### Phase 2: CDK Updates (Infrastructure)

- SES template for welcome email
- IAM authorizer on bootstrap route
- Wire system-admin handler into API Gateway

### Phase 3: Swift Deployer (Deployment Trigger)

- Add `bootstrapAdminEmail`/`Name` to `InstallationParameters`
- Implement `SystemAdminBootstrapService.swift`
- Wire into `createInitialAdmin()` stub

### Phase 4: Admin Dashboard Setup Wizard (Frontend)

- Setup wizard page + components
- Middleware redirect for `pending_setup`
- Warning banner for single-admin deployments

### Phase 5: CLI Command (Alternative Trigger)

- `packages/cli/src/commands/admin-bootstrap.ts`
- Same Cognito + API calls as Swift Deployer

---

## Visual Summary

```
                    DEPLOYMENT TIME                          FIRST LOGIN
                    ─────────────                           ───────────
                                                            
Swift Deployer      Cognito         Database                Browser        Admin API
     │              Pool B                                     │
     │                                                         │
     ├─ AdminCreateUser ──►│                                   │
     │  (email, temp pw)   │                                   │
     │◄── sub: abc-123 ───┤                                   │
     │                     │                                   │
     ├─ POST /bootstrap ──────────────────► bootstrap_system_admin()
     │  (IAM auth)         │                  │
     │                     │                  ├─► system_admins row
     │                     │                  │   (pending_setup)
     │◄── 201 Created ────────────────────────┤
     │                     │                  │
     ├─ SES email ─────────────────── ✉️ to jane@acme.com
     │  (temp password)    │                  │
     │                     │                  │
     ▼ DONE                │                  │        Jane opens email
                           │                  │            │
                           │                  │            ├─ Login (temp pw)
                           │◄── auth ────────────────────┤
                           │── NEW_PW_REQUIRED ──────────►│
                           │◄── new password ─────────────┤
                           │── tokens (Pool B) ──────────►│
                           │                  │            │
                           │                  │            ├─ GET /setup-status
                           │                  │◄───────────┤  → pending_setup
                           │                  │────────────►│  → redirect /setup
                           │                  │            │
                           │                  │            ├─ POST /enroll-mfa
                           │◄── AssociateSoftwareToken ───┤
                           │── QR secret ─────────────────►│  Jane scans QR
                           │◄── 6-digit code ─────────────┤
                           │── VerifySoftwareToken ───────►│
                           │                  │            │  ✅ MFA enrolled
                           │                  │            │
                           │                  │            ├─ POST /verify-phone
                           │                  │◄───────────┤  SNS sends SMS
                           │                  │            │  Jane enters code
                           │                  │            ├─ POST /verify-phone/confirm
                           │                  │◄───────────┤  phone_verified = true
                           │                  │            │  ✅ Phone verified
                           │                  │            │
                           │                  │            ├─ POST /complete-setup
                           │                  │◄───────────┤
                           │                  │  status = 'active'
                           │                  │────────────►│  ✅ FULL ACCESS
                           │                  │            │
                           │                  │            ├─ POST /admins/invite
                           │                  │            │  (bob@acme.com)
                           │  AdminCreateUser │◄───────────┤
                           │◄─ (Bob) ────────────────────┤
                           │                  │  create() │
                           │                  │◄───────────┤  Bob: pending_setup
                           │                  │            │
                           │                  │  SES email │
                           │                  │──── ✉️ ────►  to bob@acme.com
                           │                  │            │
                           │                  │            │  Bob repeats C+D
                           │                  │            │  independently
```

---

*Document created: February 7, 2026*
*Requires approval before implementation begins*
