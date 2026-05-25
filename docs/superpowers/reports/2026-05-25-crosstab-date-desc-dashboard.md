# Crosstab Date Column Descending Order

## Change

Production slice 10 was updated to show `biz_date` columns in descending order.

The chart already supports dimension sort metadata, so this was a metadata-only change. No frontend code deployment was required.

Backup before the metadata change:

```text
/app/superset_home/backups/order-profit-slice10-date-desc-20260525032553.json
```

## Updated Metadata

- `crosstabFieldConfig.columns[].field = biz_date`
  - `sort.direction = desc`
  - `sort.type = date`
- `dynamicGroupBy.slots[].options[id=biz_date].columnConfigs[0].sort.direction = desc`

All three dynamic dimension slots now use the same descending date sort when `日期` is selected.

## Verification

- Production health check: `OK`
- Metadata check confirmed `biz_date` sort direction is `desc`
- Browser verification confirmed the dashboard starts with `2025-01-27`, then `2025-01-26`, then `2025-01-25`

Screenshot:

```text
docs/superpowers/reports/2026-05-25-crosstab-date-desc-dashboard.png
```
