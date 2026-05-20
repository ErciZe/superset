# Crosstab v2 Metric Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit crosstab metric semantics and SQL-backed summaries for row totals, row subtotals, column totals, column subtotals, and grand totals.

**Architecture:** Keep semantics, summary query planning, SQL summary result indexing, engine summary application, and React rendering in separate modules. The engine remains the structure builder; semantic validation and SQL summary lookup live outside the React layer.

**Tech Stack:** TypeScript, Jest, React Testing Library where renderer coverage is needed, Superset chart `buildQueryContext`, existing crosstab tuple encoding, AG Grid Community renderer.

---

## File Structure

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Add `MetricSemantic`, semantic overrides, summary query metadata, and optional summary maps.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts`
  - Resolve metric semantics from metric config plus row-value overrides.
  - Fail fast on unknown or unsupported summary semantics.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts`
  - Unit tests for additive, ratio, unknown, row-value overrides, and failure messages.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`
  - Build leaf, server-column, and summary query plan items with stable metadata.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts`
  - Query plan shape tests for additive-only, ratio overrides, server column pagination, and disabled summaries.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Delegate query list construction to `summaryQueryPlan.ts`.
  - Keep current server column pagination behavior while replacing magic summary indexes.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - Update row-total expectations and add summary query expectations.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts`
  - Convert SQL summary records into typed tuple-keyed maps and fail fast on required missing/non-numeric values.
- Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts`
  - Unit tests for row, column, subtotal, grand-total, missing-value, and non-numeric-value lookups.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
  - Accept summary context and choose additive frontend values or SQL summary values per semantic.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`
  - Add tests proving ratio summaries use injected SQL values and additive behavior remains stable.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Route `queriesData` through query plan metadata, build summary maps, and inject them into the engine.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - Add integration coverage for production-style `metric_name_with_unit` overrides.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx`
  - Add metric semantic controls and row-value override controls only after core behavior is tested.
- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`
  - Add config extraction tests for metric semantics and overrides.

## Task 1: Semantic Types And Resolver

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts`

- [ ] **Step 1: Write failing semantic resolver tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts` with:

```ts
import {
  ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC,
  resolveMetricSemantic,
  validateSummarySemantics,
} from '../../src/plugin/metricSemantics';

describe('crosstab metric semantics', () => {
  it('defaults metrics without semantics to unknown', () => {
    expect(
      resolveMetricSemantic({
        metric: '指标值',
        metricConfigs: [{ metric: '指标值' }],
      }),
    ).toBe('unknown');
  });

  it('uses the metric default semantic when no row override matches', () => {
    expect(
      resolveMetricSemantic({
        metric: 'amount',
        metricConfigs: [{ metric: 'amount', semantic: 'additive' }],
      }),
    ).toBe('additive');
  });

  it('uses row-value overrides for production metric rows', () => {
    expect(
      resolveMetricSemantic({
        metric: '指标值',
        row: { metric_name_with_unit: '毛利率（%）' },
        metricConfigs: [{ metric: '指标值', semantic: 'unknown' }],
        semanticOverrideField: 'metric_name_with_unit',
        semanticOverrides: [
          { value: '销售额（金额）', semantic: 'additive' },
          { value: '毛利率（%）', semantic: 'ratio' },
        ],
      }),
    ).toBe('ratio');
  });

  it('fails fast when summaries include an unknown semantic', () => {
    expect(() =>
      validateSummarySemantics([
        { metric: '指标值', semantic: 'unknown', summaryLabel: 'row total' },
      ]),
    ).toThrow(ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts --runInBand --silent
```

Expected: FAIL because `metricSemantics.ts` does not exist.

- [ ] **Step 3: Add semantic types**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`, add:

```ts
export type MetricSemantic =
  | 'unknown'
  | 'additive'
  | 'ratio'
  | 'average'
  | 'distinct';

export type MetricSemanticOverride = {
  value: DataRecordValue;
  semantic: MetricSemantic;
};
```

Update `MetricFieldConfig`:

```ts
export type MetricFieldConfig = {
  metric: QueryFormMetric;
  label?: string;
  semantic?: MetricSemantic;
};
```

Update `CrosstabFieldConfig`:

```ts
export type CrosstabFieldConfig = {
  rows?: DimensionFieldConfig[];
  columns?: DimensionFieldConfig[];
  metrics?: MetricFieldConfig[];
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};
```

- [ ] **Step 4: Implement the resolver**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts`:

```ts
import {
  DataRecord,
  DataRecordValue,
  getColumnLabel,
  getMetricLabel,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import type {
  MetricFieldConfig,
  MetricSemantic,
  MetricSemanticOverride,
} from '../types';

export const ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC =
  'Crosstab summaries require explicit metric semantics.';

type ResolveMetricSemanticArgs = {
  metric: QueryFormMetric;
  row?: DataRecord;
  metricConfigs?: MetricFieldConfig[];
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};

export type SummarySemanticRequirement = {
  metric: QueryFormMetric;
  semantic: MetricSemantic;
  summaryLabel: string;
};

function metricKey(metric: QueryFormMetric): string {
  return getMetricLabel(metric);
}

function overrideKey(value: DataRecordValue): DataRecordValue {
  return value;
}

export function resolveMetricSemantic({
  metric,
  row,
  metricConfigs = [],
  semanticOverrideField,
  semanticOverrides = [],
}: ResolveMetricSemanticArgs): MetricSemantic {
  const key = metricKey(metric);
  const defaultSemantic =
    metricConfigs.find(item => metricKey(item.metric) === key)?.semantic ??
    'unknown';
  const overrideField = semanticOverrideField
    ? getColumnLabel(semanticOverrideField)
    : undefined;

  if (!overrideField || !row || !(overrideField in row)) {
    return defaultSemantic;
  }

  const rowValue = overrideKey(row[overrideField]);
  return (
    semanticOverrides.find(item => Object.is(item.value, rowValue))?.semantic ??
    defaultSemantic
  );
}

export function isSqlSummarySemantic(semantic: MetricSemantic): boolean {
  return (
    semantic === 'ratio' ||
    semantic === 'average' ||
    semantic === 'distinct'
  );
}

export function validateSummarySemantics(
  requirements: SummarySemanticRequirement[],
): void {
  const unknown = requirements.find(item => item.semantic === 'unknown');
  if (unknown) {
    throw new Error(
      `${ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC} Metric "${metricKey(
        unknown.metric,
      )}" is unknown for ${unknown.summaryLabel}.`,
    );
  }
}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 6: Commit semantic contract**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts
git commit -m "feat: add crosstab metric semantics"
```

## Task 2: Summary Query Plan

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`

- [ ] **Step 1: Write failing query plan tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts`:

```ts
import { buildCrosstabQueryPlan } from '../../src/plugin/summaryQueryPlan';

describe('crosstab summary query plan', () => {
  it('keeps one leaf query when all summaries are additive-only', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      metricFields: ['指标值'],
      hasNonAdditiveSummary: false,
      showRowTotals: true,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: true,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toEqual(['leaf']);
  });

  it('adds full SQL summary plan for non-additive summaries', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      metricFields: ['指标值'],
      hasNonAdditiveSummary: true,
      showRowTotals: true,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: true,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'leaf',
      'summary:row_total',
      'summary:row_subtotal_cells:rowDepth=1',
      'summary:row_subtotal_total:rowDepth=1',
      'summary:column_total',
      'summary:column_subtotal_cells:columnDepth=1',
      'summary:column_subtotal_total:columnDepth=1',
      'summary:grand_total',
    ]);
  });

  it('preserves server column pagination bootstrap queries', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name', 'country'],
      metricFields: ['指标值'],
      hasNonAdditiveSummary: true,
      showRowTotals: true,
      showRowSubtotals: false,
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
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts --runInBand --silent
```

Expected: FAIL because `summaryQueryPlan.ts` does not exist.

- [ ] **Step 3: Add query plan types**

In `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`, add:

```ts
export type CrosstabQueryRole =
  | 'leaf'
  | 'server_column_domain'
  | 'server_column_count'
  | 'summary';

export type CrosstabSummaryKind =
  | 'row_total'
  | 'row_subtotal_cells'
  | 'row_subtotal_total'
  | 'column_total'
  | 'column_subtotal_cells'
  | 'column_subtotal_total'
  | 'grand_total';

export type CrosstabQueryPlanItem = {
  queryId: string;
  role: CrosstabQueryRole;
  summaryKind?: CrosstabSummaryKind;
  rowDepth?: number;
  columnDepth?: number;
};
```

- [ ] **Step 4: Implement query plan construction**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts`:

```ts
import type { CrosstabQueryPlanItem } from '../types';

type BuildCrosstabQueryPlanArgs = {
  rowFields: string[];
  columnFields: string[];
  metricFields: string[];
  hasNonAdditiveSummary: boolean;
  showRowTotals: boolean;
  showRowSubtotals: boolean;
  showColumnTotals: boolean;
  showColumnSubtotals: boolean;
  serverColumnPagination: boolean;
  hasServerColumnPageTuples?: boolean;
};

function summary(
  queryId: string,
  item: Omit<CrosstabQueryPlanItem, 'queryId' | 'role'>,
): CrosstabQueryPlanItem {
  return { queryId, role: 'summary', ...item };
}

export function buildCrosstabQueryPlan({
  rowFields,
  columnFields,
  hasNonAdditiveSummary,
  showRowTotals,
  showRowSubtotals,
  showColumnTotals,
  showColumnSubtotals,
  serverColumnPagination,
  hasServerColumnPageTuples = false,
}: BuildCrosstabQueryPlanArgs): CrosstabQueryPlanItem[] {
  if (serverColumnPagination && !hasServerColumnPageTuples) {
    return [
      { queryId: 'server_column_domain', role: 'server_column_domain' },
      { queryId: 'server_column_count', role: 'server_column_count' },
    ];
  }

  const plan: CrosstabQueryPlanItem[] = [
    ...(serverColumnPagination
      ? [
          { queryId: 'server_column_domain', role: 'server_column_domain' },
          { queryId: 'server_column_count', role: 'server_column_count' },
        ]
      : []),
    { queryId: 'leaf', role: 'leaf' },
  ];

  if (!hasNonAdditiveSummary) {
    return plan;
  }

  if (showRowTotals) {
    plan.push(summary('summary:row_total', { summaryKind: 'row_total' }));
  }

  if (showRowSubtotals) {
    rowFields.slice(0, -1).forEach((_, index) => {
      const rowDepth = index + 1;
      plan.push(
        summary(`summary:row_subtotal_cells:rowDepth=${rowDepth}`, {
          summaryKind: 'row_subtotal_cells',
          rowDepth,
        }),
        summary(`summary:row_subtotal_total:rowDepth=${rowDepth}`, {
          summaryKind: 'row_subtotal_total',
          rowDepth,
        }),
      );
    });
  }

  if (showColumnTotals) {
    plan.push(summary('summary:column_total', { summaryKind: 'column_total' }));
  }

  if (showColumnSubtotals) {
    columnFields.slice(0, -1).forEach((_, index) => {
      const columnDepth = index + 1;
      plan.push(
        summary(`summary:column_subtotal_cells:columnDepth=${columnDepth}`, {
          summaryKind: 'column_subtotal_cells',
          columnDepth,
        }),
        summary(`summary:column_subtotal_total:columnDepth=${columnDepth}`, {
          summaryKind: 'column_subtotal_total',
          columnDepth,
        }),
      );
    });
  }

  if (showRowTotals || showColumnTotals) {
    plan.push(summary('summary:grand_total', { summaryKind: 'grand_total' }));
  }

  return plan;
}
```

- [ ] **Step 5: Run the query plan test and verify it passes**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 6: Refactor `buildQuery.ts` to use the plan**

Keep the existing query-object details, but replace hard-coded return arrays with plan-driven construction. The first integration should preserve current behavior when no semantic config exists by treating the chart as additive-only until Task 5 wires validation:

```ts
const queryPlan = buildCrosstabQueryPlan({
  rowFields: rowDimensions as string[],
  columnFields: columnDimensions as string[],
  metricFields: metrics.map(metric => String(metric)),
  hasNonAdditiveSummary: false,
  showRowTotals: formData.showRowTotals ?? true,
  showRowSubtotals: formData.showRowSubtotals ?? true,
  showColumnTotals: formData.showColumnTotals ?? true,
  showColumnSubtotals: formData.showColumnSubtotals ?? false,
  serverColumnPagination: Boolean(formData.serverColumnPagination),
  hasServerColumnPageTuples: pageTuples.length > 0,
});
```

Add a dispatcher inside `buildQuery.ts` so each plan item maps to one query object:

```ts
function queryForPlanItem(item: CrosstabQueryPlanItem): QueryObject {
  if (item.role === 'server_column_domain') {
    return domainQuery;
  }

  if (item.role === 'server_column_count') {
    return countQuery;
  }

  if (item.role === 'leaf') {
    return dataQuery;
  }

  if (item.summaryKind === 'row_total') {
    return rowTotalQuery;
  }

  throw new Error(`Unsupported crosstab query plan item: ${item.queryId}`);
}
```

For Task 2 this dispatcher only needs the existing query shapes. Task 5 extends it with the remaining summary query objects after semantic validation is wired.

- [ ] **Step 7: Run existing buildQuery regression tests**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand --silent
```

Expected: PASS with current expectations unchanged.

- [ ] **Step 8: Commit query plan layer**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
git commit -m "refactor: add crosstab summary query plan"
```

## Task 3: SQL Summary Result Maps

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts`

- [ ] **Step 1: Write failing summary map tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts`:

```ts
import {
  ERR_CROSSTAB_MISSING_SQL_SUMMARY,
  ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY,
  buildSummaryResultMap,
  getRequiredSummaryValue,
} from '../../src/plugin/summaryResults';

describe('crosstab summary results', () => {
  it('indexes row and column summary values with typed tuple keys', () => {
    const map = buildSummaryResultMap({
      records: [
        {
          metric_name_with_unit: '毛利率（%）',
          biz_date: '2025-01-01',
          指标值: -9.5145,
        },
      ],
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date'],
      metricFields: ['指标值'],
      summaryKind: 'row_subtotal_cells',
    });

    expect(
      getRequiredSummaryValue(map, {
        rowValues: ['毛利率（%）'],
        columnValues: ['2025-01-01'],
        metric: '指标值',
      }),
    ).toBe(-9.5145);
  });

  it('fails fast when a required summary value is missing', () => {
    const map = buildSummaryResultMap({
      records: [],
      rowFields: ['metric_name_with_unit'],
      columnFields: [],
      metricFields: ['指标值'],
      summaryKind: 'row_total',
    });

    expect(() =>
      getRequiredSummaryValue(map, {
        rowValues: ['毛利率（%）'],
        columnValues: [],
        metric: '指标值',
      }),
    ).toThrow(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  });

  it('fails fast when a SQL summary value is not numeric', () => {
    expect(() =>
      buildSummaryResultMap({
        records: [{ metric_name_with_unit: '毛利率（%）', 指标值: 'bad' }],
        rowFields: ['metric_name_with_unit'],
        columnFields: [],
        metricFields: ['指标值'],
        summaryKind: 'row_total',
      }),
    ).toThrow(ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY);
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts --runInBand --silent
```

Expected: FAIL because `summaryResults.ts` does not exist.

- [ ] **Step 3: Implement summary result maps**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts`:

```ts
import { DataRecord, DataRecordValue, QueryFormMetric } from '@superset-ui/core';
import { encodeTuple } from '../crosstab/keys';
import type { CrosstabSummaryKind } from '../types';

export const ERR_CROSSTAB_MISSING_SQL_SUMMARY =
  'Crosstab SQL summary result is missing.';
export const ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY =
  'Crosstab SQL summary value must be numeric.';

export type SummaryResultMap = Map<string, number | null>;

type BuildSummaryResultMapArgs = {
  records: DataRecord[];
  rowFields: string[];
  columnFields: string[];
  metricFields: string[];
  summaryKind: CrosstabSummaryKind;
};

type SummaryLookupKey = {
  rowValues: DataRecordValue[];
  columnValues: DataRecordValue[];
  metric: QueryFormMetric;
};

function metricKey(metric: QueryFormMetric): string {
  return String(metric);
}

function summaryKey({
  rowValues,
  columnValues,
  metric,
}: SummaryLookupKey): string {
  return [
    encodeTuple(rowValues),
    encodeTuple(columnValues),
    metricKey(metric),
  ].join('\u001e');
}

function numericSummaryValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY);
  }
  return value;
}

export function buildSummaryResultMap({
  records,
  rowFields,
  columnFields,
  metricFields,
}: BuildSummaryResultMapArgs): SummaryResultMap {
  return records.reduce<SummaryResultMap>((map, record) => {
    metricFields.forEach(metric => {
      map.set(
        summaryKey({
          rowValues: rowFields.map(field => record[field]),
          columnValues: columnFields.map(field => record[field]),
          metric,
        }),
        numericSummaryValue(record[metric]),
      );
    });
    return map;
  }, new Map());
}

export function getRequiredSummaryValue(
  map: SummaryResultMap,
  key: SummaryLookupKey,
): number | null {
  const encoded = summaryKey(key);
  if (!map.has(encoded)) {
    throw new Error(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  }
  return map.get(encoded) ?? null;
}
```

- [ ] **Step 4: Run focused summary result tests**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 5: Commit summary result maps**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts
git commit -m "feat: index crosstab sql summaries"
```

## Task 4: Engine Summary Injection

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`

- [ ] **Step 1: Write failing engine tests for SQL summary injection**

Append to `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`:

```ts
it('uses injected SQL values for non-additive row and grand totals', () => {
  const result = buildCrosstab(
    [
      {
        metric_name_with_unit: '毛利率（%）',
        biz_date: '2025-01-01',
        指标值: 29.9745,
      },
      {
        metric_name_with_unit: '毛利率（%）',
        biz_date: '2025-01-02',
        指标值: -20,
      },
    ],
    {
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date'],
      metricFields: ['指标值'],
      showRowSubtotals: false,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
      summaryValues: {
        rowTotal: new Map([
          ['string:6:毛利率（%）\u001e\u001e指标值', -9.5145],
        ]),
        grandTotal: new Map([['\u001e\u001e指标值', -9.5145]]),
      },
      resolveSemantic: () => 'ratio',
    },
  );

  const leaf = result.rowData.find(
    row => row.metric_name_with_unit === '毛利率（%）',
  );
  const grandTotal = result.rowData.find(
    row => row.__crosstab_row_type === 'grand_total',
  );

  expect(leaf?.__crosstab_total).toBe(-9.5145);
  expect(grandTotal?.__crosstab_total).toBe(-9.5145);
});
```

- [ ] **Step 2: Run engine test and verify it fails**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts --runInBand --silent
```

Expected: FAIL because `summaryValues` and `resolveSemantic` are not accepted by `buildCrosstab`.

- [ ] **Step 3: Add engine options**

In `types.ts`, extend `CrosstabBuildOptions`:

```ts
export type CrosstabSummaryValues = {
  rowTotal?: Map<string, number | null>;
  rowSubtotalCells?: Map<string, number | null>;
  rowSubtotalTotal?: Map<string, number | null>;
  columnTotal?: Map<string, number | null>;
  columnSubtotalCells?: Map<string, number | null>;
  columnSubtotalTotal?: Map<string, number | null>;
  grandTotal?: Map<string, number | null>;
};

export type ResolveCrosstabMetricSemantic = (args: {
  row: DataRecord;
  metric: string;
}) => MetricSemantic;
```

Add to `CrosstabBuildOptions`:

```ts
  summaryValues?: CrosstabSummaryValues;
  resolveSemantic?: ResolveCrosstabMetricSemantic;
```

- [ ] **Step 4: Implement engine summary selection**

In `engine.ts`, add these helpers near existing total helpers:

```ts
function isSqlSemantic(semantic: MetricSemantic | undefined): boolean {
  return (
    semantic === 'ratio' ||
    semantic === 'average' ||
    semantic === 'distinct'
  );
}

function summaryValueOrAdditive({
  additiveValue,
  metric,
  row,
  rowValues,
  columnValues,
  resolveSemantic,
  summaryMap,
}: {
  additiveValue: number | null;
  metric: string;
  row: DataRecord;
  rowValues: DataRecordValue[];
  columnValues: DataRecordValue[];
  resolveSemantic?: ResolveCrosstabMetricSemantic;
  summaryMap?: Map<string, number | null>;
}): number | null {
  const semantic = resolveSemantic?.({ row, metric }) ?? 'additive';

  if (!isSqlSemantic(semantic)) {
    return additiveValue;
  }

  if (!summaryMap) {
    throw new Error('Crosstab SQL summary result is missing.');
  }

  return getRequiredSummaryValue(summaryMap, {
    rowValues,
    columnValues,
    metric,
  });
}
```

Update row total, grand total, row subtotal cell, column total, and column subtotal paths to call `summaryValueOrAdditive`. Additive metrics keep the existing `addNumeric` result. SQL semantics read from the injected summary map.

- [ ] **Step 5: Run engine tests**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 6: Commit engine injection**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts
git commit -m "feat: inject sql summaries into crosstab engine"
```

## Task 5: Transform Props Integration

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`

- [ ] **Step 1: Write failing transform test for production-style ratio summaries**

Append to `transformProps.test.ts`:

```ts
it('uses SQL summaries for production row-value ratio overrides', () => {
  const chartProps = new ChartProps<CrosstabFormData>({
    width: 800,
    height: 400,
    formData: {
      datasource: '7__table',
      viz_type: 'crosstab_table',
      crosstabFieldConfig: {
        rows: [{ field: 'metric_name_with_unit' }],
        columns: [{ field: 'biz_date' }],
        metrics: [{ metric: '指标值', semantic: 'unknown' }],
        semanticOverrideField: 'metric_name_with_unit',
        semanticOverrides: [
          { value: '销售额（金额）', semantic: 'additive' },
          { value: '毛利率（%）', semantic: 'ratio' },
        ],
      },
      showRowTotals: true,
      showColumnTotals: true,
      showRowSubtotals: false,
      showColumnSubtotals: false,
    },
    queriesData: [
      {
        data: [
          {
            metric_name_with_unit: '毛利率（%）',
            biz_date: '2025-01-01',
            指标值: 29.9745,
          },
          {
            metric_name_with_unit: '毛利率（%）',
            biz_date: '2025-01-02',
            指标值: -20,
          },
        ],
      },
      {
        data: [{ metric_name_with_unit: '毛利率（%）', 指标值: -9.5145 }],
      },
      {
        data: [
          { biz_date: '2025-01-01', 指标值: -9.5145 },
          { biz_date: '2025-01-02', 指标值: -9.5145 },
        ],
      },
      {
        data: [{ 指标值: -9.5145 }],
      },
    ],
    theme: supersetTheme,
  });

  const props = transformProps(chartProps);
  const ratioRow = props.rowData.find(
    row => row.metric_name_with_unit === '毛利率（%）',
  );
  const grandTotal = props.rowData.find(
    row => row.__crosstab_row_type === 'grand_total',
  );

  expect(ratioRow?.__crosstab_total).toBe(-9.5145);
  expect(grandTotal?.__crosstab_total).toBe(-9.5145);
});
```

- [ ] **Step 2: Run transform test and verify it fails**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand --silent
```

Expected: FAIL because `transformProps` does not route SQL summary maps.

- [ ] **Step 3: Add field config extraction helpers**

In `fieldConfig.ts`, add:

```ts
export function getCrosstabMetricConfigs(formData: CrosstabFormData) {
  return formData.crosstabFieldConfig?.metrics ?? [];
}

export function getCrosstabSemanticOverrideField(formData: CrosstabFormData) {
  return formData.crosstabFieldConfig?.semanticOverrideField;
}

export function getCrosstabSemanticOverrides(formData: CrosstabFormData) {
  return formData.crosstabFieldConfig?.semanticOverrides ?? [];
}
```

- [ ] **Step 4: Wire summary maps in `transformProps.ts`**

In `transformProps.ts`, reconstruct the query plan from form data and own state, then split `queriesData` by plan item. Build SQL summary maps with `buildSummaryResultMap` and pass them into `buildCrosstab`:

```ts
const queryPlan = buildCrosstabQueryPlan({
  rowFields,
  columnFields,
  metricFields,
  hasNonAdditiveSummary,
  showRowTotals: formData.showRowTotals ?? true,
  showRowSubtotals: formData.showRowSubtotals ?? true,
  showColumnTotals: formData.showColumnTotals ?? true,
  showColumnSubtotals: formData.showColumnSubtotals ?? false,
  serverColumnPagination,
  hasServerColumnPageTuples: Boolean(
    (ownState as CrosstabOwnState | undefined)?.serverColumnPageTuples?.length,
  ),
});
```

Then pass:

```ts
summaryValues,
resolveSemantic: ({ row, metric }) =>
  resolveMetricSemantic({
    metric,
    row,
    metricConfigs: getCrosstabMetricConfigs(crosstabFormData),
    semanticOverrideField: getCrosstabSemanticOverrideField(crosstabFormData),
    semanticOverrides: getCrosstabSemanticOverrides(crosstabFormData),
  }),
```

- [ ] **Step 5: Run transform tests**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 6: Run buildQuery tests after transform integration**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 7: Commit transform integration**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts
git commit -m "feat: route crosstab sql summaries"
```

## Task 6: UI Configuration And Validation

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`

- [ ] **Step 1: Add field config tests for semantic config persistence**

Append to `fieldConfig.test.ts`:

```ts
it('reads metric semantics and row-value overrides from crosstab field config', () => {
  const formData = {
    crosstabFieldConfig: {
      metrics: [{ metric: '指标值', semantic: 'unknown' }],
      semanticOverrideField: 'metric_name_with_unit',
      semanticOverrides: [
        { value: '销售额（金额）', semantic: 'additive' },
        { value: '毛利率（%）', semantic: 'ratio' },
      ],
    },
  } as never;

  expect(getCrosstabMetricConfigs(formData)).toEqual([
    { metric: '指标值', semantic: 'unknown' },
  ]);
  expect(getCrosstabSemanticOverrideField(formData)).toBe(
    'metric_name_with_unit',
  );
  expect(getCrosstabSemanticOverrides(formData)).toEqual([
    { value: '销售额（金额）', semantic: 'additive' },
    { value: '毛利率（%）', semantic: 'ratio' },
  ]);
});
```

- [ ] **Step 2: Run field config tests and verify failure if helpers are missing**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts --runInBand --silent
```

Expected: PASS if Task 5 already added helpers; FAIL if imports need to be added.

- [ ] **Step 3: Add semantic controls conservatively**

Update `CrosstabFieldConfigControl.tsx` metric rows to include a semantic selector with these fixed values:

```ts
const SEMANTIC_OPTIONS: MetricSemantic[] = [
  'unknown',
  'additive',
  'ratio',
  'average',
  'distinct',
];
```

When a metric semantic changes, update only that metric item:

```ts
const updateMetricSemantic = useCallback(
  (metric: QueryFormMetric, semantic: MetricSemantic) => {
    const key = getMetricLabel(metric);
    onChange({
      ...config,
      metrics: config.metrics.map(item =>
        getMetricLabel(item.metric) === key ? { ...item, semantic } : item,
      ),
    });
  },
  [config, onChange],
);
```

- [ ] **Step 4: Add override editing only as structured text**

For v2, keep row-value overrides as a small structured JSON text area rather than adding a large custom table editor. Parse JSON into `semanticOverrides` and fail visibly on invalid JSON. Use this shape:

```json
[
  { "value": "销售额（金额）", "semantic": "additive" },
  { "value": "毛利率（%）", "semantic": "ratio" }
]
```

- [ ] **Step 5: Run UI-related tests**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts --runInBand --silent
```

Expected: PASS.

- [ ] **Step 6: Commit UI config**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts
git commit -m "feat: configure crosstab metric semantics"
```

## Task 7: Full Regression And Production Acceptance Evidence

**Files:**
- Modify: `docs/superpowers/reports/2026-05-20-crosstab-v1-acceptance-baseline.md` only if it needs a v2 follow-up link.
- Create: `docs/superpowers/reports/2026-05-20-crosstab-v2-metric-semantics-acceptance.md`

- [ ] **Step 1: Run focused new test files**

Run:

```bash
npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/metricSemantics.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/summaryQueryPlan.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/summaryResults.test.ts \
  --runInBand --silent
```

Expected: PASS.

- [ ] **Step 2: Run full crosstab plugin tests**

Run:

```bash
npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
```

Expected: 0 errors. Existing warnings may remain if unrelated to the v2 changes.

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run type -- --pretty false
```

Expected: PASS.

- [ ] **Step 5: Run production frontend build**

Run:

```bash
BABEL_ENV=testableProduction npm run build
```

Expected: webpack compiles successfully. Existing webpack cache or bundle-size warnings are acceptable only if no new error is introduced.

- [ ] **Step 6: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 7: Create v2 acceptance report**

Create `docs/superpowers/reports/2026-05-20-crosstab-v2-metric-semantics-acceptance.md` with:

```md
# Crosstab v2 Metric Semantics Acceptance

Date: 2026-05-20
Status: pending production deployment

## Scope

- Metric semantics: additive, ratio, average, distinct, unknown.
- Row-value overrides for `metric_name_with_unit`.
- SQL-backed row total, row subtotal, column total, column subtotal, and grand total.

## Production Sample Mapping

| Row value | Semantic |
| --- | --- |
| 销售额（金额） | additive |
| 毛利率（%） | ratio |

## Validation Commands

- `npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent`
- `npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test`
- `npm run type -- --pretty false`
- `BABEL_ENV=testableProduction npm run build`
- `git diff --check`

## Runtime Evidence

Production deployment is not executed by this implementation plan. If the user approves a deployment task, record the browser screenshot path, public `/health` response, and production SQL sample in a separate deployment report.
```

- [ ] **Step 8: Commit final acceptance docs**

```bash
git add docs/superpowers/reports/2026-05-20-crosstab-v2-metric-semantics-acceptance.md
git commit -m "docs: record crosstab v2 semantics acceptance"
```

## Self-Review Checklist

- [ ] Spec coverage: metric semantics, row-value overrides, SQL summaries, query metadata, module boundaries, fail-fast behavior, and production acceptance each have a task.
- [ ] Placeholder scan: no task uses `TBD`, `TODO`, vague edge-case language, or references to undefined functions without defining them in an earlier task.
- [ ] Type consistency: `MetricSemantic`, `MetricSemanticOverride`, `CrosstabQueryPlanItem`, `CrosstabSummaryKind`, and `SummaryResultMap` names are consistent across tasks.
- [ ] Scope check: this plan implements crosstab v2 summary semantics only; parameters, formula language, dataset metadata migration, and backend API redesign remain outside scope.
