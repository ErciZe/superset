# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from __future__ import annotations

import json  # noqa: TID251
import re
from copy import deepcopy
from pathlib import Path
from typing import Any, cast
from zipfile import ZipFile

import pytest

from scripts.hot_product_index_dashboard import (
    _load_color_map_snapshot,
    COLOR_DISPLAY_MAPPINGS,
    COLOR_LABEL_COLORS,
    DAILY_SOURCE_COLUMNS,
    FILTERS,
    MONTHLY_SOURCE_COLUMNS,
    UUIDS,
    write_bundle,
)
from scripts.validate_hot_product_color_map import validate_rows

EXPECTED_MAIN_DASHBOARD_CSS = """.dt-select-page-size {
  display: none !important;
}
"""


def test_color_map_snapshot_has_approved_unique_contract() -> None:
    """Checksum validation exposes the approved 39-code palette to assets."""
    assert len(COLOR_DISPLAY_MAPPINGS) == 39
    assert len({item["color_code"] for item in COLOR_DISPLAY_MAPPINGS}) == 39
    assert len(COLOR_LABEL_COLORS) == 39
    assert COLOR_LABEL_COLORS["黑（BK）"] == "#222222"
    assert COLOR_LABEL_COLORS["白"] == "#D9D9D6"


def test_color_map_snapshot_rejects_tampered_mappings(tmp_path: Path) -> None:
    """A stale checksum prevents silently publishing changed display colors."""
    snapshot = {
        "version": "test-v1",
        "source_table": "dim.dim_product_color_display_map",
        "mapping_sha256": "0" * 64,
        "mappings": [
            {
                "color_code": "BK",
                "color_name_zh": "黑",
                "display_hex": "#222222",
            }
        ],
    }
    path = tmp_path / "color-map.json"
    path.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")

    with pytest.raises(ValueError, match="checksum"):
        _load_color_map_snapshot(path)


def test_production_color_rows_must_match_release_snapshot() -> None:
    """Publishing fails before import when DIM values drift from the snapshot."""
    rows = [
        {
            **mapping,
            "is_active": 1,
        }
        for mapping in COLOR_DISPLAY_MAPPINGS
    ]
    validate_rows(rows)
    rows[0]["display_hex"] = "#FFFFFF"

    with pytest.raises(ValueError, match="differs"):
        validate_rows(rows)


def read_bundle(path: Path) -> dict[str, dict[str, Any]]:
    """Read generated JSON-as-YAML assets and strip the ZIP root directory."""
    with ZipFile(path) as bundle:
        names = bundle.namelist()
        roots = {name.split("/", maxsplit=1)[0] for name in names}
        assert roots == {"hot_product_index_assets"}
        return {
            name.split("/", maxsplit=1)[1]: json.loads(bundle.read(name))
            for name in names
        }


def assets_by_key(
    assets: dict[str, dict[str, Any]], prefix: str, key: str
) -> dict[str, dict[str, Any]]:
    """Index one asset family by a business-facing field."""
    return {
        asset[key]: asset
        for path, asset in assets.items()
        if path.startswith(f"{prefix}/")
    }


REMAINING_DETAIL_SPECS: dict[str, dict[str, Any]] = {
    "国家维度": {
        "dataset_uuid": "9422d2ca-a0a7-4dbb-b03d-bd04a6960338",
        "chart_uuid": "f32d9482-620e-461d-9bcc-9d492e84c6f8",
        "dataset_name": "爆品指数-国家经营明细",
        "dimensions": ("country",),
    },
    "SPU开发经理": {
        "dataset_uuid": "5b7a6624-3ce4-4f40-b82d-cf15d0602471",
        "chart_uuid": "4b973af8-843a-4742-bc08-2370e32c9276",
        "dataset_name": "爆品指数-SPU开发经理经营明细",
        "dimensions": ("developer", "spu"),
    },
    "型号维度": {
        "dataset_uuid": "3cdba303-b955-4ae1-b4c9-8f7d8e52eae2",
        "chart_uuid": "1d957d19-49e0-4a73-961d-70f492f0b114",
        "dataset_name": "爆品指数-型号经营明细",
        "dimensions": ("model",),
    },
}

REMAINING_DETAIL_METRICS = (
    "sales_amount_usd",
    "sales_qty",
    "gross_profit_usd",
    "gross_margin",
    "return_goods_qty",
    "return_rate",
    "order_qty",
    "avg_sales_qty_7d",
    "avg_sales_qty_30d",
    "avg_sales_qty_90d",
    "theoretical_stock_qty",
    "actual_stock_qty",
)


def cte_section(sql: str, cte_name: str, *next_cte_names: str) -> str:
    """Return one top-level CTE body without coupling tests to full SQL text."""
    start = sql.index(f"{cte_name} AS (")
    ends = [
        sql.find(f"{next_cte_name} AS (", start + len(cte_name))
        for next_cte_name in next_cte_names
    ]
    end = min(end for end in ends if end >= 0)
    return sql[start:end]


def test_remaining_analysis_layout_and_parent_chains(tmp_path: Path) -> None:
    """The remaining analysis charts form the approved two-row nested grid."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "在售产品爆品指数看板"
    ]
    position = main["position"]

    assert position["GRID_ID"]["children"][-2:] == [
        "ROW-ANALYSIS-PRIMARY",
        "ROW-ANALYSIS-SHARES",
    ]
    assert position["ROW-ANALYSIS-PRIMARY"]["children"] == [
        "COLUMN-TREND",
        "COLUMN-LEADERBOARD",
    ]
    assert position["COLUMN-TREND"]["meta"]["width"] == 7.25
    assert position["COLUMN-LEADERBOARD"]["meta"]["width"] == 4.75
    assert position["TABS-TREND"]["children"] == [
        "TAB-TREND-DAY",
        "TAB-TREND-WEEK",
        "TAB-TREND-MONTH",
    ]
    assert [
        position[key]["meta"]["text"] for key in position["TABS-TREND"]["children"]
    ] == ["天", "周", "月"]
    assert position["ROW-ANALYSIS-SHARES"]["children"] == [
        "CHART-SPU-SHARE",
        "CHART-SKU-SHARE",
        "COLUMN-COLOR-TREND",
        "CHART-COLOR-DISTRIBUTION",
    ]
    assert position["COLUMN-COLOR-TREND"]["meta"]["width"] == 3

    for component_id in (
        "CHART-SPU-SHARE",
        "CHART-SKU-SHARE",
        "CHART-COLOR-DISTRIBUTION",
    ):
        assert position[component_id]["meta"]["width"] == 3
        assert position[component_id]["meta"]["height"] == 44
        assert position[component_id]["parents"] == [
            "ROOT_ID",
            "GRID_ID",
            "ROW-ANALYSIS-SHARES",
        ]

    assert position["CHART-SPU-LEADERBOARD"]["meta"]["width"] == 12
    assert position["CHART-SPU-LEADERBOARD"]["meta"]["height"] == 44
    assert position["CHART-SPU-LEADERBOARD"]["parents"] == [
        "ROOT_ID",
        "GRID_ID",
        "ROW-ANALYSIS-PRIMARY",
        "COLUMN-LEADERBOARD",
    ]

    trend_parent = [
        "ROOT_ID",
        "GRID_ID",
        "ROW-ANALYSIS-PRIMARY",
        "COLUMN-TREND",
        "TABS-TREND",
    ]
    for tab_id, row_id, chart_id in (
        ("TAB-TREND-DAY", "ROW-TREND-DAY", "CHART-TREND-DAY"),
        ("TAB-TREND-WEEK", "ROW-TREND-WEEK", "CHART-TREND-WEEK"),
        ("TAB-TREND-MONTH", "ROW-TREND-MONTH", "CHART-TREND-MONTH"),
    ):
        assert position[tab_id]["parents"] == [*trend_parent]
        assert position[row_id]["parents"] == [*trend_parent, tab_id]
        assert position[chart_id]["parents"] == [
            *trend_parent,
            tab_id,
            row_id,
        ]
        assert position[chart_id]["meta"]["width"] == 12
        assert position[chart_id]["meta"]["height"] == 38

    color_parent = [
        "ROOT_ID",
        "GRID_ID",
        "ROW-ANALYSIS-SHARES",
        "COLUMN-COLOR-TREND",
        "TABS-COLOR-TREND",
    ]
    assert position["TABS-COLOR-TREND"]["children"] == [
        "TAB-COLOR-WEEK",
        "TAB-COLOR-MONTH",
    ]
    for tab_id, row_id, chart_id in (
        ("TAB-COLOR-WEEK", "ROW-COLOR-WEEK", "CHART-COLOR-WEEK"),
        ("TAB-COLOR-MONTH", "ROW-COLOR-MONTH", "CHART-COLOR-MONTH"),
    ):
        assert position[tab_id]["parents"] == [*color_parent]
        assert position[row_id]["parents"] == [*color_parent, tab_id]
        assert position[chart_id]["parents"] == [
            *color_parent,
            tab_id,
            row_id,
        ]
        assert position[chart_id]["meta"]["width"] == 12
        assert position[chart_id]["meta"]["height"] == 38


def test_remaining_analysis_filter_scope_includes_leaderboard_only_daily(
    tmp_path: Path,
) -> None:
    """Selects target the leaderboard while the month range excludes it."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "在售产品爆品指数看板"
    ]
    filters = main["metadata"]["native_filter_configuration"]
    select_filters = [item for item in filters if item["filterType"] == "filter_select"]
    month_filter = next(
        item for item in filters if item["filterType"] == "filter_month_range"
    )

    leaderboard_uuid = UUIDS["chart_spu_leaderboard"]
    leaderboard_dataset_uuid = UUIDS["dataset_spu_leaderboard"]
    new_chart_uuids = {
        UUIDS[key]
        for key in (
            "chart_trend_day",
            "chart_trend_week",
            "chart_trend_month",
            "chart_spu_share",
            "chart_sku_share",
            "chart_spu_leaderboard",
            "chart_color_trend_week",
            "chart_color_trend_month",
            "chart_color_distribution",
        )
    }

    assert len(select_filters) == 13
    for item in select_filters:
        assert leaderboard_uuid in item["chartsInScope"]
        target_datasets = {target["datasetUuid"] for target in item["targets"]}
        assert {
            leaderboard_dataset_uuid,
            UUIDS["dataset_country_detail"],
            UUIDS["dataset_developer_detail"],
            UUIDS["dataset_model_detail"],
        } <= target_datasets
        assert new_chart_uuids <= set(item["chartsInScope"])

    assert leaderboard_uuid not in month_filter["chartsInScope"]
    month_target_datasets = {
        target["datasetUuid"] for target in month_filter["targets"]
    }
    assert leaderboard_dataset_uuid not in month_target_datasets
    assert {
        UUIDS["dataset_country_detail"],
        UUIDS["dataset_developer_detail"],
        UUIDS["dataset_model_detail"],
    } <= month_target_datasets
    assert new_chart_uuids - {leaderboard_uuid} <= set(month_filter["chartsInScope"])


def test_remaining_analysis_uses_stock_dashboard_css(tmp_path: Path) -> None:
    """The stock dashboard hides only the table page-size selector."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "在售产品爆品指数看板"
    ]
    assert main["css"] == EXPECTED_MAIN_DASHBOARD_CSS
    assert ".dt-controls" not in main["css"]


def test_daily_dataset_exposes_trend_and_color_semantics(tmp_path: Path) -> None:
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    daily = assets_by_key(assets, "datasets", "table_name")["爆品指数-日明细"]
    columns = {item["column_name"]: item for item in daily["columns"]}
    metrics = {item["metric_name"]: item for item in daily["metrics"]}

    assert columns["week_start_date"]["verbose_name"] == "周一日期"
    assert columns["week_start_date"]["type"] == "DATE"
    assert columns["week_start_date"]["is_dttm"] is True
    assert columns["yw"]["verbose_name"] == "年周"
    assert columns["yw"]["type"] == "STRING"
    assert columns["ymd"]["verbose_name"] == "年月日"
    assert columns["ymd"]["type"] == "STRING"
    assert columns["color_code"]["verbose_name"] == "颜色代码"
    assert columns["color_code"]["type"] == "STRING"
    assert "DATE_SUB(d.sales_date, INTERVAL WEEKDAY(d.sales_date) DAY)" in daily["sql"]
    assert "DATE_FORMAT(d.sales_date, '%Y-%m-%d') AS ymd" in daily["sql"]
    assert "DATE_FORMAT(d.sales_date, '%xW%v') AS yw" in daily["sql"]
    assert (
        "NULLIF(TRIM(SUBSTRING_INDEX(d.color, '-', -1)), '') AS color_code"
        in daily["sql"]
    )
    assert "d.sales_date >= v.selected_start_date" in daily["sql"]
    assert "d.sales_date < v.effective_end_exclusive_date" in daily["sql"]

    assert metrics["avg_daily_sales_qty_period"]["expression"] == (
        "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date), 0)"
    )
    hot_product_index = metrics["hot_product_index"]["expression"]
    assert hot_product_index == (
        "SUM(sales_qty) / NULLIF("
        "COUNT(DISTINCT CONCAT("
        "DATE_FORMAT(sales_date, '%Y-%m-%d'), '#', HEX(sku))), 0)"
    )
    assert "COUNT(DISTINCT sales_date, sku)" not in hot_product_index
    assert metrics["hot_product_index"]["description"] == (
        "销量除以有记录的日期-SKU组合数（按日期和SKU的可逆编码精确去重）。"
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


def test_color_charts_use_authoritative_display_labels_and_colors(
    tmp_path: Path,
) -> None:
    """Mapped colors use Chinese labels while unknown codes remain queryable."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    daily = assets_by_key(assets, "datasets", "table_name")["爆品指数-日明细"]
    charts = assets_by_key(assets, "charts", "slice_name")
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "在售产品爆品指数看板"
    ]
    columns = {item["column_name"]: item for item in daily["columns"]}

    assert columns["color_display_label"]["type"] == "STRING"
    assert columns["color_display_label"]["verbose_name"] == "展示颜色"
    assert columns["color_display_label"]["filterable"] is True
    assert columns["color_display_label"]["groupby"] is True
    assert "LEFT JOIN dim.dim_product_color_display_map pcm" in daily["sql"]
    assert "pcm.is_active = 1" in daily["sql"]
    assert "ELSE CONCAT(pcm.color_name_zh, '（'," in daily["sql"]
    assert "WHEN pcm.color_code IS NULL THEN" in daily["sql"]
    assert "WHEN pcm.color_name_zh =" in daily["sql"]

    for chart_name in (
        "颜色销售比例-周",
        "颜色销售比例-月",
        "颜色销量分布",
    ):
        assert charts[chart_name]["params"]["groupby"] == ["color_display_label"]

    assert main["metadata"]["label_colors"]["黑（BK）"] == "#222222"
    assert main["metadata"]["label_colors"]["枪黑（GBK）"] == "#3B444B"
    assert "黑（BK）" in main["metadata"]["shared_label_colors"]
    assert "UNKNOWN" not in main["metadata"]["label_colors"]


def test_new_daily_metrics_have_chinese_labels_and_approved_formats(
    tmp_path: Path,
) -> None:
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    daily = assets_by_key(assets, "datasets", "table_name")["爆品指数-日明细"]
    metrics = {item["metric_name"]: item for item in daily["metrics"]}
    expected_metadata = {
        "avg_daily_sales_qty_period": ("日均销量", ",.1~f"),
        "return_goods_qty_total": ("退货量", ",.0f"),
        "order_qty_total": ("订单量", ",.0f"),
        "in_sale_sku_count_period": ("在售SKU数", ",.0f"),
        "in_sale_spu_count_period": ("在售SPU数", ",.0f"),
        "sales_amount_usd_wan": ("销售额", ",.1~f"),
        "gross_profit_usd_wan": ("毛利润", ",.1~f"),
    }
    assert {
        name: (metrics[name]["verbose_name"], metrics[name]["d3format"])
        for name in expected_metadata
    } == expected_metadata


def test_spu_leaderboard_uses_watermark_anchored_two_period_contract(
    tmp_path: Path,
) -> None:
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    leaderboard = datasets["爆品指数-SPU销量排行榜"]
    sql = leaderboard["sql"]

    assert leaderboard["uuid"] == "2b5c33b2-2af6-5436-8b3d-e7292e5a64ae"
    assert leaderboard["main_dttm_col"] == "watermark_month_start_date"
    assert "get_time_filter(" not in sql
    for _, column in FILTERS:
        assert sql.count(f"get_filters('{column}', remove_filter=True)") == 2
    assert "spu_previous_month_sales_amount_cny" not in sql
    assert "SUM(m.sales_amount_usd)" in sql
    assert "AND d.sales_date <= a.data_through_date" in sql
    assert "GROUP BY m.spu, m.spu_previous_month_sales_level, m.product_level" in sql
    assert "COALESCE(c.product_level, '') AS actual_rating" in sql
    assert "spu_final_rating" not in sql
    assert "watermark_time_progress" not in sql
    assert (
        "NULLIF(DAY(q.data_through_date) / DAY(LAST_DAY(q.data_through_date)), 0)"
        in sql
    )

    columns = {column["column_name"]: column for column in leaderboard["columns"]}
    assert columns["product_level"]["groupby"] is False
    assert "原生筛选目标" in (columns["product_level"]["description"] or "")
    assert {
        columns[name]["verbose_name"]
        for name in (
            "spu",
            "spu_rating",
            "product_level",
            "actual_rating",
            "previous_month_sales_amount_usd",
            "current_month_sales_amount_usd",
            "rating_progress",
            "time_progress",
        )
    } == {
        "SPU",
        "计算评级",
        "实际评级",
        "上月销售额",
        "本月销量额",
        "本月评级达标进度",
        "本月时间达标进度",
    }
    assert columns["product_level"]["verbose_name"] == "实际评级"
    assert columns["actual_rating"]["verbose_name"] == "实际评级"


def test_remaining_charts_preflight_enumerates_all_source_columns() -> None:
    preflight = Path(
        "scripts/hot_product_index_remaining_charts_preflight.sql"
    ).read_text()
    sql_without_comments = re.sub(r"--[^\n]*(?:\n|$)", "", preflight)
    first_result_set = sql_without_comments.split(";", maxsplit=1)[0]
    pairs = re.findall(
        r"(?:SELECT|UNION ALL SELECT)\s+'([^']+)'\s*"
        r"(?:AS table_name,\s*|,\s*)'([^']+)'(?:\s+AS column_name)?",
        first_result_set,
        flags=re.IGNORECASE,
    )
    expected_pairs = [
        (table_name, column_name)
        for table_name, source_columns in (
            ("ads_pdm_lx_hot_product_index_sku_d", DAILY_SOURCE_COLUMNS),
            ("ads_pdm_lx_hot_product_index_sku_m", MONTHLY_SOURCE_COLUMNS),
        )
        for column_name, _ in source_columns
    ]
    assert pairs == expected_pairs
    assert len(pairs) == len(set(pairs))


def test_remaining_charts_preflight_uses_exact_two_stage_cardinality_gate() -> None:
    preflight = Path(
        "scripts/hot_product_index_remaining_charts_preflight.sql"
    ).read_text()
    sql_without_comments = re.sub(r"--[^\n]*(?:\n|$)", "", preflight)
    result_sets = [
        part.strip() for part in sql_without_comments.split(";") if part.strip()
    ]
    cardinality_result_set = result_sets[1]

    assert "WITH eligible AS (" in cardinality_result_set
    assert "monthly_category_distinct AS (" in cardinality_result_set
    assert "history_category_distinct AS (" in cardinality_result_set
    assert "dimension_seed AS (" in cardinality_result_set
    assert "SELECT 'spu' AS dimension_name" in cardinality_result_set
    assert "UNION ALL SELECT 'sku'" in cardinality_result_set
    assert "UNION ALL SELECT 'color_code'" in cardinality_result_set
    assert "history_category_counts AS (" in cardinality_result_set
    assert "FROM dimension_seed s" in cardinality_result_set
    assert "LEFT JOIN history_category_counts h" in cardinality_result_set
    assert "COALESCE(h.distinct_count, 0)" in cardinality_result_set
    assert "GROUP BY ym, spu" in cardinality_result_set
    assert "GROUP BY ym, sku" in cardinality_result_set
    assert "GROUP BY ym, color_code" in cardinality_result_set
    assert "GROUP BY dimension_name, dimension_value" in cardinality_result_set
    assert "COUNT(*) AS distinct_count" in cardinality_result_set
    assert (
        "CASE WHEN COALESCE(h.distinct_count, 0) <= 1000 THEN 1 ELSE 0 END "
        "AS within_limit" in cardinality_result_set
    )
    assert not re.search(
        r"COUNT\s*\(\s*DISTINCT\s+(?:spu|sku|color_code)\b",
        cardinality_result_set,
        flags=re.IGNORECASE,
    )


def test_remaining_chart_identities_and_parameter_contract(tmp_path: Path) -> None:
    """The nine visible chart assets keep the fixed FineBI identities."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    expected_legend_selection = {
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
    }
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
    expected_paths = {
        "charts/Hot_Product_Index_Trend_Day.yaml": "指标整体趋势-天",
        "charts/Hot_Product_Index_Trend_Week.yaml": "指标整体趋势-周",
        "charts/Hot_Product_Index_Trend_Month.yaml": "指标整体趋势-月",
        "charts/Hot_Product_Index_SPU_Sales_Ratio.yaml": "SPU销售比例",
        "charts/Hot_Product_Index_SKU_Sales_Ratio.yaml": "SKU销售比例",
        "charts/Hot_Product_Index_SPU_Leaderboard.yaml": "SPU销量排行榜",
        "charts/Hot_Product_Index_Color_Sales_Ratio_Week.yaml": "颜色销售比例-周",
        "charts/Hot_Product_Index_Color_Sales_Ratio_Month.yaml": "颜色销售比例-月",
        "charts/Hot_Product_Index_Color_Sales_Distribution.yaml": "颜色销量分布",
    }
    assert {
        path: assets[path]["slice_name"] for path in expected_paths
    } == expected_paths
    assert {path: assets[path]["uuid"] for path in expected_paths} == {
        path: expected[expected_name] for path, expected_name in expected_paths.items()
    }

    for name, x_axis in {
        "指标整体趋势-天": "ymd",
        "指标整体趋势-周": "yw",
        "指标整体趋势-月": "ym",
    }.items():
        chart = charts[name]
        params = chart["params"]
        assert chart["viz_type"] == "mixed_timeseries"
        assert params["x_axis"] == x_axis
        assert params["metrics"] == [
            "hot_product_index",
            "sales_qty_total",
            "avg_daily_sales_qty_period",
            "return_goods_qty_total",
            "order_qty_total",
            "in_sale_sku_count_period",
            "in_sale_spu_count_period",
            "return_rate",
            "gross_margin",
        ]
        assert params["metrics_b"] == [
            "sales_amount_usd_wan",
            "gross_profit_usd_wan",
        ]
        assert params["seriesType"] == params["seriesTypeB"] == "line"
        assert params["show_value"] is True
        assert params["show_valueB"] is True
        assert params["y_axis_format"] == params["y_axis_format_secondary"] == ",.1~f"
        assert params["yAxisIndex"] == 0
        assert params["yAxisIndexB"] == 1
        assert params["yAxisTitleSecondary"] == "金额（万美元）"
        assert (
            params["x_axis_time_format"]
            == {
                "ymd": "%Y-%m-%d",
                "yw": "%YW%V",
                "ym": "%Y-%m",
            }[x_axis]
        )
        assert json.loads(params["echart_options"]) == {
            "legend": {"selected": expected_legend_selection}
        }

        context = json.loads(chart["query_context"])
        assert len(context["queries"]) == 2
        assert context["form_data"]["datasource"] == "0__table"
        for query, metrics in zip(
            context["queries"],
            (params["metrics"], params["metrics_b"]),
            strict=True,
        ):
            assert query["columns"] == [x_axis]
            assert query["series_columns"] == []
            assert query["metrics"] == metrics
            assert query["time_range"] == "Current month"
            assert query["row_limit"] == 100000
            assert [item["operation"] for item in query["post_processing"]] == [
                "pivot",
                "rename",
                "flatten",
            ]
            assert not any(
                item["operation"] == "resample" for item in query["post_processing"]
            )


def test_remaining_pie_and_color_trend_contracts(tmp_path: Path) -> None:
    """Pie and color trend charts use complete-category, Chinese contracts."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    for name, groupby, legend_type in (
        ("SPU销售比例", "spu", "plain"),
        ("颜色销量分布", "color_display_label", "plain"),
    ):
        chart = charts[name]
        params = chart["params"]
        assert chart["viz_type"] == "pie"
        assert params["groupby"] == [groupby]
        assert params["legendType"] == legend_type
        assert params["row_limit"] == 1000
        assert params["threshold_for_other"] == 0
        assert 40 <= params["innerRadius"] < params["outerRadius"] <= 80
        assert params["show_labels_threshold"] == 3
        assert params["sort_by_metric"] is True
        assert params["donut"] is True
        assert params["show_total"] is True
        assert "total_label" not in params
        assert params["label_type"] == "key_percent"
        assert params["number_format"] == ",.0f"

        query = json.loads(chart["query_context"])["queries"]
        assert len(query) == 1
        assert query[0]["columns"] == [groupby]
        metric = params["metric"]
        assert metric["label"] == "销量"
        assert query[0]["metrics"] == [metric]
        assert query[0]["orderby"] == [[metric, False]]
        assert query[0]["post_processing"] == [
            {
                "operation": "contribution",
                "options": {
                    "columns": ["销量"],
                    "rename_columns": ["销量占比"],
                },
            }
        ]

    sku = charts["SKU销售比例"]
    sku_params = sku["params"]
    assert sku["viz_type"] == "treemap_v2"
    assert sku_params["groupby"] == ["sku"]
    assert sku_params["metric"]["label"] == "销量"
    assert sku_params["row_limit"] == 1000
    assert sku_params["number_format"] == ",.0f"
    sku_query = json.loads(sku["query_context"])["queries"][0]
    assert sku_query["columns"] == ["sku"]
    assert sku_query["metrics"] == [sku_params["metric"]]
    assert sku_query["orderby"] == [[sku_params["metric"], False]]
    assert sku_query["post_processing"] == []

    for name, x_axis in (("颜色销售比例-周", "yw"), ("颜色销售比例-月", "ym")):
        chart = charts[name]
        params = chart["params"]
        assert chart["viz_type"] == "echarts_timeseries_line"
        assert params["x_axis"] == x_axis
        assert params["groupby"] == ["color_display_label"]
        assert params["metrics"] == ["sales_qty_total"]
        assert params["show_value"] is True
        assert params["y_axis_format"] == ",.0f"
        assert params["series_limit"] == 1000
        assert params["row_limit"] == 100000
        query = json.loads(chart["query_context"])["queries"][0]
        assert query["columns"] == [x_axis, "color_display_label"]
        assert query["series_columns"] == ["color_display_label"]
        assert query["metrics"] == ["sales_qty_total"]
        assert [item["operation"] for item in query["post_processing"]] == [
            "pivot",
            "rename",
            "flatten",
        ]
        assert not any(
            item["operation"] == "resample" for item in query["post_processing"]
        )


def test_echarts_tooltips_use_chinese_adhoc_metric_labels(tmp_path: Path) -> None:
    """Interactive charts must not expose saved snake-case metric names."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    expected = {
        "SPU销售比例": "销量",
        "SKU销售比例": "销量",
        "颜色销量分布": "销量",
        "SPU销售额漏斗": "销售额",
        "SPU数漏斗": "在售SPU数",
    }

    for chart_name, label in expected.items():
        chart = charts[chart_name]
        metric = chart["params"]["metric"]
        assert metric["expressionType"] == "SQL"
        assert metric["hasCustomLabel"] is True
        assert metric["label"] == label
        assert metric["sqlExpression"]
        assert chart["query_context"]
        query = json.loads(chart["query_context"])["queries"][0]
        assert query["metrics"] == [metric]
        assert not any(
            isinstance(value, str) and re.search(r"[a-z]+_[a-z]", value)
            for value in query["metrics"]
        )

    for chart_name in ("SPU销售比例", "颜色销量分布"):
        query = json.loads(charts[chart_name]["query_context"])["queries"][0]
        assert query["post_processing"] == [
            {
                "operation": "contribution",
                "options": {
                    "columns": ["销量"],
                    "rename_columns": ["销量占比"],
                },
            }
        ]


def test_remaining_leaderboard_contract_and_conditional_formatting(
    tmp_path: Path,
) -> None:
    """The leaderboard exposes a stable, paged, non-negative color contract."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    leaderboard = assets_by_key(assets, "charts", "slice_name")["SPU销量排行榜"]
    params = leaderboard["params"]
    assert leaderboard["viz_type"] == "table"
    assert params["groupby"] == ["spu", "spu_rating", "actual_rating"]
    assert params["metrics"] == [
        "previous_month_sales_amount_usd",
        "current_month_sales_amount_usd",
        "rating_progress",
        "time_progress",
    ]
    assert params["server_page_length"] == 50
    assert params["server_pagination"] is True
    assert params["show_totals"] is False
    assert params["include_search"] is False
    assert [json.loads(item) for item in params["order_by_cols"]] == [
        ["current_month_sales_amount_usd", False],
        ["spu", True],
        ["actual_rating", True],
    ]
    assert params["conditional_formatting"] == [
        {
            "column": "rating_progress",
            "operator": "≤ x <",
            "targetValueLeft": 0,
            "targetValueRight": 0.2,
            "colorScheme": "#FF0000",
            "useGradient": False,
        },
        {
            "column": "rating_progress",
            "operator": "≤ x <",
            "targetValueLeft": 0.2,
            "targetValueRight": 0.4,
            "colorScheme": "#EB8A3A",
            "useGradient": False,
        },
        {
            "column": "rating_progress",
            "operator": "≤ x <",
            "targetValueLeft": 0.4,
            "targetValueRight": 0.6,
            "colorScheme": "#FFC947",
            "useGradient": False,
        },
        {
            "column": "rating_progress",
            "operator": "≤ x <",
            "targetValueLeft": 0.6,
            "targetValueRight": 0.8,
            "colorScheme": "#00FF00",
            "useGradient": False,
        },
        {
            "column": "rating_progress",
            "operator": "≥",
            "targetValue": 0.8,
            "colorScheme": "#0078FF",
            "useGradient": False,
        },
    ]
    assert (
        params["column_config"]["previous_month_sales_amount_usd"]["d3NumberFormat"]
        == "$,.1~f"
    )
    assert (
        params["column_config"]["current_month_sales_amount_usd"]["d3NumberFormat"]
        == "$,.1~f"
    )
    assert params["column_config"]["rating_progress"]["d3NumberFormat"] == ".1~%"
    assert params["column_config"]["time_progress"]["d3NumberFormat"] == ".1~%"
    assert all(
        rule.get("targetValue", 0) >= 0
        and rule.get("targetValueLeft", 0) >= 0
        and rule.get("targetValueRight", 0) >= 0
        for rule in params["conditional_formatting"]
    )


def test_leaderboard_columns_fit_all_business_headers_in_the_primary_grid(
    tmp_path: Path,
) -> None:
    """The seven FineBI leaderboard columns fit the narrow right-hand panel."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    leaderboard = charts["SPU销量排行榜"]
    config = leaderboard["params"]["column_config"]
    expected_widths = {
        "spu": 64,
        "spu_rating": 80,
        "actual_rating": 80,
        "previous_month_sales_amount_usd": 112,
        "current_month_sales_amount_usd": 112,
        "rating_progress": 104,
        "time_progress": 104,
    }
    assert {name: config[name]["columnWidth"] for name in expected_widths} == (
        expected_widths
    )
    assert sum(expected_widths.values()) == 656
    assert leaderboard["params"]["groupby"] + leaderboard["params"]["metrics"] == list(
        expected_widths
    )

    dataset = assets_by_key(assets, "datasets", "table_name")["爆品指数-SPU销量排行榜"]
    labels = {
        column["column_name"]: column["verbose_name"]
        for column in dataset["columns"]
        if column["column_name"] in expected_widths
    }
    assert labels == {
        "spu": "SPU",
        "spu_rating": "计算评级",
        "actual_rating": "实际评级",
        "previous_month_sales_amount_usd": "上月销售额",
        "current_month_sales_amount_usd": "本月销量额",
        "rating_progress": "本月评级达标进度",
        "time_progress": "本月时间达标进度",
    }


def test_remaining_visible_numeric_fields_use_approved_formats(tmp_path: Path) -> None:
    """Every new chart's visible number format stays within the one-decimal contract."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    allowed_formats = {",.0f", ",.1~f", "$,.1~f", ".1~%"}

    for name in (
        "指标整体趋势-天",
        "指标整体趋势-周",
        "指标整体趋势-月",
    ):
        params = charts[name]["params"]
        assert params["y_axis_format"] in allowed_formats
        assert params["y_axis_format_secondary"] in allowed_formats

    for name in ("SPU销售比例", "SKU销售比例", "颜色销量分布"):
        assert charts[name]["params"]["number_format"] in allowed_formats

    for name in ("颜色销售比例-周", "颜色销售比例-月"):
        assert charts[name]["params"]["y_axis_format"] in allowed_formats

    leaderboard_config = charts["SPU销量排行榜"]["params"]["column_config"]
    assert {
        config["d3NumberFormat"]
        for config in leaderboard_config.values()
        if "d3NumberFormat" in config
    } <= allowed_formats

    leaderboard = assets_by_key(assets, "datasets", "table_name")[
        "爆品指数-SPU销量排行榜"
    ]
    assert {metric["d3format"] for metric in leaderboard["metrics"]} <= allowed_formats

    datasets = assets_by_key(assets, "datasets", "table_name")
    for name in REMAINING_DETAIL_SPECS:
        config = charts[name]["params"]["column_config"]
        assert {
            item["d3NumberFormat"]
            for item in config.values()
            if "d3NumberFormat" in item
        } <= allowed_formats
        assert {
            metric["d3format"]
            for metric in datasets[REMAINING_DETAIL_SPECS[name]["dataset_name"]][
                "metrics"
            ]
        } <= allowed_formats


def test_new_dataset_columns_have_chinese_verbose_names(tmp_path: Path) -> None:
    """New datasets expose business labels rather than physical column names."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    for dataset in datasets.values():
        for column in dataset["columns"]:
            label = column["verbose_name"]
            assert label
            assert label != column["column_name"]
            assert any("\u4e00" <= char <= "\u9fff" for char in label) or label in {
                "SPU",
                "SKU",
            }


def test_guide_describes_new_contracts_without_excluded_tabs_or_physical_fields(
    tmp_path: Path,
) -> None:
    """The guide stays business-facing while documenting each approved chart family."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    template = charts["爆品指数说明"]["params"]["handlebarsTemplate"]

    for phrase in (
        "11 项指标",
        "ISO 周",
        "水位月 MTD",
        "上一完整月",
        "美元销售额",
        "评级达标进度",
        "SPU 和 SKU 环图",
        "国家",
        "SPU开发经理",
        "型号",
        "汇总",
        "颜色代码",
        "最后一个连字符",
    ):
        assert phrase in template
    assert "渠道" in template
    assert any(phrase in template for phrase in ("未启用", "不启用", "不展示"))
    assert "product_level" not in template


def test_remaining_detail_dataset_and_chart_contracts(tmp_path: Path) -> None:
    """The three approved dimension tabs expose only their business fields."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    charts = assets_by_key(assets, "charts", "slice_name")
    forbidden = {"hot_product_index", "score", "in_sale_sku_count"}

    for chart_name, spec in REMAINING_DETAIL_SPECS.items():
        dataset = datasets[spec["dataset_name"]]
        chart = charts[chart_name]
        dimensions = list(spec["dimensions"])
        expected_columns = [*dimensions, *REMAINING_DETAIL_METRICS]
        columns = {column["column_name"]: column for column in dataset["columns"]}

        assert dataset["uuid"] == spec["dataset_uuid"]
        assert dataset["main_dttm_col"] == "month_start_date"
        assert chart["uuid"] == spec["chart_uuid"]
        assert chart["dataset_uuid"] == dataset["uuid"]
        assert chart["viz_type"] == "table"
        assert chart["params"]["groupby"] == dimensions
        assert chart["params"]["metrics"] == list(REMAINING_DETAIL_METRICS)
        assert set(expected_columns) <= columns.keys()
        assert not forbidden & columns.keys()
        assert not (forbidden | {"channel"}) & set(chart["params"]["groupby"])
        assert not (forbidden | {"channel"}) & set(chart["params"]["metrics"])

        for column_name in expected_columns:
            label = columns[column_name]["verbose_name"]
            assert label
            assert label != column_name
            assert any("\u4e00" <= char <= "\u9fff" for char in label) or label in {
                "SPU",
                "SKU",
            }


def test_remaining_detail_tables_emit_an_explicit_bottom_summary_row(
    tmp_path: Path,
) -> None:
    """Dimension tables own a deterministic summary row instead of native totals."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    charts = assets_by_key(assets, "charts", "slice_name")

    for chart_name, spec in REMAINING_DETAIL_SPECS.items():
        sql = datasets[spec["dataset_name"]]["sql"]
        params = charts[chart_name]["params"]
        lowered = sql.lower()
        assert "union all" in lowered
        assert re.search(r"汇总|summary|is_total|row_type", sql, flags=re.IGNORECASE)
        assert params["groupby"] == list(spec["dimensions"])
        assert not {"row_type", "is_total", "sort_order"} & set(params["groupby"])
        assert not {"row_type", "is_total", "sort_order"} & set(
            params.get("column_config", {})
        )


def test_remaining_detail_tables_disable_server_pagination_and_builtin_totals(
    tmp_path: Path,
) -> None:
    """Dimension tables return one query and own their summary row."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")

    for chart_name in REMAINING_DETAIL_SPECS:
        params = charts[chart_name]["params"]
        context = json.loads(charts[chart_name]["query_context"])
        assert params.get("server_pagination", False) is False
        assert params.get("server_page_length") == 0
        assert params.get("show_totals", False) is False
        assert len(context["queries"]) == 1
        query = context["queries"][0]
        assert "is_rowcount" not in query
        assert query.get("row_limit", 0) > 0
        assert all("is_rowcount" not in item for item in context["queries"])


def test_remaining_detail_query_context_hides_row_sort_and_keeps_summary_last(
    tmp_path: Path,
) -> None:
    """Doris receives aggregate metrics while the synthetic sort key stays hidden."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    charts = assets_by_key(assets, "charts", "slice_name")

    for chart_name, spec in REMAINING_DETAIL_SPECS.items():
        dataset = datasets[spec["dataset_name"]]
        params = charts[chart_name]["params"]
        context = json.loads(charts[chart_name]["query_context"])
        query = context["queries"][0]
        sql = dataset["sql"]
        dimensions = list(spec["dimensions"])

        assert params["query_mode"] == "aggregate"
        assert context["form_data"]["query_mode"] == "aggregate"
        assert params["groupby"] == dimensions
        assert params["metrics"] == list(REMAINING_DETAIL_METRICS)
        assert params["hidden_metrics"] == ["row_sort"]
        assert "percent_metrics" not in params
        assert params["timeseries_limit_metric"] == "row_sort"
        assert params["order_desc"] is False
        assert context["form_data"]["metrics"] == list(REMAINING_DETAIL_METRICS)
        assert "row_sort" not in context["form_data"]["metrics"]
        assert context["form_data"]["timeseries_limit_metric"] == "row_sort"
        assert query["columns"] == dimensions
        assert query["metrics"] == [*REMAINING_DETAIL_METRICS, "row_sort"]
        assert len(query["metrics"]) == 13
        assert query["post_processing"] == [
            {"operation": "select", "options": {"exclude": ["row_sort"]}}
        ]
        dataset_metrics = {
            metric["metric_name"]: metric for metric in dataset["metrics"]
        }
        assert dataset_metrics["row_sort"]["expression"] == "MAX(row_sort)"

        visible_fields = (
            set(params.get("all_columns", []))
            | set(params.get("groupby", []))
            | set(params.get("metrics", []))
            | set(params.get("column_config", {}))
            | set(context["form_data"].get("all_columns", []))
            | set(context["form_data"].get("metrics", []))
            | set(query.get("columns", []))
        )
        assert "row_sort" not in visible_fields

        expected_sort = [
            ["row_sort", True],
            ["sales_amount_usd", False],
            *[[dimension, True] for dimension in dimensions],
        ]
        assert params["order_by_cols"] == []
        assert [
            json.loads(item) for item in params["query_order_by_cols"]
        ] == expected_sort
        assert query["orderby"] == expected_sort
        assert sql.count("0 AS row_sort") == 1
        assert sql.count("1 AS row_sort") == 1
        assert re.search(
            r"SELECT\s+\*\s+FROM\s+detail_rows\s+UNION\s+ALL\s+"
            r"SELECT\s+\*\s+FROM\s+summary_rows",
            sql,
            flags=re.IGNORECASE,
        )
        detail_rows = cte_section(sql, "detail_rows", "summary_rows")
        for dimension in dimensions:
            if dimension == "developer":
                assert re.search(
                    r"COALESCE\(\s*f\.developer\s*,\s*'-'\s*\)\s+AS\s+developer\b",
                    detail_rows,
                    flags=re.IGNORECASE,
                )
            else:
                assert re.search(
                    rf"\bf\.{dimension}\s+AS\s+{dimension}\b",
                    detail_rows,
                    flags=re.IGNORECASE,
                )


def test_remaining_detail_stock_uses_effective_end_ym_snapshot(
    tmp_path: Path,
) -> None:
    """Stock is read from the effective end month, not each selected month."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")

    for spec in REMAINING_DETAIL_SPECS.values():
        sql = datasets[spec["dataset_name"]]["sql"]
        assert "effective_end_ym" in sql
        assert re.search(
            r"\b\w+\.ym\s*(?:=|<=>)\s*[^\n;]*effective_end_ym",
            sql,
            flags=re.IGNORECASE,
        )
        assert re.search(r"is_eligible\s*=\s*1", sql, flags=re.IGNORECASE)


def test_remaining_detail_stock_deduplicates_dimension_and_sku_rows(
    tmp_path: Path,
) -> None:
    """A SKU contributes stock once within each displayed dimension."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")

    for spec in REMAINING_DETAIL_SPECS.values():
        sql = datasets[spec["dataset_name"]]["sql"]
        dimensions = list(spec["dimensions"])
        dimension_sku = cte_section(sql, "stock_dimension_sku", "stock_by_dimension")
        assert not re.search(r"SELECT\s+DISTINCT\b", dimension_sku, flags=re.IGNORECASE)
        assert re.search(
            r"SELECT[^;]*\bsku\b",
            dimension_sku,
            flags=re.IGNORECASE | re.DOTALL,
        )
        assert re.search(
            r"GROUP\s+BY[^;]*\b(?:\w+\.)?sku\b",
            dimension_sku,
            flags=re.IGNORECASE | re.DOTALL,
        )
        assert re.search(
            r"GROUP\s+BY[^;]*\b(?:" + "|".join(dimensions) + r")\b",
            dimension_sku,
            flags=re.IGNORECASE | re.DOTALL,
        )


def test_remaining_detail_summary_deduplicates_global_sku_stock_totals(
    tmp_path: Path,
) -> None:
    """The bottom total aggregates stock once per SKU across dimensions."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")

    for spec in REMAINING_DETAIL_SPECS.values():
        sql = datasets[spec["dataset_name"]]["sql"]
        dimension_sku = cte_section(sql, "stock_dimension_sku", "stock_by_dimension")
        assert not re.search(r"SELECT\s+DISTINCT\b", dimension_sku, flags=re.IGNORECASE)
        assert re.search(
            r"GROUP\s+BY[^;]*\b(?:\w+\.)?sku\b",
            dimension_sku,
            flags=re.IGNORECASE | re.DOTALL,
        )
        assert re.search(
            r"GROUP\s+BY\s+(?:\w+\.)?sku\b", sql, flags=re.IGNORECASE | re.DOTALL
        )


def test_remaining_detail_developer_summary_types_only_first_dimension(
    tmp_path: Path,
) -> None:
    """The developer total labels both dimensions without leaking a NULL display."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    developer_sql = assets_by_key(assets, "datasets", "table_name")[
        "爆品指数-SPU开发经理经营明细"
    ]["sql"]

    for cte_name, next_cte_name in (
        ("flow_by_dimension", "flow_summary"),
        ("rolling_by_dimension", "rolling_summary"),
    ):
        section = cte_section(developer_sql, cte_name, next_cte_name)
        assert re.search(r"GROUP\s+BY\s+developer\s*,\s*spu\b", section)
        assert not re.search(r"COALESCE\([^)]*developer", section)

    for cte_name, next_cte_name in (
        ("flow_summary", "rolling_by_dimension"),
        ("rolling_summary", "stock_rows"),
        ("summary_rows", "SELECT * FROM summary_rows"),
    ):
        if cte_name == "summary_rows":
            section = developer_sql[developer_sql.index("summary_rows AS (") :]
        else:
            section = cte_section(developer_sql, cte_name, next_cte_name)
        assert len(re.findall(r"'汇总'\s+AS", section)) == 1
        assert re.search(r"'汇总'\s+AS\s+developer\b", section)
        assert re.search(r"'-'\s+AS\s+spu\b", section)
        assert not re.search(r"CAST\(\s*NULL\s+AS\s+VARCHAR", section)
        assert not re.search(r"'汇总'\s+AS\s+spu\b", section)


def test_remaining_detail_stock_serving_gate_requires_complete_unique_pairs(
    tmp_path: Path,
) -> None:
    """Serving SQL rejects missing or conflicting stock rather than dropping rows."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")

    for spec in REMAINING_DETAIL_SPECS.values():
        sql = datasets[spec["dataset_name"]]["sql"]
        stock_rows = cte_section(sql, "stock_rows", "stock_pair_quality")
        pair_quality = cte_section(
            sql, "stock_pair_quality", "stock_pair_gate", "stock_quality"
        )
        pair_gate = (
            cte_section(sql, "stock_pair_gate", "stock_quality")
            if "stock_pair_gate AS (" in sql
            else pair_quality
        )
        quality = cte_section(sql, "stock_quality", "stock_by_sku")
        stock_by_sku = cte_section(sql, "stock_by_sku", "stock_dimension_sku")

        for column in ("sku", "theoretical_stock_qty", "actual_stock_qty"):
            assert re.search(
                rf"\b\w+\.{column}\b",
                stock_rows,
                flags=re.IGNORECASE,
            )
            assert not re.search(
                rf"\b\w+\.{column}\s+IS\s+NOT\s+NULL\b",
                stock_rows,
                flags=re.IGNORECASE,
            )
        assert re.search(
            r"COUNT\s*\(\s*DISTINCT\s+CONCAT\s*\(",
            pair_quality,
            flags=re.IGNORECASE,
        )
        assert re.search(
            r"GROUP\s+BY\s+(?:\w+\.)?sku\b", pair_quality, flags=re.IGNORECASE
        )
        for column in ("sku", "theoretical_stock_qty", "actual_stock_qty"):
            assert re.search(
                rf"\b\w+\.{column}\s+IS\s+NOT\s+NULL\b",
                pair_quality,
                flags=re.IGNORECASE,
            )
        gate_sql = f"{pair_gate}\n{quality}"
        assert re.search(r"COUNT\s*\(\s*\*\s*\)\s*>\s*0", gate_sql)
        assert re.search(
            r"(?:MAX|MIN)\s*\(\s*stock_pair_count\s*\)\s*=\s*1",
            gate_sql,
        )
        for column in ("sku", "theoretical_stock_qty", "actual_stock_qty"):
            assert re.search(
                rf"\b\w+\.{column}\s+IS\s+NULL\b",
                quality,
                flags=re.IGNORECASE,
            )
        assert re.search(r"SUM\s*\(\s*CASE", quality, flags=re.IGNORECASE)
        assert re.search(r"\)\s*=\s*0", quality)
        assert re.search(r"pair_consistent\s*=\s*1", quality, flags=re.IGNORECASE)

        assert re.search(
            r"CROSS\s+JOIN\s+stock_quality\s+q", stock_by_sku, flags=re.IGNORECASE
        )
        assert re.search(
            r"WHERE\s+q\.stock_consistent\s*=\s*1",
            stock_by_sku,
            flags=re.IGNORECASE,
        )
        assert sql.lower().count("q.stock_consistent = 1") >= 3
        assert not re.search(
            r"MAX\s*\(\s*(?:theoretical_stock_qty|actual_stock_qty)\s*\)",
            sql,
            flags=re.IGNORECASE,
        )
        assert "MIN(theoretical_stock_qty)" in stock_by_sku
        assert "MIN(actual_stock_qty)" in stock_by_sku


def test_remaining_detail_cross_country_fixture_keeps_global_sku_stock_once(
    tmp_path: Path,
) -> None:
    """A SKU present in two countries must not double-count the summary stock."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    country_sql = assets_by_key(assets, "datasets", "table_name")[
        "爆品指数-国家经营明细"
    ]["sql"]
    fixture = (("US", "SKU-1"), ("CN", "SKU-1"), ("US", "SKU-2"))
    assert len({sku for _, sku in fixture}) == 2
    assert "country" in country_sql
    dimension_sku = cte_section(
        country_sql, "stock_dimension_sku", "stock_by_dimension"
    )
    assert re.search(
        r"SELECT[^;]*\bcountry\b[^;]*\bsku\b",
        dimension_sku,
        flags=re.I | re.S,
    )
    assert not re.search(r"SELECT\s+DISTINCT\b", dimension_sku, flags=re.IGNORECASE)
    assert re.search(
        r"GROUP\s+BY[^;]*\bcountry\b[^;]*\bsku\b",
        dimension_sku,
        flags=re.I | re.S,
    )


def test_remaining_detail_metrics_recompute_ratios_and_rolling_averages(
    tmp_path: Path,
) -> None:
    """Ratios and rolling averages use source numerators and denominators."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    expected = {
        "gross_margin": "SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)",
        "return_rate": "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)",
    }

    for spec in REMAINING_DETAIL_SPECS.values():
        metrics = {
            metric["metric_name"]: metric
            for metric in datasets[spec["dataset_name"]]["metrics"]
        }
        for name, expression in expected.items():
            assert metrics[name]["expression"] == expression
        for name in ("avg_sales_qty_7d", "avg_sales_qty_30d", "avg_sales_qty_90d"):
            expression = metrics[name]["expression"]
            assert expression.startswith("SUM(")
            assert "/ NULLIF(" in expression
        assert "AVG(gross_margin)" not in datasets[spec["dataset_name"]]["sql"]
        assert "AVG(return_rate)" not in datasets[spec["dataset_name"]]["sql"]


def test_remaining_detail_native_filters_target_all_three_datasets_and_charts(
    tmp_path: Path,
) -> None:
    """Native filters reach each new dataset and its corresponding chart."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "在售产品爆品指数看板"
    ]
    filters = main["metadata"]["native_filter_configuration"]
    by_name = {item["name"]: item for item in filters}
    filter_names = {"国家维度": "国家", "SPU开发经理": "开发经理", "型号维度": "型号"}
    category_filter = by_name["品类"]

    for name, spec in REMAINING_DETAIL_SPECS.items():
        dataset_uuid = spec["dataset_uuid"]
        chart_uuid = spec["chart_uuid"]
        assert chart_uuid in by_name["年月"]["chartsInScope"]
        assert dataset_uuid in {
            target["datasetUuid"] for target in by_name["年月"]["targets"]
        }
        filter_item = by_name[filter_names[name]]
        assert chart_uuid in filter_item["chartsInScope"]
        assert dataset_uuid in {
            target["datasetUuid"] for target in filter_item["targets"]
        }
        assert chart_uuid in category_filter["chartsInScope"]
        assert dataset_uuid in {
            target["datasetUuid"] for target in category_filter["targets"]
        }


def test_remaining_query_contexts_load_chart_data_schema_and_remap_datasource(
    tmp_path: Path,
) -> None:
    """Every new context survives schema loading and dashboard import remapping."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    new_chart_names = (
        "指标整体趋势-天",
        "指标整体趋势-周",
        "指标整体趋势-月",
        "SPU销售比例",
        "SKU销售比例",
        "SPU销量排行榜",
        "颜色销售比例-周",
        "颜色销售比例-月",
        "颜色销量分布",
        "国家维度",
        "SPU开发经理",
        "型号维度",
    )

    from tests.integration_tests.test_app import app

    with app.app_context():
        from superset.charts.schemas import ChartDataQueryContextSchema
        from superset.commands.utils import update_chart_config_dataset

        class CapturingQueryContextFactory:
            def __init__(self) -> None:
                self.payloads: list[dict[str, Any]] = []

            def create(self, **kwargs: Any) -> dict[str, Any]:
                self.payloads.append(kwargs)
                return kwargs

        for chart_name in new_chart_names:
            chart = charts[chart_name]
            context = json.loads(chart["query_context"])
            assert context["datasource"] == {"id": 0, "type": "table"}
            assert context["form_data"]["datasource"] == "0__table"

            factory = CapturingQueryContextFactory()
            schema = ChartDataQueryContextSchema()
            schema.query_context_factory = cast(Any, factory)
            loaded = schema.load(context)
            assert loaded == factory.payloads[0]
            assert loaded["datasource"] == {"id": 0, "type": "table"}
            assert loaded["form_data"]["datasource"] == "0__table"
            assert loaded["queries"]
            for query in loaded["queries"]:
                assert {
                    "columns",
                    "metrics",
                    "post_processing",
                    "row_limit",
                    "row_offset",
                } <= query.keys()
                assert "datasource" not in query

            remapped = update_chart_config_dataset(
                deepcopy(chart),
                {
                    "datasource_id": 731,
                    "datasource_type": "table",
                    "datasource_name": "爆品指数-日明细",
                },
            )
            remapped_context = json.loads(remapped["query_context"])
            assert remapped["params"]["datasource"] == "731__table"
            assert remapped_context["datasource"] == {"id": 731, "type": "table"}
            assert remapped_context["form_data"]["datasource"] == "731__table"
            assert all(
                "datasource" not in query for query in remapped_context["queries"]
            )


def test_leaderboard_query_context_preserves_three_server_pagination_queries(
    tmp_path: Path,
) -> None:
    """The stock table context keeps page, row-count, and totals requests distinct."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    leaderboard = assets_by_key(assets, "charts", "slice_name")["SPU销量排行榜"]
    params = leaderboard["params"]
    queries = json.loads(leaderboard["query_context"])["queries"]

    assert len(queries) == 3
    page, row_count, totals = queries
    assert page["columns"] == params["groupby"]
    assert page["metrics"] == params["metrics"]
    assert page["row_limit"] == 50
    assert page["row_offset"] == 0
    assert page["orderby"] == [json.loads(item) for item in params["order_by_cols"]]
    assert page["time_range"] == "No filter"

    assert row_count["is_rowcount"] is True
    assert row_count["row_limit"] == 100000
    assert row_count["row_offset"] == 0
    assert row_count["columns"] == params["groupby"]
    assert row_count["metrics"] == params["metrics"]
    assert row_count["orderby"] == [
        json.loads(item) for item in params["order_by_cols"]
    ]

    assert totals["columns"] == []
    assert totals["metrics"] == params["metrics"]
    assert totals["row_limit"] == 0
    assert totals["row_offset"] == 0
    assert "orderby" not in totals
    assert "order_desc" not in totals
    assert all("datasource" not in query for query in queries)
