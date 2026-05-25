# Crosstab Dynamic Sort Summary Acceptance

Date: 2026-05-25

## Result

Accepted.

## Build

- Commit: `bf6d059b5c7eb9ca116409ecf0c5e5295f30d448`
- Image: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Image ID: `sha256:3bce7bc2246e21f82734e793d498680a7e2a891a14af8fa9b92044fabd7e2989`
- Container health: `apache-superset` is `running healthy`
- Server health: `ssh agentops 'curl -fsS http://127.0.0.1:8088/health'` returned `OK`
- Public health: `curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health` returned `OK`
- Asset backup: `agentops:/home/ubuntu/superset-docker/backups/assets-20260525101628`

## Slice 10 Metadata

- Backup: `docs/superpowers/reports/slice-10-before-dynamic-sort-summary-20260525100135.json`
- Target: `docs/superpowers/reports/slice-10-crosstab-dynamic-sort-summary-target-20260525.json`
- `serverColumnPagination`: `true`
- `columnPageSize`: `98`
- Row field: `metric_name_with_unit`
- Metric: `指标值`
- Row sort: `metric_order asc`, number, nulls last
- `rowValueSummaries` count: `41`
- Consistency: `params.crosstabFieldConfig` matches `query_context.form_data.crosstabFieldConfig`

## Runtime Evidence

- Dashboard URL: `http://111.230.91.24:8088/superset/dashboard/order-profit-msku-daily-dashboard/`
- Browser reload: production logs show dashboard `GET` 200 and multiple `POST /api/v1/chart/data` 200 responses at `2026-05-25 02:23:22-02:23:25 UTC`.
- Error scan: `docker logs --since 20m apache-superset | grep -Ei "error|exception|traceback|critical|ERR_CROSSTAB"` returned no rows.
- Domain/count: network evidence captured domain and count queries first with `columns=["biz_date"]`, `metrics=[]`, `orderby=[["biz_date", true]]`.
- Leaf page filter: network evidence captured leaf query with `columns=["metric_name_with_unit","metric_order","biz_date"]`, `metrics=["指标值"]`, and current page `biz_date` tuple filter.
- Row total summary scope: network evidence captured row total query with `columns=["metric_name_with_unit"]`, `metrics=["指标值"]`, and empty `where`.

## Business Display

- Dynamic column sort: visible columns are ordered by date ascending from `2025-01-01` through the current page.
- Metric row order: visible business rows follow configured `metric_order`, starting with `利润（金額）`, `毛利率（%）`, `销量（件）`, `销售额（金額）`, `平均售价（金額）`.
- `总计` scope: visible total column is present and supplied by the full-scope row total summary query.
- Native filters: `店铺`, `国家`, `分类`, `父体` remain visible.
- Dynamic dimension defaults: `维度1=日期`, `维度2=无`, `维度3=无`.
- Screenshots:
  - `docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-dashboard.png`
  - `docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-network.png`
- Network JSON: `docs/superpowers/reports/2026-05-25-crosstab-dynamic-sort-summary-network.json`

## Local Validation

- Focused Jest: `BABEL_ENV=test npx jest ... --runInBand` passed `7` suites and `146` tests.
- Production build: `BABEL_ENV=testableProduction npm run build` passed with existing webpack asset-size warnings only.

## Residual Risks

- The `npm run test -- ... --runInBand` wrapper conflicts with the repository's injected `--max-workers=80%`; focused validation used direct `npx jest --runInBand`.
- Browser network evidence JSON was captured before the image rebuild in the same target configuration; post-rebuild production logs and screenshot confirm the live dashboard path returned 200 and rendered successfully.
