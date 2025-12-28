---
description: Policy - No hardcoded UI text allowed, all strings must be localized
---

# No Hardcoded UI Text Policy

**MANDATORY**: All user-facing text in Radiant and Think Tank must be localized through the localization registry. No hardcoded strings are permitted.

## Rules

1. **NEVER hardcode UI text** - All user-visible strings must use the localization system
2. **Register all strings** - Every new UI string must be registered in the localization registry
3. **Use translation keys** - Reference strings by their localization key, not raw text
4. **Include all languages** - Translations must be provided for all supported languages

## Supported Languages

- English (en) - Primary
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Japanese (ja)
- Korean (ko)
- Chinese Simplified (zh-CN)
- Chinese Traditional (zh-TW)
- Arabic (ar)
- Hebrew (he)
- Russian (ru)
- Dutch (nl)
- Polish (pl)
- Turkish (tr)

## Implementation

### 1. Register String in Backend

```typescript
import { localizationService } from '@/services/localization';

// Register the string
await localizationService.registerString({
  key: 'thinktank.chat.send_button',
  defaultText: 'Send Message',
  context: 'Button label for sending chat messages',
  category: 'thinktank',
});
```

### 2. Use in React Components

```tsx
import { useTranslation } from '@/hooks/useTranslation';

function ChatInput() {
  const { t } = useTranslation();
  
  return (
    <button>{t('thinktank.chat.send_button')}</button>
  );
}
```

### 3. Add Translations via Admin Dashboard

Navigate to: Admin Dashboard → Localization → Add Translation

Or use the API:
```typescript
await localizationService.setTranslation(
  'thinktank.chat.send_button',
  'es',
  'Enviar Mensaje'
);
```

## String Key Naming Convention

Use dot-notation with these prefixes:
- `common.*` - Shared across all apps
- `admin.*` - Admin dashboard specific
- `thinktank.*` - Think Tank specific
- `deployer.*` - Swift Deployer specific
- `errors.*` - Error messages
- `validation.*` - Form validation messages

Examples:
- `common.buttons.save`
- `common.buttons.cancel`
- `thinktank.chat.placeholder`
- `thinktank.settings.language_label`
- `errors.network.connection_failed`

## Categories

- `buttons` - Button labels
- `labels` - Form labels
- `placeholders` - Input placeholders
- `messages` - User-facing messages
- `errors` - Error messages
- `tooltips` - Tooltip text
- `headings` - Page/section headings
- `navigation` - Nav menu items

## Code Review Checklist

Before approving any PR, verify:

- [ ] No hardcoded strings in JSX/TSX
- [ ] No hardcoded strings in Swift UI
- [ ] All new strings registered with `registerString()`
- [ ] Translation keys follow naming convention
- [ ] Context provided for translators
- [ ] Translations added for at least English + Spanish

## Exceptions

The ONLY exceptions are:
- Brand names: "Radiant", "Think Tank"
- Technical identifiers shown to developers
- Log messages (not user-facing)
- Test fixtures

## Enforcement

This policy is enforced by:
1. ESLint rule: `no-hardcoded-strings` (custom)
2. Code review checklist
3. CI/CD pipeline checks
