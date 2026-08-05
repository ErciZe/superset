# Hot Product Index Data Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/Users/zewe/code-workspace/etl` 中实现并生产验收爆品指数的两张 Doris 数据表、按月重算链路、质量门禁和 Airflow 编排，在数据验收前不进入 Superset 实施。

**Architecture:** 领星日事实先按严格业务键解析 SKU，再独立生成月候选、资格与有效身份 staging；日表保留全部域内源事实，只为资格为 1 的有效身份生成缺失日期零行，月表只从日 staging 聚合。每月先写不可见候选并完成 17 类门禁，再按“备份旧分区、逐表原子替换、失败补偿回滚”的协议发布；跨表读隔离在 BI 启用前另设强制门禁。

**Tech Stack:** Apache Doris 2.1.9、Airflow 3 Asset SDK、Python 3、SQL、pytest、`etl.common.sql_file_loader.load_sql`、`etl.common.db_operator`。

## Global Constraints

- 本计划只交付 ETL/Doris 数据阶段；不得创建或修改 Superset 数据集、指标、图表、筛选器和看板。
- 权威设计为 `/Volumes/extend/ecode-workspace/superset-source/docs/superpowers/specs/2026-08-03-hot-product-index-overview-design.md`；FineBI 只作视觉参考。
- 永久业务表只能是 `ads.ads_pdm_lx_hot_product_index_sku_d` 与 `ads.ads_pdm_lx_hot_product_index_sku_m`；运行 staging 不是 BI 数据源。
- 事实源只能是 `ling_xing.lx_web_product_performance_msku_list`；不得改回 `ling_xing.lx_bp_product_performance_msku`。
- 源 SKU 为空时，批准契约是 `sid + msku + [start_date,end_date]` 唯一命中 `dim.dim_product_relation_zipper`；不得加 `msku` 单键 fallback、`ROW_NUMBER() = 1` 或任取一行。该闭区间口径由用户于 2026-08-05 明确批准。
- `product_level` 只能来自 `dim.dim_product.product_level`；数据库空值或空字符串写“未评级”，其他值原样保留。
- `sku_level` 只能来自 `ods.product_grade.global_label`；`ods.product_grade.ym` 从 `YYYYMM INT` 显式转为目标 `ym = YYYY-MM`。
- 资格公式固定为 `sku_month_sales_qty + theoretical_stock_qty > 10`，不判断商品状态；理论库存只能来自 `dws.dws_stock_analysis_monthly_sku.total_stock_qty`。
- `theoretical_stock_qty` 会下发到同一 SKU 的多个 SID/MSKU 行，只能用于资格判断，不得在目标表上跨身份求和。
- 退货量只能使用 `return_goods_count`；金额与毛利润保持源美元口径。
- 日键为 `sales_date,sid,msku`；月键为 `ym,sid,msku,sku`；键列必须位于所有非键列之前。
- 日表按 `sales_date` 自然月 AUTO RANGE 分区；月表按字符串 `ym` 单值 AUTO LIST 分区；两表均 `HASH(sid,msku) BUCKETS 16`、UNIQUE KEY Merge-on-Write。
- 字符串时间键命名只允许 `ymd`、`yw`、`ym`；真实日期使用有业务意义的 `DATE` 字段。本计划只需要 `ym`，不得增加同义 `ymd`。
- 历史回填不能推进全局 `data_through_date`；只有最新日常批次的两表同批发布成功后才能推进候选水位。
- 2023-06 至 2024-06 是已知源断档，只写 Airflow 审计日志，不创建库存驱动的零销量业务分区。
- 质量门禁非零必须快速失败并保留上一批正确分区，不写猜测式 fallback。
- ETL 当前工作树存在大量无关改动且 `master` 相对远端 `ahead 9, behind 91`；实施前必须由维护者确认干净、可审查的 Git 基线，实施任务只能精确暂存本计划列出的文件，禁止 `git add .`。

## Delivery Boundary

本计划的完成状态分开报告：

1. **代码完成**：DDL、SQL、运行时、DAG 和自动化测试通过。
2. **表结构完成**：生产两表 `SHOW CREATE TABLE` 与契约一致。
3. **数据完成**：历史回填、日常批次、边界样例、全部门禁和回滚演练通过。
4. **BI 可恢复**：数据完成，且跨两表读取隔离方案获得批准并验收。

任何前三项未完成时，不回到 BI 基线。第四项未完成时，可以验收物理表，但不得把 Superset 连接到会在发布窗口暴露不同批次的两张表。

### Verified Production Snapshot (2026-08-05, Read-Only)

- Doris is `2.1.9-rc02-3390475e02`; the two targets do not exist.
- The source has zero duplicate groups at `ymd_id,sid,msku`.
- Exact `sid+msku+[start_date,end_date]` resolution maps 380,460 of 1,030,852 source keys and leaves 650,392 unresolved in the 2026 window; no exact multi-match was observed.
- The repaired zipper has zero null SIDs. Its 134 transitions all satisfy `next_start = end_date + 1 day`, confirming closed-interval storage; the 2026-05-29/30 boundary for `8010A-BL28-FBM` resolves to `ZX-8010S-BL28` and `8010S-BL28` respectively.
- The luggage product dimension has `16` SPUs with conflicting normalized `product_level` values in the 2026 candidate scope.
- The zipper covers the 2026 historical boundary, but 650,392 source keys have no exact `sid+msku` relation, and no trusted completion Asset exists in this ETL repository for `dws.dws_stock_analysis_monthly_sku`.

These are implementation gates, not reasons to weaken the approved contract. Re-run Task 0 against live data because counts can change after upstream repair.

## Table Inventory

### Permanent Business Tables

| Table                                    | Grain / Unique Key    | Purpose                              |
| ---------------------------------------- | --------------------- | ------------------------------------ |
| `ads.ads_pdm_lx_hot_product_index_sku_d` | `sales_date,sid,msku` | 完整日事实、流量指标与销售额漏斗底表 |
| `ads.ads_pdm_lx_hot_product_index_sku_m` | `ym,sid,msku,sku`     | 结束月数量指标与 SPU 数漏斗底表      |

### Runtime Staging Tables

以下表由 `00_prepare_staging.sql` 在每批开始时 `DROP TABLE IF EXISTS` 后重建；`max_active_runs=1` 保证只有一个写批次。成功批次由 `90_cleanup_staging.sql` 删除，失败批次保留到下一次明确重跑前供诊断。

| Physical name                                                     | Declared key                          | Independent responsibility                                |
| ----------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `ads.ads_pdm_lx_hot_product_index_batch_month_staging`            | `ym`                                  | `coverage_end_date`、`source_complete_flag`、可信完成时间 |
| `ads.ads_pdm_lx_hot_product_index_sku_resolved_source_staging`    | `sales_date,sid,msku`                 | 只完成源 SKU/拉链 SKU 唯一解析，尚未做商品域过滤          |
| `ads.ads_pdm_lx_hot_product_index_domain_source_identity_staging` | `sales_date,sid,msku`                 | 完成商品唯一性与拉杆箱域过滤，尚未连接卖家                |
| `ads.ads_pdm_lx_hot_product_index_resolved_source_staging`        | `sales_date,sid,msku`                 | 完成卖家、商品、等级维度后的权威源事实                    |
| `ads.ads_pdm_lx_hot_product_index_batch_relation_staging`         | `sid,msku,sku,start_date`             | 本批候选相关的原始左闭右开拉链区间，不去重                |
| `ads.ads_pdm_lx_hot_product_index_candidate_sku_staging`          | `ym,sku`                              | 域内源 SKU 与完整月份域内库存 SKU 的独立并集              |
| `ads.ads_pdm_lx_hot_product_index_eligibility_staging`            | `ym,sku`                              | 全渠道月销量、库存、资格值、资格标记                      |
| `ads.ads_pdm_lx_hot_product_index_eligible_identity_staging`      | `ym,sid,msku,sku,identity_start_date` | 资格为 1 的左闭右开有效身份集合                           |
| `ads.ads_pdm_lx_hot_product_index_calendar_staging`               | `sales_date`                          | 本批连续自然日集合                                        |
| `ads.ads_pdm_lx_hot_product_index_daily_staging`                  | `sales_date,sid,msku`                 | 发布前日目标完整候选                                      |
| `ads.ads_pdm_lx_hot_product_index_monthly_staging`                | `ym,sid,msku,sku`                     | 仅从日候选聚合的月目标完整候选                            |

不新增持久化运行审计表。zero-source 月、门禁明细和发布结果写入 Airflow DAG/task run 日志并固化到本计划指定的生产验收报告；批准水位从两张目标表一致的 `MAX(data_through_date)` 读取。若后续决定使用发布清单或双缓冲路由表解决 BI 读隔离，必须先补充独立设计，不在本计划中暗加第三张永久表。

## File Map

所有下列实施路径均相对于 `/Users/zewe/code-workspace/etl`：

- Create `ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql`: 日表静态 DDL。
- Create `ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql`: 月表静态 DDL。
- Create `scripts/hot_product_index_ddl_bootstrap.py`: 默认 dry-run、显式 `--apply` 的建表入口。
- Create `scripts/hot_product_index_doris_capability_probe.py`: 只在 `agent_temp` 验证分区、临时分区、替换和回滚能力。
- Create `include/processors/hot_product_index_runtime.py`: 月份解析、批次上下文、门禁执行、分区发布与补偿。
- Create directory `include/sql/ads/pdm/hot_product_index/`: staging 构建、校验和清理 SQL。
- Create directory `include/sql/validation/hot_product_index/`: 生产前置与最终验收只读 SQL。
- Create `dags/ADS/pdm/__init__.py` and `dags/ADS/pdm/hot_product_index.py`: Airflow 编排。
- Modify `assets/ads.py`: 增加两张 ADS Asset，且只增加一次。
- Create five focused test files named `test/test_hot_product_index_*.py`.
- Create `docs/validation/hot_product_index_ddl_bootstrap.md`: DDL 执行与回滚说明。
- Create `docs/reports/2026-08-03-hot-product-index-data-acceptance.md`: 生产证据模板与最终结果。

---

### Task 0: Freeze Preconditions and Expose Current Blockers

**Files:**

- Create: `include/sql/validation/hot_product_index/preflight.sql`
- Create: `test/test_hot_product_index_preflight_contract.py`
- Create: `docs/reports/2026-08-03-hot-product-index-data-acceptance.md`

**Interfaces:**

- Consumes: the source, closed-interval zipper, product, seller, grade, and stock contracts from the approved design.
- Produces: a read-only result set with columns `check_name VARCHAR`, `error_count BIGINT`; a human evidence report that records Git SHA, Doris version, source coverage and blocker counts.

**Decision Gate 0:** The 2026-08-05 zipper repair removed all null SIDs and the approved 2026-05-29/30 closed-interval boundary now resolves exactly once. Publication remains blocked because 650,392 source keys still lack an exact `sid + msku` relation and 16 candidate SPUs retain conflicting normalized `product_level` values. Changing to `msku + interval`, order-derived identity, `ROW_NUMBER() = 1`, or any arbitrary-row rule remains an unapproved fallback.

- [ ] **Step 1: Write the failing preflight contract test**

```python
from pathlib import Path

SQL = Path("include/sql/validation/hot_product_index/preflight.sql")


def test_preflight_is_read_only_and_names_every_blocker() -> None:
    sql = SQL.read_text(encoding="utf-8")
    assert sql.lstrip().upper().startswith("WITH")
    assert "source_duplicate_key" in sql
    assert "missing_exact_zipper_mapping" in sql
    assert "zipper_sid_missing" in sql
    assert "zipper_closed_interval_invalid" in sql
    assert "zipper_closed_boundary_fixture" in sql
    assert "zipper_history_not_covered" in sql
    assert "product_level_conflict" in sql
    assert "stock_duplicate_key" in sql
    assert "ROW_NUMBER" not in sql.upper()
    assert all(token not in sql.upper() for token in ("INSERT ", "UPDATE ", "DELETE ", "ALTER ", "DROP "))
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_preflight_contract.py`

Expected: FAIL because `preflight.sql` does not exist.

- [ ] **Step 3: Implement the read-only preflight query**

Use CTEs and a final `UNION ALL`; the exact-join section must remain:

```sql
WITH batch_source AS (
  SELECT ymd_id AS sales_date, sid, msku, sku
  FROM ling_xing.lx_web_product_performance_msku_list
  WHERE ymd_id >= DATE('2026-01-01')
    AND ymd_id < DATE('2027-01-01')
), source_duplicates AS (
  SELECT sales_date, sid, msku
  FROM batch_source
  GROUP BY sales_date, sid, msku
  HAVING COUNT(*) <> 1
), missing_mapping AS (
  SELECT s.sales_date, s.sid, s.msku
  FROM batch_source s
  LEFT JOIN dim.dim_product_relation_zipper z
    ON z.sid = s.sid
   AND z.msku = s.msku
   AND s.sales_date >= z.start_date
   AND s.sales_date <= z.end_date
  WHERE (s.sku IS NULL OR TRIM(s.sku) = '')
  GROUP BY s.sales_date, s.sid, s.msku
  HAVING COUNT(z.sku) <> 1
), level_conflict AS (
  SELECT spu
  FROM dim.dim_product
  WHERE org_id = 1 AND category = '拉杆箱'
  GROUP BY spu
  HAVING COUNT(DISTINCT IF(product_level IS NULL OR TRIM(product_level) = '', '未评级', TRIM(product_level))) > 1
), zipper_transitions AS (
  SELECT sid, msku, start_date, end_date,
         LEAD(start_date) OVER (
           PARTITION BY sid, msku
           ORDER BY start_date, end_date, sku
         ) AS next_start
  FROM dim.dim_product_relation_zipper
), invalid_closed_intervals AS (
  SELECT sid, msku
  FROM zipper_transitions
  WHERE start_date > end_date
     OR (next_start IS NOT NULL AND DATEDIFF(next_start, end_date) <> 1)
), boundary_fixture AS (
  SELECT DATE('2026-05-29') AS sales_date, '2613' AS sid,
         '8010A-BL28-FBM' AS msku, 'ZX-8010S-BL28' AS expected_sku
  UNION ALL
  SELECT DATE('2026-05-30'), '2613', '8010A-BL28-FBM', '8010S-BL28'
), invalid_boundary_fixture AS (
  SELECT f.sales_date, f.sid, f.msku
  FROM boundary_fixture f
  LEFT JOIN dim.dim_product_relation_zipper z
    ON z.sid = f.sid
   AND z.msku = f.msku
   AND f.sales_date >= z.start_date
   AND f.sales_date <= z.end_date
  GROUP BY f.sales_date, f.sid, f.msku, f.expected_sku
  HAVING COUNT(z.sku) <> 1
     OR COALESCE(MAX(z.sku), '') <> f.expected_sku
)
SELECT 'source_duplicate_key' AS check_name, COUNT(*) AS error_count FROM source_duplicates
UNION ALL
SELECT 'missing_exact_zipper_mapping', COUNT(*) FROM missing_mapping
UNION ALL
SELECT 'zipper_sid_missing', COUNT(*)
FROM dim.dim_product_relation_zipper
WHERE sid IS NULL OR TRIM(sid) = ''
UNION ALL
SELECT 'zipper_closed_interval_invalid', COUNT(*) FROM invalid_closed_intervals
UNION ALL
SELECT 'zipper_closed_boundary_fixture', COUNT(*) FROM invalid_boundary_fixture
UNION ALL
SELECT 'zipper_history_not_covered', IF(MIN(start_date) > DATE('2026-01-01'), 1, 0)
FROM dim.dim_product_relation_zipper
UNION ALL
SELECT 'product_level_conflict', COUNT(*) FROM level_conflict
UNION ALL
SELECT 'stock_duplicate_key', COUNT(*)
FROM (
  SELECT ym, sku FROM dws.dws_stock_analysis_monthly_sku
  GROUP BY ym, sku HAVING COUNT(*) <> 1
) bad
```

- [ ] **Step 4: Run static tests and the production read-only query**

Run:

```bash
cd /Users/zewe/code-workspace/etl
python3 -m pytest -q test/test_hot_product_index_preflight_contract.py
python3 .agents/skills/datawarehouse-schema-explorer/scripts/query_doris.py \
  --no-filter "$(< include/sql/validation/hot_product_index/preflight.sql)"
```

Expected static result: PASS. Current production result has zero source duplicates, null SIDs, invalid closed intervals, history-boundary failures, and stock duplicates; exact identity coverage and product-level conflicts remain nonzero. Record actual values rather than changing the query to force green.

- [ ] **Step 5: Record all hard prerequisites in the evidence report**

The report must include these facts and exit criteria:

```text
Mapping: exact sid+msku+[start,end]; exit only when the 2026-05-29/30 fixture returns one row each.
History: every non-empty source month in the approved 2026 scope has exact zipper coverage.
Product level: eligible ym+spu conflict count is zero; the observed 16 conflicts are upstream-owned.
Readiness: ODS daily source and monthly stock expose trusted completion metadata; MAX(date) is not accepted.
Git: execution SHA is recorded and the implementation worktree is clean before changes.
Publication: disposable Doris probe proves new partition, replacement and compensating rollback.
```

- [ ] **Step 6: Commit the preflight contract**

```bash
git add include/sql/validation/hot_product_index/preflight.sql \
  test/test_hot_product_index_preflight_contract.py \
  docs/reports/2026-08-03-hot-product-index-data-acceptance.md
git commit -m "test(ads): codify hot product index preflight gates"
```

### Task 1: Prove Doris Auto-Partition Overwrite and Rollback

**Files:**

- Create: `scripts/hot_product_index_doris_capability_probe.py`
- Create: `test/test_hot_product_index_publication_contract.py`

**Interfaces:**

- Consumes: `execute_str_sql("doris", sql)` and `query_str_sql("doris", sql)`.
- Produces: `run_probe(apply: bool) -> tuple[CapabilityResult, ...]`; immutable `CapabilityResult(name: str, passed: bool, details: str)`.
- Produces: `execute_probe_overwrite(connection, sql: str) -> None`, which sets `enable_auto_create_when_overwrite=true` and executes the supplied `INSERT OVERWRITE TABLE` statement with `PARTITION(*)` on the same Doris connection.
- Safety boundary: every write name starts with `agent_temp.ads_pdm_lx_hot_product_index_probe_`; default invocation prints SQL only; `--apply` is authorized solely for disposable `agent_temp` objects.

- [ ] **Step 1: Write failure-path tests first**

```python
from unittest.mock import Mock

import pytest

from etl.scripts.hot_product_index_doris_capability_probe import publish_pair


def test_monthly_failure_restores_daily_and_keeps_backups() -> None:
    execute = Mock(side_effect=[None, RuntimeError("injected monthly failure"), None])
    with pytest.raises(RuntimeError, match="injected monthly failure"):
        publish_pair(
            execute,
            daily_replace="INSERT OVERWRITE TABLE agent_temp.probe_d PARTITION(*) SELECT * FROM agent_temp.probe_d_stage",
            monthly_replace="INSERT OVERWRITE TABLE agent_temp.probe_m PARTITION(*) SELECT * FROM agent_temp.probe_m_stage",
            daily_restore="INSERT OVERWRITE TABLE agent_temp.probe_d PARTITION(*) SELECT * FROM agent_temp.probe_d_backup",
        )
    assert "probe_d_backup" in execute.call_args_list[2].args[0]


def test_probe_rejects_non_agent_temp_database() -> None:
    with pytest.raises(ValueError, match="agent_temp"):
        publish_pair(Mock(), "ads.daily", "ads.monthly", "ads.restore")
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd /Users/zewe/code-workspace && PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q etl/test/test_hot_product_index_publication_contract.py`

Expected: FAIL because the probe module does not exist.

- [ ] **Step 3: Implement the disposable capability probe**

The probe must execute both RANGE and LIST examples and prove that replaced regular partitions retain their names:

```sql
CREATE TABLE agent_temp.ads_pdm_lx_hot_product_index_probe_d (
  sales_date DATE NOT NULL,
  sid VARCHAR(255) NOT NULL,
  msku VARCHAR(255) NOT NULL,
  value BIGINT NOT NULL
)
UNIQUE KEY(sales_date, sid, msku)
AUTO PARTITION BY RANGE (date_trunc(sales_date, 'month')) ()
DISTRIBUTED BY HASH(sid, msku) BUCKETS 1
PROPERTIES("replication_num"="1", "enable_unique_key_merge_on_write"="true");

CREATE TABLE agent_temp.ads_pdm_lx_hot_product_index_probe_m (
  ym VARCHAR(7) NOT NULL,
  sid VARCHAR(255) NOT NULL,
  msku VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  value BIGINT NOT NULL
)
UNIQUE KEY(ym, sid, msku, sku)
AUTO PARTITION BY LIST (ym) ()
DISTRIBUTED BY HASH(sid, msku) BUCKETS 1
PROPERTIES("replication_num"="1", "enable_unique_key_merge_on_write"="true");
```

For each table the script must load an old May row, copy it into a separate `CREATE TABLE LIKE` rollback table, and prepare staging with a changed May row plus a new June row. On one retained Doris connection execute:

```sql
SET enable_auto_create_when_overwrite = true;
INSERT OVERWRITE TABLE agent_temp.ads_pdm_lx_hot_product_index_probe_d
PARTITION(*)
SELECT * FROM agent_temp.ads_pdm_lx_hot_product_index_probe_d_staging;
```

Run the equivalent statement for `probe_m`. Prove that the existing May partition is atomically replaced, June is auto-created, unrelated partitions remain unchanged, May can be restored from the rollback table, and the newly created June partition can be discovered and dropped during compensation. This specifically covers the initial load where no formal target partition exists.

Implement the failure compensation exactly:

```python
def publish_pair(execute, daily_replace: str, monthly_replace: str, daily_restore: str) -> None:
    for sql in (daily_replace, monthly_replace, daily_restore):
        if "agent_temp." not in sql:
            raise ValueError("capability probe may only mutate agent_temp")
    execute(daily_replace)
    try:
        execute(monthly_replace)
    except Exception:
        execute(daily_restore)
        raise
```

- [ ] **Step 4: Run tests, dry-run, then authorized disposable probe**

Run:

```bash
cd /Users/zewe/code-workspace
PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q etl/test/test_hot_product_index_publication_contract.py
cd etl
python3 scripts/hot_product_index_doris_capability_probe.py
python3 scripts/hot_product_index_doris_capability_probe.py --apply
```

Expected: tests PASS; dry-run performs no DDL; authorized probe reports PASS for `auto_range`, `auto_list`, `partition_star_existing_replace`, `partition_star_auto_create`, `restore_existing_partition`, `drop_new_partition`, and `compensating_restore`, then drops all probe objects.

- [ ] **Step 5: Commit the capability probe**

```bash
git add scripts/hot_product_index_doris_capability_probe.py \
  test/test_hot_product_index_publication_contract.py
git commit -m "test(ads): prove hot product index partition publication"
```

### Task 2: Create the Two Static DDLs and Dry-Run Bootstrap

**Files:**

- Create: `ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql`
- Create: `ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql`
- Create: `scripts/hot_product_index_ddl_bootstrap.py`
- Create: `test/test_hot_product_index_ddl_contract.py`
- Create: `docs/validation/hot_product_index_ddl_bootstrap.md`

**Interfaces:**

- Produces physical tables with the exact approved columns and keys.
- Produces `DDL_FILES: tuple[str, str]` and `main(argv: Sequence[str] | None = None) -> int`; no DAG task may create permanent targets.

- [ ] **Step 1: Write the exact DDL contract test**

```python
from pathlib import Path

DAILY = Path("ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql")
MONTHLY = Path("ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql")


def test_daily_storage_contract() -> None:
    sql = DAILY.read_text(encoding="utf-8")
    assert "UNIQUE KEY(sales_date, sid, msku)" in sql
    assert "AUTO PARTITION BY RANGE (date_trunc(sales_date, 'month')) ()" in sql
    assert "DISTRIBUTED BY HASH(sid, msku) BUCKETS 16" in sql
    assert sql.index("sales_date DATE") < sql.index("ym VARCHAR(7)")


def test_monthly_storage_contract() -> None:
    sql = MONTHLY.read_text(encoding="utf-8")
    assert "UNIQUE KEY(ym, sid, msku, sku)" in sql
    assert "AUTO PARTITION BY LIST (ym) ()" in sql
    assert "DISTRIBUTED BY HASH(sid, msku) BUCKETS 16" in sql
    assert "RANGE" not in sql.upper()
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_ddl_contract.py`

Expected: FAIL because the DDL files do not exist.

- [ ] **Step 3: Implement the daily DDL exactly**

```sql
CREATE TABLE IF NOT EXISTS ads.ads_pdm_lx_hot_product_index_sku_d (
  sales_date DATE NOT NULL,
  sid VARCHAR(255) NOT NULL,
  msku VARCHAR(255) NOT NULL,
  ym VARCHAR(7) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  spu VARCHAR(255) NOT NULL,
  company_sku VARCHAR(255) NULL,
  channel VARCHAR(64) NOT NULL,
  product_line VARCHAR(100) NULL,
  country VARCHAR(64) NOT NULL,
  size VARCHAR(100) NULL,
  color VARCHAR(100) NULL,
  developer VARCHAR(255) NULL,
  model VARCHAR(255) NULL,
  sku_level VARCHAR(255) NULL,
  product_level VARCHAR(255) NOT NULL,
  sales_qty BIGINT NOT NULL,
  sales_amount_usd DECIMAL(20,4) NOT NULL,
  gross_profit_usd DECIMAL(20,4) NOT NULL,
  return_goods_qty BIGINT NOT NULL,
  sku_month_sales_qty BIGINT NOT NULL,
  theoretical_stock_qty DECIMAL(18,2) NOT NULL,
  eligibility_value DECIMAL(20,2) NOT NULL,
  is_eligible TINYINT NOT NULL,
  is_generated_zero TINYINT NOT NULL,
  data_through_date DATE NOT NULL,
  source_updated_at DATETIME NOT NULL,
  etl_batch_id VARCHAR(64) NOT NULL,
  etl_loaded_at DATETIME NOT NULL
)
UNIQUE KEY(sales_date, sid, msku)
AUTO PARTITION BY RANGE (date_trunc(sales_date, 'month')) ()
DISTRIBUTED BY HASH(sid, msku) BUCKETS 16
PROPERTIES(
  "replication_num"="1",
  "enable_unique_key_merge_on_write"="true",
  "light_schema_change"="true"
);
```

- [ ] **Step 4: Implement the monthly DDL exactly**

```sql
CREATE TABLE IF NOT EXISTS ads.ads_pdm_lx_hot_product_index_sku_m (
  ym VARCHAR(7) NOT NULL,
  sid VARCHAR(255) NOT NULL,
  msku VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  month_start_date DATE NOT NULL,
  spu VARCHAR(255) NOT NULL,
  company_sku VARCHAR(255) NULL,
  channel VARCHAR(64) NOT NULL,
  product_line VARCHAR(100) NULL,
  country VARCHAR(64) NOT NULL,
  size VARCHAR(100) NULL,
  color VARCHAR(100) NULL,
  developer VARCHAR(255) NULL,
  model VARCHAR(255) NULL,
  sku_level VARCHAR(255) NULL,
  product_level VARCHAR(255) NOT NULL,
  sales_qty BIGINT NOT NULL,
  sales_amount_usd DECIMAL(20,4) NOT NULL,
  gross_profit_usd DECIMAL(20,4) NOT NULL,
  return_goods_qty BIGINT NOT NULL,
  sku_month_sales_qty BIGINT NOT NULL,
  theoretical_stock_qty DECIMAL(18,2) NOT NULL,
  eligibility_value DECIMAL(20,2) NOT NULL,
  is_eligible TINYINT NOT NULL,
  data_through_date DATE NOT NULL,
  source_updated_at DATETIME NOT NULL,
  etl_batch_id VARCHAR(64) NOT NULL,
  etl_loaded_at DATETIME NOT NULL
)
UNIQUE KEY(ym, sid, msku, sku)
AUTO PARTITION BY LIST (ym) ()
DISTRIBUTED BY HASH(sid, msku) BUCKETS 16
PROPERTIES(
  "replication_num"="1",
  "enable_unique_key_merge_on_write"="true",
  "light_schema_change"="true"
);
```

- [ ] **Step 5: Implement the bootstrap and its dry-run test**

```python
DDL_FILES = (
    "ads/ads_pdm_lx_hot_product_index_sku_d.sql",
    "ads/ads_pdm_lx_hot_product_index_sku_m.sql",
)


def execute_ddl(relative_path: str, apply: bool) -> None:
    path = REPO_ROOT / "ddl" / relative_path
    if not path.is_file():
        raise FileNotFoundError(path)
    if apply:
        execute_str_sql("doris", path.read_text(encoding="utf-8"))
    else:
        print(f"would execute {path.relative_to(REPO_ROOT)}")
```

The test must monkeypatch `execute_str_sql`, call `main([])`, and assert zero DB calls; then call `main(["--apply"])` and assert exactly two calls in `DDL_FILES` order. The runbook must show dry-run, authorized apply, `SHOW CREATE TABLE`, and a refusal to use the DAG for static DDL.

- [ ] **Step 6: Run focused tests and the dry-run bootstrap**

Run:

```bash
cd /Users/zewe/code-workspace/etl
python3 -m pytest -q test/test_hot_product_index_ddl_contract.py
python3 scripts/hot_product_index_ddl_bootstrap.py
```

Expected: PASS; output contains `would execute ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql` and `would execute ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql`, and no production DDL is executed.

- [ ] **Step 7: Commit the DDL unit**

```bash
git add ddl/ads/ads_pdm_lx_hot_product_index_sku_d.sql \
  ddl/ads/ads_pdm_lx_hot_product_index_sku_m.sql \
  scripts/hot_product_index_ddl_bootstrap.py \
  test/test_hot_product_index_ddl_contract.py \
  docs/validation/hot_product_index_ddl_bootstrap.md
git commit -m "feat(ads): define hot product index tables"
```

### Task 3: Implement Batch Context, Watermark, and Validation Runtime

**Files:**

- Create: `include/processors/hot_product_index_runtime.py`
- Create: `test/test_hot_product_index_runtime.py`

**Interfaces:**

- Produces `RunMode`, `PublicationMode`, `BatchMonth`, `UpstreamCompletion`, `HotProductIndexRunContext`, `parse_ym`, `iter_batch_months`, `resolve_approved_watermark`, `build_run_context`, `render_sql`, `batch_month_insert_sql`, and `assert_zero_counts` with the exact signatures below.
- Consumes only explicit Airflow context and trusted upstream completion metadata; no function may infer completeness from `MAX(ymd_id)`.

- [ ] **Step 1: Write strict context tests first**

```python
from datetime import date, datetime

import pytest

from etl.include.processors.hot_product_index_runtime import (
    UpstreamCompletion,
    build_run_context,
    parse_ym,
)


def test_parse_ym_rejects_noncanonical_values() -> None:
    for value in ("202608", "2026-8", "2026-13", ""):
        with pytest.raises(ValueError):
            parse_ym(value)


def test_backfill_copies_approved_watermark() -> None:
    completion = UpstreamCompletion(
        source_coverage_end_date=date(2026, 7, 31),
        source_completed_at=datetime(2026, 8, 1, 2, 0),
        stock_ready_yms=frozenset({"2026-07"}),
        complete_source_yms=frozenset({"2026-07"}),
        audited_source_gap_yms=frozenset(),
    )
    context = build_run_context(
        mode="backfill",
        start_ym="2026-07",
        end_ym="2026-07",
        candidate_watermark=date(2026, 8, 2),
        approved_watermark=date(2026, 8, 1),
        completion=completion,
        etl_batch_id="manual__2026-08-03T00:00:00+00:00",
    )
    assert context.data_through_date == date(2026, 8, 1)
    assert context.may_advance_watermark is False


def test_bootstrap_accepts_audited_gaps_and_establishes_watermark() -> None:
    completion = UpstreamCompletion(
        source_coverage_end_date=date(2024, 7, 31),
        source_completed_at=datetime(2024, 8, 1, 2, 0),
        stock_ready_yms=frozenset({"2023-05", "2024-07"}),
        complete_source_yms=frozenset({"2023-05", "2024-07"}),
        audited_source_gap_yms=frozenset(
            {
                "2023-06", "2023-07", "2023-08", "2023-09", "2023-10",
                "2023-11", "2023-12", "2024-01", "2024-02", "2024-03",
                "2024-04", "2024-05", "2024-06",
            }
        ),
    )
    context = build_run_context(
        mode="bootstrap",
        start_ym="2023-05",
        end_ym="2024-07",
        candidate_watermark=date(2024, 7, 31),
        approved_watermark=None,
        completion=completion,
        etl_batch_id="manual__bootstrap_20260803",
    )
    assert context.data_through_date == date(2024, 7, 31)
    assert context.may_advance_watermark is True
    assert any(not month.source_complete_flag for month in context.months)
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd /Users/zewe/code-workspace && PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q etl/test/test_hot_product_index_runtime.py`

Expected: FAIL because the runtime module does not exist.

- [ ] **Step 3: Implement the immutable runtime types**

```python
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

RunMode = Literal["daily", "backfill", "bootstrap"]
PublicationMode = Literal["validate_only", "publish"]


@dataclass(frozen=True)
class BatchMonth:
    ym: str
    month_start_date: date
    month_end_date_exclusive: date
    coverage_end_date: date
    source_complete_flag: bool


@dataclass(frozen=True)
class UpstreamCompletion:
    source_coverage_end_date: date
    source_completed_at: datetime
    stock_ready_yms: frozenset[str]
    complete_source_yms: frozenset[str]
    audited_source_gap_yms: frozenset[str]


@dataclass(frozen=True)
class HotProductIndexRunContext:
    mode: RunMode
    start_ym: str
    end_ym: str
    months: tuple[BatchMonth, ...]
    candidate_watermark: date
    data_through_date: date
    may_advance_watermark: bool
    source_completed_at: datetime
    etl_batch_id: str
    publication_mode: PublicationMode
```

`parse_ym(value: str) -> date` must round-trip exactly through `%Y-%m`. Implement this exact context signature:

```python
def build_run_context(
    *,
    mode: RunMode,
    start_ym: str,
    end_ym: str,
    candidate_watermark: date,
    approved_watermark: date | None,
    completion: UpstreamCompletion,
    etl_batch_id: str,
    publication_mode: PublicationMode = "publish",
) -> HotProductIndexRunContext:
    start = parse_ym(start_ym)
    end = parse_ym(end_ym)
    if start > end:
        raise ValueError("start_ym must not be after end_ym")
    if not etl_batch_id or len(etl_batch_id) > 64:
        raise ValueError("etl_batch_id must contain 1..64 characters")
    if publication_mode not in ("validate_only", "publish"):
        raise ValueError(f"unsupported publication mode: {publication_mode}")
    months = iter_batch_months(
        start_ym=start_ym,
        end_ym=end_ym,
        candidate_watermark=candidate_watermark,
        complete_source_yms=completion.complete_source_yms,
    )
    requested_yms = {month.ym for month in months}
    complete_requested = requested_yms & completion.complete_source_yms
    audited_gaps = requested_yms & completion.audited_source_gap_yms
    unknown_coverage = requested_yms - complete_requested - audited_gaps
    overlapping_coverage = complete_requested & audited_gaps
    if unknown_coverage or overlapping_coverage:
        raise ValueError(
            f"invalid source coverage: unknown={sorted(unknown_coverage)}, "
            f"overlap={sorted(overlapping_coverage)}"
        )
    missing_stock = complete_requested - completion.stock_ready_yms
    if missing_stock:
        raise ValueError(f"stock completion missing for {sorted(missing_stock)}")
    if mode == "daily":
        if audited_gaps:
            raise ValueError("daily run cannot target an audited source gap")
        if candidate_watermark > completion.source_coverage_end_date:
            raise ValueError("candidate watermark exceeds trusted source coverage")
        data_through_date = candidate_watermark
        may_advance_watermark = True
    elif mode == "backfill":
        if approved_watermark is None:
            raise ValueError("backfill requires an approved watermark")
        data_through_date = approved_watermark
        may_advance_watermark = False
    elif mode == "bootstrap":
        candidate_ym = candidate_watermark.strftime("%Y-%m")
        if approved_watermark is not None:
            raise ValueError("bootstrap requires empty targets and no approved watermark")
        if candidate_ym not in complete_requested:
            raise ValueError("bootstrap must include the latest complete candidate month")
        data_through_date = candidate_watermark
        may_advance_watermark = True
    else:
        raise ValueError(f"unsupported run mode: {mode}")
    return HotProductIndexRunContext(
        mode=mode,
        start_ym=start_ym,
        end_ym=end_ym,
        months=months,
        candidate_watermark=candidate_watermark,
        data_through_date=data_through_date,
        may_advance_watermark=may_advance_watermark,
        source_completed_at=completion.source_completed_at,
        etl_batch_id=etl_batch_id,
        publication_mode=publication_mode,
    )
```

`iter_batch_months(start_ym: str, end_ym: str, candidate_watermark: date, complete_source_yms: frozenset[str]) -> tuple[BatchMonth, ...]` assigns ended months their calendar month-end and the candidate's month the candidate watermark. It sets `source_complete_flag` strictly from `complete_source_yms`; audited gaps remain in `batch_month_staging` with flag 0 and never feed candidates. A daily run sets `data_through_date=candidate_watermark` and `may_advance_watermark=True`; a backfill copies the approved value and sets it false; the first full-history bootstrap establishes the initial watermark only when it includes the latest complete month.

- [ ] **Step 4: Implement the shared validation and SQL rendering functions**

```python
def render_sql(relative_path: str, context: HotProductIndexRunContext) -> str:
    return load_sql(relative_path).format(
        start_ym=context.start_ym,
        end_ym=context.end_ym,
        batch_start_date=context.months[0].month_start_date.isoformat(),
        batch_end_date=context.months[-1].coverage_end_date.isoformat(),
        data_through_date=context.data_through_date.isoformat(),
        source_completed_at=context.source_completed_at.isoformat(sep=" "),
        etl_batch_id=context.etl_batch_id,
    )


def batch_month_insert_sql(context: HotProductIndexRunContext) -> str:
    rows = ",\n".join(
        "("
        f"'{month.ym}', DATE('{month.month_start_date.isoformat()}'), "
        f"DATE('{month.month_end_date_exclusive.isoformat()}'), "
        f"DATE('{month.coverage_end_date.isoformat()}'), "
        f"{int(month.source_complete_flag)}, "
        f"CAST('{context.source_completed_at.isoformat(sep=' ')}' AS DATETIME)"
        ")"
        for month in context.months
    )
    return (
        "INSERT INTO ads.ads_pdm_lx_hot_product_index_batch_month_staging "
        "(ym,month_start_date,month_end_date_exclusive,coverage_end_date,"
        "source_complete_flag,source_completed_at) VALUES\n"
        f"{rows}"
    )


def assert_zero_counts(sql: str) -> dict[str, int]:
    frame = query_str_sql("doris", sql)
    required = {"check_name", "error_count"}
    if not required.issubset(frame.columns):
        raise ValueError("validation query must return check_name,error_count")
    result = {str(row.check_name): int(row.error_count) for row in frame.itertuples()}
    failures = {name: count for name, count in result.items() if count != 0}
    if failures:
        raise ValueError(f"hot product index validation failed: {failures}")
    return result
```

`resolve_approved_watermark() -> date | None` must query both targets independently. It returns `None` only when both are absent/empty; otherwise each table must contain one global max and the two maxima must be equal, or it raises before staging construction.

- [ ] **Step 5: Add tests for watermark mismatch and malformed validation results**

```python
def test_validation_rejects_nonzero_counts(monkeypatch) -> None:
    frame = pandas.DataFrame([{"check_name": "missing_stock", "error_count": 1}])
    monkeypatch.setattr(runtime, "query_str_sql", lambda *_: frame)
    with pytest.raises(ValueError, match="missing_stock"):
        runtime.assert_zero_counts("SELECT 1")
```

- [ ] **Step 6: Run and commit the runtime unit**

Run: `cd /Users/zewe/code-workspace && PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q etl/test/test_hot_product_index_runtime.py`

Expected: PASS.

```bash
cd /Users/zewe/code-workspace/etl
git add include/processors/hot_product_index_runtime.py \
  test/test_hot_product_index_runtime.py
git commit -m "feat(ads): add hot product index batch runtime"
```

### Task 4: Build Source Resolution and Dimension Staging

**Files:**

- Create: `include/sql/ads/pdm/hot_product_index/00_prepare_staging.sql`
- Create: `include/sql/ads/pdm/hot_product_index/10_build_source_resolution.sql`
- Create: `test/test_hot_product_index_sql_contract.py`

**Interfaces:**

- Consumes formatting keys produced by `render_sql` and `BatchMonth` rows inserted by the DAG.
- Produces the first five runtime staging tables from the inventory: batch month, raw relation, SKU-resolved source, domain source identity, and fully resolved source.
- Every staging table uses `DUPLICATE KEY` at its declared logical grain so duplicate input remains observable. Do not use UNIQUE KEY for staging because Merge-on-Write could hide a failed uniqueness contract.

**Prerequisite:** The exact `sid + msku` zipper repair in Decision Gate 0 must be approved before this task is merged. Unit SQL fixtures may be written before production repair, but no live source build may be treated as passing.

- [ ] **Step 1: Write the SQL anti-fallback tests**

```python
from pathlib import Path

ROOT = Path("include/sql/ads/pdm/hot_product_index")


def test_source_resolution_uses_exact_closed_relation() -> None:
    sql = (ROOT / "10_build_source_resolution.sql").read_text(encoding="utf-8")
    normalized = " ".join(sql.split()).lower()
    assert "z.sid = s.sid" in normalized
    assert "z.msku = s.msku" in normalized
    assert "s.ymd_id >= z.start_date" in normalized
    assert "s.ymd_id <= z.end_date" in normalized
    assert "s.ymd_id <= date('{batch_end_date}')" in normalized
    assert "return_goods_count" in normalized
    assert "return_count" not in normalized
    assert "row_number" not in normalized


def test_staging_tables_preserve_duplicates() -> None:
    sql = (ROOT / "00_prepare_staging.sql").read_text(encoding="utf-8").upper()
    assert sql.count("DUPLICATE KEY") == 11
    assert "UNIQUE KEY" not in sql
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py`

Expected: FAIL because both SQL files do not exist.

- [ ] **Step 3: Create all staging schemas with source-compatible types**

`00_prepare_staging.sql` must drop the 11 fixed staging names in reverse dependency order, then create all 11 with `replication_num=1`. Use the table inventory logical keys as `DUPLICATE KEY` prefixes. The source-resolved table must at least contain:

```sql
CREATE TABLE ads.ads_pdm_lx_hot_product_index_batch_month_staging (
  ym VARCHAR(7) NOT NULL,
  month_start_date DATE NOT NULL,
  month_end_date_exclusive DATE NOT NULL,
  coverage_end_date DATE NOT NULL,
  source_complete_flag TINYINT NOT NULL,
  source_completed_at DATETIME NOT NULL
)
DUPLICATE KEY(ym)
DISTRIBUTED BY HASH(ym) BUCKETS 1
PROPERTIES("replication_num"="1");
```

Then create the source-resolved table:

```sql
CREATE TABLE ads.ads_pdm_lx_hot_product_index_sku_resolved_source_staging (
  sales_date DATE NOT NULL,
  sid VARCHAR(255) NOT NULL,
  msku VARCHAR(255) NOT NULL,
  source_sku VARCHAR(255) NULL,
  sku VARCHAR(255) NULL,
  mapping_count BIGINT NOT NULL,
  sales_qty BIGINT NULL,
  sales_amount_usd DECIMAL(20,4) NULL,
  gross_profit_usd DECIMAL(20,4) NULL,
  return_goods_qty BIGINT NULL,
  source_updated_at DATETIME NULL
)
DUPLICATE KEY(sales_date, sid, msku)
DISTRIBUTED BY HASH(sid, msku) BUCKETS 16
PROPERTIES("replication_num"="1");
```

`daily_staging` and `monthly_staging` must repeat the approved target columns and types but use their logical keys as `DUPLICATE KEY`. `batch_relation_staging` must preserve every raw zipper row with `sid,msku,sku,start_date,end_date`; it must not use `SELECT DISTINCT`.

- [ ] **Step 4: Implement source SKU resolution without hiding zero/multiple matches**

Build a mapping-count CTE before inserting:

```sql
WITH source_rows AS (
  SELECT ymd_id AS sales_date,
         sid,
         msku,
         NULLIF(TRIM(sku), '') AS source_sku,
         volume AS sales_qty,
         CAST(amount AS DECIMAL(20,4)) AS sales_amount_usd,
         CAST(gross_profit AS DECIMAL(20,4)) AS gross_profit_usd,
         return_goods_count AS return_goods_qty,
         create_time AS source_updated_at
  FROM ling_xing.lx_web_product_performance_msku_list
  WHERE ymd_id >= DATE('{batch_start_date}')
    AND ymd_id <= DATE('{batch_end_date}')
), relation_match AS (
  SELECT s.sales_date, s.sid, s.msku, z.sku
  FROM source_rows s
  LEFT JOIN dim.dim_product_relation_zipper z
    ON s.source_sku IS NULL
   AND z.sid = s.sid
   AND z.msku = s.msku
   AND s.sales_date >= z.start_date
   AND s.sales_date <= z.end_date
), mapping AS (
  SELECT sales_date, sid, msku,
         COUNT(sku) AS mapping_count,
         MAX(sku) AS zipper_sku
  FROM relation_match
  GROUP BY sales_date, sid, msku
)
INSERT INTO ads.ads_pdm_lx_hot_product_index_sku_resolved_source_staging
SELECT s.sales_date,
       s.sid,
       s.msku,
       s.source_sku,
       IF(s.source_sku IS NOT NULL, s.source_sku, m.zipper_sku) AS sku,
       IF(s.source_sku IS NOT NULL, 1, m.mapping_count) AS mapping_count,
       s.sales_qty,
       s.sales_amount_usd,
       s.gross_profit_usd,
       s.return_goods_qty,
       s.source_updated_at
FROM source_rows s
LEFT JOIN mapping m
  ON m.sales_date = s.sales_date AND m.sid = s.sid AND m.msku = s.msku
```

The later validation rejects `mapping_count <> 1`; `MAX(sku)` here only transports the value after the count is retained and must never be used to pass a multi-match gate.

- [ ] **Step 5: Implement product and seller enrichment with explicit type conversion**

Insert only verified luggage-domain rows into `domain_source_identity_staging`; validation still starts from `sku_resolved_source_staging` so a missing product cannot disappear unnoticed. Enrich seller by casting the integer dimension SID to the source string type:

```sql
CAST(seller.sid AS VARCHAR(255)) = source.sid
AND seller.org_id = 1
```

Project these exact business expressions:

```sql
DATE_FORMAT(source.sales_date, '%Y-%m') AS ym,
product.spu,
product.product_sku AS company_sku,
seller.sale_channel AS channel,
product.level1 AS product_line,
seller.country,
product.single_box_size AS size,
product.color,
product.product_developer AS developer,
product.model,
grade.global_label AS sku_level,
IF(product.product_level IS NULL OR TRIM(product.product_level) = '',
   '未评级', TRIM(product.product_level)) AS product_level
```

Join the grade with `grade.ym = CAST(REPLACE(ym, '-', '') AS INT)` and `grade.SKU = sku`. Missing grade stays NULL. Do not use `dim_product.status`.

- [ ] **Step 6: Add the mandatory boundary and source-value contract assertions**

The SQL contract test must contain these immutable expected rows:

```python
EXPECTED_BOUNDARY = {
    ("2026-06-06", "2613", "8010A-BL28-FBM"): "ZX-8010S-BL28",
    ("2026-06-07", "2613", "8010A-BL28-FBM"): "8010S-BL28",
}
EXPECTED_SOURCE = {
    "2026-06-01": ("ZX-8010S-BL28", 11, "2276.8900"),
    "2026-06-02": ("ZX-8010S-BL28", 3, "749.9700"),
    "2026-06-03": ("ZX-8010S-BL28", 5, "1249.9500"),
}
```

These values are verified by the production acceptance SQL in Task 10, not by hard-coding them into target INSERT statements.

- [ ] **Step 7: Run and commit the source staging unit**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py`

Expected: PASS.

```bash
git add include/sql/ads/pdm/hot_product_index/00_prepare_staging.sql \
  include/sql/ads/pdm/hot_product_index/10_build_source_resolution.sql \
  test/test_hot_product_index_sql_contract.py
git commit -m "feat(ads): resolve hot product index source identities"
```

### Task 5: Build Independent Candidate, Eligibility, and Identity Sets

**Files:**

- Create: `include/sql/ads/pdm/hot_product_index/20_build_candidate_eligibility.sql`
- Modify: `test/test_hot_product_index_sql_contract.py`

**Interfaces:**

- Consumes: `batch_month_staging`, `resolved_source_staging`, product dimension, monthly stock, and raw batch relation.
- Produces: exactly one `candidate_sku_staging` row and one `eligibility_staging` row per `ym,sku`, plus left-closed/right-open `eligible_identity_staging` rows.

- [ ] **Step 1: Write formula and independent-set tests**

```python
def test_eligibility_is_global_month_sku_and_stock_is_not_defaulted() -> None:
    sql = (ROOT / "20_build_candidate_eligibility.sql").read_text(encoding="utf-8")
    normalized = " ".join(sql.split()).lower()
    assert "group by ym, sku" in normalized
    assert "sku_month_sales_qty + theoretical_stock_qty > 10" in normalized
    assert "coalesce(stock.total_stock_qty, 0)" not in normalized
    assert "status" not in normalized
    assert "source_complete_flag = 1" in normalized
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py -k eligibility`

Expected: FAIL because the eligibility SQL does not exist.

- [ ] **Step 3: Build the candidate SKU union only for complete months**

```sql
INSERT INTO ads.ads_pdm_lx_hot_product_index_candidate_sku_staging
SELECT source.ym, source.sku
FROM ads.ads_pdm_lx_hot_product_index_resolved_source_staging source
JOIN ads.ads_pdm_lx_hot_product_index_batch_month_staging batch
  ON batch.ym = source.ym AND batch.source_complete_flag = 1
GROUP BY source.ym, source.sku
UNION
SELECT stock.ym, stock.sku
FROM dws.dws_stock_analysis_monthly_sku stock
JOIN ads.ads_pdm_lx_hot_product_index_batch_month_staging batch
  ON batch.ym = stock.ym AND batch.source_complete_flag = 1
JOIN dim.dim_product product
  ON product.sku = stock.sku
 AND product.org_id = 1
 AND product.category = '拉杆箱'
GROUP BY stock.ym, stock.sku
```

`UNION` is allowed for the declared candidate set. It must not be used to hide duplicates inside stock, product, source, grade, or zipper declarations; those duplications are separate gates.

- [ ] **Step 4: Compute eligibility before any dashboard dimension filter**

```sql
WITH source_sales AS (
  SELECT ym, sku, SUM(sales_qty) AS sku_month_sales_qty
  FROM ads.ads_pdm_lx_hot_product_index_resolved_source_staging
  GROUP BY ym, sku
)
INSERT INTO ads.ads_pdm_lx_hot_product_index_eligibility_staging
SELECT candidate.ym,
       candidate.sku,
       COALESCE(source_sales.sku_month_sales_qty, 0) AS sku_month_sales_qty,
       stock.total_stock_qty AS theoretical_stock_qty,
       COALESCE(source_sales.sku_month_sales_qty, 0) + stock.total_stock_qty AS eligibility_value,
       IF(COALESCE(source_sales.sku_month_sales_qty, 0) + stock.total_stock_qty > 10, 1, 0) AS is_eligible
FROM ads.ads_pdm_lx_hot_product_index_candidate_sku_staging candidate
JOIN ads.ads_pdm_lx_hot_product_index_batch_month_staging batch
  ON batch.ym = candidate.ym AND batch.source_complete_flag = 1
LEFT JOIN source_sales
  ON source_sales.ym = candidate.ym AND source_sales.sku = candidate.sku
LEFT JOIN dws.dws_stock_analysis_monthly_sku stock
  ON stock.ym = candidate.ym AND stock.sku = candidate.sku
```

The LEFT JOIN is intentional: the missing-stock gate must observe NULL and fail. Do not filter NULL inventory rows out before validation.

- [ ] **Step 5: Build eligible identities from raw zipper intervals**

For each `is_eligible=1` candidate, insert every exact `sid,msku,sku` relation whose interval intersects the batch month. Clip the interval with the month start and exclusive month end:

```sql
GREATEST(relation.start_date, batch.month_start_date) AS identity_start_date,
LEAST(DATE_ADD(relation.end_date, INTERVAL 1 DAY), DATE_ADD(batch.coverage_end_date, INTERVAL 1 DAY)) AS identity_end_date
```

The join must remain `relation.sid IS NOT NULL`, `relation.sku = eligibility.sku`, `relation.start_date <= batch.coverage_end_date`, and `relation.end_date >= batch.month_start_date`. The raw relation is closed; `identity_end_date` adds one day only to create the internal exclusive bound used by calendar expansion. A source identity for an eligible SKU must match one of these intervals with the same `sid,msku,sku`; otherwise the validation gate fails instead of manufacturing an identity.

- [ ] **Step 6: Run and commit the eligibility unit**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py`

Expected: PASS.

```bash
git add include/sql/ads/pdm/hot_product_index/20_build_candidate_eligibility.sql \
  test/test_hot_product_index_sql_contract.py
git commit -m "feat(ads): compute hot product eligibility"
```

### Task 6: Build the Complete Daily Candidate and Monthly Aggregate

**Files:**

- Create: `include/sql/ads/pdm/hot_product_index/30_build_daily_staging.sql`
- Create: `include/sql/ads/pdm/hot_product_index/40_build_monthly_staging.sql`
- Modify: `test/test_hot_product_index_sql_contract.py`

**Interfaces:**

- Consumes: independent eligibility/identity sets, resolved source, calendar, batch context.
- Produces: daily staging containing every domain source fact for eligibility 0 or 1 and generated zeros only for eligibility 1; monthly staging derived exclusively from daily staging.

- [ ] **Step 1: Write zero-spine and monthly-lineage tests**

```python
def test_daily_keeps_source_and_only_expands_eligible_identities() -> None:
    sql = (ROOT / "30_build_daily_staging.sql").read_text(encoding="utf-8").lower()
    assert "is_generated_zero" in sql
    assert "eligibility.is_eligible = 1" in sql
    assert "source.sales_date is null" in sql
    assert "union all" in sql


def test_monthly_reads_only_daily_staging() -> None:
    sql = (ROOT / "40_build_monthly_staging.sql").read_text(encoding="utf-8").lower()
    assert "ads_pdm_lx_hot_product_index_daily_staging" in sql
    assert "lx_web_product_performance_msku_list" not in sql
    assert "dws_stock_analysis_monthly_sku" not in sql
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py -k 'daily or monthly'`

Expected: FAIL because the build files do not exist.

- [ ] **Step 3: Generate the calendar and expected eligible SKU-day spine**

Populate `calendar_staging` with every date from the first batch month start through the last `coverage_end_date`. Build expected days as:

```sql
SELECT calendar.sales_date, identity.ym, identity.sid, identity.msku, identity.sku
FROM ads.ads_pdm_lx_hot_product_index_eligible_identity_staging identity
JOIN ads.ads_pdm_lx_hot_product_index_calendar_staging calendar
  ON calendar.sales_date >= identity.identity_start_date
 AND calendar.sales_date < identity.identity_end_date
JOIN ads.ads_pdm_lx_hot_product_index_batch_month_staging batch
  ON batch.ym = identity.ym
 AND batch.source_complete_flag = 1
WHERE calendar.sales_date <= batch.coverage_end_date
```

- [ ] **Step 4: Insert real source facts before generated zeros**

The first branch inserts every `resolved_source_staging` row, joins its `ym,sku` eligibility, preserves all four source metrics, sets `is_generated_zero=0`, and retains both `is_eligible=0` and `is_eligible=1`.

The second branch starts from the expected eligible spine, LEFT JOINs resolved source on the full source key and same SKU, requires `source.sales_date IS NULL`, writes four zero metrics, sets `is_generated_zero=1`, and takes `source_updated_at` from the trusted `source_completed_at`. Both branches write the same batch `data_through_date`, `etl_batch_id`, and `etl_loaded_at`.

Use `UNION ALL`; the pre-publish duplicate gate, rather than `UNION DISTINCT`, protects the key.

- [ ] **Step 5: Aggregate the monthly table only from daily staging**

```sql
INSERT INTO ads.ads_pdm_lx_hot_product_index_monthly_staging
SELECT ym,
       sid,
       msku,
       sku,
       STR_TO_DATE(CONCAT(ym, '-01'), '%Y-%m-%d') AS month_start_date,
       MAX(spu) AS spu,
       MAX(company_sku) AS company_sku,
       MAX(channel) AS channel,
       MAX(product_line) AS product_line,
       MAX(country) AS country,
       MAX(size) AS size,
       MAX(color) AS color,
       MAX(developer) AS developer,
       MAX(model) AS model,
       MAX(sku_level) AS sku_level,
       MAX(product_level) AS product_level,
       SUM(sales_qty) AS sales_qty,
       SUM(sales_amount_usd) AS sales_amount_usd,
       SUM(gross_profit_usd) AS gross_profit_usd,
       SUM(return_goods_qty) AS return_goods_qty,
       MAX(sku_month_sales_qty) AS sku_month_sales_qty,
       MAX(theoretical_stock_qty) AS theoretical_stock_qty,
       MAX(eligibility_value) AS eligibility_value,
       MAX(is_eligible) AS is_eligible,
       MAX(data_through_date) AS data_through_date,
       MAX(source_updated_at) AS source_updated_at,
       MAX(etl_batch_id) AS etl_batch_id,
       MAX(etl_loaded_at) AS etl_loaded_at
FROM ads.ads_pdm_lx_hot_product_index_daily_staging
GROUP BY ym, sid, msku, sku
```

`MAX` is only a projection after Task 7 proves each dimension/eligibility/batch field is unique in the group. A conflicting value fails before publish.

- [ ] **Step 6: Run and commit the target-build unit**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py`

Expected: PASS.

```bash
git add include/sql/ads/pdm/hot_product_index/30_build_daily_staging.sql \
  include/sql/ads/pdm/hot_product_index/40_build_monthly_staging.sql \
  test/test_hot_product_index_sql_contract.py
git commit -m "feat(ads): build hot product daily and monthly candidates"
```

### Task 7: Implement All Pre-Publish and Post-Publish Quality Gates

**Files:**

- Create: `include/sql/ads/pdm/hot_product_index/50_validate_pre_publish.sql`
- Create: `include/sql/ads/pdm/hot_product_index/60_validate_published.sql`
- Create: `include/sql/validation/hot_product_index/production_acceptance.sql`
- Modify: `test/test_hot_product_index_sql_contract.py`
- Modify: `test/test_hot_product_index_runtime.py`

**Interfaces:**

- Produces three read-only SQL result sets with exactly `check_name,error_count` and one row per named gate.
- `assert_zero_counts` consumes each result; every nonzero count raises before publication or watermark advancement.

- [ ] **Step 1: Write the complete check-name contract**

```python
import re

REQUIRED_CHECKS = {
    "source_duplicate_key",
    "source_metric_null",
    "audited_gap_has_source_rows",
    "source_mapping_count",
    "source_resolution_set_diff",
    "product_match_count",
    "seller_match_count",
    "grade_duplicate_key",
    "stock_duplicate_or_missing",
    "relation_duplicate_key",
    "relation_interval_overlap",
    "candidate_duplicate_or_set_diff",
    "eligibility_duplicate_or_metric_diff",
    "eligible_identity_duplicate_or_set_diff",
    "eligible_spu_product_level_conflict",
    "daily_duplicate_or_spine_set_diff",
    "source_daily_metric_or_dimension_diff",
    "monthly_duplicate_or_daily_rollup_diff",
    "time_partition_batch_invariant",
}


def test_pre_publish_exposes_every_named_gate() -> None:
    sql = (ROOT / "50_validate_pre_publish.sql").read_text(encoding="utf-8")
    actual = set(re.findall(r"SELECT\s+'([^']+)'\s+AS\s+check_name", sql, re.IGNORECASE))
    assert REQUIRED_CHECKS <= actual
    assert not sql.rstrip().endswith(";")
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd /Users/zewe/code-workspace/etl && python3 -m pytest -q test/test_hot_product_index_sql_contract.py -k pre_publish`

Expected: FAIL because validation SQL does not exist.

- [ ] **Step 3: Implement uniqueness, relationship, and dimension gates**

Each gate must return a count, not diagnostic rows. Use diagnostic companion CTEs so the DAG can run a bounded detail query after failure. Preserve these exact predicates:

```sql
HAVING COUNT(*) <> 1
```

for source, candidate, eligibility, identity, daily and monthly declared keys;

`source_metric_null` must count NULL in `volume`, `amount`, `gross_profit`, `return_goods_count`, or `create_time`; none may be coerced to zero or batch time.

```sql
batch.source_complete_flag = 0 AND source.ymd_id IS NOT NULL
```

for any unexpected fact inside an audited source-gap month;

```sql
a.start_date <= b.end_date AND b.start_date <= a.end_date
```

for overlap; and LEFT JOIN match counts from required product/SID/SKU keys so inner joins cannot hide missing dimension rows. Seller matching must use `CAST(seller.sid AS VARCHAR(255))` and `seller.org_id=1`.

- [ ] **Step 4: Implement independent set and metric reconciliation gates**

For candidate, eligibility, eligible identity, expected day spine, source-to-daily, and daily-to-monthly, use two anti-joins plus an inner metric comparison. This is the required Doris-compatible replacement for `FULL OUTER JOIN`; comparing only row counts is forbidden.

Amount comparisons use:

```sql
ABS(expected.sales_amount_usd - actual.sales_amount_usd) > 0.0001
OR ABS(expected.gross_profit_usd - actual.gross_profit_usd) > 0.0001
```

Dimension comparisons use Doris null-safe equality for `company_sku,product_line,size,color,developer,model,sku_level`; non-null required dimensions use ordinary equality. Eligibility is independently recomputed from resolved source and stock, not from either target staging table.

- [ ] **Step 5: Implement time, batch, and product-level gates**

The checks must enforce:

```sql
daily.ym = DATE_FORMAT(daily.sales_date, '%Y-%m')
monthly.month_start_date = STR_TO_DATE(CONCAT(monthly.ym, '-01'), '%Y-%m-%d')
COUNT(DISTINCT data_through_date) = 1 per ym
COUNT(DISTINCT etl_batch_id) = 1 per ym
daily and monthly etl_batch_id/data_through_date agree per ym
COUNT(DISTINCT normalized product_level) = 1 per ym,spu for is_eligible=1
```

`60_validate_published.sql` repeats key, daily/monthly reconciliation, per-partition batch, and global watermark checks against formal target partitions after replacement. It must assert that a backfill's global watermark equals the pre-run approved value and that a daily run's new watermark equals the candidate only after both tables agree.

- [ ] **Step 6: Add the final production acceptance query**

`production_acceptance.sql` is pure SELECT and covers:

```text
both target row counts and min/max business periods
every non-empty source month represented
2023-06..2024-06 absent from business targets and present in recorded run evidence
2026-05-29/30 exact closed-interval mapping
2026-06-01/02/03 sales_qty and sales_amount_usd source values
daily/monthly reconciliation
same global data_through_date and same batch per common ym
zero duplicate target keys
zero unresolved eligible product-level conflicts
```

- [ ] **Step 7: Run focused tests and commit the quality unit**

Run:

```bash
cd /Users/zewe/code-workspace/etl
python3 -m pytest -q test/test_hot_product_index_sql_contract.py \
  test/test_hot_product_index_runtime.py
```

Expected: PASS.

```bash
git add include/sql/ads/pdm/hot_product_index/50_validate_pre_publish.sql \
  include/sql/ads/pdm/hot_product_index/60_validate_published.sql \
  include/sql/validation/hot_product_index/production_acceptance.sql \
  test/test_hot_product_index_sql_contract.py \
  test/test_hot_product_index_runtime.py
git commit -m "test(ads): gate hot product index publication"
```

### Task 8: Implement Partition Backup, Atomic Overwrite, and Compensation

**Files:**

- Create: `include/sql/ads/pdm/hot_product_index/70_prepare_publish_partitions.sql`
- Create: `include/sql/ads/pdm/hot_product_index/80_restore_publish_partitions.sql`
- Create: `include/sql/ads/pdm/hot_product_index/90_cleanup_staging.sql`
- Modify: `include/processors/hot_product_index_runtime.py`
- Modify: `test/test_hot_product_index_publication_contract.py`

**Interfaces:**

- Produces `PartitionRef`, `OverwritePlan`, `prepare_publish_batch`, `validate_overwrite_plan`, `execute_overwrite`, `publish_partition_pair`, `validate_published_pair`, `restore_overwrite_plan`, and `cleanup_batch`.
- `publish_partition_pair(context, daily_plan, monthly_plan) -> None` must either leave both target tables on the new batch or restore every affected existing partition and remove every newly created partition.

- [ ] **Step 1: Write exact command-order and injected-failure tests**

```python
def test_publication_validates_before_first_replace(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(runtime, "validate_overwrite_plan", lambda plan: calls.append(f"VALIDATE_{plan.target_table}"))
    monkeypatch.setattr(runtime, "execute_overwrite", lambda plan: calls.append(f"OVERWRITE_{plan.target_table}"))
    monkeypatch.setattr(runtime, "validate_published_pair", lambda _: calls.append("VALIDATE_PUBLISHED"))
    runtime.publish_partition_pair(context, daily_plan, monthly_plan)
    assert calls.index(f"VALIDATE_{daily_plan.target_table}") < calls.index(f"OVERWRITE_{daily_plan.target_table}")
    assert calls.index(f"VALIDATE_{monthly_plan.target_table}") < calls.index(f"OVERWRITE_{daily_plan.target_table}")
    assert calls.index(f"OVERWRITE_{daily_plan.target_table}") < calls.index(f"OVERWRITE_{monthly_plan.target_table}")


def test_monthly_overwrite_failure_restores_daily_and_watermark(monkeypatch) -> None:
    restored: list[runtime.OverwritePlan] = []

    def overwrite(plan: runtime.OverwritePlan) -> None:
        if plan.target_table.endswith("_sku_m"):
            raise RuntimeError("monthly overwrite failed")

    monkeypatch.setattr(runtime, "validate_overwrite_plan", lambda _: None)
    monkeypatch.setattr(runtime, "execute_overwrite", overwrite)
    monkeypatch.setattr(runtime, "restore_overwrite_plan", restored.append)
    with pytest.raises(RuntimeError, match="monthly overwrite failed"):
        runtime.publish_partition_pair(context, daily_plan, monthly_plan)
    assert restored == [daily_plan]
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd /Users/zewe/code-workspace && PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q etl/test/test_hot_product_index_publication_contract.py`

Expected: FAIL because runtime publication interfaces do not exist.

- [ ] **Step 3: Discover formal partitions instead of guessing Doris auto names**

```python
@dataclass(frozen=True)
class PartitionRef:
    ym: str
    formal_name: str | None
    existed_before: bool
    rollback_table: str


@dataclass(frozen=True)
class OverwritePlan:
    target_table: str
    staging_table: str
    rollback_table: str
    partitions: tuple[PartitionRef, ...]


TARGET_PARTITION_MODES = {
    "ads.ads_pdm_lx_hot_product_index_sku_d": "range",
    "ads.ads_pdm_lx_hot_product_index_sku_m": "list",
}


def resolve_formal_partition(table: str, ym: str) -> str | None:
    parse_ym(ym)
    mode = TARGET_PARTITION_MODES.get(table)
    if mode is None:
        raise ValueError(f"unsupported target table: {table}")
    expression = (
        f"auto_partition_name('range', 'month', '{ym}-01')"
        if mode == "range"
        else f"auto_partition_name('list', '{ym}')"
    )
    name_frame = query_str_sql("doris", f"SELECT {expression} AS partition_name")
    partition_name = str(name_frame.iloc[0]["partition_name"])
    frame = query_str_sql(
        "doris",
        f"SHOW PARTITIONS FROM {table} WHERE PartitionName = '{partition_name}'",
    )
    if len(frame.index) > 1:
        raise ValueError(f"expected at most one formal partition for {table} {ym}")
    return None if frame.empty else partition_name
```

Assert the exact `partition_name` result and `SHOW PARTITIONS` frame shape in a unit test. Use Doris's documented `auto_partition_name` function; do not reproduce its naming algorithm in Python.

- [ ] **Step 4: Prepare rollback tables and immutable overwrite plans**

For each target, create a batch-scoped rollback table using `f"CREATE TABLE ads.{rollback_name} LIKE {target_table}"`, then copy rows from every affected partition that existed before the run. Record absent months as `PartitionRef(formal_name=None,existed_before=False)` so compensation can delete partitions created by the overwrite. `rollback_name` is generated only by `safe_object_name(prefix: str, etl_batch_id: str) -> str`, which strips every character outside `[A-Za-z0-9_]`, appends a 16-character SHA-256 suffix, and rejects names longer than 64 characters.

Validate both staging tables and rollback row counts before the first overwrite. For each existing month, rollback key count and additive metrics must equal the current formal partition exactly. An absent month must have zero rollback rows.

- [ ] **Step 5: Atomically overwrite each table and compensate cross-table failure**

Open one Doris connection per table overwrite, set auto-create in that same session, and execute one statement for all batch months:

```sql
SET enable_auto_create_when_overwrite = true;
INSERT OVERWRITE TABLE ads.ads_pdm_lx_hot_product_index_sku_d
PARTITION(*)
SELECT * FROM ads.ads_pdm_lx_hot_product_index_daily_staging
```

Then execute the equivalent monthly statement from `monthly_staging`. `INSERT OVERWRITE PARTITION(*)` is internally atomic for one table and, on Doris 2.1.9 with the session variable enabled, both replaces existing partitions and creates missing auto partitions.

Implement the same-session boundary explicitly rather than calling `execute_str_sql` twice:

```python
def execute_overwrite(plan: OverwritePlan) -> None:
    if plan.target_table not in TARGET_PARTITION_MODES:
        raise ValueError(f"unsupported target table: {plan.target_table}")
    connection = get_connection("doris")
    connection.exec("SET enable_auto_create_when_overwrite = true")
    connection.exec(
        f"INSERT OVERWRITE TABLE {plan.target_table} PARTITION(*) "
        f"SELECT * FROM {plan.staging_table}"
    )
```

If monthly overwrite or post-publish validation fails, overwrite every pre-existing daily/monthly month from its rollback table. For months where `existed_before=False`, discover the newly created formal partition and drop it. Keep rollback tables until post-publish validation succeeds; only then run cleanup. A failed compensation raises a distinct fatal error containing the retained rollback table names and remaining new partition names.

- [ ] **Step 6: State the reader-isolation boundary in code and runbook**

`max_active_runs=1` serializes writers but does not isolate BI readers between the daily and monthly replace statements. The runtime must log `publication_state=REPLACING|ROLLING_BACK|PUBLISHED`, but that log is not a reader lock. The production acceptance report must mark `BI_READER_ISOLATION=BLOCKED` until a separately approved routing/manifest design makes both datasets switch together. Do not weaken this to “eventual consistency.”

- [ ] **Step 7: Run tests and commit the publication unit**

Run:

```bash
cd /Users/zewe/code-workspace
PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q \
  etl/test/test_hot_product_index_publication_contract.py \
  etl/test/test_hot_product_index_runtime.py
```

Expected: PASS, including injected daily/monthly failures and retained backups on failed compensation.

```bash
cd /Users/zewe/code-workspace/etl
git add include/sql/ads/pdm/hot_product_index/70_prepare_publish_partitions.sql \
  include/sql/ads/pdm/hot_product_index/80_restore_publish_partitions.sql \
  include/sql/ads/pdm/hot_product_index/90_cleanup_staging.sql \
  include/processors/hot_product_index_runtime.py \
  test/test_hot_product_index_publication_contract.py
git commit -m "feat(ads): publish hot product partitions with rollback"
```

### Task 9: Wire the Airflow DAG and ADS Assets

**Files:**

- Create: `dags/ADS/pdm/__init__.py`
- Create: `dags/ADS/pdm/hot_product_index.py`
- Modify: `assets/ads.py`
- Modify: `assets/dws.py`
- Modify: `dags/ODS/ling_xing/statistics/product_performance.py`
- Create: `test/test_hot_product_index_dag_contract.py`

**Interfaces:**

- Produces DAG ID `ads_pdm_lx_hot_product_index_refresh`.
- Produces Assets `ADS_PDM_LX_HOT_PRODUCT_INDEX_SKU_D` and `ADS_PDM_LX_HOT_PRODUCT_INDEX_SKU_M` with URIs `data_sign://dw/ads/ads_pdm_lx_hot_product_index_sku_d` and `data_sign://dw/ads/ads_pdm_lx_hot_product_index_sku_m`.
- Produces declaration `DWS_STOCK_ANALYSIS_MONTHLY_SKU_READY = Asset("data_sign://dw/dws/dws_stock_analysis_monthly_sku_ready")`; the actual stock-owning producer must emit it with `ready_yms` and `completed_at` metadata.
- Schedules on `[ODS_LX_PRODUCT_PERFORMANCE_SYNC_READY]`, consumes its trusted `coverage_end_date,source_complete,completed_at` event metadata, and reads the latest stock-ready Asset event as a required inlet. The ETL repo has no producer for `dws.dws_stock_analysis_monthly_sku`; the owning Agent must wire that outlet before this DAG can be enabled.

- [ ] **Step 1: Write DAG import, graph, and parameter tests**

```python
from pathlib import Path


def test_dag_contract() -> None:
    module = _import_module("dags/ADS/pdm/hot_product_index.py")
    dag = module.ads_pdm_lx_hot_product_index_refresh
    assert dag.dag_id == "ads_pdm_lx_hot_product_index_refresh"
    assert dag.catchup is False
    assert dag.max_active_runs == 1
    assert dag.default_args["retries"] == 0
    assert dag.timezone.name == "Asia/Shanghai"
    assert "ODS_LX_PRODUCT_PERFORMANCE_SYNC_READY" in Path(
        "dags/ADS/pdm/hot_product_index.py"
    ).read_text(encoding="utf-8")
    assert {
        "resolve_context",
        "prepare_staging",
        "build_source_resolution",
        "build_candidate_eligibility",
        "build_daily",
        "build_monthly",
        "validate_pre_publish",
        "prepare_publish",
        "publish_pair",
        "validate_published",
        "cleanup",
    } <= set(dag.task_ids)
```

Add cases proving malformed/missing `start_ym,end_ym` fail, historical mode preserves the approved watermark, bootstrap requires empty targets and the latest complete month, daily mode selects the Beijing current month, Beijing day 1 adds the previous full month, and `publication_mode=validate_only` stops after pre-publish validation while retaining staging.

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd /Users/zewe/code-workspace && PYTHONPATH=/Users/zewe/code-workspace python3 -m pytest -q etl/test/test_hot_product_index_dag_contract.py`

Expected: FAIL because the DAG and assets do not exist.

- [ ] **Step 3: Add the two ADS Assets exactly once**

```python
ADS_PDM_LX_HOT_PRODUCT_INDEX_SKU_D = Asset(
    "data_sign://dw/ads/ads_pdm_lx_hot_product_index_sku_d"
)
ADS_PDM_LX_HOT_PRODUCT_INDEX_SKU_M = Asset(
    "data_sign://dw/ads/ads_pdm_lx_hot_product_index_sku_m"
)
```

Do not refactor unrelated duplicate legacy declarations in `assets/ads.py`.

Add the stock readiness declaration once in `assets/dws.py`, but do not treat declaration alone as completion. Modify the product-performance summary task to emit coverage only after every API task succeeds:

```python
from airflow.sdk import Metadata, get_current_context


@task(outlets=[ODS_LX_PRODUCT_PERFORMANCE_SYNC_READY])
def log_summary(results):
    logical_date = get_current_context()["logical_date"]
    coverage_end_date = (
        pendulum.instance(logical_date)
        .in_timezone("Asia/Shanghai")
        .subtract(days=1)
        .to_date_string()
    )
    yield Metadata(
        ODS_LX_PRODUCT_PERFORMANCE_SYNC_READY,
        {
            "coverage_end_date": coverage_end_date,
            "source_complete": True,
            "completed_at": pendulum.now("Asia/Shanghai").to_datetime_string(),
        },
    )
```

The stock owner must emit `Metadata(DWS_STOCK_ANALYSIS_MONTHLY_SKU_READY,{"ready_yms":["YYYY-MM"],"completed_at":"YYYY-MM-DD HH:mm:ss"})` after its committed monthly load. Row existence or `MAX(ym)` is not an accepted substitute.

- [ ] **Step 4: Implement the task graph in strict order**

```text
resolve_context
  -> prepare_staging
  -> build_source_resolution
  -> build_candidate_eligibility
  -> build_daily
  -> build_monthly
  -> validate_pre_publish
  -> prepare_publish
  -> publish_pair
  -> validate_published
  -> cleanup
```

Use `load_sql(relative_sql_path).format(**context)` and `execute_str_sql("doris", rendered_sql)`. The DAG does not run static target DDL. All failures before `publish_pair` leave formal targets unchanged; failures during/after publish invoke Task 8 compensation before raising.

`prepare_staging` first executes `00_prepare_staging.sql`, then executes `batch_month_insert_sql(context)` and immediately asserts one row per requested `ym`. Candidate and identity SQL only joins rows where `source_complete_flag=1`; rows with flag 0 are logged as source gaps and cannot create business facts.

Scheduled daily runs force `publication_mode="publish"`. Manual runs accept only `validate_only` or `publish`; for `validate_only`, `prepare_publish` logs `publication=SKIPPED_VALIDATE_ONLY` and raises `AirflowSkipException` before any backup or target DML, so `publish_pair`, `validate_published`, and `cleanup` are skipped and staging remains available for inspection.

Because the source Asset can update several times per day, `resolve_context` raises `AirflowSkipException` when its trusted `coverage_end_date <= approved_watermark`; only the first new complete coverage event can publish. On Beijing day 1, the selected previous month additionally requires that month's stock-ready metadata.

- [ ] **Step 5: Enforce daily and backfill behavior**

Daily behavior:

```text
candidate watermark = Airflow logical date in Asia/Shanghai minus one calendar day
months = current Beijing month
on Beijing day 1, months also include the previous completed month
run only after daily source coverage and each selected month's stock completion are trusted
```

Manual behavior requires canonical `start_ym` and `end_ym`, and executes only after source-backfill run IDs and stock completion prove every selected non-gap month complete. The existing `om.airflow.api` trigger command cannot pass `dag_run.conf`; production parameterized backfill must use Airflow UI/native REST or a separately verified CLI extension, not an invented `--conf` flag.

- [ ] **Step 6: Add logging and zero-source audit output**

Every run logs the source max date, selected months, complete/gap state, source rows, candidate rows, eligible rows, generated-zero rows, target rows, every `check_name/error_count`, old/new watermark, replaced partitions, rollback outcome and `etl_batch_id`. For 2023-06 through 2024-06 log `source_complete_flag=0,publication=SKIPPED_ZERO_SOURCE`; never insert those months into candidate business partitions.

- [ ] **Step 7: Run tests, compile and lint**

Run:

```bash
cd /Users/zewe/code-workspace/etl
python3 -m pytest -q test/test_hot_product_index_*.py
python3 -m compileall -q dags/ADS/pdm include/processors scripts
python3 -m ruff check \
  dags/ADS/pdm/hot_product_index.py \
  include/processors/hot_product_index_runtime.py \
  scripts/hot_product_index_ddl_bootstrap.py \
  scripts/hot_product_index_doris_capability_probe.py \
  test/test_hot_product_index_*.py
```

Expected: all tests PASS; compile and ruff exit 0.

- [ ] **Step 8: Run staged impact analysis and commit**

```bash
git add dags/ADS/pdm/__init__.py dags/ADS/pdm/hot_product_index.py \
  dags/ODS/ling_xing/statistics/product_performance.py \
  assets/ads.py assets/dws.py test/test_hot_product_index_dag_contract.py
gitnexus detect-changes --repo etl --scope staged
git commit -m "feat(ads): orchestrate hot product index refresh"
```

If GitNexus reports HIGH or CRITICAL impact, stop before commit with affected symbols, callers and flows and wait for explicit approval.

### Task 10: Apply DDL, Backfill, and Produce Production Acceptance Evidence

**Files:**

- Modify: `docs/reports/2026-08-03-hot-product-index-data-acceptance.md`

**Interfaces:**

- Consumes: all green code/tests, a clean release SHA, repaired zipper SID/history, zero eligible SPU rating conflicts, and trusted source/stock completion signals.
- Produces: live target schemas, accepted historical partitions, one accepted daily run, immutable run IDs and reconciliation evidence. It does not produce BI metadata.

- [ ] **Step 1: Re-run the full preflight and stop on any hard blocker**

Run:

```bash
cd /Users/zewe/code-workspace/etl
git status --short --branch
git rev-parse HEAD
python3 .agents/skills/datawarehouse-schema-explorer/scripts/query_doris.py \
  --no-filter "$(< include/sql/validation/hot_product_index/preflight.sql)"
```

Expected: clean release checkout; exact zipper mapping, zipper history, product-level, source duplicate and stock duplicate blockers all zero. If any is nonzero, record it and stop before production DDL/DML.

- [ ] **Step 2: Verify Airflow and Doris capability at release time**

Run:

```bash
python3 -m om.airflow.api health
python3 -m om.airflow.api dags errors --limit 1000
python3 scripts/hot_product_index_doris_capability_probe.py --apply
```

Expected: Airflow healthy, no target DAG import error, all disposable Doris capability checks PASS.

- [ ] **Step 3: Review dry-run DDL, then apply under explicit production authorization**

Run:

```bash
python3 scripts/hot_product_index_ddl_bootstrap.py
python3 scripts/hot_product_index_ddl_bootstrap.py --apply
python3 .agents/skills/datawarehouse-schema-explorer/scripts/query_doris.py \
  --no-filter "SHOW CREATE TABLE ads.ads_pdm_lx_hot_product_index_sku_d"
python3 .agents/skills/datawarehouse-schema-explorer/scripts/query_doris.py \
  --no-filter "SHOW CREATE TABLE ads.ads_pdm_lx_hot_product_index_sku_m"
```

Expected: target keys, column order/types, AUTO partitions, 16 buckets and Merge-on-Write exactly match Task 2.

- [ ] **Step 4: Run a staging-only canary for 2026-06**

Trigger `start_ym=2026-06,end_ym=2026-06,publication_mode=validate_only` through Airflow UI/native REST. Execute Tasks 4-7, retain staging, and run the boundary/source fixtures.

Expected:

```text
2026-06-06 + 2613 + 8010A-BL28-FBM -> ZX-8010S-BL28
2026-06-07 + 2613 + 8010A-BL28-FBM -> 8010S-BL28
2026-06-01 sales_qty=11 sales_amount_usd=2276.8900
2026-06-02 sales_qty=3  sales_amount_usd=749.9700
2026-06-03 sales_qty=5  sales_amount_usd=1249.9500
all pre-publish error_count values = 0
```

- [ ] **Step 5: Bootstrap all non-empty source months and audit gaps in one release batch**

With both targets empty, run `mode=bootstrap` from the minimum source month through the latest complete current month and include the latest candidate watermark. Mark 2023-06 through 2024-06 as audited gaps with `source_complete_flag=0`; include 2023-02 through 2023-05 only after repaired zipper coverage passes; publish 2024-07 onward normally. Both tables must validate all complete months before the first overwrite begins, and only this whole-history bootstrap may establish the initial watermark.

Expected: every non-empty source month has both target partitions; every known source-gap month has an Airflow audit record and no target partition.

After bootstrap succeeds, rerun one older month with `mode=backfill`; it must copy the established watermark unchanged. Subsequent historical repairs may run in smaller `start_ym,end_ym` batches under the same backfill rule.

- [ ] **Step 6: Inject one monthly publish failure and prove compensation**

Use the release-only failure hook in a disposable/canary run after daily replacement and before monthly replacement. Confirm daily is restored, both global watermarks remain old, formal partition batch IDs match the pre-run state, and rollback tables are retained until inspected.

Expected: run failed by design; no target month exposes a new batch; the acceptance report contains before/after counts and rollback object names.

- [ ] **Step 7: Run one successful daily batch**

Execute the normal dependency-complete daily path. Confirm both tables publish the same new `etl_batch_id`; only this run advances `data_through_date` to the candidate Beijing-yesterday value.

- [ ] **Step 8: Execute final read-only production acceptance**

Run:

```bash
python3 .agents/skills/datawarehouse-schema-explorer/scripts/query_doris.py \
  --no-filter "$(< include/sql/validation/hot_product_index/production_acceptance.sql)"
```

Expected: all acceptance counts zero and all evidence rows match the approved contract. Paste the query output, Airflow DAG/run/task IDs, release SHA, table DDLs, coverage matrix, generated-zero counts, watermark and failure-injection result into the report.

- [ ] **Step 9: Mark the BI return gate honestly**

The final data report must end with exactly four status lines:

```text
CODE_COMPLETE=PASS
TABLE_SCHEMA_COMPLETE=PASS
DATA_ACCEPTANCE=PASS
BI_READER_ISOLATION=BLOCKED
```

Change the last status to PASS only after a separate approved and tested cross-table reader-isolation design exists. Until then, keep the Superset baseline at commit `e80f3a5cad` and do not create dashboard metadata.

- [ ] **Step 10: Commit the completed evidence report**

```bash
git add docs/reports/2026-08-03-hot-product-index-data-acceptance.md
git commit -m "docs(ads): record hot product index data acceptance"
```

## Final Verification Matrix

| Requirement                                                   | Owning task    | Required proof                                  |
| ------------------------------------------------------------- | -------------- | ----------------------------------------------- |
| Exact table names, fields, keys and partitions                | Task 2         | Static test + production `SHOW CREATE TABLE`    |
| Exact closed-interval SKU mapping                             | Tasks 0, 4, 10 | 05-29/05-30 fixture and zero match-count errors |
| Correct product rating source                                 | Tasks 4, 7     | SQL contract + zero `ym,spu` conflict           |
| `sales + stock > 10` with no status                           | Task 5         | Independent eligibility reconciliation          |
| Preserve all source facts; zero-fill only eligible identities | Tasks 6, 7     | Two-way source and day-spine set comparisons    |
| Monthly derives only from daily                               | Tasks 6, 7     | SQL lineage contract + metric reconciliation    |
| Historical gaps are not zero facts                            | Tasks 9, 10    | Coverage matrix and target partition absence    |
| Historical run cannot advance watermark                       | Tasks 3, 7, 10 | Unit test + live rerun evidence                 |
| Failure preserves both old targets                            | Tasks 1, 8, 10 | Fault injection and post-failure comparison     |
| Dependency-aware daily schedule                               | Task 9         | DAG graph + trusted completion metadata         |
| BI remains paused                                             | Task 10        | Four-status closeout and unchanged BI baseline  |

## References

- Approved design: `/Volumes/extend/ecode-workspace/superset-source/docs/superpowers/specs/2026-08-03-hot-product-index-overview-design.md`
- Doris 2.1 auto partition: <https://doris.apache.org/docs/2.1/table-design/data-partitioning/auto-partitioning/>
- Doris 2.1 INSERT OVERWRITE: <https://doris.apache.org/docs/2.1/sql-manual/sql-statements/data-modification/DML/INSERT-OVERWRITE/>
- Doris 2.1 temporary partition: <https://doris.apache.org/docs/2.1/data-operate/delete/table-temp-partition/>
- Doris 2.1 atomic table replacement: <https://doris.apache.org/docs/2.1/data-operate/delete/atomicity-replace/>
- ETL DDL pattern: `scripts/product_lifecycle_analytics_ddl_bootstrap.py`
- ETL candidate validation pattern: `include/processors/product_lifecycle_runtime.py`
- ETL DAG pattern: `dags/ADS/scm/product_lifecycle_analytics.py`

## Handoff

交给数据表/Airflow Agent 时，从 Task 0 开始逐项执行并在每个 commit 后复核。当前允许先完成只读前置、Doris disposable probe、DDL 和纯代码测试；生产源解析、回填和发布必须等待 Decision Gate 0、历史拉链、评级冲突与库存完成信号全部解除。数据报告达到 `DATA_ACCEPTANCE=PASS` 后，再回到 Superset BI 基线；不得把“代码已写完”当成“数据已交付”。
