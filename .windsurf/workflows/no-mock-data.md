---
description: Policy - No mock data allowed in production code
---

# No Mock Data Policy

**CRITICAL RULE**: Mock data is NOT allowed in production code. Administrators must always see real data to make informed decisions.

## What is prohibited

1. **Mock data constants** - Variables named `mock*`, `fake*`, `dummy*`, or `sample*` containing hardcoded data
2. **Fallback to mock data** - Using mock data when API calls fail (use error states instead)
3. **Demo/placeholder data** - Hardcoded arrays or objects used for UI demonstration

## What to use instead

1. **API calls** - Always fetch real data from backend APIs
2. **Loading states** - Show spinners/skeletons while data loads
3. **Error states** - Display error messages with retry buttons when API calls fail
4. **Empty states** - Show "No data available" when there's no real data

## Example - WRONG ❌

```typescript
const mockUsers = [
  { id: '1', name: 'John Doe' },
  { id: '2', name: 'Jane Smith' },
];

// Fallback to mock data
const data = apiData || mockUsers;
```

## Example - CORRECT ✅

```typescript
const [users, setUsers] = useState<User[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  async function loadData() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const { data } = await res.json();
        setUsers(data || []);
      } else {
        setError('Failed to load users');
      }
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  }
  loadData();
}, []);

if (loading) return <Spinner />;
if (error) return <ErrorMessage message={error} onRetry={loadData} />;
if (users.length === 0) return <EmptyState message="No users found" />;
```

## Enforcement

When reviewing or creating code:
1. Search for patterns: `const mock`, `= mock`, `|| mock`, `function mock`
2. Remove any mock data constants
3. Replace with proper API loading patterns
4. Add appropriate loading, error, and empty states
