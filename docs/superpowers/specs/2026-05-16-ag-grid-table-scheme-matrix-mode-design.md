# Table V2 with Column Schemes Matrix Mode Design

## Summary

Extend the existing `Table V2 with Column Schemes` chart with an optional, generic matrix mode. The goal is to support FineBI-like functional capabilities for cross tables and metric calculations without trying to reproduce FineBI visual styling.

This remains an extension of `plugin-chart-ag-grid-table-scheme`. It does not modify `pivot_table_v2`, does not introduce AG Grid Enterprise pivoting, and does not replace the existing column scheme API.

## Goals

- Add a generic matrix mode to `Table V2 with Column Schemes`.
- Support configurable row dimensions, column dimensions, metric value, row sort field, unit field, and total column.
- Support first-stage calculations: raw value, contribution, row contribution, and row ranking.
- Keep existing column schemes working for generated matrix columns.
- Add an explicit column settings toggle. Column settings must not open by default.
- Keep the first version testable and conservative, with a path to move more calculations into Superset post-processing later.

## Non-Goals

- No FineBI visual clone.
- No changes to native `pivot_table_v2`.
- No AG Grid Enterprise features.
- No backend API changes for column schemes.
- No server pagination support in matrix mode v1.
- No subtotal hierarchy, year-over-year, period-over-period, or complex percentage-total recomputation in v1.

## Superset Fit

Superset custom chart plugins are the correct extension point for highly custom tabular behavior. Existing Superset chart plugins use three relevant layers:

- `controlPanel` defines chart configuration.
- `buildQuery` prepares the query context and post-processing rules.
- `transformProps` turns returned query data into render-ready chart props.

The current `Table V2 with Column Schemes` already wraps official AG Grid Table V2 and provides a separate chart plugin. Matrix mode should continue this pattern by extending the scheme plugin's `controlPanel`, `buildQuery`, and `transformProps` without disturbing the official table plugin behavior when matrix mode is disabled.

## User-Facing Controls

Matrix controls are visible only in aggregate query mode.

- `Enable matrix mode`: boolean, default `false`.
- `Matrix rows`: required multi-select dimensions.
- `Matrix columns`: required one or more dimensions.
- `Matrix value`: required single metric.
- `Row sort`: optional field plus direction. Used to sort matrix rows.
- `Unit field`: optional dimension used only for display formatting.
- `Show total column`: boolean, default `true`.
- `Total position`: `left` or `right`, default `left`.
- `Value calculation`: one of `raw`, `contribution`, `row_contribution`, `row_rank`, default `raw`.
- `Matrix max generated columns`: internal constant or advanced control, default `200`.
- `Column settings enabled`: boolean, default `false`.

The column settings toggle only controls whether the chart toolbar exposes the column settings UI for this chart. It must not auto-open the settings modal. Existing scheme loading and applying still works when a saved scheme exists; the toggle is about user-facing settings entry points, not the persistence model.

## Data Flow

When matrix mode is disabled, the plugin returns the official AG Grid Table behavior unchanged.

When matrix mode is enabled:

1. `buildQuery` ensures the query includes all matrix rows, matrix columns, row sort fields, unit field, and the selected metric.
2. Superset returns long-form aggregate records.
3. `matrixTransform` converts long-form records into wide AG Grid rows and generated column definitions.
4. Generated matrix columns are passed through the existing column scheme pipeline.
5. The chart renders with standard AG Grid Table styling and existing toolbar behavior.

Input shape:

```text
row dimensions + column dimensions + metric value + optional row sort + optional unit
```

Output shape:

```text
row key fields + optional total + generated matrix value columns
```

## Matrix Transform

Add a pure `matrixTransform` module under the scheme plugin. It should have no React dependency.

Inputs:

- long-form records
- matrix control values
- metric label
- configured Superset column metadata where available

Outputs:

- `data`: transformed AG Grid row records
- `columns`: transformed AG Grid column metadata
- `generatedColumnIds`: matrix column IDs for scheme compatibility

Column ID rules:

- Stable IDs are required for column schemes.
- Dimension columns keep their existing column IDs.
- Total column uses a stable ID such as `__matrix_total`.
- Generated matrix columns use a stable encoded key derived from the column dimension values, for example `__matrix_col__2026-05-12`.
- Label changes should not break saved schemes as long as the generated column ID remains stable.

## Calculation Rules

### Raw

Each cell is the aggregate value for a row key and column key. If duplicate records map to the same cell, v1 sums them.

### Total

The total column sums non-empty cells in the current matrix row. Empty cells are ignored.

For percentage units, v1 does not recompute weighted percentages because the numerator and denominator are not guaranteed to be present. Users can disable the total column for those use cases or provide a metric whose total is already meaningful.

### Contribution

`cell / matrix total`, calculated across all non-empty numeric cells in the matrix.

### Row Contribution

`cell / row total`, calculated within the current matrix row.

### Row Rank

Ranks cells horizontally within the current matrix row. Ties use dense rank.

## Formatting

- Use existing Table V2 number formatting where possible.
- If `Unit field` is present, append the unit to displayed values.
- Unit `%` means append `%` without multiplying by 100. This matches datasets where percentage metrics already return values such as `9.79`.
- Other units are appended as text. Unit aliasing, such as mapping `金额` to a currency symbol, is out of scope for v1.
- Null or missing cells render as blank or existing Table V2 empty formatting. They do not participate in calculations.

## Column Schemes Compatibility

Existing field management remains the primary implementation for column visibility, order, width, and pinning.

Matrix mode must add only the generated matrix columns to the same AG Grid column state flow. Compatibility rules:

- Newly generated columns default to visible and append after saved columns.
- Removed generated columns are ignored when applying a saved scheme.
- Total column can be hidden, ordered, pinned, and restored like any other column.
- Matrix row dimension columns can be hidden only if AG Grid allows it; the implementation should not invent separate hidden-row-dimension semantics.
- The column settings entry point is controlled by `Column settings enabled`, default `false`.

## Validation And Fail-Fast Rules

Matrix mode should fail fast for invalid configurations.

- Missing `Matrix rows`, `Matrix columns`, or `Matrix value`: block render with a clear error.
- Server pagination enabled with matrix mode: block render or control-panel validation should prevent save.
- Non-numeric matrix value: block render with a clear error.
- Generated matrix columns above the configured limit: block render and ask the user to narrow filters or time range.
- Unsupported calculation type: block render.

## Testing

Unit tests:

- Long-form records convert to wide matrix rows.
- Multiple row dimensions create stable row keys.
- Multiple column dimensions create stable generated column IDs.
- Row sort field sorts rows and remains optional.
- Duplicate row/column cells sum.
- Empty values do not participate in totals.
- Total column works and can be positioned left or right.
- `%` units append without multiplying by 100.
- Contribution, row contribution, and row rank produce deterministic results.
- Generated matrix columns enter the column signature.
- Saved schemes tolerate newly added and removed generated matrix columns.

Focused build/query tests:

- Matrix mode includes rows, columns, metric, unit, and sort field in the query.
- Matrix mode disabled preserves official Table V2 query behavior.
- Server pagination validation rejects matrix mode.

Browser acceptance:

- Convert `订单利润指标矩阵 - 日维度` to `Table V2 with Column Schemes`.
- Enable matrix mode with rows as metric fields, columns as date, value as metric value, and unit as unit.
- Confirm generated date columns, total column, and units display.
- Confirm column settings are not visible/open by default when the toggle is off.
- Enable the column settings toggle and confirm settings can hide/pin/reorder matrix columns.
- Refresh the dashboard and confirm saved schemes apply.

## Rollout Plan

1. Implement pure matrix transform and tests.
2. Add form-data types and control-panel controls.
3. Extend scheme plugin `buildQuery`.
4. Extend scheme plugin `transformProps`.
5. Gate toolbar column settings behind the explicit toggle.
6. Add focused TypeScript tests.
7. Apply to chart 10 and run browser acceptance.

## Open Follow-Up

The v1 design intentionally leaves advanced calculations for later post-processing integration. If matrix mode is used with larger datasets or complex percentage totals, the next design should move those calculations into Superset query post-processing or a backend metric contract.
