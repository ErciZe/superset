# Noway Release Table Isolation Design

## Summary

`noway-release` is the internal enterprise product branch. `origin/master` is the
official Apache Superset upstream reference and should be treated as a source for
selective design and compatibility updates, not as a blind merge target.

Before absorbing upstream table-chart changes, converge `noway table v1` into an
independent chart plugin. Its business behavior should live under
`plugin-chart-ag-grid-table-scheme` instead of requiring local modifications to
the official `plugin-chart-ag-grid-table`.

The retained internal product surface is:

- `plugin-chart-crosstab-table`
- `plugin-chart-ag-grid-table-scheme` as `noway table v1`
- `superset/translations/zh/LC_MESSAGES/messages.po`

Other local changes should be treated as optional and should follow upstream
unless they are required by one of those retained surfaces.

## Goals

- Keep `noway-release` as the internal branch of record.
- Make `noway table v1` independently maintainable.
- Reduce future conflict risk when upstream changes the official AG Grid table
  plugin.
- Preserve current `noway table v1` business features: matrix mode, column view
  schemes, matrix cell coloring, matrix cell JavaScript formatter, and column
  settings controls.
- Keep Crosstab and Chinese translation maintenance independent from the noway
  table isolation work.

## Non-Goals

- Do not merge `origin/master` into `noway-release` as part of this design.
- Do not redesign Crosstab behavior.
- Do not change backend APIs unless a retained internal feature already requires
  it.
- Do not create a shared table framework unless duplication becomes materially
  larger than the current dependency risk.
- Do not preserve unrelated local table, pivot, SQL Lab, or dashboard changes by
  default.

## Current Coupling

`plugin-chart-ag-grid-table-scheme` currently depends on the official AG Grid
table plugin in several ways:

- `AgGridTableSchemeChart.tsx` renders
  `@superset-ui/plugin-chart-ag-grid-table/src/AgGridTableChart`.
- `transformProps.ts` calls the official `transformProps` and imports official
  table types plus `DateWithFormatter`.
- `controlPanel.tsx` imports the official control panel and mutates its sections.
- `matrix/buildQuery.ts` delegates to the official `buildQuery`.
- `index.ts` imports official images and re-exports official types.
- The official AG Grid table plugin has local changes for noway-only extension
  points such as column view toolbar height, toolbar rendering, additional cell
  styling, and additional cell formatting.

This means `noway table v1` is currently directory-separated but not
maintenance-separated. Any upstream change to the official table plugin can still
conflict with internal noway behavior.

## Proposed Design

### Ownership Boundary

`plugin-chart-ag-grid-table-scheme` owns all noway-specific behavior. The
official `plugin-chart-ag-grid-table` should not contain noway-only extension
points after isolation.

Allowed dependencies for `plugin-chart-ag-grid-table-scheme`:

- `@superset-ui/core`
- `@superset-ui/chart-controls`
- shared Superset frontend utilities that are not specific to the official AG
  Grid table plugin
- third-party dependencies already justified by noway table behavior, such as
  `react-sortable-hoc`

Avoid dependencies on:

- `../../plugin-chart-ag-grid-table/src/*`
- `@superset-ui/plugin-chart-ag-grid-table/src/*`

### Internalized Modules

Move or copy only the needed table runtime pieces into
`plugin-chart-ag-grid-table-scheme`.

Required local modules:

- chart shell equivalent to `AgGridTableChart`
- AG Grid table rendering wrapper
- column definition builder
- cell renderer support for text and numeric cells
- cell style helpers
- date formatting helper needed by matrix labels
- form-data and transformed-prop types
- build-query and transform-props base behavior used by noway table
- local thumbnail and gallery assets or neutral metadata assets

This is intentional duplication. It creates a stable internal product boundary
and prevents upstream official table churn from becoming noway table conflict
surface.

### Official Table Cleanup

After localizing the needed code, remove noway-only changes from
`plugin-chart-ag-grid-table`:

- `renderColumnViewToolbar`
- `columnViewToolbarHeight`
- `additionalCellStyle`
- `additionalCellFormatter`
- related renderer and column-def plumbing added only for noway table behavior
- noway-only tests under the official table plugin

The official table plugin should remain close to upstream so future upstream
updates can be evaluated with less noise.

### Upstream Absorption Rule

When `origin/master` introduces table-chart improvements, classify each change:

- Official AG Grid table fixes: apply to the official plugin only if they are
  still relevant to the internal branch.
- Noway table relevant behavior: port manually into
  `plugin-chart-ag-grid-table-scheme`.
- Generic utility improvements: consider extracting only if there are at least
  two real consumers and the extraction does not widen the merge surface.

Do not pull upstream official table internals into noway table through imports
after isolation.

## Retained Product Surfaces

### Cross Table

Crosstab remains under `plugin-chart-crosstab-table`. It should stay independent
from noway table internals. Shared semantics, such as dynamic JavaScript cell
formatting, should be copied or expressed through small local modules rather than
importing from `plugin-chart-ag-grid-table-scheme`.

### Noway Table V1

`noway table v1` is the independent enterprise table component. It owns matrix
mode, column view schemes, and matrix cell presentation logic.

### Chinese Translation

Chinese translation updates remain in
`superset/translations/zh/LC_MESSAGES/messages.po`. Translation updates should be
kept as a separate review surface because upstream catalog changes often create
large, noisy diffs.

## Migration Plan

1. Inventory all imports from `plugin-chart-ag-grid-table-scheme` into
   `plugin-chart-ag-grid-table`.
2. Create scheme-local types, chart shell, renderer, style, date formatting,
   build-query, and transform-props modules.
3. Switch `plugin-chart-ag-grid-table-scheme` imports to local modules.
4. Add or move focused tests so noway behavior is covered inside the scheme
   plugin test directory.
5. Remove noway-only extensions from the official AG Grid table plugin.
6. Run focused noway table tests.
7. Re-check diff against upstream to verify remaining official table changes are
   either upstream-aligned or explicitly justified.

## Validation

Focused checks should include:

```bash
BABEL_ENV=test npx jest \
  plugins/plugin-chart-ag-grid-table-scheme/test \
  --runInBand
npx eslint \
  plugins/plugin-chart-ag-grid-table-scheme/src \
  plugins/plugin-chart-ag-grid-table-scheme/test
```

If official table cleanup touches tests, also run the affected official table
tests. If Crosstab or translations are not changed, do not include them in the
same validation batch.

## Acceptance Criteria

- `plugin-chart-ag-grid-table-scheme` has no imports from
  `plugin-chart-ag-grid-table/src`.
- `@superset-ui/plugin-chart-ag-grid-table` is no longer a package dependency of
  `@superset-ui/plugin-chart-ag-grid-table-scheme`.
- `noway table v1` still exposes and renders matrix mode, column view schemes,
  matrix cell coloring, and matrix cell JavaScript formatting.
- The official `plugin-chart-ag-grid-table` no longer carries noway-only
  extension points.
- Crosstab remains independent from noway table internals.
- Chinese translation changes remain isolated from component refactors.

## Risks

- Localizing the official table runtime creates short-term duplication. This is
  acceptable because it reduces future merge conflict risk for the internal
  product branch.
- If upstream later introduces a major AG Grid table rewrite, noway table must
  evaluate and port useful behavior manually.
- Tests need to move with the ownership boundary; otherwise regressions can hide
  in the copied runtime code.
