# 爆品指数剩余维度明细 Tab 设计

## 1. 目标与边界

本阶段在既有爆品指数总览、经营趋势、排行榜、SPU 明细和 SKU 明细之后，补齐三个只读经营维度 Tab：

1. `国家`。
2. `SPU开发经理`。
3. `型号`。

五个经营 Tab 的固定顺序为：`SPU`、`SKU`、`国家`、`SPU开发经理`、`型号`。FineBI 中的 `渠道（未启用）` 不生成、不占位、不计入顺序，也不新增“+”入口。全局 `渠道` 筛选器仍可缩小事实范围；它不是本阶段的维度列或独立 Tab。

本阶段只读两张已批准 ADS 表：

- `ads.ads_pdm_lx_hot_product_index_sku_d`：日事实和 7/30/90 天 lookback。
- `ads.ads_pdm_lx_hot_product_index_sku_m`：月度流量汇总和库存快照。

Superset 不直连 FineBI、领星原始表、库存明细、订单明细或汇率表；不在图表 SQL 中补做 ETL 关系解析。生产发布只导入已生成的 metadata，不能借本阶段修改 ADS、Airflow、Doris schema 或前端运行时。

## 2. 固定资产与实现方式

最终资产数量固定为 9 个数据集、27 个图表、2 个 Dashboard；主 Dashboard 固定关联 26 个图表节点（说明 Dashboard 的独立说明图表仍只关联 1 个）。本阶段新增 3 个虚拟数据集和 3 个表图表，分别服务三个维度 Tab；不得为了复用而把三个维度 UNION 成一个会改变筛选或合计语义的通用数据集。

三个数据集使用相同的 CTE 流程和不同的叶子维度：

| Tab | 叶子维度（除 `sku` 外） | 第一显示列 |
|---|---|---|
| `国家` | `country` | 国家 |
| `SPU开发经理` | `developer`, `spu` | 开发经理 |
| `型号` | `model` | 型号 |

每个数据集的中间粒度为 `effective_end_ym + 维度 + sku`。展示层再按 Tab 的叶子维度聚合，并追加一行显式 `汇总`。`sku`、`row_order`、`is_summary` 等仅用于去重、排序或合计控制的内部列必须隐藏，不得成为可见表头。

## 3. 三个 Tab 的字段合同

三个 Tab 的字段顺序固定。维度列之后依次为：

1. 销售额（美元）。
2. 销量。
3. 毛利润（美元）。
4. 毛利率。
5. 退货量。
6. 退货率。
7. 订单量。
8. 近7天日均销量。
9. 近30天日均销量。
10. 近90天日均销量。
11. 理论库存数。
12. 实际库存数。

展示列名称使用中文业务名称；`SPU`、`SKU` 等既有业务缩写可以保留。三个 Tab 不展示爆品指数、评分、SKU 计数、渠道列或其他内部质量列。所有列均使用已批准 ADS 字段或由分子/分母重算的指标：

| 展示指标 | 来源或计算 |
|---|---|
| 销售额（美元） | `SUM(sales_amount_usd)` |
| 销量 | `SUM(sales_qty)` |
| 毛利润（美元） | `SUM(gross_profit_usd)` |
| 毛利率 | `SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)` |
| 退货量 | `SUM(return_goods_qty)` |
| 退货率 | `SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)` |
| 订单量 | `SUM(order_qty)` |
| 近 7/30/90 天日均销量 | 对 `effective_end_ym` 对应有效结束日向前完整自然日窗口求和，再除以 7、30、90 |
| 理论库存数 | 结束月 `theoretical_stock_qty` 的去重后求和 |
| 实际库存数 | 结束月 `actual_stock_qty` 的去重后求和 |

毛利率、退货率及所有日均值只能由原始分子和分母重算，禁止平均可见子行的比率。分母为零或输入为 NULL 时结果为 NULL，展示为 `-`，不显示 `Infinity`、`NaN` 或伪造的 0。

## 4. 准入、时间范围与数据水位

### 4.1 准入规则

所有三个 Tab 在事实过滤和维度聚合之前固定使用 `is_eligible = 1`。资格是 ETL 在全渠道 `ym + sku` 粒度按 `sku_month_sales_qty + theoretical_stock_qty > 10` 计算的结果；页面的国家、开发经理、型号或渠道筛选器只能缩小展示，不能重新计算资格，也不能把不合格行补回结果。

### 4.2 选定范围的流量指标

年月筛选是左闭右开范围 `[selected_start_date, selected_end_exclusive_date)`，覆盖一个或多个自然月。销售额、销量、毛利润、退货量和订单量均从日表在选定范围内的 eligible 行汇总。日表以 `sales_date + sid + msku` 为业务事实粒度；不同 SID/MSKU 的合法经营事实可以相加，不得用 SKU 去重错误地丢掉销售流量。

`global_data_through_date = MAX(data_through_date)`。有效结束日为：

```text
effective_end_date = LEAST(
  selected_end_exclusive_date - 1 day,
  global_data_through_date
)
effective_end_ym = DATE_FORMAT(effective_end_date, '%Y-%m')
```

若有效结束日早于选定开始日、所选月份缺少日/月覆盖，或 90 天 lookback 不完整，数据集返回标准空/错误状态，不返回部分聚合结果。近 7/30/90 天窗口以 `effective_end_date` 为锚点，读取完整自然日；页面月份起点不能截断 lookback。

### 4.3 月度库存快照

库存只从月表读取 `ym = effective_end_ym`，不得把选定范围内多个月份的库存相加，也不得从日表重复的月库存列直接求和。结束月缺少库存、资格或月度覆盖时，库存指标保持 NULL 并阻断本次业务结果；不把缺失库存当成 0。若结束月存在 eligible `ym + sku` 行但理论库存或实际库存为 NULL，源 NULL 仍保持可见，预检 `check_pass` 也阻断发布，直到库存快照完整。

## 5. 去重与汇总语义

### 5.1 维度 + SKU 明细去重

先在结束月构造 `stock_by_sku`：`effective_end_ym + sku` 每个 SKU 只保留一组非 NULL 的理论库存和实际库存值。若同一 `ym + sku` 存在多个不一致的库存值，或任一库存值为 NULL，数据门禁失败，不能任取一行或用 0 回退。之后将该快照与结束月的维度身份连接，在 `effective_end_ym + 维度 + sku` 粒度去重；同一 SKU 的多个 SID/MSKU 记录只能在同一维度行中计一次。

流量指标与库存使用不同的去重策略：流量保留日事实中的每个合法 SID/MSKU 事实并求和；库存先全局 SKU 去重，再按维度 + SKU 归属展示。因此同一 SKU 在多个国家出现时，可以在各国家明细行分别看到该国家的库存快照，但不得把这些明细行直接相加推导全局库存。

### 5.2 全局 SKU 汇总去重

`汇总` 行必须从基础 CTE 重新计算，不能对三个维度的可见行求和。其流量指标对 selected range 的日事实逐行汇总；库存以 `effective_end_ym + sku` 全局唯一集合求和，每个 SKU 只计一次。跨国家、开发经理或型号的同一 SKU 只能在汇总库存中出现一次。

该语义通过独立的 `global_stock_by_sku` CTE 和显式 `UNION ALL` 汇总行实现。内置表格 totals 必须关闭；`is_summary`/`row_order` 只控制底部位置，不展示给用户。汇总行第一维显示 `汇总`，其余维度显示源 NULL 的 `-`，并保持真实指标的 NULL 语义。

### 5.3 代表性跨国家 SKU

生产预检必须从结束月 eligible 月表中选取至少属于两个国家的代表 SKU，返回 SKU、国家集合、成员行数以及库存快照的 `stock_pair_count`/`stock_consistent` 证据。代表 SKU 的库存快照不一致或含 NULL 时，Q5 也必须阻断；若不存在跨国家 eligible SKU，预检必须返回 `within_contract = 0` 的结果行，不能把“没有样本”当成通过。该样本用于确认明细按国家展示、全局汇总按 SKU 去重的边界，不是允许绕过去重的例外。

## 6. 空值、中文显示与排序

- ADS 的 NULL 维度和指标保持 NULL；不从 SKU、MSKU、公司 SKU、产品名称或其他字段推测开发经理、型号或国家。
- SQL 层不把 NULL 统一成空字符串；表格列配置以 `nullValue = '-'` 展示源 NULL。
- 小数显示最多 1 位；金额使用美元语义和千分位，比例使用百分比，数量和库存使用千分位。数据层精度不因显示格式改变。
- 第一维按业务值排序，`汇总`固定最后；内部排序列和 `is_summary` 不显示。分页和内置合计均关闭，确保汇总行是唯一的显式底行。

## 7. 原生筛选与 Tab 行为

三个 Tab 继续响应现有全局筛选器：渠道、品线、SPU、国家、公司 SKU、SKU、尺寸、颜色、年月、开发经理、型号、SKU 等级、产品等级。筛选器只作用于展示流量和维度身份；`effective_end_ym`、资格和库存去重仍由数据集固定计算。

Tabs 只在经营报表区域出现，顺序固定为：

```text
SPU → SKU → 国家 → SPU开发经理 → 型号
```

`渠道（未启用）` 不得出现在布局、Dashboard metadata、图表或资产名称中。切换 Tab 保留全局筛选条件；筛选或年月范围变化时，各表回到第一页并重新读取选定范围。

## 8. 数据质量门禁

发布前必须执行 `scripts/hot_product_index_remaining_detail_tabs_preflight.sql` 的全部只读结果集：

1. 日表/月表必需 ADS 字段存在且类型兼容，包括 `order_qty`、`theoretical_stock_qty`、`actual_stock_qty`、`is_eligible`、维度和流量字段。
2. 选定范围的日/月月份覆盖完整；当前月只能覆盖到全局 `data_through_date`，不能静默推进系统日期。
3. `country`、`developer`、`spu`、`model`、`sku` 在选定范围输出非空基数、NULL/空样本和代表值；源 NULL 只审计，不猜测填充。
4. 结束月 `ym + sku` 库存快照唯一、理论/实际库存值一致且非 NULL；结果摘要同时返回 `null_sku_count`，任一 NULL SKU、库存冲突或 NULL 库存都返回 `check_pass = 0`。
5. 代表性跨国家 SKU 至少有两个国家成员，且同一结果集返回 `stock_pair_count`/`stock_consistent` 库存快照证据；库存不一致、含 NULL 或无样本时显式失败。

每一结果集都返回 `check_pass`/`within_contract` 等状态列，即使通过也返回行；失败必须由结果行可见，不依赖 SQL 异常或隐式 fallback。预检 SQL 只包含查询语句，不改变任何 catalog、数据或运行时状态。

## 9. 测试与验收

### 9.1 生成器与 Python 单测

- 固定断言 9 datasets、27 charts、2 dashboards、26 main-dashboard chart links。
- 断言 Tab 顺序为 `SPU`、`SKU`、`国家`、`SPU开发经理`、`型号`，且没有 `渠道（未启用）`。
- 三个数据集分别锁定字段顺序、三维字段映射、`is_eligible=1`、selected-range 流量、`effective_end_ym` 库存和中文/max-one-decimal 配置。
- 用重复 SID/MSKU、跨国家同 SKU、NULL 维度、零销售额/零销量和不一致库存 fixture 验证两层去重、重算比率、显式汇总行和 fail-closed 行为。
- 断言服务端分页、内置 totals 和隐式排序字段均关闭；汇总只由 SQL 显式追加。

### 9.2 SQL 与数据验收

- 静态检查预检 SQL 不含写入语句、临时表或不可见的生产 fallback，并检查五个结果集的状态字段和必需表名。
- 在只读 Doris 连接上执行预检，保存原始结果、查询时间、catalog 和审计范围；不得以空结果或未执行代替通过。
- 对三个数据集按相同年月和筛选条件执行 Chart Data API，核对流量分子、分母、库存去重、NULL 展示和汇总行。

### 9.3 浏览器验收

Chrome 中依次打开五个 Tab，验证中文表头、底部 `汇总`、一位小数、NULL 的 `-`、金额/比例格式、横向滚动和无重叠。至少选取一个跨国家 SKU，核对各国家明细与全局汇总库存不重复。切换年月和全局筛选器后确认范围、滚动窗口、排序和汇总重新计算。

## 10. 生产发布、备份与回滚

本阶段生产发布是 metadata-only：使用精确生成器提交导出 9 datasets/27 charts/2 dashboards 资产包并导入目标 Superset；不构建或替换前端镜像，不执行 ADS/Doris/Airflow 写入，不改变数据库 schema。发布前必须保存当前相关 Dashboard、图表、数据集、筛选器和布局 metadata 备份，记录资产包校验和、目标环境、导入时间和提交 SHA。

若资产计数、API、数据预检或浏览器验收任一失败，使用发布前 metadata 备份导入回滚，再执行健康检查、资产计数和五 Tab 浏览器复验。回滚不得删除或重算 ADS 数据，也不得以重新导入部分资产替代完整备份恢复。只有备份可读、回滚包可执行且所有验收门禁通过，才能宣布本阶段完成。

## 11. 明确排除

- `渠道（未启用）` Tab、渠道维度图表、FineBI 隐藏/重复/备用/空白组件。
- 新 ADS 表、ETL/DAG、Doris schema、库存写入、源数据回填或生产数据修复。
- 新的前端图表插件、页面 CSS 重构或现有总览/趋势/排行榜指标改口径。
- 将 `actual_stock_qty` 在日表逐日相加、将多个选定月份库存累加，或从可见维度行相加推导全局 SKU 库存。
