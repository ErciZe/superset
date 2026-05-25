# Crosstab v2 Production Closeout

Date: 2026-05-20
Workspace: `/Volumes/extend/ecode-workspace/superset-source`
Branch: `noway-release`

## Verdict

Status: blocked for production v2 acceptance.

The code release path completed: `noway-release` was pushed to `fork`, production assets were built and synced, the production image was rebuilt, and `apache-superset` was recreated on the new image. Health checks passed.

Production slice 10 was then updated with explicit v2 `crosstabFieldConfig` and metric semantic overrides, but browser verification showed a blank crosstab area in both Dashboard and Explore. The service returned `chart/data` HTTP 200 responses and SQL baseline checks passed, so the blocker is on the browser/rendering side of the v2 chart path. To avoid leaving the production chart in a visibly broken state, slice 10 metadata was rolled back to the pre-v2 backup.

## Release Evidence

| Item | Result |
| --- | --- |
| Local commit | `a73a3d9608 feat: add crosstab v2 metric semantics` |
| Push | `fork/noway-release` updated `bd5a7c9e0c..a73a3d9608` |
| Frontend build | `BABEL_ENV=testableProduction npm run build` completed with existing Superset size warnings |
| Assets backup | `/home/ubuntu/superset-docker/backups/assets-20260520163937` |
| Image tag | `apache-superset-doris:6.0.0-zh-column-scheme-matrix` |
| Running image ID | `sha256:b874a3a1d94adf245374fe2603db363e7b4123e05de781b457f541207f0d047e` |
| Container health | `apache-superset` running and healthy |
| Internal health | `http://127.0.0.1:8088/health -> OK` |
| Public health | `http://111.230.91.24:8088/health -> OK` |

## Slice 10 Metadata Attempt

Backups created before mutation:

- Params: `/home/ubuntu/superset-docker/backups/slice-10-params-20260520170020.json`
- Query context: `/home/ubuntu/superset-docker/backups/slice-10-query-context-20260520171034.json`

Attempted v2 config:

- `rows = [{ field: "metric_name_with_unit", label: "指标项" }]`
- `columns = ["biz_date", "shop_name", "country"]`
- `metrics = [{ metric: "指标值", semantic: "additive" }]`
- `semanticOverrideField = "metric_name_with_unit"`
- `semanticOverrides = 41`: `additive=21`, `ratio=19`, `average=1`
- `generatedColumnWidth = 120`

Rollback result:

- `crosstabFieldConfig = null`
- `generatedColumnWidth = null`
- `query_context.queries = 1`

## SQL Baseline

Time range: `2025-01-01 <= biz_date < 2025-01-21`

| Metric | Semantic | Leaf groups | Leaf simple sum | SQL summary | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| 销售额（金额） | additive | 389 | 567999.820000 | 567999.820000 | Matches |
| 毛利率（%） | ratio | 389 | -3187.731431 | -9.514501 | SQL summary required |
| 平均售价（金额） | average | 389 | 18674.282870 | 98.696754 | SQL summary required |

## Browser Evidence

| Evidence | Path | Observation |
| --- | --- | --- |
| Headless unauthenticated | `docs/superpowers/reports/2026-05-20-crosstab-v2-production-dashboard.png` | Login page only |
| Chrome dashboard | `docs/superpowers/reports/2026-05-20-crosstab-v2-production-dashboard-chrome-final.png` | Logged-in dashboard shell loads, crosstab area blank |
| Chrome Explore | `docs/superpowers/reports/2026-05-20-crosstab-v2-production-explore-slice10.png` | Explore shell loads, crosstab result area blank |

Server logs during browser checks showed successful dashboard/chart metadata and `chart/data` calls, including multiple `POST /api/v1/chart/data` 200 responses. Logs also included `HTTPException: 405 Method Not Allowed` warnings during Explore/browser activity, so the planned "no error/exception/traceback" log gate did not pass.

## Remaining Blocker

The production v2 chart path still needs a frontend rendering diagnosis with browser console evidence. The likely boundary is the interaction between saved slice query context, server-column pagination ownState, and the new non-additive summary query plan. The production chart metadata is rolled back while the deployed code remains live on the new image.
