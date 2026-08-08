# Hot Product Index Remaining Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有“拉杆箱在售产品爆品指数看板”明细区之后，按已确认的 FineBI 逻辑交付指标整体趋势、SPU 销量排行榜、SPU 销售比例、SKU 销售比例、颜色销售比例和颜色销量分布六个可见组件。

**Architecture:** 继续以现有 ADS 日表和月表为唯一业务事实源，扩展已有日明细虚拟数据集，并新增一个只负责水位月/上月比较的 SPU 排行榜虚拟数据集。六个可见组件由 9 个固定 UUID 的标准 Superset 图表组成：趋势 3 图放入天/周/月 Tabs，颜色趋势 2 图放入周/月 Tabs，其余 4 图直接展示；前端只做两个现有插件内的窄修改：Pie 查询上限从 100 放宽到 1,000 并支持可选纯文本中心标签，同时在安全 ECharts schema 中放行静态布尔 `legend.selected`。

**Tech Stack:** Python 3、Doris SQL/Jinja virtual datasets、Superset assets import、ECharts Mixed Timeseries/Timeseries/Pie、AG Grid Table Scheme、React/TypeScript、Jest、pytest、Docker Compose、Chrome production acceptance。

## Global Constraints

- 只实施六个可见组件；不新增国家、SPU 开发经理、型号、渠道明细 Tab，也不迁移 FineBI 隐藏、重复、备用、空白组件或编辑态“+”。
- FineBI 是布局、交互、字段绑定和可见结果基线，不是数据权威；Superset 不直接依赖 FineBI 数据资源或领星原始表。
- 业务事实只能来自 `ads.ads_pdm_lx_hot_product_index_sku_d` 与 `ads.ads_pdm_lx_hot_product_index_sku_m`；不新增 ADS 表，不在本仓库修复 ETL。
- 趋势、SPU/SKU 占比、颜色趋势和颜色分布响应全部 13 个全局筛选器；SPU 排行榜忽略年月筛选，只响应其余 12 个筛选器。
- 所有非日期时间字符串按既定缩写：`YYYY-MM-DD = ymd`、`YYYYWww = yw`、`YYYY-MM = ym`；不得使用 `biz_data` 命名。
- 全局可见数值最多 1 位小数；全部标题、表头、轴、图例、tooltip 和空状态使用中文业务名称，不暴露物理字段名。
- SPU 排行榜本月固定为 `MAX(data_through_date)` 所在自然月 MTD，上月固定为前一完整自然月；两期金额均使用美元。
- SPU 排行榜行粒度固定为 `水位月 + spu + sku_level`；同一 SPU 的多个最终评级必须拆行，禁止用 `MAX`、`MIN` 或任取一行合并评级。
- 排行榜评级进度色阶固定为 `[0,.2)` `#FF0000`、`[.2,.4)` `#EB8A3A`、`[.4,.6)` `#FFC947`、`[.6,.8)` `#00FF00`、`[.8,+∞)` `#0078FF`；负值和 NULL 不填色。
- SPU/SKU/颜色环图必须保留全部非空分类、不生成“其他”桶；生产全历史去重基数任一超过 1,000 时阻断发布。
- 三个目标环图中心固定显示“总销量”和格式化销量；Pie 未设置可选标签时继续使用现有翻译后的 Total 文案。
- 初始趋势图例只能通过静态 `Record<string, boolean>` 的 `legend.selected` 配置；继续拒绝函数、表达式和未授权 ECharts 属性。
- 所选月份覆盖不完整、排行榜两期覆盖不完整、必需 ADS 字段缺失或生产类别基数超限时快速失败；不得删指标、静默截断、回退原始表或返回静态样例。
- 保留当前工作树所有无关脏改动；每次只精确暂存本任务文件，禁止 `git add .`，禁止回退他人修改。
- 实现提交基线为设计提交 `28de9c9cc9`；执行前重新核对 `git status --short --branch` 和 `git rev-parse HEAD`。
- 生产交付必须从精确提交构建前端资产、重建镜像并重建 Superset 服务；仅导入 metadata 或同步文件不算完成。
- 最终声明完成前必须通过独立代码复核、9 个新增 Chart Data API、生产健康检查、Chrome 双视口验收和可执行回滚检查，并得到 `FINAL_COMPLETION_ALLOWED=YES`。

---

## File Structure

- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.tsx`
  - 负责 Pie `row_limit` 的统一规范化和可选中心总计标签控制；默认查询 100，最大 1,000，标签默认空。
- Create: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts`
  - 独立覆盖 Pie 默认值、边界值、字符串输入和最大值，不混入图表业务测试。
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/types.ts`
  - 为 Pie form data 增加可选 `totalLabel`，默认空字符串。
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts`
  - 设置标签时渲染标签和格式化总值，未设置时保留现有翻译文案。
- Modify: `superset-frontend/plugins/plugin-chart-echarts/test/Pie/transformProps.test.ts`
  - 覆盖“总销量”标签和默认 Total 行为。
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/utils/eChartOptionsSchema.ts`
  - 只为现有安全 schema 的 legend 增加静态布尔 selected map，不扩大可执行语法。
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts`
  - 覆盖静态 legend selected 保留和函数值继续拒绝。
- Modify: `superset-frontend/plugins/plugin-chart-echarts/test/MixedTimeseries/transformProps.test.ts`
  - 证明解析后的静态 selected map 会进入最终 ECharts legend，而不是只停留在 parser。
- Modify: `scripts/hot_product_index_dashboard.py`
  - 继续作为爆品指数 assets 的单一生成器；新增派生列、指标、排行榜 SQL、9 个图表、Tabs/Column 布局、筛选作用域和资产不变量。
- Create: `scripts/hot_product_index_remaining_charts_preflight.sql`
  - 只读生产门禁：ADS schema、两期覆盖、水位、SPU/SKU/颜色全历史基数。
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
  - 更新既有 bundle/UUID/主看板数量断言，确保原有 15 图行为不回归。
- Create: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`
  - 聚焦六组件的新 SQL、指标、图表参数、query context、布局、筛选作用域和格式合同。
- Modify: `docs/superpowers/specs/2026-08-08-hot-product-index-remaining-charts-design.md`
  - 仅在实现发现已批准规格文字与真实插件字段名存在机械差异时同步精确名称，不改变业务口径。
- Create during release: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-review.md`
  - 独立代码/规格审查门禁，末行必须是 `FRONTEND_BUILD_ALLOWED=YES`。
- Create during release: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-release.md`
  - 构建、备份、镜像、metadata、API、健康和回滚证据，末行必须是 `CHROME_ACCEPTANCE_ALLOWED=YES`。
- Create during release: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-browser.md`
  - Chrome/FineBI 对账与截图证据，末行必须是 `BROWSER_ACCEPTANCE=PASS`。
- Create during release: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-production-review.md`
  - 独立生产终审，末行必须是 `FINAL_COMPLETION_ALLOWED=YES`。

### Task 1: Extend Existing ECharts Controls Without Adding A Plugin

**Files:**

- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.tsx:20-23,300-315`
- Create: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts`
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/types.ts:20-70`
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts:145-185,470-485`
- Modify: `superset-frontend/plugins/plugin-chart-echarts/test/Pie/transformProps.test.ts:310-380`
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/utils/eChartOptionsSchema.ts:203-245`
- Modify: `superset-frontend/plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts:230-310`
- Modify: `superset-frontend/plugins/plugin-chart-echarts/test/MixedTimeseries/transformProps.test.ts`

**Interfaces:**

- Consumes: `ensureIsInt` from `@superset-ui/core`, the existing Pie `formDataOverrides` hook, `legendSchema`, and `safeParseEChartOptions`.
- Produces: `PIE_DEFAULT_ROW_LIMIT = 100`, `PIE_MAX_ROW_LIMIT = 1000`, `normalizePieRowLimit(value: unknown): number`, optional `totalLabel: string`, and safe static `legend.selected: Record<string, boolean>` parsing.

- [ ] **Step 1: Write the failing boundary tests**

Create the test with the ASF header and this exact table:

```ts
import { normalizePieRowLimit } from './controlPanel';

test.each([
  [undefined, 100],
  [null, 100],
  [99, 99],
  ['118', 118],
  [100, 100],
  [1000, 1000],
  [1001, 1000],
])('normalizePieRowLimit(%p) returns %p', (value, expected) => {
  expect(normalizePieRowLimit(value)).toBe(expected);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd superset-frontend
npm test -- plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts --runInBand
```

Expected: FAIL because `normalizePieRowLimit` is not exported.

- [ ] **Step 3: Add a failing safe-parser test for static legend selection**

Append this test to `safeEChartOptionsParser.test.ts`:

```ts
test('safeParseEChartOptions preserves a static legend selected map', () => {
  const result = safeParseEChartOptions(`{
    legend: {
      selected: {
        '爆品指数': true,
        '销量': false,
        '销售额': true
      }
    }
  }`);

  expect(result.legend).toEqual({
    selected: {
      爆品指数: true,
      销量: false,
      销售额: true,
    },
  });
});
```

Run:

```bash
cd superset-frontend
npm test -- \
  plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts \
  --runInBand
```

Expected: FAIL because `legendSchema` strips the unrecognized `selected` property.

- [ ] **Step 4: Add the minimal typed Pie normalizer and wire it into the override**

Use this implementation; do not add a new control or change the default:

```ts
export const PIE_DEFAULT_ROW_LIMIT = 100;
export const PIE_MAX_ROW_LIMIT = 1000;

export const normalizePieRowLimit = (value: unknown): number =>
  Math.min(ensureIsInt(value, PIE_DEFAULT_ROW_LIMIT), PIE_MAX_ROW_LIMIT);
```

Then change only these two existing locations:

```ts
row_limit: {
  default: PIE_DEFAULT_ROW_LIMIT,
},
```

```ts
row_limit: normalizePieRowLimit(formData.row_limit),
```

- [ ] **Step 5: Allow only a static boolean legend selected map**

Add this one property to `legendSchema`; do not use `z.unknown()` and do not relax the parser's function/expression guards:

```ts
selected: z.record(z.string(), z.boolean()).optional(),
```

Add a paired rejection assertion to the parser tests:

```ts
expect(() =>
  safeParseEChartOptions(`{
    legend: { selected: { sales: () => true } }
  }`),
).toThrow(EChartOptionsParseError);
```

- [ ] **Step 6: Add the optional Pie center-total label without changing its default**

Add `totalLabel?: string` to `EchartsPieFormData`, set `totalLabel: ''` in `DEFAULT_FORM_DATA`, and add this control directly after `show_total`:

```ts
{
  name: 'total_label',
  config: {
    type: 'TextControl',
    label: t('Total label'),
    default: '',
    renderTrigger: true,
    visibility: ({ controls }: ControlPanelsContainerProps) =>
      Boolean(controls?.show_total?.value),
  },
},
```

Destructure `totalLabel` in `transformProps` and replace only the graphic text expression; the custom label and value use two lines to match FineBI:

```ts
text: totalLabel
  ? `${totalLabel}\n${numberFormatter(totalValue)}`
  : t('Total: %s', numberFormatter(totalValue)),
```

Extend the existing Total positioning tests:

```ts
test('uses a custom total label without changing the formatted value', () => {
  const props = getChartPropsWithLegend(true, true, 'right', true);
  props.formData.totalLabel = '总销量';

  const graphic = transformProps(props).echartOptions.graphic as {
    style: { text: string };
  };
  expect(graphic.style.text).toBe('总销量\n25');
});
```

Keep the existing assertion containing `Total:` to prove the empty default remains unchanged.

- [ ] **Step 7: Prove Mixed Timeseries applies the selected map**

Add this transform test using the file's existing `formData`, defaults, and helper:

```ts
test('custom ECharts options set the initial mixed-timeseries legend state', () => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    ...MIXED_TIMESERIES_CHART_PROPS_DEFAULTS,
    formData: {
      ...formData,
      showLegend: true,
      echartOptions: `{
        legend: {
          selected: {
            '爆品指数': true,
            '销量': false,
            '销售额': true
          }
        }
      }`,
    },
  });

  const legend = transformProps(chartProps).echartOptions.legend as {
    selected?: Record<string, boolean>;
  };
  expect(legend.selected).toEqual({
    爆品指数: true,
    销量: false,
    销售额: true,
  });
});
```

- [ ] **Step 8: Run focused ECharts verification**

Run:

```bash
cd superset-frontend
npm test -- \
  plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts \
  plugins/plugin-chart-echarts/test/Pie/buildQuery.test.ts \
  plugins/plugin-chart-echarts/test/Pie/transformProps.test.ts \
  plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts \
  plugins/plugin-chart-echarts/test/MixedTimeseries/transformProps.test.ts \
  --runInBand
npx tsc --noEmit -p plugins/plugin-chart-echarts/tsconfig.json
```

Expected: all Jest suites PASS and TypeScript exits 0.

- [ ] **Step 9: Commit only the two narrow frontend changes**

```bash
git add \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/types.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts \
  superset-frontend/plugins/plugin-chart-echarts/test/Pie/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/utils/eChartOptionsSchema.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts \
  superset-frontend/plugins/plugin-chart-echarts/test/MixedTimeseries/transformProps.test.ts
git diff --cached --check
git commit -m "fix(echarts): support complete hot-product views"
```

### Task 2: Extend The Daily Semantic Dataset For Trend And Color Analysis

**Files:**

- Modify: `scripts/hot_product_index_dashboard.py:61-246,473-489,1230-1355`
- Create: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**

- Consumes: `_daily_sql()`, `_column()`, `_metric()`, `DAILY_SOURCE_COLUMNS`, and the accepted ADS fields `sales_date`, `ym`, `color`, `sales_qty`, `sales_amount_usd`, `gross_profit_usd`, `return_goods_qty`, `order_qty`, `sku`, `spu`.
- Produces: daily calculated columns `week_start_date: DATE`, `yw: STRING`, `color_code: STRING`; saved metrics `avg_daily_sales_qty_period`, `return_goods_qty_total`, `order_qty_total`, `in_sale_sku_count_period`, `in_sale_spu_count_period`, `sales_amount_usd_wan`, and `gross_profit_usd_wan`.

- [ ] **Step 1: Add failing semantic-contract tests**

Create the new test file with the existing `read_bundle`/`assets_by_key` import pattern and assert:

```python
def test_daily_dataset_exposes_trend_and_color_semantics(tmp_path: Path) -> None:
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    daily = assets_by_key(assets, "datasets", "table_name")["爆品指数-日明细"]
    columns = {item["column_name"]: item for item in daily["columns"]}
    metrics = {item["metric_name"]: item for item in daily["metrics"]}

    assert columns["week_start_date"]["verbose_name"] == "周一日期"
    assert columns["week_start_date"]["is_dttm"] is True
    assert columns["yw"]["verbose_name"] == "年周"
    assert columns["color_code"]["verbose_name"] == "颜色代码"
    assert "DATE_SUB(d.sales_date, INTERVAL WEEKDAY(d.sales_date) DAY)" in daily["sql"]
    assert "DATE_FORMAT(d.sales_date, '%xW%v') AS yw" in daily["sql"]
    assert "NULLIF(TRIM(SUBSTRING_INDEX(d.color, '-', -1)), '') AS color_code" in daily["sql"]
    assert "d.sales_date >= v.selected_start_date" in daily["sql"]
    assert "d.sales_date < v.effective_end_exclusive_date" in daily["sql"]

    assert metrics["avg_daily_sales_qty_period"]["expression"] == (
        "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date), 0)"
    )
    assert metrics["return_goods_qty_total"]["expression"] == "SUM(return_goods_qty)"
    assert metrics["order_qty_total"]["expression"] == "SUM(order_qty)"
    assert metrics["in_sale_sku_count_period"]["expression"] == "COUNT(DISTINCT sku)"
    assert metrics["in_sale_spu_count_period"]["expression"] == "COUNT(DISTINCT spu)"
    assert metrics["sales_amount_usd_wan"]["expression"] == (
        "SUM(sales_amount_usd) / 10000.0"
    )
    assert metrics["gross_profit_usd_wan"]["expression"] == (
        "SUM(gross_profit_usd) / 10000.0"
    )
```

Add a second test that asserts every new metric `verbose_name` is Chinese and each `d3format` is one of `,.0f`, `,.1~f`, or `.1~%`.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
```

Expected: FAIL on missing `week_start_date`, `yw`, and `color_code`.

- [ ] **Step 3: Add the three calculated columns to `_daily_sql()` and metadata**

Append these aliases after `_source_select_list("d", DAILY_SOURCE_COLUMNS)` and before coverage columns:

```python
selected.extend(
    (
        "DATE_SUB(d.sales_date, INTERVAL WEEKDAY(d.sales_date) DAY) "
        "AS week_start_date",
        "DATE_FORMAT(d.sales_date, '%xW%v') AS yw",
        "NULLIF(TRIM(SUBSTRING_INDEX(d.color, '-', -1)), '') AS color_code",
    )
)
```

Add exact Chinese metadata:

```python
"week_start_date": "周一日期",
"yw": "年周",
"color_code": "颜色代码",
```

Add `_column("week_start_date", "DATE", is_dttm=True)`, `_column("yw", "STRING")`, and `_column("color_code", "STRING")` to `daily_columns`.

- [ ] **Step 4: Add the seven metrics without changing existing KPI metrics**

Append these `_metric()` definitions to `daily_metrics`:

```python
_metric("avg_daily_sales_qty_period", "日均销量",
        "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date), 0)",
        ",.1~f", "时间桶销量除以时间桶内有效自然日数。"),
_metric("return_goods_qty_total", "退货量", "SUM(return_goods_qty)",
        ",.0f", "时间桶内退货数量。"),
_metric("order_qty_total", "订单量", "SUM(order_qty)",
        ",.0f", "时间桶内订单数量。"),
_metric("in_sale_sku_count_period", "在售SKU数", "COUNT(DISTINCT sku)",
        ",.0f", "时间桶内满足资格的SKU去重数。"),
_metric("in_sale_spu_count_period", "在售SPU数", "COUNT(DISTINCT spu)",
        ",.0f", "时间桶内满足资格的SPU去重数。"),
_metric("sales_amount_usd_wan", "销售额", "SUM(sales_amount_usd) / 10000.0",
        ",.1~f", "美元销售额按万美元显示，底层事实不降精度。"),
_metric("gross_profit_usd_wan", "毛利润", "SUM(gross_profit_usd) / 10000.0",
        ",.1~f", "美元毛利润按万美元显示，底层事实不降精度。"),
```

Do not replace `avg_daily_sales_qty`; it remains the KPI metric for the complete selected interval.

- [ ] **Step 5: Run focused Python tests**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py
```

Expected: new semantic tests PASS; existing bundle count tests may still fail because Tasks 3-6 have not updated the final asset totals. No SQL/metric regression failure is allowed.

- [ ] **Step 6: Commit the semantic slice**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git diff --cached --check
git commit -m "feat(dashboard): add trend and color semantics"
```

### Task 3: Add The Watermark-Anchored SPU Leaderboard Dataset And Preflight Gates

**Files:**

- Modify: `scripts/hot_product_index_dashboard.py:36-158,562-586,869-1434`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`
- Create: `scripts/hot_product_index_remaining_charts_preflight.sql`

**Interfaces:**

- Consumes: `FILTERS`, `MONTHLY_SOURCE_COLUMNS`, `DETAIL_REQUIRED_COLUMNS`, `_dataset`, `_column`, `_metric`, and Doris Jinja `get_filters(column, remove_filter=True)`.
- Produces: `_native_filter_fragment(alias: str, columns: Sequence[str] | None = None) -> str`, `_leaderboard_sql() -> str`, `_leaderboard_columns() -> list[Asset]`, `_leaderboard_metrics() -> Sequence[Asset]`, dataset UUID `2b5c33b2-2af6-5436-8b3d-e7292e5a64ae`.

- [ ] **Step 1: Write failing leaderboard SQL and metadata tests**

Add tests that require the new dataset and fixed UUID:

```python
leaderboard = datasets["爆品指数-SPU销量排行榜"]
assert leaderboard["uuid"] == "2b5c33b2-2af6-5436-8b3d-e7292e5a64ae"
assert leaderboard["main_dttm_col"] == "watermark_month_start_date"
assert "get_time_filter(" not in leaderboard["sql"]
for _, column in FILTERS:
    assert leaderboard["sql"].count(
        f"get_filters('{column}', remove_filter=True)"
    ) == 2
assert "spu_previous_month_sales_amount_cny" not in leaderboard["sql"]
assert "SUM(m.sales_amount_usd)" in leaderboard["sql"]
assert "GROUP BY m.spu, m.spu_previous_month_sales_level, m.sku_level" in leaderboard["sql"]
assert "DAY(a.data_through_date) / DAY(LAST_DAY(a.data_through_date))" in leaderboard["sql"]
```

Also assert output labels are exactly `SPU`, `SPU评级`, `最终评级`, `上月销售额`, `本月销量额`, `本月评级达标进度`, `本月时间达标进度`.

Add a preflight schema-contract test so the SQL cannot silently check only the recently added fields:

```python
preflight = Path("scripts/hot_product_index_remaining_charts_preflight.sql").read_text()
for table_name, source_columns in (
    ("ads_pdm_lx_hot_product_index_sku_d", DAILY_SOURCE_COLUMNS),
    ("ads_pdm_lx_hot_product_index_sku_m", MONTHLY_SOURCE_COLUMNS),
):
    assert table_name in preflight
    assert all(f"'{column_name}'" in preflight for column_name, _ in source_columns)
```

- [ ] **Step 2: Run the leaderboard tests and verify RED**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  -k leaderboard
```

Expected: FAIL because the dataset is absent.

- [ ] **Step 3: Generalize the existing equality-only filter fragment**

Rename `_detail_filter_fragment` to `_native_filter_fragment` and give it this signature:

```python
def _native_filter_fragment(
    alias: str,
    columns: Sequence[str] | None = None,
) -> str:
    """Render fail-fast IN/NOT IN predicates consumed inside virtual SQL."""
    filter_columns = columns or tuple(name for _, name in FILTERS)
```

Retain the existing `IN`, `NOT IN`, `where_in`, `remove_filter=True`, and unsupported-operator `raise` branches byte-for-byte. Change `_detail_sql()` to call `_native_filter_fragment("d")`; this must not alter existing detail SQL behavior.

- [ ] **Step 4: Implement `_leaderboard_sql()` with explicit two-period coverage**

Build these CTEs in this order:

```sql
WITH watermark AS (
  SELECT MAX(data_through_date) AS data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
),
anchor AS (
  SELECT data_through_date,
         DATE_TRUNC(data_through_date, 'month') AS watermark_month_start_date,
         DATE_FORMAT(data_through_date, '%Y-%m') AS current_ym,
         DATE_FORMAT(DATE_SUB(DATE_TRUNC(data_through_date, 'month'), INTERVAL 1 MONTH), '%Y-%m') AS previous_ym
  FROM watermark
),
daily_quality AS (
  SELECT
    COUNT(DISTINCT CASE WHEN d.ym = a.current_ym THEN d.sales_date END) AS current_days,
    COUNT(DISTINCT CASE WHEN d.ym = a.previous_ym THEN d.sales_date END) AS previous_days
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d CROSS JOIN anchor a
  WHERE d.ym IN (a.current_ym, a.previous_ym)
),
monthly_quality AS (
  SELECT COUNT(DISTINCT m.ym) AS monthly_months
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m CROSS JOIN anchor a
  WHERE m.ym IN (a.current_ym, a.previous_ym)
),
quality AS (
  SELECT a.*,
    CASE WHEN q.current_days = DAY(a.data_through_date)
      AND q.previous_days = DAY(LAST_DAY(DATE_SUB(a.watermark_month_start_date, INTERVAL 1 MONTH)))
      AND m.monthly_months = 2 THEN 1 ELSE 0 END AS coverage_complete
  FROM anchor a CROSS JOIN daily_quality q CROSS JOIN monthly_quality m
),
current_filtered AS (
  SELECT m.*
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN quality q
  WHERE q.coverage_complete = 1
    AND m.ym = q.current_ym
    AND m.is_eligible = 1
),
previous_filtered AS (
  SELECT m.*
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN quality q
  WHERE q.coverage_complete = 1
    AND m.ym = q.previous_ym
    AND m.is_eligible = 1
),
current_rows AS (
  SELECT m.spu,
         m.spu_previous_month_sales_level AS spu_rating,
         m.sku_level AS final_rating,
         SUM(m.sales_amount_usd) AS current_month_sales_amount_usd
  FROM current_filtered m
  GROUP BY m.spu, m.spu_previous_month_sales_level, m.sku_level
),
previous_rows AS (
  SELECT m.spu, SUM(m.sales_amount_usd) AS previous_month_sales_amount_usd
  FROM previous_filtered m GROUP BY m.spu
)
```

Inject `_native_filter_fragment("m")` separately into `current_filtered` and `previous_filtered`, then finish with:

```sql
SELECT
  q.watermark_month_start_date,
  q.current_ym AS ym,
  c.spu,
  c.spu_rating,
  c.final_rating,
  p.previous_month_sales_amount_usd,
  c.current_month_sales_amount_usd,
  c.current_month_sales_amount_usd /
    NULLIF(p.previous_month_sales_amount_usd, 0) AS rating_progress,
  (c.current_month_sales_amount_usd /
    NULLIF(p.previous_month_sales_amount_usd, 0)) /
    NULLIF(DAY(q.data_through_date) / DAY(LAST_DAY(q.data_through_date)), 0)
    AS time_progress,
  q.coverage_complete
FROM current_rows c
LEFT JOIN previous_rows p ON c.spu <=> p.spu
CROSS JOIN quality q
WHERE q.coverage_complete = 1
```

Use a decimal cast or `10000.0`-style decimal literal if Doris integer division inspection shows the day fraction is truncated; do not add a fallback path.

- [ ] **Step 5: Add leaderboard metadata and saved metrics**

Add the dataset UUID to `UUIDS`, add Chinese labels to `COLUMN_VERBOSE_NAMES`, declare the seven visible output columns plus `ym`, `watermark_month_start_date`, `coverage_complete`, and all 12 filter columns. Add saved metrics:

```python
_metric("previous_month_sales_amount_usd", "上月销售额",
        "MAX(previous_month_sales_amount_usd)", "$,.1~f", "上一完整月美元销售额。"),
_metric("current_month_sales_amount_usd", "本月销量额",
        "MAX(current_month_sales_amount_usd)", "$,.1~f", "水位月MTD美元销售额。"),
_metric("rating_progress", "本月评级达标进度",
        "MAX(rating_progress)", ".1~%", "本月销售额除以上月销售额。"),
_metric("time_progress", "本月时间达标进度",
        "MAX(time_progress)", ".1~%", "评级进度除以水位月时间进度。"),
```

Register `datasets/Doris_ling_xing/Hot_Product_Index_SPU_Leaderboard.yaml` with table name `爆品指数-SPU销量排行榜`.

- [ ] **Step 6: Add the executable read-only production preflight SQL**

The SQL file must return four result sets:

```sql
-- 1. Missing required columns; release requires zero rows.
SELECT required.table_name, required.column_name
FROM (
  SELECT 'ads_pdm_lx_hot_product_index_sku_d' AS table_name, 'order_qty' AS column_name
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'score'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'actual_stock_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'order_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'score'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'actual_stock_qty'
) required
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'ads'
 AND actual.table_name = required.table_name
 AND actual.column_name = required.column_name
WHERE actual.column_name IS NULL;

-- 2. Full eligible-history category cardinality; every value must be <= 1000.
WITH eligible AS (
  SELECT spu, sku,
         NULLIF(TRIM(SUBSTRING_INDEX(color, '-', -1)), '') AS color_code
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
  WHERE is_eligible = 1
)
SELECT 'spu' AS dimension_name, COUNT(DISTINCT spu) AS distinct_count FROM eligible WHERE spu IS NOT NULL
UNION ALL
SELECT 'sku', COUNT(DISTINCT sku) FROM eligible WHERE sku IS NOT NULL
UNION ALL
SELECT 'color_code', COUNT(DISTINCT color_code) FROM eligible WHERE color_code IS NOT NULL;

-- 3. Watermark and current/previous month day coverage.
WITH watermark AS (
  SELECT MAX(data_through_date) AS data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
),
anchor AS (
  SELECT
    data_through_date,
    DATE_FORMAT(data_through_date, '%Y-%m') AS current_ym,
    DATE_FORMAT(
      DATE_SUB(DATE_TRUNC(data_through_date, 'month'), INTERVAL 1 MONTH),
      '%Y-%m'
    ) AS previous_ym
  FROM watermark
),
daily_quality AS (
  SELECT
    COUNT(DISTINCT CASE
      WHEN d.ym = a.current_ym THEN d.sales_date END
    ) AS current_day_count,
    COUNT(DISTINCT CASE
      WHEN d.ym = a.previous_ym THEN d.sales_date END
    ) AS previous_day_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN anchor a
  WHERE d.ym IN (a.current_ym, a.previous_ym)
),
monthly_quality AS (
  SELECT COUNT(DISTINCT m.ym) AS monthly_month_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN anchor a
  WHERE m.ym IN (a.current_ym, a.previous_ym)
)
SELECT
  a.data_through_date,
  a.current_ym,
  a.previous_ym,
  d.current_day_count,
  DAY(a.data_through_date) AS expected_current_days,
  d.previous_day_count,
  DAY(LAST_DAY(
    DATE_SUB(DATE_TRUNC(a.data_through_date, 'month'), INTERVAL 1 MONTH)
  )) AS expected_previous_days,
  m.monthly_month_count
FROM anchor a
CROSS JOIN daily_quality d
CROSS JOIN monthly_quality m;

-- 4. ISO week cross-year contract; release requires 2026W01, 2026W01, 2026W02.
SELECT
  DATE_FORMAT(CAST('2025-12-29' AS DATE), '%xW%v') AS monday_yw,
  DATE_FORMAT(CAST('2026-01-04' AS DATE), '%xW%v') AS sunday_yw,
  DATE_FORMAT(CAST('2026-01-05' AS DATE), '%xW%v') AS next_monday_yw;
```

Expand the first query's `required` subquery to enumerate every column in `DAILY_SOURCE_COLUMNS` and `MONTHLY_SOURCE_COLUMNS`; the six visible rows above establish the UNION shape, while the schema-contract test enforces complete one-to-one coverage with the generator constants.

Write the third query with the same anchor expressions as `_leaderboard_sql()`; release requires equality for both day counts and `monthly_month_count = 2`. The fourth query proves ISO year/week behavior independently of dashboard rendering; selected-range clipping remains enforced by `_daily_sql()` before the `yw` grouping.

- [ ] **Step 7: Run SQL contract and existing detail regression tests**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  -k "leaderboard or detail_sql or dataset"
git diff --check
```

Expected: leaderboard and detail SQL tests PASS; no CNY field appears in leaderboard math.

- [ ] **Step 8: Commit the dataset gate**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  scripts/hot_product_index_remaining_charts_preflight.sql \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git diff --cached --check
git commit -m "feat(dashboard): add SPU leaderboard dataset"
```

### Task 4: Generate The Nine Standard Chart Assets And Executable Query Contexts

**Files:**

- Modify: `scripts/hot_product_index_dashboard.py:36-60,1437-1843`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**

- Consumes: dataset UUIDs, daily metrics from Task 2, leaderboard dataset/metrics from Task 3, `_chart()`, `_table_query_context()`, and existing ECharts query-builder conventions.
- Produces: `_mixed_timeseries_query_context()`, `_timeseries_query_context()`, `_pie_query_context()`, `_trend_params(grain)`, `_pie_params(groupby, *, legend_type)`, `_color_trend_params(grain)`, `_leaderboard_chart_params()`, and 9 fixed chart assets.

- [ ] **Step 1: Add failing fixed-identity and chart-parameter tests**

Assert these exact UUIDs and titles:

```python
expected = {
    "指标整体趋势-天": "582d0460-8034-5a12-9f27-4de03b050cd4",
    "指标整体趋势-周": "d3504cb6-8abf-5d22-807b-326948e6b79b",
    "指标整体趋势-月": "8f36f17e-c95c-5076-9090-24652b22bb00",
    "SPU销售比例": "a5fc632c-e635-5cf0-8270-f9a1d135c664",
    "SKU销售比例": "7dbc534e-5c09-52e5-8dfa-0d42ddb44576",
    "SPU销量排行榜": "d35f4185-5103-5e75-85c7-2cfa7ae83731",
    "颜色销售比例-周": "90eed32b-5a2c-5cd5-8d6e-b38d98c720b8",
    "颜色销售比例-月": "267d5d23-3a69-5f8a-aca0-15b0020c9599",
    "颜色销量分布": "e77069a0-1a40-583b-bae5-5ccba309c34b",
}
assert {name: charts[name]["uuid"] for name in expected} == expected
```

For the three trend charts, assert `viz_type == "mixed_timeseries"`, `x_axis` equals `sales_date`/`yw`/`ym`, Query A contains the 9 non-money metrics, Query B contains `sales_amount_usd_wan` and `gross_profit_usd_wan`, `yAxisIndex == 0`, `yAxisIndexB == 1`, and the custom legend selects only `爆品指数`, `销售额`, `毛利润`.

For each Pie, assert `row_limit == 1000`, `threshold_for_other == 0`, `sort_by_metric is True`, `donut is True`, `show_total is True`, `total_label == "总销量"`, `label_type == "key_percent"`, and `number_format == ",.0f"`.

For the leaderboard, assert exact displayed column order, server page length 50, no total row, no toolbar/search, stable order, and five conditional-formatting rules.

- [ ] **Step 2: Run chart tests and verify RED**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  -k "chart or trend or pie or color"
```

Expected: FAIL because the 9 chart assets do not exist.

- [ ] **Step 3: Add fixed chart UUID keys and parameter builders**

Add the ten UUID constants from Tasks 3 and 4 to `UUIDS`. Implement trend params with this metric order:

```python
TREND_PRIMARY_METRICS: Final = (
    "hot_product_index",
    "sales_qty_total",
    "avg_daily_sales_qty_period",
    "return_goods_qty_total",
    "order_qty_total",
    "in_sale_sku_count_period",
    "in_sale_spu_count_period",
    "return_rate",
    "gross_margin",
)
TREND_SECONDARY_METRICS: Final = (
    "sales_amount_usd_wan",
    "gross_profit_usd_wan",
)
```

Set `seriesType`/`seriesTypeB` to `line`, both `show_value` flags true, `y_axis_format`/secondary to `,.1~f`, secondary title to `金额（万美元）`, and:

```python
"echart_options": json.dumps(
    {"legend": {"selected": {
        "爆品指数": True,
        "销量": False,
        "日均销量": False,
        "退货量": False,
        "订单量": False,
        "在售SKU数": False,
        "在售SPU数": False,
        "退货率": False,
        "毛利率": False,
        "销售额": True,
        "毛利润": True,
    }}},
    ensure_ascii=False,
),
```

Use `sales_date`, `yw`, and `ym` as the three x-axis fields; do not use system calendar fill or read outside the virtual dataset's selected range.

- [ ] **Step 4: Add Pie and color-trend parameter builders**

Use a single Pie helper:

```python
def _pie_params(groupby: str, *, legend_type: str) -> Asset:
    return {
        "adhoc_filters": [],
        "color_scheme": "supersetColors",
        "donut": True,
        "groupby": [groupby],
        "innerRadius": 58,
        "label_line": True,
        "label_type": "key_percent",
        "labels_outside": True,
        "legendOrientation": "bottom",
        "legendType": legend_type,
        "metric": "sales_qty_total",
        "number_format": ",.0f",
        "outerRadius": 78,
        "row_limit": 1000,
        "show_labels": True,
        "show_legend": True,
        "show_total": True,
        "total_label": "总销量",
        "sort_by_metric": True,
        "threshold_for_other": 0,
        "time_range": "Current month",
        "viz_type": "pie",
    }
```

Use `legend_type="scroll"` for SKU and `plain` for SPU/color. Color trend uses `viz_type="echarts_timeseries_line"`, x-axis `yw` or `ym`, groupby `color_code`, metric `sales_qty_total`, integer labels, `series_limit=1000`, and `row_limit=100000`.

- [ ] **Step 5: Add the leaderboard AG Grid params**

Use:

```python
groupby = ["spu", "spu_rating", "final_rating"]
metrics = [
    "previous_month_sales_amount_usd",
    "current_month_sales_amount_usd",
    "rating_progress",
    "time_progress",
]
orderby = [
    ["current_month_sales_amount_usd", False],
    ["spu", True],
    ["final_rating", True],
]
```

The displayed columns are groupby followed by metrics. Set `advanced_filter_enabled=False`, `column_view_schemes_enabled=False`, `include_search=False`, `show_totals=False`, `server_pagination=True`, `server_page_length=50`, `row_limit=100000`, and `time_range="No filter"`.

Build condition rules with `≤ x <` for the first four ranges and `≥` for 0.8; set `nullValue="-"`, money format `$,.1~f`, percentage format `.1~%`, and never define a negative-value rule.

The test must compare the complete rule list:

```python
assert params["conditional_formatting"] == [
    {"column": "rating_progress", "operator": "≤ x <",
     "targetValueLeft": 0, "targetValueRight": 0.2,
     "colorScheme": "#FF0000", "useGradient": False},
    {"column": "rating_progress", "operator": "≤ x <",
     "targetValueLeft": 0.2, "targetValueRight": 0.4,
     "colorScheme": "#EB8A3A", "useGradient": False},
    {"column": "rating_progress", "operator": "≤ x <",
     "targetValueLeft": 0.4, "targetValueRight": 0.6,
     "colorScheme": "#FFC947", "useGradient": False},
    {"column": "rating_progress", "operator": "≤ x <",
     "targetValueLeft": 0.6, "targetValueRight": 0.8,
     "colorScheme": "#00FF00", "useGradient": False},
    {"column": "rating_progress", "operator": "≥",
     "targetValue": 0.8, "colorScheme": "#0078FF", "useGradient": False},
]
```

- [ ] **Step 6: Implement executable query contexts for the three ECharts families**

Refactor `_query_context()` into explicit branches:

```python
if viz_type == "mixed_timeseries":
    return _mixed_timeseries_query_context(params)
if viz_type == "echarts_timeseries_line":
    return _timeseries_query_context(params)
if viz_type == "pie":
    return _pie_query_context(params)
```

Each context must keep `datasource={"id": 0, "type": "table"}` and `form_data.datasource="0__table"`. Mixed Timeseries emits exactly two queries; both include the same x-axis, Query A/B metrics, `series_columns`, pivot/resample/rename/flatten post-processing, selected time range, and their own row limit. Timeseries emits one query with x-axis plus `color_code`, `series_columns=["color_code"]`, metric, pivot/resample/rename/flatten operations. Pie emits one query with the groupby, metric, descending metric order, and a `contribution` post-processing operator for the metric label.

The tests must deserialize every `query_context` and assert these shapes rather than compare raw JSON strings.

- [ ] **Step 7: Register all nine charts and run focused tests**

Add 9 deterministic paths under `charts/Hot_Product_Index_*.yaml`, using the daily dataset for all except the leaderboard. Then run:

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
```

Expected: chart/SQL/query-context tests PASS; bundle total assertions remain for Task 6.

- [ ] **Step 8: Commit the chart assets**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git diff --cached --check
git commit -m "feat(dashboard): add remaining hot-product charts"
```

### Task 5: Append The Six-Component Layout And Exact Filter Scopes

**Files:**

- Modify: `scripts/hot_product_index_dashboard.py:1845-2440`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**

- Consumes: 9 chart UUIDs from Task 4, `_chart_node()`, `_row()`, existing `TABS-DETAIL`, `_select_filter()`, `_month_filter()`, and existing dashboard CSS.
- Produces: generic `_tab(tab_id, text, children, *, tabs_id, parent_ids)`, `_column(column_id, children, *, width, parent_ids)`, `TABS-TREND`, `TABS-COLOR-TREND`, 23 main chart nodes, 13 native filters with exact leaderboard exclusion.

- [ ] **Step 1: Add failing layout and scope tests**

Assert the grid ends in these two rows after the existing detail Tabs:

```python
assert position["GRID_ID"]["children"][-2:] == [
    "ROW-ANALYSIS-PRIMARY",
    "ROW-ANALYSIS-SHARES",
]
assert position["ROW-ANALYSIS-PRIMARY"]["children"] == [
    "COLUMN-TREND",
    "COLUMN-LEADERBOARD",
]
assert position["COLUMN-TREND"]["meta"]["width"] == 8
assert position["COLUMN-LEADERBOARD"]["meta"]["width"] == 4
assert position["TABS-TREND"]["children"] == [
    "TAB-TREND-DAY", "TAB-TREND-WEEK", "TAB-TREND-MONTH"
]
assert [position[key]["meta"]["text"] for key in position["TABS-TREND"]["children"]] == [
    "天", "周", "月"
]
assert position["ROW-ANALYSIS-SHARES"]["children"] == [
    "CHART-SPU-SHARE",
    "CHART-SKU-SHARE",
    "COLUMN-COLOR-TREND",
    "CHART-COLOR-DISTRIBUTION",
]
assert position["COLUMN-COLOR-TREND"]["meta"]["width"] == 3
```

Assert all four second-row visible components occupy 3/12 and every nested chart has the complete parent chain.

For filters, assert all 12 select filters include the leaderboard chart UUID and leaderboard dataset target. Assert the month filter excludes the leaderboard UUID from `chartsInScope` and has no leaderboard dataset target. Assert every other new chart is in both select and month filter scope.

- [ ] **Step 2: Run layout tests and verify RED**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  -k "layout or filter_scope"
```

Expected: FAIL because the new nodes and scopes are absent.

- [ ] **Step 3: Generalize Tabs and add a reusable Column node**

Change `_tab` to:

```python
def _tab(
    tab_id: str,
    text: str,
    children: Sequence[str],
    *,
    tabs_id: str,
    parent_ids: Sequence[str] | None = None,
) -> Asset:
```

Build parents as `[*parent_ids or ("ROOT_ID", "GRID_ID"), tabs_id]`. Update existing detail callers to pass `tabs_id="TABS-DETAIL"` so the current layout remains identical.

Add:

```python
def _column(
    column_id: str,
    children: Sequence[str],
    *,
    width: int,
    parent_ids: Sequence[str],
) -> Asset:
    return {
        "children": list(children),
        "id": column_id,
        "meta": {"background": "BACKGROUND_TRANSPARENT", "width": width},
        "parents": list(parent_ids),
        "type": "COLUMN",
    }
```

- [ ] **Step 4: Append the primary and share rows**

Use Column wrappers so Tabs and leaderboard can share the 8/4 row:

```text
ROW-ANALYSIS-PRIMARY
  COLUMN-TREND width=8
    TABS-TREND
      TAB-TREND-DAY -> ROW-TREND-DAY -> CHART-TREND-DAY
      TAB-TREND-WEEK -> ROW-TREND-WEEK -> CHART-TREND-WEEK
      TAB-TREND-MONTH -> ROW-TREND-MONTH -> CHART-TREND-MONTH
  COLUMN-LEADERBOARD width=4
    CHART-SPU-LEADERBOARD

ROW-ANALYSIS-SHARES
  CHART-SPU-SHARE width=3
  CHART-SKU-SHARE width=3
  COLUMN-COLOR-TREND width=3
    TABS-COLOR-TREND
      TAB-COLOR-WEEK -> ROW-COLOR-WEEK -> CHART-COLOR-WEEK
      TAB-COLOR-MONTH -> ROW-COLOR-MONTH -> CHART-COLOR-MONTH
  CHART-COLOR-DISTRIBUTION width=3
```

Give trend and leaderboard height 56, second-row charts height 52, and all nested charts width 12 inside their Columns/Tabs. Use deterministic import chart IDs 1014 through 1022 in the same order as Task 4 UUIDs.

- [ ] **Step 5: Extend select-filter targets and exclude only leaderboard from month scope**

Add leaderboard dataset as the fifth target of each `_select_filter()` and include all 9 new chart UUIDs in `business_chart_uuids`.

Define:

```python
leaderboard_uuid = UUIDS["chart_spu_leaderboard"]
month_scoped_chart_uuids = [
    UUIDS["chart_status"],
    *(uuid for uuid in business_chart_uuids if uuid != leaderboard_uuid),
]
```

Pass `month_scoped_chart_uuids` to `_month_filter()`. Do not add leaderboard to month filter targets. All other 8 new charts inherit the daily month target.

- [ ] **Step 6: Add narrowly scoped visual CSS**

Add only selectors rooted at `#TABS-TREND`, `#TABS-COLOR-TREND`, and `#CHART-SPU-LEADERBOARD`. Reuse the existing blue active-tab color `#2978B5`, green table header `#8AA964`, and alternating green row fills. Do not change the existing SPU/SKU detail selectors and do not add page-wide card styles.

- [ ] **Step 7: Run layout/filter/CSS tests**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  -k "layout or filter or css or dashboard"
```

Expected: all selected tests PASS.

- [ ] **Step 8: Commit the presentation slice**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git diff --cached --check
git commit -m "feat(dashboard): lay out remaining hot-product analysis"
```

### Task 6: Lock Asset Counts, Formats, Determinism, And Scope Exclusions

**Files:**

- Modify: `scripts/hot_product_index_dashboard.py:1670-1843,2504-2575`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py:49-120,800-970,1020-1060`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`
- Modify: `docs/superpowers/specs/2026-08-08-hot-product-index-remaining-charts-design.md`

**Interfaces:**

- Consumes: all Task 1-5 assets.
- Produces: final deterministic contract of 6 datasets, 24 charts, 2 dashboards, 32 unique UUIDs, and 23 main-dashboard charts.

- [ ] **Step 1: Update existing count tests and add exact scope exclusions**

Change existing assertions from `(5, 15, 2)` to `(6, 24, 2)`, unique UUID count from 22 to 32, and main chart count from 14 to 23. Keep the existing 9 KPI, 2 funnel, 1 status, and 2 detail assertions, then add:

```python
assert sum(chart["viz_type"] == "mixed_timeseries" for chart in main_charts) == 3
assert sum(chart["viz_type"] == "pie" for chart in main_charts) == 3
assert sum(chart["viz_type"] == "echarts_timeseries_line" for chart in main_charts) == 2
assert sum(chart["viz_type"] == "ag-grid-table-scheme" for chart in main_charts) == 3
assert not {
    "国家维度", "SPU开发经理", "型号维度", "渠道维度"
} & charts.keys()
```

- [ ] **Step 2: Run complete generator tests and verify the intended failures**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
```

Expected before validator edits: FAIL only on old asset invariants.

- [ ] **Step 3: Update `validate_assets()` fail-fast invariants**

Require exactly `(6, 24, 2)`, 32 UUIDs, and 23 main chart nodes. Update the error messages to enumerate the approved composition. Add explicit validation that:

```python
new_chart_keys = (
    "chart_trend_day", "chart_trend_week", "chart_trend_month",
    "chart_spu_share", "chart_sku_share", "chart_spu_leaderboard",
    "chart_color_trend_week", "chart_color_trend_month",
    "chart_color_distribution",
)
```

all exist once in the main position, the leaderboard UUID is absent from the month filter, and every other new UUID is present.

- [ ] **Step 4: Extend the guide with the six approved contracts**

Add concise Chinese sections to `_guide_chart_params()` covering:

1. 趋势 11 指标与天/ISO 周/月。
2. 排行榜水位月 MTD、上一完整月、统一美元和两种进度。
3. SPU/SKU 环图按销量占比。
4. 颜色代码取最后一个 `-` 后文本。

Do not describe excluded detail Tabs or expose physical field names beyond the existing ADS source paragraph.

- [ ] **Step 5: Verify number formats, labels, and deterministic output**

Add tests that every new visible numeric field uses `,.0f`, `,.1~f`, `$,.1~f`, or `.1~%`; every new dataset column has a nonempty Chinese `verbose_name`; every new chart path and UUID is stable; two generated ZIP files are byte-identical.

Run:

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
/private/tmp/superset-hot-product-venv/bin/python scripts/hot_product_index_dashboard.py \
  --output /private/tmp/hot-product-index-remaining-charts.zip
unzip -t /private/tmp/hot-product-index-remaining-charts.zip
git diff --check
```

Expected: all tests PASS, ZIP integrity PASS, generated inventory reports 6 datasets/24 charts/2 dashboards.

- [ ] **Step 6: Sync the design wording only if plugin field names changed mechanically**

Compare the implemented raw form-data names against the approved design. The allowed documentation edit is limited to exact plugin key spelling such as `echart_options`; metric, filter, layout, color, time, and scope semantics must remain unchanged.

- [ ] **Step 7: Commit the complete deterministic bundle contract**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  docs/superpowers/specs/2026-08-08-hot-product-index-remaining-charts-design.md
git diff --cached --check
git commit -m "test(dashboard): lock remaining hot-product assets"
```

If the design file is unchanged, omit it from `git add`; never stage unrelated dirty files.

### Task 7: Run Independent Review And Exact-Candidate Verification

**Files:**

- Create: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-review.md`
- No production mutation in this task.

**Interfaces:**

- Consumes: exact candidate commit from Tasks 1-6.
- Produces: clean-verifier hashes and a review document ending `FRONTEND_BUILD_ALLOWED=YES` or a concrete blocker.

- [ ] **Step 1: Record the exact candidate and dirty-tree boundary**

```bash
git status --short --branch
git rev-parse HEAD
git diff --check
git diff --name-only 28de9c9cc9..HEAD
```

Expected changed scope: Pie control/types/transform/tests, ECharts option schema/parser/Mixed Timeseries tests, dashboard generator, preflight SQL, two Python test files, and exact spec wording only.

- [ ] **Step 2: Create a clean detached verifier for the exact commit**

Use a temporary clone or archive outside the dirty checkout. Do not use a new development worktree and do not copy uncommitted files into the verifier. Record the verifier path and exact SHA in the report.

- [ ] **Step 3: Run complete focused verification in the clean verifier**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py

cd superset-frontend
npm test -- \
  plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts \
  plugins/plugin-chart-echarts/test/Pie/buildQuery.test.ts \
  plugins/plugin-chart-echarts/test/Pie/transformProps.test.ts \
  plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts \
  plugins/plugin-chart-echarts/test/MixedTimeseries/transformProps.test.ts \
  --runInBand
npx tsc --noEmit -p plugins/plugin-chart-echarts/tsconfig.json
```

Expected: all commands exit 0.

- [ ] **Step 4: Stage exact files and run the mandatory repository pre-commit**

In the main checkout, stage only task files, then run:

```bash
pre-commit run --all-files
```

If hooks auto-fix task files, inspect and commit them with:

```bash
git add \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.tsx \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/controlPanel.test.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/types.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/Pie/transformProps.ts \
  superset-frontend/plugins/plugin-chart-echarts/test/Pie/transformProps.test.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/utils/eChartOptionsSchema.ts \
  superset-frontend/plugins/plugin-chart-echarts/src/utils/safeEChartOptionsParser.test.ts \
  superset-frontend/plugins/plugin-chart-echarts/test/MixedTimeseries/transformProps.test.ts \
  scripts/hot_product_index_dashboard.py \
  scripts/hot_product_index_remaining_charts_preflight.sql \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  docs/superpowers/specs/2026-08-08-hot-product-index-remaining-charts-design.md
git diff --cached --check
git commit -m "style(dashboard): apply remaining chart checks"
```

Do not stage or modify unrelated dirty files. A timeout or SIGTERM is not a pass; rerun the incomplete hook to completion.

- [ ] **Step 5: Perform independent specification and code review**

Review every approved design section against a concrete test or implementation line. The report must state:

```text
SPEC_COMPLIANCE=APPROVED
CODE_QUALITY=APPROVED
FRONTEND_BUILD_ALLOWED=YES
```

If either review verdict is not approved, stop before building or publishing.

### Task 8: Execute Guarded Production Release And Browser Reconciliation

**Files:**

- Create: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-release.md`
- Create: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-browser.md`
- Create: `.superpowers/sdd/2026-08-08-hot-product-remaining-charts-production-review.md`
- No source-code edit is permitted unless the workflow returns to the failing implementation task and repeats review.

**Interfaces:**

- Consumes: exact commit with `FRONTEND_BUILD_ALLOWED=YES`, generated assets ZIP, `scripts/hot_product_index_remaining_charts_preflight.sql`, and the `superset-production-ops` skill.
- Produces: production image/container, imported metadata, API/browser evidence, executable rollback, and `FINAL_COMPLETION_ALLOWED=YES`.

- [ ] **Step 1: Re-read production operations references and run read-only preflight**

Read `.agents/skills/superset-production-ops/references/production-state.md` and `release-flow.md`, then verify:

```bash
git status --short --branch
git rev-parse HEAD
ssh -o BatchMode=yes -o ConnectTimeout=10 agentops \
  'hostname && date -Is && cd /home/ubuntu/superset-docker && docker compose ps && df -h /'
```

Execute `scripts/hot_product_index_remaining_charts_preflight.sql` through the established read-only Doris query path. Required result: zero missing columns, all three category counts `<= 1000`, current/previous day counts exact, and two monthly partitions present. Any failure blocks release and goes to the ETL owner; do not implement a Superset fallback.

- [ ] **Step 2: Build the exact frontend candidate**

In the clean verifier at the approved SHA:

```bash
cd superset-frontend
BABEL_ENV=testableProduction npm run build
```

Record asset file count, total bytes, SHA-256 inventory, built-chunk evidence that the Pie cap is 1,000 and optional `totalLabel` is active, and parser evidence that static `legend.selected` survives schema validation while function values remain rejected. Build warnings must be classified; errors block release.

- [ ] **Step 3: Generate and inspect the exact metadata bundle**

```bash
/private/tmp/superset-hot-product-venv/bin/python scripts/hot_product_index_dashboard.py \
  --output /private/tmp/hot-product-index-remaining-charts.zip
unzip -t /private/tmp/hot-product-index-remaining-charts.zip
sha256sum /private/tmp/hot-product-index-remaining-charts.zip
```

Inspect the inventory and record 6 datasets, 24 charts, 2 dashboards, 32 UUIDs, and 23 main chart links.

- [ ] **Step 4: Create a complete rollback package before mutation**

Create `backup_dir="/home/ubuntu/superset-docker/backups/hot-product-remaining-charts-$(date -u +%Y%m%dT%H%M%SZ)"` on the production host and store:

1. Current assets directory.
2. Current main/guide dashboard, linked chart, and linked dataset metadata exports.
3. Current image ID and container ID.
4. Candidate source/assets manifests and checksums.
5. An executable `rollback.sh` that restores metadata and assets, retags the old image, recreates `superset`, waits for health, and verifies local/public `/health`.

Run `bash -n rollback.sh`, `test -x rollback.sh`, and verify the old image still exists.

- [ ] **Step 5: Sync exact assets, rebuild the image, and recreate the service**

Follow the guarded `superset-production-ops` release flow. The Docker build must remove the old `/app/superset/static/assets` before copying the exact candidate, then:

```bash
ssh agentops 'cd /home/ubuntu/superset-docker && \
  docker compose up -d superset'
```

Wait for Docker health. Record old/new image IDs and container IDs; do not claim release from source sync alone.

- [ ] **Step 6: Import metadata and verify live topology**

Import `/private/tmp/hot-product-index-remaining-charts.zip` through the authenticated assets API. Require HTTP 200/201 and then verify live metadata contains:

```text
datasets=6
charts=24
dashboards=2
main_dashboard_chart_links=23
main_dashboard_native_filters=13
orphan_chart_links=0
orphan_dataset_links=0
```

Verify the leaderboard is absent from the month filter and present in the other 12 scopes.

- [ ] **Step 7: Execute all nine Chart Data API queries**

For every new chart UUID, execute the saved query context with a fixed complete month and representative dimension filters. Require HTTP 200, `status=success`, `errors=null`, `warnings=null`, and nonempty results when ADS has rows. Explicitly verify:

1. Mixed Timeseries returns two successful query results.
2. SPU/SKU/color Pie category row counts equal the corresponding filtered SQL distinct counts, not 100.
3. Leaderboard rowcount/pagination and stable sort.
4. Changing only the dashboard month filter does not change leaderboard anchor month or rows.
5. A shared non-month filter changes both current and previous leaderboard amounts.

- [ ] **Step 8: Verify service health and runtime provenance**

```bash
ssh agentops 'curl -fsS http://127.0.0.1:8088/health'
curl -fsS --connect-timeout 10 http://111.230.91.24:8088/health
ssh agentops 'docker inspect -f "{{.Image}} {{.State.Status}} {{.State.Health.Status}}" apache-superset'
```

Compare candidate source/assets manifests with the running container and scan post-release logs for `error|exception|traceback|critical`. The release report must end with `CHROME_ACCEPTANCE_ALLOWED=YES` before browser work starts.

- [ ] **Step 9: Reconcile production Chrome against FineBI**

Use the user's logged-in Chrome, not a headless substitute. Open fresh no-cache tabs for FineBI and `https://openbi.wbkjgr.com/dashboard/hot-product-index/`. At the same month and filters verify:

1. Exactly six new visible components below current SPU/SKU detail Tabs.
2. Trend default tab is 天; 周/月 switch correctly; only 爆品指数、销售额、毛利润 start enabled; all 11 Chinese legend entries exist.
3. Leaderboard ignores 年月, responds to the other 12 filters, paginates 50 rows, sorts current amount descending, and applies exact five colors at boundary samples.
4. SPU/SKU donuts show total sales quantity, category+percent labels, no Other, and SKU scroll legend.
5. Color tabs show 周/月 only; `枪黑-GBK` is grouped as `GBK`; distribution is sales quantity share.
6. Existing status, KPI, funnels, SPU/SKU details, 13 filters and guide link have no regression.
7. Wide desktop and 1440px screenshots contain no overlap, text clipping, blank canvas, or console/network error.

Store screenshots beside the browser report and end it with `BROWSER_ACCEPTANCE=PASS`.

- [ ] **Step 10: Run independent production review and close only on the exact marker**

The reviewer must independently recheck live metadata, the 9 API calls, image/container health, manifest equality, rollback executability, browser report and screenshots. The production-review report must state:

```text
SPEC_COMPLIANCE=APPROVED
PRODUCTION_ACCEPTANCE=PASS
ROLLBACK_READINESS=READY
FINAL_COMPLETION_ALLOWED=YES
```

Only after all four markers are present may the implementation session report the six-chart delivery complete.

---

## Execution Order And Luna Ownership

Execute Tasks 1-6 sequentially because they share `scripts/hot_product_index_dashboard.py`. For each task, dispatch one fresh Luna worker with ownership limited to the files listed in that task; tell the worker that other changes exist in the checkout, must not be reverted, and only exact task files may be staged. After every worker commit, the lead agent must inspect the diff, rerun the task's focused tests, and perform a specification review before dispatching the next task.

Tasks 7 and 8 remain lead-controlled gates. Luna may run bounded verification or browser evidence collection, but the lead agent owns exact-SHA provenance, production mutation approval, rollback readiness, final review, and the completion statement.
