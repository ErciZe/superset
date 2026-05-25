# Crosstab Sort Configuration Entry

## Change

Added visible sort configuration controls for crosstab dimensions.

## Scope

- `Fields` control:
  - row dimensions now expose `Sort by`, `Sort direction`, `Sort type`, and `Null sort`
  - column dimensions now expose the same sort controls
- `Dynamic group by` control:
  - each option column now exposes `Sort by`, `Sort direction`, `Sort type`, and `Null sort`
  - selected option columns preserve existing `columnConfigs`

## Verification

- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand`
- `npm run type`
- `npx eslint plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
- `BABEL_ENV=testableProduction npm run build`
- Production image rebuilt: `sha256:1ad83c59cb812f5ffdd4b5eaab2d37da85ec1f8bcd8f086b911c76eb7b82f238`
- Production health: `OK`
- Browser verification: Explore page for slice 10 shows the sort configuration controls and `biz_date` is configured as `desc/date/last`

Remote backup before asset sync:

```text
/home/ubuntu/superset-docker/backups/assets-20260525113435
```

Screenshot:

```text
docs/superpowers/reports/2026-05-25-crosstab-sort-config-entry.png
```
