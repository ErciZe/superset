# Crosstab V4 Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productize Crosstab V4 calculated fields with chart-local typed primitive AST, number/text parameters, controlled SQL compilation, formal slice 10 save/reload acceptance, and rollback evidence.

**Architecture:** Keep implementation inside `superset-frontend/plugins/plugin-chart-crosstab-table/` plus the existing Explore own-state strip boundary. Replace the current template-only V4 model with canonical `crosstabParameters` and `crosstabCalculatedFields`, compile validated AST into controlled adhoc SQL metrics before dynamic metrics, and keep render code consuming query results only.

**Tech Stack:** React, TypeScript, Jest, React Testing Library, Superset chart controls, `@superset-ui/core`, `@superset-ui/core/components`, production deployment through `agentops` and `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.

---

## File Structure

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Replace template-only calculated-field types with `CrosstabParameter`, `CrosstabExpressionNode`, and AST-backed `CrosstabCalculatedField`.
  - Add canonical form-data keys `crosstabParameters` and `crosstabCalculatedFields`.
  - Retain the old `parameters` and `calculatedFields` keys only as strict legacy inputs while plan tasks migrate readers to the canonical keys; old malformed objects must error instead of being guessed into canonical shape.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts`
  - Normalize canonical number/text parameters.
  - Validate duplicate ids/names, numeric bounds, and text allowed values.
  - Resolve runtime number/text values from own-state when present.
  - Produce a stable parameter signature.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts`
  - Replace template SQL emission with AST validation and SQL emission.
  - Support `metric_ref`, `number_param`, `text_param`, `literal_number`, `literal_text`, `binary_op`, `safe_div`, `pct`, and `ratio`.
  - Emit Doris-safe expressions and reject unsafe references.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
  - Normalize canonical calculated fields.
  - Resolve metric references in the approved order.
  - Detect duplicate ids/names and recursive calculated-field references.
  - Expand calculated fields into `MetricFieldConfig[]`.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx`
  - Replace the single-number control with number/text parameter list management.
  - Support create, edit, and delete with immediate validation.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
  - Replace template drawer flow with a structured AST builder.
  - Support create, edit, duplicate, delete, and metric candidate insertion.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
  - Expose canonical `crosstabParameters` and `crosstabCalculatedFields` controls.
  - Pass datasource metrics and current form data to the controls.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Resolve canonical parameters.
  - Expand AST-backed calculated fields before dynamic metrics.
  - Keep persisted `crosstabFieldConfig.metrics` as the priority metric source.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Use the same calculated-field signature inputs as query generation.
  - Avoid render-time derivation of calculated field definitions.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Render runtime number/text parameter toolbar controls for saved parameter definitions.
  - Keep runtime values in own-state and reset column pagination after parameter changes.

- Modify `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  - Strip number/text runtime parameter values and crosstab-only runtime state from `extra_form_data`.

- Modify tests under:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- Create production evidence after implementation:
  - `docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-acceptance.md`
  - `docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-explore-slice10.png`

---

### Task 1: Canonical V4 Types And Own-State Boundary

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- Test: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- [ ] **Step 1: Write the failing own-state strip test**

Add this test beside the existing crosstab own-state strip tests in `ownState.test.ts`:

```ts
test('strips crosstab v4 runtime parameter state from extra form data', () => {
  expect(
    getFilterOwnState(
      { viz_type: 'crosstab-table' },
      {
        numericParameters: { adjustmentRate: 1.25 },
        textParameters: { countryFilter: 'DE' },
        selectedDynamicMetric: { primary_metric: 'sales' },
        effectiveMetricSignature: 'old-signature',
        currentColumnPage: 2,
        keepMe: 'kept',
      },
    ),
  ).toEqual({ keepMe: 'kept' });
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: FAIL until `textParameters` is stripped.

- [ ] **Step 3: Replace and extend V4 type definitions**

In `types.ts`, replace the current `CrosstabNumberParameter`, `CrosstabCalculatedFieldTemplate`, and `CrosstabCalculatedField` block with this canonical block:

```ts
export type CrosstabNumberParameter = {
  id: string;
  kind: 'number';
  name: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

export type CrosstabTextParameter = {
  id: string;
  kind: 'text';
  name: string;
  label: string;
  defaultValue: string;
  allowedValues?: string[];
};

export type CrosstabParameter =
  | CrosstabNumberParameter
  | CrosstabTextParameter;

export type CrosstabExpressionNode =
  | { kind: 'metric_ref'; metricId: string }
  | { kind: 'number_param'; parameterId: string }
  | { kind: 'text_param'; parameterId: string }
  | { kind: 'literal_number'; value: number }
  | { kind: 'literal_text'; value: string }
  | {
      kind: 'binary_op';
      op: '+' | '-' | '*' | '/';
      left: CrosstabExpressionNode;
      right: CrosstabExpressionNode;
    }
  | {
      kind: 'safe_div';
      numerator: CrosstabExpressionNode;
      denominator: CrosstabExpressionNode;
      defaultValue?: number;
    }
  | {
      kind: 'pct';
      numerator: CrosstabExpressionNode;
      denominator: CrosstabExpressionNode;
    }
  | {
      kind: 'ratio';
      numerator: CrosstabExpressionNode;
      denominator: CrosstabExpressionNode;
    };

export type CrosstabCalculatedField = {
  id: string;
  name: string;
  description?: string;
  resultType: 'number' | 'ratio' | 'percent' | 'text';
  formatString?: string;
  ast: CrosstabExpressionNode;
};
```

In `CrosstabFormData`, add canonical fields and keep current-V4 fields as compatibility inputs:

```ts
crosstabParameters?: CrosstabParameter[] | string;
crosstabCalculatedFields?: CrosstabCalculatedField[] | string;
parameters?: CrosstabParameter[] | string;
calculatedFields?: CrosstabCalculatedField[] | string;
```

In `CrosstabOwnState`, add:

```ts
numericParameters?: Record<string, number>;
textParameters?: Record<string, string>;
```

- [ ] **Step 4: Strip text runtime parameter state**

In `ownState.ts`, add this key to the crosstab runtime strip list:

```ts
'textParameters',
```

Leave existing stripped crosstab keys in place.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
git commit -m "feat(crosstab): add v4 ast form-data types"
```

---

### Task 2: Parameter Normalization And Runtime Resolution

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts`

- [ ] **Step 1: Replace parameter tests with canonical number/text cases**

Replace `parameters.test.ts` with:

```ts
import {
  ERR_CROSSTAB_PARAMETER_CONFIG,
  ERR_CROSSTAB_PARAMETER_VALUE,
  getParameterSignature,
  getCrosstabParameters,
  resolveCrosstabParameters,
} from '../../src/plugin/parameters';
import type { CrosstabFormData, CrosstabOwnState } from '../../src/types';

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  crosstabParameters: [
    {
      id: 'param_adjustment',
      kind: 'number',
      name: 'adjustmentRate',
      label: '调整系数',
      defaultValue: 1,
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      id: 'param_country',
      kind: 'text',
      name: 'countryFilter',
      label: '国家',
      defaultValue: 'DE',
      allowedValues: ['DE', 'FR'],
    },
  ],
};

test('normalizes canonical number and text parameters', () => {
  expect(getCrosstabParameters(formData)).toEqual(formData.crosstabParameters);
});

test('uses defaults when runtime own-state is empty', () => {
  expect(resolveCrosstabParameters(formData, undefined).values).toEqual({
    number: { param_adjustment: 1 },
    text: { param_country: 'DE' },
  });
});

test('uses runtime parameter values from own-state', () => {
  const ownState: CrosstabOwnState = {
    numericParameters: { param_adjustment: 1.25 },
    textParameters: { param_country: 'FR' },
  };

  expect(resolveCrosstabParameters(formData, ownState).values).toEqual({
    number: { param_adjustment: 1.25 },
    text: { param_country: 'FR' },
  });
});

test('rejects duplicate parameter ids and names', () => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: [
        ...(formData.crosstabParameters ?? []),
        {
          id: 'param_country',
          kind: 'text',
          name: 'countryFilter2',
          label: '重复国家',
          defaultValue: 'DE',
        },
      ],
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);

  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: [
        ...(formData.crosstabParameters ?? []),
        {
          id: 'param_country_2',
          kind: 'text',
          name: 'countryFilter',
          label: '重复国家',
          defaultValue: 'DE',
        },
      ],
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('rejects invalid number values', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { param_adjustment: 3 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);

  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { param_adjustment: 1.005 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects text values outside allowed values', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      textParameters: { param_country: 'US' },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('builds a stable signature for sorted runtime values', () => {
  expect(getParameterSignature(resolveCrosstabParameters(formData))).toBe(
    'number:param_adjustment=1|text:param_country=DE',
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts --runInBand
```

Expected: FAIL because `text` values and canonical keys are not implemented.

- [ ] **Step 3: Implement canonical parameter resolver**

Replace `parameters.ts` with:

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
import type {
  CrosstabFormData,
  CrosstabOwnState,
  CrosstabParameter,
} from '../types';

export const ERR_CROSSTAB_PARAMETER_CONFIG = 'ERR_CROSSTAB_PARAMETER_CONFIG';
export const ERR_CROSSTAB_PARAMETER_VALUE = 'ERR_CROSSTAB_PARAMETER_VALUE';

export type ResolvedCrosstabParameters = {
  config: CrosstabParameter[];
  values: {
    number: Record<string, number>;
    text: Record<string, string>;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseParameterInput(
  formData: CrosstabFormData,
): unknown[] {
  const value = formData.crosstabParameters ?? formData.parameters;

  if (value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  if (!Array.isArray(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  return value;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }
  return value;
}

function optionalFinite(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }
  return value;
}

function normalizeParameter(value: unknown): CrosstabParameter {
  if (!isObject(value)) {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  const id = requireString(value.id);
  const name = requireString(value.name);
  const label = requireString(value.label);

  if (value.kind === 'number') {
    if (
      typeof value.defaultValue !== 'number' ||
      !Number.isFinite(value.defaultValue)
    ) {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }
    const min = optionalFinite(value.min);
    const max = optionalFinite(value.max);
    const step = optionalFinite(value.step);
    if ((min !== undefined && max !== undefined && min > max) || (step !== undefined && step <= 0)) {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }
    return {
      id,
      kind: 'number',
      name,
      label,
      defaultValue: value.defaultValue,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
      ...(step === undefined ? {} : { step }),
      ...(optionalString(value.unit) === undefined
        ? {}
        : { unit: optionalString(value.unit) }),
    };
  }

  if (value.kind === 'text') {
    const defaultValue = requireString(value.defaultValue);
    const allowedValues =
      value.allowedValues === undefined
        ? undefined
        : Array.isArray(value.allowedValues)
          ? value.allowedValues.map(requireString)
          : (() => {
              throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
            })();

    if (allowedValues !== undefined && !allowedValues.includes(defaultValue)) {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }

    return {
      id,
      kind: 'text',
      name,
      label,
      defaultValue,
      ...(allowedValues === undefined ? {} : { allowedValues }),
    };
  }

  throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
}

function assertUniqueParameters(parameters: CrosstabParameter[]): void {
  const ids = new Set<string>();
  const names = new Set<string>();
  parameters.forEach(parameter => {
    if (ids.has(parameter.id) || names.has(parameter.name)) {
      throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
    }
    ids.add(parameter.id);
    names.add(parameter.name);
  });
}

export function getCrosstabParameters(
  formData: CrosstabFormData,
): CrosstabParameter[] {
  const parameters = parseParameterInput(formData).map(normalizeParameter);
  assertUniqueParameters(parameters);
  return parameters;
}

function validateNumberValue(parameter: CrosstabParameter, value: number): void {
  if (
    parameter.kind !== 'number' ||
    !Number.isFinite(value) ||
    (parameter.min !== undefined && value < parameter.min) ||
    (parameter.max !== undefined && value > parameter.max)
  ) {
    throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
  }

  if (parameter.step !== undefined) {
    const base = parameter.min ?? 0;
    const quotient = (value - base) / parameter.step;
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
    }
  }
}

function validateTextValue(parameter: CrosstabParameter, value: string): void {
  if (
    parameter.kind !== 'text' ||
    (parameter.allowedValues !== undefined &&
      !parameter.allowedValues.includes(value))
  ) {
    throw new Error(ERR_CROSSTAB_PARAMETER_VALUE);
  }
}

export function resolveCrosstabParameters(
  formData: CrosstabFormData,
  ownState?: CrosstabOwnState,
): ResolvedCrosstabParameters {
  const config = getCrosstabParameters(formData);
  const values: ResolvedCrosstabParameters['values'] = {
    number: {},
    text: {},
  };

  config.forEach(parameter => {
    if (parameter.kind === 'number') {
      const value =
        ownState?.numericParameters?.[parameter.id] ?? parameter.defaultValue;
      validateNumberValue(parameter, value);
      values.number[parameter.id] = value;
      return;
    }

    const value = ownState?.textParameters?.[parameter.id] ?? parameter.defaultValue;
    validateTextValue(parameter, value);
    values.text[parameter.id] = value;
  });

  return { config, values };
}

export function getParameterSignature(
  resolved: ResolvedCrosstabParameters,
): string {
  return [
    ...Object.entries(resolved.values.number)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => `number:${id}=${value}`),
    ...Object.entries(resolved.values.text)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => `text:${id}=${value}`),
  ].join('|');
}
```

- [ ] **Step 4: Run focused parameter tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts
git commit -m "feat(crosstab): normalize v4 chart parameters"
```

---

### Task 3: AST SQL Compiler

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts`

- [ ] **Step 1: Replace compiler tests with AST cases**

Replace `expr.test.ts` with:

```ts
import {
  ERR_CROSSTAB_CALC_DIALECT,
  ERR_CROSSTAB_CALC_FIELD,
  ERR_CROSSTAB_CALC_METRIC,
  emitCalculatedFieldSql,
  validateCalculatedFieldAst,
} from '../../../src/plugin/calc/expr';
import type { CrosstabCalculatedField } from '../../../src/types';

const field = (ast: CrosstabCalculatedField['ast']): CrosstabCalculatedField => ({
  id: 'calc_margin_rate',
  name: '调整毛利率',
  resultType: 'percent',
  formatString: '.2%',
  ast,
});

const args = {
  dialect: 'doris',
  metricSql: {
    sales: 'SUM(sales_amount)',
    profit: 'SUM(gross_profit)',
  },
  parameterValues: {
    number: { param_adjustment: 1.25 },
    text: { param_country: 'DE' },
  },
};

test('emits safe_div for metric references', () => {
  expect(
    emitCalculatedFieldSql(
      field({
        kind: 'safe_div',
        numerator: { kind: 'metric_ref', metricId: 'profit' },
        denominator: { kind: 'metric_ref', metricId: 'sales' },
      }),
      args,
    ),
  ).toBe(
    '(CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END)',
  );
});

test('emits pct as safe division times 100', () => {
  expect(
    emitCalculatedFieldSql(
      field({
        kind: 'pct',
        numerator: { kind: 'metric_ref', metricId: 'profit' },
        denominator: { kind: 'metric_ref', metricId: 'sales' },
      }),
      args,
    ),
  ).toBe(
    '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
  );
});

test('emits arithmetic with number parameters', () => {
  expect(
    emitCalculatedFieldSql(
      field({
        kind: 'binary_op',
        op: '*',
        left: {
          kind: 'ratio',
          numerator: { kind: 'metric_ref', metricId: 'profit' },
          denominator: { kind: 'metric_ref', metricId: 'sales' },
        },
        right: { kind: 'number_param', parameterId: 'param_adjustment' },
      }),
      args,
    ),
  ).toBe(
    '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
  );
});

test('rejects missing metrics and unsafe sql', () => {
  expect(() =>
    emitCalculatedFieldSql(
      field({ kind: 'metric_ref', metricId: 'missing' }),
      args,
    ),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);

  expect(() =>
    emitCalculatedFieldSql(field({ kind: 'metric_ref', metricId: 'bad' }), {
      ...args,
      metricSql: { bad: 'SUM(x); DROP TABLE t' },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test('rejects text parameters inside numeric expressions', () => {
  expect(() =>
    emitCalculatedFieldSql(
      field({
        kind: 'binary_op',
        op: '+',
        left: { kind: 'text_param', parameterId: 'param_country' },
        right: { kind: 'literal_number', value: 1 },
      }),
      args,
    ),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects a literal zero denominator before query compilation', () => {
  expect(() =>
    validateCalculatedFieldAst({
      kind: 'safe_div',
      numerator: { kind: 'metric_ref', metricId: 'profit' },
      denominator: { kind: 'literal_number', value: 0 },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects unsupported dialects', () => {
  expect(() =>
    emitCalculatedFieldSql(field({ kind: 'metric_ref', metricId: 'profit' }), {
      ...args,
      dialect: 'postgres',
    }),
  ).toThrow(ERR_CROSSTAB_CALC_DIALECT);
});
```

- [ ] **Step 2: Run compiler tests to verify failure**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts --runInBand
```

Expected: FAIL because the compiler still expects templates.

- [ ] **Step 3: Replace `expr.ts` with AST compiler**

Replace `expr.ts` with an implementation that has these exports and signatures:

```ts
export const ERR_CROSSTAB_CALC_DIALECT = 'ERR_CROSSTAB_CALC_DIALECT';
export const ERR_CROSSTAB_CALC_FIELD = 'ERR_CROSSTAB_CALC_FIELD';
export const ERR_CROSSTAB_CALC_METRIC = 'ERR_CROSSTAB_CALC_METRIC';

export type CalcSqlDialect = 'doris';

export type EmitCalculatedFieldSqlArgs = {
  dialect: CalcSqlDialect | string;
  metricSql: Record<string, string>;
  parameterValues: {
    number: Record<string, number>;
    text: Record<string, string>;
  };
};

export function validateCalculatedFieldAst(node: CrosstabExpressionNode): void;

export function emitCalculatedFieldSql(
  field: CrosstabCalculatedField,
  args: EmitCalculatedFieldSqlArgs,
): string;
```

Use these implementation rules:

```ts
const unsafeSqlTokenPattern = /(;|--|\/\*|\*\/|'|\{\{|\}\}|\$\{)/;

function safeDiv(leftSql: string, rightSql: string): string {
  return `(CASE WHEN ${rightSql} = 0 THEN NULL ELSE ${leftSql} / ${rightSql} END)`;
}

function emitNode(node: CrosstabExpressionNode, args: EmitCalculatedFieldSqlArgs): {
  sql: string;
  valueType: 'number' | 'text';
} {
  switch (node.kind) {
    case 'metric_ref':
      return { sql: getMetricSql(node.metricId, args.metricSql), valueType: 'number' };
    case 'number_param':
      return {
        sql: String(getFiniteNumberParam(node.parameterId, args.parameterValues.number)),
        valueType: 'number',
      };
    case 'text_param':
      return {
        sql: JSON.stringify(getTextParam(node.parameterId, args.parameterValues.text)),
        valueType: 'text',
      };
    case 'literal_number':
      if (!Number.isFinite(node.value)) throw new Error(ERR_CROSSTAB_CALC_FIELD);
      return { sql: String(node.value), valueType: 'number' };
    case 'literal_text':
      return { sql: JSON.stringify(node.value), valueType: 'text' };
    case 'binary_op': {
      const left = emitNode(node.left, args);
      const right = emitNode(node.right, args);
      if (left.valueType !== 'number' || right.valueType !== 'number') {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      return { sql: `(${left.sql} ${node.op} ${right.sql})`, valueType: 'number' };
    }
    case 'safe_div':
    case 'pct':
    case 'ratio': {
      const numerator = emitNode(node.numerator, args);
      const denominator = emitNode(node.denominator, args);
      if (numerator.valueType !== 'number' || denominator.valueType !== 'number') {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      const ratioSql = safeDiv(numerator.sql, denominator.sql);
      return {
        sql: node.kind === 'pct' ? `(${ratioSql} * 100)` : ratioSql,
        valueType: 'number',
      };
    }
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}
```

Keep `assertDialect('doris')`, reject unsafe SQL from `metricSql`, and have
`validateCalculatedFieldAst` reject `safe_div`/`pct`/`ratio` when the
denominator is `{ kind: 'literal_number', value: 0 }`.

- [ ] **Step 4: Run compiler tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts
git commit -m "feat(crosstab): compile v4 calculated field ast"
```

---

### Task 4: Calculated Field Normalization And Metric Expansion

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`

- [ ] **Step 1: Add failing expansion tests**

Add these tests to `calcFields.test.ts`:

```ts
test('expands canonical ast calculated fields into adhoc sql metrics', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData: {
      viz_type: 'crosstab-table',
      datasource: '7__table',
      crosstabCalculatedFields: [
        {
          id: 'calc_margin_pct',
          name: '毛利率调整',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: { kind: 'metric_ref', metricId: 'profit' },
            denominator: { kind: 'metric_ref', metricId: 'sales' },
          },
        },
      ],
    },
    metricConfigs: [
      {
        metric: {
          expressionType: 'SQL',
          label: 'profit',
          sqlExpression: 'SUM(gross_profit)',
        },
        label: 'profit',
      },
      {
        metric: {
          expressionType: 'SQL',
          label: 'sales',
          sqlExpression: 'SUM(sales_amount)',
        },
        label: 'sales',
      },
      {
        metric: '毛利率调整',
        label: '毛利率调整',
        calculatedFieldId: 'calc_margin_pct',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs).toEqual([
    expect.objectContaining({ label: 'profit' }),
    expect.objectContaining({ label: 'sales' }),
    expect.objectContaining({
      label: '毛利率调整',
      semantic: 'percent',
      formatString: '.2%',
      metric: expect.objectContaining({
        expressionType: 'SQL',
        label: '毛利率调整',
        sqlExpression:
          '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
      }),
    }),
  ]);
});

test('rejects duplicate calculated field ids and names', () => {
  expect(() =>
    getCalculatedFields({
      viz_type: 'crosstab-table',
      datasource: '7__table',
      crosstabCalculatedFields: [
        {
          id: 'dup',
          name: '重复',
          resultType: 'number',
          ast: { kind: 'literal_number', value: 1 },
        },
        {
          id: 'dup',
          name: '重复 2',
          resultType: 'number',
          ast: { kind: 'literal_number', value: 2 },
        },
      ],
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects recursive calculated fields', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        viz_type: 'crosstab-table',
        datasource: '7__table',
        crosstabCalculatedFields: [
          {
            id: 'calc_a',
            name: 'A',
            resultType: 'number',
            ast: { kind: 'metric_ref', metricId: 'calc_b' },
          },
          {
            id: 'calc_b',
            name: 'B',
            resultType: 'number',
            ast: { kind: 'metric_ref', metricId: 'calc_a' },
          },
        ],
      },
      metricConfigs: [],
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts --runInBand
```

Expected: FAIL until canonical `crosstabCalculatedFields` and AST expansion are implemented.

- [ ] **Step 3: Update `calcFields.ts`**

Implement these concrete changes:

```ts
type ExpandCalculatedFieldMetricConfigsArgs = {
  dialect: CalcSqlDialect;
  formData: CrosstabFormData;
  metricConfigs: MetricFieldConfig[];
  parameterValues: EmitCalculatedFieldSqlArgs['parameterValues'];
};
```

Change parsing to read canonical fields first:

```ts
const value =
  formData.crosstabCalculatedFields ?? formData.calculatedFields;
```

Change field assertion to require:

```ts
typeof id === 'string' &&
typeof name === 'string' &&
resultTypes.has(resultType) &&
isObject(ast)
```

When creating the SQL metric, use the user-facing name:

```ts
function calculatedMetric(
  field: CrosstabCalculatedField,
  sqlExpression: string,
): QueryFormMetric {
  return {
    expressionType: 'SQL',
    label: field.name,
    sqlExpression,
  };
}
```

Map result type to semantic:

```ts
function resultTypeToSemantic(
  resultType: CrosstabCalculatedField['resultType'],
): MetricFieldConfig['semantic'] {
  return resultType === 'percent' || resultType === 'ratio'
    ? 'ratio'
    : resultType === 'number'
      ? 'additive'
      : 'unknown';
}
```

Reject duplicate ids/names before expansion and reject cycles by walking
`metric_ref` nodes whose `metricId` matches another calculated field id.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts
git commit -m "feat(crosstab): expand ast calculated metrics"
```

---

### Task 5: Query Integration And Signature Safety

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Update buildQuery tests for canonical AST fields**

In `buildQuery.test.ts`, replace the template-based calculated field fixture with:

```ts
crosstabParameters: [
  {
    id: 'param_adjustment',
    kind: 'number',
    name: 'adjustmentRate',
    label: '调整系数',
    defaultValue: 1,
    min: 0,
    max: 2,
    step: 0.01,
  },
],
crosstabCalculatedFields: [
  {
    id: 'calc_adjusted_margin',
    name: '含参毛利率',
    resultType: 'percent',
    formatString: '.2%',
    ast: {
      kind: 'binary_op',
      op: '*',
      left: {
        kind: 'pct',
        numerator: { kind: 'metric_ref', metricId: 'profit' },
        denominator: { kind: 'metric_ref', metricId: 'sales' },
      },
      right: { kind: 'number_param', parameterId: 'param_adjustment' },
    },
  },
],
crosstabFieldConfig: {
  rows: [{ field: 'metric_name_with_unit' }],
  columns: [{ field: 'biz_date' }],
  metrics: [
    {
      metric: {
        expressionType: 'SQL',
        label: 'profit',
        sqlExpression: 'SUM(gross_profit)',
      },
      label: 'profit',
    },
    {
      metric: {
        expressionType: 'SQL',
        label: 'sales',
        sqlExpression: 'SUM(sales_amount)',
      },
      label: 'sales',
    },
    {
      metric: '含参毛利率',
      label: '含参毛利率',
      calculatedFieldId: 'calc_adjusted_margin',
    },
  ],
},
```

Pass own-state:

```ts
ownState: {
  numericParameters: { param_adjustment: 1.25 },
},
```

Assert the generated metric includes:

```ts
expect(metrics).toContainEqual(
  expect.objectContaining({
    expressionType: 'SQL',
    label: '含参毛利率',
    sqlExpression:
      '(((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100) * 1.25)',
  }),
);
```

- [ ] **Step 2: Update transformProps signature test**

In `transformProps.test.ts`, add a test that changes only `numericParameters.param_adjustment` and expects the effective crosstab metric signature to change. Use the current helper pattern in the file and assert:

```ts
expect(firstProps.formData).not.toEqual(secondProps.formData);
```

or the local exported signature value if the file already exposes one.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: FAIL until buildQuery and transformProps use canonical parameter values.

- [ ] **Step 4: Update query integration**

In `buildQuery.ts`, keep this order:

```ts
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

Do not move dynamic metrics before calculated fields.

- [ ] **Step 5: Update transform props signature inputs**

In `transformProps.ts`, use the same `resolveCrosstabParameters` and
`getCalculatedFieldsSignature` input shape as `buildQuery.ts`. Include both
number and text runtime parameter values in the signature so parameter changes
cannot reuse stale rendered results.

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "feat(crosstab): wire ast calculated fields into queries"
```

---

### Task 6: Product Controls For Parameters And Calculated Fields

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add failing control tests**

Add these tests to `controlPanel.test.ts`:

```ts
it('exposes canonical v4 parameter and calculated field controls', () => {
  expect(getControlConfig('crosstabParameters')).toEqual(
    expect.objectContaining({
      type: 'CrosstabParametersControl',
      label: 'Parameters',
    }),
  );
  expect(getControlConfig('crosstabCalculatedFields')).toEqual(
    expect.objectContaining({
      type: 'CrosstabCalculatedFieldsControl',
      label: 'Calculated fields',
    }),
  );
});

it('creates number and text parameters from the chart control', () => {
  const onChange = jest.fn();

  render(
    createElement(CrosstabParametersControl, {
      name: 'crosstabParameters',
      onChange,
      value: [],
    }),
  );

  fireEvent.click(screen.getByText('Add number parameter'));
  fireEvent.change(screen.getByLabelText('Parameter id'), {
    target: { value: 'param_adjustment' },
  });
  fireEvent.change(screen.getByLabelText('Parameter name'), {
    target: { value: 'adjustmentRate' },
  });
  fireEvent.change(screen.getByLabelText('Parameter label'), {
    target: { value: '调整系数' },
  });
  fireEvent.change(screen.getByLabelText('Parameter default'), {
    target: { value: '1.25' },
  });
  fireEvent.click(screen.getByText('Save parameter'));

  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({
      id: 'param_adjustment',
      kind: 'number',
      name: 'adjustmentRate',
      label: '调整系数',
      defaultValue: 1.25,
    }),
  ]);

  fireEvent.click(screen.getByText('Add text parameter'));
  fireEvent.change(screen.getByLabelText('Parameter id'), {
    target: { value: 'param_country' },
  });
  fireEvent.change(screen.getByLabelText('Parameter name'), {
    target: { value: 'countryFilter' },
  });
  fireEvent.change(screen.getByLabelText('Parameter label'), {
    target: { value: '国家' },
  });
  fireEvent.change(screen.getByLabelText('Parameter default'), {
    target: { value: 'DE' },
  });
  fireEvent.click(screen.getByText('Save parameter'));

  expect(onChange).toHaveBeenLastCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ id: 'param_country', kind: 'text' }),
    ]),
  );
});

it('creates a safe_div calculated field and appends it to metrics', () => {
  const onChange = jest.fn();
  const onControlChange = jest.fn();

  render(
    createElement(CrosstabCalculatedFieldsControl, {
      name: 'crosstabCalculatedFields',
      onChange,
      onControlChange,
      value: [],
      formData: {
        crosstabFieldConfig: {
          rows: [],
          columns: [],
          metrics: [
            { metric: 'sales', label: 'sales' },
            { metric: 'profit', label: 'profit' },
          ],
        },
      },
      savedMetrics: [],
    }),
  );

  fireEvent.click(screen.getByText('New calculated field'));
  fireEvent.change(screen.getByLabelText('Calculated field id'), {
    target: { value: 'calc_margin' },
  });
  fireEvent.change(screen.getByLabelText('Calculated field name'), {
    target: { value: '毛利率' },
  });
  fireEvent.change(screen.getByLabelText('Numerator metric'), {
    target: { value: 'profit' },
  });
  fireEvent.change(screen.getByLabelText('Denominator metric'), {
    target: { value: 'sales' },
  });
  fireEvent.click(screen.getByText('Save calculated field'));

  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      id: 'calc_margin',
      name: '毛利率',
      resultType: 'percent',
      ast: expect.objectContaining({ kind: 'pct' }),
    }),
  ]);
  expect(onControlChange).toHaveBeenCalledWith(
    'crosstabFieldConfig',
    expect.objectContaining({
      metrics: expect.arrayContaining([
        expect.objectContaining({
          calculatedFieldId: 'calc_margin',
          label: '毛利率',
        }),
      ]),
    }),
  );
});
```

- [ ] **Step 2: Run control tests to verify failure**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: FAIL until canonical controls are implemented.

- [ ] **Step 3: Update control names**

In `controlPanel.tsx`, rename the control rows:

```ts
{
  name: 'crosstabParameters',
  config: {
    type: 'CrosstabParametersControl',
    label: t('Parameters'),
    default: [],
    renderTrigger: true,
    description: t('Configure chart-local crosstab parameters.'),
  },
},
{
  name: 'crosstabCalculatedFields',
  config: {
    type: 'CrosstabCalculatedFieldsControl',
    label: t('Calculated fields'),
    default: [],
    renderTrigger: true,
    description: t('Create crosstab calculated fields from safe primitives.'),
    mapStateToProps: ({ datasource, form_data }) => ({
      formData: form_data,
      savedMetrics:
        datasource && 'metrics' in datasource ? datasource.metrics : [],
    }),
  },
},
```

- [ ] **Step 4: Implement parameter list UI**

In `CrosstabParametersControl.tsx`, replace the single-parameter editor with a
list editor that has these visible actions and labels used by the tests:

```tsx
<Button onClick={() => startDraft('number')}>{t('Add number parameter')}</Button>
<Button onClick={() => startDraft('text')}>{t('Add text parameter')}</Button>
<Input aria-label={t('Parameter id')} value={draft.id} onChange={...} />
<Input aria-label={t('Parameter name')} value={draft.name} onChange={...} />
<Input aria-label={t('Parameter label')} value={draft.label} onChange={...} />
<Input aria-label={t('Parameter default')} value={draftDefaultValue} onChange={...} />
<Button onClick={saveDraft}>{t('Save parameter')}</Button>
```

Use `getCrosstabParameters({ crosstabParameters: nextValue } as CrosstabFormData)`
before calling `onChange(nextValue)` so invalid definitions fail before save.

- [ ] **Step 5: Implement calculated field builder UI**

In `CrosstabCalculatedFieldsControl.tsx`, replace template choices with a
safe default builder that creates this AST:

```ts
{
  kind: 'pct',
  numerator: { kind: 'metric_ref', metricId: numeratorMetricId },
  denominator: { kind: 'metric_ref', metricId: denominatorMetricId },
}
```

Use these labels for stable tests and browser acceptance:

```tsx
<Input aria-label={t('Calculated field id')} ... />
<Input aria-label={t('Calculated field name')} ... />
<Select ariaLabel={t('Numerator metric')} ... />
<Select ariaLabel={t('Denominator metric')} ... />
<Button onClick={saveCalculatedField}>{t('Save calculated field')}</Button>
```

On save, call `onChange(nextCalculatedFields)` and `onControlChange('crosstabFieldConfig', nextFieldConfig)` with a metric config:

```ts
{
  metric: field.name,
  label: field.name,
  calculatedFieldId: field.id,
  semantic: 'ratio',
  formatString: field.formatString,
}
```

- [ ] **Step 6: Preserve current duplicate-heading fix**

Keep the current local change in `CrosstabFieldConfigControl.tsx` that removes
the duplicated `label` prop from the inner DnD selects. Keep or add this test:

```ts
expect(screen.getAllByText('Rows')).toHaveLength(1);
expect(screen.getAllByText('Columns')).toHaveLength(1);
expect(screen.getAllByText('Metrics')).toHaveLength(1);
```

- [ ] **Step 7: Run control tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "feat(crosstab): add v4 ast control builders"
```

---

### Task 7: Runtime Toolbar Parameter Controls

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Test: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`

- [ ] **Step 1: Add failing toolbar tests**

Add tests beside the existing numeric parameter toolbar tests:

```ts
it('renders number and text runtime parameters from canonical config', () => {
  renderChart({
    formData: {
      ...baseFormData,
      crosstabParameters: [
        {
          id: 'param_adjustment',
          kind: 'number',
          name: 'adjustmentRate',
          label: '调整系数',
          defaultValue: 1,
          min: 0,
          max: 2,
          step: 0.01,
        },
        {
          id: 'param_country',
          kind: 'text',
          name: 'countryFilter',
          label: '国家',
          defaultValue: 'DE',
          allowedValues: ['DE', 'FR'],
        },
      ],
    },
  });

  expect(
    container.querySelector('[data-test="crosstab-parameter-control--param_adjustment"] input'),
  ).toHaveValue(1);
  expect(
    screen.getByText('国家'),
  ).toBeInTheDocument();
});

it('writes runtime text parameter own-state and resets column pagination', () => {
  const setDataMask = jest.fn();

  renderChart({
    setDataMask,
    ownState: {
      currentColumnPage: 3,
      currentColumnPageSize: 8,
      textParameters: { param_country: 'DE' },
    },
    formData: {
      ...baseFormData,
      crosstabParameters: [
        {
          id: 'param_country',
          kind: 'text',
          name: 'countryFilter',
          label: '国家',
          defaultValue: 'DE',
          allowedValues: ['DE', 'FR'],
        },
      ],
    },
  });

  fireEvent.change(screen.getByLabelText('国家'), {
    target: { value: 'FR' },
  });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      ownState: expect.objectContaining({
        currentColumnPage: 0,
        textParameters: { param_country: 'FR' },
      }),
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: FAIL until canonical parameters are rendered.

- [ ] **Step 3: Update runtime parameter rendering**

In `CrosstabTable.tsx`, replace calls to `getCrosstabNumberParameters` with
`getCrosstabParameters`. Build controls by parameter kind:

```ts
const parameterControls = useMemo(
  () =>
    getCrosstabParameters(formData as CrosstabFormData).map(parameter => ({
      parameter,
      value:
        parameter.kind === 'number'
          ? numericParameters?.[parameter.id] ?? parameter.defaultValue
          : textParameters?.[parameter.id] ?? parameter.defaultValue,
    })),
  [formData, numericParameters, textParameters],
);
```

For number controls, render:

```tsx
<input
  aria-label={label}
  max={parameter.max}
  min={parameter.min}
  onChange={event => updateNumberParameter(parameter, Number(event.target.value))}
  step={parameter.step}
  type="number"
  value={value}
/>
```

For text controls, render a select when `allowedValues` exists:

```tsx
<select
  aria-label={label}
  onChange={event => updateTextParameter(parameter, event.target.value)}
  value={value}
>
  {parameter.allowedValues.map(option => (
    <option key={option} value={option}>
      {option}
    </option>
  ))}
</select>
```

Both update functions must preserve non-pagination own-state and reset:

```ts
currentColumnPage: 0,
currentColumnPageSize: undefined,
serverColumnPageTuples: undefined,
serverColumnPageTuplesPage: undefined,
serverColumnPageTuplesPageSize: undefined,
```

- [ ] **Step 4: Run toolbar tests**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx
git commit -m "feat(crosstab): render v4 runtime parameters"
```

---

### Task 8: Full Frontend Regression Gate

**Files:**
- No source edits expected.

- [ ] **Step 1: Remove macOS AppleDouble metadata if present**

Run:

```bash
find /Volumes/extend/ecode-workspace/superset-source/superset-frontend/plugins/plugin-chart-crosstab-table /Volumes/extend/ecode-workspace/superset-source/superset-frontend/src/explore/components/ExploreViewContainer -name '._*' -type f -delete -print
```

Expected: Either no output or only deleted AppleDouble metadata paths.

- [ ] **Step 2: Run focused Crosstab Jest**

Run:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS. Known non-failing warnings may include duplicate manual mocks, stale Browserslist data, and Node `punycode` deprecation.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
cd superset-frontend && npm run type -- --pretty false
```

Expected: PASS.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Commit validation note if no source changed**

If no files changed during validation, do not create an empty commit. Record the
commands and results for the production acceptance report in Task 10.

---

### Task 9: Production Build And Asset-Only Release

**Files:**
- Build output under `superset/static/assets/`

- [ ] **Step 1: Record release source state**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git rev-list --left-right --count HEAD...fork/noway-release
```

Expected: The implementation commits are local. Note any unrelated dirty files and do not include them in the release payload.

- [ ] **Step 2: Push implementation commits before release**

Run:

```bash
git push fork noway-release:noway-release
```

Expected: `noway-release -> noway-release`.

- [ ] **Step 3: Build frontend assets**

Run:

```bash
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

Expected: webpack compiles successfully. Asset size warnings are acceptable if there are no errors.

- [ ] **Step 4: Back up production assets**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -euo pipefail
ts="$(date +%Y%m%d%H%M%S)"
mkdir -p backups
cp -a superset-source/superset/static/assets "backups/assets-$ts"
printf 'assets_backup=%s\n' "backups/assets-$ts"
REMOTE
```

Expected: prints `assets_backup=backups/assets-<timestamp>`.

- [ ] **Step 5: Sync only frontend assets**

Run:

```bash
rsync -az --delete \
  /Volumes/extend/ecode-workspace/superset-source/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/
```

Expected: exit code `0`.

- [ ] **Step 6: Rebuild production image**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker image ls apache-superset-doris:6.0.0-zh-column-scheme-matrix --format "{{.ID}}" && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'
```

Expected: build exits `0`; record old and new image IDs.

- [ ] **Step 7: Recreate service and wait for health**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset && for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
```

Expected: output ends with `healthy`.

- [ ] **Step 8: Verify HTTP and logs**

Run:

```bash
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
ssh agentops 'cd /home/ubuntu/superset-docker && docker inspect -f "{{.Image}} {{.State.Status}} {{.State.Health.Status}}" apache-superset'
ssh agentops 'cd /home/ubuntu/superset-docker && docker logs --since 15m apache-superset 2>&1 | grep -Ein "error|exception|traceback|critical" | tail -50 || true'
```

Expected: both health commands return `OK`, inspect reports `running healthy`,
and log scan has no new relevant output.

---

### Task 10: Formal Slice 10 Save/Reload Acceptance

**Files:**
- Create: `docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-acceptance.md`
- Create: `docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-explore-slice10.png`

- [ ] **Step 1: Back up slice 10 metadata before mutation**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker exec apache-superset python - <<'"'"'PY'"'"'
import json
from datetime import datetime
from pathlib import Path
from superset import create_app

app = create_app()
with app.app_context():
    from superset.models.slice import Slice
    from superset.extensions import db

    slice_obj = db.session.query(Slice).filter_by(id=10).one()
    payload = {
        "id": slice_obj.id,
        "slice_name": slice_obj.slice_name,
        "viz_type": slice_obj.viz_type,
        "params": slice_obj.params,
        "query_context": slice_obj.query_context,
    }
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    path = Path(f"/tmp/slice-10-crosstab-v4-backup-{ts}.json")
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(path)
PY'
```

Expected: prints `/tmp/slice-10-crosstab-v4-backup-<timestamp>.json`. Copy it locally:

```bash
scp agentops:/tmp/slice-10-crosstab-v4-backup-*.json /Volumes/extend/ecode-workspace/superset-source/docs/superpowers/reports/
```

- [ ] **Step 2: Open production Explore slice 10**

Use the browser to open:

```text
http://111.230.91.24:8088/explore/?dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10
```

Expected: URL remains under `/explore/`, title is `订单利润指标矩阵 - 日维度`, and it does not redirect to `/login/`.

- [ ] **Step 3: Save a formal V4 calculated field in slice 10**

Use the Crosstab controls to save:

```json
{
  "id": "calc_margin_pct_v4",
  "name": "V4验收毛利率",
  "description": "V4 product acceptance calculated field",
  "resultType": "percent",
  "formatString": ".2%",
  "ast": {
    "kind": "pct",
    "numerator": { "kind": "metric_ref", "metricId": "profit" },
    "denominator": { "kind": "metric_ref", "metricId": "sales" }
  }
}
```

If the production datasource exposes different metric ids than `profit` and
`sales`, use the exact ids visible in the metric selector and record them in the
report. Do not write free-form SQL.

- [ ] **Step 4: Add the calculated field to Crosstab metrics and save**

Use the chart save action. Expected result:

- `crosstabCalculatedFields` contains `calc_margin_pct_v4`.
- `crosstabFieldConfig.metrics` contains a metric config with
  `calculatedFieldId: "calc_margin_pct_v4"`.
- The chart re-queries successfully.

- [ ] **Step 5: Reopen slice 10 and verify persistence**

Open the same Explore URL in a fresh browser tab or reload the current tab.

Expected:

- The calculated field still appears in controls.
- The calculated field remains selected as a Crosstab metric.
- The chart renders a table.
- Column pagination remains visible.

- [ ] **Step 6: Capture browser evidence**

Save screenshot to:

```text
docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-explore-slice10.png
```

Record browser evidence:

- final URL;
- chart title;
- calculated field control visible;
- calculated field selected in metrics;
- table visible;
- no visible V4 control errors.

- [ ] **Step 7: Verify chart data API and logs**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker logs --since 30m apache-superset 2>&1 | grep -E "/api/v1/chart/data" | tail -20'
ssh agentops 'cd /home/ubuntu/superset-docker && docker logs --since 30m apache-superset 2>&1 | grep -Ein "error|exception|traceback|critical|ERR_CROSSTAB" | tail -50 || true'
```

Expected: chart data API contains `HTTP/1.1" 200`; error scan has no relevant new output.

- [ ] **Step 8: Write acceptance report**

Create `docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-acceptance.md` with these sections:

```markdown
# Crosstab V4 Product Completion Acceptance

## Verdict

Status: complete

## Source And Release

- Source commit:
- Asset backup:
- Slice 10 metadata backup:
- Old image ID:
- New image ID:

## Local Validation

- Focused Jest:
- TypeScript:
- Build:
- `git diff --check`:

## Production Validation

- Docker health:
- Server-local `/health`:
- Public `/health`:
- Log scan:

## Browser Save/Reload Validation

- URL:
- Chart:
- Calculated field:
- Metrics slot:
- `/api/v1/chart/data`:
- Screenshot:

## Rollback

1. Restore slice 10 `params` and `query_context` from the backup JSON.
2. Rebuild/restart only if asset rollback is required.
3. Re-run `/health`, Explore slice 10, and chart data API checks.
```

Fill every bullet with the actual evidence from Tasks 8-10.

- [ ] **Step 9: Commit acceptance report and screenshot**

```bash
git add docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-acceptance.md docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-explore-slice10.png docs/superpowers/reports/slice-10-crosstab-v4-backup-*.json
git commit -m "docs(crosstab): record v4 product completion acceptance"
git push fork noway-release:noway-release
```

Expected: branch is pushed and `git rev-list --left-right --count HEAD...fork/noway-release` returns `0 0`.

---

## Final Verification Checklist

- [ ] `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand` passes.
- [ ] `npm run type -- --pretty false` passes.
- [ ] `git diff --check` has no output.
- [ ] `BABEL_ENV=testableProduction npm run build` succeeds.
- [ ] Production image is rebuilt and `apache-superset` is `running healthy`.
- [ ] Public and server-local `/health` return `OK`.
- [ ] Formal slice 10 is backed up before mutation.
- [ ] Formal slice 10 is saved with a V4 calculated field.
- [ ] Reopening slice 10 shows the calculated field persisted.
- [ ] `/api/v1/chart/data` returns `200`.
- [ ] Screenshot and report are committed and pushed.
