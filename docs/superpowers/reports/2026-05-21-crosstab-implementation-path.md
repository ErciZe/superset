# Crosstab Implementation Path

Date: 2026-05-21

## Scope

This document clarifies the repository implementation path for the production
Superset chart at:

- URL: `http://111.230.91.24:8088/explore/?dashboard_page_id=tLUdpjmhYfzPOwbHGAtEi&slice_id=10`
- Production slice: `slice_id=10`
- Viz type: `crosstab-table`

The component is a custom frontend chart plugin. It is not the built-in Pivot
Table plugin and does not add a dedicated backend Crosstab API. Data still flows
through Superset's standard chart data query path.

## High-Level Path

The implementation is concentrated under:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/
```

The runtime path is:

```text
MainPreset registration
  -> CrosstabTableChartPlugin
  -> controlPanel
  -> buildQuery
  -> /api/v1/chart/data
  -> transformProps
  -> crosstab engine
  -> CrosstabTable React component
  -> ThemedAgGridReact
```

## Plugin Registration

### Viz Type

File:

```text
superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts
```

Key:

```ts
CrosstabTable = 'crosstab-table'
```

### Main Preset Registration

File:

```text
superset-frontend/src/visualizations/presets/MainPreset.js
```

The plugin is imported as:

```js
import CrosstabTableChartPlugin from '@superset-ui/plugin-chart-crosstab-table';
```

It is registered when `FeatureFlag.AgGridTableEnabled` is enabled:

```js
new CrosstabTableChartPlugin().configure({
  key: VizType.CrosstabTable,
})
```

## Plugin Entrypoint

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/index.ts
```

This file wires the chart plugin into Superset's chart lifecycle:

- `buildQuery`: converts form data into Superset query objects.
- `controlPanel`: defines Explore controls.
- `transformProps`: converts query results into renderer props.
- `loadChart`: lazy-loads `CrosstabTable`.

Core structure:

```ts
super({
  buildQuery,
  controlPanel,
  loadChart: () => import('./CrosstabTable'),
  metadata,
  transformProps,
});
```

## Form Data And Types

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/types.ts
```

Important form data fields:

- `groupbyRows`
- `groupbyColumns`
- `metrics`
- `crosstabFieldConfig`
- `dynamicGroupBy`
- `showRowTotals`
- `showColumnTotals`
- `showRowSubtotals`
- `showColumnSubtotals`
- `serverColumnPagination`
- `columnPageSize`
- `generatedColumnWidth`
- `defaultRowExpandedDepth`
- `conditionalFormatting`

Dynamic group-by contract:

```ts
export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  placement: 'rows' | 'columns';
  slotIndex: number;
  defaultColumn: QueryFormColumn;
  options: {
    label: string;
    column: QueryFormColumn;
  }[];
};
```

Runtime own-state fields include:

- `selectedDynamicGroupByColumn`
- `effectiveGroupBySignature`
- `currentColumnPage`
- `currentColumnPageSize`
- `serverColumnPageTuples`
- `serverColumnTotalCount`
- `expandedRowPaths`

## Control Panel

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/controlPanel.tsx
```

This file defines the Explore-side configuration surface.

The current implementation has two layers of field configuration:

1. User-facing composite control:
   - `crosstabFieldConfig`
   - Uses `CrosstabFieldConfigControl`
   - Configures rows, columns, metrics, labels, metric semantics, and subtotal flags.

2. Hidden compatibility fields:
   - `groupbyRows`
   - `groupbyColumns`
   - `metrics`

The V3 dynamic group-by config is a JSON text area:

```ts
{
  name: 'dynamicGroupBy',
  config: {
    type: 'TextAreaControl',
    label: t('Dynamic group by'),
    language: 'json',
    renderTrigger: true,
  },
}
```

Other key controls:

- `serverColumnPagination`
- `generatedColumnWidth`
- `columnPageSize`
- `maxGeneratedColumns`
- `defaultRowExpandedDepth`
- `numberFormat`
- `conditionalFormatting`

## Dynamic Group-By Resolver

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts
```

Responsibilities:

- Parse and validate `formData.dynamicGroupBy`.
- Accept either JSON string or object form.
- Fail fast on invalid config, invalid option list, invalid selected column, or
  invalid slot.
- Resolve selected field from chart `ownState`.
- Replace exactly one row or column dimension slot.
- Return an effective row/column dimension signature.

Main exported functions:

- `getDynamicGroupByConfig(formData)`
- `resolveDynamicGroupByDimensions(args)`

Current production shape for slice 10:

```json
{
  "enabled": true,
  "placement": "columns",
  "slotIndex": 1,
  "defaultColumn": "shop_name",
  "options": [
    { "label": "店铺", "column": "shop_name" },
    { "label": "国家", "column": "country" },
    { "label": "MSKU", "column": "msku" },
    { "label": "父体", "column": "parent_asin" }
  ]
}
```

With persisted `groupbyColumns = ['biz_date', 'shop_name']`, the selected
dynamic option replaces `groupbyColumns[1]`.

## Query Building

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/buildQuery.ts
```

Responsibilities:

- Read crosstab rows, columns, and metrics from form data.
- Resolve dynamic group-by before constructing query objects.
- Build the standard Superset chart query context.
- Build server-column pagination queries when enabled.
- Build summary queries for metric semantics, row totals, column totals,
  subtotals, and grand totals.

Important flow:

```ts
const persistedRowDimensions = getCrosstabRowColumns(formData);
const persistedColumnDimensions = getCrosstabColumnColumns(formData);

const { rowDimensions, columnDimensions } = resolveDynamicGroupByDimensions({
  formData,
  ownState: options?.ownState,
  rowDimensions: persistedRowDimensions,
  columnDimensions: persistedColumnDimensions,
});
```

When `serverColumnPagination` is enabled, the query plan includes:

- `server_column_domain`: current page of generated column tuples.
- `server_column_count`: total generated column count.
- `leaf`: actual row/column/metric data for visible generated columns.
- `summary`: SQL-backed totals/subtotals where required.

No dedicated backend endpoint is introduced here. The result is still a Superset
chart data query context.

## Query Plan And Summary Support

Files:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryQueryPlan.ts
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/summaryResults.ts
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/metricSemantics.ts
```

Responsibilities:

- Decide which summary queries are needed.
- Distinguish additive and non-additive metric behavior.
- Build summary value maps consumed by the crosstab engine.
- Avoid incorrectly summing ratio, average, or distinct-style metrics in the
  frontend when SQL-backed summaries are required.

## Transform Props

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts
```

Responsibilities:

- Read `queriesData` returned by Superset.
- Resolve dynamic group-by again for render-time consistency.
- Reset server-column pagination state when the effective group-by signature
  changes.
- Build summary maps from planned queries.
- Invoke the pure crosstab engine.
- Return renderer props for `CrosstabTable`.

Important behavior:

- If `effectiveGroupBySignature` changes, it resets:
  - `currentColumnPage`
  - `serverColumnPageTuples`
  - `serverColumnTotalCount`
  - expanded rows
- If server-column pagination is loading a new domain/data page, it returns
  empty row data until the expected query result is available.

The engine call happens here:

```ts
const result = buildCrosstab((dataQuery?.data ?? []) as DataRecord[], {
  rowFields,
  columnFields,
  metricFields,
  fieldLabels,
  summaryValues,
  resolveSemantic,
});
```

## Crosstab Engine

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/crosstab/engine.ts
```

This is the pure data transformation layer. It has no React dependency.

Responsibilities:

- Validate required row, column, and metric fields.
- Build generated crosstab column IDs.
- Build nested column trees.
- Build row records.
- Build row group, leaf, subtotal, and grand-total rows.
- Apply SQL-backed summary values where required.
- Apply date-like value formatting for column labels.

Important exported identifiers:

- `buildCrosstab`
- `buildColumnTree`
- `CROSSTAB_ROW_KEY`
- `CROSSTAB_ROW_LABEL`
- `CROSSTAB_ROW_PATH`
- `CROSSTAB_ROW_LEVEL`
- `CROSSTAB_ROW_TYPE`
- `CROSSTAB_TOTAL_COLUMN_ID`

## React Renderer

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx
```

Responsibilities:

- Render the crosstab toolbar.
- Render the dynamic group-by select.
- Render AG Grid columns and rows.
- Handle row expand/collapse.
- Handle generated-column pagination.
- Export CSV.
- Preserve chart-local state through `setDataMask({ ownState })`.

Important UI blocks:

- Root component: `data-test="crosstab-table"`
- Toolbar: `data-test="crosstab-table-toolbar"`
- Dynamic group-by control: `data-test="crosstab-dynamic-groupby-control"`
- Grid container: `data-test="crosstab-grid-container"`
- Footer pagination: `data-test="crosstab-table-footer"`

The dynamic selector is rendered only when:

```ts
dynamicGroupByConfig?.enabled && dynamicGroupByOptions.length > 0
```

The selector writes the selected column into chart own-state, which then drives a
new query through `buildQuery`.

AG Grid rendering uses:

```tsx
<ThemedAgGridReact
  rowData={visibleRowData}
  columnDefs={columnDefs}
  defaultColDef={defaultColDef}
  enableCellTextSelection
/>
```

## Server Column Pagination

File:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/serverColumnPagination.ts
```

Responsibilities:

- Resolve current generated-column page.
- Resolve generated-column page size.
- Build tuple-based `WHERE` clauses for visible column tuples.
- Track column tuple signatures.
- Keep pagination stable when the selected dynamic group-by field changes.

Production slice 10 currently uses:

- `serverColumnPagination = true`
- `generatedColumnWidth = 120`
- `columnPageSize = 98`

## Explore Own-State Isolation

File:

```text
superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts
```

This file prevents crosstab chart-local own-state from leaking into
`extra_form_data`.

Filtered crosstab-only keys include:

- `currentColumnPage`
- `currentColumnPageSize`
- `effectiveGroupBySignature`
- `expandedRowPaths`
- `serverColumnPageColumnSignature`
- `serverColumnPageTuples`
- `serverColumnPageTuplesPage`
- `serverColumnPageTuplesPageSize`
- `serverColumnTotalCount`
- `selectedDynamicGroupByColumn`

This matters because the dynamic group-by selected value is chart-local state,
not a dashboard filter.

## Test Coverage

Main test directory:

```text
superset-frontend/plugins/plugin-chart-crosstab-table/test/
```

Important test groups:

- `test/plugin/dynamicGroupBy.test.ts`
- `test/plugin/buildQuery.test.ts`
- `test/plugin/transformProps.test.ts`
- `test/plugin/controlPanel.test.ts`
- `test/CrosstabTable.test.tsx`
- `test/crosstab/engine.test.ts`
- `test/crosstab/domain.test.ts`

Explore own-state filtering coverage:

```text
superset-frontend/src/explore/components/ExploreViewContainer/ownState.test.ts
```

## Production Slice 10 Runtime Mapping

For the current production chart:

- `slice_id = 10`
- `viz_type = crosstab-table`
- persisted row dimension: `metric_name_with_unit`
- persisted column dimensions: `biz_date`, `shop_name`
- dynamic slot: `groupbyColumns[1]`
- dynamic options:
  - `店铺 -> shop_name`
  - `国家 -> country`
  - `MSKU -> msku`
  - `父体 -> parent_asin`

The visible dynamic selector changes only the second column dimension. The first
column dimension remains `biz_date`.

## Implementation Boundary

This component is frontend-owned:

- Plugin lifecycle, query planning, crosstab transformation, AG Grid rendering,
  and chart-local own-state live in `superset-frontend`.
- Backend interaction uses Superset's existing chart data API.
- There is no separate crosstab-specific backend route.
- Production activation depends on building and deploying the frontend bundle
  into the image `apache-superset-doris:6.0.0-zh-column-scheme-matrix`.

## 下一步计划

最终目标：在 Superset 中编写功能等价于 FineBI 交叉表的可视化插件，**仅匹配功能交互**，不复制 UI。
对照 user 列出的 5 项核心能力：

| 核心能力 | 现状 | 关键缺口 | 阶段 |
| --- | --- | --- | --- |
| 1. 行/列 tree | 已实现 (`engine.ts buildCrosstab`) | 行 tree 在多行维度下的展开/折叠键稳定性需要回归覆盖 | V2.1 |
| 2. 指标作为叶子节点参与列头 | demo 通过 (`metricColumnId`) | 多指标 + 服务端列分页未支持 | V5 |
| 3. 多列分页（自研 column pager）| 基本完成 (`serverColumnPagination.ts`) | 仅支持 1 行维 + 1 指标，物理列；多行维 / 多指标未支持 | V5 |
| 4. 可加 / 非可加指标 | V2 仓库通过，生产空白回滚（"交互存疑"） | 浏览器侧渲染回归未定位；非加性指标的用户感知正确性未在生产证明 | **V2.1（P0）** |
| 5. 参数与计算字段（白名单） | V3 dynamic group by 仓库通过 | 仅"维度白名单 + JSON 控件"，无数值参数、无动态指标切换、无计算字段 | V3.1 / V3.2 / V4 |

不引入 AG Grid Enterprise（Pivoting / SSRM 走 community 自研路线），不增加新的后端 Crosstab API。

### 交互与布局大框架（所有阶段共同约束，先定再实施）

这一节是产品交互合同。后续 V2.1 ~ V7 任何阶段都不得越过这里定义的形态去做"另一种"交互。
所有规则都要尽量挂回现有 `@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx`
的 `data-test` 锚点上，避免再造容器。

#### 区域划分

```
┌──────────────────────────────────────────────────────────────────┐
│ data-test="crosstab-table-toolbar"   高度自适应一行              │
│ ─────────────────────────────────────────────────────────────── │
│ [CSV] [动态分组维度: A▾] [动态分组维度: B▾] [动态指标: M▾]      │
│ [数值参数: …] [文本参数: …]                          (右对齐)    │
├──────────────────────────────────────────────────────────────────┤
│ data-test="crosstab-grid-container"                              │
│ ┌──────────────┬──────────────────────────────────────────────┐  │
│ │ 行表头列     │ 列表头树 (AG Grid headerGroup, 多层)         │  │
│ │ pinned=left  │   level 1 / level 2 / … / 指标叶子           │  │
│ │ lockPinned   ├──────────────────────────────────────────────┤  │
│ │              │ 主体: 数值单元格 + 行小计 + 行总计           │  │
│ │ 行树 (可展开 │  + 列小计 + 列总计 + 总计交叉单元             │  │
│ │  折叠)       │                                              │  │
│ └──────────────┴──────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│ data-test="crosstab-table-footer"                       (右对齐) │
│ data-test="crosstab-column-pagination" 列 a-b / total  ◀ ▶       │
└──────────────────────────────────────────────────────────────────┘
```

约束：

- 行表头列恒 `pinned: 'left'` + `lockPinned: true`
  （`@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/plugins/plugin-chart-crosstab-table/src/CrosstabTable.tsx:220-221`），
  水平滚动只影响主体区。
- 第一行表头列宽 `FIRST_ROW_COLUMN_WIDTH`，其余 `EXTRA_ROW_COLUMN_WIDTH`，
  不允许通过 `defaultColDef` 全局覆盖（会破坏 sticky 视觉）。
- 列表头使用 AG Grid `columnGroupShow + children`，**不**使用 AG Grid
  Enterprise 的 Pivot Mode。
- 列分页器只放在 footer 右下，**不**复用 AG Grid 原生行分页 footer。
- 工具栏只能在右侧追加新的 chart-local 控件；行/列/指标的配置永远在
  Explore 侧 `crosstabFieldConfig`，不在工具栏。

#### 单元格类型契约

| 类型 | 来源 | 对齐 | 字体 | 背景 |
| --- | --- | --- | --- | --- |
| 行表头（普通节点） | rowFields 任一 | 左 | 常规 | 透明 |
| 行表头（小计 / 总计行） | engine 注入 `CROSSTAB_ROW_TYPE` | 左 | 加粗 | 主题 token `colorFillSecondary` |
| 列表头（dimension group） | columnTree | 居中 | 常规 | 透明 |
| 列表头（指标叶子） | columnTree leaf | 居中 | 常规 | 透明 |
| 列表头（总计 / 小计列） | engine 注入 | 居中 | 加粗 | 主题 token `colorFillSecondary` |
| 数值叶子单元格 | metric leaf | 右 | 常规 | 条件格式可覆盖 |
| 行小计 / 列小计单元格 | summary | 右 | 加粗 | `colorFillTertiary` |
| 行总计 / 列总计单元格 | summary | 右 | 加粗 | `colorFillSecondary` |
| 总计交叉单元 | summary | 右 | 加粗 | `colorPrimaryBg` |
| 空缺单元 | engine 填 `null` | 右 | 常规 | 透明，渲染为空串 |

禁止：

- 不允许把 `null` 渲染为 `"NaN"` / `"-"` / `"undefined"`。
- 不允许在前端对非加性指标做求和后渲染（V2 已禁止）。
- 不允许把 chart-local 状态（pager / dynamic 选项 / 展开路径）写回
  saved slice 的 `params`。

#### 交互原语（R1 - R9）

| ID | 行为 | 触发 | 状态归属 |
| --- | --- | --- | --- |
| R1 | 行展开 / 折叠 | 行表头 caret | `ownState.expandedRowPaths` |
| R2 | 默认展开深度 | controlPanel `defaultRowExpandedDepth` | `formData` |
| R3 | 列分页前后翻 | footer pager 按钮 | `ownState.currentColumnPage` |
| R4 | 列分页页大小切换 | controlPanel `columnPageSize`（暂不在工具栏） | `formData` |
| R5 | 动态分组维度切换 | toolbar selectors（多 slot，V3.1） | `ownState.selectedDynamicGroupBy[slotId]` |
| R6 | 动态指标切换 | toolbar selector（V3.2） | `ownState.selectedDynamicMetric` |
| R7 | 数值 / 文本参数（V4） | toolbar inputs | `ownState.numericParameters` / `ownState.textParameters` |
| R8 | 条件格式 | controlPanel `conditionalFormatting` | `formData` |
| R9 | CSV 导出 | toolbar `CSV` 按钮 | 无（导出当前可见网格） |

通用规则：

- 任何 `ownState.*` 变化都通过 `setDataMask({ ownState })` 发出，由
  `buildQuery` 重新生成 query。**不**直接重排前端 grid。
- `R5 / R6 / R7` 触发后必须重置 `currentColumnPage = 0`、
  `serverColumnPageTuples = []`、`expandedRowPaths = []`，因为列/行结构变化时
  旧分页是脏的。
- `R3 / R4` 不重置 `expandedRowPaths`。
- 错误状态：grid 区域替换为单行错误条，工具栏保持可点击。
- 加载状态：grid 区域沿用旧 rowData（避免闪烁），footer pager 禁用。

#### 数据 / 状态分层

```
formData (DB 持久化, 跨用户)
  ├─ crosstabFieldConfig (rows/columns/metrics/semantics)
  ├─ dynamicGroupBy (slot 白名单)
  ├─ dynamicMetric (V3.2, slot 白名单)
  ├─ parameters (V4, 参数白名单 + 默认值)
  ├─ calculatedFields (V4, AST 白名单)
  ├─ showRow/ColumnTotals/Subtotals
  ├─ serverColumnPagination / columnPageSize / generatedColumnWidth
  ├─ defaultRowExpandedDepth
  ├─ numberFormat
  └─ conditionalFormatting

ownState (chart-local, 仅本次会话, 必须从 extra_form_data 剥离)
  ├─ selectedDynamicGroupBy: { [slotId]: optionId }
  ├─ selectedDynamicMetric: optionId
  ├─ numericParameters: { [name]: number }
  ├─ textParameters: { [name]: string }
  ├─ currentColumnPage / currentColumnPageSize
  ├─ serverColumnPageColumnSignature / serverColumnPageTuples / …
  ├─ effectiveGroupBySignature
  └─ expandedRowPaths
```

新增任何 `ownState.*` 键必须同步加入
`@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
的 strip 列表，并在 `ownState.test.ts` 补 case，**否则就是 P0 bug**。

#### 数字格式优先级

1. `crosstabFieldConfig.metrics[i].formatString` (per metric)
2. `formData.numberFormat` (chart-wide)
3. fallback `,.0f`

条件格式 (R8) 只影响颜色，**不**改变数值显示。

#### AG Grid 列契约

- 列定义生成统一走 `transformProps` → `columnTree` → `columnDefs`，组件层
  不再二次拼接列。
- `colId` 全部使用 `CROSSTAB_COLUMN_PREFIX + encodeTuple(...) + "__metric__" + metric`
  形式（已由 `engine.ts metricColumnId` 实现），保证跨 query 稳定，可作为
  `expandedRowPaths` / 列分页 cache 的 key。
- 不使用 `field` 直接绑定数据，而是用 `valueGetter`，避免 AG Grid 对包含
  `:` / `|` 的 colId 做点路径解析。
- 主题用 `ThemedAgGridReact` 包装层，禁止在 plugin 内单独配置 AG Grid theme。

### V2.1 修复 v2 生产空白渲染（P0，阻塞所有后续）

定位：解除 `2026-05-20-crosstab-v2-production-closeout.md` 报告中的"browser/rendering side blocker"，把 `crosstabFieldConfig + 非加性 semantic` 真正在 slice 10 上跑通。

任务：

- 在生产容器或本地起 Superset，访问
  `http://111.230.91.24:8088/explore/?slice_id=10`
  抓取浏览器 console / network。重点检查：
  - `transformProps` 是否走到 `effectiveGroupBySignature` 重置分支后陷入空 `rowData`
    （`@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/transformProps.ts`）。
  - `summary` 子查询是否真的回写到 `summaryValues` map（`summaryResults.ts`）。
  - 旧 query_context 中的 `extra_form_data` 是否仍包含 crosstab own-state（应已被
    `@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts` 过滤）。
- 如确认是 form data / own-state 形态不兼容旧 saved slice，写一个迁移函数：旧 slice
  在 `transformProps` 入口做兼容映射（不再写回 DB），并补 jest case。
- 修复后重新部署镜像 `apache-superset-doris:6.0.0-zh-column-scheme-matrix`，把
  `crosstabFieldConfig` 写回 slice 10。

验收门：

- Chrome 截图：dashboard 与 explore 都显示完整交叉表（替换
  `2026-05-20-crosstab-v2-production-dashboard-chrome-final.png`）。
- SQL 基线一致：`销售额` 加性合计 = `567999.82`，`毛利率` 走 SQL summary = `-9.5145`，
  `平均售价` = `98.6968`（来自 v1 acceptance baseline 报告）。
- `npx jest plugins/plugin-chart-crosstab-table/test --runInBand` 全绿。
- 服务器日志在浏览器验收期间不出现 `HTTPException: 405`。

### V3.1 Dynamic Group By 多列推进（P1）

#### 目标

把当前"单 slot 单列替换"扩展为以下三种模式中的 A + B（C 作为 stretch）：

- **模式 A 多 slot**：N 个独立选择器，各自替换一个维度槽（用户独立切换）。
- **模式 B 多列选项**：一个选项产出多个列（`spliceCount > 1`，一次替换连续 N 个槽）。
- **模式 C 累积下钻**（stretch）：在 placement 末尾按需 push / pop 列，做层级展开。

不得越过当前的"chart-local own-state + 白名单"边界（参见上方"交互与布局大框架"
R5）。所有维度仍来自 `crosstabFieldConfig` 和 dataset 列白名单。

#### 配置数据模型（新）

新的"权威形态"基于 slot 数组：

```ts
export type CrosstabDynamicGroupBySlot = {
  id: string;                      // 稳定标识，用作 ownState key
  label?: string;                  // 工具栏选择器标题，缺省用第一个 option label
  placement: 'rows' | 'columns';
  slotIndex: number;               // 在 placement 维度数组中的起始位置
  spliceCount?: number;            // 默认 1；选项 columns.length 必须 === spliceCount
  defaultOptionId: string;
  options: {
    id: string;                    // 稳定标识
    label: string;
    columns: QueryFormColumn[];    // 长度必须等于 spliceCount；允许长度为 0 表示"无"
  }[];
};

export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  slots: CrosstabDynamicGroupBySlot[];
};
```

`columns.length === 0` 是"该 slot 不参与"的合法选项，对应 placement 维度
被切除一段（典型 UI 上叫做"无"或"(空)"）。

#### 与旧形态的兼容

旧 shape 仍要被
`@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/dynamicGroupBy.ts`
接受，并在解析层归一化为新 shape：

```ts
// 旧
{
  enabled: true,
  placement: 'columns',
  slotIndex: 1,
  defaultColumn: 'shop_name',
  options: [
    { label: '店铺', column: 'shop_name' },
    { label: '国家', column: 'country' }
  ]
}
// 等价于新
{
  enabled: true,
  slots: [{
    id: '__legacy__',
    label: '分组维度',
    placement: 'columns',
    slotIndex: 1,
    spliceCount: 1,
    defaultOptionId: 'shop_name',
    options: [
      { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
      { id: 'country',   label: '国家', columns: ['country']   }
    ]
  }]
}
```

旧 own-state 字段 `selectedDynamicGroupByColumn: QueryFormColumn` 也要被
当作 `selectedDynamicGroupBy: { __legacy__: <option_id_with_matching_column> }` 读取。
解析层做反向匹配：选项里第一个 `columns[0] === oldColumn` 的视为命中。

新 own-state 形态：

```ts
selectedDynamicGroupBy?: { [slotId: string]: string /* optionId */ };
// 旧字段保留为只读快捷视图，写入时统一写新形态
selectedDynamicGroupByColumn?: QueryFormColumn;
```

#### 维度合成算法

1. 起点：`persistedRowDimensions`、`persistedColumnDimensions` 从
   `crosstabFieldConfig` 解析（已实现）。
2. 按 `slots`（无序集合，按 `placement` 分组后 **slotIndex 升序**）依次应用：
   - 取选中 option（`ownState.selectedDynamicGroupBy[slotId]`，缺省 `defaultOptionId`）。
   - 在对应 placement 维度数组上 `splice(slotIndex, spliceCount, ...option.columns)`。
3. 校验**应用后**的维度数组：
   - 不允许同一物理列在同一 placement 中出现两次。
   - 不允许 placement 维度数为 0（除非那个 placement 本来就允许空）。
   - 总维度数（rows + columns）不超过 `MAX_DIMENSIONS = 8`（防止笛卡尔积失控）。
4. 发出最终 `effectiveGroupBySignature`：
   `rows=<row_dims_joined> | columns=<col_dims_joined>`。

`slotIndex` 之间不允许重叠：当 placement 同样且
`[slotIndex_a, slotIndex_a + spliceCount_a)` 与 `[slotIndex_b, slotIndex_b + spliceCount_b)`
区间相交时，控件层 / 解析层都必须 fail-fast，错误码沿用现有
`ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT` 命名风格新增：

```ts
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SLOT_OVERLAP =
  'Crosstab dynamic group-by slots cannot overlap on the same placement.';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_SPLICE_COUNT =
  'Crosstab dynamic group-by option columns must match its slot spliceCount.';
export const ERR_CROSSTAB_DYNAMIC_GROUP_BY_DUPLICATE_COLUMN =
  'Crosstab dynamic group-by produced duplicate dimensions.';
```

#### 工具栏布局

按 `slots[]` 顺序在 `crosstab-table-toolbar` 中渲染：

```
[CSV] [行: A▾] [列1: B▾] [列2: C▾] [指标: M▾] [参数1] [参数2]    (右对齐)
```

每个 selector 用 `data-test="crosstab-dynamic-groupby-control--<slotId>"`，方便 e2e
精确定位。当 slot 数 ≥ 4 时，自动包成下拉抽屉（避免一行挤爆）。

工具栏 selector 切换时：

- 写 `ownState.selectedDynamicGroupBy[slotId] = optionId`。
- 重置 `currentColumnPage = 0`、`serverColumnPageTuples = []`、
  `expandedRowPaths = []`（参见 R5 通用规则）。
- 不重置其它 slot 的选项。

#### 与已有阶段的边界

- **V2 metric semantics**：动态选择改变维度后，summary query plan 必须按新维度
  重新生成（`buildQuery.ts` 已经在 `resolveDynamicGroupByDimensions` 之后构造
  query plan，扩展到 multi-slot 是改解析层，不动 plan 形状）。
- **服务端列分页**（V5 之前还有 1 行维 / 1 指标硬限制）：在 V5 之前，多 slot
  组合后若打破 1 行维硬限制，必须在 controlPanel 校验时禁用
  `serverColumnPagination` 或抛错；不要静默回退。
- **extra_form_data 隔离**：`selectedDynamicGroupBy` 必须加入
  `@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  的 strip 列表，并在 `ownState.test.ts` 加 case。

#### 模式 C（stretch）：累积下钻

只有在 A + B 落地后再考虑。形态：

- 工具栏单按钮 `+ 下钻`：每次按 `drillCandidates[]` 顺序在 placement 末尾
  push 一列；右侧出现 `× 收回` 按钮 pop 出来。
- 状态：`ownState.drillStack: QueryFormColumn[]`。
- 对 V5 服务端列分页友好（始终物理列）。
- UI 比 A + B 复杂，ergonomics 在 FineBI 里也有等价（"分组下钻"），但**不**作为
  V3.1 必交付，单独立项。

#### 生产 slice 10 worked examples

例 1：当前生产形态（兼容验证）

```json
{
  "enabled": true,
  "slots": [
    {
      "id": "level2",
      "placement": "columns",
      "slotIndex": 1,
      "spliceCount": 1,
      "defaultOptionId": "shop",
      "options": [
        { "id": "shop",        "label": "店铺", "columns": ["shop_name"] },
        { "id": "country",     "label": "国家", "columns": ["country"] },
        { "id": "msku",        "label": "MSKU", "columns": ["msku"] },
        { "id": "parent_asin", "label": "父体", "columns": ["parent_asin"] }
      ]
    }
  ]
}
```

例 2：双 slot（模式 A）—— 同时切换二级与三级维度

```json
{
  "enabled": true,
  "slots": [
    {
      "id": "level2",
      "placement": "columns",
      "slotIndex": 1,
      "spliceCount": 1,
      "defaultOptionId": "shop",
      "options": [
        { "id": "shop",    "label": "店铺", "columns": ["shop_name"] },
        { "id": "country", "label": "国家", "columns": ["country"] }
      ]
    },
    {
      "id": "level3",
      "placement": "columns",
      "slotIndex": 2,
      "spliceCount": 1,
      "defaultOptionId": "none",
      "options": [
        { "id": "none",        "label": "(无)",  "columns": [] },
        { "id": "msku",        "label": "MSKU",  "columns": ["msku"] },
        { "id": "parent_asin", "label": "父体",  "columns": ["parent_asin"] }
      ]
    }
  ]
}
```

例 3：单 slot 多列（模式 B）—— 一次替换 2 列

```json
{
  "enabled": true,
  "slots": [
    {
      "id": "shop_country",
      "placement": "columns",
      "slotIndex": 1,
      "spliceCount": 2,
      "defaultOptionId": "shop_country",
      "options": [
        { "id": "shop_country", "label": "店铺 + 国家", "columns": ["shop_name", "country"] },
        { "id": "msku_parent",  "label": "MSKU + 父体", "columns": ["msku", "parent_asin"] }
      ]
    }
  ]
}
```

#### 任务拆解

1. `types.ts`：新增 `CrosstabDynamicGroupBySlot` / 新形态 `CrosstabDynamicGroupByConfig`，
   保留旧形态作为输入 union。
2. `plugin/dynamicGroupBy.ts`：
   - 新增 `normalizeDynamicGroupByConfig` 把旧 shape 折叠到 slots[]。
   - 把 `resolveDynamicGroupByDimensions` 改为遍历 slots 并应用 splice。
   - 新增 overlap / spliceCount / duplicate 三个错误码与对应 fail-fast。
3. `plugin/controlPanel.tsx`：
   - `dynamicGroupBy` 控件类型从 `TextAreaControl` 替换为
     `CrosstabDynamicGroupByControl`（新 React 组件）。
   - 控件内部支持增删 slot、增删 option、option columns 多选（受 dataset 列限制）。
   - 控件保存仍 emit JSON 形态。
4. `CrosstabTable.tsx`：
   - 工具栏循环渲染 selectors，按 slot 顺序。
   - selector 个数 ≥ 4 时自动收成下拉抽屉。
   - 切换时按 R5 通用规则一次性写所有重置 own-state 字段。
5. `transformProps.ts`：扩展 `effectiveGroupBySignature` 计算到 multi-slot；
   signature 变化时重置分页 + 展开。
6. `src/explore/components/ExploreViewContainer/ownState.ts` strip 列表追加
   `selectedDynamicGroupBy`。

#### 验收门

仓库侧：

- 新增 jest case：
  - 旧 shape 归一化等价。
  - 多 slot 顺序应用结果。
  - spliceCount > 1 的连续替换。
  - overlap / duplicate / spliceCount 三类 fail-fast。
  - own-state strip 覆盖 `selectedDynamicGroupBy`。
- `controlPanel.test.ts` 覆盖 "添加 slot / 删除 slot / option columns 多选" 操作。
- `CrosstabTable.test.tsx` 覆盖 "多 selector 渲染 + 切换 + 重置 ownState" 流程。

生产侧（slice 10）：

- 例 1（兼容回归）：维持当前 4 选项行为，截图与 v1 baseline 像素级一致。
- 例 2（双 slot）：4 × 3 共 12 种组合中至少 3 种 Chrome 截图 +
  `chart/data` 请求 `groupby` 切换证据。
- 例 3（多列）：`店铺+国家` / `MSKU+父体` 两种组合各一张截图，
  `effectiveGroupBySignature` 在浏览器 console 打印记录。
- v1 SQL baseline（销售额 / 毛利率 / 平均售价）在每种组合下都重新跑一遍并对账。

### V3.2 Dynamic Metric 多 slot 切换（FineBI 文本参数对动态指标）（P1）

定位：FineBI"文本参数 → 动态指标切换"对应到当前模型，就是把 V3.1 的多 slot
机制套用到 `crosstabFieldConfig.metrics`。

#### 数据模型（与 V3.1 镜像）

```ts
export type CrosstabDynamicMetricSlot = {
  id: string;
  label?: string;
  slotIndex: number;
  spliceCount?: number;             // 默认 1
  defaultOptionId: string;
  options: {
    id: string;
    label: string;
    metrics: QueryFormMetric[];     // 长度必须等于 spliceCount；允许 0 表示"无"
  }[];
};

export type CrosstabDynamicMetricConfig = {
  enabled: boolean;
  slots: CrosstabDynamicMetricSlot[];
};
```

#### 与 V3.1 复用要点

- 解析层：新建 `plugin/dynamicMetric.ts`，把 V3.1 的 normalize / splice / overlap
  校验逻辑抽到 `plugin/dynamicSlots.ts` 公共模块，metric 与 group-by 各自调用。
  错误码仍按 `ERR_CROSSTAB_DYNAMIC_METRIC_*` 命名。
- buildQuery 顺序：**先 group-by，再 metric**。两者都解析完后才生成
  query plan、summary plan、server column pagination plan。
- 工具栏：与 V3.1 selector 同行渲染，`data-test="crosstab-dynamic-metric-control--<slotId>"`。
- own-state：`selectedDynamicMetric: { [slotId: string]: string /* optionId */ }`，
  必须加入 `ownState.ts` strip 列表。
- 切换时按 R5 / R6 通用规则重置 `currentColumnPage / serverColumnPageTuples`，
  **不**重置 `expandedRowPaths`（行结构未变）。
- 与 V2 metric semantics 的耦合：每个 metric option 的 semantic 仍由
  `crosstabFieldConfig.metrics[].semantic` 决定；切换 option 后 summary plan
  自动按新 metric 重算（不需要在 V3.2 改 metricSemantics 模块）。

#### 校验规则

- option `metrics.length === spliceCount`。
- 同一 slot 内 metric 名不重复。
- 切换后 effective metrics 总数不超过 `MAX_METRICS = 8`。
- 与 V5 之前的"服务端列分页只支持 1 指标"硬限制冲突时，controlPanel 校验阶段
  禁用 `serverColumnPagination` 或抛错；不要静默回退。

#### 验收门

仓库侧：

- 新增 `dynamicMetric.test.ts` 覆盖 disabled / default / runtime / 非法 slot /
  非法选项 / spliceCount mismatch / 重复 metric 共 7 类。
- 抽取后的 `dynamicSlots.test.ts` 同时覆盖 group-by 与 metric 两路调用，
  确保公共模块行为一致。
- own-state strip 覆盖 `selectedDynamicMetric`。

生产侧（slice 10）：

- 单 slot 在 `销售额 / 毛利率 / 平均售价` 三种 semantic 间切换，截图覆盖各 1 张，
  SQL summary 与 v1 baseline (`567999.82` / `-9.5145` / `98.6968`) 一致。
- 双 slot 至少跑一组组合（例如 slot1=`销售额`, slot2=`毛利率`），证明 multi-slot
  metric 与 multi-slot group-by 同时启用时 query plan 仍然正确。

### V4 数值参数与白名单计算字段（P2）

定位：FineBI"数值参数 → 参数参与计算字段"+"计算类型选择"在我们的范围内的最小落地。

设计原则：**不开放任意 SQL/Jinja**。表达式走 AST 白名单：

```ts
type CalcExpr =
  | { kind: 'metric'; metric: string }
  | { kind: 'param'; name: string }
  | { kind: 'const'; value: number }
  | { kind: 'op'; op: '+' | '-' | '*' | '/'; left: CalcExpr; right: CalcExpr }
  | { kind: 'fn'; fn: 'ratio' | 'pct' | 'safe_div'; args: CalcExpr[] };
```

#### 关键决定（修订）：取消前端 evaluator，所有计算字段走 SQL

**背景**：本表必有"列分页 + 行总计 + 行小计 + 列总计 + 列小计"。前端 evaluator
只能看到当前可见列分页的 leaf 单元格，会产生两类极其误导的错误：

1. **加性 calc 字段的行总计 / 列总计 ≠ SQL 真值**：用户在第 1/N 页看到的
   `SUM(amount + profit)` 实际只是"当前可见 leaves 的合计"，不是全量合计。
   翻页后行总计会跳变，业务侧无法理解。
2. **非加性 calc 字段（占比 / 比率 / 平均）的小计同样错**：前端汇总等价于
   "可见 leaves 的算数和"，与 V2 metricSemantics 走 SQL summary 的结果分叉。

结论：**`CalcField` 不允许走前端 evaluator 分支**。无论加性还是非加性，
统一在 buildQuery 阶段编译成 Superset SQL metric，由数据库完成聚合，
再交给 V2 summary plan 回写到 row/column/grand 总计。
这同时也消除了"加性=前端、非加性=后端"的双路径分裂。

`calc/expr.ts` 因此**不再实现 frontend evaluator**，仅保留：

- `parseCalcField(json: unknown): CalcField`（结构校验 + AST 归一化）
- `validateCalcField(field: CalcField, ctx: WhitelistContext): void`（叶子白名单）
- `emitCalcFieldSQL(field: CalcField, engine: 'doris' | 'postgres' | …): string`
- `inferCalcFieldSemantic(field: CalcField, metricSemantics): MetricSemantic`

#### 计算字段数据模型

```ts
type CalcField = {
  id: string;                   // 稳定标识
  label: string;                // 业务命名
  expr: CalcExpr;               // 上面 AST
  semantic?: MetricSemantic;    // 缺省由 inferCalcFieldSemantic 推断
  formatString?: string;        // 数字格式
};

type CrosstabFormData = {
  ...
  calculatedFields?: CalcField[];
  parameters?: ParamDef[];      // V4 数值/文本参数
};

type ParamDef =
  | { kind: 'number'; name: string; default: number; min?: number; max?: number; step?: number; }
  | { kind: 'text';   name: string; default: string; options?: string[]; };
```

`crosstabFieldConfig.metrics` 中可以引用 `{ kind: 'calc', calcFieldId: string }`
来把计算字段当作普通 metric 使用，由 `buildQuery.ts` 在生成 query 前把它
inline 成 SQL metric expression。

#### 语义自动推断规则

| 表达式特征 | 推断 semantic | 备注 |
| --- | --- | --- |
| 只含加性 metric + 常数，运算 `+ - *` | `additive` | `SUM(a + b) = SUM(a) + SUM(b)` 成立 |
| 含运算 `/` 或 `fn ratio / pct / safe_div` | `ratio` | 走 V2 SQL summary |
| 含 `fn distinct` | `distinct` | 走 V2 SQL summary |
| 任一叶子为 `ratio / average / distinct` 指标 | 继承非加性 semantic | `SUM` 不可分配 |
| 含 `param` 节点 | 沿用上面规则按其它叶子推断 | 参数当作常数处理 |

用户可以在控件里手动覆盖推断结果（小心提示"覆盖语义可能导致总计与 SQL 不一致"）。

#### SQL emitter 约束

- 仅生成 metric expression 字符串（Superset 已有 path），**不**生成 WHERE / JOIN。
- 标识符走 dataset 列白名单 + 既有 metric 白名单做反向查找，命中后用 emitter
  当前方言的 quoter 包裹（不允许字符串拼接表名）。
- 参数：`{ kind: 'param', name }` → 编译期把当前 `ownState.parameters[name]` 转成
  数值常量直接 inline（数值参数）或转成单引号字符串（文本参数，仅在 `LIKE` /
  `=` 比较位置允许，目前不开放比较场景，所以文本参数仅用于 metric label / 维度切换）。
- 安全过滤：emitter 不接受 `metric.name` 含 `;` / `--` / `/*` / `'` 的输入，
  validator 早就应该挡掉。

#### 数值参数 / 文本参数

- `numericParameters / textParameters` 通过 `ownState` 传入（同 V3 / V3.1 strip 列表）。
- buildQuery 在 query plan 生成前把当前参数值 inline 到 calc field expression，
  然后把 inline 后的 SQL metric 加入 query.metrics。
- 参数变化重新生成 query；缓存键必须包含 `numericParameters` / `textParameters`
  的稳定 JSON 串。

#### 交互优化（业务人员可用，重点）

UI 文案完全去掉 `AST / operator / function / kind` 字眼。

**模板库 (Templates)**：控件首屏给 6 个预制模板，点选即填入：

| 模板名 | 表达式 | 推断 semantic |
| --- | --- | --- |
| 比率（A÷B） | `safe_div(A, B)` | ratio |
| 占比（A÷总计 B） | `safe_div(A, B)` + 提示 B 选择"总计指标" | ratio |
| 差值（A−B） | `A − B` | additive |
| 倍率（A÷B − 1） | `safe_div(A, B) − 1` | ratio |
| 加权求和（A×B） | `A × B` | additive |
| 含参比率（A÷B×param） | `safe_div(A, B) × param` | ratio |

**可视化表单（不暴露 AST）**：
```
┌─────────────────────────────────────────────┐
│ 名称: [毛利率                              ] │
│ 模板: [比率 (A÷B) ▾]                         │
│ A:    [毛利 ▾]                               │
│ B:    [销售额 ▾]                             │
│ 数字格式: [.2% ▾]    语义: [自动: 比率] ⚙   │
│ ─────────────────────────────────────────── │
│ SQL 预览:                                    │
│   safe_div(SUM(profit), SUM(amount))         │
│ 样例值 (前 3 行):                            │
│   2025-01-01 LX-GG-AE 阿联酋  29.97 %        │
│   2025-01-01 LX-GG-CA 加拿大  9.59 %         │
│   2025-01-01 LX-GG-DE 德国    19.32 %        │
└─────────────────────────────────────────────┘
```

- A / B 是受 `mapStateToProps` 限制的列下拉（白名单天然成立）。
- 选高级模式才会出现"自由表达式"按钮，并在保存前再过一次 validator。
- SQL 预览实时刷新（不发请求，本地 emit）。
- 样例值在控件保存前异步拉一次（最多 3 行）；失败时显示具体错误，不沉默回退。

**数值参数控件**：

- 默认控件类型：`min/max` 都给则渲染 **滑块**（步长 = `step || (max-min)/100`）；
  缺一就是 input box。
- 参数预览：显示当前值 + 数值格式 + 单位（如 `%`）。
- 滑块上方画 5 个常用刻度 tick，标签来自 `(min + i*(max-min)/4)`。

**文本参数控件**：

- 默认 `options` 给定则渲染 **下拉**；不给则渲染禁用并提示"需要白名单选项"。
- 不允许自由输入（避免业务侧把参数当 LIKE 通配符）。

**错误信息可执行**：

- "A 未选择" → 点 "去补充" 直接聚焦 A 的下拉。
- "B 选择了非加性指标" → 提示"语义将切换为 ratio，是否继续"，给两个按钮。
- "SQL emit 失败" → 显示精确的字段名 + 修复建议（"检查指标 X 是否在数据集中"）。

**计算字段管理**：

- chart 内列表，每个 calc field 可启用 / 停用 / 重命名 / 删除 / 复制。
- 拖拽到 `crosstabFieldConfig.metrics` 槽 → 直接当 metric 用。
- 同名禁止（避免引用歧义）。

**禁止项（拒绝越界）**：

- 不允许直接在 chart 控件里写"自由 SQL / Jinja"输入框，必须走 AST + 模板。
- 不允许把 calc field 与 dataset metric 同名。
- 不允许在 calc field expression 里递归引用其它 calc field（V4 范围）。
- 不允许时间窗口函数（同比 / 环比 / 累计 / 占比时间偏移）—— 走未来阶段。

#### 任务拆解

1. `calc/expr.ts`：parser / validator / sql emitter / semantic inferrer，单测 ≥ 30 case。
2. `plugin/calcFields.ts`：把 `calculatedFields` + `crosstabFieldConfig.metrics`
   里的 `{ kind: 'calc' }` 引用展开为 SQL metric，喂给 `buildQuery`。
3. `plugin/parameters.ts`：参数定义 + ownState 读写 + buildQuery inline。
4. `plugin/CrosstabCalcFieldsControl.tsx`：模板 / 表单 / 预览 / 错误信息。
5. `plugin/CrosstabParametersControl.tsx`：数值滑块 / 文本下拉。
6. 工具栏：参数选择器渲染在 V3.1 / V3.2 selector 右侧（参见交互大框架）。
7. `ownState.ts` strip 列表追加 `numericParameters` / `textParameters`。
8. 缓存键：包含 `calculatedFields` 哈希 + `parameters` JSON 串。

#### 验收门

仓库侧：

- `calc/expr.test.ts`：30 + 单测，含 5 类 fail-fast、5 个模板的 SQL emit、
  语义自动推断的全部矩阵。
- `calcFields.test.ts`：calc field 引用展开、跨方言 emitter、加性 calc field
  的行/列总计走 V2 summary plan、非加性 calc field 同样走 V2 summary plan。
- `parameters.test.ts`：参数变化生成新 query、缓存键包含参数、ownState strip 覆盖。
- 安全回归：
  - 在参数值字段尝试 `1=1` / `;DROP TABLE` / `${env.SECRET}` / `{{ datasource }}`
    全部被 validator 拒绝。
  - 计算字段引用不存在的 metric → 抛错并指明缺失字段名。
  - 计算字段 self-reference → 抛错。
- ESLint / TypeScript / 生产 build 全绿。

生产侧（slice 10）：

- 让一位非工程的业务同事跑通"毛利率 = 毛利 ÷ 销售额"全流程：
  打开控件 → 选模板"比率(A÷B)" → 选 A=毛利 / B=销售额 → 数字格式 `.2%`
  → 保存 → 列表出现 → 拖入指标槽 → 看到结果。**全流程 ≤ 60 秒**，无需文档。
- 计算字段 + 列分页同时启用时，多翻几页，**行总计 / 列总计保持不变**
  （证明 SQL 路径正确，没有把可见 leaves 求和当总计）。
- 计算字段 + V3.1 动态分组维度切换：切换后 calc field 立即重算，列头与
  `chart/data` 请求一致。
- v1 SQL baseline (`销售额=567999.82`、`毛利率=-9.5145`、`平均售价=98.6968`)
  在加入 calc field "毛利率2 = safe_div(毛利, 销售额)" 后，毛利率2 = 毛利率，
  误差 < 1e-9。

#### 不进入 V4 范围

- FineBI 同比 / 环比 / 累计 / 占比的时间偏移计算（需要窗口函数 + 时间维约束）。
- Dataset 级别的 calc field 持久化与跨 chart 复用（建议走 Superset 既有
  `SqlaTable.metrics` 通道，单独立项）。
- calc field 递归引用 / 自定义 SQL fragment。

### V5 服务端列分页限制松绑（P2）

阻碍来自这两个常量：

```@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/plugins/plugin-chart-crosstab-table/src/plugin/serverColumnPagination.ts:28-33
export const ERR_SERVER_COLUMN_PAGINATION_COLUMNS =
  'Crosstab server column pagination only supports physical column dimensions.';
export const ERR_SERVER_COLUMN_PAGINATION_SHAPE =
  'Crosstab server column pagination currently requires exactly one row dimension and one metric.';
export const ERR_SERVER_COLUMN_PAGINATION_ROW_LIMIT =
  'Crosstab server column pagination query reached the row limit. Reduce the column page size or add filters.';
```

任务：

- 解除 "exactly one row dimension"：`leaf` 查询使用 row 维度 tuple 作为 `groupby`，
  叠加可选 `row total` / `row subtotal` 子查询。
- 解除 "exactly one metric"：在 `domain` 查询里只算 column tuple，`leaf` 查询里
  按当前 `metrics` 一并发出，并由 engine 按 `metricColumnId` 维度合并。
- 物理列限制保留（计算列要走 V4 通道）。
- 列分页页大小默认仍为 `98`（已生产验证）。

验收门：

- 新增 `serverColumnPagination.test.ts` case：2 行维度 + 2 指标 + 列分页。
- engine 测试：服务端结果 + 多 metric 多 row 的合并结果与"全量本地构建"一致
  （fixture 数据相同，比较 rowData / generatedColumnIds 完全相等）。
- 生产灰度：先在非关键 dashboard 上跑，再切回 slice 10。

### V6（可选） 单元值惰性查询 / SSRM 取舍（P3）

不在 v2.1–v5 范围内，做一次**显式选型记录**：

- 不引入 AG Grid Enterprise 的 `Server-Side Row Model` 与 `Pivoting`
  （license 路线未确定）。
- 行数极大场景的可选方案是：当 row 维度笛卡尔积超过阈值时，落到
  Superset row paging（chart data API 已支持），而不是 SSRM。
- 单元格惰性查询作为后续可选项，单独立项再写计划。

### V7 跨阶段约束（始终适用）

- **own-state 隔离**：任何新增 chart-local own-state key 必须同步加入
  `@/Volumes/extend/ecode-workspace/superset-source/superset-frontend/src/explore/components/ExploreViewContainer/ownState.ts`
  的 strip 列表，并在 `ownState.test.ts` 中加 case，否则会泄漏到
  `extra_form_data` 影响 dashboard filter 行为。
- **缓存键**：服务端缓存键必须包含 `selectedDynamicGroupByColumn`、未来的
  `selectedDynamicMetric`、`numericParameters`，避免不同参数复用同一缓存。
- **RLS 与权限**：白名单的 metric / column / param 必须经过 dataset 列表与
  metric 列表二次校验（`mapStateToProps`），不接受任意字符串。
- **回归基线**：v1 acceptance baseline 中 `销售额 / 毛利率 / 平均售价` 三个
  数值在每个阶段都要再跑一次。

### 验收门命令清单（每个阶段都要过）

```bash
cd superset-frontend && BABEL_ENV=test npx jest plugins/plugin-chart-crosstab-table/test --runInBand
cd superset-frontend && npx eslint plugins/plugin-chart-crosstab-table/src plugins/plugin-chart-crosstab-table/test
cd superset-frontend && npm run type -- --pretty false
cd superset-frontend && BABEL_ENV=testableProduction npm run build
```

生产验收增加：

```bash
curl -f http://111.230.91.24:8088/health
```

加上 Chrome 登录态截图（dashboard + explore），保存到
`docs/superpowers/reports/<date>-crosstab-<phase>-*.png`。

### 不在本规划范围内

- 复制 FineBI 的 UI / 视觉。
- AG Grid Enterprise 特性（Pivoting / SSRM / Master-Detail）。
- 任意 SQL / Jinja 计算字段。
- 同比 / 环比 / 累计 / 占比 等时间窗口计算。
- 新增专属 backend Crosstab API。
