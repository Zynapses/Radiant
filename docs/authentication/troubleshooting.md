# Authentication Troubleshooting Guide

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: All Users & Administrators

This guide helps resolve common authentication issues in RADIANT.

---

## Table of Contents

1. [Sign-In Issues](#sign-in-issues)
2. [Password Problems](#password-problems)
3. [MFA Issues](#mfa-issues)
4. [SSO Problems](#sso-problems)
5. [Session Issues](#session-issues)
6. [OAuth/Integration Issues](#oauthintegration-issues)
7. [Language/Display Issues](#languagedisplay-issues)
8. [Administrator Troubleshooting](#administrator-troubleshooting)
9. [Getting Help](#getting-help)

---

## Sign-In Issues

### "Invalid email or password"

**Symptoms:** Error message after entering credentials

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Incorrect password | Passwords are case-sensitive. Check Caps Lock |
| Wrong email address | Verify you're using the correct email |
| Account not verified | Check email for verification link |
| Account suspended | Contact your administrator |
| Using SSO email with password | Use the SSO sign-in flow instead |

**Steps to Resolve:**
1. Double-check your email address for typos
2. Try resetting your password via "Forgot password?"
3. Check your email (including spam) for verification links
4. Contact your admin if the issue persists

### "Account locked"

**Symptoms:** Cannot sign in, message says account is locked

**Cause:** Too many failed sign-in attempts (typically 5+)

**Solutions:**
1. **Wait** - Accounts auto-unlock after 15 minutes
2. **Reset password** - Use "Forgot password?" to unlock immediately
3. **Contact admin** - They can manually unlock your account

### "Your session has expired"

**Symptoms:** Redirected to sign-in page while working

**Cause:** Session timeout due to inactivity or maximum session length reached

**Solutions:**
1. Sign in again - your work should be saved
2. If this happens frequently, contact your admin about session policies

### "Sign-in not allowed"

**Symptoms:** Error after entering valid credentials

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| IP restrictions | Connect from an allowed network/VPN |
| Account disabled | Contact your administrator |
| SSO required | Use your organization's SSO instead |
| Tenant suspended | Contact RADIANT support |

---

## Password Problems

### "Password does not meet requirements"

**Symptoms:** Cannot set new password

**Requirements (typical):**
- Minimum 12 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)
- Cannot be a previously used password

**Tips for Strong Passwords:**
- Use a passphrase: `Coffee-Mountain-7Blue!`
- Use a password manager to generate random passwords
- Avoid personal information (birthdays, names)

### "Password reset link expired"

**Symptoms:** Clicking reset link shows error

**Cause:** Reset links expire after 24 hours

**Solution:**
1. Go to the sign-in page
2. Click "Forgot password?" again
3. Request a new reset link
4. Use the new link within 24 hours

### Not receiving password reset email

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Email in spam/junk | Check spam folder |
| Wrong email entered | Try again with correct email |
| Email delivery delay | Wait 5-10 minutes |
| Email system issues | Contact admin |

**Note:** For security, we show the same message whether the email exists or not.

---

## MFA Issues

### "Invalid code"

**Symptoms:** MFA code is rejected

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Code expired | Wait for new code (changes every 30 seconds) |
| Device clock incorrect | Enable automatic time sync |
| Wrong account | Verify using RADIANT entry in your app |
| Already used | Each code works only once |

**Fix Clock Sync:**
- **iOS:** Settings → General → Date & Time → Set Automatically
- **Android:** Settings → System → Date & Time → Automatic
- **Windows:** Settings → Time & Language → Sync now
- **Mac:** System Preferences → Date & Time → Set automatically

### Lost access to authenticator app

**If you have backup codes:**
1. On the MFA screen, click "Use a backup code"
2. Enter one of your saved backup codes
3. Sign in and set up a new authenticator

**If you don't have backup codes:**
1. Click "Can't access your code?"
2. Follow the recovery process
3. You may need admin assistance

### "MFA required" but I didn't enable it

**Cause:** Your organization enforces MFA for your role

**Solution:**
1. Follow the MFA setup prompts
2. This is required - you cannot skip it
3. Contact your admin if you have questions

### New phone - how to transfer MFA?

**Best approach (before wiping old phone):**
1. Sign in on a computer
2. Go to Account Settings → Security
3. Click "Change Authenticator"
4. Set up MFA on your new phone
5. Your old phone's entry will stop working

**If old phone is already wiped:**
1. Use a backup code to sign in
2. Set up MFA fresh on your new phone

---

## SSO Problems

### "SSO configuration not found"

**Symptoms:** Error when trying to sign in with work email

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| SSO not configured | Contact your IT admin |
| Using wrong email domain | Use your work email, not personal |
| SSO temporarily disabled | Contact your IT admin |

### "SAML assertion invalid"

**Symptoms:** Error after authenticating with your identity provider

**Possible Causes:**
- Certificate mismatch
- Clock skew between systems
- Attribute mapping issues

**Solutions:**
1. Try again - sometimes temporary
2. Clear browser cookies and cache
3. Contact your IT admin to check SSO configuration

### Stuck in redirect loop

**Symptoms:** Page keeps redirecting between RADIANT and identity provider

**Solutions:**
1. Clear all cookies for both sites
2. Try incognito/private browser window
3. Disable browser extensions temporarily
4. Contact IT admin if persists

### "User not provisioned"

**Symptoms:** SSO authentication succeeds but RADIANT denies access

**Cause:** Your account doesn't exist in RADIANT yet

**Solutions:**
1. Contact your organization admin to provision your account
2. If auto-provisioning should be enabled, admin needs to check SSO settings

---

## Session Issues

### Logged out unexpectedly

**Possible Causes:**
| Cause | Explanation |
|-------|-------------|
| Inactivity timeout | Session ended due to no activity |
| Absolute timeout | Maximum session length reached |
| Admin terminated session | Your admin ended your session |
| Signed in elsewhere | Concurrent session limit reached |
| Password changed | All sessions end when password changes |

### Can't stay signed in

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Cookies blocked | Enable cookies for RADIANT domain |
| Private browsing | Sessions don't persist in incognito |
| Browser settings | Check "clear cookies on close" |
| Strict session policy | Normal for high-security environments |

### Signed in on wrong account

**Solution:**
1. Click your avatar → Sign Out
2. Sign in with the correct account

---

## OAuth/Integration Issues

### "Invalid redirect URI"

**Symptoms:** Error when authorizing a third-party app

**Cause:** The app's callback URL doesn't match registered URIs

**Solutions:**
- **For users:** Contact the app developer
- **For developers:** Ensure redirect URI exactly matches registration

### "Invalid client"

**Symptoms:** OAuth authorization fails immediately

**Cause:** Client ID is incorrect or application is disabled

**Solutions:**
- **For users:** Contact the app developer
- **For developers:** Verify client ID and check if app is active

### "Access denied"

**Symptoms:** You clicked "Allow" but got an error

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Scope not allowed | App requesting unauthorized permissions |
| App suspended | Contact app developer |
| Tenant doesn't allow app | Contact your admin |

### Revoking app access

To disconnect a third-party app:
1. Go to Account Settings → Connected Apps
2. Find the app
3. Click "Revoke" or "Disconnect"
4. Confirm

---

## Language/Display Issues

### Interface in wrong language

**Solutions:**
1. Click avatar → Settings → Language
2. Select your preferred language
3. Interface updates immediately

### RTL layout issues

**Symptoms:** Arabic text displays incorrectly

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Browser override | Check browser language settings |
| CSS not loaded | Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) |
| Mixed content | Some elements intentionally stay LTR |

### Characters not displaying

**Symptoms:** Boxes (□) or question marks (?) instead of text

**Solutions:**
1. Ensure your system has fonts for that language
2. Try a different browser
3. Check if the page is loading completely

---

## Administrator Troubleshooting

### User can't sign in (Admin view)

**Diagnostic steps:**
1. Check user status (active, suspended, pending?)
2. Check for recent failed login attempts
3. Verify user is in correct tenant
4. Check IP restriction rules
5. Review audit logs for errors

**Common fixes:**
- Reset user's password
- Reset user's MFA
- Unlock account
- Clear IP restriction (if applicable)

### SSO not working for tenant

**Diagnostic steps:**
1. Verify SSO configuration in Admin → Authentication → SSO
2. Check certificate expiration
3. Test with "Test Connection" button
4. Review SSO-specific audit logs
5. Verify attribute mappings

**Common fixes:**
- Update expired certificate
- Correct attribute mappings
- Enable SSO for user accounts
- Check IdP configuration

### High failure rate in authentication logs

**Investigation:**
1. Check for bot/attack patterns (same IP, many users)
2. Verify recent configuration changes
3. Check if legitimate service accounts are failing
4. Review rate limiting effectiveness

**Actions:**
- Enable/increase rate limiting
- Block suspicious IPs
- Alert affected users
- Consider enabling CAPTCHA

### MFA adoption is low

**Strategies:**
1. Change policy from "Hidden" to "Encouraged"
2. Send communication about MFA benefits
3. Set a deadline for "Required" enforcement
4. Provide help resources for setup

---

## Getting Help

### Self-Service Resources

| Resource | Description |
|----------|-------------|
| This guide | Common issues and solutions |
| In-app help | Click ? icon in application |
| Knowledge base | Searchable articles |
| Status page | Check for ongoing incidents |

### Contact Support

**For End Users:**
1. Contact your organization's IT administrator first
2. Use the in-app help chat (if available)
3. Email support at address provided by your organization

**For Tenant Administrators:**
1. Check RADIANT Admin documentation
2. Use the Admin support channel
3. Submit a support ticket

**For Platform Administrators:**
1. Check runbooks in `/docs/runbooks/`
2. Escalate via on-call procedures
3. Access emergency support channels

### Information to Provide

When contacting support, include:
- Your email address
- Tenant/organization name
- Browser and OS version
- Steps to reproduce the issue
- Screenshots (if applicable)
- Error messages (exact text)
- Timestamp of the issue

---

## Error Code Reference

| Code | Meaning | Resolution |
|------|---------|------------|
| `AUTH001` | Invalid credentials | Check email/password |
| `AUTH002` | Account locked | Wait 15 min or reset password |
| `AUTH003` | Account suspended | Contact admin |
| `AUTH004` | MFA required | Set up MFA |
| `AUTH005` | MFA invalid | Check code and time sync |
| `AUTH006` | Session expired | Sign in again |
| `AUTH007` | IP restricted | Use allowed network |
| `AUTH008` | SSO required | Use SSO sign-in |
| `AUTH009` | Rate limited | Wait and retry |
| `AUTH010` | Service unavailable | Check status page |

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [User Guide](./user-guide.md)
- [MFA Guide](./mfa-guide.md)
- [Tenant Admin Guide](./tenant-admin-guide.md)
