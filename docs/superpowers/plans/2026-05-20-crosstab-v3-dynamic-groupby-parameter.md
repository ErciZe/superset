# Crosstab V3-S0 Dynamic Group By Parameter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one chart-local single-select parameter can replace one crosstab group-by dimension and requery the current chart without stale AG Grid columns or server-column pagination state.

**Architecture:** Add a small dynamic-group-by resolver module that turns persisted form data plus chart `ownState` into effective row and column dimensions. Wire that resolver into `buildQuery`, `transformProps`, and `CrosstabTable`; keep the spike frontend-only and fail fast on invalid slot or whitelist configuration.

**Tech Stack:** TypeScript, React 17, Jest, existing Superset chart `ownState` and `setDataMask`, `@superset-ui/core/components`, AG Grid Community renderer.

---

## File Structure

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Add `dynamicGroupBy` form-data config, selected dynamic field in `CrosstabOwnState`, and renderer props for the effective group-by signature.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
  - Parse and validate dynamic group-by config.
  - Resolve effective `rowDimensions` and `columnDimensions` from form data plus `ownState`.
  - Build a stable signature for cache and pagination resets.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`
  - Unit tests for disabled behavior, default selection, runtime selection, whitelist validation, invalid slot failure, and signature changes.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Use effective dimensions everywhere query generation currently uses `rowDimensions` and `columnDimensions`.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - Add tests proving dynamic field selection changes leaf, domain, count, row-total, and summary query dimensions.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Use the same effective dimensions as `buildQuery`.
  - Reset server column pagination and expanded paths when the dynamic group-by signature changes.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - Add tests for generated headers after dynamic selection and ownState reset when the selected dimension changes.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Render the chart-local `分组维度` select when dynamic group-by is enabled.
  - Update `ownState.selectedDynamicGroupByColumn` and clear server column page state on selection changes.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - Add toolbar tests for rendering, option changes, and pagination reset payload.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
  - Add a narrow JSON config control for the feasibility spike.

## Task 1: Dynamic Group By Types And Resolver

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts` with:

```ts
import {
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN,
  ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT,
  getDynamicGroupByConfig,
  resolveDynamicGroupByDimensions,
} from '../../src/plugin/dynamicGroupBy';
import type { CrosstabFormData } from '../../src/types';

function baseFormData(overrides: Partial<CrosstabFormData> = {}): CrosstabFormData {
  return {
    datasource: '7__table',
    viz_type: 'crosstab_table',
    crosstabFieldConfig: {
      rows: [{ field: 'metric_name_with_unit' }],
      columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
      metrics: [{ metric: '指标值' }],
    },
    ...overrides,
  };
}

describe('crosstab dynamic group by', () => {
  it('returns persisted dimensions when dynamic group by is disabled', () => {
    expect(
      resolveDynamicGroupByDimensions({
        formData: baseFormData(),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toEqual({
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
      signature: 'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
      config: undefined,
      selectedColumn: undefined,
    });
  });

  it('uses the default column when runtime state has no selected column', () => {
    const resolved = resolveDynamicGroupByDimensions({
      formData: baseFormData({
        dynamicGroupBy: {
          enabled: true,
          placement: 'columns',
          slotIndex: 1,
          defaultColumn: 'shop_name',
          options: [
            { label: '店铺', column: 'shop_name' },
            { label: '国家', column: 'country' },
          ],
        },
      }),
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(resolved.columnDimensions).toEqual(['biz_date', 'shop_name']);
    expect(resolved.selectedColumn).toBe('shop_name');
    expect(resolved.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
    );
  });

  it('replaces the configured slot from runtime state', () => {
    const resolved = resolveDynamicGroupByDimensions({
      formData: baseFormData({
        dynamicGroupBy: {
          enabled: true,
          placement: 'columns',
          slotIndex: 1,
          defaultColumn: 'shop_name',
          options: [
            { label: '店铺', column: 'shop_name' },
            { label: '国家', column: 'country' },
            { label: 'MSKU', column: 'msku' },
          ],
        },
      }),
      ownState: {
        selectedDynamicGroupByColumn: 'country',
      },
      rowDimensions: ['metric_name_with_unit'],
      columnDimensions: ['biz_date', 'shop_name'],
    });

    expect(resolved.columnDimensions).toEqual(['biz_date', 'country']);
    expect(resolved.signature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
  });

  it('parses JSON control values and rejects invalid JSON', () => {
    expect(
      getDynamicGroupByConfig({
        dynamicGroupBy:
          '{"enabled":true,"placement":"columns","slotIndex":1,"defaultColumn":"shop_name","options":[{"label":"店铺","column":"shop_name"}]}',
      } as CrosstabFormData),
    ).toEqual({
      enabled: true,
      placement: 'columns',
      slotIndex: 1,
      defaultColumn: 'shop_name',
      options: [{ label: '店铺', column: 'shop_name' }],
    });

    expect(() =>
      getDynamicGroupByConfig({
        dynamicGroupBy: '{bad json}',
      } as CrosstabFormData),
    ).toThrow('Invalid crosstab dynamic group by JSON config.');
  });

  it('fails fast when enabled with no options', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: baseFormData({
          dynamicGroupBy: {
            enabled: true,
            placement: 'columns',
            slotIndex: 1,
            defaultColumn: 'shop_name',
            options: [],
          },
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  });

  it('fails fast when the selected column is outside the whitelist', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: baseFormData({
          dynamicGroupBy: {
            enabled: true,
            placement: 'columns',
            slotIndex: 1,
            defaultColumn: 'shop_name',
            options: [{ label: '店铺', column: 'shop_name' }],
          },
        }),
        ownState: {
          selectedDynamicGroupByColumn: 'country',
        },
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  });

  it('fails fast when the slot index is outside the target dimensions', () => {
    expect(() =>
      resolveDynamicGroupByDimensions({
        formData: baseFormData({
          dynamicGroupBy: {
            enabled: true,
            placement: 'columns',
            slotIndex: 2,
            defaultColumn: 'shop_name',
            options: [{ label: '店铺', column: 'shop_name' }],
          },
        }),
        rowDimensions: ['metric_name_with_unit'],
        columnDimensions: ['biz_date', 'shop_name'],
      }),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand
```

Expected: FAIL because `src/plugin/dynamicGroupBy.ts` does not exist.

- [ ] **Step 3: Add dynamic group-by types**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`, add these types after `CrosstabConditionalRule`:

```ts
export type DynamicGroupByPlacement = 'rows' | 'columns';

export type CrosstabDynamicGroupByOption = {
  label: string;
  column: QueryFormColumn;
};

export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  placement: DynamicGroupByPlacement;
  slotIndex: number;
  defaultColumn: QueryFormColumn;
  options: CrosstabDynamicGroupByOption[];
};
```

Update `CrosstabFormData`:

```ts
export interface CrosstabFormData extends QueryFormData {
  groupbyRows?: QueryFormColumn[];
  groupbyColumns?: QueryFormColumn[];
  metrics?: QueryFormMetric[];
  crosstabFieldConfig?: CrosstabFieldConfig;
  dynamicGroupBy?: CrosstabDynamicGroupByConfig | string;
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  showRowSubtotals?: boolean;
  showColumnSubtotals?: boolean;
  maxGeneratedColumns?: number;
  serverColumnPagination?: boolean;
  columnPageSize?: number;
  generatedColumnWidth?: number;
  defaultRowExpandedDepth?: number;
  numberFormat?: string;
  conditionalFormatting?: CrosstabConditionalRule[] | string;
  serverPagination?: boolean;
}
```

Update `CrosstabChartProps`:

```ts
export type CrosstabChartProps = ChartProps<CrosstabFormData> &
  CrosstabEngineResult & {
    serverColumnTotalCount?: number;
    serverColumnCurrentPage?: number;
    serverColumnPageSize?: number;
    isServerColumnLoading?: boolean;
    expandedRowPaths?: string[];
    dynamicGroupByConfig?: CrosstabDynamicGroupByConfig;
    selectedDynamicGroupByColumn?: QueryFormColumn;
    effectiveGroupBySignature?: string;
  };
```

Update `CrosstabOwnState`:

```ts
export type CrosstabOwnState = {
  currentColumnPage?: number;
  currentColumnPageSize?: number;
  expandedRowPaths?: string[];
  selectedDynamicGroupByColumn?: QueryFormColumn;
  effectiveGroupBySignature?: string;
  serverColumnPageColumnSignature?: string;
  serverColumnPageTuples?: DataRecordValue[][];
  serverColumnPageTuplesPage?: number;
  serverColumnPageTuplesPageSize?: number;
  serverColumnTotalCount?: number;
};
```

- [ ] **Step 4: Implement the resolver**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`:

```ts
import { getColumnLabel, type JsonObject, type QueryFormColumn } from '@superset-ui/core';
import type {
  CrosstabDynamicGroupByConfig,
  CrosstabFormData,
} from '../types';
import type { CrosstabOwnState } from './serverColumnPagination';

export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS =
  'Crosstab dynamic group by requires at least one whitelisted option.';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN =
  'Crosstab dynamic group by selected column is not in the whitelist.';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT =
  'Crosstab dynamic group by slot index is outside the configured dimensions.';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG =
  'Invalid crosstab dynamic group by config.';

type ResolveDynamicGroupByArgs = {
  formData: CrosstabFormData;
  ownState?: JsonObject;
  rowDimensions: QueryFormColumn[];
  columnDimensions: QueryFormColumn[];
};

export type ResolvedDynamicGroupByDimensions = {
  rowDimensions: QueryFormColumn[];
  columnDimensions: QueryFormColumn[];
  signature: string;
  config?: CrosstabDynamicGroupByConfig;
  selectedColumn?: QueryFormColumn;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseConfig(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.trim() === '') {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('Invalid crosstab dynamic group by JSON config.');
  }
}

function assertColumn(value: unknown): QueryFormColumn {
  if (!value) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  return value as QueryFormColumn;
}

function columnKey(column: QueryFormColumn): string {
  const key = getColumnLabel(column);

  if (!key) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  return key;
}

export function getDynamicGroupByConfig(
  formData: CrosstabFormData,
): CrosstabDynamicGroupByConfig | undefined {
  const rawConfig = parseConfig(formData.dynamicGroupBy);

  if (rawConfig === undefined) {
    return undefined;
  }

  if (!isObject(rawConfig)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  const enabled = rawConfig.enabled === true;
  const placement = rawConfig.placement;
  const slotIndex = rawConfig.slotIndex;
  const options = rawConfig.options;

  if (placement !== 'rows' && placement !== 'columns') {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (!Number.isInteger(slotIndex) || Number(slotIndex) < 0) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  if (!Array.isArray(options)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
  }

  return {
    enabled,
    placement,
    slotIndex: Number(slotIndex),
    defaultColumn: assertColumn(rawConfig.defaultColumn),
    options: options.map(option => {
      if (!isObject(option) || typeof option.label !== 'string') {
        throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_CONFIG);
      }

      return {
        label: option.label,
        column: assertColumn(option.column),
      };
    }),
  };
}

function replaceAt<T>(values: T[], index: number, nextValue: T): T[] {
  if (index < 0 || index >= values.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT);
  }

  return values.map((value, currentIndex) =>
    currentIndex === index ? nextValue : value,
  );
}

function signature(rowDimensions: QueryFormColumn[], columnDimensions: QueryFormColumn[]) {
  return `rows=${rowDimensions.map(columnKey).join('\u001f')}|columns=${columnDimensions
    .map(columnKey)
    .join('\u001f')}`;
}

export function resolveDynamicGroupByDimensions({
  formData,
  ownState,
  rowDimensions,
  columnDimensions,
}: ResolveDynamicGroupByArgs): ResolvedDynamicGroupByDimensions {
  const config = getDynamicGroupByConfig(formData);

  if (!config?.enabled) {
    return {
      rowDimensions,
      columnDimensions,
      signature: signature(rowDimensions, columnDimensions),
      config: undefined,
      selectedColumn: undefined,
    };
  }

  if (!config.options.length) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_OPTIONS);
  }

  const state = ownState as CrosstabOwnState | undefined;
  const selectedColumn = state?.selectedDynamicGroupByColumn ?? config.defaultColumn;
  const selectedColumnKey = columnKey(selectedColumn);
  const optionKeys = new Set(config.options.map(option => columnKey(option.column)));

  if (!optionKeys.has(selectedColumnKey)) {
    throw new Error(ERR_CROSSTAB_DYNAMIC_GROUP_BY_SELECTED_COLUMN);
  }

  const nextRowDimensions =
    config.placement === 'rows'
      ? replaceAt(rowDimensions, config.slotIndex, selectedColumn)
      : rowDimensions;
  const nextColumnDimensions =
    config.placement === 'columns'
      ? replaceAt(columnDimensions, config.slotIndex, selectedColumn)
      : columnDimensions;

  return {
    rowDimensions: nextRowDimensions,
    columnDimensions: nextColumnDimensions,
    signature: signature(nextRowDimensions, nextColumnDimensions),
    config,
    selectedColumn,
  };
}
```

- [ ] **Step 5: Run the resolver test and commit**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts
git commit -m "feat: add crosstab dynamic groupby resolver"
```

## Task 2: Use Effective Dimensions In Query Generation

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`

- [ ] **Step 1: Add failing buildQuery tests**

Append these tests to `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`:

```ts
  it('uses the default dynamic group by column in query dimensions', () => {
    const queryContext = buildQuery({
      datasource: '7__table',
      viz_type: 'crosstab-table',
      crosstabFieldConfig: {
        rows: [{ field: 'metric_name_with_unit' }],
        columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
        metrics: [{ metric: '指标值' }],
      },
      dynamicGroupBy: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'shop_name',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
    } as never);

    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'shop_name',
    ]);
  });

  it('uses the runtime selected dynamic group by column in query dimensions', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值' }],
        },
        dynamicGroupBy: {
          enabled: true,
          placement: 'columns',
          slotIndex: 1,
          defaultColumn: 'shop_name',
          options: [
            { label: '店铺', column: 'shop_name' },
            { label: '国家', column: 'country' },
            { label: 'MSKU', column: 'msku' },
          ],
        },
      } as never,
      {
        ownState: {
          selectedDynamicGroupByColumn: 'country',
        },
      } as never,
    );

    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'country',
    ]);
  });

  it('uses effective dynamic dimensions for server column pagination queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值' }],
        },
        dynamicGroupBy: {
          enabled: true,
          placement: 'columns',
          slotIndex: 1,
          defaultColumn: 'shop_name',
          options: [
            { label: '店铺', column: 'shop_name' },
            { label: '国家', column: 'country' },
          ],
        },
        serverColumnPagination: true,
        columnPageSize: 98,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          selectedDynamicGroupByColumn: 'country',
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0].columns).toEqual(['biz_date', 'country']);
    expect(queryContext.queries[1].columns).toEqual(['biz_date', 'country']);
  });
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: FAIL because `buildQuery.ts` still uses persisted dimensions.

- [ ] **Step 3: Wire the resolver into buildQuery**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`, add:

```ts
import { resolveDynamicGroupByDimensions } from './dynamicGroupBy';
```

Replace the current row and column dimension initialization:

```ts
  const persistedRowDimensions = ensureIsArray<QueryFormColumn>(
    getCrosstabRowColumns(formData),
  );
  const persistedColumnDimensions = ensureIsArray<QueryFormColumn>(
    getCrosstabColumnColumns(formData),
  );
  const {
    rowDimensions,
    columnDimensions,
  } = resolveDynamicGroupByDimensions({
    formData,
    ownState: options?.ownState,
    rowDimensions: persistedRowDimensions,
    columnDimensions: persistedColumnDimensions,
  });
```

Keep the rest of the file using `rowDimensions` and `columnDimensions`.

- [ ] **Step 4: Run buildQuery tests and commit**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
git commit -m "feat: use dynamic groupby in crosstab queries"
```

## Task 3: Use Effective Dimensions And Reset Stale Own State In transformProps

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Add failing transform tests**

Append these tests to `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`:

```ts
  it('builds generated headers from the selected dynamic group by column', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值' }],
        },
        dynamicGroupBy: {
          enabled: true,
          placement: 'columns',
          slotIndex: 1,
          defaultColumn: 'shop_name',
          options: [
            { label: '店铺', column: 'shop_name' },
            { label: '国家', column: 'country' },
          ],
        },
      },
      ownState: {
        selectedDynamicGroupByColumn: 'country',
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              country: 'US',
              指标值: 10,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          shop_name: '店铺',
          country: '国家',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.selectedDynamicGroupByColumn).toBe('country');
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        children: [
          expect.objectContaining({
            label: 'US',
          }),
        ],
      }),
    ]);
  });

  it('clears stale server column pagination state when dynamic dimensions change', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值' }],
        },
        dynamicGroupBy: {
          enabled: true,
          placement: 'columns',
          slotIndex: 1,
          defaultColumn: 'shop_name',
          options: [
            { label: '店铺', column: 'shop_name' },
            { label: '国家', column: 'country' },
          ],
        },
        serverColumnPagination: true,
      },
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        currentColumnPage: 3,
        currentColumnPageSize: 5,
        expandedRowPaths: ['old-path'],
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name',
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 5,
        serverColumnTotalCount: 389,
      },
      hooks: { setDataMask },
      queriesData: [],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.isServerColumnLoading).toBe(true);
    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
  });
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: FAIL because `transformProps.ts` still uses persisted dimensions and does not expose dynamic props.

- [ ] **Step 3: Wire resolver and reset logic into transformProps**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`, add:

```ts
import { resolveDynamicGroupByDimensions } from './dynamicGroupBy';
```

Replace row/column normalization with:

```ts
  const persistedRowFields =
    ensureIsArray<QueryFormColumn>(rowColumns).map(normalizeColumn);
  const persistedColumnFields =
    ensureIsArray<QueryFormColumn>(columnColumns).map(normalizeColumn);
  const dynamicGroupBy = resolveDynamicGroupByDimensions({
    formData: crosstabFormData,
    ownState: crosstabOwnState,
    rowDimensions: ensureIsArray<QueryFormColumn>(rowColumns),
    columnDimensions: ensureIsArray<QueryFormColumn>(columnColumns),
  });
  const rowFields = dynamicGroupBy.rowDimensions.map(normalizeColumn);
  const columnFields = dynamicGroupBy.columnDimensions.map(normalizeColumn);
```

Delete unused `persistedRowFields` and `persistedColumnFields` if TypeScript reports them unused. They are useful only while editing.

Add this helper near `updateServerColumnOwnState`:

```ts
function resetDynamicGroupByOwnState(
  ownState: CrosstabOwnState,
  setDataMask: CrosstabChartProps['hooks']['setDataMask'] | undefined,
  signature: string,
  currentPageSize: number,
) {
  if (ownState.effectiveGroupBySignature === signature) {
    return false;
  }

  setDataMask?.({
    ownState: {
      selectedDynamicGroupByColumn: ownState.selectedDynamicGroupByColumn,
      effectiveGroupBySignature: signature,
      currentColumnPage: 0,
      currentColumnPageSize: currentPageSize,
      serverColumnPageTuples: [],
      serverColumnPageTuplesPage: 0,
      serverColumnPageTuplesPageSize: currentPageSize,
    },
  });

  return true;
}
```

After `columnPageSize` is computed and before building the query plan, call:

```ts
  const resetForDynamicGroupBy = dynamicGroupBy.config
    ? resetDynamicGroupByOwnState(
        crosstabOwnState,
        setDataMask,
        dynamicGroupBy.signature,
        columnPageSize,
      )
    : false;
```

Use `resetForDynamicGroupBy` in server pagination loading behavior:

```ts
  const skipStaleServerData = serverColumnPagination && resetForDynamicGroupBy;
```

Then use `skipStaleServerData` when selecting data:

```ts
  const rowData =
    skipStaleServerData || (serverColumnPagination && !dataQuery)
      ? []
      : serverColumnPagination && legacyServerRowTotalQuery?.data
        ? applyRowTotals(
            result.rowData,
            legacyServerRowTotalQuery.data as DataRecord[],
            rowFields,
            metricFields,
          )
        : result.rowData;
```

Return the dynamic props:

```ts
    dynamicGroupByConfig: dynamicGroupBy.config,
    selectedDynamicGroupByColumn: dynamicGroupBy.selectedColumn,
    effectiveGroupBySignature: dynamicGroupBy.signature,
    isServerColumnLoading:
      skipStaleServerData || (serverColumnPagination && !dataQuery),
```

- [ ] **Step 4: Run transform tests and commit**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "feat: resolve dynamic groupby in crosstab transform"
```

## Task 4: Chart Toolbar Runtime Select

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`

- [ ] **Step 1: Extend the component mock for Select**

In `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`, update the `jest.mock('@superset-ui/core/components', ...)` return object to include:

```tsx
    Select: ({
      ariaLabel,
      onChange,
      options,
      value,
    }: {
      ariaLabel?: string;
      onChange?: (value: string) => void;
      options: { label: string; value: string }[];
      value?: string;
    }) => (
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={event => onChange?.(event.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
```

- [ ] **Step 2: Add failing toolbar tests**

Append these tests to `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`:

```tsx
  it('renders a dynamic group by select when enabled', () => {
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
      },
      dynamicGroupByConfig: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'shop_name',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
      selectedDynamicGroupByColumn: 'shop_name',
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    expect(getByText('分组维度')).toBeInTheDocument();
    expect(
      container.querySelector('select[aria-label="Select crosstab group by dimension"]'),
    ).toHaveValue('shop_name');
  });

  it('updates chart own state when dynamic group by selection changes', () => {
    const setDataMask = jest.fn();
    const props = {
      height: 400,
      width: 800,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        serverColumnPagination: true,
      },
      hooks: { setDataMask },
      ownState: {
        selectedDynamicGroupByColumn: 'shop_name',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        currentColumnPage: 2,
        currentColumnPageSize: 5,
        expandedRowPaths: ['old'],
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name',
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 2,
        serverColumnPageTuplesPageSize: 5,
      },
      dynamicGroupByConfig: {
        enabled: true,
        placement: 'columns',
        slotIndex: 1,
        defaultColumn: 'shop_name',
        options: [
          { label: '店铺', column: 'shop_name' },
          { label: '国家', column: 'country' },
        ],
      },
      selectedDynamicGroupByColumn: 'shop_name',
      rowData: [],
      columns: [],
      columnTree: [],
      generatedColumnIds: [],
    } as unknown as CrosstabChartProps;

    renderChart(props);

    const select = container.querySelector(
      'select[aria-label="Select crosstab group by dimension"]',
    );
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Unable to find dynamic group by select');
    }

    act(() => {
      select.value = 'country';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
  });
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: FAIL because the toolbar has no dynamic select.

- [ ] **Step 4: Implement the toolbar select**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`, update imports:

```ts
import { Button, Select, ThemedAgGridReact } from '@superset-ui/core/components';
import { getColumnLabel, useTheme, type DataRecord, type DataRecordValue } from '@superset-ui/core';
```

Inside `CrosstabTable`, destructure the dynamic props:

```ts
  dynamicGroupByConfig,
  selectedDynamicGroupByColumn,
```

Add this callback before `exportCsv`:

```ts
  const dynamicGroupByOptions = useMemo(
    () =>
      dynamicGroupByConfig?.options.map(option => ({
        label: option.label,
        value: getColumnLabel(option.column),
      })) ?? [],
    [dynamicGroupByConfig],
  );
  const selectedDynamicGroupByValue =
    selectedDynamicGroupByColumn !== undefined
      ? getColumnLabel(selectedDynamicGroupByColumn)
      : dynamicGroupByOptions[0]?.value;
  const changeDynamicGroupBy = useCallback(
    (nextColumn: string) => {
      const currentPageSize =
        (ownState as { currentColumnPageSize?: number } | undefined)
          ?.currentColumnPageSize ?? effectiveColumnsPerPage;

      setDataMask?.({
        ownState: {
          selectedDynamicGroupByColumn: nextColumn,
          currentColumnPage: 0,
          currentColumnPageSize: currentPageSize,
          serverColumnPageTuples: [],
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: currentPageSize,
        },
      });
    },
    [effectiveColumnsPerPage, ownState, setDataMask],
  );
```

Render this block before the CSV button:

```tsx
        {dynamicGroupByConfig?.enabled && dynamicGroupByOptions.length > 0 && (
          <label
            style={{
              alignItems: 'center',
              display: 'inline-flex',
              gap: theme.sizeUnit,
            }}
          >
            <span>{t('分组维度')}</span>
            <Select
              ariaLabel="Select crosstab group by dimension"
              options={dynamicGroupByOptions}
              value={selectedDynamicGroupByValue}
              onChange={value => changeDynamicGroupBy(String(value))}
            />
          </label>
        )}
```

If TypeScript reports that the `Select` prop is named `aria-label` instead of `ariaLabel`, inspect an existing `@superset-ui/core/components` Select usage in the repo and use that exact prop name. Do not import Select directly from `antd`.

- [ ] **Step 5: Run component tests and commit**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
git commit -m "feat: add crosstab dynamic groupby toolbar"
```

## Task 5: Explore Spike Configuration Control

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add failing controlPanel test**

Append this test to `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`:

```ts
  it('exposes the dynamic group by JSON spike control', () => {
    const crosstabSection = config.controlPanelSections.find(
      section => section.label === 'Crosstab',
    );
    const dynamicControl = crosstabSection?.controlSetRows
      .flat()
      .find(control => typeof control === 'object' && control.name === 'dynamicGroupBy');

    expect(dynamicControl).toEqual(
      expect.objectContaining({
        name: 'dynamicGroupBy',
        config: expect.objectContaining({
          type: 'TextAreaControl',
          label: 'Dynamic group by',
          language: 'json',
          renderTrigger: true,
        }),
      }),
    );
  });
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: FAIL because no `dynamicGroupBy` control exists.

- [ ] **Step 3: Add the JSON control**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`, add this control in the `Crosstab` section before `showRowTotals`:

```ts
        [
          {
            name: 'dynamicGroupBy',
            config: {
              type: 'TextAreaControl',
              label: t('Dynamic group by'),
              default: '',
              language: 'json',
              renderTrigger: true,
              description: t(
                'JSON config for one chart-local dynamic group-by slot.',
              ),
            },
          },
        ],
```

Use this production spike JSON when manually configuring slice 10:

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

- [ ] **Step 4: Run controlPanel tests and commit**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "feat: expose crosstab dynamic groupby config"
```

## Task 6: Focused Regression And Browser Feasibility Check

**Files:**
- No source file changes expected.
- Optional evidence output: `docs/superpowers/reports/2026-05-20-crosstab-v3-dynamic-groupby-feasibility.md`

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run frontend lint on touched files**

Run:

```bash
cd superset-frontend
npx eslint \
  plugins/plugin-chart-crosstab-table/src/types.ts \
  plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts \
  plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx \
  plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
```

Expected: PASS or only pre-existing unrelated lint failures outside the listed files.

- [ ] **Step 3: Verify the runtime field names before production use**

Open Explore for slice 10 and inspect the datasource columns. Confirm the exact field names exist:

```text
shop_name
country
msku
parent_asin
```

If one field is absent, stop and update the JSON option list to the real physical field name before saving the chart. Do not add browser-side fallback names.

- [ ] **Step 4: Browser feasibility path**

In the running Superset UI, configure the spike JSON from Task 5 on slice 10. Then verify:

```text
店铺 -> headers contain shop values
国家 -> chart requeries and headers contain country values, no stale shop headers
MSKU -> chart requeries and headers contain MSKU values, no stale country headers
```

With server column pagination enabled, confirm the footer resets to the first column page after each switch:

```text
列 1-N / total
```

- [ ] **Step 5: Record feasibility evidence**

If browser verification is performed, create `docs/superpowers/reports/2026-05-20-crosstab-v3-dynamic-groupby-feasibility.md` with:

```md
# Crosstab V3-S0 Dynamic Group By Feasibility

Date: 2026-05-20
Slice: 10

## Verdict

Feasibility: pass

## Verified Paths

- 店铺 rendered with non-empty crosstab headers.
- 国家 rendered after chart-local selection change with no stale 店铺 headers.
- MSKU rendered after chart-local selection change with no stale 国家 headers.
- Server column pagination reset to the first page after each selection.

## Commands

- cd superset-frontend && npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
- cd superset-frontend && npx eslint <touched files>
```

If the browser path fails, set `Feasibility: blocked` and record the exact failed selector, request, response, or console error.

- [ ] **Step 6: Commit evidence or final source changes**

If Task 6 created an evidence report, commit it separately:

```bash
git add docs/superpowers/reports/2026-05-20-crosstab-v3-dynamic-groupby-feasibility.md
git commit -m "test: document crosstab dynamic groupby feasibility"
```

## Self-Review Checklist

- Spec coverage:
  - One chart-local single-select control is covered by Task 4.
  - One dynamic group-by slot and whitelist validation are covered by Task 1.
  - Query generation with effective dimensions is covered by Task 2.
  - Transform, header rebuild, and ownState reset are covered by Task 3.
  - Explore save path is covered by Task 5.
  - Focused browser feasibility and server-column pagination reset are covered by Task 6.
- Scope check:
  - No multi-slot system.
  - No Dashboard global filter.
  - No linked parameters.
  - No calculated-field engine.
  - No backend API change.
- Type consistency:
  - `dynamicGroupBy` is the persisted form-data config key.
  - `selectedDynamicGroupByColumn` is the runtime ownState key.
  - `effectiveGroupBySignature` is the cache reset signature key.
  - `resolveDynamicGroupByDimensions` is used by both `buildQuery` and `transformProps`.
