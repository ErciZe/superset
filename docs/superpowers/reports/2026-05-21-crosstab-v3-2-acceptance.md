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

## Dynamic Slot Hotfix Deployment

- Trigger: production Explore customization panel showed `TypeError: Cannot read properties of undefined (reading 'map')` in the Dynamic metrics control on slice 10.
- Root cause: saved disabled dynamic-slot values can omit `slots`; the control render path and resolver path assumed canonical `slots[]`.
- Fix commit: `71e23cf259` (`fix(crosstab): tolerate disabled dynamic slot values`), pushed to `fork/noway-release`.
- Scope:
  - Dynamic metric control render normalization for disabled/incomplete saved values.
  - Dynamic group-by control render normalization for the same saved-value shape.
  - Resolver compatibility for `{ enabled: false }` without `slots`, while keeping enabled configs without slots invalid.
- Repository validation: PASS.
  - `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts --runInBand`
  - Result: 3 suites, 62 tests passed.
  - `npx eslint plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicMetricControl.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx plugins/plugin-chart-crosstab-table/src/plugin/dynamicMetric.ts plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicMetric.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts`
  - Result: PASS.
  - `npm run type -- --pretty false`
  - Result: PASS.
  - `BABEL_ENV=testableProduction npm run build`
  - Result: PASS with existing webpack asset-size warnings.
- Production test deployment: PASS.
  - Remote assets backup: `backups/assets-20260521182056`.
  - Asset dry-run before sync: 3 changed/new files, 10 delete entries, 2 other entries.
  - Image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.
  - Image manifest list: `sha256:83fc8748223d230ec0988933f59320e20966cc3c9ec2b68129e4d242e6ea3be9`.
  - Container: `apache-superset` is `running healthy`.
  - Public health: `curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health` returned `OK`.
  - Static asset evidence: `crosstab-dynamic-metric-control` exists in both remote deployment assets and container assets.
  - Targeted post-browser log scan found no `TypeError`, `Cannot read`, `ERR_CROSSTAB`, `ERROR`, or `CRITICAL` entries.
  - Residual log noise: one static-file 404 for `/static/assets/theme-[object Object].js` during Chrome refresh; the Explore page still rendered and the crosstab TypeError did not return.
- Browser production validation: PASS.
  - Chrome authenticated Explore URL refreshed to the deployed bundle.
  - The `定制化配置` tab renders `Dynamic group by` and `Dynamic metrics` controls.
  - The previous `TypeError: Cannot read properties of undefined (reading 'map')` alert is no longer present.

## Production Acceptance Boundary

- Production test deployment is complete.
- Dynamic slot disabled-value hotfix is production-tested complete.
- Copied-chart V3.1.1/V3.2 browser acceptance is still pending because authenticated Explore access is required and no copied-chart URL has been recorded yet.
- Formal slice 10 metadata update remains gated until copied-chart acceptance passes.

## Current Slice Temporary Browser Acceptance

- Date: 2026-05-21.
- Target: `http://111.230.91.24:8088/explore/?dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10`.
- Scope boundary: used a temporary Explore `form_data_key`; did not save, copy, or mutate formal slice 10 metadata.
- Browser result: PASS for temporary V3.2 dynamic metric acceptance.
  - Fresh Chrome Explore load had no `TypeError: Cannot read properties of undefined (reading 'map')`.
  - `定制化配置` renders `Dynamic metrics`.
  - Temporary `dynamicMetric` slot `primary_metric` rendered chart toolbar selector `data-test="crosstab-dynamic-metric-control--primary_metric"`.
  - Selector options `销售额`, `毛利率`, and `平均售价` all switched without alert or console error.
- Screenshots:
  - `docs/superpowers/reports/2026-05-21-crosstab-v3-2-temp-sales.png`
  - `docs/superpowers/reports/2026-05-21-crosstab-v3-2-temp-margin-rate.png`
  - `docs/superpowers/reports/2026-05-21-crosstab-v3-2-temp-average-price.png`
- Visible current-page values under existing server-column pagination (`列 1-8 / 389`):
  - `销售额（金额）` visible total: `3,142.64`.
  - `毛利率（%）` visible total: `-9.51`.
  - `平均售价（金额）` visible total: `98.70`.
- Baseline caveat: the full SQL baseline `销售额=567999.82`, `毛利率=-9.5145`, `平均售价=98.6968` is not fully visible on the first paginated browser column page. The browser evidence confirms the rendered visible totals round consistently for ratio/average (`-9.51`, `98.70`) and preserves the paginated sales row, but this temporary current-slice check should not be recorded as copied-chart/full-total acceptance.
- State isolation:
  - URL did not include `selectedDynamicMetric` or `selectedDynamicGroupBy`.
  - Formal slice 10 metadata still has no `dynamicMetric`.
- Logs:
  - Strict post-check scan for `TypeError`, `Cannot read`, `ERR_CROSSTAB`, `:ERROR:`, and `:CRITICAL:` returned no entries.
  - Broad `ERROR` substring scan can match the logger name `superset.views.error_handling`; those entries were WARNING-level `HTTPException` noise, not `ERROR`/`CRITICAL`.
