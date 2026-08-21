# 爆品指数表格隐藏每页条数实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅在爆品指数主看板中隐藏全部 Table 图表的“每页条数”控件，同时保持取数、分页参数、汇总、排序和滚动行为不变。

**Architecture:** 在资产生成器中定义主看板专用 CSS，并通过 `_dashboard` 的显式 `css` 参数只注入 `hot-product-index` 主看板。说明看板继续使用空 CSS；不修改 Table 插件、不构建前端镜像。

**Tech Stack:** Python 3.10、pytest、Superset assets ZIP、Superset Assets Import API、Chrome

## Global Constraints

- 只隐藏 `.dt-select-page-size`，不隐藏 `.dt-controls`，避免影响搜索等其他控制项。
- 不修改任何图表的 `page_length`、`server_page_length`、`server_pagination`、`row_limit`。
- 不修改数据集 SQL、指标口径、原生筛选器、资产 UUID 或其他看板。
- 使用当前 `noway-release` 工作区；保留并忽略所有无关脏文件。
- 生产仅导入 Superset 元数据，不构建镜像、不重启容器。

---

### Task 1: 生成主看板专用 CSS

**Files:**
- Modify: `scripts/hot_product_index_dashboard.py`
- Test: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Test: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`

**Interfaces:**
- Consumes: `_dashboard(...) -> Asset` 和 `_dashboards() -> AssetBundle`。
- Produces: `MAIN_DASHBOARD_CSS: Final[str]`，以及 `_dashboard(..., css: str = "") -> Asset`。

- [ ] **Step 1: 写失败测试**

在主资产测试中断言：

```python
assert main["css"] == (
    ".dt-select-page-size {\n"
    "  display: none !important;\n"
    "}\n"
)
assert guide["css"] == ""
assert ".dt-controls" not in main["css"]
```

同步更新所有把主看板 CSS 固定断言为空字符串的既有测试；说明看板断言保持为空。

- [ ] **Step 2: 运行聚焦测试并确认失败**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
```

预期：主看板 `css` 仍为空导致新增断言失败。

- [ ] **Step 3: 实现最小生成器变更**

在生成器中增加：

```python
MAIN_DASHBOARD_CSS: Final[str] = """.dt-select-page-size {
  display: none !important;
}
"""
```

将 `_dashboard` 扩展为：

```python
def _dashboard(
    *,
    title: str,
    slug: str,
    uuid: str,
    description: str,
    position: Asset,
    metadata: Asset,
    css: str = "",
) -> Asset:
```

返回值使用 `"css": css`。仅主看板调用传入 `css=MAIN_DASHBOARD_CSS`，说明看板不传参。

- [ ] **Step 4: 运行测试和静态检查**

```bash
/private/tmp/superset-hot-product-venv/bin/python -m pytest -q \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
/private/tmp/superset-hot-product-venv/bin/python -m ruff format --check \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
/private/tmp/superset-hot-product-venv/bin/python -m ruff check \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git diff --check
```

预期：测试、ruff 和 whitespace 检查全部通过。

- [ ] **Step 5: 生成并解析资产包**

```bash
/private/tmp/superset-hot-product-venv/bin/python \
  scripts/hot_product_index_dashboard.py \
  --output /private/tmp/hot-product-index-hide-page-size.zip
unzip -t /private/tmp/hot-product-index-hide-page-size.zip
shasum -a 256 /private/tmp/hot-product-index-hide-page-size.zip
```

解析 ZIP 后确认主看板 CSS 精确匹配、说明看板 CSS 为空，资产数量仍为 9 数据集、27 图表、2 看板。

- [ ] **Step 6: 提交实现**

```bash
git add \
  scripts/hot_product_index_dashboard.py \
  tests/unit_tests/scripts/hot_product_index_dashboard_test.py \
  tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py
git commit -m "fix(dashboard): hide table page size control"
```

---

### Task 2: 生产元数据发布与浏览器验收

**Files:**
- Read: `/private/tmp/hot-product-index-hide-page-size.zip`
- Create on production: `backup_dir="/home/ubuntu/superset-docker/backups/hot-product-page-size-$(date -u +%Y%m%dT%H%M%SZ)"`

**Interfaces:**
- Consumes: Task 1 生成的资产 ZIP 与提交 SHA。
- Produces: 生产备份、导入响应、资产拓扑、健康检查和 Chrome 验收证据。

- [ ] **Step 1: 执行发布前只读门禁**

确认 Git 中任务文件无未提交差异；记录 ZIP SHA256。通过生产 API 导出当前主看板及关联资产，并保存：

```text
current-dashboards.zip
metadata-before.json
rollback.sh
SHA256SUMS
health-local-before.txt
health-public-before.txt
```

回滚脚本只导入 `current-dashboards.zip`，随后检查本地和公网 `/health`。

- [ ] **Step 2: 导入资产 ZIP**

通过 `/api/v1/assets/import/` 使用 `sparse=true`、`overwrite=true` 导入资产，保存 HTTP 状态与 JSON 响应。预期 HTTP 200 且响应为 `{"message":"OK"}`。

- [ ] **Step 3: 验证资产和 API**

只读核验：

```text
datasets=9
charts=27
dashboards=2
main_chart_links=26
guide_chart_links=1
native_filters=13
published_uuids=38
unique_uuids=38
```

确认主看板 CSS 包含 `.dt-select-page-size`，说明看板 CSS 为空；主看板 26 个 Chart Data API 均 HTTP 200；本地与公网健康检查均返回 `OK`。

- [ ] **Step 4: Chrome 验收六张表**

打开生产 `hot-product-index`，逐一检查：

```text
SPU维度
SKU维度
国家
SPU开发经理
型号
SPU销量排行榜
```

每张表均不得出现“每页条数”或页数选择框；数据行、汇总行、横向滚动、排序和原生筛选响应保持正常。保留生产看板标签页供用户查看。

- [ ] **Step 5: 完成发布记录**

记录最终提交 SHA、ZIP SHA256、备份目录、导入响应、拓扑、Chart API、Chrome 和健康检查结果。任何门禁失败时停止并执行元数据回滚，不修改 Superset 全局前端代码。
