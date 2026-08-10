# 爆品指数剩余维度明细 Tab 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有爆品指数看板中增加 `国家`、`SPU开发经理`、`型号` 三个只读经营明细 Tab，并锁定可审计的范围、库存和汇总语义。

**Architecture:** 三个固定 UUID 的虚拟数据集都只读取两张 `ads_pdm_lx_hot_product_index_sku_{d,m}` ADS 表。日表负责 selected-range 流量和完整 90 天 lookback，月表只负责 `effective_end_ym` 库存快照；每个数据集先在 `维度 + SKU` 叶子粒度去重，再从同一基础 CTE 追加显式 `汇总` 行。内置 totals 和 server pagination 关闭，避免重复汇总或把底行分页隐藏。

**Tech Stack:** Python 3、Superset virtual dataset SQL/Jinja、Apache Doris、Superset native filters、标准 table chart、pytest、只读 metadata 导入和 Chrome 验收。

## Global Constraints

- 三个维度 Tab 的顺序固定为 `SPU`、`SKU`、`国家`、`SPU开发经理`、`型号`。
- `渠道（未启用）` 不生成；全局 `渠道` 筛选器仍然作用于三个维度数据集。
- 固定总资产为 9 个数据集（9 datasets）、27 个图表（27 charts）、2 个 dashboards，主 Dashboard 固定关联 26 个 chart nodes。
- 事实统一先过滤 `is_eligible = 1`；资格口径为全渠道 `ym + sku` 的 `sku_month_sales_qty + theoretical_stock_qty > 10`。
- selected range 使用 `[selected_start_date, selected_end_exclusive_date)`；所有流量指标在范围内相加，当前月由 `MAX(data_through_date)` 截断。
- `effective_end_ym` 只取有效结束日所在月的库存；不跨月累加库存，不从日表重复库存列求和。
- 维度 + SKU 先去重；显式 `汇总` 的库存使用全局 `effective_end_ym + sku` 去重，不能从可见维度行反推。
- 所有比率和日均值从分子、分母重算；NULL 保留为 NULL 并显示 `-`；可见小数最多 1 位（一位小数）。
- 新增代码不提供缺列 fallback；必需 ADS 字段和 coverage 门禁失败即 fail closed。
- 本阶段可修改本计划列出的生成器、测试、预检 SQL 和文档；不修改 Superset 核心前后端、生产数据或 Doris schema，不构建镜像，且不 stage/commit/deploy。

---

## File Map

| File | Responsibility |
|---|---|
| `scripts/hot_product_index_remaining_detail_tabs_preflight.sql` | 只读生产预检：ADS 字段、选定月份覆盖、维度基数/NULL 样本、`ym + sku` 库存一致性、跨国家 SKU 代表样本。 |
| `docs/superpowers/specs/2026-08-10-hot-product-index-remaining-detail-tabs-design.md` | 本阶段字段、准入、时间、库存去重、显式汇总、展示、筛选、测试和发布合同。 |
| `docs/superpowers/plans/2026-08-10-hot-product-index-remaining-detail-tabs.md` | 可执行实施顺序、文件所有权、测试命令、发布备份与回滚门禁。 |
| `scripts/hot_product_index_dashboard.py` | 由生成器 Agent 新增三数据集、三表图表和五 Tab 布局；本计划只规定其接口，不在本任务修改。 |
| `tests/unit_tests/scripts/hot_product_index_dashboard_test.py` | 由测试 Agent 更新最终资产数量、Tab 顺序、channel 排除和共享字段合同；本计划只规定断言。 |
| `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py` | 由测试 Agent 保持已有趋势/排行榜/颜色资产合同，并核对资产总数。 |
| `tests/unit_tests/scripts/hot_product_index_remaining_detail_tabs_test.py` | 由测试 Agent（可选新文件）覆盖三数据集 SQL 和表格行为合同。 |

## Implementation Tasks

### Task 1: Execute the read-only ADS and coverage preflight

**Files:**

- Read: `scripts/hot_product_index_remaining_detail_tabs_preflight.sql`
- Read: `scripts/hot_product_index_dashboard.py`
- Read: `docs/superpowers/specs/2026-08-10-hot-product-index-remaining-detail-tabs-design.md`
- Modify: none in this task

**Interfaces:**

- Consumes: target Doris catalog read-only credentials and the two approved ADS tables.
- Produces: five result sets with visible `check_pass`/`within_contract` state rows and saved raw results for the release gate.

- [ ] **Step 1: Confirm the source column contract without changing the catalog**

  Execute the first result set and verify both tables expose the complete required contract, including dates, dimensions, flow metrics, `order_qty`, `theoretical_stock_qty`, `actual_stock_qty`, `is_eligible` and `data_through_date`. Type-family mismatches are failures; do not remove a missing column or substitute another source.

- [ ] **Step 2: Verify the selected-range month and date coverage**

  Execute the second result set. It must report selected start/end, global watermark, effective end date, effective end `ym`, expected/observed month counts, daily date counts and monthly partition counts. A current partial month is valid only through the watermark; any missing selected month or missing date through the watermark sets `coverage_complete = 0`.

- [ ] **Step 3: Review dimension cardinality and NULL samples**

  Execute the third result set and retain rows for `country`, `developer`, `spu`, `model`, and `sku` from both daily and monthly sources. Check non-null distinct counts, NULL/empty counts, and representative sample keys. NULLs are an observation and remain NULL in the data set; they are not filled from SKU or MSKU.

- [ ] **Step 4: Verify ending-month inventory uniqueness**

  Execute the fourth result set for `effective_end_ym`. Every `ym + sku` must have at most one theoretical-stock value and one actual-stock value, and both values must be non-NULL. The summary retains NULL-SKU rows as `null_sku_count`; multiple SID/MSKU rows are expected only when their snapshot values agree, and any NULL SKU, conflicting pair, or NULL stock count is blocking.

- [ ] **Step 5: Verify a cross-country SKU representative**

  Execute the fifth result set. It must select an eligible SKU present in at least two countries, list each country membership and the global member count, and expose the representative's `stock_pair_count`/`stock_consistent` snapshot evidence. Country coverage or stock consistency failure must set `within_contract = 0`; if no representative exists, the result must still return a failure row rather than an empty pass.

- [ ] **Step 6: Preserve evidence**

  Save the SQL text, query timestamp, selected range, catalog, raw result sets and observed failures in the release evidence directory. This task never writes production tables or modifies the metadata database.

### Task 2: Implement the three dimension serving datasets

**Owner:** generator Agent; do not modify the generator from this task.

**Files owned by the generator Agent:**

- Modify: `scripts/hot_product_index_dashboard.py`

**Interfaces:**

- Consumes: two ADS tables, native filter fragment, and Task 1 preflight contract.
- Produces: three fixed virtual dataset SQL strings with identical coverage CTEs and a dimension-specific `detail_leaf`/`global_summary` contract.

- [ ] **Step 1: Build the common selected-range bounds**

  Use `get_time_filter("sales_date", remove_filter=True)` and derive `global_data_through_date`, `effective_end_date`, `effective_end_ym`, `expected_month_count`, and a 90-day lookback gate. Require left-closed/right-open dates and return no business rows when coverage or the effective range fails.

- [ ] **Step 2: Build the selected-range flow CTE**

  Read eligible daily facts in `[selected_start_date, effective_end_date + 1 day)`, apply all native filters, and aggregate `sales_amount_usd`, `sales_qty`, `gross_profit_usd`, `return_goods_qty`, and `order_qty` by `ym + tab dimensions + sku`. Keep distinct SID/MSKU facts for additive flow metrics.

- [ ] **Step 3: Build rolling daily metrics**

  Read the same filtered daily facts from `effective_end_date - 89 days` through `effective_end_date`. Compute 7/30/90-day sales quantities and divide by the fixed full-natural-day counts. The 90-day gate must fail before any short-window result is returned.

- [ ] **Step 4: Build the ending-month inventory CTE**

  Read monthly eligible rows only at `effective_end_ym`. First group to global `effective_end_ym + sku` and assert stock values are consistent, then join dimension identities and group to `effective_end_ym + tab dimensions + sku`. Do not sum repeated SID/MSKU inventory rows or daily repeated inventory columns.

- [ ] **Step 5: Recompute leaf ratios and append the explicit summary**

  Aggregate leaf rows from flow and rolling numerators/denominators. Append a SQL `UNION ALL` row with `is_summary = 1` and `row_order` greater than every leaf; compute summary flow metrics from base facts and summary stock from global SKU inventory, never by summing visible dimension rows. Hide `is_summary`, `row_order`, `sku` and helper denominator columns.

- [ ] **Step 6: Configure table behavior**

  Use Chinese verbose names, `nullValue = '-'`, max-one-decimal formats, stable dimension sorting and an explicit bottom summary. Set `show_totals = false` and `server_pagination = false` for all three new tables; do not expose internal sort or quality fields.

### Task 3: Add generator and SQL contract tests

**Owner:** tests Agent; do not modify tests from this task.

**Files owned by the tests Agent:**

- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`
- Optional create: `tests/unit_tests/scripts/hot_product_index_remaining_detail_tabs_test.py`

- [ ] **Step 1: Lock asset and layout invariants**

  Assert 9 datasets, 27 charts, 2 dashboards, 26 main chart links, five Tab labels in the fixed order, and the absence of `渠道（未启用）` in assets and layout.

- [ ] **Step 2: Lock each dimension contract**

  Assert `country`, `developer + spu`, and `model` are the first fields, followed by exactly the twelve common metrics in the specified order. Assert every visible field has a Chinese label and numeric formats allow at most one decimal.

- [ ] **Step 3: Lock SQL gates and de-dup semantics**

  Assert each SQL contains `is_eligible = 1`, selected-range bounds, `effective_end_ym`, daily/monthly coverage gates, 90-day lookback, dimension+SKU stock de-dup, global-SKU summary de-dup, ratio recomputation, and explicit `汇总` row generation. Assert no SQL fallback to unrelated source tables.

- [ ] **Step 4: Lock table form-data behavior**

  Assert `show_totals` and `server_pagination` are disabled, internal helper columns are hidden, summary sorting is bottom-fixed, and NULL display is `-`.

- [ ] **Step 5: Add fixture edge cases**

  Use fixtures for duplicate SID/MSKU stock rows with equal values, conflicting `ym + sku` stock values, one SKU in two countries, NULL developer/model, zero sales denominators, and a selected range ending before the global watermark. Assert the expected visible summary, `-`, and fail-closed results.

### Task 4: Verify locally and prepare metadata-only release evidence

**Files:**

- Read: all files in Tasks 1-3
- Modify: none in this task

- [ ] **Step 1: Run focused Python tests**

  ```bash
  python -m pytest -q \
    tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
    tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
    tests/unit_tests/scripts/hot_product_index_remaining_detail_tabs_test.py
  ```

  Expected: all focused suites pass; a missing optional test file is omitted rather than replaced by an untested claim.

- [ ] **Step 2: Run static checks on owned artifacts**

  ```bash
  python -m compileall -q scripts/hot_product_index_dashboard.py
  git diff --check -- \
    scripts/hot_product_index_remaining_detail_tabs_preflight.sql \
    docs/superpowers/specs/2026-08-10-hot-product-index-remaining-detail-tabs-design.md \
    docs/superpowers/plans/2026-08-10-hot-product-index-remaining-detail-tabs.md
  ```

  Expected: both commands pass; SQL remains read-only and no unrelated dirty files are changed.

- [ ] **Step 3: Run repository pre-commit at the approved release gate**

  The release owner stages only the reviewed implementation inventory, then runs `pre-commit run --all-files`. This delegated documentation task must not stage or commit anything; a pre-commit result is recorded by the parent Agent after integration.

- [ ] **Step 4: Back up metadata before production import**

  Export current target Dashboard, five-tab chart layout, all related datasets/charts, native filter state and UUID mapping. Store a checksum and exact source commit alongside the backup. Confirm the backup can be imported into a disposable metadata database before opening the production gate.

- [ ] **Step 5: Perform metadata-only production import and browser acceptance**

  Import only the generated metadata package. Do not rebuild images, run front-end deployment, mutate ADS/Doris/Airflow, or publish if Task 1 coverage/stock checks fail. In Chrome verify all five tabs, explicit `汇总`, NULL `-`, one-decimal display, selected-range flow values, ending-month inventory, and the cross-country SKU case.

- [ ] **Step 6: Roll back on any failed gate**

  Restore the complete pre-import metadata backup, rerun health/API/asset-count checks, and repeat the five-tab browser smoke test. Rollback must not alter ADS data. Keep the failed result rows and restored metadata checksum in the release report.

## Completion Criteria

The phase is complete only when the five preflight result sets contain passing rows, focused tests and static checks pass, the exact metadata inventory is backed up, metadata-only import succeeds, and Chrome confirms the five-tab order and explicit bottom summary. A passing generator test without read-only data evidence, backup, rollback, or browser evidence is incomplete.
