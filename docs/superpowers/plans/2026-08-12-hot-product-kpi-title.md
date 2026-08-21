# Hot Product KPI Single Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicated metric-name line from all nine native Big Number KPI tiles while retaining the dashboard chart title and value.

**Architecture:** Keep the stock Superset dashboard header as the single title. Change only the generated `big_number_total` form-data flag and lock the contract in the existing asset test.

**Tech Stack:** Python asset generator, pytest, Superset Assets API, in-app browser acceptance.

## Global Constraints

- Do not modify Superset core, frontend plugins, or Dashboard CSS.
- Preserve all KPI metrics, formats, UUIDs, layout nodes, and filter scopes.
- Preserve unrelated dirty worktree files.

---

### Task 1: Lock The KPI Contract

**Files:**
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`

**Interfaces:**
- Consumes: generated chart assets from `write_bundle()`.
- Produces: a contract requiring every `big_number_total` chart to set `show_metric_name` to `False`.

- [ ] Change the existing KPI assertion from `is True` to `is False`.
- [ ] Run the focused test and verify it fails against the old generator.

Run:

```bash
python3 -m pytest --confcutdir=tests/unit_tests/scripts \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  -q -k main_dashboard_matches_approved_scope_and_filters
```

Expected: one assertion failure because generated KPI params still contain `show_metric_name=true`.

### Task 2: Generate Single-Title KPIs

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`

**Interfaces:**
- Consumes: `_big_number_params(metric, number_format)`.
- Produces: Big Number form data with `show_metric_name=False`.

- [ ] Set `show_metric_name` to `False` in `_big_number_params`.
- [ ] Run both generator test files and verify all no-app tests pass.
- [ ] Generate two ZIPs, compare them byte-for-byte, and run `unzip -t`.
- [ ] Run focused pre-commit on the modified generator and test.
- [ ] Commit only the two owned files.

### Task 3: Guarded Production Acceptance

**Files:**
- Runtime evidence only; no Superset source files.

**Interfaces:**
- Consumes: exact committed deterministic Assets ZIP.
- Produces: production metadata, API evidence, browser screenshots, and an executable target-only rollback bundle.

- [ ] Create a fresh production export and exact target UUID rollback bundle.
- [ ] Import the candidate using `/api/v1/assets/import/` with multipart `bundle`, `sparse=true`, and `overwrite=true`.
- [ ] Verify topology, 26 chart-data responses, dashboard no-op PUT, health, and logs.
- [ ] Verify in the browser that all nine KPI tiles have one title plus one value and that the category filter contract remains correct.
- [ ] Roll back immediately if any gate fails.
