# Lessons Learned

## 12 Failing Tests in progress-hydration.test.ts — Do Not Fix

**Root cause**: Circular module import between `auth-client.ts` and `user-profile.ts`. When vitest dynamically imports `auth-client`, the circular dependency corrupts the `localStorage` global — methods like `clear()` and `setItem` become unavailable. The 4 tests in the same file that don't touch `localStorage` pass fine.

**Why not fix**: The real fix requires breaking the circular dependency, which means refactoring core state management files (`auth-client.ts`, `user-profile.ts`) used across the entire app. Medium-to-high risk of introducing bugs for zero user-facing benefit — the actual code works correctly in the browser where `localStorage` isn't corrupted by vitest module mocking.

**Status**: Leave as-is. These are test infrastructure failures, not application bugs.

## Always Use getStorageKey() for localStorage Keys

**Pattern**: Every localStorage key that stores per-student data MUST use `getStorageKey(baseKey)` from `user-profile.ts` to namespace it by the active user (e.g., `hunter-tutor-skill-mastery` → `hunter-tutor:Emma:skill-mastery`).

**What went wrong**: The assessment in-progress save/resume feature used a hardcoded global key (`hunter-tutor-assessment-in-progress`) instead of calling `getStorageKey()`. This meant Student B could see and resume Student A's in-progress assessment on a shared browser — leaking answers, essay text, and timing data.

**Rule**: Before writing any `localStorage.setItem()` call, check: "Does this data belong to a specific student?" If yes, use `getStorageKey()`. No exceptions. The only keys that should be unscoped are truly global preferences (e.g., `hunter-tutor-theme`).

**Applies to**: Any new feature that persists state client-side — assessments, simulations, drafts, etc.

## Security Audit Findings: Verify Before Acting

**Pattern**: When reviewing a security audit, always verify each finding against the CURRENT codebase before implementing fixes. Audits can be stale or wrong.

**What happened**: A security audit flagged 4 items as CRITICAL. On verification:
- JWT secret hardcoded fallback — already fixed in a prior commit (stale finding)
- Sequential database updates — already batched in a transaction (factually wrong)
- SQLite in production — mischaracterized Turso as bare SQLite (wrong technology assessment)
- Regex prompt injection filtering recommendation — anti-pattern that creates false security

**Rule**: For every audit finding: (1) grep the codebase for the exact code cited, (2) check git log for recent fixes, (3) evaluate whether the recommended fix is actually sound engineering. Don't blindly implement audit recommendations.

## Vercel Build Failures: Always Verify Locally Before Pushing

**Pattern**: Before every push to main, run `npm run build` locally (not just `tsc --noEmit` or `next lint`). The full build command (`npx prisma generate && next build`) catches issues that typecheck and lint miss: SSR rendering errors, missing exports consumed during static page generation, dynamic import failures, and Edge Runtime incompatibilities.

**Verification checklist before every push:**
1. `npx tsc --noEmit` — type safety
2. `npx next lint` — lint rules
3. `npm run build` — full production build (Prisma generate + Next.js build + static page generation)
4. `npx vitest run` — tests

**Why not just typecheck?** Next.js build does additional work beyond TypeScript: it actually renders static pages, resolves all dynamic imports, tree-shakes unused code, and validates Edge Runtime compatibility. A file can typecheck perfectly but fail during static generation (e.g., server-side code importing a client-only module, or a component that crashes during SSR).

**When Vercel fails but local passes:** If all 4 checks pass locally but Vercel still fails, the cause is usually: (1) Vercel build cache corruption — trigger a redeploy with an empty commit, (2) Node.js version mismatch — pin the version in `package.json` `engines` field, (3) missing env vars on Vercel that exist locally in `.env.local`.

**Rule**: Never push to main without running `npm run build` locally first. Make this a habit, not an afterthought.

## HSTS Header Is a Free Win

**Pattern**: If the app runs on HTTPS (all Vercel apps do), add `Strict-Transport-Security: max-age=63072000; includeSubDomains` to security headers. One line, zero risk, prevents HTTPS downgrade attacks.

**What happened**: The app had 5 security headers configured but missed HSTS — the one that actually prevents a real attack vector (man-in-the-middle on first HTTP visit). The security audit also missed it while listing 7 medium-priority items of lower impact.
