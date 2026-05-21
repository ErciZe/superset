# Crosstab V3.1.1 Configuration UI And V3.2 Dynamic Metric Design

Date: 2026-05-21

## Current State

Crosstab V3.1 is complete on the repository side. The plugin now supports
canonical multi-slot dynamic group-by runtime behavior, including slot-array
normalization, effective dimension resolution, query planning, transform props,
toolbar selectors, and crosstab own-state isolation.

The verified repository gates for V3.1 were:

- Focused Jest: `5 suites / 85 tests` passed.
- `npm run type -- --pretty false` passed.
- `BABEL_ENV=testableProduction npm run build` passed with only existing asset
  size warnings.

The remaining gap before V3.2 is product-facing configuration. The runtime
accepts canonical `dynamicGroupBy.slots[]`, but Explore still exposes
`dynamicGroupBy` as a JSON `TextAreaControl`. V3.1.1 closes that UI gap without
changing V3.1 runtime semantics.

V3.2 then adds dynamic metric slot switching. It mirrors the V3.1 slot model for
metrics and keeps metric semantics tied to the selected metric definitions.

## Goals

- Add a graphically editable Explore control for V3.1 dynamic group-by slots.
- Preserve the V3.1 canonical `dynamicGroupBy.slots[]` storage and runtime
  contract.
- Add V3.2 dynamic metric runtime support with slot-array configuration,
  own-state selection, query planning, toolbar selectors, and own-state
  isolation.
- Reuse slot validation and splice mechanics between dynamic group-by and
  dynamic metric instead of duplicating logic.
- Validate the combined feature set against production slice 10 after repository
  validation passes.

## Non-Goals

- No arbitrary SQL, Jinja, or calculated expression parameters. Those belong to
  a later V4 parameterized calculation phase.
- No backend Crosstab API.
- No silent fallback when a dynamic configuration violates current runtime
  limits.
- No direct production slice mutation before validating on a copied or temporary
  chart configuration.
- No redesign of the crosstab renderer layout beyond adding the required
  selectors.

## V3.1.1 Dynamic Group-By Configuration UI

V3.1.1 replaces the raw JSON editing experience for `dynamicGroupBy` with a
dedicated `CrosstabDynamicGroupByControl`. The control is only an editor for the
already-supported canonical model. It must not introduce another interpretation
path.

The stored value remains:

```ts
export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  slots: CrosstabDynamicGroupBySlot[];
};
```

The control supports:

- Enabling or disabling dynamic group-by.
- Adding, deleting, and reordering slot definitions.
- Editing slot id, label, placement, slot index, splice count, and default
  option.
- Adding and deleting options.
- Selecting option columns from the dataset-backed column whitelist.
- Saving valid canonical `slots[]` data back to `dynamicGroupBy`.

The control must reuse the V3.1 validation rules:

- Slot ids are unique.
- Option ids are unique within a slot.
- Slot ranges do not overlap within the same placement.
- Option `columns.length` matches `spliceCount`, except the explicit empty
  option for removing a slot segment.
- The applied dimensions do not produce duplicate physical columns.
- Total effective dimensions stay within the existing runtime limit.

Invalid configuration should fail fast in the control with a clear validation
message and should also remain rejected by `dynamicGroupBy.ts`.

## Shared Slot Mechanics

V3.2 should extract the common slot behavior into a small
`plugin/dynamicSlots.ts` module. This module should be domain-neutral and only
handle mechanics:

- Normalize enabled slot-array input.
- Validate slot ids and option ids.
- Validate slot overlap.
- Validate option length against splice count, with explicit support for empty
  options when the domain allows removal.
- Resolve selected option ids from own-state.
- Apply descending-index splices so earlier changes do not shift later slot
  positions.

Domain modules keep domain-specific rules:

- `dynamicGroupBy.ts` owns row/column placement, dimension identity, duplicate
  dimension detection, and `ERR_CROSSTAB_DYNAMIC_GROUP_BY_*` errors.
- `dynamicMetric.ts` owns metric identity, metric count limits, metric
  semantics preservation, and `ERR_CROSSTAB_DYNAMIC_METRIC_*` errors.

This split keeps the V3.1 runtime stable while avoiding a second copy of the
same slot algorithm for metrics.

## V3.2 Dynamic Metric Runtime

V3.2 introduces a new `dynamicMetric` form-data field:

```ts
export type CrosstabDynamicMetricSlot = {
  id: string;
  label?: string;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: {
    id: string;
    label: string;
    metrics: CrosstabMetricConfig[];
  }[];
};

export type CrosstabDynamicMetricConfig = {
  enabled: boolean;
  slots: CrosstabDynamicMetricSlot[];
};
```

The selected metric state is chart-local own-state:

```ts
selectedDynamicMetric?: Record<string, string>;
```

Metric resolution runs after dynamic group-by resolution and before query
planning. The order is:

1. Resolve persisted row and column dimensions.
2. Apply `dynamicGroupBy`.
3. Resolve persisted metric configs.
4. Apply `dynamicMetric`.
5. Build the leaf query, server-column pagination queries, and metric summary
   query plan from the final effective dimensions and metrics.

Metric option semantics stay on the selected metric definitions. A metric option
for `毛利率` still carries its non-additive semantic; a metric option for `销售额`
still carries additive semantics. V3.2 does not add a separate semantic override
layer.

Validation rules:

- Option `metrics.length` matches `spliceCount`, except explicit empty options
  where supported by the slot mechanics.
- Metric ids or labels are unique within a selected effective metric list.
- Effective metrics do not exceed `MAX_METRICS = 8`.
- Before the broader V5 server-column pagination expansion, configurations that
  combine server-column pagination with unsupported metric counts must fail
  fast rather than silently changing behavior.

## Toolbar And Own-State Behavior

Group-by and metric selectors share the crosstab toolbar.

Dynamic group-by controls keep:

```text
data-test="crosstab-dynamic-groupby-control--<slotId>"
```

Dynamic metric controls add:

```text
data-test="crosstab-dynamic-metric-control--<slotId>"
```

Changing a group-by selector resets:

- `currentColumnPage`
- `serverColumnPageTuples`
- `serverColumnPageTuplesPage`
- `serverColumnTotalCount`
- `expandedRowPaths`
- `effectiveGroupBySignature`

Changing a metric selector resets:

- `currentColumnPage`
- `serverColumnPageTuples`
- `serverColumnPageTuplesPage`
- `serverColumnTotalCount`

Metric switching does not reset `expandedRowPaths`, because row hierarchy did
not change.

`ExploreViewContainer/ownState.ts` must strip both dynamic own-state maps:

- `selectedDynamicGroupBy`
- `selectedDynamicMetric`

Legacy `selectedDynamicGroupByColumn` remains stripped as today.

## Query And Transform Behavior

`buildQuery.ts` should consume effective dimensions and effective metrics before
any query objects are produced. This preserves the existing query-context shape:
the chart data endpoint still receives standard Superset chart queries.

The summary query plan must be generated from effective metrics. This is the
main V3.2 integration point with V2 metric semantics. The selected metric
definitions decide whether row totals, column totals, subtotals, and grand
totals use additive aggregation or SQL summary lookups.

`transformProps.ts` should pass renderer props for both dynamic systems:

- `dynamicGroupByConfig`
- `selectedDynamicGroupBy`
- `dynamicMetricConfig`
- `selectedDynamicMetric`
- an effective metric signature for stale cache detection when needed

If metric selection changes, stale server-column pagination caches must be
cleared before rendering results from an old metric set.

## Control Panel

V3.1.1 changes the `dynamicGroupBy` control from `TextAreaControl` to
`CrosstabDynamicGroupByControl`.

V3.2 adds `dynamicMetric`. The first implementation may expose it as a JSON
control if that keeps the runtime work isolated, but the preferred outcome is a
matching `CrosstabDynamicMetricControl` that reuses the group-by control's slot
editor primitives where practical.

The controls should keep emitted values canonical and should not write legacy
single-slot shapes.

## Production Acceptance

Production acceptance is part of this scope but runs after repository validation
passes.

The acceptance target is production slice 10:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Acceptance must use a copied chart or temporary chart params first. The formal
slice 10 metadata should only be updated after the copied configuration proves
the behavior.

Acceptance checks:

- Existing production single-slot dynamic group-by behavior remains compatible.
- V3.1.1 UI can create and save canonical `dynamicGroupBy.slots[]`.
- V3.2 can switch among `销售额`, `毛利率`, and `平均售价`.
- Dynamic metric semantics match the existing SQL baselines:
  - `销售额 = 567999.82`
  - `毛利率 = -9.5145`
  - `平均售价 = 98.6968`
- Multi-slot group-by and dynamic metric can run together without corrupting the
  query plan, summary plan, or server-column pagination state.
- `selectedDynamicGroupBy` and `selectedDynamicMetric` do not appear in
  dashboard filter or `extra_form_data`.
- Browser acceptance produces no crosstab traceback and no new
  `HTTPException: 405` in server logs.

## Repository Acceptance

Required tests:

- `dynamicSlots.test.ts`
  - slot normalization
  - overlap detection
  - splice count validation
  - selected option resolution
  - descending splice behavior
- `dynamicGroupBy.test.ts`
  - still covers V3.1 legacy and canonical behavior after extraction
- `dynamicMetric.test.ts`
  - disabled behavior
  - default option selection
  - runtime selected option
  - invalid slot
  - invalid option
  - splice count mismatch
  - duplicate metric detection
  - effective metric count limit
- `buildQuery.test.ts`
  - query planning uses effective metrics
  - summary plan uses selected metric semantics
  - server-column pagination rejects unsupported effective metric counts
- `transformProps.test.ts`
  - selected dynamic metric props are passed to the renderer
  - stale metric selection resets server-column caches
- `CrosstabTable.test.tsx`
  - dynamic metric selectors render per slot
  - switching one metric slot preserves other selected slots
  - metric switching does not reset row expansion
- `ownState.test.ts`
  - strips `selectedDynamicMetric`
- `controlPanel.test.ts`
  - `dynamicGroupBy` uses the new group-by control
  - dynamic metric control is present in the expected control section

Required commands:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.ts src/explore/components/ExploreViewContainer/ownState.test.ts
npm run type -- --pretty false
BABEL_ENV=testableProduction npm run build
```

If local ignored AppleDouble files are present and directory-level Jest picks
them up, use explicit tracked test files for the verification run and report the
environment artifact clearly.

## Implementation Order

1. V3.1.1 group-by configuration UI.
2. Shared slot mechanics extraction.
3. V3.2 dynamic metric resolver and tests.
4. Query planning integration.
5. Transform props and renderer toolbar integration.
6. Own-state isolation.
7. Repository validation.
8. Production copied-chart acceptance.
9. Formal slice 10 metadata update only after copied-chart acceptance passes.

## Risks

- Extracting shared slot logic can regress V3.1 if the domain-specific
  validation boundaries are blurred. Keep the extraction mechanical and covered
  by existing V3.1 tests.
- Dynamic metric switching touches V2 metric semantics. Effective metrics must
  be resolved before summary plans are built.
- Server-column pagination has narrower runtime assumptions than the general
  crosstab renderer. Unsupported effective metric counts must fail fast.
- Production slice mutation before copied-chart validation can make rollback
  harder. Acceptance must validate a copied or temporary configuration first.

## Open Decisions Closed By This Spec

- V3.1.1 is included in the next phase and is limited to configuration UI.
- V3.2 is dynamic metric runtime, not arbitrary calculation parameters.
- Production acceptance is included but runs after repository validation.
- The implementation plan should be staged rather than one large mixed change.
