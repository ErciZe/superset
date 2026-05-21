# Crosstab V3.1.1 And V3.2 Repository Acceptance

Date: 2026-05-21

## Repository Validation

- Focused Jest: PASS
  - `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/dynamicSlots.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts plugins/plugin-chart-crosstab-table/test/plugin/fieldConfig.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/transformProps.test.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand`
  - Result: 9 suites, 144 tests passed.
- Directory Jest: blocked by AppleDouble artifact; explicit tracked-list PASS
  - Exact directory command failed because untracked `._*` AppleDouble files were picked up as test suites and could not be parsed.
  - Tracked-list replacement:
    `BABEL_ENV=test npx jest $(git -C .. ls-files 'superset-frontend/plugins/plugin-chart-crosstab-table/test/**/*.test.*' 'superset-frontend/plugins/plugin-chart-crosstab-table/test/*.test.*' 'superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts' | sed 's#^superset-frontend/##') --runInBand`
  - Result: 18 suites, 202 tests passed.
- ESLint: PASS
  - `npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.ts src/explore/components/ExploreViewContainer/ownState.test.ts`
  - Result: 0 errors; existing warnings remain in crosstab engine/domain/key tests.
- TypeScript: PASS
  - `npm run type -- --pretty false`
- Production build: PASS
  - `BABEL_ENV=testableProduction npm run build`
  - Result: webpack compiled successfully with existing asset-size warnings.

## Notes

- V3.1.1 dynamic group-by control writes canonical `dynamicGroupBy.slots[]`.
- V3.2 dynamic metric uses selected metric definitions for summary semantics.
- Server-column pagination still fails fast outside the current `1 row dimension + 1 metric` shape.
- Malformed metric entries still fail fast with `Unsupported crosstab metric field.` instead of leaking raw metric-label TypeErrors.
