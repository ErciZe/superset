# Crosstab V4 Contract Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Crosstab V4 around one numeric-only canonical contract so save/reload, query compilation, render state, and slice 10 acceptance all resolve from the same persisted truth.

**Architecture:** Keep the source changes inside `superset-frontend/plugins/plugin-chart-crosstab-table/` plus the existing Explore own-state strip boundary. Add one shared V4 contract guard, remove legacy/template-era V4 compatibility from the frontend path, and make the controls clear `metrics`, `parameters`, and `calculatedFields` whenever canonical V4 definitions are edited so saved charts stop carrying split truth.

**Tech Stack:** Apache Superset frontend plugin, React, TypeScript, Jest, React Testing Library, `@superset-ui/core`, Explore control registry, Docker-based production acceptance on slice 10.

---

## File Structure

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
  - Collapse the V4 contract to numeric-only `CrosstabParameter`, AST-backed `CrosstabCalculatedField`, and numeric-only `CrosstabOwnState`.
  - Keep `parameters` and `calculatedFields` only as reject-only inputs typed as `unknown`, so stale saved metadata can fail fast instead of being silently migrated.

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/v4Contract.ts`
  - Hold the shared helpers that detect canonical V4 usage and reject legacy V4 inputs.
  - Export one shared error constant so parameter parsing, calculated-field parsing, query build, render, and control writers fail with the same contract boundary.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts`
  - Normalize only canonical number parameters.
  - Reject `kind: 'text'` and reject the legacy `formData.parameters` surface.
  - Return numeric-only runtime values and numeric-only signatures.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts`
  - Keep only numeric AST nodes and the AST compiler API.
  - Remove template-era compiler paths and remove text-node handling from stage 2.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
  - Add a strict helper that requires `crosstabFieldConfig.metrics` whenever canonical V4 is active.
  - Preserve legacy fallback only for non-V4 crosstab charts.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
  - Parse only canonical `crosstabCalculatedFields`.
  - Reject legacy `calculatedFields`.
  - Validate metric refs and parameter refs against the approved metric/parameter sources.
  - Stop overlaying `formData.metrics` inside the V4 compiler path.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
  - Use the strict V4 metric-config gate.
  - Compile only validated canonical fields.
  - Reject split-truth V4 state instead of falling back to top-level `metrics`.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
  - Reuse the same strict metric gate and numeric-only parameter signature as `buildQuery`.
  - Pass only numeric runtime parameter values to the renderer.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx`
  - Keep only number-parameter creation/editing.
  - Add `min`, `max`, `step`, and `unit` inputs.
  - Clear the hidden legacy `parameters` control on every successful write.

- Create `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/builder.ts`
  - Hold the numeric-only calculated-field draft types, AST conversion, validation summary, preview formatting, and duplicate helper for the structured control UI.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
  - Switch from the fixed pct-only drawer to the structured numeric AST builder.
  - Add duplicate flow.
  - Clear `calculatedFields` and hidden top-level `metrics` on every successful write.
  - Keep `crosstabFieldConfig.metrics` synchronized through `calculatedFieldId`.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx`
  - Clear hidden top-level `metrics` whenever canonical V4 metric selection is active.

- Modify `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
  - Render only numeric runtime parameters.
  - Write only `numericParameters` into own-state.
  - Preserve the current pagination/cache reset behavior for parameter changes.

- Modify `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  - Continue stripping crosstab runtime state, including stale `textParameters`, before `extra_form_data` merge.

- Modify tests:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
  - `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- Create acceptance artifacts:
  - `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-acceptance.md`
  - `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-explore-slice10.png`
  - `docs/superpowers/reports/slice-10-crosstab-v4-contract-reorg-backup-*.json`

---

### Task 1: Add The Shared V4 Contract Guard

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/v4Contract.ts`
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- Modify: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- Test: `superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Create `test/plugin/v4Contract.test.ts` with:

```ts
import type { CrosstabFormData } from '../../src/types';
import {
  ERR_CROSSTAB_V4_LEGACY_INPUT,
  assertNoLegacyV4Inputs,
  hasCanonicalV4Definitions,
} from '../../src/plugin/v4Contract';

function formData(overrides: Partial<CrosstabFormData> = {}): CrosstabFormData {
  return {
    datasource: '7__table',
    viz_type: 'crosstab-table',
    ...overrides,
  };
}

test('rejects legacy V4 parameters and calculatedFields surfaces', () => {
  expect(() =>
    assertNoLegacyV4Inputs(
      formData({
        parameters: [{ kind: 'number', name: 'legacyRate', default: 1 }],
        calculatedFields: [{ id: 'legacy_calc' }],
      } as never),
    ),
  ).toThrow(ERR_CROSSTAB_V4_LEGACY_INPUT);
});

test('detects canonical V4 usage from canonical definitions and metric chips', () => {
  expect(
    hasCanonicalV4Definitions(
      formData({
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
      }),
    ),
  ).toBe(true);

  expect(
    hasCanonicalV4Definitions(
      formData({
        crosstabFieldConfig: {
          metrics: [
            {
              metric: 'Margin rate',
              label: 'Margin rate',
              calculatedFieldId: 'calc_margin_pct_v4',
            },
          ],
        },
      }),
    ),
  ).toBe(true);
});
```

- [ ] **Step 2: Run the new contract tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: FAIL because `v4Contract.ts` does not exist yet.

- [ ] **Step 3: Create the shared contract helper and tighten the core types**

Create `src/plugin/v4Contract.ts` with:

```ts
import type { CrosstabFormData } from '../types';

export const ERR_CROSSTAB_V4_LEGACY_INPUT = 'ERR_CROSSTAB_V4_LEGACY_INPUT';

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== '';
}

export function hasCanonicalV4Definitions(formData: CrosstabFormData): boolean {
  return Boolean(
    hasValue(formData.crosstabParameters) ||
      hasValue(formData.crosstabCalculatedFields) ||
      (formData.crosstabFieldConfig?.metrics ?? []).some(
        metric => metric.calculatedFieldId !== undefined,
      ),
  );
}

export function assertNoLegacyV4Inputs(
  formData: CrosstabFormData,
  error = ERR_CROSSTAB_V4_LEGACY_INPUT,
): void {
  if (hasValue(formData.parameters) || hasValue(formData.calculatedFields)) {
    throw new Error(error);
  }
}
```

In `src/types.ts`, replace the V4 type block with:

```ts
export type CrosstabParameter = {
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

export type CrosstabExpressionNode =
  | { kind: 'metric_ref'; metricId: string }
  | { kind: 'number_param'; parameterId: string }
  | { kind: 'literal_number'; value: number }
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
  resultType: 'number' | 'ratio' | 'percent';
  formatString?: string;
  ast: CrosstabExpressionNode;
};
```

Then update `CrosstabFormData` to:

```ts
crosstabParameters?: CrosstabParameter[] | string;
crosstabCalculatedFields?: CrosstabCalculatedField[] | string;
parameters?: unknown;
calculatedFields?: unknown;
```

And update `CrosstabChartProps` / `CrosstabOwnState` to keep only:

```ts
numericParameters?: Record<string, number>;
```

- [ ] **Step 4: Keep stale text runtime state stripped**

In `ownState.ts`, keep `textParameters` in the strip list even though stage 2 no longer supports it:

```ts
const CROSSTAB_OWN_STATE_KEYS = [
  'currentColumnPage',
  'currentColumnPageSize',
  'effectiveMetricSignature',
  'effectiveGroupBySignature',
  'expandedRowPaths',
  'numericParameters',
  'textParameters',
  'serverColumnPageColumnSignature',
  'serverColumnPageTuples',
  'serverColumnPageTuplesPage',
  'serverColumnPageTuplesPageSize',
  'serverColumnTotalCount',
  'selectedDynamicGroupBy',
  'selectedDynamicGroupByColumn',
  'selectedDynamicMetric',
];
```

Do not remove the existing test that proves stale `textParameters` is stripped before `extra_form_data` merge.

- [ ] **Step 5: Run the focused contract tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/v4Contract.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts \
  superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts \
  superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
git commit -m "refactor(crosstab): add v4 contract guard"
```

---

### Task 2: Enforce Numeric-Only Canonical Parameters

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts`

- [ ] **Step 1: Replace the old parameter tests with strict stage-2 cases**

In `parameters.test.ts`, add these tests and delete the old text/legacy-success cases:

```ts
test('normalizes canonical number parameters only', () => {
  expect(
    getCrosstabParameters({
      ...formData,
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
    }),
  ).toEqual([
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
  ]);
});

test('rejects stage-2 text parameters', () => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: [
        {
          id: 'param_country',
          kind: 'text',
          name: 'country',
          label: 'Country',
          defaultValue: 'DE',
        },
      ] as unknown as CrosstabFormData['crosstabParameters'],
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('rejects the legacy parameters surface in stage 2', () => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: undefined,
      parameters: [{ kind: 'number', name: 'legacyRate', default: 1 }],
    } as never),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});
```

Also replace the signature assertion with:

```ts
expect(getParameterSignature(resolved)).toBe('number:param_adjustment=1');
```

- [ ] **Step 2: Run the failing parameter tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts --runInBand
```

Expected: FAIL because `parameters.ts` still accepts `kind: 'text'` and legacy `parameters`.

- [ ] **Step 3: Rewrite `parameters.ts` around the numeric-only contract**

In `parameters.ts`, replace the value/result types with:

```ts
export type CrosstabParameterValues = Record<string, number>;

export type ResolvedCrosstabParameters = {
  config: CrosstabParameter[];
  values: CrosstabParameterValues;
};
```

Then replace the parser/resolver path with:

```ts
import { assertNoLegacyV4Inputs } from './v4Contract';

function normalizeCanonicalParameter(value: unknown): CrosstabParameter {
  if (!isObject(value) || value.kind !== 'number') {
    throw new Error(ERR_CROSSTAB_PARAMETER_CONFIG);
  }

  const { id, kind, name, label, defaultValue, min, max, step, unit } = value;
  assertNonEmptyString(id);
  assertNonEmptyString(name);
  assertNonEmptyString(label);
  assertFiniteNumber(defaultValue, ERR_CROSSTAB_PARAMETER_CONFIG);
  assertOptionalFiniteNumber(min);
  assertOptionalFiniteNumber(max);
  assertOptionalFiniteNumber(step);
  assertOptionalString(unit);
  validateNumberConfig(min, max, step);
  validateNumberValue(
    defaultValue,
    min,
    max,
    step,
    ERR_CROSSTAB_PARAMETER_CONFIG,
  );

  return {
    id,
    kind,
    name,
    label,
    defaultValue,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(unit === undefined ? {} : { unit }),
  };
}

export function getCrosstabParameters(
  formData: CrosstabFormData,
): CrosstabParameter[] {
  assertNoLegacyV4Inputs(formData, ERR_CROSSTAB_PARAMETER_CONFIG);
  const parameters = parseParameterInput(formData.crosstabParameters).map(
    normalizeCanonicalParameter,
  );

  assertUniqueParameterKeys(parameters);
  return parameters;
}

export function resolveCrosstabParameters(
  formData: CrosstabFormData,
  ownState?: CrosstabOwnState,
): ResolvedCrosstabParameters {
  const config = getCrosstabParameters(formData);
  const values = Object.fromEntries(
    config.map(parameter => {
      const ownValue = ownState?.numericParameters?.[parameter.id];
      const value = ownValue === undefined ? parameter.defaultValue : ownValue;
      validateParameterValue(parameter, value);
      return [parameter.id, value];
    }),
  ) as CrosstabParameterValues;

  return { config, values };
}
```

- [ ] **Step 4: Make parameter signatures numeric-only**

Replace the signature function with:

```ts
export function getParameterSignature(
  resolved: ResolvedCrosstabParameters,
): string {
  return [...resolved.config]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      parameter =>
        `number:${encodeSignaturePart(parameter.id)}=${
          resolved.values[parameter.id]
        }`,
    )
    .join('|');
}
```

Delete the old `text` storage helpers and delete `getCrosstabNumberParameters`; nothing in stage 2 should treat `formData.parameters` as valid input.

- [ ] **Step 5: Run the focused parameter tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts
git commit -m "refactor(crosstab): enforce numeric-only v4 parameters"
```

---

### Task 3: Remove Template-Era And Text AST Compiler Paths

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts`

- [ ] **Step 1: Replace the compiler tests with numeric-only contract cases**

In `expr.test.ts`, remove the `emitCalculatedFieldSql` import and remove the legacy ratio-compiler test. Add:

```ts
test.each([
  { kind: 'text_param', parameterId: 'region' } as unknown as CrosstabExpressionNode,
  { kind: 'literal_text', value: 'west' } as unknown as CrosstabExpressionNode,
])('rejects stage-2 text nodes %#', node => {
  expect(() => validateCalculatedFieldAst(node)).toThrow(
    ERR_CROSSTAB_CALC_FIELD,
  );
});

test('emits parameterized percent arithmetic from numeric-only nodes', () => {
  expect(
    emit({
      kind: 'binary_op',
      op: '*',
      left: {
        kind: 'pct',
        numerator: { kind: 'metric_ref', metricId: 'profit' },
        denominator: { kind: 'metric_ref', metricId: 'sales' },
      },
      right: { kind: 'number_param', parameterId: 'multiplier' },
    }),
  ).toBe(
    '(((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100) * 1.25)',
  );
});
```

- [ ] **Step 2: Run the failing compiler tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts --runInBand
```

Expected: FAIL because `expr.ts` still exposes text nodes and the legacy compiler path.

- [ ] **Step 3: Rewrite `expr.ts` around the numeric-only AST**

Update the AST compiler args to numeric-only values:

```ts
export type EmitCalculatedFieldAstSqlArgs = {
  dialect: CalcSqlDialect | string;
  metricSql: Record<string, string>;
  parameterValues: Record<string, number>;
};
```

Then replace validation/emission with:

```ts
function getAstValueType(node: CrosstabExpressionNode): 'number' {
  switch (node.kind) {
    case 'metric_ref':
    case 'number_param':
    case 'literal_number':
      return 'number';
    case 'binary_op':
      getAstValueType(node.left);
      getAstValueType(node.right);
      return 'number';
    case 'safe_div':
    case 'pct':
    case 'ratio':
      getAstValueType(node.numerator);
      getAstValueType(node.denominator);
      return 'number';
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

export function validateCalculatedFieldAst(node: CrosstabExpressionNode): void {
  switch (node.kind) {
    case 'metric_ref':
      assertNonEmptyString(node.metricId);
      return;
    case 'number_param':
      assertNonEmptyString(node.parameterId);
      return;
    case 'literal_number':
      assertFiniteNumber(node.value);
      return;
    case 'binary_op':
      if (!binaryOperators.has(node.op)) {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
      validateCalculatedFieldAst(node.left);
      validateCalculatedFieldAst(node.right);
      return;
    case 'safe_div':
    case 'pct':
    case 'ratio':
      assertNonZeroLiteralDenominator(node.denominator);
      validateCalculatedFieldAst(node.numerator);
      validateCalculatedFieldAst(node.denominator);
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}
```

Keep only `emitCalculatedFieldAstSql`; delete `emitCalculatedFieldSql` and all `text_param` / `literal_text` branches.

- [ ] **Step 4: Make AST result types numeric-only**

In the result-type check, keep only:

```ts
function assertResultTypeMatchesAst(field: CrosstabCalculatedField): void {
  getAstValueType(field.ast);

  if (!['number', 'ratio', 'percent'].includes(field.resultType)) {
    throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}
```

- [ ] **Step 5: Run the focused compiler tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts
git commit -m "refactor(crosstab): remove legacy calc compiler paths"
```

---

### Task 4: Require `crosstabFieldConfig.metrics` For Canonical V4 Charts

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Add the failing strict-metric-source tests**

In `fieldConfig.test.ts`, add:

```ts
it('requires persisted metric configs for canonical v4 charts', () => {
  expect(() =>
    getRequiredCrosstabMetricConfigs(
      createFormData({
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [],
        },
      }),
    ),
  ).toThrow(ERR_CROSSTAB_V4_METRIC_CONFIG);
});
```

In `buildQuery.test.ts`, replace the old V4 fallback test with:

```ts
it('rejects v4 charts when only legacy top-level metrics remain', () => {
  expect(() =>
    buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      metrics: ['legacy_amount'],
      crosstabParameters: [
        {
          id: 'param_adjustment',
          kind: 'number',
          name: 'adjustmentRate',
          label: 'Adjustment',
          defaultValue: 1,
        },
      ],
      crosstabFieldConfig: {
        rows: [{ field: 'metric_name_with_unit' }],
        columns: [{ field: 'biz_date' }],
        metrics: [],
      },
      crosstabCalculatedFields: [
        {
          id: 'calc_margin_pct_v4',
          name: 'Margin rate',
          resultType: 'percent',
          ast: {
            kind: 'pct',
            numerator: { kind: 'metric_ref', metricId: 'profit' },
            denominator: { kind: 'metric_ref', metricId: 'sales' },
          },
        },
      ],
    } as never),
  ).toThrow(ERR_CROSSTAB_V4_METRIC_CONFIG);
});
```

In `transformProps.test.ts`, add:

```ts
it('rejects v4 charts when render-time metrics only exist under legacy formData.metrics', () => {
  expect(() =>
    transformProps(
      createProps({
        formData: {
          datasource: '11__table',
          viz_type: 'crosstab-table',
          metrics: ['legacy_amount'],
          crosstabParameters: [
            {
              id: 'param_adjustment',
              kind: 'number',
              name: 'adjustmentRate',
              label: 'Adjustment',
              defaultValue: 1,
            },
          ],
          crosstabFieldConfig: {
            rows: [{ field: 'metric_name_with_unit' }],
            columns: [{ field: 'biz_date' }],
            metrics: [],
          },
        },
        queriesData: [{ data: [], colnames: [], coltypes: [] }],
      }),
    ),
  ).toThrow(ERR_CROSSTAB_V4_METRIC_CONFIG);
});
```

- [ ] **Step 2: Run the failing strict-metric tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  --runInBand
```

Expected: FAIL because the current code still falls back to top-level `metrics`.

- [ ] **Step 3: Add the strict V4 metric-config helper**

In `fieldConfig.ts`, add:

```ts
import { hasCanonicalV4Definitions } from './v4Contract';

export const ERR_CROSSTAB_V4_METRIC_CONFIG =
  'ERR_CROSSTAB_V4_METRIC_CONFIG';

export function getRequiredCrosstabMetricConfigs(
  formData: CrosstabFormData,
): MetricFieldConfig[] {
  const metricConfigs = formData.crosstabFieldConfig?.metrics ?? [];

  if (hasCanonicalV4Definitions(formData) && metricConfigs.length === 0) {
    throw new Error(ERR_CROSSTAB_V4_METRIC_CONFIG);
  }

  return metricConfigs;
}
```

Keep `getCrosstabMetrics()` as the general crosstab helper for non-V4 code paths, but route the V4 query/render path through `getRequiredCrosstabMetricConfigs()`.

- [ ] **Step 4: Use the strict helper in `buildQuery.ts` and `transformProps.ts`**

In both files, replace:

```ts
const persistedMetricConfigs = getPersistedCrosstabMetricConfigs(formData);
```

with:

```ts
const persistedMetricConfigs = getRequiredCrosstabMetricConfigs(
  crosstabFormData,
);
```

Then keep the fallback only for non-V4 charts:

```ts
const baseMetricConfigs = persistedMetricConfigs.length
  ? persistedMetricConfigs
  : ensureIsArray<QueryFormMetric>(formData.metrics).map(metric => ({
      metric,
    }));
```

Do not change the row/column fallback behavior; this task is only about the metric truth surface.

- [ ] **Step 5: Run the focused strict-metric tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "refactor(crosstab): require canonical v4 metric configs"
```

---

### Task 5: Validate Canonical Calculated Fields Against Declared Parameters And Approved Metric Sources

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts`

- [ ] **Step 1: Add the failing calculated-field validation tests**

In `calcFields.test.ts`, add:

```ts
test('rejects number_param refs that are not declared in crosstabParameters', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
        crosstabCalculatedFields: [
          {
            id: 'calc_adjusted_margin',
            name: 'Adjusted margin',
            resultType: 'percent',
            ast: {
              kind: 'binary_op',
              op: '*',
              left: {
                kind: 'pct',
                numerator: { kind: 'metric_ref', metricId: 'profit' },
                denominator: { kind: 'metric_ref', metricId: 'sales' },
              },
              right: {
                kind: 'number_param',
                parameterId: 'missing_parameter',
              },
            },
          },
        ],
      },
      metricConfigs,
      parameterValues: { param_adjustment: 1.25 },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('creates deterministic signatures from numeric parameter values only', () => {
  const signature = getCalculatedFieldsSignature([calculatedField], {
    adjustmentRate: 1.25,
    secondaryRate: 0.8,
  });
  const reorderedSignature = getCalculatedFieldsSignature([calculatedField], {
    secondaryRate: 0.8,
    adjustmentRate: 1.25,
  });

  expect(reorderedSignature).toBe(signature);
});
```

- [ ] **Step 2: Run the failing calculated-field tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts --runInBand
```

Expected: FAIL because `calcFields.ts` does not validate parameter refs and still serializes the old nested parameter-value shape.

- [ ] **Step 3: Add declared-parameter validation and remove V4 metric overlay from `formData.metrics`**

In `calcFields.ts`, add:

```ts
import { getCrosstabParameters } from './parameters';
import { assertNoLegacyV4Inputs } from './v4Contract';

function collectParameterRefs(
  node: CrosstabExpressionNode,
  parameterRefs: Set<string>,
): void {
  switch (node.kind) {
    case 'number_param':
      parameterRefs.add(node.parameterId);
      return;
    case 'binary_op':
      collectParameterRefs(node.left, parameterRefs);
      collectParameterRefs(node.right, parameterRefs);
      return;
    case 'safe_div':
    case 'pct':
    case 'ratio':
      collectParameterRefs(node.numerator, parameterRefs);
      collectParameterRefs(node.denominator, parameterRefs);
      return;
    case 'metric_ref':
    case 'literal_number':
      return;
    default:
      throw new Error(ERR_CROSSTAB_CALC_FIELD);
  }
}

function assertKnownParameterRefs(
  calculatedFields: CrosstabCalculatedField[],
  parameters: CrosstabParameter[],
): void {
  const parameterIds = new Set(parameters.map(parameter => parameter.id));

  calculatedFields.forEach(field => {
    const refs = new Set<string>();
    collectParameterRefs(field.ast, refs);
    refs.forEach(parameterId => {
      if (!parameterIds.has(parameterId)) {
        throw new Error(ERR_CROSSTAB_CALC_FIELD);
      }
    });
  });
}
```

Then update the V4 parser path:

```ts
export function getCalculatedFields(
  formData: CrosstabFormData,
): CrosstabCalculatedField[] {
  assertNoLegacyV4Inputs(formData, ERR_CROSSTAB_CALC_FIELD);

  const parsed = parseCalculatedFields(formData.crosstabCalculatedFields);
  assertKnownParameterRefs(parsed, getCrosstabParameters(formData));
  return parsed;
}
```

And remove the V4 overlay from `formData.metrics` inside `getMetricSqlMap`; start from the current metric configs and datasource saved metrics only:

```ts
const explicitMetricSql = metricConfigs.reduce<Record<string, string>>(
  (metricSql, config) => addExplicitMetricConfigSql(metricSql, config),
  {},
);

const datasourceMetricSql = getDatasourceSavedMetrics(formData).reduce<
  Record<string, string>
>((metricSql, metric) => {
  const sqlExpression = getSavedMetricExpression(metric);
  if (sqlExpression === undefined) {
    return metricSql;
  }

  const nextMetricSql = { ...metricSql };
  getSavedMetricNames(metric).forEach(metricName => {
    addDatasourceMetricSql(
      nextMetricSql,
      metricName,
      sqlExpression,
      referencedMetricIds,
      new Set(Object.keys(explicitMetricSql)),
    );
  });

  return nextMetricSql;
}, explicitMetricSql);

return metricConfigs.reduce<Record<string, string>>(
  (metricSql, config) =>
    addMetricConfigSql(metricSql, config, datasourceMetricLookup),
  datasourceMetricSql,
);
```

- [ ] **Step 4: Make calculated-field signatures numeric-only**

Replace the signature helper with:

```ts
export function getCalculatedFieldsSignature(
  calculatedFields: CrosstabCalculatedField[],
  parameterValues: Record<string, number>,
): string {
  return [
    stableSerialize(calculatedFields),
    `parameters:${stableSerialize(parameterValues)}`,
  ].join('|');
}
```

- [ ] **Step 5: Run the focused calculated-field tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts
git commit -m "refactor(crosstab): validate canonical v4 calc fields"
```

---

### Task 6: Persist Only Canonical Number Parameters From The Control Layer

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add the failing control test**

In `controlPanel.test.ts`, replace the current text-parameter test with:

```ts
it('creates canonical number parameters and clears legacy parameters', () => {
  const onChange = jest.fn();
  const actions = { setControlValue: jest.fn() };

  render(
    createElement(CrosstabParametersControl, {
      actions,
      name: 'crosstabParameters',
      onChange,
      value: [],
    }),
  );

  expect(screen.queryByText('Add text parameter')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('Add number parameter'));
  fireEvent.change(screen.getByLabelText('Parameter id'), {
    target: { value: 'adjustmentRate' },
  });
  fireEvent.change(screen.getByLabelText('Parameter name'), {
    target: { value: 'adjustmentRate' },
  });
  fireEvent.change(screen.getByLabelText('Parameter label'), {
    target: { value: 'Adjustment rate' },
  });
  fireEvent.change(screen.getByLabelText('Parameter default'), {
    target: { value: '1.25' },
  });
  fireEvent.change(screen.getByLabelText('Parameter min'), {
    target: { value: '0' },
  });
  fireEvent.change(screen.getByLabelText('Parameter max'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Parameter step'), {
    target: { value: '0.01' },
  });
  fireEvent.change(screen.getByLabelText('Parameter unit'), {
    target: { value: 'x' },
  });
  fireEvent.click(screen.getByText('Save parameter'));

  expect(actions.setControlValue).toHaveBeenCalledWith('parameters', []);
  expect(onChange).toHaveBeenCalledWith([
    {
      id: 'adjustmentRate',
      kind: 'number',
      name: 'adjustmentRate',
      label: 'Adjustment rate',
      defaultValue: 1.25,
      min: 0,
      max: 2,
      step: 0.01,
      unit: 'x',
    },
  ]);
});
```

- [ ] **Step 2: Run the failing control test**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: FAIL because the control still exposes text parameters and does not clear legacy `parameters`.

- [ ] **Step 3: Rewrite `CrosstabParametersControl.tsx` around number parameters only**

Change the props/draft model to:

```ts
type CrosstabParametersControlProps = {
  actions?: {
    setControlValue?: (control: string, value: unknown) => void;
  };
  hovered?: boolean;
  label?: string;
  name: string;
  onChange: (value: CrosstabParameter[]) => void;
  value?: CrosstabParameter[];
};

type NumberParameterDraft = {
  id: string;
  kind: 'number';
  name: string;
  label: string;
  defaultValue: string;
  min: string;
  max: string;
  step: string;
  unit: string;
};
```

Then parse optional numeric fields explicitly:

```ts
function parseOptionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function parameterFromDraft(draft: NumberParameterDraft): CrosstabParameter {
  const defaultValue = Number(draft.defaultValue);
  const min = parseOptionalNumber(draft.min);
  const max = parseOptionalNumber(draft.max);
  const step = parseOptionalNumber(draft.step);

  if (!Number.isFinite(defaultValue)) {
    throw new Error(
      t('Crosstab parameter numeric fields require finite numbers.'),
    );
  }

  return {
    id: draft.id.trim(),
    kind: 'number',
    name: draft.name.trim(),
    label: draft.label.trim(),
    defaultValue,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    ...(step === undefined ? {} : { step }),
    ...(draft.unit.trim() === '' ? {} : { unit: draft.unit.trim() }),
  };
}
```

- [ ] **Step 4: Clear the hidden legacy parameter control on write**

After every successful save/delete, call:

```ts
actions?.setControlValue?.('parameters', []);
```

Do this in both the save and delete flows. Keep `getCrosstabParameters()` as the validation gate so duplicate IDs, bad ranges, and malformed stage-2 state still fail fast.

- [ ] **Step 5: Run the focused control test**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "refactor(crosstab): persist numeric parameters only"
```

---

### Task 7: Rebuild The Calculated-Field Control Around The Numeric AST And Canonical Writes

**Files:**
- Create: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/builder.ts`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

- [ ] **Step 1: Add the failing calculated-field control tests**

In `controlPanel.test.ts`, add:

```ts
it('duplicates a calculated field and clears legacy v4 write-through controls', () => {
  const onChange = jest.fn();
  const onControlChange = jest.fn();
  const actions = { setControlValue: jest.fn() };

  render(
    createElement(CrosstabCalculatedFieldsControl, {
      actions,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
        crosstabFieldConfig: {
          metrics: [
            {
              metric: 'Margin rate',
              label: 'Margin rate',
              calculatedFieldId: 'marginRate',
              semantic: 'ratio',
              formatString: '.2%',
            },
          ],
        },
      },
      name: 'crosstabCalculatedFields',
      onControlChange,
      onChange,
      savedMetrics: [
        { metric_name: 'profit', expression: 'SUM(gross_profit)' },
        { metric_name: 'sales', expression: 'SUM(sales_amount)' },
      ],
      value: [
        {
          id: 'marginRate',
          name: 'Margin rate',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: { kind: 'metric_ref', metricId: 'profit' },
            denominator: { kind: 'metric_ref', metricId: 'sales' },
          },
        },
      ],
    }),
  );

  fireEvent.click(screen.getByText('Duplicate'));
  fireEvent.click(screen.getByText('Save calculated field'));

  expect(actions.setControlValue).toHaveBeenCalledWith('calculatedFields', []);
  expect(actions.setControlValue).toHaveBeenCalledWith('metrics', []);
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'marginRate', name: 'Margin rate' }),
    expect.objectContaining({
      id: 'marginRate_copy',
      name: 'Margin rate Copy',
    }),
  ]);
});

it('clears hidden metrics when canonical v4 metric selection is edited', () => {
  const onChange = jest.fn();
  const actions = { setControlValue: jest.fn() };

  render(
    createElement(CrosstabFieldConfigControl, {
      actions,
      columns: [],
      datasource: {},
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
      },
      name: 'crosstabFieldConfig',
      onChange,
      value: {
        metrics: [{ metric: 'amount', label: 'Amount' }],
      },
    }),
  );

  expect(actions.setControlValue).toHaveBeenCalledWith('metrics', []);
});
```

- [ ] **Step 2: Run the failing control test**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: FAIL because the builder has no duplicate flow and the controls do not clear the legacy write-through surfaces.

- [ ] **Step 3: Create the numeric AST draft helper**

Create `src/plugin/calc/builder.ts` with:

```ts
import type {
  CrosstabCalculatedField,
  CrosstabExpressionNode,
} from '../../types';

export type ExpressionDraft =
  | { kind: 'metric_ref'; metricId: string }
  | { kind: 'number_param'; parameterId: string }
  | { kind: 'literal_number'; value: string }
  | {
      kind: 'binary_op';
      op: '+' | '-' | '*' | '/';
      left: ExpressionDraft;
      right: ExpressionDraft;
    }
  | {
      kind: 'safe_div' | 'pct' | 'ratio';
      numerator: ExpressionDraft;
      denominator: ExpressionDraft;
      defaultValue?: string;
    };

export function draftToAst(draft: ExpressionDraft): CrosstabExpressionNode {
  switch (draft.kind) {
    case 'metric_ref':
      return { kind: 'metric_ref', metricId: draft.metricId };
    case 'number_param':
      return { kind: 'number_param', parameterId: draft.parameterId };
    case 'literal_number':
      return { kind: 'literal_number', value: Number(draft.value) };
    case 'binary_op':
      return {
        kind: 'binary_op',
        op: draft.op,
        left: draftToAst(draft.left),
        right: draftToAst(draft.right),
      };
    case 'safe_div':
    case 'pct':
    case 'ratio':
      return {
        kind: draft.kind,
        numerator: draftToAst(draft.numerator),
        denominator: draftToAst(draft.denominator),
        ...(draft.defaultValue === undefined || draft.defaultValue.trim() === ''
          ? {}
          : { defaultValue: Number(draft.defaultValue) }),
      };
    default:
      throw new Error('Unsupported draft node.');
  }
}

export function duplicateCalculatedField(
  field: CrosstabCalculatedField,
): CrosstabCalculatedField {
  return {
    ...field,
    id: `${field.id}_copy`,
    name: `${field.name} Copy`,
  };
}
```

- [ ] **Step 4: Wire the structured builder and canonical cleanup into the controls**

In `CrosstabCalculatedFieldsControl.tsx`, replace the fixed pct-only save path with a draft-driven save path:

```ts
const field: CrosstabCalculatedField = {
  id: draft.fieldId.trim(),
  name: draft.fieldName.trim(),
  description: draft.description.trim() || undefined,
  resultType: draft.resultType,
  formatString: draft.formatString.trim() || undefined,
  ast: draftToAst(draft.expression),
};
```

Add a duplicate action:

```tsx
<Button
  buttonSize="small"
  onClick={() => {
    onChange([...value, duplicateCalculatedField(field)]);
    actions?.setControlValue?.('calculatedFields', []);
    actions?.setControlValue?.('metrics', []);
  }}
>
  {t('Duplicate')}
</Button>
```

After every successful save/delete, clear the legacy write-through surfaces:

```ts
setControlValue?.('calculatedFields', []);
setControlValue?.('metrics', []);
setControlValue?.('crosstabFieldConfig', nextFieldConfig);
```

In `CrosstabFieldConfigControl.tsx`, add `actions` support and clear top-level `metrics` when canonical V4 is active:

```ts
const emit = useCallback(
  (nextConfig: NormalizedCrosstabFieldConfig) => {
    onChange(nextConfig);

    if (
      hasCanonicalV4Definitions({
        ...(formData ?? { datasource: '0__table', viz_type: 'crosstab-table' }),
        crosstabFieldConfig: nextConfig,
      } as CrosstabFormData)
    ) {
      actions?.setControlValue?.('metrics', []);
    }
  },
  [actions, formData, onChange],
);
```

Also expose a visible preview and validation summary in the drawer so business users can inspect the AST before saving:

```tsx
<Field>
  {t('Expression preview')}
  <code>{previewExpression(draft.expression, previewLabels)}</code>
</Field>
<Field>
  {t('Validation')}
  <span>{validationMessage}</span>
</Field>
```

- [ ] **Step 5: Run the focused control test**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/builder.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts
git commit -m "refactor(crosstab): rebuild v4 calculated field editor"
```

---

### Task 8: Align Runtime Parameter UI And Renderer State With Numeric-Only V4

**Files:**
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
- Modify: `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts`

- [ ] **Step 1: Replace the text-parameter runtime tests**

In `CrosstabTable.test.tsx`, replace the text-runtime tests with:

```ts
it('renders only numeric runtime parameters from canonical v4 config', () => {
  const props = {
    height: 400,
    width: 800,
    formData: {
      datasource: '1__table',
      viz_type: 'crosstab_table',
      crosstabParameters: [
        {
          id: 'param_adjustment',
          kind: 'number',
          name: 'adjustmentRate',
          label: 'Adjustment',
          defaultValue: 1,
          min: 0,
          max: 2,
          step: 0.01,
        },
      ],
    },
    numericParameters: { param_adjustment: 1 },
    rowData: [],
    columns: [
      {
        key: 'metric_name',
        label: '指标项',
        dataType: GenericDataType.String,
      },
    ],
    columnTree: [],
    generatedColumnIds: [],
  } as unknown as CrosstabChartProps;

  renderChart(props);

  expect(getNumericParameterInput('param_adjustment')).toHaveValue(1);
  expect(
    container.querySelector('[data-test="crosstab-parameter-control--param_country"]'),
  ).toBeNull();
});
```

In `transformProps.test.ts`, replace the text-parameter assertions with:

```ts
it('passes only numeric parameter values to renderer props', () => {
  const props = transformProps(
    createProps({
      formData: canonicalParameterizedCalculatedFormData,
      ownState: {
        numericParameters: { param_adjustment: 1.25 },
      },
      queriesData: [
        {
          data: [],
          colnames: [],
          coltypes: [],
        },
      ],
    }),
  );

  expect(props.numericParameters).toEqual({ param_adjustment: 1.25 });
  expect('textParameters' in props).toBe(false);
});
```

- [ ] **Step 2: Run the failing runtime/render tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  --runInBand
```

Expected: FAIL because the runtime path still exposes text parameter support.

- [ ] **Step 3: Remove the text runtime branch from `CrosstabTable.tsx`**

In `CrosstabTable.tsx`, replace the parameter-control memo with:

```ts
const parameterControls = useMemo(
  () =>
    getCrosstabParameters(formData as CrosstabFormData).map(parameter => ({
      parameter,
      value: numericParameters?.[parameter.id] ?? parameter.defaultValue,
    })),
  [formData, numericParameters],
);
```

Delete `updateTextParameter` completely, and keep only:

```ts
const updateNumericParameter = useCallback(
  (parameter: CrosstabParameter, value: number) => {
    validateNumericParameterValue(parameter, value);

    if (!serverColumnPagination) {
      setColumnPage(0);
    }

    setDataMask?.({
      ownState: {
        ...getPreservedRuntimeParameterOwnState(ownState),
        numericParameters: {
          ...(ownState?.numericParameters ?? {}),
          [parameter.id]: value,
        },
        currentColumnPage: 0,
        currentColumnPageSize: effectiveColumnsPerPage,
      },
    });
  },
  [
    effectiveColumnsPerPage,
    ownState,
    serverColumnPagination,
    setColumnPage,
    setDataMask,
  ],
);
```

Render only the numeric input branch; there should be no `Select` or free-text parameter input inside `runtimeParameterControls`.

- [ ] **Step 4: Keep renderer signatures numeric-only**

In the `transformProps` code path, keep:

```ts
const effectiveMetricSignature =
  calculatedFields.length > 0
    ? `${dynamicMetricResult.signature}|calculated:${getCalculatedFieldsSignature(
        calculatedFields,
        resolvedParameters.values,
      )}`
    : dynamicMetricResult.signature;
```

Because `resolvedParameters.values` is now numeric-only, no render-time branch should attempt to read `textParameters`.

- [ ] **Step 5: Run the focused runtime/render tests**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts
git commit -m "refactor(crosstab): align runtime state with v4 contract"
```

---

### Task 9: Full Local Validation On The Reorganized Contract

**Files:**
- Verify all changed frontend files only.

- [ ] **Step 1: Stage the changed files before running pre-commit**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/v4Contract.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/parameters.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/expr.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/fieldConfig.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calcFields.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabParametersControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/calc/builder.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  superset-frontend/plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts \
  superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
```

Expected: only the intended Crosstab V4 files are staged.

- [ ] **Step 2: Run pre-commit on staged files**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
pre-commit run
```

Expected: staged-file hooks pass, or only auto-fix trivial formatting that you immediately restage and rerun. Any error in the touched Crosstab files is blocking.

- [ ] **Step 3: Run the focused Jest stack**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=test npx jest \
  plugins/plugin-chart-crosstab-table/test/plugin/v4Contract.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/parameters.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/calc/expr.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts \
  plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts \
  plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx \
  src/explore/components/ExploreViewContainer/ownState.test.ts \
  --runInBand
```

Expected: all focused suites pass.

- [ ] **Step 4: Run TypeScript and whitespace validation**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
npm run type -- --pretty false

cd /Volumes/extend/ecode-workspace/superset-source
git diff --check
```

Expected: `npm run type -- --pretty false` passes; `git diff --check` prints nothing.

- [ ] **Step 5: Create the source integration commit**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git commit -m "refactor(crosstab): reorganize v4 contract"
```

Expected: one integration commit exists on top of the task commits. Do not amend prior commits; create a new integration commit if a final fix is needed after validation.

---

### Task 10: Release Frontend Assets And Complete Formal Slice 10 Acceptance

**Files:**
- Create: `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-acceptance.md`
- Create: `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-explore-slice10.png`
- Create: `docs/superpowers/reports/slice-10-crosstab-v4-contract-reorg-backup-*.json`

- [ ] **Step 1: Push the implementation commits**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git push fork noway-release:noway-release
```

Expected: `noway-release -> noway-release`.

- [ ] **Step 2: Build the production frontend assets**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source/superset-frontend
BABEL_ENV=testableProduction npm run build
```

Expected: webpack build succeeds. Asset-size warnings are acceptable if there are no errors.

- [ ] **Step 3: Back up production assets and slice 10 metadata**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && bash -s' <<'REMOTE'
set -euo pipefail
ts="$(date +%Y%m%d%H%M%S)"
mkdir -p backups
cp -a superset-source/superset/static/assets "backups/assets-$ts"
printf 'assets_backup=%s\n' "backups/assets-$ts"
docker exec apache-superset python - <<'PY'
import json
from datetime import datetime
from pathlib import Path
from superset import create_app

app = create_app()
with app.app_context():
    from superset.extensions import db
    from superset.models.slice import Slice

    slice_obj = db.session.query(Slice).filter_by(id=10).one()
    payload = {
        "id": slice_obj.id,
        "slice_name": slice_obj.slice_name,
        "viz_type": slice_obj.viz_type,
        "params": slice_obj.params,
        "query_context": slice_obj.query_context,
    }
    path = Path(
        f"/tmp/slice-10-crosstab-v4-contract-reorg-backup-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.json"
    )
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(path)
PY
REMOTE
scp agentops:/tmp/slice-10-crosstab-v4-contract-reorg-backup-*.json /Volumes/extend/ecode-workspace/superset-source/docs/superpowers/reports/
```

Expected: prints both `assets_backup=backups/assets-<timestamp>` and the backup JSON path; the JSON is copied locally into `docs/superpowers/reports/`.

- [ ] **Step 4: Sync assets, rebuild the image, and wait for health**

Run:

```bash
rsync -az --delete \
  /Volumes/extend/ecode-workspace/superset-source/superset/static/assets/ \
  agentops:/home/ubuntu/superset-docker/superset-source/superset/static/assets/

ssh agentops 'cd /home/ubuntu/superset-docker && docker image ls apache-superset-doris:6.0.0-zh-column-scheme-matrix --format "{{.ID}}" && docker build -f Dockerfile.doris-zh -t apache-superset-doris:6.0.0-zh-column-scheme-matrix .'

ssh agentops 'cd /home/ubuntu/superset-docker && docker compose up -d superset && for i in $(seq 1 24); do status="$(docker inspect -f "{{.State.Health.Status}}" apache-superset 2>/dev/null || true)"; printf "%s\n" "$status"; test "$status" = healthy && exit 0; sleep 5; done; exit 1'
```

Expected: `rsync` exits `0`, the Docker build exits `0`, and the health loop ends with `healthy`.

- [ ] **Step 5: Open slice 10 and save the canonical V4 contract**

Open:

```text
http://111.230.91.24:8088/explore/?dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10
```

Use the Crosstab controls to save one number parameter and one calculated field that proves the numeric AST contract:

```json
{
  "crosstabParameters": [
    {
      "id": "param_adjustment",
      "kind": "number",
      "name": "adjustmentRate",
      "label": "V4验收调整系数",
      "defaultValue": 1.25,
      "min": 0,
      "max": 3,
      "step": 0.01,
      "unit": "x"
    }
  ],
  "crosstabCalculatedFields": [
    {
      "id": "calc_adjusted_margin_pct_v4",
      "name": "V4验收含参毛利率",
      "resultType": "percent",
      "formatString": ".2%",
      "ast": {
        "kind": "binary_op",
        "op": "*",
        "left": {
          "kind": "pct",
          "numerator": {
            "kind": "metric_ref",
            "metricId": "v4_gross_profit_sum"
          },
          "denominator": {
            "kind": "metric_ref",
            "metricId": "v4_sales_amount_sum"
          }
        },
        "right": {
          "kind": "number_param",
          "parameterId": "param_adjustment"
        }
      }
    }
  ]
}
```

If slice 10 exposes different metric IDs, use the exact visible metric IDs from the editor and record them in the report. The selected metric chip must live under `crosstabFieldConfig.metrics` and must reference `calculatedFieldId: "calc_adjusted_margin_pct_v4"`.

- [ ] **Step 6: Verify saved metadata contains only the canonical truth surfaces**

Run:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && docker exec apache-superset python - <<'"'"'PY'"'"'
import json
from superset import create_app

app = create_app()
with app.app_context():
    from superset.extensions import db
    from superset.models.slice import Slice

    slice_obj = db.session.query(Slice).filter_by(id=10).one()
    params = json.loads(slice_obj.params or "{}")
    print(json.dumps({
        "crosstabParameters": params.get("crosstabParameters"),
        "crosstabCalculatedFields": params.get("crosstabCalculatedFields"),
        "crosstabFieldConfigMetrics": params.get("crosstabFieldConfig", {}).get("metrics"),
        "metrics": params.get("metrics"),
        "parameters": params.get("parameters"),
        "calculatedFields": params.get("calculatedFields"),
    }, ensure_ascii=False, indent=2))
PY'
```

Expected:

- `crosstabParameters` is present with the numeric parameter.
- `crosstabCalculatedFields` is present with the AST definition.
- `crosstabFieldConfigMetrics` contains the calculated metric chip.
- `metrics` is absent or `[]`.
- `parameters` is absent or `[]`.
- `calculatedFields` is absent or `[]`.

- [ ] **Step 7: Verify query execution, browser reload, and evidence**

Run:

```bash
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
ssh agentops 'cd /home/ubuntu/superset-docker && docker inspect -f "{{.Image}} {{.State.Status}} {{.State.Health.Status}}" apache-superset'
ssh agentops 'cd /home/ubuntu/superset-docker && docker logs --since 30m apache-superset 2>&1 | grep -E "/api/v1/chart/data" | tail -20'
ssh agentops 'cd /home/ubuntu/superset-docker && docker logs --since 30m apache-superset 2>&1 | grep -Ein "error|exception|traceback|critical|ERR_CROSSTAB" | tail -50 || true'
```

Then, in the browser:

- reload the Explore page;
- confirm the parameter, calculated field, and selected metric chip are still present;
- capture a screenshot at `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-explore-slice10.png`;
- inspect the latest `chart/data` request in DevTools and record the selected calculated metric label plus one response-level proof that the calculated metric column/value is present.

Expected: both `/health` probes return `OK`, the container is `running healthy`, logs show `chart/data` HTTP `200`, the reloaded Explore page still shows the canonical V4 state, and the response evidence proves the selected V4 metric column is present.

- [ ] **Step 8: Write the acceptance report**

Create `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-acceptance.md` with these sections, each fully populated from the evidence gathered in Steps 1-7:

- `Verdict`
  - State `Status: complete` only if local validation, deploy, save/reload, and response-level metric proof all passed.
- `Source And Release`
  - Include the source commit hash, asset backup path, slice backup JSON path, old image ID, and new image ID.
- `Local Validation`
  - Include the exact focused Jest command, `npm run type -- --pretty false`, `pre-commit run`, and `git diff --check` outcomes.
- `Production Validation`
  - Include both `/health` probes, container inspect output, `chart/data` log proof, and the error-log scan result.
- `Browser Save/Reload Validation`
  - Include the final Explore URL, chart title, parameter definition, calculated-field definition, selected metric-chip evidence, request/response proof for the calculated metric, and the screenshot path.
- `Rollback`
  - State that rollback means restoring the slice backup JSON and the backed-up assets, then rerunning `/health`, Explore reload, and `chart/data` validation.

Do not leave any bullet blank. Every bullet must contain the actual evidence from this task.

- [ ] **Step 9: Commit the acceptance artifacts**

Run:

```bash
cd /Volumes/extend/ecode-workspace/superset-source
git add \
  docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-acceptance.md \
  docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-explore-slice10.png \
  docs/superpowers/reports/slice-10-crosstab-v4-contract-reorg-backup-*.json
git commit -m "docs(crosstab): record v4 contract reorg acceptance"
```

Expected: acceptance evidence is committed separately from the source reorganization commit.
