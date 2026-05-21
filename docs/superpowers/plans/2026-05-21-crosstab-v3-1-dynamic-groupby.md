# Crosstab V3.1 Dynamic Group By Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement V3.1 dynamic group-by as multi-slot, whitelist-driven runtime crosstab dimensions while preserving the production single-slot chart shape.

**Architecture:** Keep the implementation inside the existing frontend crosstab plugin. Normalize both legacy single-slot input and canonical slot-array input in `dynamicGroupBy.ts`, resolve effective row/column dimensions before query planning and rendering, and expose one toolbar selector per normalized slot. Runtime selections stay in chart `ownState` and are stripped before dashboard filter propagation.

**Tech Stack:** Apache Superset frontend, React 17, TypeScript, Jest, React DOM test utilities, `@superset-ui/core`, `@superset-ui/core/components`.

---

## Reference Documents

- Spec: `docs/superpowers/specs/2026-05-21-crosstab-v3-1-dynamic-groupby-design.md`
- Original path report: `docs/superpowers/reports/2026-05-21-crosstab-implementation-path.md`

## Scope Check

This plan covers one subsystem: `superset-frontend/plugins/plugin-chart-crosstab-table`. It includes schema normalization, runtime dimension resolution, query/summary integration, renderer toolbar controls, Explore own-state isolation, and repository validation. It does not implement V3.1b visual Explore configuration controls, dynamic metrics, numeric parameters, calculated fields, or V5 server-pagination shape expansion.

## File Structure

- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Owns canonical and legacy dynamic group-by TypeScript contracts.
  - Adds `selectedDynamicGroupBy` own-state and chart prop shape.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
  - Owns JSON parsing, legacy-to-canonical normalization, validation, option selection, dimension splicing, duplicate checks, and effective signature creation.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`
  - Owns resolver contract tests and fail-fast validation tests.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Should keep its existing call into `resolveDynamicGroupByDimensions`; implementation changes should be minimal if resolver return shape stays compatible.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - Proves all query roles use effective dimensions for canonical multi-slot input.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Uses the resolver's canonical selected option map, resets stale column pagination and expanded rows, and passes normalized slots to the renderer.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - Proves renderer props and stale-state reset behavior for canonical multi-slot input.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Renders one `Select` per normalized slot and writes only `selectedDynamicGroupBy`.
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - Proves multiple selectors render, one selector change preserves other selected slots, invalid values are ignored, and reset state excludes stale caches.
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  - Strips `selectedDynamicGroupBy` from dashboard extra form data.
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`
  - Proves chart-local selected slot map does not leak.

## Task 1: Types And Normalization Contract

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`

- [ ] **Step 1: Write failing normalization tests**

Append these tests inside `describe('crosstab dynamic group by resolver', () => { ... })` in `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`.

```ts
  it('normalizes the legacy single-slot shape to one canonical slot', () => {
    expect(getDynamicGroupByConfig(createFormData(baseConfig))).toEqual({
      enabled: true,
      slots: [
        {
          id: '__legacy__',
          label: '分组维度',
          placement: 'columns',
          slotIndex: 1,
          spliceCount: 1,
          defaultOptionId: 'shop_name',
          options: [
            { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
            { id: 'country', label: '国家', columns: ['country'] },
          ],
        },
      ],
    });
  });

  it('accepts the canonical slot-array shape without rewriting stable ids', () => {
    expect(
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level2',
              label: '二级维度',
              placement: 'columns',
              slotIndex: 1,
              spliceCount: 1,
              defaultOptionId: 'shop',
              options: [
                { id: 'shop', label: '店铺', columns: ['shop_name'] },
                { id: 'country', label: '国家', columns: ['country'] },
              ],
            },
          ],
        }),
      ),
    ).toEqual({
      enabled: true,
      slots: [
        {
          id: 'level2',
          label: '二级维度',
          placement: 'columns',
          slotIndex: 1,
          spliceCount: 1,
          defaultOptionId: 'shop',
          options: [
            { id: 'shop', label: '店铺', columns: ['shop_name'] },
            { id: 'country', label: '国家', columns: ['country'] },
          ],
        },
      ],
    });
  });

  it('rejects enabled canonical config with no slots', () => {
    expect(() =>
      getDynamicGroupByConfig(createFormData({ enabled: true, slots: [] })),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  });

  it('rejects option columns that do not match spliceCount', () => {
    expect(() =>
      getDynamicGroupByConfig(
        createFormData({
          enabled: true,
          slots: [
            {
              id: 'level2_pair',
              placement: 'columns',
              slotIndex: 1,
              spliceCount: 2,
              defaultOptionId: 'bad',
              options: [{ id: 'bad', label: 'Bad', columns: ['shop_name'] }],
            },
          ],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
  });
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand
```

Expected: FAIL. The first failure should show that `getDynamicGroupByConfig(createFormData(baseConfig))` still returns the legacy `{ placement, slotIndex, defaultColumn, options }` shape, and `ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT` is not exported yet.

- [ ] **Step 3: Update TypeScript types**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`, replace the current `CrosstabDynamicGroupByOption` and `CrosstabDynamicGroupByConfig` block with this block.

```ts
export type DynamicGroupByPlacement = 'rows' | 'columns';

export type LegacyCrosstabDynamicGroupByOption = {
  label: string;
  column: QueryFormColumn;
};

export type LegacyCrosstabDynamicGroupByConfig = {
  enabled: boolean;
  placement: DynamicGroupByPlacement;
  slotIndex: number;
  defaultColumn: QueryFormColumn;
  options: LegacyCrosstabDynamicGroupByOption[];
};

export type CrosstabDynamicGroupByOption = {
  id: string;
  label: string;
  columns: QueryFormColumn[];
};

export type CrosstabDynamicGroupBySlot = {
  id: string;
  label?: string;
  placement: DynamicGroupByPlacement;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: CrosstabDynamicGroupByOption[];
};

export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  slots: CrosstabDynamicGroupBySlot[];
};

export type CrosstabDynamicGroupByInput =
  | CrosstabDynamicGroupByConfig
  | LegacyCrosstabDynamicGroupByConfig;
```

In the same file, change `CrosstabFormData.dynamicGroupBy` to:

```ts
  dynamicGroupBy?: CrosstabDynamicGroupByInput | string;
```

In `CrosstabChartProps`, keep legacy prop compatibility and add the canonical map:

```ts
    dynamicGroupByConfig?: CrosstabDynamicGroupByConfig;
    selectedDynamicGroupBy?: Record<string, string>;
    selectedDynamicGroupByColumn?: QueryFormColumn;
    effectiveGroupBySignature?: string;
```

In `CrosstabOwnState`, add the canonical own-state key before the legacy key:

```ts
  selectedDynamicGroupBy?: Record<string, string>;
  selectedDynamicGroupByColumn?: QueryFormColumn;
```

- [ ] **Step 4: Implement normalization helpers**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`, update the imports and error constants to include the new types and constants.

```ts
import { getColumnLabel, type QueryFormColumn } from '@superset-ui/core';
import type {
  CrosstabDynamicGroupByConfig,
  CrosstabDynamicGroupByInput,
  CrosstabDynamicGroupByOption,
  CrosstabDynamicGroupBySlot,
  CrosstabFormData,
  CrosstabOwnState,
  DynamicGroupByPlacement,
  LegacyCrosstabDynamicGroupByConfig,
} from '../types';

export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS =
  'ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS';
```

Replace the old `validateDynamicGroupByConfig` with these helpers.

```ts
const LEGACY_SLOT_ID = '__legacy__';
const LEGACY_SLOT_LABEL = '分组维度';
const MAX_DIMENSIONS = 8;

function assertSlotId(value: unknown): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }
}

function assertColumnArray(value: unknown): asserts value is QueryFormColumn[] {
  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  value.forEach(assertColumn);
}

function normalizeLegacyConfig(
  value: Record<string, unknown>,
): CrosstabDynamicGroupByConfig {
  const { defaultColumn, enabled, options, placement, slotIndex } = value;
  const parsedSlotIndex =
    typeof slotIndex === 'number' && Number.isInteger(slotIndex)
      ? slotIndex
      : undefined;

  if (
    typeof enabled !== 'boolean' ||
    !isPlacement(placement) ||
    parsedSlotIndex === undefined ||
    parsedSlotIndex < 0 ||
    !Array.isArray(options)
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  assertColumn(defaultColumn);

  const normalizedOptions = options.map(option => {
    if (!isObject(option) || typeof option.label !== 'string') {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
    }

    assertColumn(option.column);

    return {
      id: getColumnLabel(option.column),
      label: option.label,
      columns: [option.column],
    };
  });

  return {
    enabled,
    slots: [
      {
        id: LEGACY_SLOT_ID,
        label: LEGACY_SLOT_LABEL,
        placement,
        slotIndex: parsedSlotIndex,
        spliceCount: 1,
        defaultOptionId: getColumnLabel(defaultColumn),
        options: normalizedOptions,
      },
    ],
  };
}

function validateOption(
  value: unknown,
  spliceCount: number,
): CrosstabDynamicGroupByOption {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const { columns, id, label } = value;
  assertSlotId(id);

  if (typeof label !== 'string') {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  assertColumnArray(columns);

  if (columns.length !== 0 && columns.length !== spliceCount) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT);
  }

  return { id, label, columns };
}

function validateSlot(value: unknown): CrosstabDynamicGroupBySlot {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const {
    defaultOptionId,
    id,
    label,
    options,
    placement,
    slotIndex,
    spliceCount,
  } = value;
  const parsedSpliceCount = spliceCount === undefined ? 1 : spliceCount;

  assertSlotId(id);

  if (
    !isPlacement(placement) ||
    typeof slotIndex !== 'number' ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    typeof parsedSpliceCount !== 'number' ||
    !Number.isInteger(parsedSpliceCount) ||
    parsedSpliceCount < 1 ||
    !isNonEmptyString(defaultOptionId) ||
    !Array.isArray(options)
  ) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (label !== undefined && typeof label !== 'string') {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const normalizedOptions = options.map(option =>
    validateOption(option, parsedSpliceCount),
  );
  const optionIds = new Set(normalizedOptions.map(option => option.id));

  if (!optionIds.has(defaultOptionId)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  }

  return {
    id,
    label,
    placement,
    slotIndex,
    spliceCount: parsedSpliceCount,
    defaultOptionId,
    options: normalizedOptions,
  };
}

export function normalizeDynamicGroupByConfig(
  value: CrosstabDynamicGroupByInput,
): CrosstabDynamicGroupByConfig {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (!('slots' in value)) {
    return normalizeLegacyConfig(value);
  }

  if (typeof value.enabled !== 'boolean' || !Array.isArray(value.slots)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (value.enabled && value.slots.length === 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  return {
    enabled: value.enabled,
    slots: value.slots.map(validateSlot),
  };
}
```

Update `getDynamicGroupByConfig` to call the new normalizer.

```ts
export function getDynamicGroupByConfig(
  formData: CrosstabFormData,
): CrosstabDynamicGroupByConfig | undefined {
  const rawConfig = formData.dynamicGroupBy;

  if (rawConfig === undefined) {
    return undefined;
  }

  if (typeof rawConfig === 'string') {
    if (rawConfig.trim().length === 0) {
      return undefined;
    }

    try {
      return normalizeDynamicGroupByConfig(JSON.parse(rawConfig));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid crosstab dynamic group by JSON config.');
      }

      throw error;
    }
  }

  return normalizeDynamicGroupByConfig(rawConfig);
}
```

- [ ] **Step 5: Run normalization tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand
```

Expected: Some normalization tests now PASS. Existing resolver tests may still FAIL because `resolveDynamicGroupByDimensions` still expects legacy `config.options`, `config.defaultColumn`, and `config.placement`.

- [ ] **Step 6: Commit Task 1**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts
git commit -m "feat(crosstab): normalize dynamic group by slots"
```

## Task 2: Multi-Slot Dimension Resolver

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`

- [ ] **Step 1: Replace resolver tests with canonical coverage**

Keep existing legacy tests that prove backward compatibility, then add this canonical test block in `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`.

```ts
const multiSlotConfig: CrosstabFormData['dynamicGroupBy'] = {
  enabled: true,
  slots: [
    {
      id: 'level2',
      label: '二级维度',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop',
      options: [
        { id: 'shop', label: '店铺', columns: ['shop_name'] },
        { id: 'country', label: '国家', columns: ['country'] },
      ],
    },
    {
      id: 'level3',
      label: '三级维度',
      placement: 'columns',
      slotIndex: 2,
      spliceCount: 1,
      defaultOptionId: 'none',
      options: [
        { id: 'none', label: '(无)', columns: [] },
        { id: 'msku', label: 'MSKU', columns: ['msku'] },
        { id: 'parent_asin', label: '父体', columns: ['parent_asin'] },
      ],
    },
  ],
};

const multiColumnOptionConfig: CrosstabFormData['dynamicGroupBy'] = {
  enabled: true,
  slots: [
    {
      id: 'level2_pair',
      label: '二级组合',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 2,
      defaultOptionId: 'shop_country',
      options: [
        {
          id: 'shop_country',
          label: '店铺 + 国家',
          columns: ['shop_name', 'country'],
        },
        {
          id: 'msku_parent',
          label: 'MSKU + 父体',
          columns: ['msku', 'parent_asin'],
        },
      ],
    },
  ],
};

  it('applies multiple selected slots against original persisted positions', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(multiSlotConfig),
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'country', 'msku']);
    expect(result.selectedDynamicGroupBy).toEqual({
      level2: 'country',
      level3: 'msku',
    });
    expect(result.selectedColumn).toBe('country');
    expect(result.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
    );
  });

  it('treats append-position empty option as no-op', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(multiSlotConfig),
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'shop',
          level3: 'none',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'shop_name']);
    expect(result.selectedDynamicGroupBy).toEqual({
      level2: 'shop',
      level3: 'none',
    });
  });

  it('replaces multiple contiguous dimensions for a multi-column option', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(multiColumnOptionConfig),
      ownState: {
        selectedDynamicGroupBy: {
          level2_pair: 'msku_parent',
        },
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name', 'country'],
    });

    expect(result.columnDimensions).toEqual([
      'biz_date',
      'msku',
      'parent_asin',
    ]);
    expect(result.selectedDynamicGroupBy).toEqual({
      level2_pair: 'msku_parent',
    });
  });

  it('maps legacy selectedDynamicGroupByColumn to the legacy slot option', () => {
    const result = resolveDynamicGroupByDimensions({
      formData: createFormData(baseConfig),
      ownState: { selectedDynamicGroupByColumn: 'country' },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(result.columnDimensions).toEqual(['biz_date', 'country']);
    expect(result.selectedDynamicGroupBy).toEqual({ __legacy__: 'country' });
    expect(result.selectedColumn).toBe('country');
  });

  it('throws when selected option id is outside the slot whitelist', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData(multiSlotConfig),
        ownState: {
          selectedDynamicGroupBy: {
            level2: 'bad-option',
          },
        },
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
  });

  it('throws when slot ranges overlap within one placement', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'first',
              placement: 'columns',
              slotIndex: 1,
              spliceCount: 2,
              defaultOptionId: 'shop_country',
              options: [
                {
                  id: 'shop_country',
                  label: '店铺 + 国家',
                  columns: ['shop_name', 'country'],
                },
              ],
            },
            {
              id: 'second',
              placement: 'columns',
              slotIndex: 2,
              spliceCount: 1,
              defaultOptionId: 'msku',
              options: [{ id: 'msku', label: 'MSKU', columns: ['msku'] }],
            },
          ],
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name', 'country'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
  });

  it('throws when effective dimensions contain duplicate physical columns', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'level3',
              placement: 'columns',
              slotIndex: 2,
              spliceCount: 1,
              defaultOptionId: 'shop',
              options: [{ id: 'shop', label: '店铺', columns: ['shop_name'] }],
            },
          ],
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN);
  });

  it('throws when total effective dimensions exceed MAX_DIMENSIONS', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: createFormData({
          enabled: true,
          slots: [
            {
              id: 'append',
              placement: 'columns',
              slotIndex: 4,
              spliceCount: 1,
              defaultOptionId: 'extra',
              options: [{ id: 'extra', label: 'Extra', columns: ['extra'] }],
            },
          ],
        }),
        rowDimensions: ['row1', 'row2', 'row3', 'row4'],
        columnDimensions: ['col1', 'col2', 'col3', 'col4'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  });
```

- [ ] **Step 2: Run resolver tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand
```

Expected: FAIL with errors around `selectedDynamicGroupBy` being absent from the resolver result and multi-slot dimensions not being applied.

- [ ] **Step 3: Implement resolver result shape and helpers**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`, update the result type.

```ts
type ResolveDynamicGroupByDimensionsResult = {
  rowDimensions: QueryFormColumn[];
  columnDimensions: QueryFormColumn[];
  config?: CrosstabDynamicGroupByConfig;
  selectedColumn?: QueryFormColumn;
  selectedDynamicGroupBy?: Record<string, string>;
  signature: string;
};
```

Replace `replaceDimension` with these helpers.

```ts
function getDimensionsForPlacement(
  placement: DynamicGroupByPlacement,
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
) {
  return placement === 'rows' ? rowDimensions : columnDimensions;
}

function getSlotSpliceCount(slot: CrosstabDynamicGroupBySlot): number {
  return slot.spliceCount === undefined ? 1 : slot.spliceCount;
}

function resolveSelectedOptionId(
  slot: CrosstabDynamicGroupBySlot,
  ownState?: CrosstabOwnState,
): string {
  const selectedOptionId = ownState?.selectedDynamicGroupBy?.[slot.id];

  if (selectedOptionId) {
    return selectedOptionId;
  }

  if (slot.id === LEGACY_SLOT_ID && ownState?.selectedDynamicGroupByColumn) {
    const selectedColumnLabel = getColumnLabel(
      ownState.selectedDynamicGroupByColumn,
    );
    const legacyOption = slot.options.find(
      option =>
        option.columns.length === 1 &&
        getColumnLabel(option.columns[0]) === selectedColumnLabel,
    );

    if (legacyOption) {
      return legacyOption.id;
    }
  }

  return slot.defaultOptionId;
}

function validateSlotRanges(
  slots: CrosstabDynamicGroupBySlot[],
  persistedDimensions: QueryFormColumn[],
) {
  const occupiedIndexes = new Set<number>();
  const appendIndexes = new Set<number>();

  slots.forEach(slot => {
    const spliceCount = getSlotSpliceCount(slot);

    if (slot.slotIndex > persistedDimensions.length) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
    }

    if (slot.slotIndex === persistedDimensions.length) {
      if (appendIndexes.has(slot.slotIndex)) {
        throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
      }
      appendIndexes.add(slot.slotIndex);
      return;
    }

    if (slot.slotIndex + spliceCount > persistedDimensions.length) {
      throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
    }

    Array.from({ length: spliceCount }, (_, offset) => slot.slotIndex + offset)
      .forEach(index => {
        if (occupiedIndexes.has(index)) {
          throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP);
        }
        occupiedIndexes.add(index);
      });
  });
}

function assertNoDuplicateColumns(
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
) {
  const columnLabels = [...rowDimensions, ...columnDimensions].map(getColumnLabel);
  const uniqueColumnLabels = new Set(columnLabels);

  if (uniqueColumnLabels.size !== columnLabels.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN);
  }
}

function assertMaxDimensions(
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
) {
  if (rowDimensions.length + columnDimensions.length > MAX_DIMENSIONS) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_MAX_DIMENSIONS);
  }
}

function applySlotsToDimensions({
  dimensions,
  ownState,
  slots,
}: {
  dimensions: QueryFormColumn[];
  ownState?: CrosstabOwnState;
  slots: CrosstabDynamicGroupBySlot[];
}) {
  validateSlotRanges(slots, dimensions);

  const selectedDynamicGroupBy: Record<string, string> = {};
  const selectedColumnsBySlot = new Map<string, QueryFormColumn | undefined>();
  const nextDimensions = [...dimensions];

  [...slots]
    .sort((left, right) => right.slotIndex - left.slotIndex)
    .forEach(slot => {
      const selectedOptionId = resolveSelectedOptionId(slot, ownState);
      const selectedOption = slot.options.find(
        option => option.id === selectedOptionId,
      );

      if (!selectedOption) {
        throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_UNKNOWN_OPTION);
      }

      selectedDynamicGroupBy[slot.id] = selectedOption.id;
      selectedColumnsBySlot.set(slot.id, selectedOption.columns[0]);

      const deleteCount =
        slot.slotIndex === dimensions.length ? 0 : getSlotSpliceCount(slot);
      nextDimensions.splice(
        slot.slotIndex,
        deleteCount,
        ...selectedOption.columns,
      );
    });

  return {
    dimensions: nextDimensions,
    selectedDynamicGroupBy,
    selectedColumnsBySlot,
  };
}
```

- [ ] **Step 4: Update `resolveDynamicGroupByDimensions`**

Replace the enabled-config body in `resolveDynamicGroupByDimensions` with this implementation.

```ts
  if (!config.slots.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }

  const rowSlots = config.slots.filter(slot => slot.placement === 'rows');
  const columnSlots = config.slots.filter(slot => slot.placement === 'columns');
  const resolvedRows = applySlotsToDimensions({
    dimensions: getDimensionsForPlacement('rows', rowDimensions, columnDimensions),
    ownState,
    slots: rowSlots,
  });
  const resolvedColumns = applySlotsToDimensions({
    dimensions: getDimensionsForPlacement(
      'columns',
      rowDimensions,
      columnDimensions,
    ),
    ownState,
    slots: columnSlots,
  });
  const selectedDynamicGroupBy = {
    ...resolvedRows.selectedDynamicGroupBy,
    ...resolvedColumns.selectedDynamicGroupBy,
  };
  const effectiveRowDimensions = resolvedRows.dimensions;
  const effectiveColumnDimensions = resolvedColumns.dimensions;

  assertNoDuplicateColumns(effectiveRowDimensions, effectiveColumnDimensions);
  assertMaxDimensions(effectiveRowDimensions, effectiveColumnDimensions);

  return {
    rowDimensions: effectiveRowDimensions,
    columnDimensions: effectiveColumnDimensions,
    config,
    selectedColumn:
      resolvedRows.selectedColumnsBySlot.get(LEGACY_SLOT_ID) === undefined
        ? resolvedColumns.selectedColumnsBySlot.get(LEGACY_SLOT_ID)
        : resolvedRows.selectedColumnsBySlot.get(LEGACY_SLOT_ID),
    selectedDynamicGroupBy,
    signature: createGroupBySignature(
      effectiveRowDimensions,
      effectiveColumnDimensions,
    ),
  };
```

Keep the disabled branch returning `selectedDynamicGroupBy: undefined`.

- [ ] **Step 5: Run resolver tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand
```

Expected: PASS for `dynamicGroupBy.test.ts`.

- [ ] **Step 6: Commit Task 2**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts
git commit -m "feat(crosstab): resolve dynamic group by slots"
```

## Task 3: Query Planning With Effective Dimensions

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`

- [ ] **Step 1: Add canonical query tests**

Append these tests to `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`.

```ts
const canonicalMultiSlotGroupBy = {
  enabled: true,
  slots: [
    {
      id: 'level2',
      label: '二级维度',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop',
      options: [
        { id: 'shop', label: '店铺', columns: ['shop_name'] },
        { id: 'country', label: '国家', columns: ['country'] },
      ],
    },
    {
      id: 'level3',
      label: '三级维度',
      placement: 'columns',
      slotIndex: 2,
      spliceCount: 1,
      defaultOptionId: 'none',
      options: [
        { id: 'none', label: '(无)', columns: [] },
        { id: 'msku', label: 'MSKU', columns: ['msku'] },
      ],
    },
  ],
} as const;

  it('uses canonical multi-slot dimensions in non-server query dimensions', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['amount'],
        dynamicGroupBy: canonicalMultiSlotGroupBy,
      } as never,
      {
        ownState: {
          selectedDynamicGroupBy: {
            level2: 'country',
            level3: 'msku',
          },
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'country',
      'msku',
    ]);
  });

  it('uses canonical multi-slot dimensions for server domain, count, leaf, and summary queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值', semantic: 'ratio' }],
        },
        dynamicGroupBy: canonicalMultiSlotGroupBy,
        serverColumnPagination: true,
        showRowTotals: true,
        showRowSubtotals: true,
        showColumnTotals: true,
        showColumnSubtotals: true,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          selectedDynamicGroupBy: {
            level2: 'country',
            level3: 'msku',
          },
        },
      } as never,
    );

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['biz_date', 'country', 'msku'],
      ['biz_date', 'country', 'msku'],
    ]);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        metrics: [],
        row_limit: 5,
        row_offset: 0,
      }),
    );
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        is_rowcount: true,
        row_limit: 0,
        row_offset: 0,
      }),
    );
  });
```

- [ ] **Step 2: Run query tests and verify behavior**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: If Task 2 resolver is complete, these tests should PASS without changing `buildQuery.ts`. If they fail, the failure should point to `resolveDynamicGroupByDimensions` return values, not to a new query-planning branch.

- [ ] **Step 3: Keep `buildQuery.ts` minimal**

If a type error appears because `options?.ownState` is not inferred as the expanded `CrosstabOwnState`, update the existing resolver call only.

```ts
  const { rowDimensions, columnDimensions } = resolveDynamicGroupByDimensions({
    formData,
    ownState: options?.ownState as CrosstabOwnState | undefined,
    rowDimensions: persistedRowDimensions,
    columnDimensions: persistedColumnDimensions,
  });
```

Do not add a second dynamic group-by parsing path in `buildQuery.ts`; all parsing stays in `dynamicGroupBy.ts`.

- [ ] **Step 4: Run resolver and query tests together**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
git commit -m "test(crosstab): cover dynamic group by query planning"
```

## Task 4: Transform Props And Stale Own-State Reset

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Add canonical transform tests**

Append these tests to `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`.

```ts
const canonicalMultiSlotGroupBy: CrosstabFormData['dynamicGroupBy'] = {
  enabled: true,
  slots: [
    {
      id: 'level2',
      label: '二级维度',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop',
      options: [
        { id: 'shop', label: '店铺', columns: ['shop_name'] },
        { id: 'country', label: '国家', columns: ['country'] },
      ],
    },
    {
      id: 'level3',
      label: '三级维度',
      placement: 'columns',
      slotIndex: 2,
      spliceCount: 1,
      defaultOptionId: 'none',
      options: [
        { id: 'none', label: '(无)', columns: [] },
        { id: 'msku', label: 'MSKU', columns: ['msku'] },
      ],
    },
  ],
};

  it('passes canonical selected slot map and generated headers to the renderer', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        dynamicGroupBy: canonicalMultiSlotGroupBy,
      },
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              country: 'US',
              msku: 'A-001',
              指标值: 10,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          country: '国家',
          msku: 'MSKU',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.selectedDynamicGroupBy).toEqual({
      level2: 'country',
      level3: 'msku',
    });
    expect(props.dynamicGroupByConfig).toEqual(canonicalMultiSlotGroupBy);
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        children: [
          expect.objectContaining({
            label: 'US',
            children: [
              expect.objectContaining({
                label: 'A-001',
                field:
                  '__crosstab_col__string:10:2026-05-01|string:2:US|string:5:A-001__metric__指标值',
              }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('resets stale caches when canonical selected slot map changes the effective signature', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        dynamicGroupBy: canonicalMultiSlotGroupBy,
      },
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        currentColumnPage: 3,
        currentColumnPageSize: 5,
        expandedRowPaths: ['stale-row'],
        unrelatedOwnStateField: 'preserved',
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name',
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 5,
        serverColumnTotalCount: 999,
      },
      hooks: { setDataMask },
      queriesData: [{ data: [] }, { data: [{ rowcount: 1 }] }],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    expect(props.rowData).toEqual([]);
    expect(props.isServerColumnLoading).toBe(true);
  });
```

- [ ] **Step 2: Run transform tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: FAIL because transform props do not yet pass `selectedDynamicGroupBy`, and stale reset still writes the legacy `selectedDynamicGroupByColumn`.

- [ ] **Step 3: Preserve canonical own-state and pass renderer props**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`, update `getPreservedDynamicGroupByOwnState` to delete both runtime dynamic keys before reset.

```ts
  delete preservedOwnState.selectedDynamicGroupByColumn;
```

Then update the stale reset branch to write canonical selected state.

```ts
        selectedDynamicGroupBy: dynamicGroupBy.selectedDynamicGroupBy,
        effectiveGroupBySignature: dynamicGroupBy.signature,
```

Remove this write from the reset branch:

```ts
        selectedDynamicGroupByColumn: dynamicGroupBy.selectedColumn,
```

In the returned props, pass both canonical and legacy-compatible selected values.

```ts
          dynamicGroupByConfig: dynamicGroupBy.config,
          selectedDynamicGroupBy: dynamicGroupBy.selectedDynamicGroupBy,
          selectedDynamicGroupByColumn: dynamicGroupBy.selectedColumn,
          effectiveGroupBySignature: dynamicGroupBy.signature,
```

- [ ] **Step 4: Run transform tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: PASS. If existing legacy tests fail because they expect `selectedDynamicGroupByColumn` inside reset ownState, update those expectations to `selectedDynamicGroupBy: { __legacy__: 'country' }` while keeping `props.selectedDynamicGroupByColumn` assertions.

- [ ] **Step 5: Commit Task 4**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "feat(crosstab): pass dynamic group by slot state"
```

## Task 5: Toolbar Multiple Selectors

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`

- [ ] **Step 1: Update test helpers for multiple selectors**

In `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`, replace `getDynamicGroupBySelect` with:

```ts
  function getDynamicGroupBySelect(slotId: string) {
    const select = container.querySelector(
      `[data-test="crosstab-dynamic-groupby-control--${slotId}"] select`,
    );
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error(`Unable to find dynamic group-by select: ${slotId}`);
    }
    return select;
  }
```

Replace direct calls to `getDynamicGroupBySelect()` in existing tests with `getDynamicGroupBySelect('__legacy__')`.

- [ ] **Step 2: Add multiple selector tests**

Append this test block to `CrosstabTable.test.tsx`.

```tsx
  it('renders one dynamic group-by selector per normalized slot', () => {
    const props = {
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
      selectedDynamicGroupBy: {
        level2: 'country',
        level3: 'msku',
      },
      dynamicGroupByConfig: {
        enabled: true,
        slots: [
          {
            id: 'level2',
            label: '二级维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options: [
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
          {
            id: 'level3',
            label: '三级维度',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'none',
            options: [
              { id: 'none', label: '(无)', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('二级维度')).toBeInTheDocument();
    expect(getByText('三级维度')).toBeInTheDocument();
    expect(getDynamicGroupBySelect('level2')).toHaveValue('country');
    expect(getDynamicGroupBySelect('level3')).toHaveValue('msku');
  });

  it('updates one slot while preserving other selected slots', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        generatedColumnWidth: 120,
      },
      hooks: { setDataMask },
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'shop',
          level3: 'none',
        },
        currentColumnPage: 3,
        currentColumnPageSize: 3,
        effectiveGroupBySignature: 'rows=metric_name|columns=shop_name',
        expandedRowPaths: ['["A"]'],
        unrelatedOwnStateField: 'preserved',
        serverColumnPageColumnSignature: 'shop_name',
        serverColumnPageTuples: [['D1']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 3,
        serverColumnTotalCount: 100,
      },
      rowData: [],
      columns: [{ key: 'metric_name', label: '指标项', dataType: GenericDataType.String }],
      columnTree: [],
      generatedColumnIds: [],
      selectedDynamicGroupBy: {
        level2: 'shop',
        level3: 'none',
      },
      dynamicGroupByConfig: {
        enabled: true,
        slots: [
          {
            id: 'level2',
            label: '二级维度',
            placement: 'columns',
            slotIndex: 1,
            spliceCount: 1,
            defaultOptionId: 'shop',
            options: [
              { id: 'shop', label: '店铺', columns: ['shop_name'] },
              { id: 'country', label: '国家', columns: ['country'] },
            ],
          },
          {
            id: 'level3',
            label: '三级维度',
            placement: 'columns',
            slotIndex: 2,
            spliceCount: 1,
            defaultOptionId: 'none',
            options: [
              { id: 'none', label: '(无)', columns: [] },
              { id: 'msku', label: 'MSKU', columns: ['msku'] },
            ],
          },
        ],
      },
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = getDynamicGroupBySelect('level3');
    act(() => {
      select.value = 'msku';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: {
          level2: 'shop',
          level3: 'msku',
        },
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
  });
```

- [ ] **Step 3: Run table tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: FAIL because `CrosstabTable.tsx` still reads `dynamicGroupByConfig.options` and renders a single control.

- [ ] **Step 4: Implement multiple selector descriptors**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`, add `selectedDynamicGroupBy` to the component props destructuring.

```ts
  selectedDynamicGroupBy,
```

Replace the `dynamicGroupByOptions`, `dynamicGroupByValueSet`, `defaultDynamicGroupByValue`, and `selectedDynamicGroupByValue` memo blocks with this descriptor memo.

```ts
  const dynamicGroupBySelectors = useMemo(
    () =>
      dynamicGroupByConfig?.enabled
        ? [...dynamicGroupByConfig.slots]
            .sort((left, right) => {
              if (left.placement !== right.placement) {
                return left.placement.localeCompare(right.placement);
              }

              return left.slotIndex - right.slotIndex;
            })
            .map(slot => {
              const options = slot.options.map(option => ({
                label: option.label,
                value: option.id,
              }));
              const selectedValue = selectedDynamicGroupBy?.[slot.id];
              const value = options.some(option => option.value === selectedValue)
                ? selectedValue
                : slot.defaultOptionId;

              return {
                label: slot.label === undefined ? '分组维度' : slot.label,
                options,
                slotId: slot.id,
                value,
                valueSet: new Set(options.map(option => option.value)),
              };
            })
        : [],
    [dynamicGroupByConfig, selectedDynamicGroupBy],
  );
```

Replace `updateDynamicGroupByColumn` with:

```ts
  const updateDynamicGroupByOption = useCallback(
    (slotId: string, nextOptionId: string) => {
      const selector = dynamicGroupBySelectors.find(
        item => item.slotId === slotId,
      );

      if (!selector?.valueSet.has(nextOptionId)) {
        return;
      }

      setDataMask?.({
        ownState: {
          ...getPreservedDynamicGroupByOwnState(ownState),
          selectedDynamicGroupBy: {
            ...selectedDynamicGroupBy,
            [slotId]: nextOptionId,
          },
          currentColumnPage: 0,
          currentColumnPageSize: effectiveColumnsPerPage,
          serverColumnPageTuples: [],
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: effectiveColumnsPerPage,
        },
      });
    },
    [
      dynamicGroupBySelectors,
      effectiveColumnsPerPage,
      ownState,
      selectedDynamicGroupBy,
      setDataMask,
    ],
  );
```

Update `getPreservedDynamicGroupByOwnState` in `CrosstabTable.tsx` to remove legacy state during new writes.

```ts
  delete preservedOwnState.selectedDynamicGroupByColumn;
```

Replace `dynamicGroupBySelect` with:

```tsx
  const dynamicGroupBySelects = dynamicGroupBySelectors.map(selector => (
    <div
      data-test={`crosstab-dynamic-groupby-control--${selector.slotId}`}
      key={selector.slotId}
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        gap: theme.sizeUnit,
      }}
    >
      <span>{selector.label}</span>
      <Select
        ariaLabel={`Select crosstab group by dimension ${selector.label}`}
        allowSelectAll={false}
        onChange={(nextOptionId: string) =>
          updateDynamicGroupByOption(selector.slotId, nextOptionId)
        }
        options={selector.options}
        value={selector.value}
      />
    </div>
  ));
```

Replace toolbar rendering:

```tsx
        {dynamicGroupBySelects}
```

- [ ] **Step 5: Run table tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: PASS. If legacy selector tests fail, update their expected selector value from physical column label to canonical option id `shop_name` or `country`; the legacy normalizer intentionally uses column labels as option ids.

- [ ] **Step 6: Commit Task 5**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
git commit -m "feat(crosstab): render dynamic group by slot selectors"
```

## Task 6: Own-State Isolation And Full Validation

**Files:**
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`
- Verify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
- Verify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Verify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Verify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`

- [ ] **Step 1: Write failing own-state strip test**

In `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`, add `selectedDynamicGroupBy` to the first test input.

```ts
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
```

Keep the expected output unchanged:

```ts
  ).toEqual({ filterState: { value: ['kept'] } });
```

- [ ] **Step 2: Run own-state test and verify it fails**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: FAIL because `selectedDynamicGroupBy` remains in the returned ownState.

- [ ] **Step 3: Strip canonical selected slot map**

In `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`, add the new key before the legacy key.

```ts
  'selectedDynamicGroupBy',
  'selectedDynamicGroupByColumn',
```

- [ ] **Step 4: Run own-state test**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run focused crosstab tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run lint and type validation**

Run:

```bash
cd superset-frontend && npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.ts src/explore/components/ExploreViewContainer/ownState.test.ts
```

Expected: PASS.

Run:

```bash
cd superset-frontend && npm run type -- --pretty false
```

Expected: PASS, or report only pre-existing repository-wide type errors that are unrelated to the changed files. If repository-wide type errors appear, run the focused Jest suite again and include the typecheck failure summary in the handoff.

- [ ] **Step 7: Run production build**

Run:

```bash
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

Expected: PASS. If the build fails due to a dependency or environment issue before compiling changed crosstab files, capture the exact command output and do not claim production readiness.

- [ ] **Step 8: Commit Task 6**

```bash
git add superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
git commit -m "fix(crosstab): isolate dynamic group by own state"
```

## Production Acceptance After Repository Validation

- [ ] **Step 1: Confirm production health**

Run:

```bash
curl -f http://111.230.91.24:8088/health
```

Expected:

```text
OK
```

- [ ] **Step 2: Deploy only after repository validation passes**

Use the existing Superset production deployment path already used for v2.1. Keep the bundle deployment scoped to frontend assets. Do not change backend API shape.

- [ ] **Step 3: Validate slice 10 compatibility mode**

Open:

```text
http://111.230.91.24:8088/explore/?slice_id=10
```

Expected:

- Chart renders as crosstab table.
- Toolbar shows current compatibility selector.
- Selector options include `店铺`, `国家`, `MSKU`, `父体`.
- Server-column pagination remains visible.
- No new crosstab errors or `HTTPException: 405` appear in server logs during render.

- [ ] **Step 4: Validate canonical examples on a test copy of slice 10**

Use a copied chart or temporary chart params with canonical `dynamicGroupBy` slot-array config. Verify these combinations:

```json
{
  "selectedDynamicGroupBy": {
    "level2": "shop",
    "level3": "none"
  }
}
```

```json
{
  "selectedDynamicGroupBy": {
    "level2": "shop",
    "level3": "msku"
  }
}
```

```json
{
  "selectedDynamicGroupBy": {
    "level2": "country",
    "level3": "parent_asin"
  }
}
```

Expected:

- `/api/v1/chart/data` request groupby values change with selected slot options.
- Representative metrics remain correct:
  - `销售额 = 567999.82`
  - `毛利率 = -9.5145`
  - `平均售价 = 98.6968`

## Final Review Checklist

- [ ] `dynamicGroupBy.test.ts` covers legacy normalization, disabled config, multi-slot, multi-column replacement, empty removal, append no-op, overlap, duplicate columns, unknown option, and max dimensions.
- [ ] `buildQuery.test.ts` proves effective dimensions feed leaf, domain, count, and summary roles.
- [ ] `transformProps.test.ts` proves selected slot map is passed to renderer and stale pagination/expanded rows are reset.
- [ ] `CrosstabTable.test.tsx` proves multiple selectors render and one selector update preserves the others.
- [ ] `ownState.test.ts` proves `selectedDynamicGroupBy` is stripped from `extra_form_data`.
- [ ] No `any` types were introduced.
- [ ] No direct Ant Design imports were added.
- [ ] No backend API, AG Grid Enterprise pivoting, server-side row model, dynamic metric selector, numeric parameter engine, or calculated-field AST was added.
- [ ] All commits are scoped to the task boundaries above.

## Self-Review Notes

Spec coverage: every V3.1 requirement maps to a task. Schema and compatibility are Task 1, runtime resolution and validation are Task 2, query and summary dimensions are Task 3, transform reset and renderer props are Task 4, toolbar behavior is Task 5, own-state isolation plus repository and production acceptance are Task 6 and Production Acceptance.

Placeholder scan: this plan avoids open-ended implementation language and provides concrete tests, code snippets, commands, and expected outcomes for every task.

Type consistency: canonical runtime selection is consistently named `selectedDynamicGroupBy?: Record<string, string>`. Legacy read-only selection remains `selectedDynamicGroupByColumn?: QueryFormColumn`. Normalized config is consistently `CrosstabDynamicGroupByConfig` with `slots`.
