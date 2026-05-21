# Crosstab v2.1 Production Acceptance Design

Date: 2026-05-21
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Target plugin: `superset-frontend/plugins/plugin-chart-crosstab-table`
Production target: `slice_id=10`

## Summary

Crosstab v2.1 is a production closeout phase for the existing v2 metric-semantics work. It does not add a new capability. It proves that the custom `crosstab-table` plugin can render production slice 10 with `crosstabFieldConfig`, SQL-backed non-additive summaries, server column pagination, and chart-local own-state isolation.

This phase is P0 because later dynamic group-by, dynamic metric, parameter, and server-pagination expansion work depends on v2 being production-proven. Repository tests and frontend builds are necessary but not sufficient; the saved production chart metadata and browser rendering path are part of the acceptance contract.

## Goals

- Verify the current repository, production image, and slice 10 metadata before changing code or chart config.
- Reproduce and diagnose the v2 production blank-rendering or browser-side rendering blocker.
- Fix only the minimal code or saved-chart compatibility issue needed to render slice 10.
- Persist a valid `crosstabFieldConfig` for slice 10 with explicit metric semantics.
- Prove SQL-backed semantics for the production baseline metrics:
  - `销售额 = 567999.82`
  - `毛利率 = -9.5145`
  - `平均售价 = 98.6968`
- Capture Explore and Dashboard screenshots after deployment.
- Keep all chart-local state out of saved slice params and dashboard `extra_form_data`.

## Non-Goals

- No V3.1 multi-slot dynamic group-by implementation.
- No V3.2 dynamic metric implementation.
- No V4 parameter or calculated-field implementation.
- No V5 server column pagination shape expansion.
- No new crosstab-specific backend API.
- No AG Grid Enterprise Pivoting, SSRM, or Master-Detail.
- No FineBI UI cloning.

## Current Evidence

The crosstab plugin already exists and is registered as `viz_type = crosstab-table`. The runtime path is:

```text
MainPreset registration
  -> CrosstabTableChartPlugin
  -> controlPanel
  -> buildQuery
  -> /api/v1/chart/data
  -> transformProps
  -> crosstab engine
  -> CrosstabTable
  -> ThemedAgGridReact
```

Repository code already contains:

- `metricSemantics.ts`
- `summaryQueryPlan.ts`
- `summaryResults.ts`
- `serverColumnPagination.ts`
- `dynamicGroupBy.ts`
- `ExploreViewContainer/ownState.ts` strip coverage

The active dynamic group-by implementation is still single slot and single column. That is acceptable for v2.1; V3.1 handles the multi-slot expansion later.

Prior production evidence showed slice 10 had `crosstabFieldConfig = null` while relying on legacy `metrics`, `groupbyRows`, and `groupbyColumns`. That means code deployment alone cannot prove v2 semantics. Slice metadata must be inspected and updated as a release artifact.

## Acceptance Contract

### Repository Acceptance

The following commands must pass from `superset-frontend` unless a baseline repository failure is separately documented with changed-file evidence:

```bash
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
npm run type -- --pretty false
BABEL_ENV=testableProduction npm run build
```

### Production Acceptance

The production host must pass:

```bash
curl -f http://111.230.91.24:8088/health
```

Slice 10 must satisfy:

- `viz_type` is `crosstab-table`.
- `crosstabFieldConfig` is present and is the canonical rows, columns, metrics, labels, and semantic source.
- Legacy `groupbyRows`, `groupbyColumns`, and `metrics` may remain only for compatibility.
- `serverColumnPagination` remains enabled unless the rendering blocker proves it must be temporarily disabled for diagnosis.
- Browser rendering succeeds in both Explore and Dashboard.
- Browser console has no new uncaught crosstab errors.
- Server logs during browser acceptance do not show `HTTPException: 405`.

### Metric Semantics Acceptance

Production metric labels must be read through datasource 7's `metric_name_with_unit` expression path. It must not be treated as a physical SQL column.

The semantic mapping for the baseline check is:

```text
销售额（金额） -> additive
毛利率（%） -> ratio
平均售价（金额） -> average
```

The rendered SQL-backed summary values must match:

```text
销售额 = 567999.82
毛利率 = -9.5145
平均售价 = 98.6968
```

## Design

### Verification-First Flow

Every execution starts with read-only evidence:

1. Local branch, worktree, and remote divergence.
2. Production health and container/image identity.
3. Production slice 10 metadata.
4. Production datasource 7 metric-label extraction.
5. Browser console/network capture for Explore and Dashboard.

Only after those checks identify the actual gap should code or chart metadata be changed.

### Compatibility Boundary

If production still uses legacy saved params, compatibility belongs at the parsing or transform boundary. The chart should normalize old saved shape into the current renderer contract without writing back to the database during render.

Allowed compatibility:

- Read legacy `groupbyRows`, `groupbyColumns`, and `metrics` when `crosstabFieldConfig` is absent.
- Derive an in-memory equivalent field config for rendering and query planning.
- Preserve existing fail-fast validation for invalid dynamic group-by config, missing summary data, and unknown semantic summaries.

Disallowed compatibility:

- Silent fallback to incorrect additive frontend totals for non-additive metrics.
- Writing chart-local `ownState` into saved slice params.
- Swallowing malformed chart config and rendering partial data without an explicit error.

### Own-State Boundary

The following crosstab-local fields must remain stripped from dashboard filter payloads and saved chart params:

```text
selectedDynamicGroupByColumn
effectiveGroupBySignature
currentColumnPage
currentColumnPageSize
serverColumnPageTuples
serverColumnPageTuplesPageSize
serverColumnPageColumnSignature
serverColumnTotalCount
expandedRowPaths
```

If v2.1 adds or discovers another chart-local key, it must be added to `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts` and covered by `ownState.test.ts`.

### Error Handling

The grid area may render an explicit error state when data is invalid. The toolbar should remain visible so the user can recover by changing controls.

Fast-fail cases:

- Invalid dynamic group-by JSON or option.
- Unknown metric semantic when a summary requires semantic resolution.
- Missing SQL summary value for a non-additive summary.
- Non-numeric SQL summary value for a numeric cell.
- Stale server-column page tuple after the effective column signature changes.

### Deployment Boundary

Frontend asset build and sync are not sufficient by themselves. A v2.1 closeout is complete only after:

1. The image `apache-superset-doris:6.0.0-zh-column-scheme-matrix` is rebuilt or otherwise proven to serve the new assets.
2. The Superset container is restarted on the intended image.
3. Slice 10 metadata is updated and re-read from the running container.
4. Explore and Dashboard browser screenshots are captured from a fresh browser session.

## Test Strategy

Repository tests should focus on the changed seam only:

- `dynamicGroupBy.test.ts` if normalization or selected-column reset changes.
- `summaryResults.test.ts` if summary map indexing changes.
- `transformProps.test.ts` if in-memory legacy compatibility or reset behavior changes.
- `ownState.test.ts` if strip keys change.
- `CrosstabTable.test.tsx` if toolbar, pager, or visible grid behavior changes.

Production tests must include:

- Health check.
- Slice metadata dump before and after updates.
- Browser screenshots for Explore and Dashboard.
- Baseline SQL/rendered summary comparison.
- Log scan during the acceptance window.

## Next Phase Boundary

Only after this v2.1 acceptance is complete should the project move to V3.1. V3.1 will extend `dynamicGroupBy` from the current single-slot shape to a normalized `slots[]` model with multi-slot and multi-column options.
