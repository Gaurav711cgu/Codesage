# Frontend 10/10 Polish

## Goal
Eliminate dead code, fix API hanging risks, and resolve Next.js linting warnings to achieve a perfect FAANG architecture score.

## Tasks
- [x] Task 1: Delete redundant `frontnend 2` directory (Architecture constraint) -> Verify: Directory removed.
- [x] Task 2: Implement `AbortSignal.timeout` in API fetch client (Robustness constraint) -> Verify: Fetch calls default to 10s timeout to prevent browser UI hanging.
- [x] Task 3: Fix Next.js `<img>` ESLint warning in `page.tsx` -> Verify: `npm run lint` passes with 0 warnings.
- [x] Task 4: Fix Next.js route API payload schema for backend proxy -> Verify: Pydantic 422 errors resolved.

## Done When
- [x] `npm run build` succeeds with 0 warnings.
- [x] Vibe Code Auditor scores the system 100/100.
