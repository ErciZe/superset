# Crosstab 内置 CSV 按钮移除发布记录

## 结论

- 已删除 Crosstab 图表内部工具栏的 `CSV` 按钮。
- 保留 Superset 图表自身菜单里的原生导出能力。
- 未改变 Crosstab 查询、渲染、排序或动态维度协议。

## 验证

- `npx eslint plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx`
- `BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test/CrosstabTable.test.tsx --runInBand`
- `npm run type`
- `BABEL_ENV=testableProduction npm run build`
- `curl -fsS http://111.230.91.24:8088/health`

## 发布

- 远端资产备份：`/home/ubuntu/superset-docker/backups/assets-20260525131002`
- 镜像：`apache-superset-doris:6.0.0-zh-column-scheme-matrix`
- 镜像 manifest：`sha256:968b833b0d5b284019f1842e132f1f0575189f861621c5edd5b6bf14c4264f1a`
- 容器状态：`apache-superset running healthy`

## 浏览器验收截图

- 加载态工具栏无 CSV：`docs/superpowers/reports/2026-05-25-crosstab-remove-inline-csv.png`
- 最终渲染后工具栏无 CSV：`docs/superpowers/reports/2026-05-25-crosstab-remove-inline-csv-final.png`
