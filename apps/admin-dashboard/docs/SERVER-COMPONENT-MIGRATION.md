# Server Component Migration Guide

This guide explains how to migrate pages from client components to the server/client split pattern for better performance.

## Why Server Components?

- **Smaller JavaScript bundles** - Server components don't ship JavaScript to the client
- **SEO benefits** - Metadata can be set at the server level
- **Error boundaries** - Better error isolation per page
- **Faster initial load** - Less JavaScript to parse

## Migration Pattern

### Before (100% Client)

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
// ... all imports

export default function MyPage() {
  const { data } = useQuery({ ... });
  return <div>...</div>;
}
```

### After (Server + Client Split)

**1. Create a client component (`my-page-client.tsx`):**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { SectionErrorBoundary } from '@/components/common/error-boundaries';
// ... all imports

export function MyPageClient() {
  const { data } = useQuery({ ... });
  return (
    <SectionErrorBoundary>
      <div>...</div>
    </SectionErrorBoundary>
  );
}
```

**2. Update the page to be a server component (`page.tsx`):**

```tsx
import type { Metadata } from 'next';
import { MyPageClient } from './my-page-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'My Page',
  description: 'Description for SEO',
};

export default function MyPage() {
  return (
    <PageErrorBoundary>
      <MyPageClient />
    </PageErrorBoundary>
  );
}
```

## Benefits of This Pattern

1. **Metadata** - `export const metadata` only works in server components
2. **Error Boundaries** - Each page wrapped in `PageErrorBoundary`
3. **Section Isolation** - Use `SectionErrorBoundary` for independent sections
4. **Gradual Migration** - Can migrate pages one at a time

## Pages Already Migrated

- ✅ `/health` - `health-client.tsx`

## Migration Checklist

When migrating a page:

1. [ ] Create `[page-name]-client.tsx` with `'use client'` directive
2. [ ] Move all React hooks and interactivity to client component
3. [ ] Update `page.tsx` to be a server component (no `'use client'`)
4. [ ] Add `export const metadata` for SEO
5. [ ] Wrap with `PageErrorBoundary`
6. [ ] Add `SectionErrorBoundary` around independent sections
7. [ ] Test the page works correctly

## Error Boundary Types

| Boundary | Use Case |
|----------|----------|
| `AppErrorBoundary` | Top-level, wraps entire app |
| `PageErrorBoundary` | Page-level, shows page error UI |
| `SectionErrorBoundary` | Section-level, isolates component errors |
| `QueryErrorBoundary` | For data fetching components |

## Notes

- Pages using React Query must have a client component for the interactive parts
- Static content (headers, descriptions) can stay in server component
- The split adds minimal overhead (~100 bytes per page)
