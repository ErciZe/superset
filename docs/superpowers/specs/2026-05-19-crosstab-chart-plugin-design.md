# Crosstab Chart Plugin Design

## Summary

Add a new Superset chart plugin for FineBI-like cross tables. The plugin is independent from `Table V2 with Column Schemes` and should not keep extending `plugin-chart-ag-grid-table-scheme` for cross-table behavior.

The new plugin uses AG Grid Community as the rendering base, but owns its cross-table engine: row dimensions, column dimensions, metric cells, generated column domain, subtotals, totals, and formatting rules. Superset remains the query and dashboard integration layer.

The v1 goal is functional parity for the core FineBI cross-table model: row dimension area, column dimension area, and value area. V2 is reserved for advanced FineBI-style configuration and larger-scale optimization.

## Goals

- Create a standalone Superset chart plugin named `plugin-chart-crosstab-table`.
- Support multi-level row dimensions, multi-level column dimensions, and a value area.
- Support multiple metrics, with metric names rendered as the last column level.
- Generate complete column tuples from query-result-derived column dimension domains.
- Display missing cell combinations as blank, not zero.
- Support row hierarchy, row expand/collapse, row subtotal, row total, column total, and basic column subtotal controls.
- Support business formatting needed by cross tables: numeric formats, percent formats, currency formats, conditional colors, arrow indicators, and total-row styling.
- Preserve Superset-native dashboard filters, time filters, chart export entry points, and Explore controls.
- Fail fast when generated columns exceed the configured limit.

## Non-Goals

- No FineBI visual clone.
- No drag-and-drop field designer in v1.
- No AG Grid Enterprise pivoting.
- No changes to Superset backend APIs in v1.
- No full-database domain queries in v1.
- No default conversion of missing cells to zero.
- No server pagination in v1.
- No reuse of `plugin-chart-ag-grid-table-scheme` as the chart type for the independent component.

## FineBI Capability Mapping

FineBI defines a cross table as a table made from row dimensions, column dimensions, and a value area. It also documents multi-dimension grouping, metric summary/calculation, metric-name grouping, and row/column field order adjustment.

The v1 plugin maps those concepts into Superset controls:

- FineBI row dimensions -> `groupbyRows`.
- FineBI column dimensions -> `groupbyColumns`.
- FineBI value area -> Superset `metrics`.
- FineBI field order -> order of `groupbyRows`, `groupbyColumns`, and `metrics`.
- FineBI multi-metric table -> metrics appended as the final generated column level.
- FineBI summary rows/columns -> row subtotal, row total, and column total controls.
- FineBI formatting -> Superset number formatting plus crosstab-specific conditional styling controls.

V1 should optimize for capability alignment, not screenshot-level visual reproduction.

## Plugin Shape

The plugin should live under `superset-frontend/plugins/plugin-chart-crosstab-table/` and follow normal Superset chart plugin layers:

- `controlPanel`: row dimensions, column dimensions, metrics, totals, formatting, and safety limits.
- `buildQuery`: convert crosstab controls into a Superset aggregate query.
- `transformProps`: convert query results into crosstab engine input and AG Grid props.
- `crosstabEngine`: pure data transformation with no React dependency.
- `CrosstabTable`: React renderer around AG Grid Community.

The chart plugin should be registered as a separate visualization type so the user can choose a dedicated cross table instead of overloading a general table chart.

## V1 User-Facing Controls

- `Rows`: required multi-select dimensions.
- `Columns`: required multi-select dimensions.
- `Metrics`: required one or more metrics.
- `Metric layout`: v1 fixed to metrics as the final column level.
- `Show row subtotals`: boolean, default `true`.
- `Show row totals`: boolean, default `true`.
- `Show column totals`: boolean, default `true`.
- `Show column subtotals`: boolean, default `false`.
- `Missing cell display`: v1 fixed to blank.
- `Max generated columns`: default `300`.
- `Default row expanded depth`: default `1`.
- `Number format`: default Superset metric formatting.
- `Conditional formatting`: value-based color and arrow rules.

The v1 control set should stay narrow. Avoid adding controls that only exist to mimic FineBI UI rather than support the crosstab data model.

## Data Flow

1. Superset dashboard or Explore supplies chart form data and filters.
2. `buildQuery` creates one aggregate query using all selected row dimensions, column dimensions, and metrics.
3. Superset returns long-form aggregate records.
4. `crosstabEngine` derives row keys, column dimension domains, column tuples, metric tuples, totals, and display rows.
5. `transformProps` converts the engine output into AG Grid row data and nested column definitions.
6. `CrosstabTable` renders the grid and handles row expand/collapse, formatting, and export wiring.

Input shape:

```text
row dimensions + column dimensions + metric values
```

Output shape:

```text
row hierarchy columns + generated column groups + metric leaf columns + subtotal/total rows and columns
```

## Column Domain Rules

V1 derives column domains from query results only.

For `groupbyColumns = [biz_date, shop_name]`, if the returned records contain dates `2026-05-01`, `2026-05-02` and shops `A`, `B`, the engine generates all four column tuples:

```text
2026-05-01 / A
2026-05-01 / B
2026-05-02 / A
2026-05-02 / B
```

If a generated tuple has no matching record, its cell is blank. Blank cells do not participate in totals or percentage calculations.

This rule intentionally does not discover values that are absent from the current query result. A later domain-query feature belongs to v2.

## Row And Column Model

Rows:

- Support multiple row dimensions.
- Render a tree-like row hierarchy.
- Support row expand/collapse in v1.
- Add subtotal rows per row dimension level when enabled.
- Add a grand total row when enabled.

Columns:

- Support multiple column dimensions.
- Render nested AG Grid column groups.
- Add metrics as the final leaf level when more than one metric is selected.
- Add a grand total column when enabled.
- Keep column subtotals available but default them off in v1.
- Do not support column expand/collapse in v1.

Stable IDs:

- Row keys and column keys must use canonical typed, length-prefixed encoding.
- Display labels are separate from encoded IDs.
- Generated column IDs must remain stable across refreshes for the same dimension values.

## Value And Summary Rules

- Duplicate records mapping to the same row key, column tuple, and metric are summed.
- Missing generated combinations render blank.
- Blank cells do not participate in subtotal or total calculations.
- Numeric totals sum numeric cells only.
- Percentage, ratio, and average metrics use the metric value returned by Superset. V1 does not recompute weighted percentages unless the selected metric itself encodes the correct aggregate.
- Invalid non-numeric values for numeric totals fail fast when totals require numeric input.

## Formatting

V1 formatting supports:

- Superset metric number formats.
- Percent and currency formats.
- Empty-cell blank rendering.
- Conditional background or text color.
- Arrow indicators for positive, negative, and threshold-based changes.
- Bold or shaded total/subtotal rows.

Formatting should be declarative. V1 must not evaluate arbitrary user JavaScript in the browser.

## Export

V1 should first use AG Grid's available export path for the current rendered table. The exported data should include visible rows, visible generated columns, subtotals, totals, and metric labels.

If AG Grid Community export cannot preserve enough crosstab structure, add a focused CSV builder that serializes nested column headers into repeated header rows. Styled Excel export is a v2 concern.

## Validation And Fail-Fast Rules

- Missing row dimensions, column dimensions, or metrics: block render with a clear error.
- Generated column count above `max generated columns`: block render and ask the user to narrow filters or time range.
- Server pagination enabled: block render in v1.
- Unsupported metric layout: block render.
- Unsupported formatter expression or unsafe formatting config: block render.
- Non-numeric values used in totals: block render unless totals are disabled.

Avoid fallback rendering that hides configuration errors.

## V2 Boundary

V2 is explicitly out of v1 implementation, but the v1 design should leave room for these extensions:

- FineBI-style metric-name custom grouping, such as grouping metrics under `Service Score` or `Quality Score`.
- External domain queries for dates, shops, countries, or other dimensions so the table can display values absent from the current result set.
- Column hierarchy expand/collapse.
- Advanced subtotal placement and per-level subtotal toggles.
- Advanced calculations: row percentage, column percentage, contribution, ranking, year-over-year, period-over-period, and weighted percentage totals.
- Configurable missing-cell display: blank, zero, or custom text.
- Large-data optimization: virtual columns, chunked rendering, post-processing, or cache-backed domain/value retrieval.
- Enhanced interactions: cell drill-through, refined cross filters, context menus, and range copy.
- Enhanced export that preserves multi-level headers, styles, totals, subtotals, and formatting.

V2 should be planned only after v1 proves the standalone plugin model and core cross-table engine.

## Testing

Unit tests:

- Row and column dimension records convert into stable row keys and column tuples.
- Query-result-derived domains generate complete Cartesian column tuples.
- Missing tuple cells render blank and do not affect totals.
- Multiple metrics render as the final column level.
- Duplicate cells sum.
- Row subtotal, row total, column total, and default-off column subtotal are deterministic.
- Stable IDs do not collide for typed, null, or separator-like values.
- Generated column limit fails fast.

Build/query tests:

- `buildQuery` includes all row dimensions, column dimensions, and metrics.
- Superset filters and time range pass through unchanged.
- Server pagination is rejected.

Renderer tests:

- Nested column definitions reflect column dimensions and metric leaves.
- Row hierarchy expand/collapse changes visible rows without changing totals.
- Conditional formatting applies to leaf cells and total rows according to config.

Browser acceptance:

- Create a temporary crosstab chart from the order-profit daily dataset.
- Configure rows as contract or metric dimensions, columns as date and shop, and values as one or more metrics.
- Confirm row dimension area, column dimension area, value area, blank missing cells, subtotals, totals, and conditional arrows render.
- Confirm dashboard filters and `org=1` dataset filtering remain effective.
- Confirm export contains rendered rows and generated columns.

## Rollout Plan

1. Scaffold the independent chart plugin and register the visualization type.
2. Implement the pure `crosstabEngine` with unit tests.
3. Add `controlPanel`, types, and `buildQuery`.
4. Add `transformProps` and AG Grid renderer.
5. Add formatting, totals, and export wiring.
6. Run focused plugin tests, TypeScript, and lint.
7. Create a temporary validation chart and run browser acceptance.

## Assumptions

- The first implementation targets Superset's existing plugin architecture.
- AG Grid Community is available and acceptable as the v1 rendering base.
- V1 derives domains only from the current query result.
- V1 keeps missing cells blank.
- V1 keeps metrics as the final column level.
- V1 does not add backend APIs.
