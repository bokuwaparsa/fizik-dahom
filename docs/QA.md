# Math Quest — QA Checklist & Test Notes

Test date: first release session (see git history).
Environment: Chromium (agent-browser) against `bun run dev` on localhost:3000;
viewports 1280×800 (desktop) and iPhone 14 390×844 (mobile).

## Automated / manual checks performed

- [x] `bunx tsc --noEmit` clean (whole repo, sandbox dirs excluded).
- [x] `bun run lint` clean (build dirs ignored).
- [x] Home renders RTL Persian, all 7 chapters + 23 lesson cards, no horizontal overflow on mobile.
- [x] All 23 lessons open; every sim tab mounts its canvas widget (23/23; s3-variables uses 2 canvases by design).
- [x] Lesson golden path on g1-sets: concept → worked example → practice (correct answer accepted + explanation) → quiz (graded, feedback shown).
- [x] Playground shows 4 math sandboxes (unit circle, sequences, parabola, probability) — canvas + tab switching verified.
- [x] Book map lists the 7 فصل of the textbook with lesson mapping; progress page renders.
- [x] Math audit: all 130 questions in ch1–ch7 recomputed; 4 real errors found in ch4 and fixed (see worklog 4-a).
- [x] `STATIC_EXPORT=1 bun run build:export` succeeds; export served under `/math-quest/` basePath verified with a local Pages simulation (title + home render, zero console errors).
- [x] Console: 0 errors / 0 warnings across home, lesson, playground, bookmap, licenses.

## Known good baselines

- Challenge minigames: canvas win/lose banners + `role="status"` + win beeps (verified pattern from sim-kit; per-widget code follows c1.tsx reference).
- Reduced motion: widgets freeze animation when the settings toggle is on.
