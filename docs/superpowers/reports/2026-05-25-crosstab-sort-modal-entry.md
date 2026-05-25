# Crosstab 排序配置弹窗入口发布记录

## 结论

- 已将行/列维度与 Dynamic group-by option 的排序配置从内联 4 个下拉框改为“排序摘要 + 排序设置按钮 + 弹窗表单”。
- 未改变排序 metadata 协议，仍写回 `crosstabFieldConfig.rows[].sort`、`crosstabFieldConfig.columns[].sort`、`dynamicGroupBy.slots[].options[].columnConfigs[].sort`。
- 线上 `biz_date` 仍保持 `desc/date/nulls last`，Dashboard 日期列仍倒序展示。

## 验证

- `npx eslint plugins/plugin-chart-crosstab-table/src/plugin/DimensionSortModal.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabFieldConfigControl.tsx plugins/plugin-chart-crosstab-table/src/plugin/CrosstabDynamicGroupByControl.tsx plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts`
- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/plugin/controlPanel.test.ts plugins/plugin-chart-crosstab-table/test/plugin/dynamicGroupBy.test.ts --runInBand`
- `npm run type`
- `BABEL_ENV=testableProduction npm run build`
- `curl -fsS http://111.230.91.24:8088/health`

## 发布

- 远端资产备份：`/home/ubuntu/superset-docker/backups/assets-20260525124115`
- 镜像：`apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- 镜像 manifest：`sha256:1883d4c5ebbb4529106826d6df66e6fbaf0cd380ecde91cb96a1a5f814a946f9`
- 容器状态：`apache-superset running healthy`

## 浏览器验收截图

- Explore 排序入口：`docs/superpowers/reports/2026-05-25-crosstab-sort-modal-entry.png`
- `biz_date` 排序弹窗：`docs/superpowers/reports/2026-05-25-crosstab-sort-modal-open.png`
- Dashboard 日期倒序展示：`docs/superpowers/reports/2026-05-25-crosstab-sort-modal-dashboard.png`
