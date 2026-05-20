# Crosstab v2 Metric Semantics Acceptance

Date: 2026-05-20
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Branch: `noway-release`

## Verdict

Status: complete for repository-side v2 acceptance; pending production deployment and live dashboard verification.

Crosstab v2 now has an explicit metric semantic contract for totals. Additive metrics continue to support frontend summary recomputation where needed, while ratio, average, and distinct-style metrics use SQL summary results instead of summing visible leaves. The implementation keeps the existing chart data response shape and routes extra summary queries through the plugin query plan.

## Scope Completed

| Area | Status | Evidence / Boundary |
| --- | --- | --- |
| Metric semantic model | Done | `additive`, `ratio`, `average`, `distinct`, and `unknown` are normalized and guarded. |
| Summary query planning | Done | Non-additive metrics produce dedicated SQL summary query plans for row totals, row subtotals, column totals, column subtotals, row-column subtotal intersections, and grand totals. |
| SQL summary result parsing | Done | Summary query responses are converted into stable row, column, row-column subtotal, and grand-total lookup maps. |
| Crosstab engine injection | Done | Engine receives `summaryValues` and semantic resolver hooks without changing the rendered row contract. |
| Transform props integration | Done | Multi-query data is routed through the summary plan, and legacy additive total behavior remains compatible. |
| Explore control UI | Done | Field config control exposes per-metric semantic selection plus structured override editing and validation. |
| Explore own-state isolation | Done | Crosstab pagination and expansion own-state keys are excluded from `extra_form_data`, including page-size keys. |
| Backend API changes | Not done | Intentional. This phase does not add backend APIs or change the Superset chart data wire shape. |
| Production deployment | Not done | No deployment was requested or performed in this pass. |

## Correctness Baseline

The core correctness rule is now explicit:

- Additive metrics may be summed across leaves.
- Ratio, average, and distinct metrics must not be recomputed by leaf summation.
- Unknown metrics remain conservative and do not automatically opt into non-additive summary routing unless configured.
- Invalid semantic config fails validation at the control layer or is ignored by typed guards instead of leaking arbitrary values into the engine.

Representative coverage added or updated:

- `metricSemantics.test.ts`: normalization and SQL-summary semantic classification.
- `summaryQueryPlan.test.ts`: row, column, row-column subtotal, grand-total, additive, unknown, and disabled-summary routing.
- `summaryResults.test.ts`: summary result map construction and malformed-row tolerance.
- `buildQuery.test.ts`: real query generation for non-additive summary plans, including server-column pagination.
- `engine.test.ts`: SQL-backed non-additive row totals, row subtotals, column totals, column subtotals, row-column subtotal intersections, and grand totals.
- `transformProps.test.ts`: production-style ratio override and multi-query summary injection.
- `controlPanel.test.ts`: semantic selector updates, invalid semantic handling, JSON override validation, non-string override values, and extra-key stripping.
- `fieldConfig.test.ts`: field-config helper extraction and override normalization.

## Validation Commands

Passed in this acceptance pass:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts --runInBand --silent
npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand --silent
npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent
npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/index.jsx
npm run type -- --pretty false
BABEL_ENV=testableProduction npm run build
git diff --check
```

Observed results:

- Focused semantics and summary Jest passed: 3 suites, 15 tests.
- Focused P0 regression Jest passed: 5 suites, 51 tests.
- Full crosstab plugin Jest passed: 14 suites, 99 tests.
- Targeted ESLint passed with 0 errors and 20 warnings.
- TypeScript check passed.
- Production frontend build passed.
- `git diff --check` passed.

## Known Warnings

The validation pass still reports existing non-blocking warnings:

- Jest emits duplicate manual mock warnings for unrelated global Superset mocks.
- Jest emits Browserslist and Node `punycode` deprecation warnings.
- ESLint reports 20 warnings across the crosstab tree plus the touched Explore container. These are non-blocking warnings: function-order warnings in `engine.ts`, an unused fixture field in `CrosstabTable.test.tsx`, missing assertion warnings in key/domain tests, and existing hook/prop-type warnings in `ExploreViewContainer`.
- Production build emits webpack cache restore/store warnings that reference a stale historical workspace path, then completes successfully.
- Production build emits the existing Superset asset and entrypoint size warnings.

## Review Closure

The final read-only reviews initially found blocking gaps: `buildQuery` was not emitting non-additive summary queries, several non-additive summary surfaces still summed leaves, new crosstab own-state page-size keys could leak into `extra_form_data`, and grouped parent rows still needed row-prefix SQL summaries even when explicit row subtotal rows were disabled. The implementation now closes those gaps with real query generation, full summary map routing, SQL-backed engine lookup for subtotal/total surfaces, row-column subtotal intersection summaries, grouped-row row-prefix summaries, and updated own-state filtering.

## Acceptance Boundary

This report is repository-side acceptance only. The next acceptance step is a production deployment and live dashboard verification against the known order-profit dashboard sample, confirming that ratio-style metrics display SQL summary totals rather than summed leaf totals.
