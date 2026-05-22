# Crosstab V4 Product Completion Design

Date: 2026-05-22

## Status

Approved design for the next Crosstab V4 productization phase.

This design supersedes the narrower V4 boundaries in
`2026-05-21-crosstab-v4-business-calculated-fields-design.md` where they
conflict with the decisions below. The main changes are:

- Use a typed primitive AST instead of template-only calculated fields.
- Support metric arithmetic plus `safe_div`, `pct`, `ratio`, number
  parameters, and text parameters in V4.
- Persist definitions in chart `form_data`.
- Allow production acceptance by modifying formal slice 10, with backup and
  rollback evidence.

## Product Stages

| Stage | Capability | Entry |
| --- | --- | --- |
| V4 | Metric arithmetic, `safe_div`, `pct`, `ratio`, number parameters, text parameters | Chart controls, business self-service |
| V4.1 | Conditional metric primitive: visual "when X matches Y then Z else 0", compiled to `SUM(CASE WHEN ...)` | Chart controls, business self-service |
| V4.2 | Running total, share, year-over-year, period-over-period time-offset primitives | Chart controls, business self-service with selected time dimension |

This spec covers V4 only. V4.1 and V4.2 are extension points, not implementation
scope for the next plan.

## Goals

V4 should let a business user create, edit, delete, save, reload, and render
chart-local calculated metrics in the Crosstab chart without writing SQL.

The first productized phase must prove:

1. Calculated fields are persisted in the chart.
2. Calculated fields can reference existing metrics and chart-local parameters.
3. Calculated fields can be selected as Crosstab metrics.
4. Query generation compiles them into controlled metric expressions.
5. Production slice 10 can be saved, reopened, queried, and screenshotted with
   the new configuration.

## Non-Goals

- No arbitrary SQL or Jinja editor.
- No dataset-level persistence.
- No cross-chart sharing.
- No condition, cumulative, YoY, or PoP primitive in V4.
- No silent repair of malformed persisted configuration.
- No broad backend API expansion unless current chart data/query contracts
  prove insufficient.

## Architecture

V4 uses a chart-local typed primitive AST.

The system has three layers:

- Definition layer: persisted business configuration under chart `form_data`,
  including calculated field definitions, parameter definitions, result type,
  formatting, and AST.
- Builder/UI layer: chart controls that let business users compose the AST from
  metric, parameter, literal, operator, and primitive controls.
- Compiler layer: normalization, validation, reference resolution, and
  compilation into controlled adhoc metrics for query generation.

`transformProps` should consume query results. It must not infer calculated
field definitions at render time.

## Persisted Form Data

The chart owns the definitions:

```ts
type CrosstabParameter =
  | {
      id: string;
      kind: 'number';
      name: string;
      label: string;
      defaultValue: number;
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
    }
  | {
      id: string;
      kind: 'text';
      name: string;
      label: string;
      defaultValue: string;
      allowedValues?: string[];
    };

type CrosstabCalculatedField = {
  id: string;
  name: string;
  description?: string;
  resultType: 'number' | 'ratio' | 'percent' | 'text';
  formatString?: string;
  ast: CrosstabExpressionNode;
};

type CrosstabV4FormData = {
  crosstabParameters?: CrosstabParameter[];
  crosstabCalculatedFields?: CrosstabCalculatedField[];
};
```

IDs are stable chart-local identifiers. Names must be unique within the chart.

## V4 AST

V4 supports only these node kinds:

- `metric_ref`: reference to an existing saved metric, selected Crosstab metric,
  datasource metric, or previously validated calculated field when recursion is
  not present.
- `number_param`: reference to a chart-local number parameter.
- `text_param`: reference to a chart-local text parameter.
- `literal_number`: numeric literal.
- `literal_text`: text literal.
- `binary_op`: `+`, `-`, `*`, `/`.
- `safe_div`: safe division with optional default result.
- `pct`: percent primitive, semantically a safe ratio formatted as percent.
- `ratio`: ratio primitive, semantically a safe ratio preserving ratio type.

The AST is the only persisted expression contract. The UI may show a readable
preview, but it must not persist free-form SQL as the source of truth.

## Validation

Validation happens before save and again before query compilation.

Required checks:

- Calculated field IDs are unique.
- Calculated field names are non-empty and unique.
- Parameter IDs are unique.
- Parameter names are non-empty and unique.
- Metric references resolve through the approved metric resolution order:
  `crosstabFieldConfig.metrics`, legacy `formData.metrics`, datasource saved
  metrics, then current chart-local calculated fields that do not form a cycle.
- Parameter references resolve to existing chart-local parameters.
- Text parameters cannot enter numeric arithmetic.
- `safe_div`, `pct`, and `ratio` arguments must be numeric expressions.
- A literal denominator of `0` is rejected before save.
- Recursive calculated fields are rejected.
- Empty ASTs and unsupported node kinds fail fast.

Malformed legacy or partial persisted config should produce an explicit control
or chart error. It should not be silently guessed into a working expression.

## Compilation

The compiler takes validated definitions and emits controlled adhoc metrics for
the existing Superset chart data flow.

Responsibilities:

- Resolve metric and parameter references.
- Preserve result semantics and format strings.
- Compile `safe_div` with a dialect-aware expression for the production Doris
  path.
- Compile `pct` and `ratio` through the same safe ratio core with different
  semantic/format output.
- Reject unsupported node types or dialect gaps explicitly.
- Avoid emitting WHERE, JOIN, table names, arbitrary SQL fragments, or user
  supplied SQL.

The query path should prefer persisted `crosstabFieldConfig.metrics` when
present, and only fall back to legacy `formData.metrics` when persisted metrics
are absent.

## Controls

The Crosstab controls expose two chart-local management areas:

- Parameters: create, edit, delete number and text parameters.
- Calculated fields: list, create, edit, duplicate, delete calculated fields.

The calculated field builder should use structured controls:

- basic metadata fields;
- metric selector;
- parameter selector;
- number/text literal input;
- operator selector;
- primitive selector for `safe_div`, `pct`, and `ratio`;
- validation summary;
- readable expression preview.

Saved calculated fields become metric candidates for
`crosstabFieldConfig.metrics`.

The existing field-zone UI should show exactly one visible heading per zone.
The current uncommitted change that removes duplicate DnD labels belongs in the
V4 productization quality scope.

## Own-State Boundary

Chart-local saved definitions live in `form_data`.

Runtime-only state must stay in chart `ownState` and must be stripped before
Explore merges `ownState` into `extra_form_data`. Runtime-only state includes:

- current parameter values when changed only for the active session;
- selected dynamic metric;
- effective metric signature;
- column pagination state;
- tuple cache state;
- expanded row paths if treated as runtime interaction state.

Saved parameter definitions and calculated field definitions are the only V4
objects that should persist into chart metadata.

## Error Handling

V4 follows fail-fast behavior:

- Save is blocked for invalid definitions.
- Query compilation fails with a named calculated field and the missing or
  invalid reference.
- Runtime division-by-zero behavior is limited to `safe_div`, `pct`, and
  `ratio`; plain `/` does not add extra fallback behavior.
- Unsupported dialect or unsupported node kinds produce explicit errors.
- Bad persisted config is surfaced instead of auto-repaired.

## Testing

Unit tests:

- AST normalization and validation.
- Metric and parameter reference resolution.
- `safe_div`, `pct`, and `ratio` compilation.
- duplicate IDs, duplicate names, missing references, type mismatch, empty AST,
  recursive references, and literal zero denominator.

Control tests:

- parameter create/edit/delete.
- calculated field create/edit/duplicate/delete.
- calculated fields appear as metric candidates.
- one visible field-zone heading per rows/columns/metrics zone.

Query and transform tests:

- `buildQuery` compiles calculated fields into controlled adhoc metrics.
- calculated metrics render through Crosstab transform.
- persisted `crosstabFieldConfig.metrics` remains the priority source.
- runtime-only V4 state does not leak to `extra_form_data`.

Required validation commands before production release:

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
cd superset-frontend && npm run type -- --pretty false
git diff --check
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

If a focused Jest run discovers macOS AppleDouble `._*` files, classify that as
workspace hygiene first and remove those metadata files before treating it as a
product regression.

## Production Acceptance

Formal production acceptance may modify slice 10 directly.

Required production flow:

1. Back up slice 10 metadata, including `params` and `query_context`, before
   mutation.
2. Back up remote static assets before asset sync.
3. Build frontend assets locally.
4. Sync only `superset/static/assets/` for frontend-only changes.
5. Rebuild `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.
6. Recreate the `superset` compose service.
7. Wait for Docker health `healthy`.
8. Confirm server-local and public `/health` return `OK`.
9. Open production Explore slice 10 in the browser.
10. Create or save a chart-local V4 calculated field using `safe_div` or `pct`.
11. Add the calculated field to Crosstab metrics.
12. Save slice 10.
13. Reopen slice 10 and confirm the saved calculated field reloads.
14. Confirm `/api/v1/chart/data` returns `200`.
15. Capture screenshot evidence and scan recent production logs for errors.

The production report must include:

- source commit;
- old and new image IDs;
- asset backup path;
- slice 10 metadata backup path or command output;
- exact saved calculated field definition;
- browser URL and screenshot;
- chart data API status;
- log scan result;
- rollback instructions.

## Rollback

Rollback must be explicit because formal slice 10 can be modified.

Rollback path:

1. Restore slice 10 `params` and `query_context` from the pre-acceptance
   metadata backup.
2. Re-save or refresh the chart metadata through the Superset app context.
3. If the asset release must be reverted, restore the remote assets backup and
   rebuild/recreate the Superset image and service.
4. Re-run `/health`, Explore slice 10, and `/api/v1/chart/data` checks.

## Open Implementation Notes

- Keep the first implementation plan focused on V4. Do not implement V4.1 or
  V4.2 primitives in the same plan.
- Keep backend changes out unless the existing chart data path cannot compile
  the controlled adhoc metrics safely.
- Use task-sized review gates because V4 touches controls, query compilation,
  own-state isolation, production metadata, and browser acceptance.
