# Hot Product Index Detail Fields ETL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变既有爆品指数资格、评级和身份映射口径的前提下，为日/月 ADS 表补齐 `score`、`order_qty`、`actual_stock_qty`，完成全历史重算、生产验收，并向爆品指数 BI 会话发送可继续信号。

**Architecture:** `score` 与 `order_qty` 随日级领星事实按 `sales_date + sid + msku` 下发；`actual_stock_qty` 在 `ym + sku` 粒度由库存月表的 FBA 库存和海外仓原始库存相加，再附着到日/月身份行。日表保留原始事实和符合资格身份的零行扩展，月表仍只从日 staging 聚合；生产先增量扩列，再使用现有 coverage manifest 和发布/回滚协议重算全部已发布月份，最后执行新旧两套只读验收。

**Tech Stack:** Apache Doris 2.1.9、Airflow 3 Asset SDK、Python 3、SQL、pytest、现有 `ads_pdm_lx_hot_product_index_refresh` 发布链路。

## Global Constraints

- 实施仓库固定为 `/Users/zewe/code-workspace/etl`；不得修改 Superset 源码或元数据。
- 先检查远端分支、当前 release checkout 和生产 schema，已有等价实现时只做差异补齐，禁止重复开发。
- 源销售事实继续使用 `ling_xing.lx_web_product_performance_msku_list`；不得把主事实切回 `lx_bp_product_performance_msku`。
- `score` 唯一来源为 `lx_web_product_performance_msku_list.avg_star`；生产字段注释已确认其中文语义为“评分”。禁止使用语义冲突的 `points_number`，该字段在旧表代表“积分收入”。
- `order_qty` 唯一来源为 `lx_web_product_performance_msku_list.order_items`，粒度为 `sales_date + sid + msku`，日/月均可加总，值不得为负。
- `actual_stock_qty` 唯一公式为 `dws.dws_stock_analysis_monthly_sku.fba_stock_qty + dws.dws_stock_analysis_monthly_sku.overseas_original_stock_qty`，粒度为 `ym + sku`。任一组成项为 `NULL` 时结果保持 `NULL`，禁止分别使用 `COALESCE(stock.fba_stock_qty, 0)` 或 `COALESCE(stock.overseas_original_stock_qty, 0)`。
- `theoretical_stock_qty` 保持现有 `dws_stock_analysis_monthly_sku.total_stock_qty` 口径；不得被 `actual_stock_qty` 替换。
- 最终 DDL：`score DECIMAL(10,4) NULL`、`order_qty BIGINT NOT NULL`、`actual_stock_qty DECIMAL(18,2) NULL`。
- 真实源事实行必须保留源 `score` 和 `order_qty`；无 SKU 的保留事实行 `actual_stock_qty` 为 `NULL`。
- 生成的零销量身份日：`score = NULL`、`order_qty = 0`；库存字段继续使用当月 SKU 快照。零行中的订单量 0 是日脊柱语义，不得反向填到真实源事实。
- 月表聚合固定为 `AVG(score)`、`SUM(order_qty)`、`MAX(actual_stock_qty)`；其余现有指标与维度聚合不得改变。
- 页面展示层负责 SKU 粒度去重库存；ADS 允许同一个 `ym + sku` 的库存快照附着在多个有效 `sid + msku` 身份行。
- 现有资格公式仍为 `sku_month_sales_qty + theoretical_stock_qty > 10`，不得改用实际库存。
- `spu_previous_month_sales_level`、`product_level`、闭区间拉链、未匹配事实保留、coverage manifest 和发布回滚协议均保持现状。
- 数据源缺失、订单量为空/为负、库存公式不一致或新字段对账失败时快速失败；禁止默认值、静态占位和跨表回退。
- 不在脏的本地 `master` 上混入无关改动；复用原 ETL release checkout 或从已部署基线创建干净 release workspace。
- 生产变更必须先备份目标 DDL、受影响分区和当前 Airflow 部署；失败时恢复旧分区和代码，不能把半完成 schema 宣布为可用。

---

## File Map

| File | Responsibility |
|---|---|
| `ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql` | 日表最终三字段存储契约。 |
| `ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql` | 月表最终三字段存储契约。 |
| `include/sql/ads/pdm/hot_product_index/00_prepare_staging.sql` | 所有相关 staging 表增加列。 |
| `include/sql/ads/pdm/hot_product_index/10_build_source_resolution.sql` | 从领星事实下发评分和订单量。 |
| `include/sql/ads/pdm/hot_product_index/20_build_candidate_eligibility.sql` | 在 `ym + sku` 计算理论/实际库存快照。 |
| `include/sql/ads/pdm/hot_product_index/30_build_daily_staging.sql` | 真实事实、未匹配事实、生成零行的三字段分支语义。 |
| `include/sql/ads/pdm/hot_product_index/40_build_monthly_staging.sql` | 月表 `AVG/SUM/MAX` 聚合。 |
| `include/sql/ads/pdm/hot_product_index/50_validate_pre_publish.sql` | 发布前源值、非负、库存公式、日月聚合门禁。 |
| `include/sql/ads/pdm/hot_product_index/60_validate_published.sql` | 发布后新字段目标表复核。 |
| `include/sql/validation/hot_product_index/production_acceptance.sql` | 生产只读全表和样例验收。 |
| `scripts/hot_product_index_ddl_bootstrap.py` | 识别既有表并执行可审计的增量扩列，不以 `CREATE TABLE IF NOT EXISTS` 冒充迁移。 |
| `test/test_hot_product_index_ddl_contract.py` | DDL、增量迁移和最终 nullability 契约。 |
| `test/test_hot_product_index_sql_contract.py` | 三字段来源、分支、聚合和门禁契约。 |
| `test/test_hot_product_index_publication_contract.py` | 历史重算、失败补偿和发布结果契约。 |
| `docs/reports/2026-08-07-hot-product-index-detail-fields-acceptance.md` | 实现、发布、生产查询、备份和回滚证据。 |

### Task 1: Audit And Lock The Three Field Contract

**Files:**
- Read: all files in the File Map
- Create: `docs/reports/2026-08-07-hot-product-index-detail-fields-acceptance.md`

**Interfaces:**
- Consumes: current remote/release history and production Doris metadata.
- Produces: one authoritative pre-change snapshot and a decision whether implementation is necessary.

- [ ] **Step 1: Detect existing work before editing**

```bash
git fetch --all --prune
git log --all --oneline -- \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql \
  include/sql/ads/pdm/hot_product_index
git status --short
```

Search every ref and production table for the three exact names. If all code, tests, deployed SQL, production schema and data gates already match this plan, skip implementation and proceed directly to Task 5 acceptance; a documentation statement alone is not evidence.

- [ ] **Step 2: Record source metadata evidence**

Run the read-only information schema query and store its output in the acceptance report:

```sql
SELECT table_schema, table_name, column_name, data_type, column_comment
FROM information_schema.columns
WHERE (
    table_schema = 'ling_xing'
    AND table_name = 'lx_web_product_performance_msku_list'
    AND column_name IN ('avg_star', 'points_number', 'order_items')
  ) OR (
    table_schema = 'dws'
    AND table_name = 'dws_stock_analysis_monthly_sku'
    AND column_name IN (
      'total_stock_qty',
      'fba_stock_qty',
      'overseas_original_stock_qty'
    )
  )
ORDER BY table_schema, table_name, ordinal_position;
```

Expected semantics: `avg_star=评分`, `order_items=订单量`, `points_number` is excluded, and both inventory components exist.

- [ ] **Step 3: Capture production before-state and backup identifiers**

Record `SHOW CREATE TABLE` for both ADS targets, row counts and watermarks by month, current Airflow deployed commit/DAG version, and the exact backup directory. Confirm the live schema lacks or already contains each field before any DDL.

- [ ] **Step 4: Commit the audit report skeleton**

```bash
git add docs/reports/2026-08-07-hot-product-index-detail-fields-acceptance.md
git commit -m "docs(ads): audit hot product detail fields"
```

### Task 2: Extend DDL And Staging Contracts With TDD

**Files:**
- Modify: both ADS DDL files
- Modify: `include/sql/ads/pdm/hot_product_index/00_prepare_staging.sql`
- Modify: `scripts/hot_product_index_ddl_bootstrap.py`
- Modify: `test/test_hot_product_index_ddl_contract.py`

**Interfaces:**
- Consumes: final types/nullability from Global Constraints.
- Produces: create-new and alter-existing paths yielding the same physical schema.

- [ ] **Step 1: Write failing DDL and migration tests**

Assert both final DDLs contain:

```python
assert "score DECIMAL(10,4) NULL" in sql
assert "order_qty BIGINT NOT NULL" in sql
assert "actual_stock_qty DECIMAL(18,2) NULL" in sql
```

Add a migration test proving an existing table receives columns in nullable-safe order: add `score`, add temporary nullable `order_qty`, add `actual_stock_qty`, rebuild/validate, then change `order_qty` to `BIGINT NOT NULL`. The migration must be idempotent by inspecting `information_schema.columns`, not by swallowing Doris exceptions.

- [ ] **Step 2: Verify red**

```bash
python3 -m pytest -q test/test_hot_product_index_ddl_contract.py
```

Expected: FAIL because final columns and existing-table migration are absent.

- [ ] **Step 3: Update final DDL and all staging schemas**

Place source metrics beside existing sales metrics and stock beside `theoretical_stock_qty`. Every staging insert column list and select list must remain positionally identical. Do not add a table-level default for `score` or `actual_stock_qty`.

- [ ] **Step 4: Implement explicit existing-table migration**

The bootstrap must print a dry-run plan by default. `--apply-detail-fields` performs only missing additive columns; the final not-null conversion is a separate `--finalize-detail-fields` action that first asserts `COUNT(*) WHERE order_qty IS NULL = 0` in both tables.

- [ ] **Step 5: Run tests and commit**

```bash
python3 -m pytest -q test/test_hot_product_index_ddl_contract.py
python3 -m py_compile scripts/hot_product_index_ddl_bootstrap.py
git diff --check
git add \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql \
  include/sql/ads/pdm/hot_product_index/00_prepare_staging.sql \
  scripts/hot_product_index_ddl_bootstrap.py \
  test/test_hot_product_index_ddl_contract.py
git commit -m "feat(ads): define hot product detail fields"
```

### Task 3: Carry Source Metrics And Actual Stock Through The Pipeline

**Files:**
- Modify: `10_build_source_resolution.sql`
- Modify: `20_build_candidate_eligibility.sql`
- Modify: `30_build_daily_staging.sql`
- Modify: `40_build_monthly_staging.sql`
- Modify: `test/test_hot_product_index_sql_contract.py`

**Interfaces:**
- Consumes: Task 2 staging columns.
- Produces: exact daily and monthly values for all three fields.

- [ ] **Step 1: Write failing SQL contract tests**

Tests must prove:

```python
assert "source.avg_star" in source_sql
assert "source.order_items" in source_sql
assert "points_number" not in source_sql
assert "stock.fba_stock_qty" in eligibility_sql
assert "stock.overseas_original_stock_qty" in eligibility_sql
assert "coalesce(stock.fba_stock_qty, 0)" not in eligibility_sql
assert "avg(score) as score" in monthly_sql
assert "sum(order_qty) as order_qty" in monthly_sql
assert "max(actual_stock_qty) as actual_stock_qty" in monthly_sql
```

Also assert the generated-zero branch emits `CAST(NULL AS DECIMAL(10,4)) AS score` and `CAST(0 AS BIGINT) AS order_qty`, while unmatched source facts retain source metrics and a null actual stock.

- [ ] **Step 2: Verify red**

```bash
python3 -m pytest -q test/test_hot_product_index_sql_contract.py
```

- [ ] **Step 3: Extend source resolution**

In `source_rows`, select:

```sql
CAST(source.avg_star AS DECIMAL(10,4)) AS score,
CAST(source.order_items AS BIGINT) AS order_qty
```

Carry both fields unchanged through SKU resolution, domain enrichment and seller/grade enrichment. Add pre-publish null and negative checks for `order_qty`; do not coerce a real source null to zero.

- [ ] **Step 4: Extend monthly SKU inventory snapshot**

In the existing eligibility inventory CTE add:

```sql
CASE
  WHEN stock.fba_stock_qty IS NULL
    OR stock.overseas_original_stock_qty IS NULL
  THEN NULL
  ELSE CAST(
    stock.fba_stock_qty + stock.overseas_original_stock_qty
    AS DECIMAL(18,2)
  )
END AS actual_stock_qty
```

Carry the value through eligibility and daily staging. It must not participate in `eligibility_value` or `is_eligible`.

- [ ] **Step 5: Implement the three daily branches**

- Matched real source: source `score`, source `order_qty`, eligibility `actual_stock_qty`.
- Unmatched real source: source `score`, source `order_qty`, `actual_stock_qty = NULL`.
- Generated zero identity day: `score = NULL`, `order_qty = 0`, eligibility `actual_stock_qty`.

- [ ] **Step 6: Implement monthly aggregation and commit**

```bash
python3 -m pytest -q \
  test/test_hot_product_index_sql_contract.py \
  test/test_hot_product_index_ddl_contract.py
git diff --check
git add \
  include/sql/ads/pdm/hot_product_index/10_build_source_resolution.sql \
  include/sql/ads/pdm/hot_product_index/20_build_candidate_eligibility.sql \
  include/sql/ads/pdm/hot_product_index/30_build_daily_staging.sql \
  include/sql/ads/pdm/hot_product_index/40_build_monthly_staging.sql \
  test/test_hot_product_index_sql_contract.py
git commit -m "feat(ads): populate hot product detail fields"
```

### Task 4: Add Pre/Post-Publish And Production Acceptance Gates

**Files:**
- Modify: `50_validate_pre_publish.sql`
- Modify: `60_validate_published.sql`
- Modify: `include/sql/validation/hot_product_index/production_acceptance.sql`
- Modify: `test/test_hot_product_index_sql_contract.py`
- Modify: `test/test_hot_product_index_publication_contract.py`

**Interfaces:**
- Consumes: populated Task 3 staging values.
- Produces: fail-fast checks that must be zero before and after publication.

- [ ] **Step 1: Add failing named-check tests**

Require these checks in the gate SQL:

```text
source_order_qty_invalid
source_score_or_order_diff
actual_stock_formula_diff
generated_zero_detail_field_diff
monthly_detail_field_rollup_diff
published_detail_field_null_or_negative
published_daily_monthly_detail_reconciliation
```

- [ ] **Step 2: Implement null-safe comparisons**

Use Doris `<=>` for nullable score and inventory comparisons. For actual stock, first group targets to `ym + sku` with `MIN/MAX`; fail when identities disagree or when the single target snapshot differs from the exact source formula. Do not sum inventory across identities.

- [ ] **Step 3: Add bounded production fixtures**

For an accepted complete month, compare:

- `SUM(order_qty)` by `sales_date + sid + msku` against `SUM(order_items)`;
- `AVG(score)` in monthly ADS against the daily non-null `AVG(score)` for each identity;
- one de-duplicated `actual_stock_qty` per `ym + sku` against FBA plus original overseas stock;
- existing sales, returns, ratings, eligibility, unmatched-row and exact identity fixtures.

- [ ] **Step 4: Run focused and full hot-product suites**

```bash
python3 -m pytest -q \
  test/test_hot_product_index_ddl_contract.py \
  test/test_hot_product_index_sql_contract.py \
  test/test_hot_product_index_publication_contract.py \
  test/test_hot_product_index_runtime.py \
  test/test_hot_product_index_dag_contract.py \
  test/test_hot_product_index_coverage_contract.py
python3 -m compileall -q dags include scripts
git diff --check
```

- [ ] **Step 5: Commit gates**

```bash
git add \
  include/sql/ads/pdm/hot_product_index/50_validate_pre_publish.sql \
  include/sql/ads/pdm/hot_product_index/60_validate_published.sql \
  include/sql/validation/hot_product_index/production_acceptance.sql \
  test/test_hot_product_index_sql_contract.py \
  test/test_hot_product_index_publication_contract.py
git commit -m "test(ads): gate hot product detail fields"
```

### Task 5: Release, Rebuild Published Months, And Finalize Schema

**Files:**
- Modify: production Doris schema and accepted ADS partitions through approved scripts
- Modify: production Airflow deployment
- Update: `docs/reports/2026-08-07-hot-product-index-detail-fields-acceptance.md`

**Interfaces:**
- Consumes: verified commits from Tasks 1-4.
- Produces: production rows with populated fields and final `order_qty NOT NULL` schema.

- [ ] **Step 1: Build an exact release baseline**

Use the original ETL release procedure: commit all owned changes, confirm no unrelated files in the commit range, push the release branch, and record commit SHA. Run the repository's required lint/test gates before deployment.

- [ ] **Step 2: Back up before schema or data mutation**

Back up both target `SHOW CREATE TABLE` outputs and every published month partition or the equivalent restorable snapshot used by the existing partition publication protocol. Record current DAG code hash, watermark and row counts.

- [ ] **Step 3: Apply additive nullable columns**

Run the reviewed bootstrap `--apply-detail-fields`. Re-read `information_schema.columns`; stop unless all six new physical columns exist with migration-safe nullability. Do not finalize `order_qty NOT NULL` yet.

- [ ] **Step 4: Deploy code and rebuild all currently published months**

Deploy the exact release commit. Use the existing coverage manifest as the month set; preserve audited gaps and do not infer completeness from row existence. Run validate-only first, then the approved bootstrap/backfill mode. The normal DAG must remain governed by its existing source and stock readiness assets.

- [ ] **Step 5: Run pre/post-publish gates and finalize order nullability**

All old and new named checks must equal zero. Confirm both targets have zero null and negative `order_qty` rows, then run `--finalize-detail-fields` and verify final DDL exactly matches the Global Constraints.

- [ ] **Step 6: Verify scheduler and fresh execution**

Confirm Airflow parses the deployed DAG with zero import errors, the latest controlled run succeeds, both asset events use the same accepted month set/watermark, and a fresh current-month run populates the three fields without manual SQL patching.

### Task 6: Final Production Acceptance And BI Callback

**Files:**
- Update: `docs/reports/2026-08-07-hot-product-index-detail-fields-acceptance.md`

**Interfaces:**
- Consumes: final production state from Task 5.
- Produces: `ETL_DETAIL_FIELDS_READY=PASS` callback to Superset task `019fc5e4-62c5-7693-8753-dc4d9b74519a`.

- [ ] **Step 1: Execute exact schema gate**

Both ADS tables must return `score`, `order_qty`, `actual_stock_qty` with final types/nullability, plus the existing `product_level`, `spu_previous_month_sales_level`, `theoretical_stock_qty`, and `data_through_date`.

- [ ] **Step 2: Execute value and lookback gate**

For at least one full historical month and the current month, record row counts, null score/stock counts, zero null/negative order count, source/target reconciliation, 90-day source coverage and identical data watermarks.

- [ ] **Step 3: Run production acceptance SQL**

Every named old and new error count must be zero. Sample at least 10 SKUs, including multiple `sid + msku` identities under one SKU, to prove inventory is identical across identities and de-duplicates correctly at `ym + sku`.

- [ ] **Step 4: Complete delivery evidence**

Commit and push the final acceptance report. Report exact release SHA, Airflow deployed SHA/run id, production schema output, tests, all error counts, backup path and rollback command.

- [ ] **Step 5: Notify the blocked BI session only after PASS**

Use `send_message_to_thread` with target thread ID `019fc5e4-62c5-7693-8753-dc4d9b74519a` and send:

```python
message = (
    "ETL_DETAIL_FIELDS_READY=PASS\n"
    "两张生产 ADS 表已补齐 score/order_qty/actual_stock_qty；"
    "请重新执行 Hot Product Detail Tables Task 1 门禁，"
    "门禁通过后从 Task 2 继续。"
    f"release_sha={release_sha}; "
    f"airflow_run_id={airflow_run_id}; "
    f"acceptance_report={acceptance_report}。"
)
```

If any required gate is non-zero, send `ETL_DETAIL_FIELDS_READY=FAIL` with the exact failed check instead; do not tell the BI session to continue.

## Delivery Definition

- [ ] 三字段来源、类型、粒度和聚合规则与本计划一致。
- [ ] 两张生产 ADS 表已重算全部已发布月份，不仅完成空 schema 扩列。
- [ ] 新旧生产验收全部为零错误，90 天 lookback 完整。
- [ ] Airflow 代码和 fresh run 已验证，未依赖手工数据补丁。
- [ ] 验收报告、release SHA、备份和回滚路径齐全。
- [ ] 已向 BI 会话发送明确 PASS/FAIL 回调；仅 PASS 允许继续 Superset Task 2。
