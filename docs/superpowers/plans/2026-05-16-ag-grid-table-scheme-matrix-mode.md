# AG Grid Table Scheme Matrix Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional matrix mode to `Table V2 with Column Schemes`, including row/column/value controls, pure long-to-wide transform, query inclusion, column scheme compatibility, and an explicit default-off column settings toggle.

**Architecture:** Keep the feature inside `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme`. Matrix mode wraps the official AG Grid Table plugin at the same extension points the scheme plugin already uses: `controlPanel`, `buildQuery`, `transformProps`, and chart rendering. The transform is a pure TypeScript module with focused Jest coverage before UI wiring.

**Tech Stack:** Superset frontend, TypeScript, React 17, AG Grid Table V2 plugin, `@superset-ui/core`, `@superset-ui/chart-controls`, Jest.

---

## File Structure

- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/types.ts`
  Defines matrix form-data fields, matrix calculation enum, transform input/output types, and fail-fast error constants.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/matrixTransform.ts`
  Pure long-form-to-wide transform. No React, no Superset runtime side effects.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/buildQuery.ts`
  Wrapper around official table `buildQuery` that injects matrix rows, columns, sort field, unit field, and selected metric.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/controlPanel.tsx`
  Wrapper around official table `controlPanel` that appends matrix controls and the default-off column settings toggle.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts`
  Use local `controlPanel` and local matrix-aware `buildQuery`.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/transformProps.ts`
  Apply `matrixTransform` only when `matrix_mode_enabled` is true, otherwise preserve official behavior.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/AgGridTableSchemeChart.tsx`
  Pass `columnSettingsEnabled` into the toolbar.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/columnViewSchemes/ColumnViewSchemeToolbar.tsx`
  Hide the `列设置` button unless the explicit toggle is enabled.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/columnViewSchemes/state.ts`
  Ensure generated matrix columns participate in the existing column signature and reconciliation flow without special persistence.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts`
  Unit tests for transform, calculations, totals, sorting, units, and fail-fast validation.
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts`
  Unit tests for query injection and disabled-mode preservation.
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/columnViewSchemes/state.test.ts`
  Add generated matrix column compatibility cases.

## Shared Naming Contract

Use these form-data keys exactly:

```ts
matrix_mode_enabled?: boolean;
matrix_rows?: QueryFormColumn[];
matrix_columns?: QueryFormColumn[];
matrix_value?: QueryFormMetric | QueryFormMetric[] | null;
matrix_row_sort?: QueryFormColumn | QueryFormColumn[] | null;
matrix_row_sort_desc?: boolean;
matrix_unit_field?: QueryFormColumn | QueryFormColumn[] | null;
matrix_show_total?: boolean;
matrix_total_position?: 'left' | 'right';
matrix_value_calculation?: 'raw' | 'contribution' | 'row_contribution' | 'row_rank';
matrix_max_generated_columns?: number;
column_settings_enabled?: boolean;
```

Use these generated column IDs exactly:

```ts
export const MATRIX_TOTAL_COL_ID = '__matrix_total';
export const MATRIX_COL_PREFIX = '__matrix_col__';
```

### Task 1: Matrix Transform Tests

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/types.ts`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/matrixTransform.ts`

- [ ] **Step 1: Add failing Jest tests for the transform**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts` with:

```ts
import {
  MATRIX_TOTAL_COL_ID,
  matrixTransform,
} from '../../src/matrix/matrixTransform';

const records = [
  { metric_name: 'Sales', metric_order: 2, biz_date: '2026-05-01', value: 10, unit: '件' },
  { metric_name: 'Sales', metric_order: 2, biz_date: '2026-05-01', value: 5, unit: '件' },
  { metric_name: 'Sales', metric_order: 2, biz_date: '2026-05-02', value: 15, unit: '件' },
  { metric_name: 'Profit %', metric_order: 1, biz_date: '2026-05-01', value: 9.79, unit: '%' },
  { metric_name: 'Profit %', metric_order: 1, biz_date: '2026-05-02', value: null, unit: '%' },
];

describe('matrixTransform', () => {
  it('converts long records to wide matrix rows with left total', () => {
    const result = matrixTransform(records, {
      rows: ['metric_name'],
      columns: ['biz_date'],
      value: 'value',
      rowSort: 'metric_order',
      rowSortDesc: false,
      unitField: 'unit',
      showTotal: true,
      totalPosition: 'left',
      calculation: 'raw',
      maxGeneratedColumns: 10,
    });

    expect(result.generatedColumnIds).toEqual([
      '__matrix_col__2026-05-01',
      '__matrix_col__2026-05-02',
    ]);
    expect(result.columns.map(column => column.key)).toEqual([
      'metric_name',
      MATRIX_TOTAL_COL_ID,
      '__matrix_col__2026-05-01',
      '__matrix_col__2026-05-02',
    ]);
    expect(result.data).toEqual([
      {
        metric_name: 'Profit %',
        [MATRIX_TOTAL_COL_ID]: '9.79%',
        '__matrix_col__2026-05-01': '9.79%',
        '__matrix_col__2026-05-02': null,
      },
      {
        metric_name: 'Sales',
        [MATRIX_TOTAL_COL_ID]: '30 件',
        '__matrix_col__2026-05-01': '15 件',
        '__matrix_col__2026-05-02': '15 件',
      },
    ]);
  });

  it('supports contribution, row contribution, and dense row rank', () => {
    const base = {
      rows: ['metric_name'],
      columns: ['biz_date'],
      value: 'value',
      showTotal: false,
      totalPosition: 'right' as const,
      maxGeneratedColumns: 10,
    };

    expect(
      matrixTransform(records, { ...base, calculation: 'contribution' }).data[1],
    ).toMatchObject({
      '__matrix_col__2026-05-01': 0.375,
      '__matrix_col__2026-05-02': 0.375,
    });
    expect(
      matrixTransform(records, { ...base, calculation: 'row_contribution' })
        .data[1],
    ).toMatchObject({
      '__matrix_col__2026-05-01': 0.5,
      '__matrix_col__2026-05-02': 0.5,
    });
    expect(
      matrixTransform(records, { ...base, calculation: 'row_rank' }).data[1],
    ).toMatchObject({
      '__matrix_col__2026-05-01': 1,
      '__matrix_col__2026-05-02': 1,
    });
  });

  it('fails fast for invalid config and excessive generated columns', () => {
    expect(() =>
      matrixTransform(records, {
        rows: [],
        columns: ['biz_date'],
        value: 'value',
        showTotal: true,
        totalPosition: 'left',
        calculation: 'raw',
        maxGeneratedColumns: 10,
      }),
    ).toThrow('Matrix rows, columns, and value are required.');

    expect(() =>
      matrixTransform(records, {
        rows: ['metric_name'],
        columns: ['biz_date'],
        value: 'value',
        showTotal: true,
        totalPosition: 'left',
        calculation: 'raw',
        maxGeneratedColumns: 1,
      }),
    ).toThrow('Matrix generated 2 columns, which exceeds the limit of 1.');
  });
});
```

- [ ] **Step 2: Run the matrix transform tests and verify they fail**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts --runInBand
```

Expected: FAIL because `../../src/matrix/matrixTransform` does not exist.

- [ ] **Step 3: Add matrix types**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/types.ts` with:

```ts
import type {
  DataRecord,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';

export type MatrixCalculation =
  | 'raw'
  | 'contribution'
  | 'row_contribution'
  | 'row_rank';

export type MatrixTotalPosition = 'left' | 'right';

export type MatrixTransformConfig = {
  rows: string[];
  columns: string[];
  value: string;
  rowSort?: string | null;
  rowSortDesc?: boolean;
  unitField?: string | null;
  showTotal: boolean;
  totalPosition: MatrixTotalPosition;
  calculation: MatrixCalculation;
  maxGeneratedColumns: number;
};

export type MatrixTransformResult = {
  data: DataRecord[];
  columns: DataColumnMeta[];
  generatedColumnIds: string[];
};

export type MatrixFormData = {
  matrix_mode_enabled?: boolean;
  matrix_rows?: QueryFormColumn[];
  matrix_columns?: QueryFormColumn[];
  matrix_value?: QueryFormMetric | QueryFormMetric[] | null;
  matrix_row_sort?: QueryFormColumn | QueryFormColumn[] | null;
  matrix_row_sort_desc?: boolean;
  matrix_unit_field?: QueryFormColumn | QueryFormColumn[] | null;
  matrix_show_total?: boolean;
  matrix_total_position?: MatrixTotalPosition;
  matrix_value_calculation?: MatrixCalculation;
  matrix_max_generated_columns?: number;
  column_settings_enabled?: boolean;
};
```

- [ ] **Step 4: Implement the pure transform**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/matrixTransform.ts` with the exported constants and `matrixTransform`. Preserve nulls, sum duplicates, dense-rank ties, and append units only for raw/total display.

```ts
import { GenericDataType } from '@superset-ui/core';
import type { DataRecord, DataRecordValue } from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';
import type {
  MatrixCalculation,
  MatrixTransformConfig,
  MatrixTransformResult,
} from './types';

export const MATRIX_TOTAL_COL_ID = '__matrix_total';
export const MATRIX_COL_PREFIX = '__matrix_col__';

const encodeKeyPart = (value: DataRecordValue) =>
  encodeURIComponent(String(value ?? 'null'));

const getRecordKey = (record: DataRecord, fields: string[]) =>
  fields.map(field => encodeKeyPart(record[field])).join('__');

const getRecordLabel = (record: DataRecord, fields: string[]) =>
  fields.map(field => String(record[field] ?? '')).join(' / ');

const toNumber = (value: DataRecordValue, field: string) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Matrix value field "${field}" must contain numeric values.`);
  }
  return parsed;
};

const formatRawValue = (value: number | null, unit?: string | null) => {
  if (value === null) {
    return null;
  }
  if (!unit) {
    return value;
  }
  return unit === '%' ? `${value}%` : `${value} ${unit}`;
};

const calculateValue = (
  raw: number | null,
  calculation: MatrixCalculation,
  matrixTotal: number,
  rowTotal: number,
  rank: number | null,
) => {
  if (raw === null) {
    return null;
  }
  if (calculation === 'raw') {
    return raw;
  }
  if (calculation === 'contribution') {
    return matrixTotal === 0 ? null : raw / matrixTotal;
  }
  if (calculation === 'row_contribution') {
    return rowTotal === 0 ? null : raw / rowTotal;
  }
  if (calculation === 'row_rank') {
    return rank;
  }
  throw new Error(`Unsupported matrix calculation: ${calculation}`);
};

export function matrixTransform(
  records: DataRecord[],
  config: MatrixTransformConfig,
): MatrixTransformResult {
  if (!config.rows.length || !config.columns.length || !config.value) {
    throw new Error('Matrix rows, columns, and value are required.');
  }

  const columnLabelsByKey = new Map<string, string>();
  const rowMap = new Map<
    string,
    {
      rowValues: DataRecord;
      cells: Map<string, number>;
      sortValue: DataRecordValue;
      unit: string | null;
    }
  >();

  records.forEach(record => {
    const rowKey = getRecordKey(record, config.rows);
    const columnKey = getRecordKey(record, config.columns);
    const columnId = `${MATRIX_COL_PREFIX}${columnKey}`;
    const numericValue = toNumber(record[config.value], config.value);

    columnLabelsByKey.set(columnId, getRecordLabel(record, config.columns));
    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        rowValues: Object.fromEntries(
          config.rows.map(field => [field, record[field]]),
        ),
        cells: new Map(),
        sortValue: config.rowSort ? record[config.rowSort] : rowKey,
        unit: config.unitField ? String(record[config.unitField] ?? '') : null,
      });
    }
    if (numericValue !== null) {
      const row = rowMap.get(rowKey)!;
      row.cells.set(columnId, (row.cells.get(columnId) ?? 0) + numericValue);
    }
  });

  const generatedColumnIds = [...columnLabelsByKey.keys()].sort();
  if (generatedColumnIds.length > config.maxGeneratedColumns) {
    throw new Error(
      `Matrix generated ${generatedColumnIds.length} columns, which exceeds the limit of ${config.maxGeneratedColumns}.`,
    );
  }

  const rows = [...rowMap.values()].sort((left, right) => {
    const a = left.sortValue;
    const b = right.sortValue;
    const result = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a ?? '').localeCompare(String(b ?? ''));
    return config.rowSortDesc ? -result : result;
  });

  const matrixTotal = rows.reduce(
    (total, row) =>
      total + generatedColumnIds.reduce((sum, id) => sum + (row.cells.get(id) ?? 0), 0),
    0,
  );

  const data = rows.map(row => {
    const rawValues = generatedColumnIds.map(id => row.cells.get(id) ?? null);
    const rowTotal = rawValues.reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0,
    );
    const ranks = new Map<number, number>();
    [...new Set(rawValues.filter((value): value is number => value !== null))]
      .sort((a, b) => b - a)
      .forEach((value, index) => ranks.set(value, index + 1));

    const output: DataRecord = { ...row.rowValues };
    generatedColumnIds.forEach((id, index) => {
      const raw = rawValues[index];
      const calculated = calculateValue(
        raw,
        config.calculation,
        matrixTotal,
        rowTotal,
        raw === null ? null : ranks.get(raw) ?? null,
      );
      output[id] =
        config.calculation === 'raw'
          ? formatRawValue(calculated, row.unit)
          : calculated;
    });
    if (config.showTotal) {
      output[MATRIX_TOTAL_COL_ID] =
        config.calculation === 'raw'
          ? formatRawValue(rowTotal, row.unit)
          : rowTotal;
    }
    return output;
  });

  const rowColumns: DataColumnMeta[] = config.rows.map(field => ({
    key: field,
    label: field,
    dataType: GenericDataType.String,
  }));
  const matrixColumns: DataColumnMeta[] = generatedColumnIds.map(id => ({
    key: id,
    label: columnLabelsByKey.get(id) ?? id,
    dataType: GenericDataType.Numeric,
    isMetric: true,
    isNumeric: true,
  }));
  const totalColumn: DataColumnMeta = {
    key: MATRIX_TOTAL_COL_ID,
    label: 'Total',
    dataType: GenericDataType.Numeric,
    isMetric: true,
    isNumeric: true,
  };
  const columns = config.showTotal && config.totalPosition === 'left'
    ? [...rowColumns, totalColumn, ...matrixColumns]
    : config.showTotal
      ? [...rowColumns, ...matrixColumns, totalColumn]
      : [...rowColumns, ...matrixColumns];

  return { data, columns, generatedColumnIds };
}
```

- [ ] **Step 5: Run transform tests until green**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit transform slice**

Run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/matrix/types.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/matrix/matrixTransform.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts
git commit -m "feat: add ag grid matrix transform"
```

### Task 2: Matrix Build Query Wrapper

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/buildQuery.ts`
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts`

- [ ] **Step 1: Add failing build query tests**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts` with:

```ts
import { QueryMode, VizType } from '@superset-ui/core';
import buildQuery from '../../src/matrix/buildQuery';

describe('ag grid table scheme matrix buildQuery', () => {
  it('preserves official query behavior when matrix mode is disabled', () => {
    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      groupby: ['category'],
      metrics: ['count'],
      matrix_mode_enabled: false,
    } as any).queries[0];

    expect(query.columns).toEqual(['category']);
    expect(query.metrics).toEqual(['count']);
  });

  it('injects matrix dimensions, unit, sort field, and selected metric', () => {
    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      groupby: ['ignored_group'],
      metrics: ['ignored_metric'],
      matrix_mode_enabled: true,
      matrix_rows: ['metric_name'],
      matrix_columns: ['biz_date'],
      matrix_value: 'value',
      matrix_row_sort: 'metric_order',
      matrix_unit_field: 'unit',
    } as any).queries[0];

    expect(query.columns).toEqual([
      'metric_name',
      'biz_date',
      'metric_order',
      'unit',
    ]);
    expect(query.metrics).toEqual(['value']);
  });

  it('fails fast when matrix mode is combined with server pagination', () => {
    expect(() =>
      buildQuery({
        viz_type: VizType.Table,
        datasource: '11__table',
        query_mode: QueryMode.Aggregate,
        matrix_mode_enabled: true,
        server_pagination: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
      } as any),
    ).toThrow('Matrix mode does not support server pagination.');
  });
});
```

- [ ] **Step 2: Run build query tests and verify they fail**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts --runInBand
```

Expected: FAIL because `../../src/matrix/buildQuery` does not exist.

- [ ] **Step 3: Implement matrix-aware buildQuery**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/matrix/buildQuery.ts` with:

```ts
import officialBuildQuery from '@superset-ui/plugin-chart-ag-grid-table/src/buildQuery';
import type { BuildQuery, QueryFormColumn } from '@superset-ui/core';
import type { TableChartFormData } from '@superset-ui/plugin-chart-ag-grid-table/src/types';
import type { MatrixFormData } from './types';

type SchemeMatrixFormData = TableChartFormData & MatrixFormData;

const ensureArray = <T>(value: T | T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];

const unique = <T>(values: T[]) => [...new Set(values.filter(Boolean))];

const normalizeColumn = (column: QueryFormColumn) => column;

const buildQuery: BuildQuery<SchemeMatrixFormData> = (formData, options) => {
  if (!formData.matrix_mode_enabled) {
    return officialBuildQuery(formData, options);
  }
  if (formData.server_pagination) {
    throw new Error('Matrix mode does not support server pagination.');
  }

  const matrixRows = ensureArray(formData.matrix_rows).map(normalizeColumn);
  const matrixColumns = ensureArray(formData.matrix_columns).map(normalizeColumn);
  const rowSort = ensureArray(formData.matrix_row_sort).map(normalizeColumn);
  const unitField = ensureArray(formData.matrix_unit_field).map(normalizeColumn);
  const matrixValue = ensureArray(formData.matrix_value)[0];

  if (!matrixRows.length || !matrixColumns.length || !matrixValue) {
    throw new Error('Matrix rows, columns, and value are required.');
  }

  return officialBuildQuery(
    {
      ...formData,
      groupby: unique([...matrixRows, ...matrixColumns, ...rowSort, ...unitField]),
      metrics: [matrixValue],
      percent_metrics: [],
      timeseries_limit_metric: rowSort[0] ?? null,
      order_desc: Boolean(formData.matrix_row_sort_desc),
      server_pagination: false,
    },
    options,
  );
};

export default buildQuery;
```

- [ ] **Step 4: Switch plugin registration to local buildQuery**

Modify `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts`:

```ts
import controlPanel from './controlPanel';
import buildQuery from './matrix/buildQuery';
```

Remove these two imports:

```ts
import controlPanel from '@superset-ui/plugin-chart-ag-grid-table/src/controlPanel';
import buildQuery from '@superset-ui/plugin-chart-ag-grid-table/src/buildQuery';
```

- [ ] **Step 5: Run build query tests until green**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit query slice**

Run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/matrix/buildQuery.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/index.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts
git commit -m "feat: add matrix query builder"
```

### Task 3: Control Panel Matrix Controls

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/controlPanel.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts`

- [ ] **Step 1: Create local controlPanel wrapper**

Create `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/controlPanel.tsx`:

```tsx
import officialControlPanel from '@superset-ui/plugin-chart-ag-grid-table/src/controlPanel';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { QueryMode, t } from '@superset-ui/core';

const isAggMode = ({ controls }: any) => {
  const mode = controls?.query_mode?.value;
  return mode === QueryMode.Aggregate || (!mode && !controls?.all_columns?.value?.length);
};

const matrixVisibility = ({ controls }: any) =>
  isAggMode({ controls }) && Boolean(controls?.matrix_mode_enabled?.value);

const matrixControls = [
  [
    {
      name: 'matrix_mode_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('Enable matrix mode'),
        default: false,
        renderTrigger: true,
        visibility: isAggMode,
        description: t('Transform aggregate records into a row-by-column matrix.'),
      },
    },
  ],
  [
    {
      name: 'matrix_rows',
      config: {
        ...sharedControls.groupby,
        label: t('Matrix rows'),
        multi: true,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_columns',
      config: {
        ...sharedControls.groupby,
        label: t('Matrix columns'),
        multi: true,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_value',
      config: {
        ...sharedControls.metrics,
        label: t('Matrix value'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_row_sort',
      config: {
        ...sharedControls.groupby,
        label: t('Row sort'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
    {
      name: 'matrix_row_sort_desc',
      config: {
        type: 'CheckboxControl',
        label: t('Sort descending'),
        default: false,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_unit_field',
      config: {
        ...sharedControls.groupby,
        label: t('Unit field'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_show_total',
      config: {
        type: 'CheckboxControl',
        label: t('Show total column'),
        default: true,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
    {
      name: 'matrix_total_position',
      config: {
        type: 'SelectControl',
        label: t('Total position'),
        default: 'left',
        clearable: false,
        choices: [
          ['left', t('Left')],
          ['right', t('Right')],
        ],
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_value_calculation',
      config: {
        type: 'SelectControl',
        label: t('Value calculation'),
        default: 'raw',
        clearable: false,
        choices: [
          ['raw', t('Raw value')],
          ['contribution', t('Contribution')],
          ['row_contribution', t('Row contribution')],
          ['row_rank', t('Row rank')],
        ],
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_max_generated_columns',
      config: {
        type: 'TextControl',
        label: t('Matrix max generated columns'),
        default: 200,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'column_settings_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('Column settings enabled'),
        default: false,
        renderTrigger: true,
        description: t('Show the column settings entry point in the chart toolbar.'),
      },
    },
  ],
];

const querySection = officialControlPanel.controlPanelSections[0];

const controlPanel: ControlPanelConfig = {
  ...officialControlPanel,
  controlPanelSections: [
    {
      ...querySection,
      controlSetRows: [...querySection.controlSetRows, ...matrixControls],
    },
    ...officialControlPanel.controlPanelSections.slice(1),
  ],
};

export default controlPanel;
```

- [ ] **Step 2: Confirm index imports the local control panel**

`superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/index.ts` must contain:

```ts
import controlPanel from './controlPanel';
```

- [ ] **Step 3: Run TypeScript build for the plugin**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npx tsc --build plugins/plugin-chart-ag-grid-table-scheme/tsconfig.json
```

Expected: PASS.

- [ ] **Step 4: Commit control slice**

Run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/controlPanel.tsx \
  plugins/plugin-chart-ag-grid-table-scheme/src/index.ts
git commit -m "feat: add matrix chart controls"
```

### Task 4: Transform Props Integration

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/AgGridTableSchemeChart.tsx`

- [ ] **Step 1: Extend transformed props for matrix and toggle values**

Modify `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/transformProps.ts` to import matrix types and transform:

```ts
import { ensureIsArray, getMetricLabel } from '@superset-ui/core';
import { matrixTransform } from './matrix/matrixTransform';
import type { MatrixFormData, MatrixTransformConfig } from './matrix/types';
```

Change `ScopedFormData` to:

```ts
type ScopedFormData = TableChartProps['rawFormData'] &
  MatrixFormData & {
    dashboardId?: number | string | null;
    dashboard_id?: number | string | null;
  };
```

- [ ] **Step 2: Add config normalization helpers**

Add these helpers in the same file:

```ts
const firstValue = <T>(value: T | T[] | null | undefined) =>
  ensureIsArray(value)[0];

const toFieldName = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'label' in value) {
    return String((value as { label: string }).label);
  }
  return null;
};

const buildMatrixConfig = (formData: ScopedFormData): MatrixTransformConfig => {
  const rows = ensureIsArray(formData.matrix_rows)
    .map(toFieldName)
    .filter((value): value is string => Boolean(value));
  const columns = ensureIsArray(formData.matrix_columns)
    .map(toFieldName)
    .filter((value): value is string => Boolean(value));
  const metric = firstValue(formData.matrix_value);
  const value = metric ? getMetricLabel(metric) : '';
  const rowSort = toFieldName(firstValue(formData.matrix_row_sort));
  const unitField = toFieldName(firstValue(formData.matrix_unit_field));

  return {
    rows,
    columns,
    value,
    rowSort,
    rowSortDesc: Boolean(formData.matrix_row_sort_desc),
    unitField,
    showTotal: formData.matrix_show_total !== false,
    totalPosition: formData.matrix_total_position ?? 'left',
    calculation: formData.matrix_value_calculation ?? 'raw',
    maxGeneratedColumns: Number(formData.matrix_max_generated_columns) || 200,
  };
};
```

- [ ] **Step 3: Apply matrix transform only when enabled**

Replace the return body with this structure:

```ts
export default function transformProps(chartProps: TableChartProps) {
  const formData = chartProps.rawFormData as ScopedFormData;
  const datasourceId =
    chartProps.rawDatasource?.id ?? chartProps.datasource?.id ?? null;
  const officialProps = officialTransformProps(chartProps);

  const scopedProps = {
    ...officialProps,
    dashboardId: optionalNumber(
      formData.dashboardId ?? formData.dashboard_id,
      'dashboardId',
    ),
    datasetId: optionalNumber(datasourceId, 'datasetId'),
    columnSettingsEnabled: Boolean(formData.column_settings_enabled),
  };

  if (!formData.matrix_mode_enabled) {
    return scopedProps;
  }
  if (officialProps.serverPagination) {
    throw new Error('Matrix mode does not support server pagination.');
  }

  const matrixResult = matrixTransform(
    chartProps.queriesData?.[0]?.data ?? officialProps.data,
    buildMatrixConfig(formData),
  );

  return {
    ...scopedProps,
    data: matrixResult.data,
    columns: matrixResult.columns,
    metrics: matrixResult.generatedColumnIds,
    percentMetrics: [],
  };
}
```

- [ ] **Step 4: Pass `columnSettingsEnabled` into the chart toolbar**

Modify `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/AgGridTableSchemeChart.tsx`:

```ts
type SchemeChartProps = AgGridTableChartTransformedProps & {
  dashboardId?: number | null;
  datasetId?: number | null;
  columnSettingsEnabled?: boolean;
};
```

Pass the prop:

```tsx
<ColumnViewSchemeToolbar
  chartId={props.slice_id}
  dashboardId={props.dashboardId}
  datasetId={props.datasetId}
  gridApi={gridApi}
  colDefs={colDefs}
  includeSortState={!props.serverPagination}
  columnSettingsEnabled={Boolean(props.columnSettingsEnabled)}
/>
```

- [ ] **Step 5: Run focused transform and type checks**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts --runInBand
npx tsc --build plugins/plugin-chart-ag-grid-table-scheme/tsconfig.json
```

Expected: PASS for both commands.

- [ ] **Step 6: Commit transform integration**

Run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/transformProps.ts \
  plugins/plugin-chart-ag-grid-table-scheme/src/AgGridTableSchemeChart.tsx
git commit -m "feat: wire matrix transform into chart props"
```

### Task 5: Column Settings Toggle Gate

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/columnViewSchemes/ColumnViewSchemeToolbar.tsx`

- [ ] **Step 1: Add toolbar prop**

Modify the prop type:

```ts
type ColumnViewSchemeToolbarProps = {
  chartId: number;
  dashboardId?: number | null;
  datasetId?: number | null;
  gridApi?: GridApi;
  colDefs: ColDef[];
  includeSortState?: boolean;
  columnSettingsEnabled?: boolean;
};
```

Destructure with default:

```ts
export default function ColumnViewSchemeToolbar({
  chartId,
  dashboardId,
  datasetId,
  gridApi,
  colDefs,
  includeSortState,
  columnSettingsEnabled = false,
}: ColumnViewSchemeToolbarProps) {
```

- [ ] **Step 2: Gate the existing `列设置` button**

Replace the current button:

```tsx
<Button disabled={isBusy || !isGridReady} onClick={openColumnSettings}>
  {t('列设置')}
</Button>
```

With:

```tsx
{columnSettingsEnabled && (
  <Button disabled={isBusy || !isGridReady} onClick={openColumnSettings}>
    {t('列设置')}
  </Button>
)}
```

- [ ] **Step 3: Run TypeScript build**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npx tsc --build plugins/plugin-chart-ag-grid-table-scheme/tsconfig.json
```

Expected: PASS.

- [ ] **Step 4: Commit toggle slice**

Run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/columnViewSchemes/ColumnViewSchemeToolbar.tsx
git commit -m "feat: gate column settings entry point"
```

### Task 6: Column Scheme Compatibility Tests

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/test/columnViewSchemes/state.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme/src/columnViewSchemes/state.ts`

- [ ] **Step 1: Add matrix generated column tests**

Append to `state.test.ts`:

```ts
it('keeps generated matrix columns in column signatures and reconciliation', () => {
  const matrixColDefs: SchemeColDef[] = [
    { field: 'metric_name', headerName: 'Metric' },
    {
      colId: '__matrix_total',
      field: '__matrix_total',
      headerName: 'Total',
    },
    {
      colId: '__matrix_col__2026-05-01',
      field: '__matrix_col__2026-05-01',
      headerName: '2026-05-01',
    },
  ];
  const savedState = captureColumnViewState(
    [
      { colId: '__matrix_total', hide: false, pinned: 'left', width: 140 },
      { colId: '__matrix_col__2026-05-01', hide: true, width: 120 },
    ],
    matrixColDefs,
  );

  expect(savedState.column_signature).toMatch(/^hash:[0-9a-f]+$/);
  expect(reconcileColumnState(savedState, [
    ...matrixColDefs,
    {
      colId: '__matrix_col__2026-05-02',
      field: '__matrix_col__2026-05-02',
      headerName: '2026-05-02',
    },
  ])).toEqual([
    { colId: '__matrix_total', hide: false, pinned: 'left', width: 140 },
    { colId: '__matrix_col__2026-05-01', hide: true, width: 120 },
    { colId: 'metric_name', hide: false },
    { colId: '__matrix_col__2026-05-02', hide: false },
  ]);
});
```

- [ ] **Step 2: Run state tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/columnViewSchemes/state.test.ts --runInBand
```

Expected: PASS if existing reconciliation already handles generated columns. If it fails because current columns append before saved generated columns, adjust `reconcileColumnState` to preserve saved columns first and append only new current columns.

- [ ] **Step 3: Apply minimal state fix only if the test fails**

If needed, modify `src/columnViewSchemes/state.ts` so reconciliation does:

```ts
const currentColumnIds = new Set(currentColumnDefs.map(getColumnId));
const savedColumnIds = new Set<string>();
const reconciled = savedState.raw_column_state
  .filter(column => currentColumnIds.has(column.colId))
  .map(column => {
    savedColumnIds.add(column.colId);
    return sanitizeColumnState(column, options);
  });

currentColumnDefs.forEach(colDef => {
  const colId = getColumnId(colDef);
  if (!savedColumnIds.has(colId)) {
    reconciled.push({ colId, hide: false });
  }
});
```

- [ ] **Step 4: Commit compatibility slice**

Run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme/src/columnViewSchemes/state.ts \
  plugins/plugin-chart-ag-grid-table-scheme/test/columnViewSchemes/state.test.ts
git commit -m "test: cover matrix columns in view schemes"
```

### Task 7: Focused Validation

**Files:**
- Verify only, no planned file changes.

- [ ] **Step 1: Run all focused plugin tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm test -- plugins/plugin-chart-ag-grid-table-scheme/test/matrix/matrixTransform.test.ts plugins/plugin-chart-ag-grid-table-scheme/test/matrix/buildQuery.test.ts plugins/plugin-chart-ag-grid-table-scheme/test/columnViewSchemes/state.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run plugin TypeScript build**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npx tsc --build plugins/plugin-chart-ag-grid-table-scheme/tsconfig.json
```

Expected: PASS.

- [ ] **Step 3: Run focused ESLint on changed plugin source**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm run eslint -- plugins/plugin-chart-ag-grid-table-scheme/src plugins/plugin-chart-ag-grid-table-scheme/test
```

Expected: PASS or only pre-existing lint output unrelated to changed files. If lint reports changed-file issues, fix them before browser acceptance.

- [ ] **Step 4: Commit validation-only fixes if any were required**

If validation forced code edits, run:

```bash
git add plugins/plugin-chart-ag-grid-table-scheme
git commit -m "fix: stabilize matrix mode validation"
```

If no code edits were needed, do not create a validation-only commit.

### Task 8: Browser Acceptance

**Files:**
- Verify runtime behavior. No planned source changes.

- [ ] **Step 1: Start or reuse Superset frontend/backend runtime**

Use the repo's existing runtime setup for this checkout. The target acceptance URL from the spec is:

```text
http://111.230.91.24:8088/explore/?form_data_key=PG6hu3ji5i8&dashboard_page_id=iP6L6sA5Ys30A8zqVHRDu&slice_id=10
```

- [ ] **Step 2: Configure chart 10 manually**

In Explore for chart 10:

```text
Visualization: Table V2 with Column Schemes
Enable matrix mode: on
Matrix rows: metric_name
Matrix columns: biz_date
Matrix value: value
Row sort: metric_order
Sort descending: off
Unit field: unit
Show total column: on
Total position: left
Value calculation: raw
Column settings enabled: off
```

- [ ] **Step 3: Verify default-off column settings behavior**

Expected:

```text
The chart renders matrix rows and generated date columns.
The total column appears on the left.
Values with unit "%" render like "9.79%" without multiplying by 100.
The toolbar does not show the "列设置" button while Column settings enabled is off.
```

- [ ] **Step 4: Enable column settings and verify scheme compatibility**

Set `Column settings enabled` to on and rerender.

Expected:

```text
The toolbar shows "列设置".
Opening it shows generated matrix columns and total column.
Hiding one generated date column applies immediately after save.
Pinning the total column persists in the active scheme.
Refreshing the dashboard reapplies the saved scheme.
```

- [ ] **Step 5: Record acceptance evidence**

Write the final response with:

```text
Focused tests run and result
TypeScript build result
ESLint result
Browser acceptance result
Any blocked runtime prerequisite with exact error text
```

### Task 9: Push Final Branch

**Files:**
- Git only.

- [ ] **Step 1: Confirm clean status and commit list**

Run:

```bash
git -C /Volumes/extend/ecode-workspace/superset-source status --short --branch
git -C /Volumes/extend/ecode-workspace/superset-source log --oneline fork/feat/ag-grid-column-view-scheme..HEAD
```

Expected: clean worktree and only matrix-mode implementation commits ahead.

- [ ] **Step 2: Push branch**

Run:

```bash
git -C /Volumes/extend/ecode-workspace/superset-source push fork feat/ag-grid-column-view-scheme
```

Expected: push succeeds.

- [ ] **Step 3: Final response**

Report:

```text
Implemented matrix mode in Table V2 with Column Schemes.
Branch pushed: feat/ag-grid-column-view-scheme.
List of commits.
Validation commands and results.
Browser acceptance result or blocker.
```

## Self-Review

Spec coverage:
- Matrix mode controls: Task 3.
- Query inclusion of rows, columns, metric, unit, and sort field: Task 2.
- Long-form to wide transform: Task 1.
- Raw, contribution, row contribution, row rank: Task 1.
- Total column left/right: Task 1 and Task 4.
- Column settings toggle default false and no auto-open: Task 3 and Task 5.
- Column scheme compatibility for generated columns: Task 6.
- No backend API change, no Pivot Table v2 change, no AG Grid Enterprise: file structure only touches the scheme plugin.
- No server pagination in v1: Task 2 and Task 4 fail fast.
- Browser acceptance for chart 10: Task 8.

Placeholder scan:
- No unresolved placeholder markers or open-ended edge-case instructions.
- Each code-changing task names exact files, concrete snippets, commands, expected results, and commit commands.

Type consistency:
- Form-data keys match the design spec and the shared naming contract.
- `columnSettingsEnabled` is produced by `transformProps`, consumed by `AgGridTableSchemeChart`, and passed to `ColumnViewSchemeToolbar`.
- Generated column IDs use `MATRIX_COL_PREFIX` and `MATRIX_TOTAL_COL_ID` consistently.
