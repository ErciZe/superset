# Crosstab V4 Contract Reorg Acceptance

## Verdict

- Status: complete.
- Scope: source contract reorganization is present at `aff3a1c98ed02c9d28e88499eb0f81bdd9a8c8dd`; production slice 10 saves and reloads the canonical V4 surfaces; chart data execution returns the calculated metric.
- Known note: the pre-existing `pre-commit` executable was not on PATH, so validation used `uvx pre-commit run --files ...`; all selected hooks passed.

## Source And Release

- Source branch: `noway-release`.
- Source commit: `aff3a1c98ed02c9d28e88499eb0f81bdd9a8c8dd` (`fix(crosstab): harden canonical v4 contract guards`).
- Fork sync: `git rev-list --left-right --count HEAD...fork/noway-release` returned `0 0`.
- Asset backup path: `agentops:/home/ubuntu/superset-docker/backups/assets-20260524164619`.
- Slice backup JSON: `docs/superpowers/reports/slice-10-crosstab-v4-contract-reorg-backup-20260524165140.json`, md5 `f9d6218acaa95f5c7d61d52fa98f03f1`.
- Previous image ID: not captured by the resumed execution; remote image list no longer exposes a separate dangling previous image for the active tag.
- Current image ID: `sha256:5e7e08c71d1e7e0184171f3ef9644b352888ba9cc2a0821473864147e7dffd27`, created `2026-05-24T16:46:32+08:00`.

## Local Validation

- Focused Jest: `BABEL_ENV=test npx jest ... --runInBand` passed `10` suites and `193` tests.
- TypeScript: `npm run type -- --pretty false` exited `0`.
- Pre-commit: `uvx pre-commit run --files ...` exited `0`; frontend eslint and Type-Checking hooks passed.
- Whitespace: `git diff --check` exited `0`.
- Scoped whitespace: `git diff --check HEAD -- superset-frontend/plugins/plugin-chart-crosstab-table superset-frontend/src/explore/components/ExploreViewContainer` exited `0`.
- Production build: `BABEL_ENV=testableProduction npm run build` exited `0`; webpack compiled with the existing asset-size and entrypoint-size warnings only.

## Production Validation

- SSH preflight: `agentops` resolved to `VM-16-12-ubuntu`; `/home/ubuntu/superset-docker` exists.
- Server health: `ssh agentops 'curl -fsS http://127.0.0.1:8088/health'` returned `OK`.
- Public health: `curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health` returned `OK`.
- Container inspect: `image=sha256:5e7e08c71d1e7e0184171f3ef9644b352888ba9cc2a0821473864147e7dffd27 status=running health=healthy`.
- Compose state: `apache-superset` is `Up ... (healthy)` on `0.0.0.0:8088->8088/tcp`; `apache-superset-redis` is also healthy.
- Chart data logs: latest reload produced `POST /api/v1/chart/data?form_data=%7B%22slice_id%22%3A10%7D HTTP/1.1" 200`.
- Error scan: `docker logs --since 10m apache-superset | grep -Ein "error|exception|traceback|critical|ERR_CROSSTAB"` returned no rows.

## Browser Save/Reload Validation

- Explore URL: `http://111.230.91.24:8088/explore/?form_data_key=g5QJXWKMUUE&dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10`.
- Chart title: `订单利润指标矩阵 - 日维度`.
- Screenshot: `docs/superpowers/reports/2026-05-23-crosstab-v4-contract-reorg-explore-slice10.png`, `1920x1080`, md5 `e2fbe4dae7eb36b1617a4c3e28c2122f`.
- Parameter definition: `param_adjustment`, `kind=number`, label `V4验收调整系数`, default `1.25`, min `0`, max `3`, step `0.01`, unit `x`.
- Calculated-field definition: `calc_adjusted_margin_pct_v4`, name `V4验收含参毛利率`, result type `percent`, format `.2%`, AST `pct(v4_gross_profit_sum, v4_sales_amount_sum) * param_adjustment`.
- Selected metric-chip evidence: `crosstabFieldConfig.metrics` includes `{ metric: "V4验收含参毛利率", label: "V4验收含参毛利率", calculatedFieldId: "calc_adjusted_margin_pct_v4", semantic: "ratio", formatString: ".2%" }`.
- Legacy truth surfaces: production metadata has `metrics=[]`, `parameters=[]`, and `calculatedFields=[]`.
- Query-context proof: saved query context contains metric labels `V4毛利`, `V4销售额`, and `V4验收含参毛利率`; generated SQL is `(((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100) * 1.25)`.
- Response-level proof: production `/api/v1/chart/data` test-client request returned status `200`; `colnames` included `V4验收含参毛利率`; first sample row contained `V4验收含参毛利率=-35.141925`.

## Rollback

- Restore assets from `agentops:/home/ubuntu/superset-docker/backups/assets-20260524164619` into `/home/ubuntu/superset-docker/superset-source/superset/static/assets/`.
- Restore slice 10 params/query_context from `docs/superpowers/reports/slice-10-crosstab-v4-contract-reorg-backup-20260524165140.json`.
- Rebuild `apache-superset-doris:6.0.0-zh-column-scheme-matrix`, run `docker compose up -d superset`, then verify local health, public health, Explore reload, and `/api/v1/chart/data` status `200`.
