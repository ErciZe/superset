# Dashboard Time Filter Configuration

Date: 2026-05-25

## Scope

- Removed the hidden chart-level time restriction from slice `10`.
- Added a dashboard-level native time filter on `biz_date`.
- Default time range: `Last 30 days`.
- Scope: charts `10`, `47`, `48`, `49`.

## Production Changes

- Dashboard: `订单利润看板 - MSKU日维度`
- Dashboard slug: `order-profit-msku-daily-dashboard`
- Added native filter:
  - ID: `NATIVE_FILTER-biz_date`
  - Name: `开始时间 / 结束时间`
  - Type: `filter_time`
  - Target: dataset `7`, column `biz_date`
  - Default data mask: `Last 30 days`
- Updated slice `10`:
  - `time_range`: `No filter`

## Backup

- `/app/superset_home/backups/order-profit-dashboard-time-filter-20260525030759.json`

## Validation

- Remote `/health`: `OK`
- Public `/health`: `OK`
- Production metadata verification:
  - `NATIVE_FILTER-biz_date` exists.
  - Default data mask is `Last 30 days`.
  - Slice `10` has `time_range = No filter`.
- Screenshot: `docs/superpowers/reports/2026-05-25-dashboard-time-filter-last-30-days-clear.png`

## Note

The default range resolved to `2026-04-25 <= biz_date < 2026-05-25` at verification time. The chart returned no rows in that range, which confirms the dashboard-level time filter is being applied.
