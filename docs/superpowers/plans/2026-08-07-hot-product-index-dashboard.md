# Hot Product Index Dashboard Implementation Plan

> **方案替代说明（2026-08-09）：** 本文记录的早期实现计划保留用于审计，已由纯原生 Superset 配置方案取代。当前 assets 生成器使用标准横向筛选栏（不设置 `horizontal_filter_bar_two_rows`）、标准 `table`/`funnel`/`pie`/`treemap_v2` 图表和原生分页、搜索、列配置及条件格式；不生成 dashboard CSS 或 AG Grid 私有字段。

> **Execution rule:** build and verify the BI layer only after the two ADS targets pass production acceptance. FineBI is a visual reference, not a metric source.

**Goal:** 在生产 Superset 交付“拉杆箱在售产品爆品指数看板”的 P0 范围：13 个原生筛选器、9 个 KPI、2 个漏斗、数据状态和说明文档入口。

**Source contract:**

- `ads.ads_pdm_lx_hot_product_index_sku_d`
- `ads.ads_pdm_lx_hot_product_index_sku_m`
- Doris database UUID `2f4b7c5a-35ab-4df1-870a-8157f2d3f621`
- `product_level` 是 SKU 行级产品等级筛选属性。
- 漏斗只使用 `spu_previous_month_sales_level`，固定顺序 `Ps,S,A,B,C,-`。
- Superset 固定过滤 `is_eligible = 1`；资格公式已在 ADS 层计算，BI 不重算。

## Delivery Gates

### Gate 0: Production Data Acceptance

- [x] 两张 ADS 表存在且可查询。
- [x] 日表和月表已发布 30 个 `ym`，历史审计断档不发布分区。
- [x] 两表 `data_through_date` 一致。
- [x] 日/月汇总、重复键、拉链边界和源值抽检通过。
- [x] Airflow 刷新 DAG 存在、启用且最新 Asset 运行成功。

Gate 0 只确认 BI 可以开始，不替代下列 Superset 查询和浏览器验收。

### Gate 1: Month Range Runtime

- [ ] 注册 `filter_month_range`，使用整月左闭右开 `time_range`。
- [ ] 默认值 `Current month` 可显示、保存、重置和恢复。
- [ ] 范围选择、单月选择、跨年和非法非整月输入有单元测试。
- [ ] 配置弹窗、`requiredFirst`、告警/报告序列化不把该类型当作普通列筛选器。
- [ ] 生产静态资源中存在插件注册，浏览器可实际渲染并触发查询。

### Gate 2: Reproducible Assets

- [ ] 用固定 UUID 生成 `type: assets` 的 ZIP 包。
- [ ] ZIP 只引用现有 Doris database UUID，不导入或覆盖数据库凭据。
- [ ] 三个虚拟数据集：日度、结束月、选择范围/新鲜度状态。
- [ ] 9 个 Big Number、2 个 ECharts Funnel、状态横幅和说明文档图表。
- [ ] 主看板与说明看板均有固定 UUID、slug 和可重复布局。
- [ ] 13 个原生筛选器使用 `datasetUuid`，年月同时目标到三个服务数据集。

### Gate 3: Serving SQL

- [ ] 生产启用 `ENABLE_TEMPLATE_PROCESSING`。
- [ ] `get_time_filter(..., remove_filter=True)` 读取用户选择，不从事实 `MIN/MAX` 推断。
- [ ] 日度数据集按 `sales_date >= start AND sales_date < end` 查询，并用全局水位计算实际截止日和自然日数。
- [ ] 结束月数据集只返回用户所选结束月份。
- [ ] 所选月份在日/月目标表均连续发布才返回业务数据；断档、未发布或未来月份返回缺口状态，KPI 和漏斗不计算。
- [ ] 状态数据集不受 12 个业务维度筛选器影响，显示用户范围、实际计算截止日和全局数据水位。

### Gate 4: Production Import

- [ ] 导入前按 UUID、标题、slug、数据集名和图表名检查重复/软删除冲突。
- [ ] 导入前备份生产配置、静态资源和全部受影响 Superset 资产。
- [ ] 首次导入使用 `sparse=true, overwrite=false`，任何冲突快速失败。
- [ ] 发布 MonthRange 静态资源和配置后重建生产镜像、重建服务并通过 Docker/HTTP 健康检查。
- [ ] 资产导入成功后确认主看板已发布，说明文档 URL 可访问。

### Gate 5: Query And Browser Acceptance

- [ ] 通过 chart data API 验证 9 个 KPI、2 个漏斗均可查询，无模板或数据库错误。
- [ ] 当前月基线与 Doris 复算一致；销售额漏斗合计等于销售额 KPI，SPU 漏斗合计等于在售 SPU 数。
- [ ] 代表性维度筛选同时作用于日/月业务图表，不作用于状态横幅。
- [ ] 选择历史断档月显示“所选范围存在数据缺口”，而不是零值。
- [ ] 重置恢复当前月和其余无限制状态。
- [ ] 宽屏一行 9 张 KPI，下一行两个完整漏斗；窄桌面无文字、筛选器或图表重叠。
- [ ] 标题、两行筛选区、总览标题、KPI 和漏斗的视觉顺序与 FineBI P0 截图一致。

## KPI Contract

| KPI | Dataset | Metric |
| --- | --- | --- |
| 销量 | daily | `SUM(sales_qty)` |
| 日均销量 | daily | `SUM(sales_qty) / NULLIF(MAX(selected_calendar_days), 0)` |
| 销售额 | daily | `SUM(sales_amount_usd)` |
| 在售 SPU 数 | end-month | `COUNT(DISTINCT spu)` |
| 爆品指数 | daily | `SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)` |
| 在售 SKU 数 | end-month | `COUNT(DISTINCT sku)` |
| 毛利润 | daily | `SUM(gross_profit_usd)` |
| 毛利率 | daily | `SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)` |
| 退货率 | daily | `SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)` |

## Release Boundary

- 只暂存和发布本看板、MonthRange、模板开关及其测试；不得带入当前工作树的无关修改。
- 发布前必须运行聚焦测试、前端构建、`git diff --check` 和 `pre-commit run --all-files`。
- 静态资源同步不等于发布完成；生产镜像重建、服务重建、健康检查和浏览器验收缺一不可。
- 任一门禁失败时保留既有生产服务和备份，不以降级口径、默认值或手工数据修补绕过。
