---
description: Input sanitization policy - only applies when HIPAA/PHI compliance is enabled
---

# HIPAA/PHI Conditional Input Sanitization Policy

## Overview
Input sanitization in Radiant is **conditional** and only applies when HIPAA/PHI compliance mode is enabled in the database. This policy ensures consistent handling across all Lambda handlers.

## Database Setting
Sanitization is controlled by the `hipaa_phi_enabled` setting in the `system_config` table under the `security` category.

```sql
-- Check current setting
SELECT value FROM system_config WHERE category = 'security' AND key = 'hipaa_phi_enabled';

-- Enable HIPAA/PHI mode (enables sanitization)
UPDATE system_config SET value = 'true' WHERE category = 'security' AND key = 'hipaa_phi_enabled';

-- Disable HIPAA/PHI mode (disables sanitization)
UPDATE system_config SET value = 'false' WHERE category = 'security' AND key = 'hipaa_phi_enabled';
```

## Implementation Rules

### 1. Always use the sanitization middleware
When handling user input in Lambda handlers, use the sanitization functions from:
```typescript
import { sanitizeRequest, sanitizeRequestBody, sanitizeQueryParams, sanitizePathParams } from '../shared/middleware/input-sanitization';
```

### 2. The middleware handles the HIPAA/PHI check internally
Do NOT manually check for HIPAA/PHI mode before calling sanitization functions. The middleware automatically:
- Checks the `hipaa_phi_enabled` database setting
- Applies sanitization only when enabled
- Returns unsanitized data when disabled (but still validates JSON)

### 3. Check sanitization status if needed
If you need to know whether sanitization is active (for logging, UI display, etc.):
```typescript
import { isSanitizationEnabled } from '../shared/middleware/input-sanitization';

const sanitizationActive = await isSanitizationEnabled();
```

### 4. When sanitization is enabled, it applies:
- HTML escaping (prevents XSS)
- SQL injection detection (blocks suspicious patterns)
- Null byte removal
- Unicode normalization (NFC)
- String trimming
- Length validation
- Array size limits
- Body size limits

### 5. When sanitization is disabled:
- JSON parsing still occurs (invalid JSON still throws errors)
- No content modification or validation beyond JSON parsing
- Raw user input is passed through

## Example Handler Usage

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { sanitizeRequest } from '../shared/middleware/input-sanitization';
import { successResponse, handleError } from '../shared/middleware/api-response';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Sanitization automatically applies based on HIPAA/PHI database setting
    const { body, queryParams, pathParams } = await sanitizeRequest<MyRequestType>(event);
    
    // Use sanitized data...
    
    return successResponse({ data: result });
  } catch (error) {
    return handleError(error);
  }
}
```

## Adding New Sanitization Features

When adding new sanitization features:

1. Add the feature to `input-sanitization.ts`
2. Gate it behind the `hipaaPhiEnabled` check
3. Add corresponding config option to `system_config` table
4. Update this workflow documentation

## Testing

To test sanitization behavior:
```bash
# Test with HIPAA/PHI enabled
curl -X POST /api/endpoint -d '{"field": "<script>alert(1)</script>"}'
# Should return escaped: &lt;script&gt;alert(1)&lt;/script&gt;

# Test with HIPAA/PHI disabled  
curl -X POST /api/endpoint -d '{"field": "<script>alert(1)</script>"}'
# Should return raw: <script>alert(1)</script>
```
