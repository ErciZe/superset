# Task 8 Mixed Timeseries Distinct Fix

Date: 2026-08-08

## Scope And Provenance

- Exact release candidate base: `11c115bb0c4bf1443c6a6b8ce6008194cfd58ee6`.
- Only the daily semantic metric and its focused Python tests were changed.
- The detail dataset SQL still uses its existing internal multi-column
  `COUNT(DISTINCT sales_date, sku)` expression; it was not changed.
- Production remained rolled back. No metadata, source, asset, image, or
  service mutation was performed.

## Original Blocker

The backup is
`/home/ubuntu/superset-docker/backups/hot-product-remaining-charts-20260808T221325Z`.
The saved Mixed Timeseries charts `trend_day` (`582d0460-8034-5a12-9f27-4de03b050cd4`),
`trend_week` (`d3504cb6-8abf-5d22-807b-326948e6b79b`), and `trend_month`
(`8f36f17e-c95c-5076-9090-24652b22bb00`) returned HTTP 400 from Doris. The
error was:

```text
(1105, errCode = 2, detailMessage = The query contains multi count distinct or sum distinct, each can't have multi columns.)
```

The failed API summary is `chart-api-summary.json` (SHA-256
`5610436d7d3715f3139e2e77103b141f07c314baecf6895e7c83c917d2c20883`). The
backup direct reproduction with two multi-column distinct aggregates is
`direct-sql-failure-two-distinct.txt` (SHA-256
`d3e3edf80a12c6f1482eac67bb37d0becc322743a2bfe36f2a449e72d548db32`).

## Fix

The daily saved metric `hot_product_index` now uses this single-argument,
exact pair encoding:

```sql
SUM(sales_qty) / NULLIF(
  COUNT(DISTINCT CONCAT(
    DATE_FORMAT(sales_date, '%Y-%m-%d'), '#', HEX(sku)
  )),
  0
)
```

`DATE_FORMAT` emits a fixed-width date, `HEX(sku)` is composed only of hex
digits, and `#` cannot occur in either component. The encoding is therefore
injective and reversible by splitting at `#` and decoding the SKU bytes; it is
not a hash or approximation. NULL SKU values remain NULL through `CONCAT` and
retain the original `COUNT(DISTINCT sales_date, sku)` exclusion semantics.

## Doris Read-Only Evidence

Runner:
`/Users/zewe/code-workspace/etl/.agents/skills/datawarehouse-schema-explorer/scripts/query_doris.py`

Each parity statement was executed independently with `--no-filter --format
json` against the production Doris catalog for `2026-07-01 <= sales_date <
2026-08-01`:

```text
original=17530
encoded=17530
channel_original=16706
channel_encoded=16706
```

The complete `TREND_PRIMARY_METRICS` aggregation shape also executed
successfully (31 rows, no error):

```sql
SELECT sales_date,
  SUM(sales_qty) / NULLIF(COUNT(DISTINCT CONCAT(DATE_FORMAT(sales_date, '%Y-%m-%d'), '#', HEX(sku))), 0) AS hot_product_index,
  SUM(sales_qty) AS sales_qty_total,
  SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date), 0) AS avg_daily_sales_qty_period,
  SUM(return_goods_qty) AS return_goods_qty_total,
  SUM(order_qty) AS order_qty_total,
  COUNT(DISTINCT sku) AS in_sale_sku_count_period,
  COUNT(DISTINCT spu) AS in_sale_spu_count_period,
  SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0) AS return_rate,
  SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0) AS gross_margin
FROM ads.ads_pdm_lx_hot_product_index_sku_d
WHERE channel = 'Amazon.com'
  AND is_eligible = 1
  AND sales_date >= '2026-07-01'
  AND sales_date < '2026-08-01'
GROUP BY sales_date
ORDER BY sales_date
```

The same shape with the original `COUNT(DISTINCT sales_date, sku)` returned
exit 1 and Doris 1105. The encoded shape returned columns in the expected
order:
`sales_date,hot_product_index,sales_qty_total,avg_daily_sales_qty_period,return_goods_qty_total,order_qty_total,in_sale_sku_count_period,in_sale_spu_count_period,return_rate,gross_margin`.

## Verification

- TDD RED: before the production change, the focused command reported 44
  passed and 2 failures, both asserting the new saved-metric expression.
- TDD GREEN: combined focused command reported **46 passed, 1 existing
  SQLAlchemy deprecation warning**.
- Individual complete Python suites: dashboard **30 passed**; remaining charts
  **16 passed**; each retained the same warning only.
- Python `compileall`: PASS.
- Ruff format check and Ruff check for all three owned Python files: PASS.
- Targeted pre-commit with the Superset virtualenv on `PATH`: all applicable
  hooks passed, including mypy, ruff-format, and ruff.
- `git diff --check`: PASS.
- Generated ZIP: `1a27abb31bd8a367e86ad711f51ba170e72a42500f2270b7b236a6e1912c4086`.
  A second independent generation had the same SHA; both `unzip -t` checks
  passed. The bundle contains 33 entries (metadata plus 32 assets): 6
  datasets, 24 charts, and 2 dashboards.

## Risk And Release Boundary

The encoding adds CPU/string work to the daily semantic metric, but the
production July parity is exact and the full Mixed Timeseries aggregation
shape is Doris-safe. Detail-table SQL intentionally retains its separate
multi-column distinct path. Production release, metadata import, API
acceptance, and browser acceptance remain outside this fix and require a new
guarded release from the resulting fix commit.
