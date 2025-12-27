# TODO / Optimization Plan

- [x] Stage 1: Prisma singleton + sanitize employee responses (no password leaks)
- [x] Stage 2: Upload/proxy hardening (limits, mime, timeouts, size guard)
- [x] Stage 3: Basic tests (manual API smoke; optional lint)
- [x] Stage 4: Logging caps (winston maxsize/maxFiles)
- [x] Stage 5: Pagination options (employees, tenders)
- [x] Stage 6: Norms cache (10 min TTL) + existing 20s timeout
- [x] Stage 7: Daily log rotate (zipped, 14d)
- [x] Stage 8: Upload MIME checks (IFC, tender docs)
- [x] Stage 9: Extra SSRF/size guards across external calls
- [x] Stage 10: Pagination/index plan (projects/schedules/supplies)
- [x] Stage 11: Pagination totals/meta (employees, tenders, projects, schedules, supplies)
- [x] Stage 12: DB index tuning (project-scoped listings)
- [x] Stage 13: Security headers (nosniff, frame, referrer, permissions policy)

Notes:
- Roll out stage by stage; deploy only after passing smoke.
- DB: no schema changes in this iteration (safe to merge/back out).
