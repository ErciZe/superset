# Crosstab Dynamic Column Sort and Full Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production crosstab support configured dynamic-column sorting, configured business-row ordering, row-value summary semantics, and full-filter-range SQL-backed totals for all rows.

**Architecture:** Keep the current data-row-driven matrix model: `metric_name_with_unit` remains the visible row dimension and `指标值` remains the selected metric. Extend `crosstabFieldConfig` with explicit dimension sort metadata and `rowValueSummaries`, then route those configs through query generation, summary result parsing, transform props, and the engine. Totals become summary-query-backed for additive and non-additive rows; server-column leaf data stays page-scoped while `row_total` summary remains full-scope.

**Tech Stack:** TypeScript, React, Superset chart plugin query builder, Jest, React Testing Library, AG Grid crosstab table plugin.

---

## Reference

Approved spec:
`docs/superpowers/specs/2026-05-25-crosstab-dynamic-column-sort-summary-design.md`

Primary plugin:
`superset-frontend/plugins/plugin-chart-crosstab-table`

Do not open a worktree. Work directly in
`/Volumes/extend/ecode-workspace/superset-source` on `noway-release`, preserving
unrelated dirty files.

## File Map

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Add dimension sort config types.
  - Add row-value summary config types.
  - Extend `DimensionFieldConfig` and `CrosstabFieldConfig`.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
  - Add helpers for row configs, column configs, sort configs, hidden sort fields, and row-value summaries.
  - Keep legacy row/column/metric helper behavior stable.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts`
  - Resolve row-value summaries before legacy semantic overrides.
  - Treat row-value summary config as a summary trigger even when all rows are additive.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/sortConfig.ts`
  - Keep sort normalization and comparator logic out of `buildQuery.ts`.
  - Build `orderby` arrays for Superset query objects.
  - Build deterministic frontend comparators for row and column records.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Resolve configured dynamic dimensions with sort metadata.
  - Add required hidden sort fields to query columns.
  - Use configured sort in server-column domain query.
  - Plan row-total summary for additive and non-additive totals.
  - Keep `row_total` full-range under server-column pagination.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`
  - Replace `hasNonAdditiveSummary` gating with `requiresSqlSummary`.
  - Keep server-column bootstrap returning only domain/count before page tuples exist.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts`
  - No new data shape expected. Add tests only if keying changes are needed.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Reconstruct the expanded query plan and build summary maps for additive and non-additive totals.
  - Pass sort comparators or sorted records into the engine.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts`
  - Sort column domains with configured comparator before generating tuples.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
  - Use summary values for row totals, column totals, and grand totals whenever the total surface is enabled.
  - Apply configured row ordering.
  - Fail when a required summary value is missing.
- Modify tests:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`
  - Add `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts`

## Task 1: Extend Persisted Types and Field Config Helpers

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`

- [ ] **Step 1: Add failing tests for sort and row-value summary config**

Append these tests to `fieldConfig.test.ts`:

```ts
it('returns configured row and column dimension configs with sort metadata', () => {
  const formData = {
    crosstabFieldConfig: {
      rows: [
        {
          field: 'metric_name_with_unit',
          label: '指标',
          sort: {
            by: 'metric_order',
            direction: 'asc',
            type: 'number',
            nulls: 'last',
          },
        },
      ],
      columns: [
        {
          field: 'biz_date',
          label: '日期',
          sort: {
            by: 'biz_date',
            direction: 'desc',
            type: 'date',
            nulls: 'last',
          },
        },
      ],
      metrics: [{ metric: '指标值', semantic: 'additive' }],
    },
  } as CrosstabFormData;

  expect(getCrosstabRowConfigs(formData)).toEqual([
    {
      field: 'metric_name_with_unit',
      label: '指标',
      sort: {
        by: 'metric_order',
        direction: 'asc',
        type: 'number',
        nulls: 'last',
      },
    },
  ]);
  expect(getCrosstabColumnConfigs(formData)).toEqual([
    {
      field: 'biz_date',
      label: '日期',
      sort: {
        by: 'biz_date',
        direction: 'desc',
        type: 'date',
        nulls: 'last',
      },
    },
  ]);
});

it('returns configured row value summaries before legacy semantic overrides', () => {
  const formData = {
    crosstabFieldConfig: {
      rowValueSummaries: {
        field: 'metric_name_with_unit',
        values: [
          { value: '销量（件）', semantic: 'additive' },
          { value: '毛利率（%）', semantic: 'ratio', formatString: '.2%' },
        ],
      },
      semanticOverrideField: 'metric_name_with_unit',
      semanticOverrides: [{ value: '毛利率（%）', semantic: 'additive' }],
    },
  } as CrosstabFormData;

  expect(getCrosstabRowValueSummaries(formData)).toEqual({
    field: 'metric_name_with_unit',
    values: [
      { value: '销量（件）', semantic: 'additive' },
      { value: '毛利率（%）', semantic: 'ratio', formatString: '.2%' },
    ],
  });
});
```

- [ ] **Step 2: Run the failing field config tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts --runInBand
```

Expected: fail with missing exports such as `getCrosstabRowConfigs`.

- [ ] **Step 3: Extend TypeScript types**

In `types.ts`, replace the existing `DimensionFieldConfig` and
`CrosstabFieldConfig` area with:

```ts
export type CrosstabSortDirection = 'asc' | 'desc';
export type CrosstabSortType = 'string' | 'number' | 'date';
export type CrosstabNullSort = 'first' | 'last';

export type DimensionSortConfig = {
  by: QueryFormColumn | 'self';
  direction: CrosstabSortDirection;
  type?: CrosstabSortType;
  nulls?: CrosstabNullSort;
};

export type DimensionFieldConfig = {
  field: QueryFormColumn;
  label?: string;
  showSubtotal?: boolean;
  sort?: DimensionSortConfig;
};
```

Then add after `MetricSemanticOverride`:

```ts
export type RowValueSummaryConfig = {
  value: DataRecordValue;
  semantic: MetricSemantic;
  summaryMetric?: QueryFormMetric;
  formatString?: string;
};

export type CrosstabRowValueSummaryConfig = {
  field: QueryFormColumn;
  values: RowValueSummaryConfig[];
};
```

Update `CrosstabFieldConfig` to:

```ts
export type CrosstabFieldConfig = {
  rows?: DimensionFieldConfig[];
  columns?: DimensionFieldConfig[];
  metrics?: MetricFieldConfig[];
  rowValueSummaries?: CrosstabRowValueSummaryConfig;
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};
```

- [ ] **Step 4: Add field config helper exports**

In `fieldConfig.ts`, update the type import:

```ts
import type {
  CrosstabFieldConfig,
  CrosstabFormData,
  CrosstabRowValueSummaryConfig,
  DimensionFieldConfig,
  MetricFieldConfig,
} from '../types';
```

Add these helpers after `getCrosstabColumnColumns`:

```ts
export function getCrosstabRowConfigs(
  formData: CrosstabFormData,
): DimensionFieldConfig[] {
  return hasFieldConfig(formData.crosstabFieldConfig)
    ? formData.crosstabFieldConfig?.rows ?? []
    : ensureIsArray<QueryFormColumn>(formData.groupbyRows).map(field => ({
        field,
      }));
}

export function getCrosstabColumnConfigs(
  formData: CrosstabFormData,
): DimensionFieldConfig[] {
  return hasFieldConfig(formData.crosstabFieldConfig)
    ? formData.crosstabFieldConfig?.columns ?? []
    : ensureIsArray<QueryFormColumn>(formData.groupbyColumns).map(field => ({
        field,
      }));
}
```

Update the existing row and column column helpers to use the new config helpers:

```ts
export function getCrosstabRowColumns(formData: CrosstabFormData) {
  return getCrosstabRowConfigs(formData).map(item => item.field);
}

export function getCrosstabColumnColumns(formData: CrosstabFormData) {
  return getCrosstabColumnConfigs(formData).map(item => item.field);
}
```

Add:

```ts
export function getCrosstabRowValueSummaries(
  formData: CrosstabFormData,
): CrosstabRowValueSummaryConfig | undefined {
  return formData.crosstabFieldConfig?.rowValueSummaries;
}
```

- [ ] **Step 5: Run field config tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts --runInBand
```

Expected: pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts
git commit -m "feat(crosstab): add row and column config metadata"
```

## Task 2: Add Row-Value Semantic Resolution

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts`

- [ ] **Step 1: Add failing tests for row-value summary precedence and additive summary trigger**

Append to `metricSemantics.test.ts`:

```ts
it('resolves row value summaries before legacy semantic overrides', () => {
  const semantic = resolveMetricSemantic({
    metric: '指标值',
    row: { metric_name_with_unit: '毛利率（%）' },
    metricConfigs: [{ metric: '指标值', semantic: 'additive' }],
    rowValueSummaries: {
      field: 'metric_name_with_unit',
      values: [{ value: '毛利率（%）', semantic: 'ratio' }],
    },
    semanticOverrideField: 'metric_name_with_unit',
    semanticOverrides: [{ value: '毛利率（%）', semantic: 'additive' }],
  });

  expect(semantic).toBe('ratio');
});

it('treats row value summaries as requiring SQL summaries even when additive', () => {
  expect(
    hasConfiguredSummarySemantics(
      [{ metric: '指标值', semantic: 'additive' }],
      [],
      {
        field: 'metric_name_with_unit',
        values: [{ value: '销量（件）', semantic: 'additive' }],
      },
    ),
  ).toBe(true);
});
```

- [ ] **Step 2: Run failing metric semantic tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts --runInBand
```

Expected: fail with missing `rowValueSummaries` argument handling and missing
`hasConfiguredSummarySemantics`.

- [ ] **Step 3: Extend metric semantic arguments**

In `metricSemantics.ts`, import the new type:

```ts
import type {
  CrosstabRowValueSummaryConfig,
  MetricFieldConfig,
  MetricSemantic,
  MetricSemanticOverride,
} from '../types';
```

Extend `ResolveMetricSemanticArgs`:

```ts
type ResolveMetricSemanticArgs = {
  metric: QueryFormMetric;
  row?: DataRecord;
  metricConfigs?: MetricFieldConfig[];
  rowValueSummaries?: CrosstabRowValueSummaryConfig;
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};
```

At the start of `resolveMetricSemantic`, before legacy override logic, add:

```ts
if (rowValueSummaries && row) {
  const rowValueField = getColumnLabel(rowValueSummaries.field);
  const rowValue = rowValueField ? row[rowValueField] : undefined;
  const configuredSummary = rowValueSummaries.values.find(item =>
    Object.is(item.value, rowValue),
  );

  if (configuredSummary) {
    return configuredSummary.semantic;
  }
}
```

- [ ] **Step 4: Add configured summary trigger helper**

Replace `hasSqlSummarySemanticConfig` with a new helper while preserving the old
export as a compatibility wrapper:

```ts
export function hasConfiguredSummarySemantics(
  metricConfigs: MetricFieldConfig[],
  semanticOverrides: MetricSemanticOverride[],
  rowValueSummaries?: CrosstabRowValueSummaryConfig,
) {
  const configuredSemantics: (MetricSemantic | undefined)[] = [
    ...metricConfigs.map(config => config.semantic),
    ...semanticOverrides.map(override => override.semantic),
    ...(rowValueSummaries?.values.map(value => value.semantic) ?? []),
  ];

  return configuredSemantics.some(semantic => semantic !== undefined);
}

export function hasSqlSummarySemanticConfig(
  metricConfigs: MetricFieldConfig[],
  semanticOverrides: MetricSemanticOverride[],
  rowValueSummaries?: CrosstabRowValueSummaryConfig,
) {
  const configuredSemantics: (MetricSemantic | undefined)[] = [
    ...metricConfigs.map(config => config.semantic),
    ...semanticOverrides.map(override => override.semantic),
    ...(rowValueSummaries?.values.map(value => value.semantic) ?? []),
  ];

  return configuredSemantics.some(
    semantic => semantic !== undefined && isSqlSummarySemantic(semantic),
  );
}
```

- [ ] **Step 5: Run metric semantic tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts --runInBand
```

Expected: pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts
git commit -m "feat(crosstab): resolve row value summary semantics"
```

## Task 3: Add Sort Config Utilities

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/sortConfig.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts`

- [ ] **Step 1: Write failing sort utility tests**

Create `sortConfig.test.ts`:

```ts
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  buildDimensionOrderBy,
  compareDataRecordsByDimensionSort,
  getDimensionSortFields,
} from '../../src/plugin/sortConfig';
import type { DimensionFieldConfig } from '../../src/types';

const configs: DimensionFieldConfig[] = [
  {
    field: 'biz_date',
    sort: { by: 'biz_date', direction: 'asc', type: 'date', nulls: 'last' },
  },
  {
    field: 'shop_name',
    sort: { by: 'shop_order', direction: 'desc', type: 'number' },
  },
];

test('builds orderby entries from dimension sort configs', () => {
  expect(buildDimensionOrderBy(configs)).toEqual([
    ['biz_date', true],
    ['shop_order', false],
  ]);
});

test('returns hidden sort fields that are not visible dimensions', () => {
  expect(getDimensionSortFields(configs)).toEqual(['shop_order']);
});

test('sorts records by configured date and number fields', () => {
  const records = [
    { biz_date: '2025-01-02', shop_name: 'B', shop_order: 1 },
    { biz_date: '2025-01-01', shop_name: 'A', shop_order: 3 },
    { biz_date: '2025-01-01', shop_name: 'C', shop_order: 1 },
  ];

  expect([...records].sort(compareDataRecordsByDimensionSort(configs))).toEqual([
    { biz_date: '2025-01-01', shop_name: 'A', shop_order: 3 },
    { biz_date: '2025-01-01', shop_name: 'C', shop_order: 1 },
    { biz_date: '2025-01-02', shop_name: 'B', shop_order: 1 },
  ]);
});
```

- [ ] **Step 2: Run failing sort tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts --runInBand
```

Expected: fail because `sortConfig.ts` does not exist.

- [ ] **Step 3: Implement sort utilities**

Create `sortConfig.ts`:

```ts
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { getColumnLabel, type DataRecord } from '@superset-ui/core';
import type { DimensionFieldConfig, DimensionSortConfig } from '../types';

function getSortField(config: DimensionFieldConfig): string {
  const sortBy = config.sort?.by ?? 'self';
  const sortField = sortBy === 'self' ? config.field : sortBy;
  const label = getColumnLabel(sortField);

  if (!label) {
    throw new Error('Crosstab sort field must resolve to a column label.');
  }

  return label;
}

function normalizeValue(value: unknown, sort?: DimensionSortConfig) {
  if (value == null) {
    return value;
  }

  if (sort?.type === 'number') {
    return Number(value);
  }

  if (sort?.type === 'date') {
    return Date.parse(String(value));
  }

  return String(value);
}

function compareValues(
  left: unknown,
  right: unknown,
  sort?: DimensionSortConfig,
) {
  const nulls = sort?.nulls ?? 'last';

  if (left == null || right == null) {
    if (left == null && right == null) {
      return 0;
    }
    return (left == null ? -1 : 1) * (nulls === 'first' ? 1 : -1);
  }

  const normalizedLeft = normalizeValue(left, sort);
  const normalizedRight = normalizeValue(right, sort);

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  return 0;
}

export function buildDimensionOrderBy(
  configs: DimensionFieldConfig[],
): [string, boolean][] {
  return configs.map(config => [
    getSortField(config),
    (config.sort?.direction ?? 'asc') === 'asc',
  ]);
}

export function getDimensionSortFields(
  configs: DimensionFieldConfig[],
): string[] {
  const visibleFields = new Set(
    configs.map(config => getColumnLabel(config.field)).filter(Boolean),
  );

  return [
    ...new Set(
      configs
        .map(getSortField)
        .filter(sortField => !visibleFields.has(sortField)),
    ),
  ];
}

export function compareDataRecordsByDimensionSort(
  configs: DimensionFieldConfig[],
) {
  return (left: DataRecord, right: DataRecord) => {
    for (const config of configs) {
      const field = getSortField(config);
      const direction = config.sort?.direction ?? 'asc';
      const result = compareValues(left[field], right[field], config.sort);

      if (result !== 0) {
        return direction === 'asc' ? result : -result;
      }
    }

    return 0;
  };
}
```

- [ ] **Step 4: Run sort utility tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts --runInBand
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/sortConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts
git commit -m "feat(crosstab): add dimension sort utilities"
```

## Task 4: Plan Summary Queries for All Enabled Totals

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts`

- [ ] **Step 1: Add failing summary-plan tests**

Append to `summaryQueryPlan.test.ts`:

```ts
it('adds row total summary when column totals are enabled for additive rows', () => {
  const plan = buildCrosstabQueryPlan({
    rowFields: ['metric_name_with_unit'],
    columnFields: ['biz_date'],
    requiresSqlSummary: true,
    showRowTotals: false,
    showRowSubtotals: true,
    showColumnTotals: true,
    showColumnSubtotals: false,
    serverColumnPagination: true,
    hasServerColumnPageTuples: true,
  });

  expect(plan.map(item => item.queryId)).toEqual([
    'server_column_domain',
    'server_column_count',
    'leaf',
    'summary:row_total',
  ]);
});

it('keeps server column bootstrap to domain and count before page tuples exist', () => {
  const plan = buildCrosstabQueryPlan({
    rowFields: ['metric_name_with_unit'],
    columnFields: ['biz_date'],
    requiresSqlSummary: true,
    showRowTotals: false,
    showRowSubtotals: true,
    showColumnTotals: true,
    showColumnSubtotals: false,
    serverColumnPagination: true,
    hasServerColumnPageTuples: false,
  });

  expect(plan.map(item => item.queryId)).toEqual([
    'server_column_domain',
    'server_column_count',
  ]);
});
```

- [ ] **Step 2: Run failing summary-plan tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts --runInBand
```

Expected: fail because `requiresSqlSummary` is not accepted.

- [ ] **Step 3: Update query-plan argument name and gating**

In `summaryQueryPlan.ts`, replace `hasNonAdditiveSummary` with
`requiresSqlSummary`:

```ts
type BuildCrosstabQueryPlanArgs = {
  rowFields: string[];
  columnFields: string[];
  requiresSqlSummary: boolean;
  showRowTotals: boolean;
  showRowSubtotals: boolean;
  showColumnTotals: boolean;
  showColumnSubtotals: boolean;
  serverColumnPagination: boolean;
  hasServerColumnPageTuples?: boolean;
};
```

Then update the gate:

```ts
if (!args.requiresSqlSummary) {
  return plan;
}
```

Update every existing test fixture and source call site in the same commit from
`hasNonAdditiveSummary` to `requiresSqlSummary`.

- [ ] **Step 4: Run summary-plan tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts --runInBand
```

Expected: pass after updating existing test arguments.

- [ ] **Step 5: Commit Task 4**

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts
git commit -m "feat(crosstab): plan sql summaries for configured totals"
```

## Task 5: Route Sort Config and Full Row Totals Through buildQuery

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts` if dynamic resolution only returns bare dimensions
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`

- [ ] **Step 1: Add failing buildQuery tests**

Append tests that use `serverColumnPagination=true`, one row field, one dynamic
column field, and row-value summaries:

```ts
it('uses configured column sort in server column domain queries', () => {
  const queryContext = buildQuery(
    {
      datasource: '1__table',
      viz_type: 'crosstab-table',
      serverColumnPagination: true,
      columnPageSize: 12,
      row_limit: 10000,
      showColumnTotals: true,
      crosstabFieldConfig: {
        rows: [
          {
            field: 'metric_name_with_unit',
            sort: { by: 'metric_order', direction: 'asc', type: 'number' },
          },
        ],
        columns: [
          {
            field: 'biz_date',
            sort: { by: 'biz_date', direction: 'desc', type: 'date' },
          },
        ],
        metrics: [{ metric: '指标值', semantic: 'additive' }],
        rowValueSummaries: {
          field: 'metric_name_with_unit',
          values: [{ value: '销量（件）', semantic: 'additive' }],
        },
      },
    } as CrosstabFormData,
    { ownState: { currentColumnPage: 0 } },
  );

  expect(queryContext.queries[0].orderby).toEqual([['biz_date', false]]);
});

it('keeps server row total summary full range while leaf query is page filtered', () => {
  const queryContext = buildQuery(
    {
      datasource: '1__table',
      viz_type: 'crosstab-table',
      serverColumnPagination: true,
      columnPageSize: 2,
      row_limit: 10000,
      showColumnTotals: true,
      crosstabFieldConfig: {
        rows: [
          {
            field: 'metric_name_with_unit',
            sort: { by: 'metric_order', direction: 'asc', type: 'number' },
          },
        ],
        columns: [{ field: 'biz_date' }],
        metrics: [{ metric: '指标值', semantic: 'additive' }],
        rowValueSummaries: {
          field: 'metric_name_with_unit',
          values: [{ value: '销量（件）', semantic: 'additive' }],
        },
      },
    } as CrosstabFormData,
    {
      ownState: {
        currentColumnPage: 0,
        currentColumnPageSize: 2,
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 2,
        serverColumnPageTuples: [['2025-01-01'], ['2025-01-02']],
      },
    },
  );

  const leafQuery = queryContext.queries[2];
  const rowTotalQuery = queryContext.queries[3];

  expect(leafQuery.extras?.where).toContain('biz_date');
  expect(rowTotalQuery.columns).toEqual(['metric_name_with_unit']);
  expect(rowTotalQuery.extras?.where ?? '').not.toContain('biz_date');
});
```

- [ ] **Step 2: Run failing buildQuery tests**

Run:

```bash
cd superset-frontend
npm run test -- plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: fail because configured sort and additive summary planning are not
yet wired through `buildQuery`.

- [ ] **Step 3: Import helpers in buildQuery**

In `buildQuery.ts`, add imports:

```ts
import {
  getCrosstabColumnConfigs,
  getCrosstabRowConfigs,
  getCrosstabRowValueSummaries,
} from './fieldConfig';
import {
  buildDimensionOrderBy,
  getDimensionSortFields,
} from './sortConfig';
import { hasConfiguredSummarySemantics } from './metricSemantics';
```

After adding the imports above, run TypeScript or ESLint and remove any unused
imports reported in `buildQuery.ts`.

- [ ] **Step 4: Resolve configured dimensions and hidden sort fields**

Near the existing persisted row and column dimension resolution, derive configs:

```ts
const persistedRowConfigs = getCrosstabRowConfigs(formData);
const persistedColumnConfigs = getCrosstabColumnConfigs(formData);
const persistedRowDimensions = persistedRowConfigs.map(config => config.field);
const persistedColumnDimensions = persistedColumnConfigs.map(
  config => config.field,
);
```

After dynamic group-by resolution, derive effective configs by matching
resolved field labels. If the existing dynamic group-by resolver cannot
preserve configs, add a small helper in `dynamicGroupBy.ts` that applies the
same replacement to `DimensionFieldConfig[]` as it currently applies to
`QueryFormColumn[]`.

Use this shape:

```ts
const rowSortFields = getDimensionSortFields(effectiveRowConfigs);
const columnSortFields = getDimensionSortFields(effectiveColumnConfigs);
const rowValueSummaries = getCrosstabRowValueSummaries(formData);
```

- [ ] **Step 5: Replace non-additive-only summary gate**

Replace:

```ts
const hasNonAdditiveSummary = hasSqlSummarySemanticConfig(
  effectiveMetricConfigs,
  getCrosstabSemanticOverrides(formData),
);
```

With:

```ts
const requiresSqlSummary = hasConfiguredSummarySemantics(
  effectiveMetricConfigs,
  getCrosstabSemanticOverrides(formData),
  rowValueSummaries,
);
```

Pass `requiresSqlSummary` to `buildCrosstabQueryPlan`.

- [ ] **Step 6: Apply sort and hidden fields to server-column queries**

Update the server domain query:

```ts
const domainQuery: QueryObject = {
  ...baseQueryObject,
  columns: unique([...columnDimensions, ...columnSortFields]),
  metrics: [],
  is_timeseries: false,
  post_processing: [],
  orderby: buildDimensionOrderBy(effectiveColumnConfigs),
  row_limit: columnPageSize,
  row_offset: currentPage * columnPageSize,
};
```

Update leaf data query columns:

```ts
columns: unique([
  ...rowDimensions,
  ...rowSortFields,
  ...columnDimensions,
  ...columnSortFields,
]),
```

Keep summary `row_total` columns as row dimensions only. Row sorting should use
leaf row records, because `row_total` summary records are scoped to the summary
key and should not display hidden sort fields as dimensions.

- [ ] **Step 7: Remove additive-only legacy row-total append**

Delete the branch that appends the old extra `rowTotalQuery` for additive-only
server-column plans:

```ts
return hasNonAdditiveSummary
  ? plannedQueries
  : [
      ...plannedQueries,
      rowTotalQuery,
    ];
```

The query plan must be the only summary source:

```ts
return plannedQueries;
```

- [ ] **Step 8: Run buildQuery and summary tests**

Run:

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts \
  --runInBand
```

Expected: pass.

- [ ] **Step 9: Commit Task 5**

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
git commit -m "feat(crosstab): query configured sorts and full totals"
```

## Task 6: Apply Configured Column and Row Ordering in Transform and Engine

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`

- [ ] **Step 1: Add failing engine test for summary-backed additive row total**

Append to `engine.test.ts`:

```ts
it('uses SQL row total summary for additive totals instead of summing visible columns', () => {
  const rowTotal = buildSummaryResultMap({
    records: [{ metric_name_with_unit: '销量（件）', 指标值: 100 }],
    rowFields: ['metric_name_with_unit'],
    columnFields: [],
    metricFields: ['指标值'],
  });
  const result = buildCrosstab(
    [
      { metric_name_with_unit: '销量（件）', biz_date: '2025-01-01', 指标值: 10 },
      { metric_name_with_unit: '销量（件）', biz_date: '2025-01-02', 指标值: 20 },
    ],
    {
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date'],
      metricFields: ['指标值'],
      showColumnTotals: true,
      showRowTotals: false,
      showRowSubtotals: false,
      showColumnSubtotals: false,
      maxGeneratedColumns: 100,
      defaultRowExpandedDepth: 0,
      summaryValues: { rowTotal },
      resolveSemantic: () => 'additive',
    },
  );

  expect(result.rowData[0]).toMatchObject({
    [CROSSTAB_TOTAL_COLUMN_ID]: 100,
  });
});
```

- [ ] **Step 2: Add failing transformProps test for additive summary maps**

Append to `transformProps.test.ts`:

```ts
it('passes additive row total summary values into the engine', () => {
  const chartProps = new ChartProps<CrosstabFormData>({
    width: 800,
    height: 400,
    formData: {
      datasource: '1__table',
      viz_type: 'crosstab-table',
      showColumnTotals: true,
      crosstabFieldConfig: {
        rows: [{ field: 'metric_name_with_unit' }],
        columns: [{ field: 'biz_date' }],
        metrics: [{ metric: '指标值', semantic: 'additive' }],
        rowValueSummaries: {
          field: 'metric_name_with_unit',
          values: [{ value: '销量（件）', semantic: 'additive' }],
        },
      },
    },
    queriesData: [
      {
        data: [
          {
            metric_name_with_unit: '销量（件）',
            biz_date: '2025-01-01',
            指标值: 10,
          },
        ],
      },
      {
        data: [{ metric_name_with_unit: '销量（件）', 指标值: 100 }],
      },
    ],
    datasource: {
      verboseMap: {
        metric_name_with_unit: '指标',
        biz_date: '日期',
        指标值: '指标值',
      },
    },
    theme: supersetTheme,
  });

  const props = transformProps(chartProps);

  expect(props.rowData).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        metric_name_with_unit: '销量（件）',
        [CROSSTAB_TOTAL_COLUMN_ID]: 100,
      }),
    ]),
  );
});
```

- [ ] **Step 3: Run failing transform and engine tests**

Run:

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts \
  --runInBand
```

Expected: fail because additive row total still falls back to visible-column
summing or summary map indexing is not planned for additive totals.

- [ ] **Step 4: Wire row-value summaries into transform semantic resolver**

In `transformProps.ts`, import:

```ts
import { getCrosstabRowValueSummaries } from './fieldConfig';
```

When creating the semantic resolver, pass:

```ts
rowValueSummaries: getCrosstabRowValueSummaries(formData),
```

to `resolveMetricSemantic`.

- [ ] **Step 5: Build summary maps for additive totals**

In `transformProps.ts`, ensure the reconstructed query plan uses
`requiresSqlSummary`, not non-additive-only logic. The result must build
`summaryValues.rowTotal` whenever the query plan contains `summary:row_total`.

Call `buildSummaryResultMap` for every `summary` query-plan item exactly as the
current non-additive path does today. Do not add a special case that skips
additive metrics.

- [ ] **Step 6: Change engine total lookup to require SQL summary when provided by plan**

In `engine.ts`, update row-total logic so `addRowTotal` receives and uses
summary values regardless of semantic when `summaryValues.rowTotal` exists.
The intended behavior is:

```ts
const sqlRowTotal = getSqlRowTotal({
  row,
  metric,
  summaryValues,
  resolveSemantic,
  requireSummary: Boolean(summaryValues?.rowTotal),
});
```

Then `getSqlRowTotal` should:

```ts
if (requireSummary) {
  return getRequiredSummaryValue(summaryValues.rowTotal, {
    rowValues,
    columnValues: [],
    metric,
  });
}
```

Keep the existing non-additive requirement path for compatibility when a
specific summary surface is present.

- [ ] **Step 7: Sort column domains and row records**

In `domain.ts`, add an optional comparator argument to the domain builder that
can sort unique column tuples before column IDs are generated.

In `engine.ts`, accept optional row comparator through `CrosstabBuildOptions`,
then sort leaf rows before row hierarchy construction:

```ts
const sortedData = rowComparator ? [...data].sort(rowComparator) : data;
```

Use `sortedData` for row construction and leaf cell assignment.

- [ ] **Step 8: Run transform and engine tests**

Run:

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts \
  --runInBand
```

Expected: pass.

- [ ] **Step 9: Commit Task 6**

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts
git commit -m "feat(crosstab): render totals from sql summaries"
```

## Task 7: Update Production Slice Metadata Contract

**Files:**
- Create: `docs/superpowers/reports/slice-10-crosstab-dynamic-sort-summary-target-20260525.json`
- Create or modify deployment helper only if an existing script already exists under `docs/superpowers/reports/` or project tooling.

- [x] **Step 1: Inspect the current production backup source**

Run:

```bash
ls -1 docs/superpowers/reports/slice-10-*.json | tail -20
```

Expected: identify the latest slice 10 backup JSON to use as the base. Prefer a
V4 contract backup if it matches the current production chart; otherwise export
fresh production metadata before editing.

- [x] **Step 2: Create target metadata JSON**

Use a structured JSON editor, not manual string replacement. If `jq` is enough,
use:

```bash
base_slice="docs/superpowers/reports/slice-10-crosstab-v4-contract-reorg-backup-20260524165140.json"

jq '
  .params.serverColumnPagination = true
  | .params.columnPageSize = 98
  | .params.crosstabFieldConfig.rows[0].sort = {
      "by": "metric_order",
      "direction": "asc",
      "type": "number",
      "nulls": "last"
    }
  | .params.crosstabFieldConfig.columns =
      (.params.crosstabFieldConfig.columns | map(
        if .field == "biz_date" then . + {"sort": {"by": "biz_date", "direction": "asc", "type": "date", "nulls": "last"}}
        elif .field == "shop_name" then . + {"sort": {"by": "shop_name", "direction": "asc", "type": "string", "nulls": "last"}}
        elif .field == "country" then . + {"sort": {"by": "country", "direction": "asc", "type": "string", "nulls": "last"}}
        elif .field == "category_l1" then . + {"sort": {"by": "category_l1", "direction": "asc", "type": "string", "nulls": "last"}}
        elif .field == "category_l2" then . + {"sort": {"by": "category_l2", "direction": "asc", "type": "string", "nulls": "last"}}
        elif .field == "category_l3" then . + {"sort": {"by": "category_l3", "direction": "asc", "type": "string", "nulls": "last"}}
        elif .field == "parent_asin" then . + {"sort": {"by": "parent_asin", "direction": "asc", "type": "string", "nulls": "last"}}
        elif .field == "msku" then . + {"sort": {"by": "msku", "direction": "asc", "type": "string", "nulls": "last"}}
        else .
        end
      ))
  | .params.crosstabFieldConfig.rowValueSummaries = {
      "field": "metric_name_with_unit",
      "values": [
        {"value": "销量（件）", "semantic": "additive"},
        {"value": "销售额（金额）", "semantic": "additive"},
        {"value": "毛利率（%）", "semantic": "ratio", "formatString": ".2%"},
        {"value": "平均售价（金额）", "semantic": "average"},
        {"value": "买家运费（金额）", "semantic": "additive"},
        {"value": "促销折扣（金额）", "semantic": "additive"},
        {"value": "退款金额（金额）", "semantic": "additive"},
        {"value": "其他收入（金额）", "semantic": "additive"},
        {"value": "FBA库存赔偿（金额）", "semantic": "additive"},
        {"value": "平台费（金额）", "semantic": "additive"},
        {"value": "FBA发货费（金额）", "semantic": "additive"},
        {"value": "其他订单费用（金额）", "semantic": "additive"},
        {"value": "总仓储费（金额）", "semantic": "additive"},
        {"value": "广告花费（金额）", "semantic": "additive"},
        {"value": "推广费（金额）", "semantic": "additive"}
      ]
    }
' "$base_slice" \
  > docs/superpowers/reports/slice-10-crosstab-dynamic-sort-summary-target-20260525.json
```

Before applying this file to production, compare the `rowValueSummaries.values`
list with the exact distinct `metric_name_with_unit` values in the selected
production backup. If the backup contains more displayed rows, add them to this
same JSON file before Step 3.

- [x] **Step 3: Validate the target JSON**

Run:

```bash
jq '
  {
    serverColumnPagination: .params.serverColumnPagination,
    columnPageSize: .params.columnPageSize,
    row: .params.crosstabFieldConfig.rows[0],
    rowValueSummaryCount: (.params.crosstabFieldConfig.rowValueSummaries.values | length)
  }
' docs/superpowers/reports/slice-10-crosstab-dynamic-sort-summary-target-20260525.json
```

Expected:

```json
{
  "serverColumnPagination": true,
  "columnPageSize": 98,
  "rowValueSummaryCount": 15
}
```

The exact count may be higher if production has more displayed business rows.
Do not accept a count lower than the displayed row count.

- [x] **Step 4: Commit Task 7**

```bash
git add docs/superpowers/reports/slice-10-crosstab-dynamic-sort-summary-target-20260525.json
git commit -m "docs(crosstab): add production summary metadata target"
```

## Task 8: Run Focused Validation

**Files:**
- No source edits expected.

- [x] **Step 1: Run focused Jest suites**

Run:

```bash
cd superset-frontend
npm run test -- \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts \
  --runInBand
```

Expected: all listed suites pass.

- [x] **Step 2: Run TypeScript check**

Run:

```bash
cd superset-frontend
npm run type -- --pretty false
```

Expected: pass. If it fails on known unrelated baseline errors, capture the
first unrelated file path and continue only after changed-file tests pass.

- [x] **Step 3: Run pre-commit for changed files**

Run from repository root after staging intended changed files only:

```bash
uvx pre-commit run --files \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/sortConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts
```

Expected: pass or auto-fix only changed files. Re-run if auto-fixes occur.

- [x] **Step 4: Commit validation fixes if any**

If validation changed files, stage the same known file set used by pre-commit:

```bash
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/sortConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/sortConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts
git commit -m "test(crosstab): validate dynamic sort summaries"
```

If no files changed, do not create an empty commit.

## Task 9: Deploy and Production Acceptance

**Files:**
- Create: `docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-acceptance.md`
- Create screenshots under `docs/superpowers/reports/`

- [ ] **Step 1: Pre-deploy health check**

Run:

```bash
curl -fsS http://111.230.91.24:8088/health
```

Expected:

```text
OK
```

- [ ] **Step 2: Sync source and rebuild image using the existing production flow**

Use the established image-based flow for this repository and server:

```bash
# Document the exact sync/build/restart commands used in the acceptance report.
# The image tag remains:
# apache-superset-doris:6.0.0-zh-column-scheme-matrix
```

Expected: `apache-superset` container restarts and becomes healthy.

- [ ] **Step 3: Back up production slice 10 before metadata update**

Save the backup to:

```bash
timestamp=$(date +%Y%m%d%H%M%S)
remote_backup="/home/ubuntu/superset-docker/backups/slice-10-before-dynamic-sort-summary-${timestamp}.json"
```

Also copy a local evidence copy to:

```bash
local_backup="docs/superpowers/reports/slice-10-before-dynamic-sort-summary-${timestamp}.json"
```

- [ ] **Step 4: Apply target slice 10 metadata**

Apply `slice-10-crosstab-dynamic-sort-summary-target-20260525.json` to slice
10 using the existing production metadata update method. The update must set
both `params` and `query_context.form_data` consistently.

Expected metadata facts:

```text
serverColumnPagination=true
columnPageSize=98
groupbyRows=["metric_name_with_unit"]
metrics=["指标值"]
dynamic dimension defaults: 日期, 无, 无
row sort: metric_order asc
rowValueSummaries covers every displayed business row
```

- [ ] **Step 5: Verify runtime requests**

Open:

```text
http://111.230.91.24:8088/superset/dashboard/order-profit-msku-daily-dashboard/
```

Capture network evidence:

```text
domain/count queries run first
leaf query filters to current page column tuples
row_total summary query has no current page tuple filter
```

Expected: dashboard opens without browser unresponsiveness.

- [ ] **Step 6: Verify business display**

Check:

```text
dynamic column order follows configured sort
metric rows follow metric_order
总计 is full-range summary
additive rows and ratio/average rows both read summary results
native filters remain: 店铺, 国家, 分类, 父体
dimension 1 default: 日期
dimension 2 default: 无
dimension 3 default: 无
```

Save screenshots to:

```text
docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-dashboard.png
docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-network.png
```

- [ ] **Step 7: Write acceptance report**

Create `2026-05-25-crosstab-dynamic-sort-summary-acceptance.md` with:

```md
# Crosstab Dynamic Sort Summary Acceptance

Date: 2026-05-25

## Result

Accepted / Blocked

## Build

- Commit:
- Image:
- Container health:

## Slice 10 Metadata

- Backup:
- serverColumnPagination:
- columnPageSize:
- row field:
- metric:
- row sort:
- rowValueSummaries count:

## Runtime Evidence

- Dashboard URL:
- Domain/count:
- Leaf page filter:
- Row total summary scope:

## Business Display

- Dynamic column sort:
- Metric row order:
- 总计 scope:
- Native filters:
- Screenshots:

## Residual Risks

- List only real remaining risks.
```

- [ ] **Step 8: Commit acceptance evidence**

```bash
git add docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-acceptance.md \
  docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-dashboard.png \
  docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-network.png \
  docs/superpowers/reports/slice-10-before-dynamic-sort-summary-*.json
git commit -m "docs(crosstab): accept dynamic sort summary deployment"
```

## Final Verification Checklist

- [ ] `git status --short` shows no unintended staged files.
- [ ] Focused Jest suites pass.
- [ ] TypeScript check is passed or unrelated baseline failures are documented.
- [ ] Pre-commit changed-file run is passed.
- [ ] Production health returns `OK`.
- [ ] Container is running and healthy.
- [ ] Dashboard is responsive.
- [ ] `总计` is full-filter-range summary.
- [ ] Dynamic columns and business rows sort correctly.
- [ ] Acceptance report and screenshots are committed.
