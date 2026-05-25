# Noway Table V1 Isolation Validation

## Scope

- `plugin-chart-ag-grid-table-scheme` is self-contained.
- Official `plugin-chart-ag-grid-table` no longer carries noway-only extension points.
- Crosstab and Chinese translations were not modified by this isolation work.

## Commands

- `BABEL_ENV=test npx jest plugins/plugin-chart-ag-grid-table-scheme/test --runInBand`
- `npx eslint plugins/plugin-chart-ag-grid-table-scheme/src plugins/plugin-chart-ag-grid-table-scheme/test plugins/plugin-chart-ag-grid-table/src/AgGridTable/index.tsx plugins/plugin-chart-ag-grid-table/src/AgGridTableChart.tsx plugins/plugin-chart-ag-grid-table/src/renderers/NumericCellRenderer.tsx plugins/plugin-chart-ag-grid-table/src/renderers/TextCellRenderer.tsx plugins/plugin-chart-ag-grid-table/src/types.ts plugins/plugin-chart-ag-grid-table/src/utils/getCellStyle.ts plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts`
- `npm run type`
- `BABEL_ENV=test npx jest plugins/plugin-chart-ag-grid-table/test --runInBand`

## Result

- Jest: PASS, 14 suites and 70 tests passed for `plugin-chart-ag-grid-table-scheme/test`.
- ESLint: PASS with warnings only.
- TypeScript: PASS.
- Official table smoke: not applicable after cleanup; Jest returned `No tests found` because the only official plugin tests in that directory were the noway-only tests moved to the scheme plugin.

## Notes

- Removed copied macOS `._*` sidecar files before rerunning full Jest validation.
- Refreshed `package-lock.json` with `npm install --package-lock-only --ignore-scripts`; npm reported the local Node `v22.22.1` does not match the project engine `^20.18.1`, but the lockfile update completed.
- Baseline warnings observed: duplicate Jest manual mocks, stale Browserslist data, Babel lodash deprecation, and existing React hook / Ant Design deprecation lint warnings.
