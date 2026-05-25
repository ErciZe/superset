# Dashboard Time Filter Latest-Data Default

## Problem

Production dashboard showed no data after setting the page time filter default to `Last 30 days`.

Root cause: `Last 30 days` is resolved against the current production date, `2026-05-25`, producing a 2026 date window. Dataset 7 currently contains data only from `2025-01-01` through `2025-01-27`.

## Production Change

- Dashboard: `order-profit-msku-daily-dashboard`
- Dashboard id: `2`
- Chart id: `10`
- Dataset id: `7`
- Native filter: `NATIVE_FILTER-biz_date`
- New default range: `2024-12-29 : 2025-01-28`
- Chart-local time range: kept as `No filter`

Backup before the metadata change:

```text
/app/superset_home/backups/order-profit-dashboard-time-filter-latest-data-20260525031734.json
```

## Verification

- Production health check: `OK`
- Native time filter default:

```json
{
  "extraFormData": {
    "time_range": "2024-12-29 : 2025-01-28"
  },
  "filterState": {
    "value": "2024-12-29 : 2025-01-28"
  }
}
```

- Chart 10 params `time_range`: `No filter`
- Chart 10 query context `time_range`: `No filter`
- Browser verification: dashboard matrix returned rows and date columns instead of the no-data state.

Screenshot:

```text
docs/superpowers/reports/2026-05-25-dashboard-time-filter-latest-data.png
```
