# Crosstab Dynamic Column Sort and Full Summary Design

Date: 2026-05-25
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Target plugin: `superset-frontend/plugins/plugin-chart-crosstab-table`

## Status

Approved design for the production-grade crosstab table upgrade.

This design chooses approach A from the brainstorming session: keep the current
data-row-driven matrix model, then make row configuration, column
configuration, sorting, and total semantics explicit. It does not choose the
larger approach C, where every displayed metric row would be generated from a
new configuration-driven query model.

## Summary

The production order-profit dashboard needs a stable crosstab model for three
dynamic column dimensions, dynamic column sorting, business metric row ordering,
and correct total semantics.

The chart should keep the current production data shape:

```text
row dimension: metric_name_with_unit
metric:        指标值
columns:       selected dynamic dimensions such as biz_date, shop_name, country
```

The upgrade makes the implicit business rules explicit:

- dynamic column options resolve to configured column definitions, not bare
  field names;
- row metric order comes from configured row sorting such as `metric_order`;
- each business metric row can declare its own summary semantic;
- every total cell uses SQL summary results;
- the right-side `总计` column is a full-filter-range summary and does not
  change with the current server-column-pagination page.

## Goals

- Add dynamic column sorting that is stable across domain queries, leaf queries,
  frontend column tuple construction, and AG Grid column rendering.
- Keep the production `metric_name_with_unit + 指标值` matrix data model.
- Replace scattered row-metric behavior with explicit row configuration.
- Support row-value-level summary semantics, so different business metric rows
  can use different aggregation semantics.
- Make all totals SQL-summary-backed, including additive metrics.
- Keep server column pagination enabled for production slice 10.
- Fail fast when required summary, sort, or row semantic configuration is
  missing or inconsistent.

## Non-Goals

- Do not implement approach C in this phase.
- Do not replace the current chart data API.
- Do not add a backend API.
- Do not introduce fallback rendering that silently sums frontend cells when a
  summary is required.
- Do not change the global default of `serverColumnPagination=false`.
- Do not remove compatibility reads for existing `semanticOverrideField` and
  `semanticOverrides` yet, but new production metadata should use the new
  row-value summary contract.
- Do not redesign the whole Explore control panel beyond fields required for
  this production contract.

## Current Problem

The current production chart can render with server column pagination, but the
business display has three correctness gaps:

1. Dynamic columns can appear in an order that differs from the domain query
   order. The domain query already orders by selected column dimensions, but the
   frontend column tuple and rendered column tree do not have a first-class sort
   contract.
2. Business metric rows are displayed from `metric_name_with_unit`, but the
   configured `matrix_row_sort="metric_order"` is not part of the V4 crosstab
   row contract. Row order can therefore drift from the intended business order.
3. The `总计` column has mixed semantics. Additive rows can be summed from
   visible page cells, while non-additive rows use SQL summary results. With
   server column pagination, this can mix current-page totals and full-range
   totals in one column.

The accepted business choice is that `总计` means full-filter-range summary.
For example, if the current page shows 12 of 19 dynamic columns, `总计` still
summarizes all 19 columns in the active filter range.

## Chosen Model

The design keeps the existing data-row-driven matrix. Rows are still values in
the dataset, not independent configured metrics. The configuration becomes the
authority for how those row values should be sorted, formatted, and summarized.

This is different from approach C:

- Approach A keeps `metric_name_with_unit` as the row dimension and `指标值` as
  the metric, then adds explicit row and column behavior around it.
- Approach C would define every displayed row as a configured metric row and
  require deeper query-planner changes. That is cleaner long term but too large
  for this production repair.

## Configuration Contract

Extend the existing `crosstabFieldConfig` contract instead of adding a separate
top-level model.

```ts
type CrosstabSortDirection = 'asc' | 'desc';
type CrosstabSortType = 'string' | 'number' | 'date';
type CrosstabNullSort = 'first' | 'last';

type DimensionSortConfig = {
  by: QueryFormColumn | 'self';
  direction: CrosstabSortDirection;
  type?: CrosstabSortType;
  nulls?: CrosstabNullSort;
};

type DimensionFieldConfig = {
  field: QueryFormColumn;
  label?: string;
  showSubtotal?: boolean;
  sort?: DimensionSortConfig;
};

type RowValueSummaryConfig = {
  value: DataRecordValue;
  semantic: MetricSemantic;
  summaryMetric?: QueryFormMetric;
  formatString?: string;
};

type CrosstabRowValueSummaryConfig = {
  field: QueryFormColumn;
  values: RowValueSummaryConfig[];
};

type CrosstabFieldConfig = {
  rows?: DimensionFieldConfig[];
  columns?: DimensionFieldConfig[];
  metrics?: MetricFieldConfig[];
  rowValueSummaries?: CrosstabRowValueSummaryConfig;
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};
```

Rules:

- `rows[].sort` controls row ordering. For production slice 10, the visible row
  field is `metric_name_with_unit` and the sort field is `metric_order`.
- `columns[].sort` controls dynamic column ordering. Dynamic selectors must
  preserve the configured column item, including sort metadata.
- `rowValueSummaries` is the preferred new row-value semantic contract.
- `semanticOverrideField` and `semanticOverrides` remain readable for old
  saved charts, but `rowValueSummaries` wins when both exist.
- Missing semantics are `unknown`. A chart with totals enabled must fail fast if
  any required row value has `unknown` semantics.

## Production Slice 10 Target

The production chart should continue to use the single-metric matrix shape:

```json
{
  "rows": [
    {
      "field": "metric_name_with_unit",
      "label": "指标",
      "sort": {
        "by": "metric_order",
        "direction": "asc",
        "type": "number",
        "nulls": "last"
      }
    }
  ],
  "columns": [
    {
      "field": "biz_date",
      "label": "日期",
      "sort": {
        "by": "biz_date",
        "direction": "asc",
        "type": "date",
        "nulls": "last"
      }
    }
  ],
  "metrics": [
    {
      "metric": "指标值",
      "label": "指标值",
      "semantic": "additive"
    }
  ],
  "rowValueSummaries": {
    "field": "metric_name_with_unit",
    "values": [
      { "value": "销量（件）", "semantic": "additive" },
      { "value": "销售额（金额）", "semantic": "additive" },
      { "value": "毛利率（%）", "semantic": "ratio" },
      { "value": "平均售价（金额）", "semantic": "average" }
    ]
  }
}
```

The full production list must include every business row displayed by the
dashboard, not only the example rows above.

Dynamic dimension defaults remain:

- Dimension 1: 日期
- Dimension 2: 无
- Dimension 3: 无

Native dashboard filters remain for business filters such as 店铺, 国家, 分类,
and 父体. The dynamic-dimension selectors are chart-local controls, not global
native filters.

## Dynamic Column Sorting

Column sorting has four layers and all must agree.

1. Dynamic selector resolution returns configured column items, not only raw
   column fields.
2. Server-column domain query uses the configured sort fields and directions.
   When `sort.by` is `self`, it orders by the selected column field. When
   `sort.by` is another physical field, that field must be included in the
   domain query if the query engine requires it for ordering.
3. Leaf query includes row fields, row sort fields, column fields, column sort
   fields, and metrics required for rendering and stable order.
4. The frontend crosstab engine applies the same comparator before building the
   column tree and generated column IDs.

The implementation should reject unsupported sort expressions. Sort fields must
be physical fields or already supported Superset column expressions accepted by
the existing query path. There should be no ad hoc string SQL construction for
sort behavior.

## Row Ordering

The row field remains `metric_name_with_unit`, but the row configuration can
reference a hidden sort field such as `metric_order`.

The query planner must include required row sort fields in leaf data and summary
data when they are needed to sort rendered rows. The render model should not
display hidden sort fields as separate row dimensions.

Rows without a required sort value fail fast in production mode. The design does
not silently fall back to alphabetic ordering, because that would hide broken
business configuration.

## Full Summary Totals

All total surfaces use summary queries. This includes additive rows.

The most important production rule is:

```text
总计 = full-filter-range SQL summary, not current visible page summary.
```

For server column pagination:

- domain and count queries still page the visible dynamic column tuples;
- leaf query still filters to current page tuples;
- row-total summary query does not receive the current page tuple filter;
- therefore the right-side `总计` column summarizes the full filter range.

For non-server pagination:

- leaf query can include all visible columns;
- summary queries still provide totals instead of relying on frontend summing.

Summary query planning should no longer be controlled only by
`hasNonAdditiveSummary`. A chart with any enabled total surface should plan the
required summary query for that surface. Metric semantics still decide how to
validate and format the returned values.

## Row-Specific Aggregation

Row-value summary semantics are resolved in this order:

1. Match `rowValueSummaries.field` against the current row value.
2. If no row-value summary exists, read legacy `semanticOverrideField` and
   `semanticOverrides`.
3. If no override exists, read the selected metric's default semantic.
4. If still missing, resolve to `unknown`.

For totals, `unknown` is invalid. The chart should fail before rendering a
misleading total.

`summaryMetric` is reserved for cases where the displayed leaf metric and the
summary metric differ. The initial implementation can reject `summaryMetric`
when it cannot be represented by the existing query path. It must not silently
ignore it.

## Query Planning

The existing query roles remain:

- `server_column_domain`
- `server_column_count`
- `leaf`
- `summary`

The query planner changes are:

- Build summary queries whenever enabled totals require them, including
  additive-only charts.
- Keep server-column bootstrap behavior: without cached page tuples, issue only
  domain and count queries.
- After page tuples are available, issue domain, count, leaf, and required
  summary queries.
- Do not add the current page tuple filter to `row_total` summary queries,
  because production `总计` is full range.
- Continue adding page tuple filters to summary kinds that intentionally
  describe current visible column cells or current page column totals.

If a future UI needs both `本页合计` and `全量合计`, that must be represented as
two distinct total columns. This phase implements only full-range `总计`.

## Transform and Engine Behavior

`transformProps` should build summary maps for all planned summary query
results and pass them into the crosstab engine.

The engine should:

- read row totals from `summaryValues.rowTotal` whenever `showColumnTotals` is
  enabled;
- read column totals from `summaryValues.columnTotal` whenever `showRowTotals`
  is enabled;
- read grand totals from `summaryValues.grandTotal` when both total axes are
  enabled;
- fail fast if a required summary value is missing;
- keep frontend summing only for non-total leaf construction where no summary
  surface is involved.

This removes the current mixed behavior where additive rows can be summed from
current-page generated columns while non-additive rows use SQL summary.

## Compatibility and Migration

Compatibility is read-only and narrow:

- Existing charts using `semanticOverrideField` and `semanticOverrides` can
  continue to resolve row semantics.
- New production metadata should write `rowValueSummaries`.
- The implementation should not introduce a broad migration layer or try to
  infer row semantics from display labels.
- Invalid or incomplete new configuration should produce explicit errors.

Production slice 10 migration should:

1. Back up current slice metadata.
2. Preserve `serverColumnPagination=true` and `columnPageSize=98`.
3. Preserve the three dynamic dimension selectors with mutually exclusive
   choices.
4. Set defaults to 日期, 无, 无.
5. Preserve non-dimension dashboard native filters.
6. Write row sort, column sort, and full `rowValueSummaries`.
7. Regenerate or save `query_context` so it matches the new query plan.

## Validation

Required local validation:

- Unit tests for field config parsing and priority between
  `rowValueSummaries` and legacy semantic overrides.
- Unit tests for dynamic column sort resolution.
- `buildQuery` tests proving:
  - domain query uses configured column sort;
  - leaf query contains required hidden sort fields without displaying them;
  - server-column leaf query still filters to current page tuples;
  - row-total summary query is full-range and has no page tuple filter;
  - additive-only charts with totals still emit summary queries.
- `summaryQueryPlan` tests proving totals are planned for additive and
  non-additive semantics.
- `transformProps` tests proving summary maps are used for additive rows.
- `engine` tests proving row totals fail when required summary values are
  missing and no longer fall back to generated-column sums.

Suggested focused commands:

```bash
npm run test -- superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts
npm run test -- superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
npm run test -- superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts
npm run test -- superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
npm run test -- superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts
npm run type -- --pretty false
uvx pre-commit run --files <changed files>
```

## Production Acceptance

Acceptance must verify both metadata and runtime behavior.

Metadata acceptance:

- slice 10 has `serverColumnPagination=true`;
- `crosstabFieldConfig.rows[0].field` is `metric_name_with_unit`;
- row sort references `metric_order`;
- selected metric remains `指标值`;
- `rowValueSummaries` covers every displayed business metric row;
- dynamic dimension defaults are 日期, 无, 无;
- dimension selectors are chart-local controls, not dashboard native filters.

Runtime acceptance:

- dashboard opens without browser unresponsiveness;
- domain and count queries run before current-page leaf query;
- current-page leaf query fetches only selected page tuples;
- `总计` values come from full-range row-total summary query;
- additive and non-additive rows both use summary for totals;
- dynamic column order matches configured sort;
- business metric rows match configured `metric_order`;
- screenshots and final slice backup are saved under `docs/superpowers/reports/`.

## Open Follow-Up

Approach C remains a future direction for a next-generation financial matrix
engine. It should be considered only after the production chart is stable under
this explicit row and column configuration model.
