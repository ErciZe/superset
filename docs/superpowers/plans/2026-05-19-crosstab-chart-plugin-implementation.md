# Crosstab Chart Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Superset `plugin-chart-crosstab-table` visualization that renders FineBI-like row dimension, column dimension, and value area cross tables with query-result-derived column domains.

**Architecture:** Add a new chart plugin instead of extending `plugin-chart-ag-grid-table-scheme`. Keep the crosstab data engine pure TypeScript with Jest coverage, then wire Superset controls, query building, `transformProps`, and an AG Grid Community renderer around that engine. Register the visualization under its own `VizType.CrosstabTable` key so it is selectable independently from `noway table v1`.

**Tech Stack:** Superset frontend, TypeScript, React 17, AG Grid Community through existing AG Grid table dependencies, `@superset-ui/core`, `@superset-ui/chart-controls`, Jest, Testing Library.

---

## File Structure

- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/package.json`
  Declares `@superset-ui/plugin-chart-crosstab-table` and reuses the local AG Grid table package.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/index.ts`
  Exports the chart plugin class and metadata.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  React renderer that maps transformed props to AG Grid.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
  Superset Explore controls for rows, columns, metrics, totals, formatting, expand depth, and generated-column limit.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  Builds one aggregate query using row dimensions, column dimensions, and metrics.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  Validates form data, invokes the pure engine, and returns renderer props.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  Shared form data, engine, renderer, and formatting types.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/keys.ts`
  Stable typed length-prefixed key encoding for row and column identifiers.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts`
  Query-result-derived column domains and Cartesian column tuple generation.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
  Pure long-form records to crosstab row data and nested column model.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/totals.ts`
  Numeric subtotal, row total, column total, and duplicate-cell accumulation.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/formatting.ts`
  Declarative cell formatting, blank missing cells, conditional colors, and arrow indicators.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/keys.test.ts`
  Key collision and label separation tests.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/domain.test.ts`
  Domain and Cartesian tuple tests.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`
  Engine, totals, blanks, multiple metrics, and fail-fast tests.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  Query inclusion and server pagination rejection tests.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  Nested column definition and renderer prop tests.
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  Rendering smoke tests for row hierarchy and formatted cells.
- Modify: `superset-frontend/package.json`
  Adds the local plugin package dependency.
- Modify: `superset-frontend/package-lock.json`
  Captures the local package entry after `npm install --package-lock-only`.
- Modify: `superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts`
  Adds `CrosstabTable = 'crosstab-table'`.
- Modify: `superset-frontend/src/visualizations/presets/MainPreset.js`
  Imports and registers the plugin under `VizType.CrosstabTable` when `FeatureFlag.AgGridTableEnabled` is enabled.

## Shared Naming Contract

Use these form-data keys exactly:

```ts
groupbyRows?: QueryFormColumn[];
groupbyColumns?: QueryFormColumn[];
metrics?: QueryFormMetric[];
showRowSubtotals?: boolean;
showRowTotals?: boolean;
showColumnTotals?: boolean;
showColumnSubtotals?: boolean;
maxGeneratedColumns?: number;
defaultRowExpandedDepth?: number;
numberFormat?: string;
conditionalFormatting?: CrosstabConditionalRule[];
```

Use these generated IDs exactly:

```ts
export const CROSSTAB_ROW_KEY = '__crosstab_row_key';
export const CROSSTAB_ROW_LABEL = '__crosstab_row_label';
export const CROSSTAB_TOTAL_COLUMN_ID = '__crosstab_total';
export const CROSSTAB_COLUMN_PREFIX = '__crosstab_col__';
```

Use these fail-fast messages exactly:

```ts
export const ERR_REQUIRED_FIELDS =
  'Crosstab rows, columns, and metrics are required.';
export const ERR_COLUMN_LIMIT = (actual: number, limit: number) =>
  `Crosstab generated ${actual} columns, which exceeds the limit of ${limit}.`;
export const ERR_SERVER_PAGINATION =
  'Crosstab table does not support server pagination in v1.';
export const ERR_NON_NUMERIC_TOTAL =
  'Crosstab totals require numeric metric values.';
```

### Task 1: Package Shell And Visualization Registration

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/package.json`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/index.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/package.json`
- Modify: `superset-frontend/package-lock.json`
- Modify: `superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts`
- Modify: `superset-frontend/src/visualizations/presets/MainPreset.js`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/index.test.ts`

- [ ] **Step 1: Add the failing plugin registration test**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/index.test.ts`:

```ts
import CrosstabTableChartPlugin from '../src';

describe('CrosstabTableChartPlugin', () => {
  it('has chart metadata and a lazy chart loader', () => {
    const plugin = new CrosstabTableChartPlugin();

    expect(plugin.metadata.name).toBe('Crosstab Table');
    expect(plugin.metadata.category).toBe('Table');
    expect(plugin.loadChart).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the registration test and verify it fails**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/index.test.ts --runInBand
```

Expected: FAIL because `plugins/plugin-chart-crosstab-table/src` does not exist.

- [ ] **Step 3: Add the new plugin package manifest**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/package.json`:

```json
{
  "name": "@superset-ui/plugin-chart-crosstab-table",
  "version": "0.1.0",
  "description": "Superset Chart - Crosstab Table",
  "license": "Apache-2.0",
  "sideEffects": false,
  "main": "lib/index.js",
  "module": "esm/index.js",
  "files": [
    "esm",
    "lib"
  ],
  "dependencies": {
    "@superset-ui/plugin-chart-ag-grid-table": "file:../plugin-chart-ag-grid-table"
  },
  "peerDependencies": {
    "@superset-ui/chart-controls": "*",
    "@superset-ui/core": "*",
    "antd": "^5.24.6",
    "react": "^17.0.2",
    "react-dom": "^17.0.2"
  }
}
```

- [ ] **Step 4: Add minimal shared types**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`:

```ts
import type {
  ChartProps,
  DataRecord,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';

export type CrosstabConditionalRule = {
  metric?: string;
  operator: '>' | '>=' | '<' | '<=' | '=' | '!=';
  value: number;
  color?: string;
  backgroundColor?: string;
  arrow?: 'up' | 'down';
};

export interface CrosstabFormData extends QueryFormData {
  groupbyRows?: QueryFormColumn[];
  groupbyColumns?: QueryFormColumn[];
  metrics?: QueryFormMetric[];
  showRowSubtotals?: boolean;
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  showColumnSubtotals?: boolean;
  maxGeneratedColumns?: number;
  defaultRowExpandedDepth?: number;
  numberFormat?: string;
  conditionalFormatting?: CrosstabConditionalRule[];
  serverPagination?: boolean;
}

export type CrosstabColumnNode = {
  id: string;
  label: string;
  children?: CrosstabColumnNode[];
  metric?: string;
  field?: string;
};

export type CrosstabEngineResult = {
  rowData: DataRecord[];
  columns: DataColumnMeta[];
  columnTree: CrosstabColumnNode[];
  generatedColumnIds: string[];
};

export type CrosstabChartProps = ChartProps<CrosstabFormData> & {
  rowData: DataRecord[];
  columns: DataColumnMeta[];
  columnTree: CrosstabColumnNode[];
};
```

- [ ] **Step 5: Add minimal plugin callbacks**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`:

```ts
import { buildQueryContext, QueryObjectFilterClause } from '@superset-ui/core';
import type { CrosstabFormData } from '../types';

export default function buildQuery(formData: CrosstabFormData) {
  if (formData.serverPagination) {
    throw new Error('Crosstab table does not support server pagination in v1.');
  }

  const columns = [
    ...(formData.groupbyRows || []),
    ...(formData.groupbyColumns || []),
  ];

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      metrics: formData.metrics || [],
      filters: (baseQueryObject.filters || []) as QueryObjectFilterClause[],
      is_timeseries: false,
    },
  ]);
}
```

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`:

```tsx
import { t } from '@superset-ui/core';
import {
  sharedControls,
  ControlPanelConfig,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupbyRows',
            config: {
              ...sharedControls.groupby,
              label: t('Rows'),
              description: t('Row dimensions for the crosstab hierarchy'),
              multi: true,
            },
          },
        ],
        [
          {
            name: 'groupbyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Column dimensions for generated headers'),
              multi: true,
            },
          },
        ],
        ['metrics'],
      ],
    },
    {
      label: t('Crosstab'),
      expanded: true,
      controlSetRows: [
        ['showRowSubtotals'],
        ['showRowTotals'],
        ['showColumnTotals'],
        ['showColumnSubtotals'],
        [
          {
            name: 'maxGeneratedColumns',
            config: {
              type: 'TextControl',
              label: t('Max generated columns'),
              default: '300',
              description: t('Fail when generated crosstab columns exceed this limit'),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    metrics: {
      validators: [],
    },
  },
};

export default config;
```

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`:

```ts
import type { ChartProps } from '@superset-ui/core';
import type { CrosstabChartProps, CrosstabFormData } from '../types';

export default function transformProps(
  chartProps: ChartProps<CrosstabFormData>,
): CrosstabChartProps {
  return {
    ...chartProps,
    rowData: [],
    columns: [],
    columnTree: [],
  };
}
```

- [ ] **Step 6: Add minimal renderer and plugin class**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`:

```tsx
import React from 'react';
import type { CrosstabChartProps } from './types';

export default function CrosstabTable(props: CrosstabChartProps) {
  const { height, width } = props;

  return (
    <div data-test="crosstab-table" style={{ height, width }}>
      Crosstab Table
    </div>
  );
}
```

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/index.ts`:

```ts
import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import type { CrosstabChartProps, CrosstabFormData } from './types';
import buildQuery from './plugin/buildQuery';
import controlPanel from './plugin/controlPanel';
import transformProps from './plugin/transformProps';

const metadata = new ChartMetadata({
  behaviors: [
    Behavior.InteractiveChart,
    Behavior.DrillToDetail,
    Behavior.DrillBy,
  ],
  category: t('Table'),
  description: t(
    'Cross table with row dimensions, column dimensions, generated column domains, metrics, subtotals, and totals.',
  ),
  name: t('Crosstab Table'),
  tags: [t('Business'), t('Report'), t('Tabular')],
});

export default class CrosstabTableChartPlugin extends ChartPlugin<
  CrosstabFormData,
  CrosstabChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./CrosstabTable'),
      metadata,
      transformProps,
    });
  }
}
```

- [ ] **Step 7: Register the package and visualization key**

Modify `superset-frontend/package.json` dependencies:

```json
"@superset-ui/plugin-chart-crosstab-table": "file:./plugins/plugin-chart-crosstab-table"
```

Modify `superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts`:

```ts
CrosstabTable = 'crosstab-table',
```

Modify `superset-frontend/src/visualizations/presets/MainPreset.js` imports:

```js
import CrosstabTableChartPlugin from '@superset-ui/plugin-chart-crosstab-table';
```

Modify the `agGridTablePlugin` block in `MainPreset.js`:

```js
const agGridTablePlugin = isFeatureEnabled(FeatureFlag.AgGridTableEnabled)
  ? [
      new AgGridTableChartPlugin().configure({ key: VizType.TableAgGrid }),
      new CrosstabTableChartPlugin().configure({
        key: VizType.CrosstabTable,
      }),
    ]
  : [];
```

- [ ] **Step 8: Refresh package lock**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm install --package-lock-only
```

Expected: `package-lock.json` gains entries for `@superset-ui/plugin-chart-crosstab-table` and `plugins/plugin-chart-crosstab-table`.

- [ ] **Step 9: Run the registration test and commit**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/index.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/package.json superset-frontend/package-lock.json superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts superset-frontend/src/visualizations/presets/MainPreset.js superset-frontend/plugins/plugin-chart-crosstab-table
git commit -m "feat: add crosstab chart plugin shell"
```

### Task 2: Stable Keys And Column Domain Generation

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/keys.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/keys.test.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/domain.test.ts`

- [ ] **Step 1: Add failing stable key tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/keys.test.ts`:

```ts
import { decodeKey, encodeKey, encodeTuple } from '../../src/crosstab/keys';

describe('crosstab keys', () => {
  it('separates type, length, and display value', () => {
    expect(encodeKey(null)).toBe('null:0:');
    expect(encodeKey('12:string')).toBe('string:9:12:string');
    expect(encodeKey(12)).toBe('number:2:12');
    expect(encodeKey(true)).toBe('boolean:4:true');
  });

  it('round trips encoded values', () => {
    expect(decodeKey('null:0:')).toEqual({ type: 'null', value: null });
    expect(decodeKey('string:9:12:string')).toEqual({
      type: 'string',
      value: '12:string',
    });
  });

  it('builds tuple keys without separator collisions', () => {
    expect(encodeTuple(['A/B', 'C'])).not.toBe(encodeTuple(['A', 'B/C']));
  });
});
```

- [ ] **Step 2: Add failing domain tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/domain.test.ts`:

```ts
import {
  buildColumnDomains,
  buildColumnTuples,
} from '../../src/crosstab/domain';

const records = [
  { biz_date: '2026-05-01', shop_name: 'A', amount: 10 },
  { biz_date: '2026-05-01', shop_name: 'B', amount: 20 },
  { biz_date: '2026-05-02', shop_name: 'A', amount: 30 },
];

describe('crosstab domain', () => {
  it('derives one domain per column dimension from query results', () => {
    expect(buildColumnDomains(records, ['biz_date', 'shop_name'])).toEqual([
      ['2026-05-01', '2026-05-02'],
      ['A', 'B'],
    ]);
  });

  it('generates Cartesian column tuples from derived domains', () => {
    expect(buildColumnTuples(records, ['biz_date', 'shop_name'], 10)).toEqual([
      ['2026-05-01', 'A'],
      ['2026-05-01', 'B'],
      ['2026-05-02', 'A'],
      ['2026-05-02', 'B'],
    ]);
  });

  it('fails when generated tuples exceed the configured limit', () => {
    expect(() => buildColumnTuples(records, ['biz_date', 'shop_name'], 3))
      .toThrow('Crosstab generated 4 columns, which exceeds the limit of 3.');
  });
});
```

- [ ] **Step 3: Run key and domain tests and verify they fail**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/crosstab/keys.test.ts plugins/plugin-chart-crosstab-table/test/crosstab/domain.test.ts --runInBand
```

Expected: FAIL because `keys.ts` and `domain.ts` do not exist.

- [ ] **Step 4: Implement stable key encoding**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/keys.ts`:

```ts
export type EncodedValue =
  | { type: 'null'; value: null }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean };

export function encodeKey(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null:0:';
  }

  const type = typeof value;
  if (type !== 'string' && type !== 'number' && type !== 'boolean') {
    throw new Error(`Unsupported crosstab key value type: ${type}`);
  }

  const raw = String(value);
  return `${type}:${raw.length}:${raw}`;
}

export function encodeTuple(values: unknown[]): string {
  return values.map(encodeKey).join('|');
}

export function decodeKey(encoded: string): EncodedValue {
  const firstColon = encoded.indexOf(':');
  const secondColon = encoded.indexOf(':', firstColon + 1);
  if (firstColon < 0 || secondColon < 0) {
    throw new Error(`Invalid crosstab key: ${encoded}`);
  }

  const type = encoded.slice(0, firstColon);
  const length = Number(encoded.slice(firstColon + 1, secondColon));
  const raw = encoded.slice(secondColon + 1);
  if (raw.length !== length) {
    throw new Error(`Invalid crosstab key length: ${encoded}`);
  }

  if (type === 'null') return { type: 'null', value: null };
  if (type === 'string') return { type: 'string', value: raw };
  if (type === 'number') return { type: 'number', value: Number(raw) };
  if (type === 'boolean') return { type: 'boolean', value: raw === 'true' };
  throw new Error(`Invalid crosstab key type: ${type}`);
}
```

- [ ] **Step 5: Implement domain generation**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts`:

```ts
import type { DataRecord } from '@superset-ui/core';

export const ERR_COLUMN_LIMIT = (actual: number, limit: number) =>
  `Crosstab generated ${actual} columns, which exceeds the limit of ${limit}.`;

export function buildColumnDomains(
  records: DataRecord[],
  columnFields: string[],
): unknown[][] {
  return columnFields.map(field => {
    const seen = new Set<unknown>();
    const values: unknown[] = [];

    records.forEach(record => {
      const value = record[field];
      if (!seen.has(value)) {
        seen.add(value);
        values.push(value);
      }
    });

    return values;
  });
}

export function cartesianProduct(domains: unknown[][]): unknown[][] {
  return domains.reduce<unknown[][]>(
    (tuples, domain) =>
      tuples.flatMap(tuple => domain.map(value => [...tuple, value])),
    [[]],
  );
}

export function buildColumnTuples(
  records: DataRecord[],
  columnFields: string[],
  maxGeneratedColumns: number,
): unknown[][] {
  const tuples = cartesianProduct(buildColumnDomains(records, columnFields));
  if (tuples.length > maxGeneratedColumns) {
    throw new Error(ERR_COLUMN_LIMIT(tuples.length, maxGeneratedColumns));
  }
  return tuples;
}
```

- [ ] **Step 6: Run key and domain tests and commit**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/crosstab/keys.test.ts plugins/plugin-chart-crosstab-table/test/crosstab/domain.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/keys.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/domain.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/keys.test.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/domain.test.ts
git commit -m "feat: add crosstab key and domain utilities"
```

### Task 3: Pure Crosstab Engine

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/totals.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`

- [ ] **Step 1: Add failing engine tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts`:

```ts
import {
  CROSSTAB_TOTAL_COLUMN_ID,
  buildCrosstab,
} from '../../src/crosstab/engine';

const records = [
  { contract_type: 'A', year: '2026', pay_type: 'Cash', amount: 10, profit: 3 },
  { contract_type: 'A', year: '2026', pay_type: 'Cash', amount: 5, profit: 2 },
  { contract_type: 'A', year: '2026', pay_type: 'Credit', amount: 7, profit: 1 },
  { contract_type: 'B', year: '2026', pay_type: 'Cash', amount: 4, profit: 1 },
];

describe('buildCrosstab', () => {
  it('generates row hierarchy, complete column tuples, and metric leaves', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type', 'year'],
      columnFields: ['pay_type'],
      metricFields: ['amount', 'profit'],
      showRowSubtotals: true,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 2,
    });

    expect(result.generatedColumnIds).toEqual([
      '__crosstab_col__string:4:Cash__metric__amount',
      '__crosstab_col__string:4:Cash__metric__profit',
      '__crosstab_col__string:6:Credit__metric__amount',
      '__crosstab_col__string:6:Credit__metric__profit',
    ]);
    expect(result.rowData[0]).toMatchObject({
      contract_type: 'A',
      year: '2026',
      '__crosstab_col__string:4:Cash__metric__amount': 15,
      '__crosstab_col__string:4:Cash__metric__profit': 5,
      '__crosstab_col__string:6:Credit__metric__amount': 7,
      '__crosstab_col__string:6:Credit__metric__profit': 1,
      [CROSSTAB_TOTAL_COLUMN_ID]: 28,
    });
  });

  it('keeps missing generated cells blank and excludes blanks from totals', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });

    expect(result.rowData[1]).toMatchObject({
      contract_type: 'B',
      '__crosstab_col__string:4:Cash__metric__amount': 4,
      '__crosstab_col__string:6:Credit__metric__amount': null,
      [CROSSTAB_TOTAL_COLUMN_ID]: 4,
    });
  });

  it('fails for missing required fields and non-numeric totals', () => {
    expect(() =>
      buildCrosstab(records, {
        rowFields: [],
        columnFields: ['pay_type'],
        metricFields: ['amount'],
        showRowSubtotals: true,
        showRowTotals: true,
        showColumnTotals: true,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 1,
      }),
    ).toThrow('Crosstab rows, columns, and metrics are required.');

    expect(() =>
      buildCrosstab([{ contract_type: 'A', pay_type: 'Cash', amount: 'bad' }], {
        rowFields: ['contract_type'],
        columnFields: ['pay_type'],
        metricFields: ['amount'],
        showRowSubtotals: false,
        showRowTotals: true,
        showColumnTotals: true,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 1,
      }),
    ).toThrow('Crosstab totals require numeric metric values.');
  });
});
```

- [ ] **Step 2: Run engine tests and verify they fail**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts --runInBand
```

Expected: FAIL because `engine.ts` does not exist.

- [ ] **Step 3: Add engine options and constants**

Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`:

```ts
export type CrosstabBuildOptions = {
  rowFields: string[];
  columnFields: string[];
  metricFields: string[];
  showRowSubtotals: boolean;
  showRowTotals: boolean;
  showColumnTotals: boolean;
  showColumnSubtotals: boolean;
  maxGeneratedColumns: number;
  defaultRowExpandedDepth: number;
};
```

- [ ] **Step 4: Implement numeric totals**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/totals.ts`:

```ts
export const ERR_NON_NUMERIC_TOTAL =
  'Crosstab totals require numeric metric values.';

export function numericValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(ERR_NON_NUMERIC_TOTAL);
  }
  return value;
}

export function addNumeric(current: unknown, next: unknown): number | null {
  const left = numericValue(current);
  const right = numericValue(next);
  if (left === null) return right;
  if (right === null) return left;
  return left + right;
}
```

- [ ] **Step 5: Implement the pure engine**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`:

```ts
import type { DataRecord } from '@superset-ui/core';
import type {
  CrosstabBuildOptions,
  CrosstabEngineResult,
} from '../types';
import { buildColumnTuples } from './domain';
import { encodeKey, encodeTuple } from './keys';
import { addNumeric } from './totals';

export const CROSSTAB_ROW_KEY = '__crosstab_row_key';
export const CROSSTAB_ROW_LABEL = '__crosstab_row_label';
export const CROSSTAB_TOTAL_COLUMN_ID = '__crosstab_total';
export const CROSSTAB_COLUMN_PREFIX = '__crosstab_col__';
export const ERR_REQUIRED_FIELDS =
  'Crosstab rows, columns, and metrics are required.';

function metricColumnId(tuple: unknown[], metric: string) {
  return `${CROSSTAB_COLUMN_PREFIX}${encodeTuple(tuple)}__metric__${metric}`;
}

function buildRowKey(record: DataRecord, rowFields: string[]) {
  return encodeTuple(rowFields.map(field => record[field]));
}

export function buildCrosstab(
  records: DataRecord[],
  options: CrosstabBuildOptions,
): CrosstabEngineResult {
  const { rowFields, columnFields, metricFields } = options;
  if (!rowFields.length || !columnFields.length || !metricFields.length) {
    throw new Error(ERR_REQUIRED_FIELDS);
  }

  const columnTuples = buildColumnTuples(
    records,
    columnFields,
    options.maxGeneratedColumns,
  );
  const generatedColumnIds = columnTuples.flatMap(tuple =>
    metricFields.map(metric => metricColumnId(tuple, metric)),
  );
  const rows = new Map<string, DataRecord>();

  records.forEach(record => {
    const rowKey = buildRowKey(record, rowFields);
    const row =
      rows.get(rowKey) ||
      rowFields.reduce<DataRecord>(
        (acc, field) => ({ ...acc, [field]: record[field] }),
        {
          [CROSSTAB_ROW_KEY]: rowKey,
          [CROSSTAB_ROW_LABEL]: String(record[rowFields[rowFields.length - 1]] ?? ''),
        },
      );

    const tuple = columnFields.map(field => record[field]);
    metricFields.forEach(metric => {
      const columnId = metricColumnId(tuple, metric);
      row[columnId] = addNumeric(row[columnId], record[metric]);
    });
    rows.set(rowKey, row);
  });

  const rowData = Array.from(rows.values()).map(row => {
    generatedColumnIds.forEach(columnId => {
      if (!(columnId in row)) {
        row[columnId] = null;
      }
    });

    if (options.showColumnTotals) {
      row[CROSSTAB_TOTAL_COLUMN_ID] = generatedColumnIds.reduce<unknown>(
        (total, columnId) => addNumeric(total, row[columnId]),
        null,
      );
    }

    return row;
  });

  return {
    rowData,
    generatedColumnIds,
    columnTree: [],
    columns: [
      ...rowFields.map(field => ({ key: field, label: field })),
      ...generatedColumnIds.map(columnId => ({ key: columnId, label: columnId })),
      ...(options.showColumnTotals
        ? [{ key: CROSSTAB_TOTAL_COLUMN_ID, label: 'Total' }]
        : []),
    ],
  };
}
```

- [ ] **Step 6: Run engine tests and commit**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts --runInBand
```

Expected: PASS after aligning imports and local type names with the compiler.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/totals.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/engine.test.ts
git commit -m "feat: add crosstab engine"
```

### Task 4: Query Controls And Build Query

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`

- [ ] **Step 1: Add failing build-query tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`:

```ts
import buildQuery from '../../src/plugin/buildQuery';

describe('crosstab buildQuery', () => {
  it('includes row dimensions, column dimensions, and metrics in one aggregate query', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type', 'year'],
      groupbyColumns: ['pay_type'],
      metrics: ['amount', 'profit'],
      adhoc_filters: [
        {
          clause: 'WHERE',
          subject: 'org_id',
          operator: '==',
          comparator: 1,
          expressionType: 'SIMPLE',
        },
      ],
      row_limit: 10000,
      time_range: 'No filter',
    } as never);

    expect(queryContext.queries[0].columns).toEqual([
      'contract_type',
      'year',
      'pay_type',
    ]);
    expect(queryContext.queries[0].metrics).toEqual(['amount', 'profit']);
    expect(queryContext.queries[0].filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 'org_id', op: '==', val: 1 }),
      ]),
    );
  });

  it('rejects server pagination', () => {
    expect(() =>
      buildQuery({
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['contract_type'],
        groupbyColumns: ['pay_type'],
        metrics: ['amount'],
        serverPagination: true,
      } as never),
    ).toThrow('Crosstab table does not support server pagination in v1.');
  });
});
```

- [ ] **Step 2: Run build-query tests and verify the first test fails**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: FAIL until `adhoc_filters`, time range, and group-by fields match Superset query context output.

- [ ] **Step 3: Finalize `buildQuery` field extraction**

Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`:

```ts
import { buildQueryContext } from '@superset-ui/core';
import type { CrosstabFormData } from '../types';

const ERR_SERVER_PAGINATION =
  'Crosstab table does not support server pagination in v1.';

export default function buildQuery(formData: CrosstabFormData) {
  if (formData.serverPagination) {
    throw new Error(ERR_SERVER_PAGINATION);
  }

  const columns = [
    ...(formData.groupbyRows || []),
    ...(formData.groupbyColumns || []),
  ];

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      metrics: formData.metrics || [],
      is_timeseries: false,
      post_processing: [],
    },
  ]);
}
```

- [ ] **Step 4: Finalize controls**

Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx` so the `Crosstab` section uses boolean controls with explicit defaults:

```tsx
[
  {
    name: 'showRowSubtotals',
    config: {
      type: 'CheckboxControl',
      label: t('Show row subtotals'),
      default: true,
    },
  },
],
[
  {
    name: 'showRowTotals',
    config: {
      type: 'CheckboxControl',
      label: t('Show row totals'),
      default: true,
    },
  },
],
[
  {
    name: 'showColumnTotals',
    config: {
      type: 'CheckboxControl',
      label: t('Show column totals'),
      default: true,
    },
  },
],
[
  {
    name: 'showColumnSubtotals',
    config: {
      type: 'CheckboxControl',
      label: t('Show column subtotals'),
      default: false,
    },
  },
],
[
  {
    name: 'defaultRowExpandedDepth',
    config: {
      type: 'TextControl',
      label: t('Default row expanded depth'),
      default: '1',
    },
  },
],
```

- [ ] **Step 5: Run build-query tests and commit**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts
git commit -m "feat: add crosstab query controls"
```

### Task 5: Transform Props And Nested Column Tree

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Add failing transform tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`:

```ts
import transformProps from '../../src/plugin/transformProps';

describe('crosstab transformProps', () => {
  it('converts query data into renderer props', () => {
    const props = transformProps({
      width: 800,
      height: 400,
      formData: {
        groupbyRows: ['contract_type'],
        groupbyColumns: ['pay_type'],
        metrics: ['amount', 'profit'],
        showRowSubtotals: true,
        showRowTotals: true,
        showColumnTotals: true,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 1,
      },
      queriesData: [
        {
          data: [
            { contract_type: 'A', pay_type: 'Cash', amount: 10, profit: 2 },
            { contract_type: 'A', pay_type: 'Credit', amount: 4, profit: 1 },
          ],
        },
      ],
    } as never);

    expect(props.rowData).toHaveLength(1);
    expect(props.columns.map(column => column.key)).toContain('contract_type');
    expect(props.columnTree[0]).toMatchObject({
      label: 'Cash',
      children: [
        expect.objectContaining({ label: 'amount' }),
        expect.objectContaining({ label: 'profit' }),
      ],
    });
  });
});
```

- [ ] **Step 2: Run transform tests and verify they fail**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: FAIL because `transformProps` still returns empty rows and columns.

- [ ] **Step 3: Add column tree creation in the engine**

Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts`:

```ts
function buildColumnTree(columnTuples: unknown[][], metricFields: string[]) {
  return columnTuples.map(tuple => ({
    id: encodeTuple(tuple),
    label: String(tuple[tuple.length - 1] ?? ''),
    children: metricFields.map(metric => ({
      id: metricColumnId(tuple, metric),
      label: metric,
      field: metricColumnId(tuple, metric),
      metric,
    })),
  }));
}
```

Use it in the return object:

```ts
columnTree: buildColumnTree(columnTuples, metricFields),
```

- [ ] **Step 4: Wire `transformProps` to the engine**

Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`:

```ts
import type { ChartProps } from '@superset-ui/core';
import { buildCrosstab } from '../crosstab/engine';
import type { CrosstabChartProps, CrosstabFormData } from '../types';

function names(values: unknown[] | undefined): string[] {
  return (values || []).map(value =>
    typeof value === 'string' ? value : String((value as { label?: string })?.label),
  );
}

export default function transformProps(
  chartProps: ChartProps<CrosstabFormData>,
): CrosstabChartProps {
  const { formData, queriesData } = chartProps;
  const result = buildCrosstab(queriesData?.[0]?.data || [], {
    rowFields: names(formData.groupbyRows as unknown[]),
    columnFields: names(formData.groupbyColumns as unknown[]),
    metricFields: names(formData.metrics as unknown[]),
    showRowSubtotals: formData.showRowSubtotals ?? true,
    showRowTotals: formData.showRowTotals ?? true,
    showColumnTotals: formData.showColumnTotals ?? true,
    showColumnSubtotals: formData.showColumnSubtotals ?? false,
    maxGeneratedColumns: Number(formData.maxGeneratedColumns || 300),
    defaultRowExpandedDepth: Number(formData.defaultRowExpandedDepth || 1),
  });

  return {
    ...chartProps,
    rowData: result.rowData,
    columns: result.columns,
    columnTree: result.columnTree,
  };
}
```

- [ ] **Step 5: Run transform tests and commit**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: PASS after aligning the `names()` helper with Superset metric object shapes used by local tests.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "feat: transform crosstab query data"
```

### Task 6: AG Grid Renderer, Row Hierarchy, And Formatting

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/formatting.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/formatting.test.ts`

- [ ] **Step 1: Add failing formatting tests**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/formatting.test.ts`:

```ts
import { formatCrosstabValue, resolveConditionalStyle } from '../../src/crosstab/formatting';

describe('crosstab formatting', () => {
  it('renders blank missing cells without turning them into zero', () => {
    expect(formatCrosstabValue(null, '.2f')).toBe('');
    expect(formatCrosstabValue(undefined, '.2f')).toBe('');
  });

  it('formats numeric values and resolves conditional styles', () => {
    expect(formatCrosstabValue(12.345, '.2f')).toBe('12.35');
    expect(
      resolveConditionalStyle(12, [
        { operator: '>=', value: 10, color: '#0f766e', arrow: 'up' },
      ]),
    ).toEqual({ color: '#0f766e', arrow: 'up' });
  });
});
```

- [ ] **Step 2: Add failing renderer smoke test**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import CrosstabTable from '../src/CrosstabTable';

describe('CrosstabTable', () => {
  it('renders crosstab rows and generated columns', () => {
    render(
      <CrosstabTable
        width={800}
        height={400}
        rowData={[
          {
            contract_type: 'A',
            '__crosstab_col__string:4:Cash__metric__amount': 12,
          },
        ]}
        columns={[
          { key: 'contract_type', label: 'contract_type' },
          {
            key: '__crosstab_col__string:4:Cash__metric__amount',
            label: 'amount',
          },
        ]}
        columnTree={[]}
        formData={{}}
        queriesData={[]}
      /> as never,
    );

    expect(screen.getByTestId('crosstab-table')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run renderer and formatting tests and verify they fail**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/crosstab/formatting.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: FAIL because formatting does not exist and the renderer still shows static text.

- [ ] **Step 4: Implement formatting utilities**

Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/formatting.ts`:

```ts
import { getNumberFormatter } from '@superset-ui/core';
import type { CrosstabConditionalRule } from '../types';

type ConditionalStyle = {
  color?: string;
  backgroundColor?: string;
  arrow?: 'up' | 'down';
};

function compare(value: number, operator: CrosstabConditionalRule['operator'], target: number) {
  if (operator === '>') return value > target;
  if (operator === '>=') return value >= target;
  if (operator === '<') return value < target;
  if (operator === '<=') return value <= target;
  if (operator === '=') return value === target;
  return value !== target;
}

export function formatCrosstabValue(value: unknown, numberFormat?: string) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'number') {
    return String(value);
  }
  return getNumberFormatter(numberFormat)(value);
}

export function resolveConditionalStyle(
  value: unknown,
  rules: CrosstabConditionalRule[] = [],
): ConditionalStyle {
  if (typeof value !== 'number') {
    return {};
  }

  const rule = rules.find(item => compare(value, item.operator, item.value));
  return rule
    ? {
        color: rule.color,
        backgroundColor: rule.backgroundColor,
        arrow: rule.arrow,
      }
    : {};
}
```

- [ ] **Step 5: Replace static renderer with AG Grid Community**

Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`:

```tsx
import React from 'react';
import { ThemedAgGridReact } from '@superset-ui/core/components';
import {
  AllCommunityModule,
  ClientSideRowModelModule,
  ColDef,
  ModuleRegistry,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { formatCrosstabValue, resolveConditionalStyle } from './crosstab/formatting';
import type { CrosstabChartProps } from './types';

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

export default function CrosstabTable(props: CrosstabChartProps) {
  const { columns, formData, height, rowData, width } = props;
  const columnDefs: ColDef[] = columns.map(column => ({
    field: column.key,
    colId: column.key,
    headerName: column.label,
    valueFormatter: params =>
      formatCrosstabValue(params.value, formData.numberFormat),
    cellStyle: params =>
      resolveConditionalStyle(params.value, formData.conditionalFormatting),
  }));

  return (
    <div data-test="crosstab-table" style={{ height, width }}>
      <ThemedAgGridReact
        columnDefs={columnDefs}
        rowData={rowData}
        suppressMovableColumns={false}
      />
    </div>
  );
}
```

- [ ] **Step 6: Run renderer and formatting tests and commit**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test/crosstab/formatting.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: PASS.

Commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/formatting.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx superset-frontend/plugins/plugin-chart-crosstab-table/test/crosstab/formatting.test.ts
git commit -m "feat: render crosstab table"
```

### Task 7: Full Plugin Validation

**Files:**
- All files changed in Tasks 1-6

- [ ] **Step 1: Run focused plugin test suite**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- plugins/plugin-chart-crosstab-table/test --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check for touched packages**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm run type
```

Expected: PASS, or fail only on pre-existing unrelated baseline errors. If it fails, capture the first failing file and classify whether it is touched by this plan.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm run build
```

Expected: PASS. Vite or webpack chunk-size warnings are acceptable if the build exits 0.

- [ ] **Step 4: Verify the plugin appears in the registry path**

Run:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
npm test -- src/explore/components/controls/VizTypeControl/VizTypeControl.test.tsx --runInBand
```

Expected: PASS. If this test does not cover the new chart type, add a focused assertion in that test file that includes `VizType.CrosstabTable` in the local preset fixture and confirms the control can render its metadata.

- [ ] **Step 5: Commit validation-only adjustments**

If validation required test fixture or type-only adjustments, commit them:

```bash
git add superset-frontend/src/explore/components/controls/VizTypeControl/VizTypeControl.test.tsx superset-frontend/plugins/plugin-chart-crosstab-table
git commit -m "test: validate crosstab chart registration"
```

If no validation-only files changed, do not create an empty commit.

### Task 8: Browser Acceptance Against A Real Superset Instance

**Files:**
- No planned source changes
- Optional evidence output under `docs/superpowers/evidence/`

- [ ] **Step 1: Start or reuse the existing Superset frontend/backend runtime**

Use the repo's established local or remote runtime. Confirm the frontend has the new bundle and the backend has a usable dataset for order-profit daily validation.

Run a lightweight frontend availability check:

```bash
curl -I http://127.0.0.1:9000
```

Expected: HTTP response is returned. If this repo uses a different local port in the active tmux session, use that port and record it in the evidence note.

- [ ] **Step 2: Open Explore and create a temporary crosstab chart**

Use the in-app browser or Playwright against the active Superset URL:

```bash
cd /Users/zewe/Documents/Codex/2026-05-13/ubuntu-docker-apache-superset/superset-source/superset-frontend
PLAYWRIGHT_BASE_URL=http://127.0.0.1:9000 npx playwright test --grep "crosstab"
```

Expected: The test or manual browser flow can select `Crosstab Table` as a chart type.

- [ ] **Step 3: Configure the validation chart**

Use these validation semantics:

```text
Rows: contract type or metric dimension available in the selected dataset
Columns: date and shop
Metrics: one or more numeric metrics
Max generated columns: 300
Show row subtotals: true
Show row totals: true
Show column totals: true
Show column subtotals: false
```

Expected:

```text
Row dimension area renders.
Column dimension area renders nested headers.
Metrics render as the final column level.
Missing generated cells display blank.
Subtotals and totals render.
Dashboard or Explore filters still affect the query.
Generated-column limit errors when the limit is set below the actual generated count.
```

- [ ] **Step 4: Capture acceptance evidence**

Write a short evidence note if the user asks for a report, otherwise include evidence in the final response:

```text
Runtime URL:
Dataset:
Chart type:
Rows:
Columns:
Metrics:
Generated columns:
Observed blanks:
Observed totals:
Filter proof:
Export proof:
Screenshot path:
```

- [ ] **Step 5: Final commit if acceptance required small fixes**

If browser acceptance surfaces a defect in files changed by this plan, fix it with a focused test first, then commit:

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table
git commit -m "fix: stabilize crosstab browser acceptance"
```

If no code changed, do not create an empty commit.

## Self-Review Checklist

- Spec coverage:
  - Standalone plugin: Task 1.
  - FineBI row, column, and value model: Tasks 3, 5, and 6.
  - Query-result-derived column domains: Task 2.
  - Missing cells blank: Tasks 3 and 6.
  - Multiple metrics as final column level: Tasks 3 and 5.
  - Row subtotals, row totals, column totals, and default-off column subtotals: Task 3 with renderer wiring in Task 6.
  - Superset-native filters and time range: Task 4.
  - Generated-column limit: Task 2.
  - V2 exclusions remain out of implementation: no task adds external domain queries, column collapse, custom metric grouping, server pagination, or backend APIs.
- Red-flag scan:
  - The plan contains no banned planning markers or vague repair instructions.
- Type consistency:
  - `CrosstabFormData`, `CrosstabBuildOptions`, and generated ID constants are introduced before use.
  - `buildCrosstab()` returns the fields consumed by `transformProps`.
  - Renderer props match `CrosstabChartProps`.

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-19-crosstab-chart-plugin-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
