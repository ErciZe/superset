# Crosstab V3-S0 Dynamic Group By Parameter Design

Date: 2026-05-20
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Target plugin: `superset-frontend/plugins/plugin-chart-crosstab-table`

## Summary

Crosstab V3-S0 is a feasibility spike for chart-local dynamic group-by selection.
It lets a dashboard user choose one whitelisted dimension, such as shop, country,
MSKU, or parent product, and uses that choice to replace one configured group-by
slot for the current crosstab chart.

This is not a full parameter engine. The purpose is to prove that Superset chart
form data, crosstab query generation, dashboard chart runtime state, AG Grid
header rebuilds, and server column pagination state can support one dynamic
dimension switch without stale columns or hidden fallback behavior.

## Goals

- Add one chart-local single-select control for a dynamic group-by dimension.
- Support one dynamic group-by slot in the crosstab query model.
- Allow only an explicit whitelist of dataset fields, for example shop, country,
  MSKU, and parent product.
- Make selection behave like changing the underlying `groupbyRows` or
  `groupbyColumns` field for that slot.
- Requery only the current chart when the dashboard user changes the selection.
- Rebuild AG Grid headers from the new dimension values after each switch.
- Clear server column pagination, tuple cache, column signature, and expanded
  path state when the effective group-by structure changes.
- Fail fast when the selected field is missing, invalid, or incompatible with
  the configured dataset.

## Non-Goals

- No multi-slot parameter system.
- No Dashboard global filter or native filter integration.
- No linked parameters or cascading option logic.
- No saved per-user runtime preference.
- No arbitrary field selection from the full dataset schema.
- No calculated-field expression language.
- No browser-side business switch logic that rewrites SQL expressions.
- No backend API shape change unless the spike proves the current chart query
  context cannot represent the selected group-by field.

## Current Context

The crosstab plugin already has a stable V1/V2 foundation:

- `groupbyRows` and `groupbyColumns` define the row and column dimensions.
- `crosstabFieldConfig` stores crosstab-specific field metadata.
- Server column pagination uses chart `ownState` to request visible generated
  column windows.
- V2 added metric semantics and SQL-backed summary planning.

Production slice 10 currently represents a fixed daily profit matrix. V3-S0
should not rewrite that chart into a generic parameter platform. It should prove
one narrow interaction: the user can switch the analysis dimension in the chart
toolbar, and the crosstab behaves as though one group-by field had changed.

## Configuration Model

The spike introduces one dynamic slot configuration in form data. The exact
TypeScript names can be adjusted during planning, but the contract should remain
equivalent to this shape:

```ts
type DynamicGroupByPlacement = 'rows' | 'columns';

type CrosstabDynamicGroupByOption = {
  label: string;
  column: QueryFormColumn;
};

type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  placement: DynamicGroupByPlacement;
  slotIndex: number;
  defaultColumn: QueryFormColumn;
  options: CrosstabDynamicGroupByOption[];
};
```

Resolution rules:

1. Start from the persisted `groupbyRows` and `groupbyColumns`.
2. If dynamic group-by is disabled, use the persisted dimensions unchanged.
3. If enabled, read the current selected column from chart runtime state.
4. If runtime state has no selected column, use `defaultColumn`.
5. Validate that the selected column exists in `options`.
6. Replace `groupbyRows[slotIndex]` or `groupbyColumns[slotIndex]` according to
   `placement`.
7. Validate that the final field exists in the dataset query context.
8. Use the resolved dimensions for query generation, field config lookup, header
   generation, tuple keys, and cache signatures.

The initial production-oriented option set should be small:

```text
店铺 -> shop_name
国家 -> country
MSKU -> msku
父体 -> parent_asin
```

The implementation plan must verify the real production dataset field names
before using these names.

## Runtime State

The selected dynamic group-by value belongs to the chart instance at runtime. It
should not mutate saved Explore form data on every dashboard interaction.

Required runtime state:

```ts
type CrosstabDynamicGroupByRuntimeState = {
  selectedColumn?: QueryFormColumn;
};
```

When the selected column changes, the chart must compute a new effective
group-by signature. If the signature differs from the previous signature, clear:

- current server column page
- generated column domain cache
- tuple-to-column lookup cache
- AG Grid column definitions
- expanded row or column paths that depend on the old dimension labels
- any query result routing state keyed by previous group-by dimensions

The current chart then requests fresh data using the resolved dimensions.

## Query Flow

The leaf query should be built from the effective dimensions:

```text
effective row dimensions + effective column dimensions + metrics
```

Examples for a daily matrix with the dynamic slot in columns:

```text
店铺:
GROUP BY metric_name_with_unit, biz_date, shop_name

国家:
GROUP BY metric_name_with_unit, biz_date, country

MSKU:
GROUP BY metric_name_with_unit, biz_date, msku
```

Server column pagination queries, count queries, domain queries, and summary
queries must use the same effective dimensions. It is invalid for the leaf query
to use one selected field while pagination or summary queries still use the old
field.

## UI Design

The user-facing control is a compact chart-local toolbar select:

```text
分组维度: [店铺 v]  [刷新] [CSV]
```

Interaction rules:

- The control appears only when dynamic group-by is enabled for the chart.
- The select is single-choice.
- Changing the select updates only this crosstab chart.
- The chart enters its normal loading state while the requery is in flight.
- After data returns, headers and cells reflect the newly selected dimension.
- The control should use existing Superset component wrappers from
  `@superset-ui/core/components` rather than direct Ant Design imports.

The control belongs near existing chart actions because it is a runtime analysis
switch, not a chart-builder field editor.

## Field Config Interaction

`crosstabFieldConfig` must resolve against the effective group-by field list.
The dynamic slot should not leave stale configuration attached to the previous
field after a switch.

Rules:

- Field config for fixed fields remains unchanged.
- Field config for dynamic fields is looked up by resolved column identity.
- If a selected option has no field config entry, use only the existing default
  formatting behavior that already applies to ordinary dimensions.
- Do not retain removed alias controls or reintroduce alias-specific UI.
- If a required config is missing for rendering correctness, fail fast with a
  clear error instead of silently rendering stale labels.

## Error Handling

V3-S0 must fail fast for:

- dynamic group-by enabled with an empty option list
- selected column not present in the whitelist
- configured `slotIndex` outside the target group-by array
- selected field missing from the dataset query context
- pagination or summary query dimensions diverging from the leaf query
- stale query result metadata that cannot be matched to the current effective
  group-by signature

The spike should not add compatibility fallback logic that hides these states.

## Acceptance Criteria

The spike is acceptable when it proves the following on the target crosstab
chart or an equivalent local fixture:

- Explore configuration can save the dynamic group-by slot and whitelist.
- Dashboard chart toolbar renders `分组维度` with the approved options.
- Selecting `店铺` queries and renders headers based on shop values.
- Selecting `国家` requeries the same chart and renders headers based on country
  values, with no stale shop headers.
- Selecting `MSKU` performs the same requery and header rebuild.
- Server column pagination resets to the first page after each selection change.
- Row and column tuple caches do not leak values from the previous selection.
- Existing totals, metric semantics, and export entry points still work for the
  selected effective dimensions or fail with an explicit error.

## Test Plan

Unit tests:

- Dynamic group-by config resolves persisted dimensions when disabled.
- Runtime selected column replaces the configured slot when enabled.
- Invalid selected column fails whitelist validation.
- Invalid slot index fails before query generation.
- Effective dimension signature changes when the dynamic field changes.
- Cache reset decisions are triggered by signature changes.

Query tests:

- Leaf query uses effective dimensions.
- Server column domain and count queries use the same effective dimensions.
- Summary query planning uses the same effective dimensions.

React tests:

- Toolbar select renders when dynamic group-by is enabled.
- Changing the select dispatches the chart-local state update and requery path.
- The select is absent when dynamic group-by is disabled.

Engine or transform tests:

- AG Grid column definitions are rebuilt after effective column dimensions
  change.
- Previous generated column headers are absent after a dimension switch.

Focused browser verification:

- Use the production-like slice 10 flow to switch `店铺 -> 国家 -> MSKU`.
- Confirm each switch renders non-empty data and correct header labels.
- Confirm pagination state starts from the first generated column page.

## Implementation Boundary For The Next Plan

The next implementation plan should be a V3-S0 feasibility plan, not a full V3
parameter roadmap. It should start with static contract inspection and focused
tests, then make the smallest vertical change that proves:

1. form data can express one dynamic group-by slot
2. `buildQuery` consumes the effective dimensions
3. the dashboard chart toolbar can update chart-local runtime state
4. `transformProps` and AG Grid rebuild against the new signature
5. server column pagination state is cleared on dimension changes

If any of those steps exposes a Superset chart-query contract limitation, the
implementation should stop and report the exact blocker before expanding scope.
