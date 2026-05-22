# Crosstab V4 Product Completion Acceptance

## Verdict

Status: complete

## Source And Release

- Source commit: `841ef4d73ba3ded0448dddafb9dc4e00bd10e48f`
- GitHub push: `fork/noway-release` updated to `841ef4d73b`; final `HEAD...fork/noway-release` is `0 0`
- Asset backup: `agentops:/home/ubuntu/superset-docker/backups/assets-20260522132332`
- Slice 10 metadata backup: `docs/superpowers/reports/slice-10-crosstab-v4-backup-20260522052534.json`
- Old image ID: `148aa69b3a8c`
- New image ID: `b6b9f46365ca` (`sha256:b6b9f46365ca9c1697dad7f45d5e3ee379374a34884205510c842833d50aa527`)

## Local Validation

- Focused Jest: `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test src/explore/components/ExploreViewContainer/ownState.test.ts --runInBand` passed; 21 suites, 292 tests.
- TypeScript: `npm run type -- --pretty false` passed.
- Build: `BABEL_ENV=testableProduction npm run build` passed; webpack compiled with size warnings only.
- `git diff --check`: passed with no output.

## Production Validation

- Docker health: `apache-superset` is `running healthy` on image `sha256:b6b9f46365ca9c1697dad7f45d5e3ee379374a34884205510c842833d50aa527`.
- Server-local `/health`: `OK`.
- Public `/health`: `OK`.
- Log scan: `/api/v1/chart/data?form_data={"slice_id":10}` returned HTTP `200` four times during browser acceptance. One non-chart `PUT /api/v1/explore/form_data?tab_id=1` returned `405`; a follow-up scan after `2026-05-22T05:37:18Z` found no `error|exception|traceback|critical|ERR_CROSSTAB`.

## Browser Save/Reload Validation

- URL: `http://111.230.91.24:8088/explore/?dashboard_page_id=46-PPo9Im44OCNY7jp1J9&slice_id=10`
- Chart: `订单利润指标矩阵 - 日维度`; no `/login/` redirect.
- Calculated field: `calc_margin_pct_v4` / `V4验收毛利率` persisted in `crosstabCalculatedFields`.
- Metrics slot: `crosstabFieldConfig.metrics` contains only `calculatedFieldId: "calc_margin_pct_v4"` for the formal acceptance metric, because production slice 10 has server-column pagination and requires exactly one metric.
- `/api/v1/chart/data`: browser captured `200`; production logs also show HTTP `200`.
- Screenshot: `docs/superpowers/reports/2026-05-22-crosstab-v4-product-completion-explore-slice10.png`.

## Rollback

1. Restore slice 10 `params` and `query_context` from `slice-10-crosstab-v4-backup-20260522052534.json`.
2. Restore assets from `backups/assets-20260522132332` and rebuild/restart only if asset rollback is required.
3. Re-run `/health`, Explore slice 10, and chart data API checks.
