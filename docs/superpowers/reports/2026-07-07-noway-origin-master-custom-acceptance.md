# Noway Origin Master Custom Acceptance Baseline

## Purpose

This document defines the local custom behavior that must survive the
`noway-release` update to the latest `origin/master`. Treat this as the
acceptance checklist before production publication.

## Source Baseline

- Branch: `noway-release`
- Baseline commit before upstream merge: `dc8dd749b81699568b199cbbac7a6c71deeca974`
- Upstream target: latest `origin/master`
- Remote deployment target: `agentops:/home/ubuntu/superset-docker`
- Production image tag: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`

## Custom Capability Inventory

### AG Grid Table Scheme

- Plugin path: `superset-frontend/plugins/plugin-chart-ag-grid-table-scheme`
- Preserve table-scheme rendering, matrix mode, column view scheme integration,
  local table runtime isolation, cross-filter behavior, and server pagination.
- Preserve the server-side advanced filter bar introduced for WHM order detail
  style tables.
- The plugin must not depend on noway-only extensions in the official AG Grid
  table plugin runtime.

Acceptance checks:

- `BABEL_ENV=test npx jest plugins/plugin-chart-ag-grid-table-scheme/test --runInBand`
- Explore chart using the table scheme loads without visualization registration
  errors.
- Advanced filter bar accepts configured fields, sends the expected query
  payload, and updates the grid rows.
- Matrix mode renders row/column measures and keeps column view scheme state.

### Crosstab Table

- Plugin path: `superset-frontend/plugins/plugin-chart-crosstab-table`
- Preserve dynamic row/column/metric controls, runtime parameters, calculated
  field AST support, SQL summaries/totals, row and column config metadata,
  dimension sort controls, server column pagination, and cell formatter support.
- Keep formatter expressions out of query payloads and keep inline CSV export
  removed.
- Dashboard time filters must continue to affect crosstab queries.

Acceptance checks:

- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent`
- Explore chart `slice_id=10` loads the crosstab visualization and returns rows.
- Dynamic group-by and dynamic metric selectors update the rendered matrix.
- Calculated fields compile through the v4 AST path and render business values.
- Server column pagination changes column pages without stale page data.
- Summary sorting/totals render consistently with saved chart configuration.

### Easy Date Range Picker

- Frontend path: `superset-frontend/src/filters/components/Time`
- Preserve the native filter flag that enables the easy date range UI.
- Preserve default behavior when the flag is absent.

Acceptance checks:

- `npm run test -- TimeFilterPlugin.test.tsx --runInBand`
- Native time filter with the easy date range flag renders the easy picker.
- Native time filter without the flag uses the upstream default date range UI.

### Column View Scheme Backend

- Backend path: `superset/column_view_scheme`
- Preserve API registration during Superset initialization, schema validation,
  command behavior, migrations, and frontend integration points.
- New upstream app initialization changes must not silently skip this API.

Acceptance checks:

- Backend unit/API tests for `column_view_scheme` commands, schemas, and API
  routes pass.
- Database migration containing column view scheme tables applies cleanly.
- Authenticated API calls can list, create/update, and read a scheme used by the
  AG Grid scheme plugin.

### Chinese Runtime And Production Overlay

- Preserve `superset/translations/zh/LC_MESSAGES/messages.po` changes that are
  part of the Noway release.
- Preserve the production Dockerfile behavior that overlays Chinese runtime
  assets from the remote deployment tree.

Acceptance checks:

- Frontend build completes with translated assets.
- Production container serves updated Chinese strings after image rebuild.
- Remote `superset-zh` overlay inputs are backed up before release.

## Release Gate

Production release is allowed only after all of the following are true:

- Remote backup exists and includes source, compose/env metadata, assets, image
  state, and metadata database dump when available.
- `BABEL_ENV=testableProduction npm run build` passes.
- Targeted frontend and backend tests above pass or any skipped item has a
  concrete environment blocker recorded.
- `pre-commit run --all-files` has no unexplained failure.
- `rsync -ainc --delete` output has been reviewed before real sync.
- Rebuilt container is `running` and Docker health is `healthy`.
- Server-local and public `/health` endpoints return `OK`.
- Core browser acceptance checks pass for AG Grid scheme, Crosstab, column view
  scheme usage, and Easy Date Range.
