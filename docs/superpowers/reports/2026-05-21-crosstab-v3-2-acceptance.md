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

## Production Test Deployment

- Git provenance: `noway-release` at `aaa792edadc19b8394ce3c04c198b5f1f10cf4af`, pushed to `fork/noway-release`.
- Remote assets backup: `backups/assets-20260521180603`.
- Asset dry-run before sync: 20 changed/new files, 9 delete entries, 1 other entry.
- Asset sync: PASS.
- Image rebuild: PASS.
  - Image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
  - Image ID: `sha256:7321d981854bf20ac1b7479b87a13b3d26bc80eed43aaec1479499672b2991f0`
  - Created: `2026-05-21T18:06:27.882450953+08:00`
- Service restart: PASS.
  - Container: `apache-superset`
  - Status: `running healthy`
- Health checks: PASS.
  - Remote-local: `curl -fsS http://127.0.0.1:8088/health` returned `OK`.
  - Public: `curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health` returned `OK`.
  - Public root returned `302` to `/superset/welcome/`.
- Static asset evidence: PASS.
  - `crosstab-dynamic-metric-control` exists in both remote deployment assets and container assets.
- Slice 10 metadata inspection: PASS for no accidental formal mutation.
  - Slice 10 exists: `订单利润指标矩阵 - 日维度`.
  - `viz_type`: `crosstab-table`.
  - `dynamicMetric`: not present yet.
  - `dynamicGroupBy`: present.
  - `crosstabFieldConfig`: present.
- Logs: PASS.
  - Recent post-restart scan found no `error`, `exception`, `traceback`, or `critical` lines.

## Production Acceptance Boundary

- Production test deployment is complete.
- Copied-chart V3.1.1/V3.2 browser acceptance is still pending because authenticated Explore access is required and no copied-chart URL has been recorded yet.
- Formal slice 10 metadata update remains gated until copied-chart acceptance passes.
