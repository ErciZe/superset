# Crosstab v2.1 Production Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the crosstab v2 production acceptance gap for slice 10 by verifying live metadata, fixing the minimal rendering blocker, updating required chart config, and capturing browser and SQL baseline evidence.

**Architecture:** Keep the existing custom frontend plugin architecture. Diagnose through the standard chart data path, keep compatibility at parsing/transform boundaries, keep summary semantics in the existing metric-semantics modules, and keep chart-local state isolated through `ExploreViewContainer/ownState.ts`.

**Tech Stack:** Apache Superset, React, TypeScript, Jest, React Testing Library, AG Grid Community, Superset chart data API, Docker production image `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.

---

## File Structure

- Inspect: `docs/superpowers/reports/2026-05-21-crosstab-implementation-path.md`
  - Source of the current implementation path and phase boundary.
- Inspect or modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Normalize legacy saved shape if evidence shows old slice params produce empty renderer props.
- Inspect or modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts`
  - Fix SQL summary result indexing if non-additive summaries are missing or keyed incorrectly.
- Inspect or modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`
  - Fix query-plan role generation only if `queriesData` roles do not match expected summary maps.
- Inspect or modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
  - Fix single-slot dynamic group-by reset or selected-column validation only if the production selected column causes the blank render.
- Inspect or modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  - Add any newly discovered crosstab chart-local key to the strip list.
- Test: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`
  - Prove stripped keys do not leak into `extra_form_data`.
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - Cover any renderer-prop normalization or reset fix.
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts`
  - Cover summary map fixes.
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`
  - Cover any selected-column or signature fix.
- Output: `docs/superpowers/reports/2026-05-21-crosstab-v2-1-production-acceptance.md`
  - Final acceptance report with repo evidence, production metadata, screenshots, SQL baseline, and blockers if any remain.

## Task 1: Read-Only Local And Production Preflight

**Files:**
- Inspect: `docs/superpowers/reports/2026-05-21-crosstab-implementation-path.md`
- Create later: `docs/superpowers/reports/2026-05-21-crosstab-v2-1-production-acceptance.md`

- [ ] **Step 1: Confirm local branch and dirty state**

Run from repository root:

```bash
git status --short --branch
git rev-parse --abbrev-ref HEAD
git rev-list --left-right --count HEAD...fork/noway-release
```

Expected: branch is `noway-release`. Record all dirty files. Do not stage or revert unrelated files.

- [ ] **Step 2: Confirm Git object and whitespace hygiene before changes**

Run:

```bash
git diff --check
git count-objects -v
```

Expected: no whitespace errors in tracked diffs. `garbage: 0` is preferred; if nonzero, record it as repo hygiene evidence and continue only if it does not block the task.

- [ ] **Step 3: Confirm production health**

Run:

```bash
curl -f http://111.230.91.24:8088/health
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose ps'
```

Expected: health returns `OK`. Running service includes `apache-superset`.

- [ ] **Step 4: Capture running image and asset identity**

Run:

```bash
ssh agentops 'docker inspect apache-superset --format "{{.Config.Image}}"'
ssh agentops 'docker exec apache-superset sh -lc "ls -lt superset/static/assets | head -20"'
```

Expected: image is `apache-superset-doris:6.0.0-zh-column-scheme-matrix`. Record newest asset files for later stale-bundle checks.

## Task 2: Capture Slice 10 And Datasource Truth

**Files:**
- Inspect production metadata only.
- Update final report.

- [ ] **Step 1: Dump slice 10 params from the running container**

Run a Python snippet inside the container using Superset's app context:

```bash
ssh agentops 'docker exec apache-superset superset shell <<'"'"'PY'"'"'
import json
from superset import db
from superset.models.slice import Slice

slc = db.session.query(Slice).filter_by(id=10).one()
params = json.loads(slc.params or "{}")
print("slice_id=", slc.id)
print("slice_name=", slc.slice_name)
print("viz_type=", slc.viz_type)
for key in [
    "crosstabFieldConfig",
    "metrics",
    "groupbyRows",
    "groupbyColumns",
    "dynamicGroupBy",
    "serverColumnPagination",
    "columnPageSize",
    "generatedColumnWidth",
    "showRowTotals",
    "showColumnTotals",
    "showRowSubtotals",
    "showColumnSubtotals",
]:
    print(f"{key}=", json.dumps(params.get(key), ensure_ascii=False))
PY'
```

Expected: `viz_type = crosstab-table`. If `crosstabFieldConfig` is null, v2.1 still requires a metadata update after code/render diagnosis.

- [ ] **Step 2: Confirm datasource 7 metric-label expression**

Run:

```bash
ssh agentops 'docker exec apache-superset superset shell <<'"'"'PY'"'"'
from superset import db
from superset.connectors.sqla.models import SqlaTable

table = db.session.query(SqlaTable).filter_by(id=7).one()
for col in table.columns:
    if col.column_name == "metric_name_with_unit":
        print("metric_name_with_unit expression=", col.expression)
PY'
```

Expected: expression resembles `CASE WHEN unit IS NULL OR unit = '' THEN metric_name ELSE CONCAT(metric_name, '（', unit, '）') END`.

- [ ] **Step 3: Extract baseline metric labels through the dataset expression path**

Use the datasource expression from Step 2 in a SQLAlchemy `text()` query from inside Superset. Record the exact command and output in the final report.

Expected labels include:

```text
销售额（金额）
毛利率（%）
平均售价（金额）
```

Do not query `metric_name_with_unit` as a physical table column.

## Task 3: Browser Reproduction And Failure Classification

**Files:**
- Inspect browser console and network.
- No code edits in this task.

- [ ] **Step 1: Open Explore in a fresh browser session**

Navigate to:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Expected: either the crosstab renders or the grid area exposes a reproducible error/blank state.

- [ ] **Step 2: Capture `/api/v1/chart/data` requests**

Record for the last crosstab request:

```text
HTTP status
query count
query roles if visible
form_data.viz_type
form_data.crosstabFieldConfig
form_data.extra_form_data
response.result[*].data row counts
```

Expected: `viz_type` is `crosstab-table`. `extra_form_data` must not contain crosstab-only keys such as `currentColumnPage`, `serverColumnPageTuples`, or `expandedRowPaths`.

- [ ] **Step 3: Classify the blocker**

Use this decision table:

```text
Empty or missing leaf data query -> inspect buildQuery/query form data.
Leaf data exists but rowData empty -> inspect transformProps and dynamic group-by signature reset.
Non-additive cells missing -> inspect summaryQueryPlan and summaryResults.
Console error references ownState or extra_form_data -> inspect ownState strip list.
Only stale assets reproduce -> refresh manifest/chunks and use a fresh browser session before changing code.
```

Expected: one primary blocker category is identified before code edits.

## Task 4: Minimal Code Fix If Required

**Files:**
- Modify one or more of:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
  - `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- Test the matching file under `superset-frontend/plugins/plugin-chart-crosstab-table/test` or `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- [ ] **Step 1: Write the focused failing test**

Choose the matching test file from the blocker category:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand --silent
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts --runInBand --silent
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand --silent
BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand --silent
```

Expected: the chosen new test fails for the production blocker. Do not write broad snapshot tests for this phase.

- [ ] **Step 2: Implement the smallest fix at the proven boundary**

Allowed fixes:

```text
transformProps.ts: normalize legacy saved params into renderer props or correct reset behavior.
summaryResults.ts: fix summary lookup keying or missing-value validation.
summaryQueryPlan.ts: fix query role/order construction for existing v2 summaries.
dynamicGroupBy.ts: fix single-slot selected column validation or signature behavior.
ownState.ts: add a newly discovered crosstab-local strip key.
```

Disallowed fixes:

```text
No new backend crosstab API.
No AG Grid Enterprise features.
No multi-slot dynamic group-by.
No dynamic metric.
No silent frontend summing for ratio or average summaries.
```

- [ ] **Step 3: Run the focused test**

Run the exact failing test from Step 1.

Expected: PASS.

- [ ] **Step 4: Run the crosstab plugin suite**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the code fix**

Stage only files changed for this blocker:

```bash
git add <changed-source-and-test-files>
git commit -m "fix(crosstab): close v2 production rendering gap"
```

Expected: commit succeeds. If no code fix was required, skip this commit and record why in the report.

## Task 5: Update Production Slice 10 Metadata

**Files:**
- Production metadata in Superset DB.
- Final report.

- [ ] **Step 1: Back up current slice 10 params**

Run:

```bash
ssh agentops 'docker exec apache-superset superset shell <<'"'"'PY'"'"'
import json
from pathlib import Path
from superset import db
from superset.models.slice import Slice

slc = db.session.query(Slice).filter_by(id=10).one()
backup = {
    "id": slc.id,
    "slice_name": slc.slice_name,
    "viz_type": slc.viz_type,
    "params": json.loads(slc.params or "{}"),
}
path = Path("/tmp/slice-10-crosstab-v2-1-before.json")
path.write_text(json.dumps(backup, ensure_ascii=False, indent=2))
print(path)
PY'
ssh agentops 'docker cp apache-superset:/tmp/slice-10-crosstab-v2-1-before.json /home/ubuntu/superset-docker/backups/slice-10-crosstab-v2-1-before.json'
```

Expected: backup file exists on the production host.

- [ ] **Step 2: Write canonical `crosstabFieldConfig`**

Use a Superset shell script that:

```text
sets rows from current groupbyRows
sets columns from current groupbyColumns
sets metrics from current metrics
sets semanticOverrideField to metric_name_with_unit
sets semanticOverrides for 销售额（金额）, 毛利率（%）, 平均售价（金额）
preserves serverColumnPagination, generatedColumnWidth, totals, subtotals, dynamicGroupBy
```

Expected semantic entries:

```json
[
  { "value": "销售额（金额）", "semantic": "additive" },
  { "value": "毛利率（%）", "semantic": "ratio" },
  { "value": "平均售价（金额）", "semantic": "average" }
]
```

- [ ] **Step 3: Re-read slice 10 metadata**

Re-run the Task 2 Step 1 metadata dump.

Expected: `crosstabFieldConfig` is non-null and includes rows, columns, metrics, `semanticOverrideField`, and the three semantic overrides.

## Task 6: Build, Deploy, And Restart Production Assets

**Files:**
- Built frontend assets under `superset/static/assets/`.
- Remote image/runtime.

- [ ] **Step 1: Run full repository-side frontend validation**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
npm run type -- --pretty false
BABEL_ENV=testableProduction npm run build
```

Expected: all commands pass. Existing size or Browserslist warnings may be recorded as non-blocking if the command exits 0.

- [ ] **Step 2: Back up remote assets and sync new assets**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && mkdir -p backups/assets-20260521-v2-1 && cp -a superset-source/superset/static/assets/. backups/assets-20260521-v2-1/'
rsync -az --delete /Volumes/extend/ecode-workspace/superset-source/superset/static/assets/ agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

Expected: backup directory exists and rsync completes.

- [ ] **Step 3: Rebuild and restart the Superset image**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d apache-superset'
curl -f http://111.230.91.24:8088/health
```

Expected: image build succeeds, container restarts, health returns `OK`.

## Task 7: Browser And SQL Production Acceptance

**Files:**
- Create screenshots under `docs/superpowers/reports/`.
- Create final report.

- [ ] **Step 1: Verify Explore rendering**

Open:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Expected: crosstab grid renders with pinned row header, generated columns, and footer pagination. Save screenshot:

```text
docs/superpowers/reports/2026-05-21-crosstab-v2-1-explore.png
```

- [ ] **Step 2: Verify Dashboard rendering**

Open the production dashboard URL from the implementation path report:

```text
http://111.230.91.24:8088/explore/?dashboard_page_id=tLUdpjmhYfzPOwbHGAtEi&slice_id=10
```

Expected: crosstab grid renders without blank chart state. Save screenshot:

```text
docs/superpowers/reports/2026-05-21-crosstab-v2-1-dashboard.png
```

- [ ] **Step 3: Verify baseline metric values**

Run the same production SQL baseline method used in prior acceptance reports and record:

```text
销售额 = 567999.82
毛利率 = -9.5145
平均售价 = 98.6968
```

Expected: rendered summaries or chart data evidence matches the three baseline values.

- [ ] **Step 4: Scan production logs during acceptance**

Run:

```bash
ssh agentops 'docker logs apache-superset --since 20m 2>&1 | tail -300 | grep -E "HTTPException: 405|crosstab|Traceback|ERROR" || true'
```

Expected: no new `HTTPException: 405` and no crosstab Traceback during the acceptance window.

## Task 8: Final Report And Commit

**Files:**
- Create: `docs/superpowers/reports/2026-05-21-crosstab-v2-1-production-acceptance.md`
- Include screenshots from Task 7.

- [ ] **Step 1: Write the acceptance report**

The report must include:

```text
repo branch and commit
dirty worktree note
slice 10 metadata before and after
datasource 7 metric label extraction evidence
code fix summary or "no code fix required"
validation command results
deployment steps
Explore screenshot path
Dashboard screenshot path
baseline metric comparison
log scan result
final verdict: complete, blocked, or partial
```

- [ ] **Step 2: Self-review the report**

Check the report for:

```text
no TBD/TODO
no claim of completion without browser screenshots
no claim of semantic acceptance without the three baseline values
clear separation between repo evidence and production evidence
explicit blocker list if any acceptance item failed
```

- [ ] **Step 3: Commit documentation and any remaining code**

Stage only files from this v2.1 phase:

```bash
git add docs/superpowers/reports/2026-05-21-crosstab-v2-1-production-acceptance.md
git add docs/superpowers/reports/2026-05-21-crosstab-v2-1-explore.png
git add docs/superpowers/reports/2026-05-21-crosstab-v2-1-dashboard.png
git add <any-v2-1-code-files-not-yet-committed>
git commit -m "docs(crosstab): record v2.1 production acceptance"
```

Expected: commit succeeds. If screenshots or production acceptance are blocked, commit the report with final verdict `blocked` or `partial`; do not mark it complete.
