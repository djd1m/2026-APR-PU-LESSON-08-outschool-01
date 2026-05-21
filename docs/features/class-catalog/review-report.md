# Review Report: class-catalog

**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 1 blocker, 3 high, 4 medium, 3 low
- Verdict: NEEDS FIX

## Findings

### [blocker] -- Frontend expects `res.data` but API returns `{ success: true, data: { items, meta } }`

**What's broken:** The `ClassesPage` (`classes/page.tsx:56-57`) calls `apiFetch<{ data: ClassItem[] }>('/classes?...')` and then accesses `res.data`. But the API wraps all responses in `TransformInterceptor` which produces `{ success: true, data: { items: [...], meta: {...} } }`. So `res.data` yields `{ items, meta }`, not an array. Then `res.data` is set as `classes`, but it's an object, not `ClassItem[]`.

**Why it's wrong:** The class list page will either crash with "classes.map is not a function" or render zero results. The type assertion `<{ data: ClassItem[] }>` masks the real shape. The actual data is at `res.data.items` (after `apiFetch` unwraps the first layer, you get `{ items, meta }` from which you need `.items`). Actually, `apiFetch` returns `res.json()` which is `{ success: true, data: { items, meta } }`. So `apiFetch<{ data: ClassItem[] }>` returns the full wrapper, and `res.data` gives `{ items, meta }` -- still not an array.

**How to fix:** Change the frontend to:
```typescript
apiFetch<{ items: ClassItem[]; meta: any }>('/classes?...')
  .then((res) => setClasses(res.items))
```
Or better: create a typed API layer that understands the wrapper format. The `TransformInterceptor` wraps in `{ success, data }`, so `apiFetch` should unwrap that layer.

**File:** `packages/web/src/app/(main)/classes/page.tsx:56-57`, `packages/api/src/common/interceptors/transform.interceptor.ts`

---

### [high] -- Elasticsearch search endpoint has no input validation

**What's broken:** `SearchController.search()` receives `@Query('q') query: string` with no validation. No minimum length check, no maximum length check, no sanitization. The refinement doc requires: "query length > 200 -> 400", "minimum query length 3 chars".

**Why it's wrong:** An empty query or a massive query string gets passed directly to Elasticsearch's `multi_match`. An empty `query` parameter causes an ES error. A very long query wastes ES resources. Without sanitization, Elasticsearch query injection is theoretically possible (though `multi_match` is generally safe).

**How to fix:**
1. Add a DTO with `@IsString()`, `@MinLength(3)`, `@MaxLength(200)` for the query parameter.
2. Add validation for `ageMin` and `ageMax` (ensure ageMin <= ageMax, both within 3-18 range).
3. Apply `ZodValidationPipe` or class-validator pipe to the search endpoint.

**File:** `packages/api/src/modules/search/search.controller.ts:9-14`

---

### [high] -- No circuit breaker for Elasticsearch

**What's broken:** The refinement doc describes a full circuit breaker pattern: "3 errors in 30 sec -> open circuit -> fallback to PostgreSQL ILIKE -> half-open after 60 sec". The actual `SearchService` has a single `try/catch` in `onModuleInit` that prints a warning if ES is unavailable at startup, but the `search()` method has no error handling at all. If ES goes down after startup, `search()` throws an unhandled error and returns 500 to the user.

**Why it's wrong:** In production, Elasticsearch can become temporarily unavailable (GC pauses, network issues, OOM). Without a circuit breaker and fallback, the entire search feature goes down hard instead of degrading gracefully.

**How to fix:**
1. Wrap `search()` in a try/catch that catches ES connection errors.
2. Implement a circuit breaker (e.g., `opossum` library or manual state machine).
3. Add a PostgreSQL fallback using `ILIKE '%query%'` on the `classes` table.
4. Track circuit state so repeated failures don't keep hammering a dead ES.

**File:** `packages/api/src/modules/search/search.service.ts:64-107`

---

### [high] -- No Russian morphological analyzer configured in Elasticsearch

**What's broken:** The ES index creation in `search.service.ts:31` uses `analyzer: 'standard'` for `title` and `description`. The spec requires: "Russian morphological stemmer". The refinement doc gives examples like "rysovat' -> risovanie" (stemming across word forms).

**Why it's wrong:** The `standard` analyzer tokenizes and lowercases but does not handle Russian morphology. Searching "rysovat'" will NOT match "risovanie". The spec explicitly requires this and marks it as a Critical feature.

**How to fix:**
1. Create a custom analyzer in the index settings that uses the `russian` stemmer:
```json
{
  "analysis": {
    "analyzer": {
      "russian_custom": {
        "type": "custom",
        "tokenizer": "standard",
        "filter": ["lowercase", "russian_stop", "russian_stemmer"]
      }
    },
    "filter": {
      "russian_stop": { "type": "stop", "stopwords": "_russian_" },
      "russian_stemmer": { "type": "stemmer", "language": "russian" }
    }
  }
}
```
2. Apply this analyzer to `title` and `description` fields.

**File:** `packages/api/src/modules/search/search.service.ts:26-43`

---

### [medium] -- No pagination for search results

**What's broken:** The `search()` method hardcodes `size: 20` and returns all hits without pagination support (no cursor, no offset, no "load more"). The spec requires cursor-based pagination: "load first 20, then 'Show more' loads next 20".

**Why it's wrong:** Users with many results can only see the first 20. The frontend has no "load more" button for search results.

**How to fix:** Add `from` parameter to ES search, or implement `search_after` for cursor-based pagination. Pass cursor/page from the frontend.

**File:** `packages/api/src/modules/search/search.service.ts:89-97`

---

### [medium] -- Search and class listing are disconnected

**What's broken:** The frontend `ClassesPage` fetches from `/classes` (PostgreSQL via `ClassesController`), but when a search query is entered, it still fetches from `/classes` with `?q=...`. The `ClassesController.findAll()` does not support a `q` parameter -- there is no full-text search on the PostgreSQL path. The Elasticsearch search endpoint at `/search?q=...` is never called from the frontend.

**Why it's wrong:** The search bar in the catalog UI does nothing useful. It passes `q` as a URL param to `/classes`, but the backend ignores it. The actual ES-powered search at `/search` is orphaned.

**How to fix:**
1. When `search` is non-empty, call `/search?q=...` instead of `/classes`.
2. Or integrate ES search into the `/classes` endpoint when a `q` parameter is present.
3. Ensure the response shapes are compatible between both endpoints.

**File:** `packages/web/src/app/(main)/classes/page.tsx:50-58`, `packages/api/src/modules/classes/classes.controller.ts:26-40`

---

### [medium] -- No debouncing on search input

**What's broken:** `SearchBar` calls `onChange` on every keystroke, and `ClassesPage` triggers an API fetch on every `search` state change via `useEffect`. Typing "math" fires 4 API requests: "m", "ma", "mat", "math".

**Why it's wrong:** This hammers the API with unnecessary requests, wastes bandwidth, and can trigger rate limits. With ES in the loop, it's even more wasteful.

**How to fix:** Add a debounce (300-500ms) in `ClassesPage` before triggering the API call. Use `useDeferredValue` or a debounce utility.

**File:** `packages/web/src/app/(main)/classes/page.tsx:48-59`, `packages/web/src/components/SearchBar.tsx`

---

### [medium] -- Age filter logic is inverted

**What's broken:** In `classes.service.ts:71-72`, the filter logic is:
```typescript
if (ageMin) where.ageMin = { gte: ageMin };
if (ageMax) where.ageMax = { lte: ageMax };
```
This finds classes where `class.ageMin >= filter.ageMin AND class.ageMax <= filter.ageMax`. But the spec says "display classes with overlapping age range". A class for ages 5-12 should match a filter of 7-10, but with this logic it won't (because class.ageMin=5 is NOT >= 7).

**Why it's wrong:** Parents filtering for "7-10 year olds" will miss classes that accept 5-12 year olds, which are perfectly valid matches. The filter is too restrictive.

**How to fix:** For overlapping ranges, the correct condition is: `class.ageMin <= filter.ageMax AND class.ageMax >= filter.ageMin`.
```typescript
if (ageMin) where.ageMax = { gte: ageMin };  // class end >= filter start
if (ageMax) where.ageMin = { lte: ageMax };  // class start <= filter end
```

**File:** `packages/api/src/modules/classes/classes.service.ts:71-72`

---

### [low] -- Class detail page uses server component with client-side apiFetch

**What's broken:** `classes/[id]/page.tsx` is an `async function` (Server Component) that calls `apiFetch()`. But `apiFetch()` reads `localStorage` for auth headers, which is only available in the browser. In a Server Component, `typeof window === 'undefined'`, so no auth header is sent.

**Why it's wrong:** The class detail page will work for public data (no auth needed for viewing), but the pattern is fragile. If the endpoint ever requires auth, it will silently fail. The `apiFetch` function has SSR safety checks that return empty headers server-side, so it works by accident.

**How to fix:** For Server Components, use a separate server-side fetch utility that doesn't depend on `localStorage`. Or convert to a Client Component with `useEffect`.

**File:** `packages/web/src/app/(main)/classes/[id]/page.tsx:57-63`

---

### [low] -- No SEO meta tags on class detail page

**What's broken:** The spec requires: "SEO: detail page has meta title/description for indexing." The `ClassDetailPage` renders HTML but does not export `metadata` or `generateMetadata()` for Next.js head tags.

**Why it's wrong:** Class pages won't have proper titles or descriptions in search engine results.

**How to fix:** Export a `generateMetadata()` function that sets `title` and `description` from the class data.

**File:** `packages/web/src/app/(main)/classes/[id]/page.tsx`

---

### [low] -- No price filter in catalog

**What's broken:** The spec lists a scenario "Filter by price: priceMin=800, priceMax=1500". Neither the frontend nor the backend `/classes` endpoint supports price filtering. The frontend has subject and age filters but no price range.

**Why it's wrong:** Price is a key decision factor for parents. The spec explicitly includes it.

**How to fix:** Add `priceMin` and `priceMax` query params to `ClassesController.findAll()` and a price range slider/input in the frontend filters.

**File:** `packages/api/src/modules/classes/classes.controller.ts`, `packages/web/src/app/(main)/classes/page.tsx`

## Security Checklist
- [x] Input validation on all endpoints -- PARTIAL: class creation validated, search NOT validated
- [x] Auth/RBAC enforced -- OK for class CRUD (teacher role required), catalog is public
- [x] No SQL injection vectors -- OK: Prisma ORM
- [ ] No XSS vectors -- ClassCard renders `imageUrl` in `<img src>` without validation (potential stored XSS if teacher uploads a `javascript:` URL)
- [ ] Rate limiting -- MISSING: no rate limit on search (spec requires 30 req/min per IP)
- [x] Secrets not hardcoded -- OK for this feature
- [ ] PII encrypted (152-FZ) -- N/A for catalog (public data)

## Code Quality
- Patterns: PARTIAL -- clean controller/service/repository but search is completely disconnected from catalog
- Error handling: WEAK -- SearchService has no error handling in search(), ClassesService silently returns empty on errors
- Type safety: POOR -- frontend types don't match API response shape (ClassItem vs actual API response)
- Naming conventions: OK
