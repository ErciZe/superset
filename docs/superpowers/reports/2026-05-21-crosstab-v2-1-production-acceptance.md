# Crosstab v2.1 Production Acceptance Report

Date: 2026-05-21 11:32 CST
Repository: `/Volumes/extend/ecode-workspace/superset-source`
Branch: `noway-release`
Production target: `http://111.230.91.24:8088`
Slice: `10` / `订单利润指标矩阵 - 日维度`

## Verdict

Partial.

The repository-side regression suite and production metadata/configuration checks
are complete. The remaining blocker is browser acceptance: the available Chrome
profile is not authenticated to production Superset, so Explore/Dashboard
screenshots and `/api/v1/chart/data` network capture cannot be completed from
this agent session yet.

No crosstab business-code fix was required in this pass. The production gap was
the saved chart metadata: slice 10 needed a non-null authoritative
`crosstabFieldConfig` with metric semantic overrides.

## Local Repository Evidence

```bash
git status --short --branch
```

Result:

```text
## noway-release...fork/noway-release [ahead 1]
?? .superpowers/
?? docs/superpowers/reports/2026-05-20-crosstab-v2-production-closeout.md
?? docs/superpowers/reports/2026-05-20-crosstab-v2-production-dashboard-chrome-final.png
?? docs/superpowers/reports/2026-05-20-crosstab-v2-production-dashboard.png
?? docs/superpowers/reports/2026-05-20-crosstab-v2-production-explore-slice10.png
?? docs/superpowers/reports/2026-05-21-crosstab-implementation-path.md
```

```bash
git rev-list --left-right --count HEAD...fork/noway-release
```

Result:

```text
1	0
```

The ahead commit is:

```text
2708f29845 docs(crosstab): plan v2.1 production acceptance
```

Git hygiene:

```bash
git diff --check
git count-objects -v
```

Result:

```text
garbage: 0
size-garbage: 0
```

No whitespace errors were reported.

## Test Evidence

The first crosstab Jest run failed because macOS AppleDouble `._*` resource fork
files had been created under `superset-frontend/plugins/plugin-chart-crosstab-table/`
and `superset-frontend/node_modules/.cache/babel-loader/`. Babel attempted to
parse those metadata files as TypeScript/TSX.

Cleanup performed:

```bash
find /Volumes/extend/ecode-workspace/superset-source -name '._*' -type f -delete -print
```

Post-cleanup verification:

```bash
find /Volumes/extend/ecode-workspace/superset-source -name '._*' -print | sed -n '1,40p'
git fsck --no-dangling
```

Both returned no output.

Focused crosstab regression:

```bash
cd superset-frontend
BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
```

Result:

```text
Test Suites: 15 passed, 15 total
Tests:       127 passed, 127 total
Snapshots:   0 total
Time:        10.333 s
```

Known baseline warnings remained:

```text
jest-haste-map: duplicate manual mock found: mockExportObject
jest-haste-map: duplicate manual mock found: mockExportString
jest-haste-map: duplicate manual mock found: svgrMock
Browserslist: browsers data is 11 months old
DEP0040 punycode deprecation
```

These warnings did not fail the focused suite.

## Production Health Evidence

```bash
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
```

Result:

```text
OK
```

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops \
  'cd /home/ubuntu/superset-docker && docker compose ps'
```

Result:

```text
apache-superset         apache-superset-doris:6.0.0-zh-column-scheme-matrix   Up 3 hours (healthy)   0.0.0.0:8088->8088/tcp
apache-superset-redis   redis:7-alpine                                        Up 6 days (healthy)    6379/tcp
```

Running image:

```text
apache-superset-doris:6.0.0-zh-column-scheme-matrix
sha256:c4ed87a0e2c8591fc9834580f12e9f9d7cbfe945b6dbb827ed2a02195fab21e9
```

Newest static assets under `/app/superset/static/assets` were timestamped
`May 21 00:52`, including:

```text
380.0c5f50e428cc2f8f4da8.entry.js
7a471cea18b5dcb9958e.chunk.js
Chart.7a471cea18b5dcb9958e.chunk.css
manifest.json
spa.d5811e35b51a3c813351.entry.js
```

## Slice 10 Metadata Evidence

Collected inside the running `apache-superset` container through Superset app
context.

```text
SLICE 10 订单利润指标矩阵 - 日维度 crosstab-table
CFG_NULL False
CFG_ROWS [{'field': 'metric_name_with_unit', 'label': '指标'}]
CFG_COLUMNS [{'field': 'biz_date', 'label': '日期'}, {'field': 'shop_name', 'label': '店铺'}]
CFG_METRICS [{'label': '指标值', 'metric': '指标值', 'semantic': 'additive'}]
OVERRIDE_FIELD metric_name_with_unit
OVERRIDE_COUNT 20
DYNAMIC_GROUP_BY {"enabled":true,"placement":"columns","slotIndex":1,"defaultColumn":"shop_name","options":[{"label":"店铺","column":"shop_name"},{"label":"国家","column":"country"},{"label":"MSKU","column":"msku"},{"label":"父体","column":"parent_asin"}]}
SERVER_COLUMN_PAGINATION True
GENERATED_COLUMN_WIDTH 120
```

This confirms slice 10 no longer relies on `crosstabFieldConfig=null`.

## Dataset Evidence

Datasource 7 is a virtual dataset:

```text
TABLE 7 DWD 领星订单利润 MSKU 指标矩阵 - org1
```

The `metric_name_with_unit` field is a dataset expression, not a physical column:

```text
CASE WHEN unit IS NULL OR unit = '' THEN metric_name ELSE CONCAT(metric_name, '（', unit, '）') END
```

Metric-label baseline was extracted through that expression path:

```text
利润（金额）	5412
毛利率（%）	5412
销量（件）	5412
销售额（金额）	5412
平均售价（金额）	5412
买家运费（金额）	5412
买家运费占比（%）	5412
促销折扣（金额）	5412
折扣促销占比（%）	5412
退款金额（金额）	5412
退款金额占比（%）	5412
其他收入（金额）	5412
其他收入占比（%）	5412
FBA库存赔偿（金额）	5412
FBA库存赔偿占比（%）	5412
平台费（金额）	5412
平台费占比（%）	5412
FBA发货费（金额）	5412
FBA发货费占比（%）	5412
其他订单费用（金额）	5412
其他订单费用占比（%）	5412
总仓储费（金额）	5412
总仓储费占比（%）	5412
广告花费（金额）	5412
广告花费占比（%）	5412
推广费（金额）	5412
推广费占比（%）	5412
FBA国际物流费（金额）	5412
FBA国际物流费占比（%）	5412
调整费（金额）	5412
调整费占比（%）	5412
销售其他费（金额）	5412
销售其他费占比（%）	5412
入仓配置服务费（金额）	5412
入仓配置服务费占比（%）	5412
采购成本（金额）	5412
采购成本占比（%）	5412
物流成本（金额）	5412
物流成本占比（%）	5412
其他成本（金额）	5412
```

The live slice has 20 semantic overrides, matching the ratio/average override
requirement for this dataset shape.

## Browser Acceptance Blocker

Chrome reproduction reached production Superset but redirected to `/login/` and
showed access denied for the available profile. Therefore the following required
acceptance items remain open:

- Explore screenshot for `http://111.230.91.24:8088/explore/?slice_id=10`
- Dashboard screenshot for the production dashboard page containing slice 10
- Browser console capture
- `/api/v1/chart/data` request/response capture from the actual rendered chart
- Confirmation that `extra_form_data` does not contain crosstab-only own-state
  keys in the live browser request

## Next Action

Log the active Chrome profile into production Superset, then rerun Task 3 from
the implementation plan:

1. Open Explore slice 10.
2. Capture console and `/api/v1/chart/data`.
3. Save Explore and Dashboard screenshots.
4. Update this report with browser evidence and final verdict.

