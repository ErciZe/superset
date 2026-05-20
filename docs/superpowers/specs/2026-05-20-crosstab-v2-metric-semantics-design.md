# Crosstab v2 Metric Semantics Design

Date: 2026-05-20
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Target plugin: `superset-frontend/plugins/plugin-chart-crosstab-table`

## Summary

Crosstab v2 adds an explicit metric-semantics contract and SQL-backed summary model. The goal is to make row totals, row subtotals, column totals, column subtotals, and grand totals correct for additive and non-additive metrics instead of silently recomputing every summary in the frontend.

The first v2 implementation should use the full summary approach: all summary types are designed up front, while query generation remains controlled by summary toggles and metric semantics. The design prioritizes correctness and fast failure over fallback rendering.

## Goals

- Support explicit metric semantics: `additive`, `ratio`, `average`, `distinct`, and `unknown`.
- Default unspecified metrics to `unknown`.
- Support row-value semantic overrides for production datasets where business metric names live in a row dimension, such as `metric_name_with_unit`.
- Use SQL summary results for non-additive summaries.
- Support SQL-backed row total, row subtotal, column total, column subtotal, and grand total.
- Preserve existing additive behavior when all involved metrics are additive.
- Fail fast when summary rendering would require unknown semantics, missing SQL summary results, or non-numeric summary values.
- Replace positional `queriesData[index]` summary handling with explicit query plan metadata.

## Non-Goals

- No user parameter system in this phase.
- No FineBI formula language or arbitrary calculated-field engine.
- No arbitrary JavaScript expression evaluation in the browser.
- No dataset-level semantic metadata migration in this phase.
- No new Superset backend API shape unless a later implementation checkpoint proves the existing query-context model cannot represent the needed summaries.
- No performance guarantee for every large-data case beyond preserving existing server column pagination behavior.

## Current Problem

V1 can render the production crosstab and has a narrow SQL row-total path when server column pagination is enabled. That path builds a query with `columns: rowDimensions` and the selected metrics, then `transformProps` reads it from `queriesData[3]` and injects the result into the total column.

This is not a full summary semantics system:

- The engine still assumes numeric frontend addition for most subtotal and total cells.
- The existing SQL summary path is row-total only.
- Grand total can still be derived from row totals in the frontend.
- Column totals and column subtotals do not have a non-additive SQL summary contract.
- There is no way to mark whether a metric is additive, ratio, average, distinct, or unknown.
- The production chart uses one Superset metric field, `指标值`, while different business metrics are represented by row values such as `销售额（金额）` and `毛利率（%）`.

The v2 design fixes the contract before expanding more FineBI-style functionality.

## Metric Semantics

### Semantic Types

`additive`
: Values can be summed across rows and columns. Examples include sales amount, quantity, and cost.

`ratio`
: Values are ratios or percentages whose totals must come from SQL aggregate semantics. Examples include gross margin rate and conversion rate.

`average`
: Values are averages whose totals must come from SQL aggregate semantics.

`distinct`
: Values come from distinct-count-style aggregation and must come from SQL aggregate semantics.

`unknown`
: The metric has no declared semantics. If any summary is enabled and the metric participates in that summary, rendering must fail fast.

### Configuration Model

Metric default semantics live on metric field config:

```ts
type MetricSemantic = 'unknown' | 'additive' | 'ratio' | 'average' | 'distinct';

type MetricFieldConfig = {
  metric: QueryFormMetric;
  label?: string;
  semantic?: MetricSemantic;
};
```

Row-value overrides handle datasets where a single Superset metric column carries multiple business metrics:

```ts
type MetricSemanticOverride = {
  value: DataRecordValue;
  semantic: MetricSemantic;
};

type CrosstabMetricSemanticConfig = {
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};
```

The production target should be represented as:

```text
semanticOverrideField: metric_name_with_unit
销售额（金额） -> additive
毛利率（%） -> ratio
```

### Resolution Rules

1. Start with the selected metric's configured semantic.
2. If the record or summary key has a value for `semanticOverrideField`, apply the matching override.
3. If no semantic is found, use `unknown`.
4. If a summary is enabled and the resolved semantic is `unknown`, fail fast before rendering.
5. If the required SQL summary result is missing for a non-additive semantic, fail fast.
6. If the SQL summary value is non-numeric where a numeric summary is required, fail fast.

## Summary Query Model

The leaf query remains:

```text
row dimensions + column dimensions + metrics
```

V2 adds SQL summary queries according to enabled summary controls and required metric semantics.

Basic summary queries:

```text
Row total:       row dimensions + metrics
Column total:    column dimensions + metrics
Grand total:     metrics only
```

Cross summary queries:

```text
Row subtotal cells:       row prefix dimensions + column dimensions + metrics
Column subtotal cells:    row dimensions + column prefix dimensions + metrics
Row subtotal total cells: row prefix dimensions + metrics
Column subtotal totals:   column prefix dimensions + metrics
```

Query generation must be pruned:

- Do not build row subtotal queries when row subtotals are disabled.
- Do not build column subtotal queries when column subtotals are disabled.
- Do not build SQL summary queries for additive-only summaries unless a later validation mode asks for SQL comparison.
- Build the required SQL summaries for every enabled summary that contains any non-additive metric.
- Fail before query generation when an enabled summary depends on `unknown` semantics.

## Query Plan Metadata

The implementation should introduce a pure query-plan layer instead of relying on positional reads such as `queriesData[3]`.

Each query in the plan should have stable metadata:

```ts
type CrosstabQueryRole =
  | 'leaf'
  | 'server_column_domain'
  | 'server_column_count'
  | 'summary';

type CrosstabSummaryKind =
  | 'row_total'
  | 'row_subtotal_cells'
  | 'row_subtotal_total'
  | 'column_total'
  | 'column_subtotal_cells'
  | 'column_subtotal_total'
  | 'grand_total';

type CrosstabQueryPlanItem = {
  queryId: string;
  role: CrosstabQueryRole;
  summaryKind?: CrosstabSummaryKind;
  rowDepth?: number;
  columnDepth?: number;
};
```

`buildQuery` should attach enough metadata for `transformProps` to route `queriesData` back to the plan. If the Superset chart query plumbing cannot preserve custom metadata directly, the plan must be reconstructed deterministically from `formData`, `ownState`, and query order, then validated against the expected length and roles.

## Module Boundaries

### `metricSemantics.ts`

Responsibilities:

- Parse metric default semantics and row-value overrides.
- Resolve the semantic for a metric in a row or summary context.
- Validate unknown or conflicting semantics before rendering.
- Keep all semantic-specific failure messages in one place.

### `summaryQueryPlan.ts`

Responsibilities:

- Build the leaf, server column pagination, and summary query plan.
- Produce stable query IDs and summary metadata.
- Prune unnecessary SQL summary queries for additive-only summaries.
- Preserve the existing server column pagination domain, count, data, and row-total behavior while replacing positional assumptions.

### `summaryResults.ts`

Responsibilities:

- Convert SQL summary result records into typed lookup maps.
- Use the existing tuple encoding utilities for row and column keys.
- Fail fast when a required SQL summary value is absent or non-numeric.

### `engine.ts`

Responsibilities:

- Continue to build row hierarchy, column hierarchy, leaf cells, and additive summaries.
- Accept optional `summaryValues`.
- Choose frontend additive values or SQL summary values according to resolved metric semantics.
- Avoid direct knowledge of query-context shape.

### `transformProps.ts`

Responsibilities:

- Reconstruct or consume query plan metadata.
- Route `queriesData` into leaf data and summary result maps.
- Inject semantic and summary context into the engine.
- Avoid hard-coded summary indexes.

### `CrosstabTable.tsx`

Responsibilities:

- Render engine output.
- Keep pagination, expand/collapse, formatting, and export behavior separate from metric semantics.
- Do not calculate summary semantics in the React layer.

## Error Handling

The v2 summary system must fail fast for:

- Summary enabled with `unknown` metric semantics.
- Missing semantic override for a row-value metric when summaries are enabled.
- Missing SQL summary result for a non-additive summary cell.
- Non-numeric SQL summary value where a numeric summary is required.
- Query plan and `queriesData` length or role mismatch.
- Unsupported mixed semantic cases that cannot be represented by the current query plan.

The chart should not silently show empty summary cells for required non-additive summaries.

## Implementation Checkpoints

### 1. Semantic Contract And Fail-Fast

- Extend types for metric semantics and row-value overrides.
- Add semantic parsing and validation.
- Add tests for `unknown`, additive, ratio, and production row-value overrides.
- Preserve current additive rendering behavior.

### 2. Query Plan Layer

- Introduce query plan metadata and deterministic query routing.
- Replace the existing positional row-total handling.
- Keep current server column pagination behavior equivalent.
- Add tests for plan shape with and without server column pagination.

### 3. SQL Summary Coverage

- Add SQL summary result maps for row total, row subtotal, column total, column subtotal, and grand total.
- Ensure non-additive summaries use SQL values.
- Keep additive summaries frontend-computed unless SQL comparison mode is explicitly added later.
- Add tests for ratio, average, distinct, missing summary values, and non-numeric summary values.

### 4. Production Acceptance

- Configure the production crosstab sample:
  - `销售额（金额） -> additive`
  - `毛利率（%） -> ratio`
- Verify `销售额（金额）` totals still match additive leaf sums.
- Verify `毛利率（%）` row total, subtotal, column total, column subtotal, and grand total come from SQL summary results instead of frontend addition.
- Run the crosstab Jest suite, ESLint, TypeScript check, frontend production build, and `git diff --check`.
- If deploying, use the existing Superset production ops flow and browser-visible validation.

## Acceptance Criteria

- Unknown metrics cannot render summaries.
- Non-additive summaries are never produced by frontend sum or average.
- Missing required SQL summary data fails fast.
- Existing additive v1 behavior does not regress.
- Server column pagination domain, count, data, page-size, and tuple-cache behavior remain stable.
- Query routing no longer depends on magic positional indexes for summary semantics.
- The production sample can encode both additive and ratio business metrics even though they share the same Superset metric field.

## Open Boundaries

- Dataset-level semantic metadata is the preferred long-term model, but this phase uses chart-level configuration and row-value overrides.
- SQL validation mode for additive metrics can be added later if needed.
- Query count and performance may require follow-up optimization after correctness is established.
- Full FineBI parameter and calculated-field compatibility should wait until this summary semantics system is accepted.
