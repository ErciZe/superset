# Crosstab V4 Business Calculated Field Example Closeout

## Verdict

Status: complete.

The business calculated-field example fix was implemented in commit `1965db3d03`, pushed to `fork/noway-release`, deployed to production, and verified across source tests, production health checks, authenticated browser acceptance for slice 10, and explicit `chart/data` production access logs.

## Source Verification

Release provenance:

- Source fix commit: `1965db3d03`
- Pushed to: `fork/noway-release`
- Source files changed:
  - `superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/CrosstabCalculatedFieldsControl.tsx`
  - `superset-frontend/plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`

Functional fix summary:

- Reject non-SQL saved metrics when reconstructing metric refs.
- Index saved metric aliases for edit-time lookup.
- Preserve alias-based visible metric selections when reopening calculated fields.

Verification commands that passed:

- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand`
- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/calcFields.test.ts plugins/plugin-chart-crosstab-table/test/plugin/buildQuery.test.ts plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts --runInBand`
- `npm run type -- --pretty false`

## Production Deploy

- Backup directory: `backups/crosstab-v4-business-example-20260522234452`
- Previous image digest: `sha256:1061684aa1879ae7182dbaa68cc3cc3c8bc596b61c85e2006648ac16a9657be1`
- Deployed image digest: `sha256:6f99b115b36e178a16e273372a11db912534e03b8f97c215f11a612a4c890b4c`
- Container health after deploy: reached healthy

## Production Runtime Verification

Health and runtime checks:

- Remote container state: `running`
- Remote container health: `healthy`
- Remote container image: `sha256:6f99b115b36e178a16e273372a11db912534e03b8f97c215f11a612a4c890b4c`
- Local health endpoint: `OK`
- Public health endpoint: `OK`
- Recent error grep: none
- Authenticated Chrome reload on `2026-05-22 23:55:56` to `2026-05-22 23:55:58` Asia/Shanghai produced repeated `POST /api/v1/chart/data?form_data=%7B%22slice_id%22%3A10%7D HTTP/1.1` responses with status `200` in `apache-superset` container logs

Production metadata confirmed:

- Dataset `7` saved metrics:
  - `v4_gross_profit_sum = SUM(gross_profit)` with `verbose_name` `V4毛利`
  - `v4_sales_amount_sum = SUM(sales_amount)` with `verbose_name` `V4销售额`
- Slice `10` visible metric chip list contains only `V4示例毛利率`
- Calculated field `calc_margin_pct_v4` / `V4示例毛利率` uses AST metric refs `v4_gross_profit_sum` and `v4_sales_amount_sum`

## Browser Acceptance Evidence

Authenticated Chrome acceptance on the Explore page for slice `10` observed:

- URL included `slice_id=10`
- The page did not redirect to `/login/`
- Visible metric chip: `V4示例毛利率`
- Calculated fields list includes `V4示例毛利率`
- Edit drawer shows:
  - id: `calc_margin_pct_v4`
  - name: `V4示例毛利率`
  - numerator: `V4毛利`
  - denominator: `V4销售额`

Screenshot artifacts:

- Available: `docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-explore.png`
- Available: `docs/superpowers/reports/2026-05-22-crosstab-v4-business-calculated-field-example-editor.png`
