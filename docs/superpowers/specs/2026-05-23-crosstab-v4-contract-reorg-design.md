# Crosstab V4 Contract Reorganization Design

Date: 2026-05-23

## Status

Approved design for the V4 contract-reorganization phase.

This design supersedes
`docs/superpowers/specs/2026-05-22-crosstab-v4-product-completion-design.md`
where the two conflict.

The key change is scope posture:

- treat V4 completion as a contract reorganization, not a narrow patch;
- directly replace the current V4 template-era contract in development stage 2;
- remove legacy V4 write paths instead of preserving long-lived compatibility;
- close source validation, saved-slice truth, query generation, and formal
  acceptance as one product boundary.

## Goal

Complete Crosstab V4 as a single coherent product contract.

Business users should be able to define chart-local parameters and calculated
fields, select calculated fields as Crosstab metrics, save the chart, reopen
it, query it, and render it without the persisted state drifting across
multiple sources of truth.

## Completion Boundary

V4 is complete only when these four loops are closed:

1. Persisted truth loop
   `crosstabParameters`, `crosstabCalculatedFields`, and
   `crosstabFieldConfig.metrics` are the only formal V4 persisted truth.
2. Save and reload loop
   Explore save, chart reopen, visible control state, and generated query all
   resolve from the same canonical data.
3. Query and render loop
   query generation consumes validated canonical definitions, render consumes
   query results, and runtime-only state does not become persisted metadata.
4. Formal acceptance loop
   slice 10 can be backed up, edited, saved, reopened, queried, screenshotted,
   and rolled back with explicit evidence.

Local tests are necessary but not sufficient. Formal acceptance requires the
saved slice.

## Non-Goals

- No legacy V4 compatibility layer for development stage 2.
- No dataset-level persistence.
- No arbitrary SQL or Jinja editor.
- No new backend API if the existing chart save and chart data flow are
  sufficient.
- No V4.1 or V4.2 features such as conditionals, cumulative calculations,
  year-over-year, or period-over-period logic.
- No cross-chart abstraction of the Crosstab parameter or AST model in this
  phase.

## Canonical Persisted Contract

V4 persists exactly three business-facing objects:

- `crosstabParameters`
- `crosstabCalculatedFields`
- `crosstabFieldConfig.metrics`

Responsibilities:

- `crosstabParameters` defines chart-local number and text parameters.
- `crosstabCalculatedFields` defines chart-local calculated metrics through a
  typed AST.
- `crosstabFieldConfig.metrics` defines which metrics or calculated fields are
  actively selected for the Crosstab metric zone.

`query_context` is derived cache, not persisted truth.

Top-level `metrics` is not part of the V4 contract.

The system may still need to read incidental stale metadata while code is being
replaced during development, but the reorganized implementation must not write
or preserve a dual-track V4 state. After a save, the chart should have exactly
one interpretable V4 truth surface.

## Data Model

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

type CrosstabExpressionNode =
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

type CrosstabCalculatedField = {
  id: string;
  name: string;
  description?: string;
  resultType: 'number' | 'ratio' | 'percent' | 'text';
  formatString?: string;
  ast: CrosstabExpressionNode;
};
```

Design constraints:

- IDs are stable chart-local identifiers.
- Names are unique within the chart.
- The AST is the only persisted expression contract.
- Free-form SQL preview may exist for readability, but it is not a source of
  truth.

## Layer Boundaries

The reorganized V4 flow has four layers.

### Control Layer

Owns only structured editing of:

- `crosstabParameters`
- `crosstabCalculatedFields`
- `crosstabFieldConfig.metrics`

It may provide:

- instant field validation;
- typed AST builders;
- readable previews;
- create, edit, duplicate, and delete flows.

It must not:

- emit final SQL;
- silently repair broken configuration;
- write runtime interaction state into persisted form data.

### Validation Layer

Acts as the single semantic gate before save and before query compilation.

Required checks:

- unique parameter IDs and names;
- unique calculated field IDs and names;
- valid metric references;
- valid parameter references;
- no text parameter inside numeric arithmetic;
- numeric-only arguments for `safe_div`, `pct`, and `ratio`;
- no empty AST;
- no unsupported node kinds;
- no recursive calculated-field references;
- reject literal zero denominator where validation can prove it statically.

Validation is fail-fast. Invalid definitions block save.

### Compilation Layer

Consumes only validated canonical definitions and emits controlled adhoc metrics
for query generation.

Responsibilities:

- resolve metric references;
- resolve runtime parameter values;
- preserve result semantics and format strings;
- compile `safe_div`, `pct`, and `ratio` for the supported Doris production
  path;
- reject unsupported cases explicitly.

It must not infer user intent from malformed state.

### Query and Render Layer

- `buildQuery` consumes compiled definitions and produces the request payload.
- `transformProps` consumes results and display metadata only.
- render code must not reconstruct calculated-field definitions from query data.

This separation keeps query generation, rendering, and state persistence from
bleeding into one another.

## Save, Reload, And Own-State Boundary

Only definitions persist.

Persisted state:

- `crosstabParameters`
- `crosstabCalculatedFields`
- `crosstabFieldConfig.metrics`

Runtime-only state remains in `ownState`, including:

- current number parameter values;
- current text parameter values;
- selected dynamic metric;
- effective metric signature;
- column pagination state;
- tuple cache state;
- expanded row paths when they are interaction-only.

Save and reload requirements:

- saving a chart writes only canonical V4 definitions;
- reopening the chart rehydrates controls from the same canonical definitions;
- selected metrics, visible controls, and generated query inputs stay aligned;
- `query_context` is regenerated as derived state and must not act as an
  independent persisted truth source.

## Implementation Surface

The reorganization stays inside the Crosstab plugin and the Explore own-state
boundary.

In scope:

- `superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts`
- parameter normalization and runtime resolution utilities;
- AST validation and compilation utilities;
- calculated-field normalization and metric resolution;
- parameter and calculated-field control components;
- control panel wiring;
- `buildQuery`;
- `transformProps`;
- `CrosstabTable` runtime parameter UI;
- `superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
- focused unit and component tests around the new contract.

Out of scope:

- backend API expansion unless current contracts prove insufficient;
- non-Crosstab chart adoption;
- broad refactors outside the Crosstab V4 responsibility surface.

## Testing Strategy

All three validation layers must pass.

### 1. Source Validation

Verify the new contract in isolation:

- parameter normalization and runtime resolution;
- AST validation;
- calculated-field normalization and cycle detection;
- controlled query compilation;
- control-panel editing flows;
- `ownState` stripping;
- `transformProps` staying result-driven.

Because this phase directly replaces the old V4 flow, tests should remove old
template-era expectations instead of preserving them.

### 2. Saved-State Validation

Verify the persisted chart metadata directly:

- `params` contains only the new V4 truth surface;
- selected metrics resolve through `crosstabFieldConfig.metrics`;
- `query_context` is derived state, not an independent source of truth;
- reopening Explore shows the same definitions that are saved.

### 3. Formal Acceptance

Use slice 10 as the formal acceptance chart and keep evidence for:

- metadata backup;
- Explore edit and save;
- reopen and reload;
- `POST /api/v1/chart/data?form_data={"slice_id":10}` returning HTTP `200`;
- screenshot capture;
- explicit rollback instructions and evidence.

## Acceptance Criteria

The phase is complete only when all of the following are true:

- a chart can create, edit, save, reopen, and query V4 parameters and
  calculated fields through the canonical contract only;
- no split truth remains across `params`, top-level `metrics`, and
  `query_context`;
- runtime-only state does not leak into persisted metadata;
- `slice 10` proves the formal acceptance loop end-to-end;
- rollback evidence exists for the production-facing acceptance slice.

## Open Decisions Resolved In This Design

- Use direct replacement, not legacy V4 compatibility.
- Treat `query_context` as derived state only.
- Keep the phase frontend-scoped unless existing chart contracts are proven
  insufficient.
- Keep formal acceptance on slice 10.
