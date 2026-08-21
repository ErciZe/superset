# 爆品指数 SKU 销售比例饼图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `SKU销售比例` 从矩形树图改为与 `SPU销售比例` 一致的环形饼图并完成生产验收。

**Architecture:** 复用资产生成器现有 `_pie_params` 和 Pie query-context 生成路径，仅替换 SKU 图表的可视化类型与参数。通过生成器合同测试、资产 ZIP、生产 API 和浏览器完成端到端验收。

**Tech Stack:** Python、pytest、Superset Assets ZIP、Superset Assets Import API、ECharts Pie

## Global Constraints

- 保持图表 UUID、数据集、布局、筛选器和资产数量不变。
- 不修改 Superset 核心前端或 ADS 数据口径。
- 保留当前工作区所有无关脏文件，不暂存、不回退。

---

### Task 1: 测试驱动调整图表合同

**Files:**
- Modify: `tests/unit_tests/scripts/hot_product_index_remaining_charts_test.py`
- Modify: `tests/unit_tests/scripts/hot_product_index_dashboard_test.py`
- Modify: `scripts/hot_product_index_dashboard.py`

**Interfaces:**
- Consumes: `_pie_params(groupby: str, *, legend_type: str) -> Asset`
- Produces: `SKU销售比例` Pie chart asset with `groupby=["sku"]`

- [ ] 修改测试，要求三张比例/分布图均为 Pie，并要求主看板 Pie 数量为 3、Treemap 数量为 0。
- [ ] 运行聚焦测试，确认因 SKU 图仍为 `treemap_v2` 而失败。
- [ ] 将 SKU 图表改为 `viz_type="pie"` 和 `_pie_params("sku", legend_type="plain")`。
- [ ] 运行两个生成器测试文件、`py_compile` 和 `git diff --check`。
- [ ] 生成资产 ZIP，验证 9/27/2 拓扑及图表 UUID 不变。

### Task 2: 生产元数据发布与验收

**Files:**
- Read: generated candidate ZIP
- Create on production: timestamped backup directory under `/home/ubuntu/superset-docker/backups/`

**Interfaces:**
- Consumes: deterministic Superset assets ZIP
- Produces: production metadata import, rollback bundle, API and browser evidence

- [ ] 导出当前两个看板及关联资产，保存元数据、健康状态和回滚脚本。
- [ ] 以 `sparse=true`、`overwrite=true` 导入候选 ZIP。
- [ ] 验证 9 数据集、27 图表、2 看板、38 唯一 UUID 和 26 个主图 API。
- [ ] 在生产浏览器确认 SKU 图为环形饼图，中文 Tooltip 与筛选响应正常。
- [ ] 保存 SHA256、导入响应和回滚材料；失败时导入发布前备份。
