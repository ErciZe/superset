# 爆品指数品类筛选设计

## 1. 目标与边界

爆品指数主看板新增原生筛选器“品类”，数据来源固定为
`dim.dim_product.category`，并将筛选器顺序调整为：

1. 年月。
2. 品类。
3. 渠道。
4. 品线。
5. SPU。
6. 国家。
7. 公司 SKU。
8. SKU。
9. 尺寸。
10. 颜色。
11. 开发经理。
12. 型号。
13. SKU 等级。
14. 实际评级。

品类默认选择 `拉杆箱`，允许用户清空或改选其他品类。筛选器总数由 13 个增加为
14 个；2 个 Dashboard、9 个数据集、27 个图表、38 个资源 UUID、26 张主图和
1 张说明图保持不变。

本阶段只修改爆品指数资产生成器、对应测试和设计说明。禁止修改 `superset/`、
`superset-frontend/`、图表插件、Dashboard CSS、ADS 表结构或 Airflow。若实施过程
发现必须修改 Superset 核心源码，必须停止并取得用户明确确认后才能继续。

## 2. 方案选择

采用纯原生 Superset 资产方案：在需要响应全局品类筛选的虚拟数据集 SQL 中关联
`dim.dim_product`，暴露标准 `category` 列，再用 Superset 原生 select filter 下发
`category IN (...)` 条件。

不采用以下方案：

- 不把品类物化进 ADS。本次只是维度筛选，不需要扩大 ETL schema 和发布范围。
- 不创建独立的筛选专用数据集。独立数据集的列不能自动过滤其他图表数据集，无法
  满足全局筛选语义。
- 不修改 Native Filter 前端或 metadata schema。默认值和顺序均使用 Superset 已有
  `native_filter_configuration` 合同表达。

## 3. 品类关联合同

品类来源固定为 `dim.dim_product` 中 `org_id = 1` 的 `category`。关联键为 `sku`，
业务 SQL 使用左连接，确保缺少 DIM 映射时原 ADS 事实仍保留。

发布前必须执行只读门禁：

1. `org_id = 1` 范围内，每个非空 `sku` 最多映射一个规范化后的品类。
2. 品类 `拉杆箱` 必须存在。
3. 关联前后各业务数据集的事实业务键集合、行数和指标汇总不得变化。
4. 若同一 SKU 存在多个不同品类，立即失败，不使用 `MAX`、`MIN` 或任取一行掩盖
   冲突。

品类展示值使用 `COALESCE(NULLIF(TRIM(category), ''), '-')` 规范化 NULL 和空字符串；
该规范化只用于维度展示和筛选，不改变 ADS 原始事实。默认筛选 `拉杆箱` 自然排除
缺失品类，但用户清空筛选后仍可查看全部事实。

## 4. 数据集与筛选范围

在现有全局 select filter 的目标数据集中暴露 `category`：

- 爆品指数日数据集。
- 爆品指数月数据集。
- SPU 明细。
- SKU 明细。
- 国家明细。
- SPU 开发经理明细。
- 型号明细。
- SPU 销量排行榜。

状态数据集不增加品类列，状态图继续排除在 select filter 作用范围之外。品类筛选的
`chartsInScope`、`scope.excluded` 和 targets 与其他业务 select filter 保持一致。
年月筛选继续排除 SPU 销量排行榜，其余 select filter 范围不变。

## 5. 默认值与 metadata

新增筛选器 ID 固定为 `NATIVE_FILTER-category`，名称为“品类”，类型为
`filter_select`，列名为 `category`。控制项继续使用原生多选、可搜索、允许清空配置。

默认值使用标准 DataMask：

```json
{
  "extraFormData": {
    "filters": [
      {"col": "category", "op": "IN", "val": ["拉杆箱"]}
    ]
  },
  "filterState": {"value": ["拉杆箱"]},
  "ownState": {}
}
```

Dashboard 首次打开、执行“重置筛选器”或重新导入资产时，默认值都必须由原生
metadata 生效，不通过 URL 参数、Dashboard CSS 或前端补丁实现。用户主动清空
品类后，本次页面会话保持空筛选，不强制回填默认值。

## 6. 测试与验收

生成器测试必须先以失败合同锁定，再完成实现：

1. 原生筛选器严格为 14 个，顺序严格为“年月、品类、渠道、品线、SPU、国家、
   公司 SKU、SKU、尺寸、颜色、开发经理、型号、SKU 等级、实际评级”。
2. `NATIVE_FILTER-category` 的默认 DataMask 精确为 `category IN ['拉杆箱']`。
3. 品类筛选 targets 覆盖上述 8 个业务数据集，状态数据集不在 targets 中。
4. 8 个目标数据集均声明 `category` 列，SQL 只使用
   `dim.dim_product.category`、`org_id = 1` 和 `sku` 关联。
5. 禁止出现 Dashboard CSS、Superset 核心字段或自定义筛选插件参数。
6. 两次生成 ZIP 字节一致，`unzip -t` 通过。

生产发布前保存完整 Assets 导出、metadata、拓扑、UUID、健康状态和可执行回滚包。
使用 `/api/v1/assets/import/` 导入时，multipart 必须包含 `bundle`、`sparse=true`、
`overwrite=true`，不得只把参数放在 URL query。

生产验收要求：

- 拓扑为 2 dashboards、9 datasets、27 charts、38 UUID、26 主图、1 说明图、
  14 filters，无孤儿资源。
- 26 张主图 Chart Data API 均返回 HTTP 200、success、无 errors/warnings。
- 浏览器首个筛选器为“年月”，第二个为“品类”，品类初始值显示“拉杆箱”。
- 切换、清空和重新选择品类后图表正常刷新；保存 Dashboard 的原内容 PUT 返回 200。
- 任一关联扩行、导入、API、保存、健康或浏览器门禁失败，立即用本轮备份回滚，
  不修改 Superset 核心源码绕过问题。
