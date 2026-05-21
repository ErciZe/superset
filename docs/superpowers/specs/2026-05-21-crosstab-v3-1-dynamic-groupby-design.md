# Crosstab V3.1 Dynamic Group By Design

Date: 2026-05-21
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Target plugin: `superset-frontend/plugins/plugin-chart-crosstab-table`
Production target: `slice_id=10`

## Summary

Crosstab V3.1 formalizes dynamic group-by into a multi-slot, whitelist-driven
runtime capability. It extends the current v2.1 production-proven crosstab chart
from a single dynamic dimension selector into multiple independent selectors and
multi-column options, while keeping all runtime choices chart-local.

This phase does not add dynamic metrics, numeric parameters, calculated fields,
or server-column pagination shape expansion. Those remain later phases. V3.1 is
the schema and runtime foundation that those phases will reuse.

## Confirmed Baseline

V2.1 is treated as complete for this design:

- Production slice 10 renders as `viz_type = crosstab-table`.
- `crosstabFieldConfig` is present and no longer `null`.
- Metric semantic overrides exist for the production metric-label shape.
- Server column pagination remains enabled with generated column width `120`.
- The production bundle was rebuilt, deployed, and browser-rendered after the
  final total-summary query-plan fix.

The older v2.1 report still contains an early browser-auth blocker note, but the
latest execution closed the practical rendering blocker with a production Chrome
screenshot. V3.1 should not reopen v2.1 as a prerequisite unless fresh evidence
shows slice 10 is broken again.

## Goals

- Support multiple dynamic group-by slots in one crosstab chart.
- Support one option replacing multiple contiguous dimensions through
  `spliceCount`.
- Preserve compatibility with the existing single-slot production shape.
- Keep runtime choices in chart `ownState`, not saved chart params.
- Keep all selectable dimensions restricted to an explicit whitelist.
- Rebuild query planning, summary planning, server column pagination signatures,
  and AG Grid headers from the effective row/column dimensions.
- Fail fast on invalid slot configuration, invalid option selection, duplicate
  dimensions, and unsupported server-pagination combinations.
- Prove production slice 10 can still render the current four-option selector
  after the schema migration.

## Non-Goals

- No dynamic metric selector. That is V3.2.
- No numeric or text parameter engine. That is V4.
- No calculated-field AST engine. That is V4.
- No server-column pagination support for multiple row dimensions or multiple
  metrics. That is V5.
- No cumulative drill-down interaction in V3.1. It is a stretch item after
  multi-slot and multi-column options are stable.
- No new backend Crosstab API.
- No AG Grid Enterprise Pivoting or Server-Side Row Model.
- No FineBI UI cloning.
- No visual builder for dynamic group-by in the first V3.1 implementation pass.

## Product Boundary

The chart keeps the interaction frame already established in the implementation
path document:

```text
crosstab-table-toolbar
  [CSV] [dynamic group selector 1] [dynamic group selector 2] ...

crosstab-grid-container
  pinned row header columns + AG Grid grouped column headers + value cells

crosstab-table-footer
  server column pagination controls
```

Rows, columns, metrics, labels, and metric semantics remain configured in
Explore through `crosstabFieldConfig`. The toolbar only exposes runtime
analysis switches. It must not become a field editor.

## Configuration Model

V3.1 introduces a slot-array shape as the canonical `dynamicGroupBy` form:

```ts
export type CrosstabDynamicGroupBySlot = {
  id: string;
  label?: string;
  placement: 'rows' | 'columns';
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: {
    id: string;
    label: string;
    columns: QueryFormColumn[];
  }[];
};

export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  slots: CrosstabDynamicGroupBySlot[];
};
```

Rules:

- `id` and option `id` are stable identifiers used by `ownState`.
- `spliceCount` defaults to `1`.
- Option `columns.length` must equal `spliceCount`, except `columns.length = 0`
  is allowed as an explicit "none" option.
- Empty option columns remove the target slot segment from the effective
  dimensions.
- Slot order in saved JSON is not trusted. Selectors render by placement and
  ascending `slotIndex`. Dimension splices apply in descending `slotIndex`
  order, or by an equivalent offset-safe algorithm, so earlier removals cannot
  shift later slots.

## Compatibility Model

The existing production shape remains accepted input:

```json
{
  "enabled": true,
  "placement": "columns",
  "slotIndex": 1,
  "defaultColumn": "shop_name",
  "options": [
    { "label": "店铺", "column": "shop_name" },
    { "label": "国家", "column": "country" }
  ]
}
```

At parse time it normalizes to:

```json
{
  "enabled": true,
  "slots": [
    {
      "id": "__legacy__",
      "label": "分组维度",
      "placement": "columns",
      "slotIndex": 1,
      "spliceCount": 1,
      "defaultOptionId": "shop_name",
      "options": [
        { "id": "shop_name", "label": "店铺", "columns": ["shop_name"] },
        { "id": "country", "label": "国家", "columns": ["country"] }
      ]
    }
  ]
}
```

The legacy runtime key `selectedDynamicGroupByColumn` is read-only compatible.
When it exists, V3.1 maps it to the matching `__legacy__` option. New writes use
the new object form only.

## Runtime State

New runtime state:

```ts
selectedDynamicGroupBy?: Record<string, string>;
```

Legacy runtime state still read:

```ts
selectedDynamicGroupByColumn?: QueryFormColumn;
```

When a selector changes, the chart writes:

```ts
setDataMask({
  ownState: {
    selectedDynamicGroupBy: {
      ...previousSelections,
      [slotId]: optionId,
    },
    currentColumnPage: 0,
    serverColumnPageTuples: [],
    serverColumnTotalCount: undefined,
    expandedRowPaths: [],
  },
});
```

The selected runtime value must be stripped from dashboard `extra_form_data`.
`selectedDynamicGroupBy` is therefore a required addition to
`src/explore/components/ExploreViewContainer/ownState.ts` and its test.

## Dimension Resolution

Resolution starts from the persisted dimensions produced by
`crosstabFieldConfig`:

```text
persisted row dimensions
persisted column dimensions
```

Algorithm:

1. Parse and normalize `dynamicGroupBy`.
2. If disabled, return persisted dimensions unchanged.
3. Group slots by placement.
4. Validate slots against the original persisted placement dimensions.
5. Apply slots in descending `slotIndex` order for each placement, or by an
   equivalent offset-safe algorithm.
6. For each slot, resolve the selected option from
   `ownState.selectedDynamicGroupBy[slotId]` or `defaultOptionId`.
7. Splice the option columns into the target placement dimensions, treating
   each `slotIndex` as a position in the original persisted dimensions.
8. Validate the final dimensions.
9. Return final rows, columns, selected option map, and
   `effectiveGroupBySignature`.

The signature format should remain stable and explicit:

```text
rows=<row dimensions joined>|columns=<column dimensions joined>
```

## Validation And Errors

V3.1 should fail fast for:

- enabled config with no slots
- slot with missing `id`
- slot with missing or invalid `placement`
- slot with `slotIndex` outside the target placement dimensions. `slotIndex`
  equal to the dimension count is allowed as an append position.
- slot with `spliceCount < 1`
- slot ranges overlapping within the same placement
- option with missing `id`
- selected option not present in the slot whitelist
- option columns length mismatching `spliceCount`, except explicit empty option
- duplicate physical columns after all slots are applied
- total row plus column dimension count above `MAX_DIMENSIONS = 8`
- final row or column dimensions empty when the chart requires that axis

New error constants should be specific enough for tests and support:

```ts
ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP
ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT
ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN
ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION
ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS
```

Do not silently fall back to persisted dimensions when V3.1 config is invalid.

When `slotIndex` equals the placement dimension count, a non-empty option
appends its columns to the end and an empty option is a no-op.

## Query And Summary Contract

`buildQuery` already resolves dynamic group-by before constructing the query
plan. V3.1 keeps that ordering:

```text
crosstabFieldConfig -> persisted dimensions
dynamicGroupBy -> effective dimensions
effective dimensions -> query plan and summary plan
```

Every query role must use the same effective dimensions:

- server column domain
- server column count
- leaf
- row totals
- column totals
- row and column subtotals
- grand total

If a dynamic selection changes the effective dimensions, `transformProps` must
reset stale pagination and expansion state before rendering the new result.

## Server Column Pagination Boundary

Before V5, server-column pagination still has a hard shape limit. V3.1 should
not silently bypass it.

Allowed in V3.1:

- one row dimension
- one metric
- one or more physical column dimensions produced by dynamic group-by

Unsupported before V5:

- multiple row dimensions with server column pagination
- multiple metrics with server column pagination
- calculated dynamic columns

When a V3.1 configuration produces an unsupported server-pagination shape, the
chart should fail with the existing server-pagination shape error or an explicit
configuration error. It must not fall back to client-side full-column rendering
without the user choosing that behavior.

## Toolbar Behavior

The chart toolbar renders one selector per normalized slot:

```text
[CSV] [分组维度: 店铺] [三级维度: MSKU]
```

Selector rules:

- Render only when `dynamicGroupBy.enabled` is true and normalized slots exist.
- Sort selectors by placement and `slotIndex`.
- Use `data-test="crosstab-dynamic-groupby-control--<slotId>"`.
- A changed selector only updates its own slot.
- Other selected slot values are preserved.
- Pagination and expanded rows reset after a changed selector.

The first V3.1 pass keeps the Explore configuration as JSON. A visual
`CrosstabDynamicGroupByControl` is deferred to V3.1b because runtime schema and
compatibility are the higher-risk pieces.

## Production Slice 10 Examples

### Compatibility Example

Current production behavior remains valid:

```json
{
  "enabled": true,
  "placement": "columns",
  "slotIndex": 1,
  "defaultColumn": "shop_name",
  "options": [
    { "label": "店铺", "column": "shop_name" },
    { "label": "国家", "column": "country" },
    { "label": "MSKU", "column": "msku" },
    { "label": "父体", "column": "parent_asin" }
  ]
}
```

### Multi-Slot Example

```json
{
  "enabled": true,
  "slots": [
    {
      "id": "level2",
      "label": "二级维度",
      "placement": "columns",
      "slotIndex": 1,
      "spliceCount": 1,
      "defaultOptionId": "shop",
      "options": [
        { "id": "shop", "label": "店铺", "columns": ["shop_name"] },
        { "id": "country", "label": "国家", "columns": ["country"] }
      ]
    },
    {
      "id": "level3",
      "label": "三级维度",
      "placement": "columns",
      "slotIndex": 2,
      "spliceCount": 1,
      "defaultOptionId": "none",
      "options": [
        { "id": "none", "label": "(无)", "columns": [] },
        { "id": "msku", "label": "MSKU", "columns": ["msku"] },
        { "id": "parent_asin", "label": "父体", "columns": ["parent_asin"] }
      ]
    }
  ]
}
```

### Multi-Column Option Example

```json
{
  "enabled": true,
  "slots": [
    {
      "id": "level2_pair",
      "label": "二级组合",
      "placement": "columns",
      "slotIndex": 1,
      "spliceCount": 2,
      "defaultOptionId": "shop_country",
      "options": [
        {
          "id": "shop_country",
          "label": "店铺 + 国家",
          "columns": ["shop_name", "country"]
        },
        {
          "id": "msku_parent",
          "label": "MSKU + 父体",
          "columns": ["msku", "parent_asin"]
        }
      ]
    }
  ]
}
```

## Implementation Slices

### Slice 1: Schema And Normalization

- Update `types.ts` with the canonical slot-array model and legacy input type.
- Add `normalizeDynamicGroupByConfig`.
- Preserve current production shape through unit tests.
- Add fast-fail errors for malformed slots and options.

### Slice 2: Runtime Resolution

- Update `resolveDynamicGroupByDimensions` to apply multiple slots.
- Return selected option metadata and an explicit effective signature.
- Cover multi-slot, multi-column option, empty option, append-position slot,
  overlap, duplicate, and max-dimension cases.

### Slice 3: Query And Transform Integration

- Ensure `buildQuery` uses the effective dimensions for all planned query roles.
- Ensure `transformProps` resets stale pagination and expanded rows when the
  effective signature changes.
- Keep v2 metric semantic summary planning unchanged except for using the new
  effective dimensions.

### Slice 4: Toolbar Runtime UI

- Render multiple selectors from normalized slots.
- Write only `selectedDynamicGroupBy` on changes.
- Preserve other slot selections.
- Reset stale pagination and row expansion state.
- Add stable `data-test` selectors.

### Slice 5: Own-State Isolation And Acceptance

- Add `selectedDynamicGroupBy` to the Explore own-state strip list.
- Add repository tests for strip behavior.
- Run focused plugin tests, ESLint, TypeScript, build, and production health.
- Deploy production bundle only after repository validation passes.

## Repository Acceptance Criteria

Required tests:

- `dynamicGroupBy.test.ts`
  - legacy shape normalizes to one slot
  - disabled config returns persisted dimensions
  - multi-slot selection applies in stable order
  - `spliceCount > 1` replaces contiguous dimensions
  - empty option removes the configured slot segment
  - append-position slot appends non-empty options and treats empty option as
    no-op
  - overlap fails fast
  - duplicate output dimensions fail fast
  - invalid selected option fails fast
  - max dimension limit fails fast
- `buildQuery.test.ts`
  - leaf, domain, count, and summary queries share effective dimensions
- `transformProps.test.ts`
  - changed effective signature resets pagination and expanded rows
- `CrosstabTable.test.tsx`
  - multiple selectors render
  - selecting one slot preserves other slots
  - selector change writes the expected reset ownState
- `ownState.test.ts`
  - `selectedDynamicGroupBy` is stripped from `extra_form_data`

Required commands:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
cd superset-frontend && npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
cd superset-frontend && npm run type -- --pretty false
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

## Production Acceptance Criteria

Production target:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Required evidence:

- `curl -f http://111.230.91.24:8088/health` returns `OK`.
- Slice 10 still renders the current compatibility selector with four options:
  `店铺`, `国家`, `MSKU`, `父体`.
- Compatibility mode screenshot confirms no visual regression from v2.1.
- Multi-slot example renders at least three combinations:
  - `二级维度 = 店铺`, `三级维度 = (无)`
  - `二级维度 = 店铺`, `三级维度 = MSKU`
  - `二级维度 = 国家`, `三级维度 = 父体`
- Multi-column option example renders both:
  - `店铺 + 国家`
  - `MSKU + 父体`
- Browser request evidence shows `/api/v1/chart/data` groupby values change with
  the selected slot options.
- Baseline metric checks remain correct for representative combinations:
  - `销售额 = 567999.82`
  - `毛利率 = -9.5145`
  - `平均售价 = 98.6968`
- Server logs during browser validation do not show new crosstab errors or
  `HTTPException: 405`.

## Risks And Mitigations

Risk: slot indexes drift after earlier slots splice dimensions.
Mitigation: validate against persisted placement dimensions first, then apply
slots in descending index order, or an equivalent offset-safe algorithm, with
tests covering adjacent, non-adjacent, replacement, removal, and append slots.

Risk: server-column pagination receives dimensions it cannot support before V5.
Mitigation: fail fast with explicit errors rather than falling back to client
rendering.

Risk: selected runtime values leak into dashboard filters.
Mitigation: update own-state stripping before production deployment and require
test coverage.

Risk: old production saved charts still use the single-slot shape.
Mitigation: keep parser compatibility indefinitely for the legacy shape used by
slice 10.

Risk: JSON configuration is too hard for chart authors.
Mitigation: defer a visual control to V3.1b after the runtime contract is
stable; do not mix visual editor complexity into V3.1 runtime delivery.

## Open Follow-Up

V3.1b should introduce a visual `CrosstabDynamicGroupByControl` for adding,
removing, and editing slots/options in Explore. That work should reuse the same
canonical slot-array schema and should not change the runtime contract.
