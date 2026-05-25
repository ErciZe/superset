# Noway Release Production Closeout

## Local Source

- Branch: `noway-release`
- Commit: `4be32d1fcc33768e617b10b5e91cee4f47caf231`
- Divergence before closeout report: `HEAD...fork/noway-release` = `17 0`
- Release commits:
  - `4be32d1fcc chore(i18n): update zh translations for noway release`
  - `6aa32fda81 docs(noway-release): record production next steps`
  - `dc2912815c fix(noway-table): declare local runtime dependencies`
  - `86f48b610b docs(noway-table): record isolation validation`
  - `40a923887d fix(noway-table): resolve isolation validation blockers`
  - `8c743dba97 refactor(ag-grid-table): remove noway-only extensions`
  - `cf7e920462 test(noway-table): cover local table formatter runtime`
  - `d46cd0e146 chore(noway-table): remove official table dependency`
  - `2efef2d856 refactor(noway-table): use local table runtime`
  - `4cea1e18f0 feat(noway-table): add local table runtime`
  - `2c2c76a30d test(noway-table): guard official table isolation`

## Validation

- Scheme Jest: PASS, `BABEL_ENV=test npx jest plugins/plugin-chart-ag-grid-table-scheme/test --runInBand` passed 14 suites and 70 tests.
- Crosstab Jest: PASS, after deleting macOS `._*` sidecar files, `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand --silent` passed 23 suites and 392 tests.
- TypeScript: PASS, `npm run type`.
- Isolation checks: PASS, no scheme imports from official AG Grid Table internals; noway-only extension points remain only under `plugin-chart-ag-grid-table-scheme/src`.
- Frontend build: PASS, `BABEL_ENV=testableProduction npm run build`; webpack completed with baseline asset-size warnings.

## Remote Deployment

- Host: `agentops` / `VM-16-12-ubuntu`
- Deployment root: `/home/ubuntu/superset-docker`
- Image tag: `apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- Image ID: `sha256:2ba33a2cf303dca75b93e11a1035216e01083fe0f1b67e33dd6a7eec745b6cbb`
- Container health: `apache-superset` running and `healthy`
- Server-local health: `OK`
- Public health: `OK`
- Asset backup: `backups/assets-20260525183945`
- zh runtime backup: `backups/zh-LC_MESSAGES-20260525183945`
- zh builder-source backup: `backups/superset-zh-messages-20260525184939.json`, `backups/superset-zh-messages-20260525184939.po`
- Deployment note: production Dockerfile overlays zh output from `superset-zh`; the release synced both `superset-source/superset/translations/zh/LC_MESSAGES/*` and `superset-zh` before the final image rebuild.

## Browser Acceptance

- Crosstab: PASS. Authenticated Explore for `slice_id=10` loaded `订单利润指标矩阵 - 日维度`; AG Grid rendered, toolbar/control panel was visible, query returned rows, and browser console had no `error` or `pageerror` entries.
- Noway Table V1: PASS. Authenticated Explore for `slice_id=17` loaded `WHM 订单明细表`; visualization name `noway table v1` appeared, AG Grid rendered, toolbar/control panel was visible, and browser console had no `error` or `pageerror` entries.
- zh translation: PASS. Container runtime `messages.json` and browser page confirmed updated zh values, including `Additive -> 可加`.

## Verdict

- complete
