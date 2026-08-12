# 爆品指数指标卡单标题设计

## 目标

九张指标卡只显示一处指标名称：保留 Superset 看板图表容器顶部标题，移除 Big Number 图表内部重复的指标名称，继续显示大号数值。

## 实现边界

- 仅修改 `scripts/hot_product_index_dashboard.py` 生成的原生 Big Number 参数，以及对应生成器合同测试。
- 将九张 `big_number_total` 图表的 `show_metric_name` 统一设为 `false`。
- 保持图表标题、指标表达式、格式、字体比例、筛选范围、UUID、布局和拓扑不变。
- 不修改 `superset/`、`superset-frontend/`、插件源码或 Dashboard CSS。
- 与已批准但尚未发布的品类筛选资产合并生成同一候选 ZIP。

## 验收

- 九张指标卡均为 `show_metric_name=false`，且 `header_font_size=0.5`。
- 生成 ZIP 两次字节一致并通过 `unzip -t`。
- 生成器测试和候选文件 pre-commit 通过。
- 生产发布必须使用 fresh backup、精确目标资产回滚包和正确的 Assets API multipart 字段。
- 浏览器确认每张卡片只有顶部标题和大数值，不再出现数值上方第二个指标名；同时确认年月、品类筛选顺序和默认拉杆箱。
