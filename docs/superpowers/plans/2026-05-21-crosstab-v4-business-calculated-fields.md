# Crosstab V4 Business Calculated Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the V4 business-usable calculated field flow for the crosstab chart: one numeric parameter, three SQL-only templates, right-side drawer configuration, toolbar parameter control, and own-state isolation.

**Architecture:** Keep the feature inside `superset-frontend/plugins/plugin-chart-crosstab-table/`. Add small focused modules for parameter resolution, calculated-field SQL emission, and calculated-field expansion before dynamic metrics are resolved in `buildQuery`; reuse the existing chart data API, summary query plan, and crosstab engine.

**Tech Stack:** React, TypeScript, Jest, React Testing Library, `@superset-ui/core`, `@superset-ui/core/components`, Superset chart controls.

---

## File Structure

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts`
  - Parses persisted number parameter config.
  - Resolves runtime values from `ownState.numericParameters`.
  - Validates `min/max/step`.
  - Produces a stable parameter signature.

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts`
  - Validates calculated-field templates.
  - Emits SQL-only metric expressions for Doris.
  - Rejects unsafe metric labels and unsupported dialects.

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
  - Expands `formData.calculatedFields` into `MetricFieldConfig[]`.
  - Produces adhoc SQL metrics that flow through existing query generation.
  - Builds a stable calculated-field signature.

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx`
  - Explore-side single-number parameter editor.

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
  - Explore-side calculated-field list and right-side drawer editor.
  - Save appends the field to `crosstabFieldConfig.metrics`.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Add V4 persisted types.
  - Add `numericParameters` to chart props and own-state.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Resolve parameters.
  - Expand calculated fields before dynamic metrics.
  - Include parameter/calculated-field signatures in effective metric behavior.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Resolve parameters/calculated fields consistently for render-time props and effective metric signature resets.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
  - Register and expose `parameters` and `calculatedFields` controls.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Render toolbar parameter slider/input.
  - Write `ownState.numericParameters`.
  - Reset column pagination state while preserving `expandedRowPaths`.

- Modify `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  - Strip `numericParameters` for crosstab charts.

- Create tests:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`

- Modify tests:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

---

### Task 1: Add V4 Types And Own-State Isolation

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- Test: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- [ ] **Step 1: Write the failing own-state strip test**

Add this test case to `ownState.test.ts` near the existing crosstab strip cases:

```ts
it('strips crosstab numeric parameter own-state from extra form data', () => {
  expect(
    getFilterOwnState(
      { viz_type: 'crosstab-table' },
      {
        numericParameters: { adjustmentRate: 1.25 },
        selectedDynamicMetric: { primary_metric: 'sales' },
        unrelated: 'kept',
      },
    ),
  ).toEqual({ unrelated: 'kept' });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: FAIL because `numericParameters` is still present in the filtered own-state.

- [ ] **Step 3: Add V4 type definitions**

In `types.ts`, add these definitions after `CrosstabDynamicMetricConfig`:

```ts
export type CrosstabNumberParameter = {
  kind: 'number';
  name: string;
  label?: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export type CrosstabCalculatedFieldTemplate =
  | 'ratio'
  | 'difference'
  | 'parameterized_ratio';

export type CrosstabCalculatedField = {
  id: string;
  label: string;
  template: CrosstabCalculatedFieldTemplate;
  inputs: {
    leftMetric: QueryFormMetric;
    rightMetric: QueryFormMetric;
    parameterName?: string;
  };
  semantic: MetricSemantic;
  formatString?: string;
};
```

Extend `CrosstabFormData`:

```ts
parameters?: CrosstabNumberParameter[] | string;
calculatedFields?: CrosstabCalculatedField[] | string;
```

Extend `CrosstabChartProps`:

```ts
numericParameters?: Record<string, number>;
```

Extend `CrosstabOwnState`:

```ts
numericParameters?: Record<string, number>;
```

Extend `MetricFieldConfig`:

```ts
formatString?: string;
```

- [ ] **Step 4: Strip numeric parameter own-state**

In `ownState.ts`, add the key:

```ts
'numericParameters',
```

inside `CROSSTAB_OWN_STATE_KEYS`.

- [ ] **Step 5: Run the focused test**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
git commit -m "feat(crosstab): add v4 parameter state types"
```

---

### Task 2: Implement Parameter Resolution

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts`

- [ ] **Step 1: Write failing parameter tests**

Create `parameters.test.ts`:

```ts
import {
  ERR_CROSSTAB_PARAMETER_CONFIG,
  ERR_CROSSTAB_PARAMETER_VALUE,
  getParameterSignature,
  resolveCrosstabParameters,
} from '../../src/plugin/parameters';
import type { CrosstabFormData, CrosstabOwnState } from '../../src/types';

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  parameters: [
    {
      kind: 'number',
      name: 'adjustmentRate',
      label: '调整系数',
      default: 1,
      min: 0,
      max: 2,
      step: 0.01,
    },
  ],
};

test('uses the default number parameter when own-state is empty', () => {
  expect(resolveCrosstabParameters(formData, undefined)).toEqual({
    config: formData.parameters,
    values: { adjustmentRate: 1 },
  });
});

test('uses runtime number parameter from own-state', () => {
  const ownState: CrosstabOwnState = {
    numericParameters: { adjustmentRate: 1.25 },
  };

  expect(resolveCrosstabParameters(formData, ownState).values).toEqual({
    adjustmentRate: 1.25,
  });
});

test('rejects values outside min and max', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { adjustmentRate: 3 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects values that do not align to step', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { adjustmentRate: 1.234 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects more than one number parameter in v4 core', () => {
  expect(() =>
    resolveCrosstabParameters(
      {
        ...formData,
        parameters: [
          ...(formData.parameters as never[]),
          { kind: 'number', name: 'otherRate', default: 1 },
        ],
      },
      undefined,
    ),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('creates stable signatures from resolved parameter values', () => {
  const resolved = resolveCrosstabParameters(formData, {
    numericParameters: { adjustmentRate: 1.25 },
  });

  expect(getParameterSignature(resolved)).toBe('adjustmentRate=1.25');
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts --runInBand
```

Expected: FAIL because `parameters.ts` does not exist.

- [ ] **Step 3: Implement `parameters.ts`**

Create `parameters.ts`:

```ts
import type {
  CrosstabFormData,
  CrosstabNumberParameter,
  CrosstabOwnState,
} from '../types';

export const ERR_CROSSTAB_PARAMETER_CONFIG =
  'ERR_CROSSTAB_PARAMETER_CONFIG';
export const ERR_CROSSTAB_PARAMETER_VALUE = 'ERR_CROSSTAB_PARAMETER_VALUE';

export type ResolvedCrosstabParameters = {
  config: CrosstabNumberParameter[];
  values: Record<string, number>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRawParameters(value: CrosstabFormData['parameters']): unknown[] {
  if (value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : (() => {
        throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
      })();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
      }
      throw error;
    }
  }

  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return value;
}

function normalizeNumberParameter(value: unknown): CrosstabNumberParameter {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  const { default: defaultValue, kind, label, max, min, name, step, unit } = value;

  if (
    kind !== 'number' ||
    typeof name !== 'string' ||
    name.length === 0 ||
    typeof defaultValue !== 'number' ||
    !Number.isFinite(defaultValue) ||
    (label !== undefined && typeof label !== 'string') ||
    (unit !== undefined && typeof unit !== 'string') ||
    (min !== undefined && (typeof min !== 'number' || !Number.isFinite(min))) ||
    (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max))) ||
    (step !== undefined && (typeof step !== 'number' || !Number.isFinite(step) || step <= 0))
  ) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  if (min !== undefined && max !== undefined && min > max) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return {
    kind: 'number',
    name,
    ...(label === undefined ? {} : { label }),
    default: defaultValue,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(unit === undefined ? {} : { unit }),
  };
}

export function getCrosstabNumberParameters(
  formData: CrosstabFormData,
): CrosstabNumberParameter[] {
  const parameters = parseRawParameters(formData.parameters).map(
    normalizeNumberParameter,
  );

  if (parameters.length > 1) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return parameters;
}

function assertValidNumberValue(
  parameter: CrosstabNumberParameter,
  value: number,
): void {
  if (!Number.isFinite(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
  }

  if (parameter.min !== undefined && value < parameter.min) {
    throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
  }

  if (parameter.max !== undefined && value > parameter.max) {
    throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
  }

  if (parameter.step !== undefined) {
    const base = parameter.min ?? 0;
    const ratio = (value - base) / parameter.step;
    if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
      throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
    }
  }
}

export function resolveCrosstabParameters(
  formData: CrosstabFormData,
  ownState?: CrosstabOwnState,
): ResolvedCrosstabParameters {
  const config = getCrosstabNumberParameters(formData);
  const values: Record<string, number> = {};

  config.forEach(parameter => {
    const runtimeValue = ownState?.numericParameters?.[parameter.name];
    const value = runtimeValue ?? parameter.default;
    assertValidNumberValue(parameter, value);
    values[parameter.name] = value;
  });

  return { config, values };
}

export function getParameterSignature(
  resolved: ResolvedCrosstabParameters,
): string {
  return Object.keys(resolved.values)
    .sort()
    .map(name => `${name}=${resolved.values[name]}`)
    .join('\u001f');
}
```

- [ ] **Step 4: Run the tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts
git commit -m "feat(crosstab): resolve numeric parameters"
```

---

### Task 3: Implement SQL-Only Calculated Expression Emission

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts`

- [ ] **Step 1: Write failing expression tests**

Create `test/plugin/calc/expr.test.ts`:

```ts
import {
  ERR_CROSSTAB_CALC_DIALECT,
  ERR_CROSSTAB_CALC_FIELD,
  ERR_CROSSTAB_CALC_METRIC,
  emitCalculatedFieldSql,
} from '../../../src/plugin/calc/expr';
import type { CrosstabCalculatedField } from '../../../src/types';

const metricSql = {
  sales: 'SUM(sales_amount)',
  profit: 'SUM(gross_profit)',
};

const ratioField: CrosstabCalculatedField = {
  id: 'gross_margin_rate',
  label: '毛利率',
  template: 'ratio',
  inputs: { leftMetric: 'profit', rightMetric: 'sales' },
  semantic: 'ratio',
  formatString: '.2%',
};

test('emits Doris safe division for ratio template', () => {
  expect(
    emitCalculatedFieldSql(ratioField, {
      dialect: 'doris',
      metricSql,
      parameterValues: {},
    }),
  ).toBe('(CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END)');
});

test('emits difference template', () => {
  expect(
    emitCalculatedFieldSql(
      {
        id: 'profit_delta',
        label: '利润差',
        template: 'difference',
        inputs: { leftMetric: 'profit', rightMetric: 'sales' },
        semantic: 'additive',
      },
      { dialect: 'doris', metricSql, parameterValues: {} },
    ),
  ).toBe('(SUM(gross_profit) - SUM(sales_amount))');
});

test('emits parameterized ratio template', () => {
  expect(
    emitCalculatedFieldSql(
      {
        id: 'adjusted_margin',
        label: '含参毛利率',
        template: 'parameterized_ratio',
        inputs: {
          leftMetric: 'profit',
          rightMetric: 'sales',
          parameterName: 'adjustmentRate',
        },
        semantic: 'ratio',
      },
      {
        dialect: 'doris',
        metricSql,
        parameterValues: { adjustmentRate: 1.25 },
      },
    ),
  ).toBe('((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)');
});

test('rejects unsupported dialects', () => {
  expect(() =>
    emitCalculatedFieldSql(ratioField, {
      dialect: 'postgres',
      metricSql,
      parameterValues: {},
    }),
  ).toThrow(ERR_CROSSTAB_CALC_DIALECT);
});

test('rejects missing metric references', () => {
  expect(() =>
    emitCalculatedFieldSql(
      {
        ...ratioField,
        inputs: { leftMetric: 'missing_metric', rightMetric: 'sales' },
      },
      { dialect: 'doris', metricSql, parameterValues: {} },
    ),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test('rejects parameterized ratio without a parameter name', () => {
  expect(() =>
    emitCalculatedFieldSql(
      {
        ...ratioField,
        template: 'parameterized_ratio',
        inputs: { leftMetric: 'profit', rightMetric: 'sales' },
      },
      { dialect: 'doris', metricSql, parameterValues: { adjustmentRate: 1 } },
    ),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects unsafe SQL metric expressions', () => {
  expect(() =>
    emitCalculatedFieldSql(ratioField, {
      dialect: 'doris',
      metricSql: { ...metricSql, profit: "SUM(profit); DROP TABLE chart" },
      parameterValues: {},
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts --runInBand
```

Expected: FAIL because `calc/expr.ts` does not exist.

- [ ] **Step 3: Implement `calc/expr.ts`**

Create the module:

```ts
import { getMetricLabel } from '@superset-ui/core';
import type { QueryFormMetric } from '@superset-ui/core';
import type { CrosstabCalculatedField } from '../../types';

export const ERR_CROSSTAB_CALC_DIALECT = 'ERR_CROSSTAB_CALC_DIALECT';
export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';
export const ERR_CROSSTAB_CALC_METRIC = 'ERR_CROSSTAB_CALC_METRIC';

export type CalcSqlDialect = 'doris';

export type EmitCalculatedFieldSqlArgs = {
  dialect: CalcSqlDialect | string;
  metricSql: Record<string, string>;
  parameterValues: Record<string, number>;
};

const unsafeSqlTokens = /(;|--|\/\*|\*\/|'|\{\{|\}\}|\$\{)/;

function getMetricKey(metric: QueryFormMetric): string {
  const label = getMetricLabel(metric);
  if (!label) {
    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }
  return label;
}

function getMetricSql(
  metric: QueryFormMetric,
  metricSql: Record<string, string>,
): string {
  const key = getMetricKey(metric);
  const sql = metricSql[key];

  if (!sql || unsafeSqlTokens.test(sql)) {
    throw new Error(ERR_CROSSTAB_CALC_METRIC);
  }

  return sql;
}

function safeDiv(leftSql: string, rightSql: string, dialect: string): string {
  if (dialect !== 'doris') {
    throw new Error(ERR_CROSSTAB_CALC_DIALECT);
  }

  return `(CASE WHEN ${rightSql} = 0 THEN NULL ELSE ${leftSql} / ${rightSql} END)`;
}

function getFiniteParameter(
  name: string | undefined,
  parameterValues: Record<string, number>,
): number {
  if (!name || !Number.isFinite(parameterValues[name])) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  return parameterValues[name];
}

export function emitCalculatedFieldSql(
  field: CrosstabCalculatedField,
  args: EmitCalculatedFieldSqlArgs,
): string {
  if (!field.id || !field.label) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  const leftSql = getMetricSql(field.inputs.leftMetric, args.metricSql);
  const rightSql = getMetricSql(field.inputs.rightMetric, args.metricSql);

  switch (field.template) {
    case 'ratio':
      return safeDiv(leftSql, rightSql, args.dialect);
    case 'difference':
      return `(${leftSql} - ${rightSql})`;
    case 'parameterized_ratio': {
      const parameterValue = getFiniteParameter(
        field.inputs.parameterName,
        args.parameterValues,
      );
      return `(${safeDiv(leftSql, rightSql, args.dialect)} * ${parameterValue})`;
    }
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}
```

- [ ] **Step 4: Run the tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts
git commit -m "feat(crosstab): emit calculated metric SQL"
```

---

### Task 4: Expand Calculated Fields Into Metric Configs

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`

- [ ] **Step 1: Write failing calc field expansion tests**

Create `calcFields.test.ts`:

```ts
import {
  ERR_CROSSTAB_CALC_FIELD,
  expandCalculatedFieldMetricConfigs,
  getCalculatedFieldsSignature,
} from '../../src/plugin/calcFields';
import type {
  CrosstabCalculatedField,
  CrosstabFormData,
  MetricFieldConfig,
} from '../../src/types';

const metricConfigs: MetricFieldConfig[] = [
  {
    metric: {
      expressionType: 'SQL',
      label: 'sales',
      sqlExpression: 'SUM(sales_amount)',
    },
    label: '销售额',
    semantic: 'additive',
  },
  {
    metric: {
      expressionType: 'SQL',
      label: 'profit',
      sqlExpression: 'SUM(gross_profit)',
    },
    label: '毛利',
    semantic: 'additive',
  },
];

const calculatedField: CrosstabCalculatedField = {
  id: 'adjusted_margin',
  label: '含参毛利率',
  template: 'parameterized_ratio',
  inputs: {
    leftMetric: 'profit',
    rightMetric: 'sales',
    parameterName: 'adjustmentRate',
  },
  semantic: 'ratio',
  formatString: '.2%',
};

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  calculatedFields: [calculatedField],
};

test('expands calculated fields into SQL metric configs', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs,
    parameterValues: { adjustmentRate: 1.25 },
  });

  expect(result.metricConfigs).toHaveLength(3);
  expect(result.metricConfigs[2]).toEqual({
    metric: {
      expressionType: 'SQL',
      label: '含参毛利率',
      sqlExpression:
        '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
    },
    label: '含参毛利率',
    semantic: 'ratio',
    formatString: '.2%',
  });
});

test('creates stable signatures including parameter value', () => {
  expect(
    getCalculatedFieldsSignature([calculatedField], {
      adjustmentRate: 1.25,
    }),
  ).toContain('adjusted_margin');
  expect(
    getCalculatedFieldsSignature([calculatedField], {
      adjustmentRate: 1.25,
    }),
  ).toContain('adjustmentRate=1.25');
});

test('rejects duplicate calculated field labels', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        calculatedFields: [{ ...calculatedField, label: '销售额' }],
      },
      metricConfigs,
      parameterValues: { adjustmentRate: 1.25 },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts --runInBand
```

Expected: FAIL because `calcFields.ts` does not exist.

- [ ] **Step 3: Implement `calcFields.ts`**

Create:

```ts
import { getMetricLabel } from '@superset-ui/core';
import type { QueryFormMetric } from '@superset-ui/core';
import type {
  CrosstabCalculatedField,
  CrosstabFormData,
  MetricFieldConfig,
} from '../types';
import { emitCalculatedFieldSql, type CalcSqlDialect } from './calc/expr';

export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';

type ExpandCalculatedFieldMetricConfigsArgs = {
  dialect: CalcSqlDialect;
  formData: CrosstabFormData;
  metricConfigs: MetricFieldConfig[];
  parameterValues: Record<string, number>;
};

function parseCalculatedFields(
  value: CrosstabFormData['calculatedFields'],
): CrosstabCalculatedField[] {
  if (value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      return parsed as CrosstabCalculatedField[];
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      throw error;
    }
  }

  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }

  return value;
}

function getMetricSqlMap(metricConfigs: MetricFieldConfig[]): Record<string, string> {
  return metricConfigs.reduce<Record<string, string>>((sqlByLabel, config) => {
    const label = getMetricLabel(config.metric);
    const metric = config.metric as { sqlExpression?: unknown };

    if (label && typeof metric.sqlExpression === 'string') {
      return { ...sqlByLabel, [label]: metric.sqlExpression };
    }

    return sqlByLabel;
  }, {});
}

function assertNoDuplicateLabels(
  metricConfigs: MetricFieldConfig[],
  calculatedFields: CrosstabCalculatedField[],
): void {
  const labels = new Set(
    metricConfigs.flatMap(config => {
      const label = config.label ?? getMetricLabel(config.metric);
      return label ? [label] : [];
    }),
  );

  calculatedFields.forEach(field => {
    if (!field.id || !field.label || labels.has(field.label)) {
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
    }
    labels.add(field.label);
  });
}

function calculatedMetric(field: CrosstabCalculatedField, sqlExpression: string): QueryFormMetric {
  return {
    expressionType: 'SQL',
    label: field.label,
    sqlExpression,
  } as QueryFormMetric;
}

export function getCalculatedFields(formData: CrosstabFormData): CrosstabCalculatedField[] {
  return parseCalculatedFields(formData.calculatedFields);
}

export function expandCalculatedFieldMetricConfigs({
  dialect,
  formData,
  metricConfigs,
  parameterValues,
}: ExpandCalculatedFieldMetricConfigsArgs): { metricConfigs: MetricFieldConfig[] } {
  const calculatedFields = getCalculatedFields(formData);
  const metricSql = getMetricSqlMap(metricConfigs);

  assertNoDuplicateLabels(metricConfigs, calculatedFields);

  const calculatedMetricConfigs = calculatedFields.map(field => ({
    metric: calculatedMetric(
      field,
      emitCalculatedFieldSql(field, {
        dialect,
        metricSql,
        parameterValues,
      }),
    ),
    label: field.label,
    semantic: field.semantic,
    ...(field.formatString === undefined ? {} : { formatString: field.formatString }),
  }));

  return {
    metricConfigs: [...metricConfigs, ...calculatedMetricConfigs],
  };
}

export function getCalculatedFieldsSignature(
  calculatedFields: CrosstabCalculatedField[],
  parameterValues: Record<string, number>,
): string {
  const fields = calculatedFields
    .map(field => JSON.stringify(field, Object.keys(field).sort()))
    .join('\u001f');
  const parameters = Object.keys(parameterValues)
    .sort()
    .map(name => `${name}=${parameterValues[name]}`)
    .join('\u001f');

  return `${fields}\u001e${parameters}`;
}
```

- [ ] **Step 4: Run the calc field tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts
git commit -m "feat(crosstab): expand calculated fields"
```

---

### Task 5: Wire Parameters And Calculated Fields Into Query Planning

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Add failing buildQuery coverage**

Add this case to `buildQuery.test.ts`:

```ts
it('includes calculated SQL metrics using runtime parameter values', () => {
  const queryContext = buildQuery(
    {
      datasource: '7__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['category'],
      groupbyColumns: ['biz_date'],
      crosstabFieldConfig: {
        rows: [{ field: 'category' }],
        columns: [{ field: 'biz_date' }],
        metrics: [
          {
            metric: {
              expressionType: 'SQL',
              label: 'sales',
              sqlExpression: 'SUM(sales_amount)',
            },
            label: '销售额',
            semantic: 'additive',
          },
          {
            metric: {
              expressionType: 'SQL',
              label: 'profit',
              sqlExpression: 'SUM(gross_profit)',
            },
            label: '毛利',
            semantic: 'additive',
          },
        ],
      },
      parameters: [
        {
          kind: 'number',
          name: 'adjustmentRate',
          default: 1,
          min: 0,
          max: 2,
          step: 0.01,
        },
      ],
      calculatedFields: [
        {
          id: 'adjusted_margin',
          label: '含参毛利率',
          template: 'parameterized_ratio',
          inputs: {
            leftMetric: 'profit',
            rightMetric: 'sales',
            parameterName: 'adjustmentRate',
          },
          semantic: 'ratio',
          formatString: '.2%',
        },
      ],
    },
    {
      ownState: {
        numericParameters: { adjustmentRate: 1.25 },
      },
    },
  );

  expect(queryContext.queries[0].metrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        expressionType: 'SQL',
        label: '含参毛利率',
        sqlExpression:
          '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
      }),
    ]),
  );
});
```

- [ ] **Step 2: Add failing transformProps coverage**

Add a case to `transformProps.test.ts` that asserts `effectiveMetricSignature` changes when `numericParameters.adjustmentRate` changes:

```ts
it('includes numeric parameter values in effective metric signature', () => {
  const baseProps = createProps({
    formData: {
      groupbyRows: ['category'],
      groupbyColumns: ['biz_date'],
      crosstabFieldConfig: {
        rows: [{ field: 'category' }],
        columns: [{ field: 'biz_date' }],
        metrics: [
          {
            metric: {
              expressionType: 'SQL',
              label: 'sales',
              sqlExpression: 'SUM(sales_amount)',
            },
            semantic: 'additive',
          },
          {
            metric: {
              expressionType: 'SQL',
              label: 'profit',
              sqlExpression: 'SUM(gross_profit)',
            },
            semantic: 'additive',
          },
        ],
      },
      parameters: [
        {
          kind: 'number',
          name: 'adjustmentRate',
          default: 1,
          min: 0,
          max: 2,
          step: 0.01,
        },
      ],
      calculatedFields: [
        {
          id: 'adjusted_margin',
          label: '含参毛利率',
          template: 'parameterized_ratio',
          inputs: {
            leftMetric: 'profit',
            rightMetric: 'sales',
            parameterName: 'adjustmentRate',
          },
          semantic: 'ratio',
        },
      ],
    },
    queriesData: [
      {
        data: [],
        colnames: [],
        coltypes: [],
      },
    ],
  });

  const signatureA = transformProps({
    ...baseProps,
    ownState: { numericParameters: { adjustmentRate: 1 } },
  }).effectiveMetricSignature;
  const signatureB = transformProps({
    ...baseProps,
    ownState: { numericParameters: { adjustmentRate: 1.25 } },
  }).effectiveMetricSignature;

  expect(signatureA).not.toBe(signatureB);
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: FAIL because `buildQuery` and `transformProps` do not expand calculated fields yet.

- [ ] **Step 4: Wire the modules into `buildQuery.ts`**

Import:

```ts
import { expandCalculatedFieldMetricConfigs } from './calcFields';
import { resolveCrosstabParameters } from './parameters';
```

Replace the current dynamic metric input setup with:

```ts
  const persistedMetricConfigs = getPersistedCrosstabMetricConfigs(formData);
  const baseMetricConfigs: MetricFieldConfig[] = persistedMetricConfigs.length
    ? persistedMetricConfigs
    : ensureIsArray<QueryFormMetric>(formData.metrics).map(metric => ({
        metric,
      }));
  const resolvedParameters = resolveCrosstabParameters(
    formData,
    options?.ownState as DynamicOwnState | undefined,
  );
  const calculatedMetricResult = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs: baseMetricConfigs,
    parameterValues: resolvedParameters.values,
  });
  const dynamicMetricResult = resolveDynamicMetricConfigs({
    formData,
    metricConfigs: calculatedMetricResult.metricConfigs,
    ownState: options?.ownState as DynamicOwnState | undefined,
  });
```

- [ ] **Step 5: Wire the same resolution into `transformProps.ts`**

Use the same resolution order as `buildQuery.ts`: persisted metrics, parameters, calculated fields, dynamic metrics. The exact block should keep existing `dynamicMetricResult` consumers intact:

```ts
  const resolvedParameters = resolveCrosstabParameters(
    formData,
    crosstabOwnState,
  );
  const calculatedMetricResult = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs: baseMetricConfigs,
    parameterValues: resolvedParameters.values,
  });
  const dynamicMetricResult = resolveDynamicMetricConfigs({
    formData,
    metricConfigs: calculatedMetricResult.metricConfigs,
    ownState: crosstabOwnState,
  });
```

Pass `numericParameters: resolvedParameters.values` through returned props so the toolbar can render the current value.

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "feat(crosstab): query calculated fields with parameters"
```

---

### Task 6: Add Explore Controls For Parameters And Calculated Fields

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add failing control panel tests**

Extend the main control list expectation in `controlPanel.test.ts`:

```ts
expect(controlNames).toEqual(
  expect.arrayContaining([
    'parameters',
    'calculatedFields',
  ]),
);
```

Add a registration test:

```ts
it('exposes v4 parameter and calculated field controls', () => {
  expect(getControlConfig('parameters')).toEqual(
    expect.objectContaining({
      type: 'CrosstabParametersControl',
      label: 'Parameters',
      default: [],
      renderTrigger: true,
    }),
  );
  expect(getControlConfig('calculatedFields')).toEqual(
    expect.objectContaining({
      type: 'CrosstabCalculatedFieldsControl',
      label: 'Calculated fields',
      default: [],
      renderTrigger: true,
    }),
  );
});
```

Add a basic render test for the parameter control:

```ts
it('renders the single number parameter control', () => {
  render(
    createElement(CrosstabParametersControl, {
      name: 'parameters',
      onChange: jest.fn(),
      value: [],
    }),
  );

  expect(screen.getByText('Number parameter')).toBeInTheDocument();
  expect(screen.getByDisplayValue('adjustmentRate')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: FAIL because controls do not exist.

- [ ] **Step 3: Implement `CrosstabParametersControl.tsx`**

Create a controlled component with this behavior:

```tsx
import React, { useMemo } from 'react';
import { Input } from '@superset-ui/core/components';
import type { CrosstabNumberParameter } from '../types';

type Props = {
  name: string;
  value?: CrosstabNumberParameter[];
  onChange: (value: CrosstabNumberParameter[]) => void;
};

const defaultParameter: CrosstabNumberParameter = {
  kind: 'number',
  name: 'adjustmentRate',
  label: '调整系数',
  default: 1,
  min: 0,
  max: 2,
  step: 0.01,
};

export default function CrosstabParametersControl({
  value,
  onChange,
}: Props) {
  const parameter = useMemo(() => value?.[0] ?? defaultParameter, [value]);

  return (
    <div>
      <strong>Number parameter</strong>
      <Input
        aria-label="Parameter name"
        value={parameter.name}
        onChange={event =>
          onChange([{ ...parameter, name: event.target.value }])
        }
      />
    </div>
  );
}
```

After this minimal pass, extend the component in the same task with inputs for `label`, `default`, `min`, `max`, and `step`, each writing a number through `Number(event.target.value)`.

- [ ] **Step 4: Implement `CrosstabCalculatedFieldsControl.tsx`**

Create a controlled component that renders a `New calculated field` button and a drawer. The save action updates both form-data fields:

- `onChange([...value, field])` for `calculatedFields`.
- `actions.setControlValue('crosstabFieldConfig', nextFieldConfig)` so the calculated field is immediately appended to `crosstabFieldConfig.metrics`.

```tsx
import React, { useState } from 'react';
import { Button, Drawer, Input, Select } from '@superset-ui/core/components';
import { getMetricLabel } from '@superset-ui/core';
import type { QueryFormData, QueryFormMetric } from '@superset-ui/core';
import type {
  CrosstabCalculatedField,
  CrosstabFieldConfig,
  MetricFieldConfig,
} from '../types';

type Props = {
  value?: CrosstabCalculatedField[];
  onChange: (value: CrosstabCalculatedField[]) => void;
  savedMetrics?: MetricFieldConfig[];
  formData?: QueryFormData;
  actions?: {
    setControlValue?: (control: string, value: unknown) => void;
  };
};

const templateOptions = [
  { label: '比率', value: 'ratio' },
  { label: '差值', value: 'difference' },
  { label: '含参比率', value: 'parameterized_ratio' },
];

export default function CrosstabCalculatedFieldsControl({
  actions,
  formData,
  savedMetrics = [],
  value = [],
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('含参毛利率');
  const [template, setTemplate] =
    useState<CrosstabCalculatedField['template']>('parameterized_ratio');
  const metricOptions = savedMetrics.flatMap(metricConfig => {
    const metricLabel = getMetricLabel(metricConfig.metric);
    return metricLabel ? [{ label: metricConfig.label ?? metricLabel, value: metricLabel }] : [];
  });
  const [leftMetric, setLeftMetric] = useState(metricOptions[0]?.value ?? '');
  const [rightMetric, setRightMetric] = useState(metricOptions[1]?.value ?? '');

  const save = () => {
    const field: CrosstabCalculatedField = {
      id: label,
      label,
      template,
      inputs: {
        leftMetric: leftMetric as QueryFormMetric,
        rightMetric: rightMetric as QueryFormMetric,
        ...(template === 'parameterized_ratio'
          ? { parameterName: 'adjustmentRate' }
          : {}),
      },
      semantic: template === 'difference' ? 'additive' : 'ratio',
      formatString: template === 'difference' ? undefined : '.2%',
    };
    const crosstabFieldConfig =
      ((formData as { crosstabFieldConfig?: CrosstabFieldConfig } | undefined)
        ?.crosstabFieldConfig ?? {}) as CrosstabFieldConfig;
    const nextFieldConfig: CrosstabFieldConfig = {
      ...crosstabFieldConfig,
      metrics: [
        ...(crosstabFieldConfig.metrics ?? []),
        {
          metric: field.label as QueryFormMetric,
          label: field.label,
          semantic: field.semantic,
          ...(field.formatString === undefined
            ? {}
            : { formatString: field.formatString }),
        },
      ],
    };

    onChange([...value, field]);
    actions?.setControlValue?.('crosstabFieldConfig', nextFieldConfig);
    setOpen(false);
  };

  return (
    <div>
      <Button buttonSize="small" onClick={() => setOpen(true)}>
        New calculated field
      </Button>
      <Drawer
        title="Calculated field"
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
      >
        <Input
          aria-label="Calculated field name"
          value={label}
          onChange={event => setLabel(event.target.value)}
        />
        <Select
          ariaLabel="Calculated field template"
          allowSelectAll={false}
          options={templateOptions}
          value={template}
          onChange={nextTemplate =>
            setTemplate(nextTemplate as CrosstabCalculatedField['template'])
          }
        />
        <Select
          ariaLabel="Metric A"
          allowSelectAll={false}
          options={metricOptions}
          value={leftMetric}
          onChange={nextMetric => setLeftMetric(nextMetric as string)}
        />
        <Select
          ariaLabel="Metric B"
          allowSelectAll={false}
          options={metricOptions}
          value={rightMetric}
          onChange={nextMetric => setRightMetric(nextMetric as string)}
        />
        <pre data-test="crosstab-calculated-field-sql-preview">
          SQL preview is generated after metric selection
        </pre>
        <Button buttonSize="small" onClick={save}>
          Save
        </Button>
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 5: Register controls in `controlPanel.tsx`**

Import both components, add them to `sharedControlComponents`, and insert the controls after `dynamicMetric`:

```ts
import CrosstabCalculatedFieldsControl from './CrosstabCalculatedFieldsControl';
import CrosstabParametersControl from './CrosstabParametersControl';

Object.assign(sharedControlComponents as Record<string, unknown>, {
  CrosstabDynamicGroupByControl,
  CrosstabDynamicMetricControl,
  CrosstabParametersControl,
  CrosstabCalculatedFieldsControl,
});
```

Add control rows:

```ts
[
  {
    name: 'parameters',
    config: {
      type: 'CrosstabParametersControl',
      label: t('Parameters'),
      default: [],
      renderTrigger: true,
      description: t('Configure chart-local numeric parameters.'),
    },
  },
],
[
  {
    name: 'calculatedFields',
    config: {
      type: 'CrosstabCalculatedFieldsControl',
      label: t('Calculated fields'),
      default: [],
      renderTrigger: true,
      description: t('Create SQL-backed crosstab calculated fields.'),
      mapStateToProps: ({ datasource, form_data }) => ({
        formData: form_data,
        savedMetrics:
          datasource && 'metrics' in datasource ? datasource.metrics : [],
      }),
    },
  },
],
```

- [ ] **Step 6: Run the control tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "feat(crosstab): add v4 explore controls"
```

---

### Task 7: Render Toolbar Parameter Control

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`

- [ ] **Step 1: Add failing toolbar tests**

Add a test near the dynamic metric toolbar tests:

```tsx
it('renders a numeric parameter control and writes own-state on change', async () => {
  const setDataMask = jest.fn();

  render(
    <CrosstabTable
      {...baseProps}
      formData={{
        ...baseProps.formData,
        parameters: [
          {
            kind: 'number',
            name: 'adjustmentRate',
            label: '调整系数',
            default: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
      }}
      numericParameters={{ adjustmentRate: 1 }}
      ownState={{
        currentColumnPage: 2,
        currentColumnPageSize: 8,
        expandedRowPaths: ['category::A'],
      }}
      setDataMask={setDataMask}
    />,
  );

  const input = screen.getByLabelText('调整系数');
  fireEvent.change(input, { target: { value: '1.25' } });

  expect(setDataMask).toHaveBeenCalledWith({
    ownState: expect.objectContaining({
      numericParameters: { adjustmentRate: 1.25 },
      currentColumnPage: 0,
      serverColumnPageTuples: [],
      expandedRowPaths: ['category::A'],
    }),
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: FAIL because no toolbar parameter input exists.

- [ ] **Step 3: Add parameter selectors in `CrosstabTable.tsx`**

Import parameter parsing:

```ts
import { getCrosstabNumberParameters } from './plugin/parameters';
```

Build the parameter control list:

```tsx
const numericParameterControls = useMemo(
  () =>
    getCrosstabNumberParameters(formData).map(parameter => {
      const value =
        numericParameters?.[parameter.name] ?? parameter.default;

      return { parameter, value };
    }),
  [formData, numericParameters],
);
```

Add update handler:

```tsx
const updateNumericParameter = useCallback(
  (name: string, value: number) => {
    setDataMask?.({
      ownState: {
        ...ownState,
        numericParameters: {
          ...(ownState?.numericParameters ?? {}),
          [name]: value,
        },
        currentColumnPage: 0,
        currentColumnPageSize: effectiveColumnsPerPage,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: effectiveColumnsPerPage,
      },
    });
  },
  [effectiveColumnsPerPage, ownState, setDataMask],
);
```

Render after dynamic metric selects:

```tsx
{numericParameterControls.map(({ parameter, value }) => (
  <div
    key={parameter.name}
    data-test={`crosstab-parameter-control--${parameter.name}`}
    style={{
      alignItems: 'center',
      display: 'inline-flex',
      gap: theme.sizeUnit,
    }}
  >
    <span>{parameter.label ?? parameter.name}</span>
    <input
      aria-label={parameter.label ?? parameter.name}
      type="number"
      min={parameter.min}
      max={parameter.max}
      step={parameter.step}
      value={value}
      onChange={event =>
        updateNumericParameter(parameter.name, Number(event.target.value))
      }
    />
  </div>
))}
```

- [ ] **Step 4: Run the toolbar test**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
git commit -m "feat(crosstab): render parameter toolbar control"
```

---

### Task 8: Run Focused Regression And Production Build

**Files:**
- Read-only validation.

- [ ] **Step 1: Run focused V4 tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: all listed suites PASS.

- [ ] **Step 2: Run tracked crosstab plugin tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest $(git -C .. ls-files 'superset-frontend/plugins/plugin-chart-crosstab-table/test/**/*.test.*' 'superset-frontend/plugins/plugin-chart-crosstab-table/test/*.test.*' 'superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts' | sed 's#^superset-frontend/##') --runInBand
```

Expected: all tracked crosstab suites PASS. This avoids untracked macOS AppleDouble `._*` files being picked up as test suites.

- [ ] **Step 3: Run ESLint**

Run:

```bash
cd superset-frontend && npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.ts src/explore/components/ExploreViewContainer/ownState.test.ts
```

Expected: PASS with no new errors.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
cd superset-frontend && npm run type -- --pretty false
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

Expected: webpack build completes successfully. Existing asset-size warnings are not V4 blockers.

- [ ] **Step 6: Commit validation report if a report file is updated**

If implementation creates or updates a V4 acceptance report, commit only the report and relevant screenshots:

```bash
git add docs/superpowers/reports/2026-05-21-crosstab-v4-*.md docs/superpowers/reports/2026-05-21-crosstab-v4-*.png
git commit -m "docs(crosstab): record v4 repository acceptance"
```

If no report file is created, do not create an empty documentation commit.

---

## Self-Review

- Spec coverage: the plan includes type/state boundaries, parameter parsing, SQL-only calculated field emission, metric expansion before dynamic metrics, Explore controls, toolbar control, own-state isolation, and repository validation.
- Scope check: slice 10 matrix-row support remains out of scope for this V4 core plan and is not implemented here.
- No backend API is added.
- No free SQL or Jinja field is added.
- No text parameter or multi-parameter UI is added.
- No AG Grid Enterprise feature is introduced.
