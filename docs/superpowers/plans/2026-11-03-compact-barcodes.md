# Compact Barcode Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short scannable barcodes without breaking legacy inventory references.

**Architecture:** New immutable short code column with database backfill/trigger. API supports primary and compact aliases. Label rendering selects short code using Code 128C.

**Tech Stack:** PostgreSQL, TypeORM migrations, NestJS, React, Vitest/Jest.

**Spec:** docs/superpowers/specs/2026-11-03-compact-barcodes-design.md

## Global Constraints
- Keep legacy barcode values and ledger tables unchanged.
- Do not merge without CI passing.
- Use 8 digits, preserving leading zeros and shop isolation.
- Generate all short codes transactionally; avoid collisions with original barcodes.

## Review Focus
- Existing primary code matches a proposed short code: generator must skip it.
- Imported products via raw SQL: database trigger must assign the short code.
- Manual barcode supplied during creation: must not alias another product's short code.
- Mixed old/new labels: render only the short code.
- Exhausted 8-digit sequence: fail instead of recycling values.

### Task 1: Database and API
- [ ] Write failing API tests for old/new scanning, collisions, search and imports.
- [ ] Confirm failure without feature.
- [ ] Create migration 0031 with sequence, backfill, uniqueness and constraints.
- [ ] Add short code to DTO, list search, create, lookup and groups.
- [ ] Verify relevant API tests.

### Task 2: Label rendering
- [ ] Write failing Code128 and label tests.
- [ ] Confirm old behavior fails tests.
- [ ] Implement Code128C for eight digits; use short code on all labels.
- [ ] Verify web tests.

### Task 3: Integration
- [ ] Run formatting, typecheck, build and full suite through CI.
- [ ] Review PR diff for migrations, POS, receiving and shop isolation.
- [ ] Open separate PR and report CI status; do not merge failing code.
