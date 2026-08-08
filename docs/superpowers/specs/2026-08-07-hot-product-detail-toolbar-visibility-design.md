# 爆品指数明细表工具栏可见性设计

## 1. 目标

关闭爆品指数看板 SPU、SKU 两张明细表中不需要的配置入口，使用户只通过看板顶部的全局筛选器和表格既有交互查看数据。关闭范围仅包括：

- 列配置方案工具栏（保存、切换、重置列方案）。
- 表格内部独立筛选/搜索条。

## 2. 范围

本次只修改明细表图表的 Superset `form_data` 生成配置，适用于：

- `SPU维度`
- `SKU维度`

两张表继续使用 `ag-grid-table-scheme`，对应数据集仍为 `爆品指数-SPU月度经营明细` 和 `爆品指数-SKU月度经营明细`，并保留既有查询 SQL、字段顺序、中文展示名、指标口径、层级和样式配置。

## 3. 非目标

本次不修改：

- 看板顶部 13 个全局筛选器及其绑定关系。
- ADS 数据表、数据集定义或指标计算逻辑。
- 表格排序、服务端分页、层级折叠、固定列、合计行和爆品指数条件填色。
- AG Grid 插件默认行为或其他看板图表。
- 列顺序、列宽、中文标签、数值格式和空值显示。

## 4. 精确配置变更

在 `scripts/hot_product_index_dashboard.py` 的 `_detail_chart_params(grain)` 返回值中，为 SPU、SKU 两种 `grain` 同时显式设置以下字段：

```python
"column_view_schemes_enabled": False,
"include_search": False,
```

变更后的相关 `form_data` 契约如下：

| 字段 | SPU 明细表 | SKU 明细表 | 含义 |
|---|---:|---:|---|
| `viz_type` | `ag-grid-table-scheme` | `ag-grid-table-scheme` | 组件不变 |
| `column_view_schemes_enabled` | `False` | `False` | 隐藏列配置方案工具栏 |
| `include_search` | `False` | `False` | 隐藏表内独立搜索条 |
| `server_pagination` | `True` | `True` | 保留服务端分页 |
| `show_totals` | `True` | `True` | 保留合计行 |
| `row_hierarchy_fields` | 既有 SPU 层级 | `[]` | 层级行为不变 |

不得通过删除字段依赖插件默认值：`column_view_schemes_enabled` 必须显式为 `False`，`include_search` 必须显式为 `False`，避免默认值变化导致入口重新出现。

## 5. 数据流与交互不变

数据流仍为：顶部全局筛选器 → 明细图表查询 → ADS 语义数据集 → AG Grid 表格。关闭两个入口不改变请求参数、过滤器作用域、分页请求、排序请求或返回数据。

用户仍可使用：

- 看板顶部的渠道、品线、SPU、国家、公司 SKU、SKU、尺寸、颜色、年月、开发经理、型号、SKU 等级、产品等级全局筛选器。
- 表格列排序和服务端分页。
- SPU 表的层级展开/折叠、固定列和横向滚动。
- 合计行及爆品指数固定区间填色。

## 6. 测试与验收

### 6.1 生成器单元测试

更新 `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`：

1. 断言 SPU、SKU 两张明细表的 `params["column_view_schemes_enabled"] is False`。
2. 将两张明细表的 `params["include_search"]` 断言改为 `False`。
3. 保留现有字段顺序、排序、分页、合计、层级和填色断言。

### 6.2 组件验证

运行 AG Grid Table Scheme 相关单元测试，确认：

- `False` 不渲染列配置方案工具栏。
- `False` 不渲染表内搜索条。
- 排序、分页、层级折叠、固定列、合计和条件填色仍渲染。

### 6.3 生产验收

发布新资产后，在生产看板分别打开 SPU、SKU Tab，确认：

1. 页面只显示顶部全局筛选器，不显示列配置方案工具栏和表内搜索条。
2. 全局筛选器可缩小两张表数据，查询请求无新增错误。
3. SPU/SKU 数据行、中文列名、一位小数、排序、分页、层级、合计和填色与发布前一致。
4. 浏览器控制台、请求日志和 Superset 健康检查无新增错误。

## 7. 发布与回滚

发布前导出并保存当前两个明细图表及看板元数据，记录资产包校验和。发布只替换包含上述两个 `form_data` 字段的明细图表资产，不改动 ADS 表和其他图表。

若生产验收失败，使用发布前元数据备份导入恢复两个明细图表，重新执行健康检查和浏览器验收；回滚不得删除或修改 ADS 数据。回滚完成后，SPU/SKU 明细表恢复为上一个已验收版本。
