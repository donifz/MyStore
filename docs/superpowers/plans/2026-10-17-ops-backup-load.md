# Operations Backup and Load Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce repeatable evidence for restoring a MyStore PostgreSQL backup and measuring a bounded local storefront API read load.

**Architecture:** Use the existing PostgreSQL 18 test container only, with the most complete existing test database as the backup source and a newly created isolated database as the restore target. Add a dependency-free Node load probe that accepts loopback URLs only by default, then run it against the locally restored test data and record the exact setup, commands, and limitations.

**Tech Stack:** PostgreSQL 18 `pg_dump`/`pg_restore`, Node.js 24 built-in `fetch` and `node:test`, project API build.

**Spec:** `docs/operations.md`; `docs/superpowers/specs/2026-10-07-mystore-design.md` sections 14–15; `docs/implementation/2026-10-17-release-scope.md` part 8.

## Global Constraints

- Never target production or a shared database; restore only to a dedicated empty database.
- Do not print database URLs, passwords, customer data, or row contents in reports or command logs.
- Record measured local results separately from production goals; do not claim PITR, RPO/RTO, or the full 100-store/100,000-variant profile was validated.
- Any load tool defaults to loopback and must reject remote targets unless an explicit override is supplied.

## Review Focus

- Restore target accidentally equals or contains the source database — reject before destructive commands.
- Dump or restore fails partway — return nonzero and preserve logs/backup for diagnosis.
- Test source is empty or lacks the expected MyStore schema — fail the rehearsal rather than report a misleading pass.
- Load probe overruns requested rate/duration or hides HTTP errors — report every status and latency sample.
- A local test run is misrepresented as production capacity — state data size, profile, and exclusions in the report.

---

### Task 1: Repeatable backup and restore rehearsal

**Files:**
- Modify: `docs/operations.md`
- Create: `docs/verification/2026-10-17-backup-restore-rehearsal.md`

**Interfaces:**
- Consumes: local PostgreSQL 18 test database `mystore_permissions_browser_test` in container `mystore-hours-postgres`.
- Produces: a restore-only procedure that checks distinct database names and reports schema/table-count parity without exposing row contents.

- [ ] Confirm source database is a test database and has migrated MyStore tables; record relation counts only.
- [ ] Dump the source in custom format and restore to a newly created `mystore_ops_restore_test` database.
- [ ] Verify `pg_restore --list`, migration count, selected business-table row counts, and application DB initialization against the restored database.
- [ ] Record dump size, dump/restore durations, PostgreSQL version, checksums if available, and any limits in the verification report.
- [ ] Update `docs/operations.md` with the exact safe sequence and rerun command.

### Task 2: Bounded local storefront read-load probe

**Files:**
- Create: `scripts/ops-load-probe.cjs`
- Create: `scripts/ops-load-probe.test.cjs`
- Create/update: `docs/verification/2026-10-17-backup-restore-rehearsal.md`

**Interfaces:**
- Produces: `runLoadProbe({ url, durationSeconds, requestsPerSecond, concurrency, fetchImpl })` returning request count, status counts, error count, and p50/p95/p99/max latency.
- Default profile: loopback `GET /api/public/products?page=1&pageSize=20`, 30 seconds, 50 requests/second, 200 workers; permit overrides for short tests.

- [ ] Write a `node:test` test for measured request count, HTTP error accounting, and rejection of remote URLs.
- [ ] Run the test and observe the expected failure before adding the probe.
- [ ] Implement the probe with bounded duration/rate, concurrency cap, complete status accounting, and loopback-only default.
- [ ] Run the test to green and run a short smoke profile against a local server fixture.
- [ ] Build and start the API against the restored test database; run the 30-second read profile and record p50/p95/p99/max, requests/sec, errors, row counts, and environment.
- [ ] State clearly that write paths, 100,000-variant scale, PITR, and production alerting remain unverified without a representative isolated environment and provider access.

