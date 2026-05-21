# Crosstab V3.1.1 And V3.2 Dynamic Metric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship V3.1.1 graphical dynamic group-by configuration and V3.2 dynamic metric slot switching while preserving the existing crosstab query contract.

**Architecture:** Keep the work inside the existing Superset frontend crosstab plugin. Extract domain-neutral slot mechanics into `dynamicSlots.ts`, keep dimension-specific behavior in `dynamicGroupBy.ts`, add metric-specific behavior in `dynamicMetric.ts`, and resolve effective dimensions and metrics before query planning, summary planning, transform props, and toolbar rendering.

**Tech Stack:** Apache Superset frontend, React 17, TypeScript, Jest, React Testing Library patterns where available, `@superset-ui/core`, `@superset-ui/core/components`.

---

## Reference Documents

- Approved spec: `docs/superpowers/specs/2026-05-21-crosstab-v3-1-1-v3-2-dynamic-metric-design.md`
- Current implementation path report: `docs/superpowers/reports/2026-05-21-crosstab-implementation-path.md`
- Previous V3.1 plan: `docs/superpowers/plans/2026-05-21-crosstab-v3-1-dynamic-groupby.md`

## Scope Check

This plan covers one subsystem: `superset-frontend/plugins/plugin-chart-crosstab-table`, plus Explore own-state stripping in `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`.

It includes:

- V3.1.1 graphical Explore configuration for canonical `dynamicGroupBy.slots[]`.
- V3.2 dynamic metric form-data, resolver, query planning, transform props, toolbar selectors, and own-state isolation.
- Shared slot mechanics extraction with regression coverage for current V3.1 dynamic group-by behavior.
- Repository validation and production copied-chart acceptance planning for slice 10.

It does not include:

- Arbitrary SQL/Jinja/calculated expression parameters.
- Backend chart API changes.
- V5 server-column pagination expansion beyond the current `1 row dimension + 1 metric` runtime limit.
- Direct production slice 10 mutation before copied-chart acceptance passes.

## File Structure

- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicSlots.ts`
  - Domain-neutral slot validation, selected-option resolution, descending splice mechanics, and signature helpers.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts`
  - Unit coverage for slot normalization, overlap detection, splice validation, selection resolution, and splice order.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
  - Keep V3.1 legacy and canonical group-by contracts while delegating shared mechanics to `dynamicSlots.ts`.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`
  - Preserve existing V3.1 assertions and add extraction regression cases where the domain boundary matters.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Add dynamic metric types, own-state keys, chart props, and field-control value types.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicMetric.ts`
  - V3.2 metric config parsing, validation, selected-option resolution, effective metric config splicing, duplicate detection, and signature generation.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts`
  - Unit coverage for disabled config, defaults, runtime selection, invalid configs, duplicate metrics, and metric limit enforcement.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
  - Expose persisted metric configs separately from effective metric configs so selected dynamic metric options keep semantic metadata.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`
  - Confirm persisted metric config helper behavior remains stable.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Resolve effective metrics before query context, summary query planning, and server-column pagination shape checks.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - Prove effective metrics drive query metrics, summary semantics, and pagination fail-fast behavior.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Resolve effective metrics before renderer props, summary results, metric semantics, and stale cache checks.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - Prove selected dynamic metric props, effective semantics, and metric-signature cache resets.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx`
  - V3.1.1 graphical editor for canonical dynamic group-by slots.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicMetricControl.tsx`
  - V3.2 graphical editor for canonical dynamic metric slots.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
  - Replace `dynamicGroupBy` `TextAreaControl` and add `dynamicMetric`.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - Prove both custom controls are present and ordered.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Render dynamic metric selectors and update chart own-state without resetting row expansion.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - Prove selector rendering, per-slot state preservation, and reset boundaries.
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  - Strip `selectedDynamicMetric` and any effective metric cache key before Explore propagates own-state.
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`
  - Prove `selectedDynamicMetric` does not leak to dashboard filters or `extra_form_data`.
- Create: `docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md`
  - Repository and production copied-chart acceptance record.

## Task 1: Preflight And Baseline

**Files:**
- Read: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Read: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
- Read: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Read: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Read: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Read: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`

- [ ] **Step 1: Confirm the worktree and branch before editing**

Run:

```bash
git status --short --branch
```

Expected: current branch is `noway-release`. Untracked report or `.superpowers/` files may exist; do not stage them unless the current task explicitly creates the V3.2 acceptance report.

- [ ] **Step 2: Run the focused V3.1 baseline tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  src/explore/components/ExploreViewContainer/ownState.test.ts \
  --runInBand
```

Expected: PASS. If directory-level Jest picks ignored AppleDouble `._*` files, keep the explicit tracked test list and record the artifact in the acceptance report.

- [ ] **Step 3: Commit no changes**

Run:

```bash
git diff --stat
```

Expected: no implementation diff yet.

## Task 2: Shared Dynamic Slot Mechanics

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicSlots.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`

- [ ] **Step 1: Write the failing shared slot tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts` with ASF license header and these test cases:

```ts
import {
  applyDynamicSlotSplices,
  ERR_DYNAMIC_SLOT_DUPLICATE_OPTION,
  ERR_DYNAMIC_SLOT_DUPLICATE_SLOT,
  ERR_DYNAMIC_SLOT_OVERLAP,
  ERR_DYNAMIC_SLOT_SPLICE_COUNT,
  resolveDynamicSlotOptions,
  validateDynamicSlots,
} from '../../src/plugin/dynamicSlots';

describe('dynamic slot mechanics', () => {
  const slots = [
    {
      id: 'level2',
      label: 'Level 2',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop',
      options: [
        { id: 'shop', label: 'Shop', payload: ['shop_name'] },
        { id: 'country', label: 'Country', payload: ['country'] },
      ],
    },
  ];

  it('resolves selected options from own-state and defaults', () => {
    expect(resolveDynamicSlotOptions({ slots, selected: {} })).toEqual({
      selectedOptionIds: { level2: 'shop' },
      selectedOptions: [
        {
          slot: slots[0],
          option: slots[0].options[0],
        },
      ],
    });

    expect(
      resolveDynamicSlotOptions({
        slots,
        selected: { level2: 'country' },
      }).selectedOptionIds,
    ).toEqual({ level2: 'country' });
  });

  it('rejects duplicate slot ids and duplicate option ids', () => {
    expect(() =>
      validateDynamicSlots({
        slots: [slots[0], { ...slots[0] }],
        getPlacement: () => 'columns',
      }),
    ).toThrow(ERR_DYNAMIC_SLOT_DUPLICATE_SLOT);

    expect(() =>
      validateDynamicSlots({
        slots: [
          {
            ...slots[0],
            options: [slots[0].options[0], { ...slots[0].options[0] }],
          },
        ],
        getPlacement: () => 'columns',
      }),
    ).toThrow(ERR_DYNAMIC_SLOT_DUPLICATE_OPTION);
  });

  it('rejects overlapping slot ranges per placement', () => {
    expect(() =>
      validateDynamicSlots({
        slots: [
          { ...slots[0], id: 'a', slotIndex: 1, spliceCount: 2 },
          { ...slots[0], id: 'b', slotIndex: 2, spliceCount: 1 },
        ],
        getPlacement: () => 'columns',
      }),
    ).toThrow(ERR_DYNAMIC_SLOT_OVERLAP);
  });

  it('validates payload length against spliceCount and allows explicit empty options', () => {
    expect(() =>
      validateDynamicSlots({
        slots: [
          {
            ...slots[0],
            spliceCount: 2,
            options: [{ id: 'bad', label: 'Bad', payload: ['shop_name'] }],
          },
        ],
        getPlacement: () => 'columns',
      }),
    ).toThrow(ERR_DYNAMIC_SLOT_SPLICE_COUNT);

    expect(() =>
      validateDynamicSlots({
        slots: [
          {
            ...slots[0],
            spliceCount: 1,
            options: [{ id: 'none', label: 'None', payload: [] }],
          },
        ],
        getPlacement: () => 'columns',
        allowEmptyPayload: true,
      }),
    ).not.toThrow();
  });

  it('applies splices in descending slot order', () => {
    expect(
      applyDynamicSlotSplices({
        baseItems: ['date', 'category', 'shop'],
        selectedOptions: [
          {
            slot: { ...slots[0], id: 'first', slotIndex: 1, spliceCount: 1 },
            option: { id: 'country', label: 'Country', payload: ['country'] },
          },
          {
            slot: { ...slots[0], id: 'second', slotIndex: 2, spliceCount: 1 },
            option: { id: 'msku', label: 'MSKU', payload: ['msku'] },
          },
        ],
      }),
    ).toEqual(['date', 'country', 'msku']);
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts --runInBand
```

Expected: FAIL with module-not-found for `../../src/plugin/dynamicSlots`.

- [ ] **Step 3: Create the shared slot module**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicSlots.ts` with ASF license header and these exports:

```ts
export const ERR_DYNAMIC_SLOT_DUPLICATE_OPTION =
  'ERR_DYNAMIC_SLOT_DUPLICATE_OPTION';
export const ERR_DYNAMIC_SLOT_DUPLICATE_SLOT = 'ERR_DYNAMIC_SLOT_DUPLICATE_SLOT';
export const ERR_DYNAMIC_SLOT_INVALID_OPTION =
  'ERR_DYNAMIC_SLOT_INVALID_OPTION';
export const ERR_DYNAMIC_SLOT_OVERLAP = 'ERR_DYNAMIC_SLOT_OVERLAP';
export const ERR_DYNAMIC_SLOT_SPLICE_COUNT = 'ERR_DYNAMIC_SLOT_SPLICE_COUNT';

export type DynamicSlotOption<TPayload> = {
  id: string;
  label: string;
  payload: TPayload[];
};

export type DynamicSlot<TPayload> = {
  id: string;
  label?: string;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: DynamicSlotOption<TPayload>[];
};

export type SelectedDynamicSlotOption<TPayload> = {
  slot: DynamicSlot<TPayload>;
  option: DynamicSlotOption<TPayload>;
};

export function getDynamicSlotSpliceCount<TPayload>(
  slot: DynamicSlot<TPayload>,
): number {
  return slot.spliceCount ?? 1;
}

export function validateDynamicSlots<TPayload, TPlacement>({
  slots,
  getPlacement,
  allowEmptyPayload = false,
}: {
  slots: DynamicSlot<TPayload>[];
  getPlacement: (slot: DynamicSlot<TPayload>) => TPlacement;
  allowEmptyPayload?: boolean;
}) {
  const slotIds = new Set<string>();
  const occupied = new Set<string>();

  slots.forEach(slot => {
    if (slotIds.has(slot.id)) {
      throw new Error(ERR_DYNAMIC_SLOT_DUPLICATE_SLOT);
    }
    slotIds.add(slot.id);

    const spliceCount = getDynamicSlotSpliceCount(slot);
    const placement = String(getPlacement(slot));

    Array.from({ length: spliceCount }).forEach((_, offset) => {
      const key = `${placement}:${slot.slotIndex + offset}`;
      if (occupied.has(key)) {
        throw new Error(ERR_DYNAMIC_SLOT_OVERLAP);
      }
      occupied.add(key);
    });

    const optionIds = new Set<string>();
    slot.options.forEach(option => {
      if (optionIds.has(option.id)) {
        throw new Error(ERR_DYNAMIC_SLOT_DUPLICATE_OPTION);
      }
      optionIds.add(option.id);

      if (
        option.payload.length !== spliceCount &&
        !(allowEmptyPayload && option.payload.length === 0)
      ) {
        throw new Error(ERR_DYNAMIC_SLOT_SPLICE_COUNT);
      }
    });
  });
}

export function resolveDynamicSlotOptions<TPayload>({
  slots,
  selected,
}: {
  slots: DynamicSlot<TPayload>[];
  selected?: Record<string, string>;
}): {
  selectedOptionIds: Record<string, string>;
  selectedOptions: SelectedDynamicSlotOption<TPayload>[];
} {
  const selectedOptionIds: Record<string, string> = {};
  const selectedOptions = slots.map(slot => {
    const selectedOptionId = selected?.[slot.id] ?? slot.defaultOptionId;
    const option = slot.options.find(candidate => candidate.id === selectedOptionId);

    if (!option) {
      throw new Error(ERR_DYNAMIC_SLOT_INVALID_OPTION);
    }

    selectedOptionIds[slot.id] = option.id;

    return { slot, option };
  });

  return { selectedOptionIds, selectedOptions };
}

export function applyDynamicSlotSplices<TPayload>({
  baseItems,
  selectedOptions,
}: {
  baseItems: TPayload[];
  selectedOptions: SelectedDynamicSlotOption<TPayload>[];
}): TPayload[] {
  const result = [...baseItems];

  [...selectedOptions]
    .sort((left, right) => right.slot.slotIndex - left.slot.slotIndex)
    .forEach(({ slot, option }) => {
      result.splice(slot.slotIndex, getDynamicSlotSpliceCount(slot), ...option.payload);
    });

  return result;
}

export function getDynamicSlotSelectionSignature(selected: Record<string, string>) {
  return Object.entries(selected)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slotId, optionId]) => `${slotId}=${optionId}`)
    .join('\u001f');
}
```

- [ ] **Step 4: Refactor dynamic group-by to use the shared mechanics**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`, replace local duplicate-id, overlap, selected-option, and descending-splice loops with calls to:

```ts
import {
  applyDynamicSlotSplices,
  ERR_DYNAMIC_SLOT_DUPLICATE_OPTION,
  ERR_DYNAMIC_SLOT_DUPLICATE_SLOT,
  ERR_DYNAMIC_SLOT_INVALID_OPTION,
  ERR_DYNAMIC_SLOT_OVERLAP,
  ERR_DYNAMIC_SLOT_SPLICE_COUNT,
  resolveDynamicSlotOptions,
  validateDynamicSlots,
} from './dynamicSlots';
```

Map shared errors back to existing group-by errors so public failures remain stable:

```ts
function mapDynamicSlotError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  if (message === ERR_DYNAMIC_SLOT_DUPLICATE_SLOT) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  }
  if (message === ERR_DYNAMIC_SLOT_DUPLICATE_OPTION) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }
  if (message === ERR_DYNAMIC_SLOT_OVERLAP) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
  }
  if (message === ERR_DYNAMIC_SLOT_SPLICE_COUNT) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
  }
  if (message === ERR_DYNAMIC_SLOT_INVALID_OPTION) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  }

  throw error instanceof Error ? error : new Error(message);
}
```

Call `validateDynamicSlots` with `allowEmptyPayload: true` and `getPlacement: slot => slot.placement`. Call `applyDynamicSlotSplices` independently for rows and columns by filtering selected options by `slot.placement`.

- [ ] **Step 5: Run shared and group-by tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit the extraction**

Run:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicSlots.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts
git commit -m "refactor(crosstab): extract dynamic slot mechanics"
```

Expected: commit succeeds with only these files staged.

## Task 3: Dynamic Metric Types And Resolver

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicMetric.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts`

- [ ] **Step 1: Add failing resolver tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts` with ASF license header and tests covering:

```ts
import type { QueryFormMetric } from '@superset-ui/core';
import type {
  CrosstabDynamicMetricConfig,
  CrosstabFormData,
  MetricFieldConfig,
} from '../../src/types';
import {
  ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG,
  ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE,
  ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS,
  ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT,
  getDynamicMetricConfig,
  resolveDynamicMetricConfigs,
} from '../../src/plugin/dynamicMetric';

const salesMetric: QueryFormMetric = {
  label: '销售额',
  aggregate: 'SUM',
  column: { column_name: 'sales' },
};
const profitRateMetric: QueryFormMetric = {
  label: '毛利率',
  aggregate: 'AVG',
  column: { column_name: 'profit_rate' },
};
const avgPriceMetric: QueryFormMetric = {
  label: '平均售价',
  aggregate: 'AVG',
  column: { column_name: 'avg_price' },
};
const salesMetricConfig: MetricFieldConfig = {
  metric: salesMetric,
  label: '销售额',
  semantic: 'additive',
};
const profitRateMetricConfig: MetricFieldConfig = {
  metric: profitRateMetric,
  label: '毛利率',
  semantic: 'ratio',
};
const avgPriceMetricConfig: MetricFieldConfig = {
  metric: avgPriceMetric,
  label: '平均售价',
  semantic: 'average',
};

const dynamicMetric: CrosstabDynamicMetricConfig = {
  enabled: true,
  slots: [
    {
      id: 'primary_metric',
      label: '指标',
      slotIndex: 0,
      spliceCount: 1,
      defaultOptionId: 'sales',
      options: [
        { id: 'sales', label: '销售额', metrics: [salesMetricConfig] },
        { id: 'profit_rate', label: '毛利率', metrics: [profitRateMetricConfig] },
        { id: 'avg_price', label: '平均售价', metrics: [avgPriceMetricConfig] },
      ],
    },
  ],
};

function createFormData(config?: CrosstabFormData['dynamicMetric']): CrosstabFormData {
  return {
    datasource: '1__table',
    viz_type: 'crosstab_table',
    metrics: [salesMetric],
    dynamicMetric: config,
  };
}

describe('crosstab dynamic metric resolver', () => {
  it('returns persisted metrics and signature when disabled', () => {
    expect(
      resolveDynamicMetricConfigs({
        formData: createFormData({ ...dynamicMetric, enabled: false }),
        metricConfigs: [salesMetricConfig],
      }),
    ).toEqual({
      metricConfigs: [salesMetricConfig],
      config: undefined,
      selectedDynamicMetric: undefined,
      signature: '销售额',
    });
  });

  it('uses default metric option when ownState has no selection', () => {
    const result = resolveDynamicMetricConfigs({
      formData: createFormData(dynamicMetric),
      metricConfigs: [salesMetricConfig],
    });

    expect(result.metricConfigs).toEqual([salesMetricConfig]);
    expect(result.selectedDynamicMetric).toEqual({ primary_metric: 'sales' });
  });

  it('uses runtime selected metric option', () => {
    const result = resolveDynamicMetricConfigs({
      formData: createFormData(dynamicMetric),
      metricConfigs: [salesMetricConfig],
      ownState: { selectedDynamicMetric: { primary_metric: 'profit_rate' } },
    });

    expect(result.metricConfigs).toEqual([profitRateMetricConfig]);
    expect(result.selectedDynamicMetric).toEqual({ primary_metric: 'profit_rate' });
    expect(result.signature).toBe('毛利率');
  });

  it('rejects enabled config with no slots', () => {
    expect(() =>
      getDynamicMetricConfig(createFormData({ enabled: true, slots: [] })),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  });

  it('rejects metric count mismatch for the slot splice count', () => {
    expect(() =>
      getDynamicMetricConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'bad',
              slotIndex: 0,
              spliceCount: 2,
              defaultOptionId: 'sales',
              options: [{ id: 'sales', label: '销售额', metrics: [salesMetricConfig] }],
            },
          ],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT);
  });

  it('rejects duplicate effective metric labels', () => {
    expect(() =>
      resolveDynamicMetricConfigs({
        formData: createFormData(dynamicMetric),
        metricConfigs: [salesMetricConfig, salesMetricConfig],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE);
  });

  it('rejects effective metric lists above the runtime limit', () => {
    expect(() =>
      resolveDynamicMetricConfigs({
        formData: createFormData(undefined),
        metricConfigs: Array.from({ length: 9 }, (_, index) => ({
          metric: {
            label: `metric_${index}`,
            aggregate: 'SUM',
            column: { column_name: `metric_${index}` },
          },
          label: `metric_${index}`,
          semantic: 'additive',
        })),
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts --runInBand
```

Expected: FAIL with module-not-found for `../../src/plugin/dynamicMetric`.

- [ ] **Step 3: Add dynamic metric types**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`, add:

```ts
export type CrosstabDynamicMetricOption = {
  id: string;
  label: string;
  metrics: MetricFieldConfig[];
};

export type CrosstabDynamicMetricSlot = {
  id: string;
  label?: string;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: CrosstabDynamicMetricOption[];
};

export type CrosstabDynamicMetricConfig = {
  enabled: boolean;
  slots: CrosstabDynamicMetricSlot[];
};
```

Add `dynamicMetric?: CrosstabDynamicMetricConfig | string;` to `CrosstabFormData`.

Add these chart props:

```ts
    dynamicMetricConfig?: CrosstabDynamicMetricConfig;
    selectedDynamicMetric?: Record<string, string>;
    effectiveMetricSignature?: string;
```

Add these own-state keys:

```ts
  selectedDynamicMetric?: Record<string, string>;
  effectiveMetricSignature?: string;
```

- [ ] **Step 4: Implement `dynamicMetric.ts`**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicMetric.ts` with ASF license header. Export:

```ts
export const ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG =
  'ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG';
export const ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE =
  'ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE';
export const ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS =
  'ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS';
export const ERR_CROSSTAB_DYNAMIC_METRIC_OPTIONS =
  'ERR_CROSSTAB_DYNAMIC_METRIC_OPTIONS';
export const ERR_CROSSTAB_DYNAMIC_METRIC_SLOT =
  'ERR_CROSSTAB_DYNAMIC_METRIC_SLOT';
export const ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT =
  'ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT';
export const ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION =
  'ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION';
export const MAX_METRICS = 8;
```

Implement these functions with the same public signatures:

```ts
export function getDynamicMetricConfig(
  formData: CrosstabFormData,
): CrosstabDynamicMetricConfig | undefined;

export function getMetricConfigSignature(metricConfigs: MetricFieldConfig[]): string;

export function resolveDynamicMetricConfigs({
  formData,
  metricConfigs,
  ownState,
}: {
  formData: CrosstabFormData;
  metricConfigs: MetricFieldConfig[];
  ownState?: CrosstabOwnState;
}): {
  metricConfigs: MetricFieldConfig[];
  config?: CrosstabDynamicMetricConfig;
  selectedDynamicMetric?: Record<string, string>;
  signature: string;
};
```

Resolver behavior:

- Parse string input with `JSON.parse`.
- Return disabled configs as `config: undefined`.
- Reject enabled configs with zero slots.
- Validate slots with `validateDynamicSlots`, `allowEmptyPayload: true`, and `getPlacement: () => 'metrics'`.
- Convert each option from `{ metrics }` to shared `{ payload }` before calling slot helpers.
- Apply metric splices to persisted `metricConfigs`.
- Reject duplicate effective metrics using `getMetricLabel(metric)` as the identity.
- Reject effective metric count above `MAX_METRICS`.
- Return `signature` from effective metric labels, using `config.label ?? getMetricLabel(config.metric)`, joined with `\u001f`.

- [ ] **Step 5: Run dynamic metric tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit dynamic metric resolver**

Run:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicMetric.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts
git commit -m "feat(crosstab): add dynamic metric resolver"
```

Expected: commit succeeds with only these files staged.

## Task 4: Field Config And Query Planning Integration

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`

- [ ] **Step 1: Write failing field config and build query tests**

Add a field-config test proving persisted metric configs are available without dynamic metric mutation:

```ts
it('returns persisted metric configs for dynamic metric resolution', () => {
  expect(
    getPersistedCrosstabMetricConfigs({
      datasource: '1__table',
      viz_type: 'crosstab_table',
      crosstabFieldConfig: {
        rows: [],
        columns: [],
        metrics: [
          {
            metric: {
              label: '销售额',
              aggregate: 'SUM',
              column: { column_name: 'sales' },
            },
            label: '销售额',
            semantic: 'additive',
          },
        ],
      },
    } as CrosstabFormData),
  ).toEqual([
    {
      metric: {
        label: '销售额',
        aggregate: 'SUM',
        column: { column_name: 'sales' },
      },
      label: '销售额',
      semantic: 'additive',
    },
  ]);
});
```

Add build-query tests proving:

```ts
it('uses selected dynamic metric in the leaf query metrics', () => {
  const queryContext = buildQuery({
    ...baseFormData,
    dynamicMetric: dynamicMetricConfig,
  }, { ownState: { selectedDynamicMetric: { primary_metric: 'profit_rate' } } });

  expect(queryContext.queries[0].metrics).toEqual([profitRateMetric]);
});

it('builds summary query plan from selected metric semantics', () => {
  const queryContext = buildQuery({
    ...baseFormData,
    crosstabFieldConfig: {
      ...baseFormData.crosstabFieldConfig,
      metrics: [salesMetric],
    },
    metricSemanticOverrides: { 毛利率: { summarySemantic: 'ratio' } },
    dynamicMetric: dynamicMetricConfig,
    showRowTotals: true,
    showColumnTotals: true,
  }, { ownState: { selectedDynamicMetric: { primary_metric: 'profit_rate' } } });

  expect(queryContext.queries.map(query => query.extras?.crosstabQueryRole)).toContain(
    'summary',
  );
});

it('rejects server column pagination when selected dynamic metric expands to multiple metrics', () => {
  expect(() =>
    buildQuery({
      ...baseFormData,
      serverColumnPagination: true,
      dynamicMetric: multiMetricDynamicMetricConfig,
    }),
  ).toThrow(ERR_SERVER_COLUMN_PAGINATION_SHAPE);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  --runInBand
```

Expected: FAIL because `getPersistedCrosstabMetricConfigs` is not exported and `buildQuery` still uses persisted metrics.

- [ ] **Step 3: Add persisted metric config helper**

In `fieldConfig.ts`, add:

```ts
export function getPersistedCrosstabMetricConfigs(
  formData: CrosstabFormData,
): MetricFieldConfig[] {
  return formData.crosstabFieldConfig?.metrics ?? [];
}
```

Keep `getCrosstabMetricConfigs(formData)` as the persisted helper unless a later task passes effective configs directly into semantics. Avoid changing exported behavior that current tests already cover.

- [ ] **Step 4: Resolve effective metrics in `buildQuery.ts`**

In `buildQuery.ts`, after dynamic group-by resolution and before query objects are created:

```ts
const persistedMetricConfigs = getPersistedCrosstabMetricConfigs(formData);
const dynamicMetricResult = resolveDynamicMetricConfigs({
  formData,
  metricConfigs: persistedMetricConfigs.length
    ? persistedMetricConfigs
    : ensureIsArray<QueryFormMetric>(getCrosstabMetrics(formData)).map(metric => ({
        metric,
      })),
  ownState: options?.ownState as CrosstabOwnState | undefined,
});
const effectiveMetricConfigs = dynamicMetricResult.metricConfigs;
const metrics = effectiveMetricConfigs.map(config => config.metric);
```

Use `effectiveMetricConfigs` when calling semantic helpers. Use `metrics.length` in the existing `assertServerColumnPaginationShape(rowDimensions, columnDimensions, metrics.length)` call so multi-metric dynamic selections fail fast under current pagination limits.

- [ ] **Step 5: Run field config and build query tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit query integration**

Run:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
git commit -m "feat(crosstab): apply dynamic metrics in query planning"
```

Expected: commit succeeds with only these files staged.

## Task 5: Transform Props And Stale Cache Reset

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Write failing transform tests**

Add tests to `transformProps.test.ts` proving:

```ts
it('passes dynamic metric config and selected state to the renderer', () => {
  const props = transformProps(
    createChartProps({
      formData: {
        ...baseFormData,
        dynamicMetric: dynamicMetricConfig,
      },
      ownState: { selectedDynamicMetric: { primary_metric: 'profit_rate' } },
    }),
  );

  expect(props.dynamicMetricConfig).toEqual(dynamicMetricConfig);
  expect(props.selectedDynamicMetric).toEqual({
    primary_metric: 'profit_rate',
  });
});

it('clears stale server column page caches when effective metric signature changes', () => {
  const setDataMask = jest.fn();

  transformProps(
    createChartProps({
      formData: {
        ...baseFormData,
        serverColumnPagination: true,
        dynamicMetric: dynamicMetricConfig,
      },
      ownState: {
        selectedDynamicMetric: { primary_metric: 'profit_rate' },
        effectiveMetricSignature: '销售额',
        serverColumnPageTuples: [['US']],
        serverColumnTotalCount: 12,
        expandedRowPaths: ['["root"]'],
      },
      hooks: { setDataMask },
    }),
  );

  expect(setDataMask).toHaveBeenCalledWith({
    ownState: {
      selectedDynamicMetric: { primary_metric: 'profit_rate' },
      effectiveMetricSignature: '毛利率',
      expandedRowPaths: ['["root"]'],
    },
  });
});
```

- [ ] **Step 2: Run transform tests and verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: FAIL because `dynamicMetricConfig`, `selectedDynamicMetric`, and `effectiveMetricSignature` are not passed yet.

- [ ] **Step 3: Integrate dynamic metric resolution in `transformProps.ts`**

Resolve dynamic metrics before `metricFields`, `metricConfigs`, summary results, and `resolveMetricSemantic` calls:

```ts
const dynamicMetricResult = resolveDynamicMetricConfigs({
  formData: crosstabFormData,
  metricConfigs: getPersistedCrosstabMetricConfigs(crosstabFormData),
  ownState: crosstabOwnState,
});
const effectiveMetricConfigs = dynamicMetricResult.metricConfigs;
const metricFields = effectiveMetricConfigs.map(config =>
  normalizeMetric(config.metric),
);
const metricConfigs = effectiveMetricConfigs;
```

When passing form-data props to `CrosstabTable`, include:

```ts
dynamicMetricConfig: dynamicMetricResult.config,
selectedDynamicMetric: dynamicMetricResult.selectedDynamicMetric,
effectiveMetricSignature: dynamicMetricResult.signature,
```

- [ ] **Step 4: Clear stale metric cache without collapsing rows**

Add a branch parallel to the existing group-by signature reset. When `ownState.effectiveMetricSignature` exists and differs from `dynamicMetricResult.signature`, call `setDataMask({ ownState: nextOwnState })` where `nextOwnState` preserves `expandedRowPaths`, `selectedDynamicGroupBy`, `selectedDynamicMetric`, and current signatures, but removes:

```ts
currentColumnPage
serverColumnPageColumnSignature
serverColumnPageTuples
serverColumnPageTuplesPage
serverColumnPageTuplesPageSize
serverColumnTotalCount
```

Expected reset boundary: metric changes clear server-column pagination caches, but do not clear `expandedRowPaths`.

- [ ] **Step 5: Run transform tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit transform integration**

Run:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "feat(crosstab): pass dynamic metrics through transform props"
```

Expected: commit succeeds with only these files staged.

## Task 6: Renderer Toolbar Dynamic Metric Selectors

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`

- [ ] **Step 1: Write failing toolbar tests**

Add tests to `CrosstabTable.test.tsx`:

```tsx
function getDynamicMetricSelect(slotId: string) {
  const select = container.querySelector(
    `[data-test="crosstab-dynamic-metric-control--${slotId}"] select`,
  );
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`Unable to find dynamic metric select: ${slotId}`);
  }
  return select;
}

it('renders one dynamic metric selector per configured slot', () => {
  renderChart({
    height: 400,
    width: 800,
    formData: {
      datasource: '1__table',
      viz_type: 'crosstab_table',
    },
    rowData: [],
    columns: [],
    columnTree: [],
    generatedColumnIds: [],
    dynamicMetricConfig,
    selectedDynamicMetric: { primary_metric: 'sales' },
  } as unknown as CrosstabChartProps);

  expect(
    container.querySelector('[data-test="crosstab-dynamic-metric-control--primary_metric"]'),
  ).toBeInTheDocument();
});

it('updates one dynamic metric slot while preserving existing slot selections and row expansion', () => {
  const setDataMask = jest.fn();

  renderChart({
    height: 400,
    width: 800,
    formData: {
      datasource: '1__table',
      viz_type: 'crosstab_table',
      generatedColumnWidth: 120,
    },
    hooks: { setDataMask },
    ownState: {
      expandedRowPaths: ['["渠道"]'],
      unrelatedOwnStateField: 'preserved',
      selectedDynamicMetric: { primary_metric: 'sales', secondary_metric: 'avg_price' },
      serverColumnPageTuples: [['US']],
    },
    rowData: [],
    columns: [],
    columnTree: [],
    generatedColumnIds: [],
    dynamicMetricConfig,
    selectedDynamicMetric: { primary_metric: 'sales', secondary_metric: 'avg_price' },
  } as unknown as CrosstabChartProps);

  act(() => {
    const select = getDynamicMetricSelect('primary_metric');
    select.value = 'profit_rate';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  expect(setDataMask).toHaveBeenCalledWith({
    ownState: {
      unrelatedOwnStateField: 'preserved',
      selectedDynamicMetric: {
        primary_metric: 'profit_rate',
        secondary_metric: 'avg_price',
      },
      expandedRowPaths: ['["渠道"]'],
    },
  });
});
```

- [ ] **Step 2: Run renderer tests and verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: FAIL because no dynamic metric selector is rendered.

- [ ] **Step 3: Add selector rendering**

In `CrosstabTable.tsx`, derive selectors from top-level `dynamicMetricConfig?.slots`:

```tsx
const dynamicMetricSelectors = dynamicMetricConfig?.slots.map(slot => ({
  slot,
  options: slot.options.map(option => ({
    label: option.label,
    value: option.id,
  })),
  value:
    selectedDynamicMetric?.[slot.id] ?? slot.defaultOptionId,
}));
```

Render each selector in the existing toolbar:

```tsx
{dynamicMetricSelectors?.map(selector => (
  <div
    key={selector.slot.id}
    data-test={`crosstab-dynamic-metric-control--${selector.slot.id}`}
  >
    <Select
      ariaLabel={selector.slot.label ?? t('Dynamic metric')}
      allowSelectAll={false}
      options={selector.options}
      value={selector.value}
      onChange={value => updateDynamicMetricOption(selector.slot.id, value)}
    />
  </div>
))}
```

- [ ] **Step 4: Add metric own-state update helper**

Add `updateDynamicMetricOption(slotId: string, optionId: string)` next to the group-by helper. It must:

- Ignore values not present in the slot option list.
- Preserve other `selectedDynamicMetric` entries.
- Preserve `expandedRowPaths`.
- Remove stale server-column pagination cache keys.
- Reset `currentColumnPage` to zero by omission.

The resulting own-state must keep this shape:

```ts
{
  selectedDynamicMetric: {
    ...selectedDynamicMetric,
    [slotId]: optionId,
  },
  expandedRowPaths: ownState?.expandedRowPaths,
}
```

- [ ] **Step 5: Run renderer tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit renderer integration**

Run:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
git commit -m "feat(crosstab): add dynamic metric toolbar selectors"
```

Expected: commit succeeds with only these files staged.

## Task 7: V3.1.1 And V3.2 Explore Configuration Controls

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicMetricControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Write failing control panel tests**

In `controlPanel.test.ts`, replace the current `dynamicGroupBy` `TextAreaControl` assertion with:

```ts
expect(getControl('dynamicGroupBy')?.config.type).toBe(
  'CrosstabDynamicGroupByControl',
);
expect(getControl('dynamicMetric')?.config.type).toBe(
  'CrosstabDynamicMetricControl',
);
```

Add a control-order assertion:

```ts
expect(getControlNames()).toEqual(
  expect.arrayContaining([
    'crosstabFieldConfig',
    'dynamicGroupBy',
    'dynamicMetric',
    'serverColumnPagination',
  ]),
);
```

- [ ] **Step 2: Run control panel tests and verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: FAIL because `dynamicGroupBy` still uses `TextAreaControl` and `dynamicMetric` does not exist.

- [ ] **Step 3: Create `CrosstabDynamicGroupByControl.tsx`**

Create a functional component using `DndColumnSelect`, `ControlHeader`, `Button`, `Input`, `Select`, and `Checkbox` from `@superset-ui/core/components`.

Required emitted value:

```ts
{
  enabled: boolean;
  slots: CrosstabDynamicGroupBySlot[];
}
```

Required controls:

- Enable checkbox.
- Add slot button.
- Per-slot id input.
- Per-slot label input.
- Per-slot placement select with `rows` and `columns`.
- Per-slot slot index numeric input.
- Per-slot splice count numeric input.
- Per-slot default option select.
- Per-option id input.
- Per-option label input.
- Per-option `DndColumnSelect` for `columns`.
- Delete option and delete slot buttons.

Required validation before `onChange`:

```ts
validateDynamicGroupByConfig(nextValue);
```

Implement `validateDynamicGroupByConfig` as an exported helper in the same file so tests can exercise it without rendering.

- [ ] **Step 4: Create `CrosstabDynamicMetricControl.tsx`**

Create a functional component with the same slot editor pattern, using `DndMetricSelect` for option metrics.

Required emitted value:

```ts
{
  enabled: boolean;
  slots: CrosstabDynamicMetricSlot[];
}
```

Required validation before `onChange`:

```ts
validateDynamicMetricControlConfig(nextValue);
```

Implementation detail: reuse `validateDynamicSlots` by mapping metric options to shared slot payloads and then enforcing `MAX_METRICS` from `dynamicMetric.ts`.

- [ ] **Step 5: Register controls in `controlPanel.tsx`**

Import both controls:

```ts
import CrosstabDynamicGroupByControl from './CrosstabDynamicGroupByControl';
import CrosstabDynamicMetricControl from './CrosstabDynamicMetricControl';
```

Register them in the control overrides map used by the plugin:

```ts
CrosstabDynamicGroupByControl,
CrosstabDynamicMetricControl,
```

Replace `dynamicGroupBy` config:

```ts
{
  name: 'dynamicGroupBy',
  config: {
    type: 'CrosstabDynamicGroupByControl',
    label: t('Dynamic group by'),
    default: { enabled: false, slots: [] },
    renderTrigger: true,
    description: t('Configure chart-local dynamic group-by slots.'),
  },
}
```

Add `dynamicMetric` next to it:

```ts
{
  name: 'dynamicMetric',
  config: {
    type: 'CrosstabDynamicMetricControl',
    label: t('Dynamic metric'),
    default: { enabled: false, slots: [] },
    renderTrigger: true,
    description: t('Configure chart-local dynamic metric slots.'),
  },
}
```

- [ ] **Step 6: Run control panel tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit controls**

Run:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicMetricControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "feat(crosstab): add dynamic slot configuration controls"
```

Expected: commit succeeds with only these files staged.

## Task 8: Explore Own-State Isolation

**Files:**
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- [ ] **Step 1: Write failing own-state test**

Add or extend the existing own-state stripping test with:

```ts
const ownState = {
  selectedDynamicGroupBy: { level2: 'shop' },
  selectedDynamicMetric: { primary_metric: 'profit_rate' },
  effectiveGroupBySignature: 'rows=metric|columns=date\u001fshop',
  effectiveMetricSignature: '毛利率',
  selectedDynamicGroupByColumn: 'shop_name',
  expandedRowPaths: [['渠道']],
};

expect(stripCrosstabOwnState(ownState)).toEqual({});
```

- [ ] **Step 2: Run own-state tests and verify they fail**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: FAIL because `selectedDynamicMetric` and `effectiveMetricSignature` are still retained.

- [ ] **Step 3: Strip dynamic metric state**

In `ownState.ts`, add these keys to the crosstab own-state removal list:

```ts
selectedDynamicMetric
effectiveMetricSignature
```

Keep existing removals for:

```ts
selectedDynamicGroupBy
selectedDynamicGroupByColumn
effectiveGroupBySignature
expandedRowPaths
serverColumnPageTuples
```

- [ ] **Step 4: Run own-state tests**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit own-state isolation**

Run:

```bash
git add \
  superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts \
  superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
git commit -m "fix(crosstab): isolate dynamic metric own state"
```

Expected: commit succeeds with only these files staged.

## Task 9: Full Repository Validation

**Files:**
- Read: `superset-frontend/package.json`
- Read: changed files from Tasks 2-8

- [ ] **Step 1: Run focused Jest suite**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  src/explore/components/ExploreViewContainer/ownState.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the required directory-level Jest command**

Run:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS. If AppleDouble artifacts cause Jest to treat ignored `._*` files as suites, rerun the explicit tracked list from Step 1 and write the artifact note in `docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md`.

- [ ] **Step 3: Run ESLint**

Run:

```bash
cd superset-frontend
npx eslint \
  plugins/plugin-chart-crosstab-table/src \
  plugins/plugin-chart-crosstab-table/test \
  src/explore/components/ExploreViewContainer/ownState.ts \
  src/explore/components/ExploreViewContainer/ownState.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript validation**

Run:

```bash
cd superset-frontend
npm run type -- --pretty false
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
cd superset-frontend
BABEL_ENV=testableProduction npm run build
```

Expected: PASS. Existing asset-size warnings are acceptable if they match the current baseline and no crosstab compile errors appear.

- [ ] **Step 6: Commit validation report**

Create `docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md` with:

```md
# Crosstab V3.1.1 And V3.2 Repository Acceptance

Date: 2026-05-21

## Repository Validation

- Focused Jest: PASS
- Directory Jest: PASS or blocked by AppleDouble artifact with explicit tracked-list PASS
- ESLint: PASS
- TypeScript: PASS
- Production build: PASS

## Notes

- V3.1.1 dynamic group-by control writes canonical `dynamicGroupBy.slots[]`.
- V3.2 dynamic metric uses selected metric definitions for summary semantics.
- Server-column pagination still fails fast outside the current `1 row dimension + 1 metric` shape.
```

Run:

```bash
git add docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md
git commit -m "docs(crosstab): record v3.2 repository acceptance"
```

Expected: commit succeeds with only the acceptance report staged.

## Task 10: Production Copied-Chart Acceptance

**Files:**
- Modify: `docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md`

- [ ] **Step 1: Confirm production health before chart changes**

Run:

```bash
curl -f http://111.230.91.24:8088/health
```

Expected: `OK` or equivalent healthy response.

- [ ] **Step 2: Validate on copied chart or temporary Explore params first**

Use production slice 10 as the source:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Create a copied chart or temporary Explore URL that includes:

- Canonical `dynamicGroupBy.slots[]` with at least two slots.
- `dynamicMetric.slots[]` with options for `销售额`, `毛利率`, and `平均售价`.
- Server-column pagination enabled only when the selected dynamic metric resolves to exactly one metric.

Expected: copied chart renders without crosstab traceback.

- [ ] **Step 3: Browser-check V3.1.1 configuration UI**

Open the copied chart in Explore and verify:

- `dynamicGroupBy` is no longer a raw JSON text area.
- The control can enable dynamic group-by.
- The control can add a slot.
- The control can save canonical `dynamicGroupBy.slots[]`.
- Saved chart params do not write legacy single-slot dynamic group-by shape.

Expected: UI saves and reloads the canonical slot-array value.

- [ ] **Step 4: Browser-check V3.2 metric switching**

On the copied chart, switch dynamic metric options:

- `销售额`
- `毛利率`
- `平均售价`

Expected baselines:

```text
销售额 = 567999.82
毛利率 = -9.5145
平均售价 = 98.6968
```

Expected state behavior:

- Metric switching clears column page caches.
- Metric switching does not collapse expanded row paths.
- `data-test="crosstab-dynamic-metric-control--<slotId>"` is present for each slot.

- [ ] **Step 5: Confirm state isolation**

Inspect chart request payloads and dashboard filter payloads.

Expected:

- `selectedDynamicGroupBy` is absent from `extra_form_data`.
- `selectedDynamicMetric` is absent from `extra_form_data`.
- No dashboard-native filter receives either selected map.

- [ ] **Step 6: Check production logs**

Inspect server logs after the copied-chart run.

Expected:

- No new crosstab traceback.
- No new `HTTPException: 405` from the crosstab acceptance flow.
- No silent pagination shape downgrade; unsupported metric counts produce the expected fail-fast error.

- [ ] **Step 7: Update acceptance report**

Append to `docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md`:

```md
## Production Copied-Chart Acceptance

- Production health: PASS
- Copied chart URL: record the exact copied Explore URL used during Step 2
- V3.1.1 dynamic group-by UI: PASS
- V3.2 dynamic metric switching: PASS
- Semantic baselines:
  - 销售额 = 567999.82
  - 毛利率 = -9.5145
  - 平均售价 = 98.6968
- Own-state isolation: PASS
- Logs: PASS

## Formal Slice 10 Update

Formal slice 10 metadata update is allowed only after all copied-chart checks above pass.
```

Replace the copied chart URL line with the actual copied Explore URL before committing the report.

- [ ] **Step 8: Commit production acceptance evidence**

Run:

```bash
git add docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md
git commit -m "docs(crosstab): record v3.2 production copied-chart acceptance"
```

Expected: commit succeeds with only the acceptance report staged.

## Task 11: Formal Slice 10 Update Gate

**Files:**
- Modify: production chart metadata only after Task 10 passes
- Modify: `docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md`

- [ ] **Step 1: Confirm copied-chart acceptance is complete**

Run:

```bash
rg -n "Production Copied-Chart Acceptance|Formal Slice 10 Update|PASS|Copied chart URL: http" docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md
```

Expected: the copied chart URL line starts with `Copied chart URL: http`, copied-chart checks are recorded as PASS, and formal update is explicitly gated.

- [ ] **Step 2: Update formal slice 10 metadata**

Apply the accepted copied-chart params to production slice 10 only after Step 1 passes.

Expected:

- `dynamicGroupBy` is canonical slot-array shape.
- `dynamicMetric` is canonical slot-array shape.
- No chart metadata stores `selectedDynamicGroupBy`.
- No chart metadata stores `selectedDynamicMetric`.

- [ ] **Step 3: Re-run the same browser acceptance on slice 10**

Open:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Expected:

- Existing single-slot dynamic group-by compatibility remains.
- Multi-slot group-by and dynamic metric can run together.
- Metric baselines match the copied-chart acceptance.
- Logs remain clean.

- [ ] **Step 4: Append formal update evidence**

Append:

```md
## Formal Slice 10 Update

- Slice 10 URL: http://111.230.91.24:8088/explore/?slice_id=10
- Metadata update: PASS
- Post-update browser acceptance: PASS
- Post-update logs: PASS
```

- [ ] **Step 5: Commit formal update evidence**

Run:

```bash
git add docs/superpowers/reports/2026-05-21-crosstab-v3-2-acceptance.md
git commit -m "docs(crosstab): record v3.2 slice 10 acceptance"
```

Expected: commit succeeds with the final acceptance evidence.
