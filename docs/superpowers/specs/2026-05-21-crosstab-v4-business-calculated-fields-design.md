# Crosstab V4 Business Calculated Fields Design

Date: 2026-05-21

## Goal

V4 adds a business-usable calculated field flow to the custom
`crosstab-table` chart plugin.

The first release targets a complete user workflow:

1. Define one numeric parameter.
2. Create a calculated metric from a template in a right-side drawer.
3. Preview the generated SQL expression locally.
4. Save the calculated field and immediately add it to the crosstab metric
   slot.
5. Change the parameter from the chart toolbar and trigger a fresh query.

The design keeps the current plugin boundary:

- Frontend-owned chart plugin under
  `superset-frontend/plugins/plugin-chart-crosstab-table/`.
- Existing Superset chart data API.
- No dedicated backend crosstab API.
- No AG Grid Enterprise pivoting or SSRM.
- No arbitrary SQL or Jinja input.

## Scope

V4 core supports standard Superset metrics. It does not directly support the
current production slice 10 matrix-row shape where business metrics are stored
as values under `metric_name_with_unit` and the numeric measure is `指标值`.

That matrix-row support is deferred to a follow-up V4.x adapter so the core
calculation model remains reusable across normal datasets and charts.

## Data Model

V4 introduces two persisted form-data fields.

```ts
type CrosstabNumberParameter = {
  kind: 'number';
  name: string;
  label?: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

type CrosstabCalculatedFieldTemplate =
  | 'ratio'
  | 'difference'
  | 'parameterized_ratio';

type CrosstabCalculatedField = {
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

type CrosstabFormData = {
  parameters?: CrosstabNumberParameter[];
  calculatedFields?: CrosstabCalculatedField[];
};
```

V4 core allows only one numeric parameter in the first release. The default
production-oriented shape is:

```json
{
  "kind": "number",
  "name": "adjustmentRate",
  "label": "调整系数",
  "default": 1,
  "min": 0,
  "max": 2,
  "step": 0.01
}
```

Runtime values live in chart-local own-state:

```ts
type CrosstabOwnState = {
  numericParameters?: {
    adjustmentRate?: number;
  };
};
```

`numericParameters` must be stripped from Explore `extra_form_data`. Parameter
state is session-local and must not be saved back into slice params.

## Templates

The first release exposes three templates:

| Template | Expression | Semantic |
| --- | --- | --- |
| Ratio | `safe_div(A, B)` | `ratio` |
| Difference | `A - B` | `additive` |
| Parameterized ratio | `safe_div(A, B) * adjustmentRate` | `ratio` |

The UI must not expose `AST`, `kind`, `operator`, SQL fragments, Jinja, or free
expression editing. Users select a template and choose A/B metrics from
whitelisted metric pickers.

## SQL-Only Compilation

V4 does not include a frontend evaluator. Calculated fields are compiled before
query generation into Superset SQL metrics. The database computes leaf values,
row totals, column totals, subtotals, and grand totals. Existing V2 summary
planning remains the source of truth for non-additive summaries.

Compilation responsibilities:

- Validate calculated field shape and template.
- Validate the single numeric parameter and runtime value against
  `min/max/step`.
- Validate A/B metric references against datasource saved metrics and crosstab
  metric whitelist.
- Emit a metric expression string only. The emitter must not create WHERE,
  JOIN, table names, or arbitrary SQL fragments.
- Emit `safe_div` using the selected SQL dialect, with Doris as the initial
  production target.
- Reject unsafe metric names or parameter values instead of falling back to
  defaults.

Compiled calculated fields become `MetricFieldConfig` entries and then flow
through the existing dynamic metric resolver, summary query plan, transform
path, and crosstab engine.

## Signatures And Cache Safety

The effective metric signature must include:

- Calculated field id and template.
- Input metric identities.
- Semantic and format string.
- Current numeric parameter value.

Changing `numericParameters.adjustmentRate` must produce a new query context and
must not reuse stale cached data. Invalid parameters fail fast and render the
chart error state.

## Explore Controls

The `Crosstab` control panel section gets two controls:

- `Parameters`: configures the single numeric parameter.
- `Calculated fields`: shows existing calculated fields and opens the editor.

The calculated field editor is a right-side drawer. The drawer flow is:

1. Enter the calculated field name.
2. Pick one of the three templates.
3. Pick A and B metrics.
4. Bind `adjustmentRate` automatically for the parameterized ratio template.
5. Choose a number format, defaulting to `.2%` for ratio templates and falling
   back to chart-wide formatting when unset.
6. Show local validation and generated SQL preview.
7. Save.

Saving immediately appends the calculated field to
`crosstabFieldConfig.metrics` and closes the drawer. V4 does not add drag and
drop, a separate field library workflow, or async sample-value preview inside
the drawer.

## Chart Toolbar

The chart toolbar renders the numeric parameter control to the right of dynamic
group-by and dynamic metric selectors.

Behavior:

- If `min` and `max` are set, render a slider plus numeric input.
- If bounds are incomplete, render only a numeric input.
- Parameter changes write `ownState.numericParameters.adjustmentRate`.
- Parameter changes reset column pagination state:
  `currentColumnPage`, `currentColumnPageSize`, `serverColumnPageTuples`,
  `serverColumnPageTuplesPage`, and `serverColumnPageTuplesPageSize`.
- Parameter changes preserve `expandedRowPaths` because row structure is not
  changed.

## Error Handling

V4 follows the existing fail-fast principle:

- Missing A/B metric: reject save and focus the missing picker.
- Unknown metric reference: throw a crosstab calculation error naming the
  missing metric.
- Invalid parameter value: reject query generation and show the chart error.
- Unsafe metric or parameter input: reject validation.
- Unsupported SQL dialect: throw an explicit unsupported-dialect error.

No silent fallback to default parameter values is allowed after the user changes
the parameter.

## Testing

Repository tests:

- `calc/expr.test.ts`: template validation, SQL emit, semantic inference,
  invalid metric references, invalid parameters, injection-like input rejection.
- `plugin/parameters.test.ts`: default value resolution, runtime override,
  min/max/step validation, and signature changes.
- `plugin/calcFields.test.ts`: calculated field expansion into SQL metrics,
  metric config integration, and non-additive summary plan participation.
- `plugin/controlPanel.test.ts`: parameter control, calculated field drawer
  control, SQL preview, and save-immediately-adds-metric behavior.
- `CrosstabTable.test.tsx`: toolbar parameter rendering, own-state updates, and
  column pagination reset.
- `src/explore/components/ExploreViewContainer/ownState.test.ts`:
  `numericParameters` stripping from `extra_form_data`.

Validation commands:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
cd superset-frontend && npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
cd superset-frontend && npm run type -- --pretty false
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

## Production Acceptance Boundary

V4 core production validation should use a temporary or copied chart with normal
saved metrics. It must not mutate formal production slice 10 during core V4
acceptance.

Acceptance checks:

- Create a standard-metric calculated field with the parameterized ratio
  template.
- Change `adjustmentRate` from the toolbar and confirm chart data re-queries.
- Confirm `extra_form_data` does not contain `numericParameters`.
- Confirm row/column/grand totals come from SQL-backed query results rather
  than current visible-page frontend aggregation.
- Scan production logs for `TypeError`, `Cannot read`, `ERR_CROSSTAB`,
  `:ERROR:`, and `:CRITICAL:`.

Slice 10 matrix-row acceptance remains a V4.x follow-up. That adapter must
explicitly map business metric rows such as `销售额（金额）` and `毛利率（%）`
before using slice 10 as the final production proof.

## Out Of Scope

- Free SQL or Jinja calculated fields.
- Text parameters.
- Multiple numeric parameters.
- Recursive calculated fields.
- Dataset-level calculated field persistence.
- Time-window calculations such as同比, 环比, 累计, or offset-based share.
- Matrix-row business metric calculation for slice 10; this is V4.x.
- AG Grid Enterprise features.
