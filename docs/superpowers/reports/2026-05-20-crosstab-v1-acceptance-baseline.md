# Crosstab v1 验收固化与正确性基线

Date: 2026-05-20
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Branch: `noway-release`

## Verdict

Status: complete for v1 acceptance baseline.

当前 Crosstab v1 已具备生产验收基线：核心渲染、总计/小计、服务端列分页、自适应列数、底部右侧分页和当前生产看板样例均有代码或运行证据。剩余边界不是继续扩展 FineBI 全量能力，而是把非加性指标、服务端列分页形态和生产验收样例作为 v1 交付限制固定下来。

## Production Acceptance Target

- Production URL: `http://111.230.91.24:8088/superset/dashboard/order-profit-msku-daily-dashboard/`
- Dashboard: `2 / 订单利润看板 - MSKU日维度`
- Crosstab chart: `10 / 订单利润指标矩阵 - 日维度`
- Viz type: `crosstab-table`
- Dataset: `7 / DWD 领星订单利润 MSKU 指标矩阵 - org1`
- Time range: `2025-01-01 : 2025-01-20`
- Row field: `metric_name_with_unit`
- Column fields: `biz_date`, `shop_name`, `country`
- Metric: `指标值`
- Enabled controls: `serverColumnPagination`, `showRowTotals`, `showColumnTotals`, `showRowSubtotals`
- Disabled in sample: `showColumnSubtotals`

## Capability Matrix

| Area | v1 Status | Evidence / Boundary |
| --- | --- | --- |
| AG Grid rendering | Done | Production screenshot shows rendered crosstab grid. |
| Multi-level column headers | Done | Production sample uses date, shop, country column levels. |
| Fixed row header | Done | `指标项` remains pinned on the left in screenshot. |
| Row hierarchy and expand depth | Done | `defaultRowExpandedDepth` is part of frozen v1 config. |
| Row subtotal | Done | Covered by unit tests and enabled in production form data. |
| Row total / grand total | Done | Covered by unit tests and production SQL baseline. |
| Column total | Done | Enabled in production form data and visible as `总计`. |
| Column subtotal | Partial | Implemented and tested, but disabled in production sample. |
| Conditional formatting | Done | Existing matrix color rules are present in production form data. |
| Server column pagination | Done with limits | v1 supports physical column dimensions, exactly one row dimension, one metric. |
| Adaptive visible column count | Done | Production screenshot shows `列 1-8 / 389`; generated width default remains `120px`. |
| Pagination placement | Done | Pagination is at the table bottom right; top toolbar only keeps `CSV`. |
| CSV export | Done for current render | Current behavior exports through AG Grid for the rendered page. |
| Backend API changes | Not done | v1 intentionally does not add backend API or alter chart data wire shape. |
| FineBI parameters / calculated fields | Deferred | Phase 4 scope; not part of v1 acceptance. |
| Complex non-additive totals | Limited | Non-additive metrics are displayed from SQL aggregate results; frontend total recomputation is not a correctness guarantee. |

## Correctness Baseline

Production datasource SQL was sampled from inside the running container through Superset metadata and the configured Doris engine.

Sample leaf cells:

| Metric | Date | Shop | Country | Value |
| --- | --- | --- | --- | ---: |
| 毛利率（%） | 2025-01-01 | LX-GG-AE | 阿联酋 | 29.9745 |
| 销售额（金额） | 2025-01-01 | LX-GG-AE | 阿联酋 | 183.9900 |
| 毛利率（%） | 2025-01-01 | LX-GG-CA | 加拿大 | 9.5896 |
| 销售额（金额） | 2025-01-01 | LX-GG-CA | 加拿大 | 2328.4500 |

Additive row-total check:

| Metric | Leaf cells | Sum of leaf cells | SQL row total | Result |
| --- | ---: | ---: | ---: | --- |
| 销售额（金额） | 389 | 567999.8200 | 567999.8200 | Pass |

Non-additive boundary check:

| Metric | Leaf cells | Sum of leaf cells | Average of leaf cells | SQL row total | v1 Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| 毛利率（%） | 389 | -3187.7314 | -8.1947 | -9.5145 | Display SQL aggregate; do not recompute or promise frontend total correctness. |

## Regression Baseline Added

- `engine.test.ts`: explicit additive multi-metric subtotal and grand total baseline.
- `buildQuery.test.ts`: stale server-column tuple cache is discarded when the page or resolved page size changes.

## Production Evidence

- Container: `apache-superset`, image `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Remote compose status: `apache-superset` is `healthy`
- Server-local health: `http://127.0.0.1:8088/health -> OK`
- Public health: `http://111.230.91.24:8088/health -> OK`
- Browser screenshot: `/tmp/superset-crosstab-footer-pagination-20260520.png`
- Screenshot-observed UI: top toolbar `CSV`, bottom-right pagination `列 1-8 / 389`, horizontal overflow visible.

## Known v1 Limits

- Server column pagination only supports physical row/column fields.
- Server column pagination currently requires exactly one row dimension and one metric.
- `ownState.currentColumnPage`, `currentColumnPageSize`, `serverColumnPageTuples`, and `expandedRowPaths` are internal plugin state only.
- Ratio, percent, average, and count-distinct-style metrics must be interpreted as SQL aggregate display values. v1 does not recompute weighted totals in the frontend.
- CSV export covers the rendered grid/page. Full multi-page, styled Excel export is a later phase.
- No new backend Crosstab API is part of v1.

## Commands

Passed in this hardening pass:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand --silent
npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent
npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
npm run type -- --pretty false
BABEL_ENV=testableProduction npm run build
git diff --check
```

Observed results:

- Targeted Jest passed: 2 suites, 28 tests.
- Full crosstab plugin Jest passed: 11 suites, 68 tests.
- ESLint passed with 0 errors and 8 existing warnings in the crosstab tree.
- TypeScript check passed.
- Production frontend build passed with 2 existing webpack warnings.
- `git diff --check` passed.

## Next Phase Recommendation

Do not start parameters, calculated fields, backend Crosstab API, or full FineBI formula compatibility until this v1 baseline is accepted. The next real phase should start with an explicit metric-semantics design: classify additive, ratio, average, and distinct metrics, then decide whether each is SQL-only, frontend-summable, or blocked from totals.
