# Hot Product Category Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stock Superset native category filter sourced from `dim.dim_product.category`, place month first and category second, and default category to `拉杆箱` without changing Superset core source.

**Architecture:** Enrich the eight business virtual datasets at query time with a normalized, one-row-per-SKU category mapping from `dim.dim_product` where `org_id = 1`. A shared SQL fragment detects conflicting category mappings and makes business queries fail closed with no rows. Dashboard metadata uses the existing native select-filter DataMask contract; no frontend, backend schema, plugin, CSS, ADS, or Airflow change is allowed.

**Tech Stack:** Python 3.10+, deterministic Superset Assets ZIP generation, Doris SQL, pytest, Ruff, pre-commit.

## Global Constraints

- Do not modify `superset/`, `superset-frontend/`, chart plugins, Dashboard CSS, ADS schemas, or Airflow.
- If a Superset core source change appears necessary, stop and obtain explicit user approval before editing it.
- Preserve 2 dashboards, 9 datasets, 27 charts, 38 resource UUIDs, 26 main charts, and 1 guide chart.
- Increase native filters from 13 to 14 and use the exact order `年月, 品类, 渠道, 品线, SPU, 国家, 公司SKU, SKU, 尺寸, 颜色, 开发经理, 型号, SKU等级, 实际评级`.
- Category comes only from `dim.dim_product.category` with `org_id = 1` and `sku` as the join key.
- Normalize display/filter values with `COALESCE(NULLIF(TRIM(category), ''), '-')`; do not overwrite ADS data.
- Default category is `拉杆箱`; users may clear or change it during the page session.
- Do not stage, revert, or format unrelated dirty files.

---

### Task 1: Lock Native Filter Metadata With Failing Tests

**Files:**
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**
- Consumes: `write_bundle(Path) -> Path`, `UUIDS`, and generated dashboard `metadata.native_filter_configuration`.
- Produces: exact filter count/order/default/target contracts used by Tasks 2 and 3.

- [ ] **Step 1: Update the existing filter-order assertions**

Replace each 13-filter expectation with this exact order and count:

```python
expected_filter_names = [
    "年月",
    "品类",
    "渠道",
    "品线",
    "SPU",
    "国家",
    "公司SKU",
    "SKU",
    "尺寸",
    "颜色",
    "开发经理",
    "型号",
    "SKU等级",
    "实际评级",
]
assert len(filters) == 14
assert [item["name"] for item in filters] == expected_filter_names
```

- [ ] **Step 2: Add the category default and target contract**

Add assertions to `test_actual_rating_has_raw_schema_and_filter_contract`:

```python
category_filter = by_name["品类"]
assert category_filter["id"] == "NATIVE_FILTER-category"
assert category_filter["targets"] == [
    {"column": {"name": "category"}, "datasetUuid": UUIDS[key]}
    for key in (
        "dataset_daily",
        "dataset_monthly",
        "dataset_spu_detail",
        "dataset_sku_detail",
        "dataset_country_detail",
        "dataset_developer_detail",
        "dataset_model_detail",
        "dataset_spu_leaderboard",
    )
]
assert category_filter["defaultDataMask"] == {
    "extraFormData": {
        "filters": [{"col": "category", "op": "IN", "val": ["拉杆箱"]}]
    },
    "filterState": {"value": ["拉杆箱"]},
    "ownState": {},
}
assert UUIDS["chart_status"] not in category_filter["chartsInScope"]
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
python3 -m pytest \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  -q --confcutdir=tests/unit_tests/scripts
```

Expected: failures showing the old 13-filter order and missing `品类` filter.

- [ ] **Step 4: Confirm no unrelated files changed**

Run:

```bash
git status --short
git diff --check -- \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
```

Expected: only the two owned tests differ for this task; unrelated pre-existing dirty files remain untouched.

### Task 2: Implement Stock Native Filter Metadata

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Test: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Test: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**
- Consumes: Task 1 filter contracts.
- Produces: `FILTERS` with category first among select filters; `_select_filter(..., default_value: Sequence[str] | None = None) -> Asset`; 14-item dashboard native filter configuration.

- [ ] **Step 1: Add category to the filter contract**

Set `FILTERS` to:

```python
FILTERS: Final[tuple[tuple[str, str], ...]] = (
    ("品类", "category"),
    ("渠道", "channel"),
    ("品线", "product_line"),
    ("SPU", "spu"),
    ("国家", "country"),
    ("公司SKU", "company_sku"),
    ("SKU", "sku"),
    ("尺寸", "size"),
    ("颜色", "color"),
    ("开发经理", "developer"),
    ("型号", "model"),
    ("SKU等级", "sku_level"),
    ("实际评级", "product_level"),
)
```

Add `"category": "品类"` to `COLUMN_VERBOSE_NAMES` and define a shared filter-column type map that extends the daily ADS types with `category: STRING`. Use that map in `_detail_columns`, `_leaderboard_columns`, and `_dimension_detail_columns` so category can remain a hidden native-filter column without changing table groupings.

- [ ] **Step 2: Extend `_select_filter` with an optional stock default**

Change the signature to:

```python
def _select_filter(
    *,
    name: str,
    column: str,
    business_chart_uuids: Sequence[str],
    default_value: Sequence[str] | None = None,
) -> Asset:
```

Build the existing filter dictionary first. When `default_value` is not `None`, add:

```python
filter_config["defaultDataMask"] = {
    "extraFormData": {
        "filters": [{"col": column, "op": "IN", "val": list(default_value)}]
    },
    "filterState": {"value": list(default_value)},
    "ownState": {},
}
```

Do not add a default to any other select filter.

- [ ] **Step 3: Generate month first and category second**

Build `select_filters` with `default_value=("拉杆箱",)` only for `category`, then build:

```python
native_filters = [
    _month_filter(month_scoped_chart_uuids),
    *(select_filters[column] for _, column in FILTERS),
]
```

- [ ] **Step 4: Strengthen `validate_assets`**

Require exactly 14 filters, the exact approved name order, one category filter, the exact category default DataMask, and the eight approved category targets. Raise actionable `ValueError` messages for count, order, default, or target drift.

- [ ] **Step 5: Run the focused tests**

Run the Task 1 pytest command.

Expected: metadata/order/default assertions pass; SQL/category-column assertions added in Task 3 remain RED until enrichment is implemented.

### Task 3: Enrich Eight Virtual Datasets With Fail-Closed Category SQL

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**
- Consumes: native filter column `category` and hidden filter-column metadata from Task 2.
- Produces: `_product_category_ctes() -> str`, `_category_filter_expression(alias: str) -> str`, and `_native_filter_fragment(..., column_expressions: Mapping[str, str] | None = None) -> str`.

- [ ] **Step 1: Add failing SQL and dataset-column assertions**

For the eight target datasets, assert:

```python
columns = {column["column_name"]: column for column in dataset["columns"]}
assert columns["category"]["verbose_name"] == "品类"
assert columns["category"]["type"] == "STRING"
assert "FROM dim.dim_product" in dataset["sql"]
assert "org_id = 1" in dataset["sql"]
assert "COALESCE(NULLIF(TRIM(category), ''), '-')" in dataset["sql"]
assert "category_conflict_count = 0" in dataset["sql"]
```

Also assert the status dataset has no `category` column and does not join `dim.dim_product`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run the Task 1 pytest command.

Expected: failures for missing category columns and missing DIM SQL.

- [ ] **Step 3: Add shared fail-closed category SQL helpers**

Import `Mapping` from `typing` and add helpers that render these CTEs:

```sql
product_category_values AS (
  SELECT DISTINCT
    sku,
    COALESCE(NULLIF(TRIM(category), ''), '-') AS category
  FROM dim.dim_product
  WHERE org_id = 1
    AND sku IS NOT NULL
),
product_category_quality AS (
  SELECT COUNT(*) AS category_conflict_count
  FROM (
    SELECT sku
    FROM product_category_values
    GROUP BY sku
    HAVING COUNT(*) > 1
  ) conflicts
)
```

`_category_filter_expression("pc")` returns `COALESCE(pc.category, '-')` so unmatched SKUs are represented as `-` without changing ADS facts.

- [ ] **Step 4: Permit expression overrides in `_native_filter_fragment`**

Add `column_expressions: Mapping[str, str] | None = None`. For each filter column, use the override expression when provided and otherwise use `f"{alias}.{column}"`. Detail, dimension-detail, and leaderboard queries pass:

```python
column_expressions={"category": _category_filter_expression("pc")}
```

This preserves existing Jinja `remove_filter=True` behavior and avoids adding category to visible groupings.

- [ ] **Step 5: Enrich daily and monthly datasets**

Append the category CTEs to `_coverage_ctes(...)`, left join `product_category_values pc` on `pc.sku = d.sku` or `pc.sku = m.sku`, cross join `product_category_quality pcq`, select `COALESCE(pc.category, '-') AS category`, and require `pcq.category_conflict_count = 0`.

- [ ] **Step 6: Enrich detail, dimension-detail, and leaderboard filters**

Add the shared category CTEs to `_detail_sql`, `_dimension_detail_sql`, and `_leaderboard_sql`. Join `product_category_values pc` anywhere a raw daily/monthly fact alias receives native select predicates. Cross join the quality CTE and require `category_conflict_count = 0` in each filtered source CTE. Keep category out of visible group-by fields and metrics.

- [ ] **Step 7: Run tests and inspect generated SQL**

Run:

```bash
python3 -m pytest \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py \
  -q --confcutdir=tests/unit_tests/scripts
python3 -m py_compile scripts/hot_product_index_dashboard.py
```

Expected: all no-app generator tests pass; compilation succeeds.

### Task 4: Verify, Commit, and Prepare Guarded Production Import

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`
- Reference: `docs/superpowers/specs/2026-08-11-hot-product-category-filter-design.md`

**Interfaces:**
- Consumes: Tasks 1-3 implementation.
- Produces: deterministic category-filter Assets ZIP and one scoped implementation commit.

- [ ] **Step 1: Run the complete focused Python suite**

```bash
python3 -m pytest \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py -q
```

Expected: both files pass under the configured Superset test environment. If environment-only imports fail, separately record them and retain the no-app passing evidence; do not hide behavioral failures.

- [ ] **Step 2: Generate two byte-identical bundles**

```bash
python3 scripts/hot_product_index_dashboard.py --output /private/tmp/hot-product-category-a.zip
python3 scripts/hot_product_index_dashboard.py --output /private/tmp/hot-product-category-b.zip
cmp /private/tmp/hot-product-category-a.zip /private/tmp/hot-product-category-b.zip
unzip -t /private/tmp/hot-product-category-a.zip
shasum -a 256 /private/tmp/hot-product-category-a.zip
```

Expected: `cmp` and `unzip -t` exit 0 and one SHA-256 is recorded.

- [ ] **Step 3: Run formatting and repository checks**

```bash
python3 -m ruff check \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
python3 -m ruff format --check \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git diff --check
```

Run the hooks only against the three owned implementation files:

```bash
uvx pre-commit run --files \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
```

After committing, create a clean temporary clone at the exact candidate SHA and run
`uvx pre-commit run --all-files` there. The shared dirty worktree must never be used for
an all-files auto-fix run.

- [ ] **Step 4: Prove Superset core remains untouched**

```bash
git diff --cached --name-only -- superset superset-frontend
```

Expected: no output. Existing unrelated worktree modifications must remain unstaged and
must not be reverted. After commit, repeat with
`git diff --name-only e96cc65d48..HEAD -- superset superset-frontend` in the clean
candidate clone.

- [ ] **Step 5: Commit the scoped implementation**

```bash
git add -- \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git commit -m "feat(dashboard): add default category filter"
```

- [ ] **Step 6: Perform guarded production release**

Before mutation, save the current Assets export, metadata/topology/UUID/health evidence, active image/container IDs, and an executable rollback import. Run a read-only Doris check proving `org_id = 1` category mappings have no multi-category SKU and include `拉杆箱`. Import with:

```text
POST /api/v1/assets/import/
multipart: bundle=<candidate ZIP>, sparse=true, overwrite=true
```

Do not rebuild the Superset image because no runtime source changed.

- [ ] **Step 7: Run production acceptance**

Verify 2 dashboards, 9 datasets, 27 charts, 38 UUIDs, 26 main charts, 1 guide chart, 14 filters, and no orphan resources. Require all 26 main Chart Data API calls to return HTTP 200 with no errors or warnings. In the in-app browser, confirm `年月` is first, `品类` is second, `拉杆箱` is selected by default, and clearing/changing category refreshes charts. Submit one no-op Dashboard PUT and require HTTP 200. On any failure, import the complete pre-release Assets backup and re-run health/topology checks.
