# Crosstab Dynamic Controls Production Acceptance

Date: 2026-05-25

## Scope

- Fixed crosstab runtime toolbar dynamic selector labels and select width so dimension values display fully.
- Fixed Explore control rendering when saved `dynamicGroupBy` / `dynamicMetric` values are stored as JSON strings.
- Verified adjacent dynamic group-by, dynamic metric, and dynamic slot tests.

## Commits

- `12be4c48a4 fix(crosstab): render saved dynamic controls`

## Validation

- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts --runInBand`
  - Result: 4 suites passed, 99 tests passed.
- `npm run eslint -- plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicMetricControl.tsx plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - Result: passed.
- `npx prettier --check plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicMetricControl.tsx plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
  - Result: passed.
- `npm run type`
  - Result: passed.
- `BABEL_ENV=testableProduction npm run build`
  - Result: compiled successfully with existing webpack asset-size warnings.

## Production Deployment

- Remote assets backup: `backups/assets-20260525104505`
- Image tag: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- New image: `sha256:1736a1cf737fa72100b93d39bd07a87980c940c7a87e348be49d5260fd788361`
- Container state: `running healthy`
- Remote health: `OK`
- Public health: `OK`

## Evidence

- Screenshot: `docs/superpowers/reports/2026-05-25-crosstab-dynamic-controls-production.png`
- Dashboard state in screenshot: published dashboard, crosstab table rendered, dynamic dimension selectors visible with full labels and values.
