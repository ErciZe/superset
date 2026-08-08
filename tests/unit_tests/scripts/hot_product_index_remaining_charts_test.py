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
from pathlib import Path
from typing import Any
from zipfile import ZipFile

from scripts.hot_product_index_dashboard import (
    DAILY_SOURCE_COLUMNS,
    FILTERS,
    MONTHLY_SOURCE_COLUMNS,
    write_bundle,
)


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
    assert columns["color_code"]["verbose_name"] == "颜色代码"
    assert columns["color_code"]["type"] == "STRING"
    assert "DATE_SUB(d.sales_date, INTERVAL WEEKDAY(d.sales_date) DAY)" in daily[
        "sql"
    ]
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
    assert "GROUP BY m.spu, m.spu_previous_month_sales_level, m.sku_level" in sql
    assert "watermark_time_progress" not in sql
    assert (
        "NULLIF(DAY(q.data_through_date) / DAY(LAST_DAY(q.data_through_date)), 0)"
        in sql
    )

    columns = {column["column_name"]: column for column in leaderboard["columns"]}
    assert {
        columns[name]["verbose_name"]
        for name in (
            "spu",
            "spu_rating",
            "final_rating",
            "previous_month_sales_amount_usd",
            "current_month_sales_amount_usd",
            "rating_progress",
            "time_progress",
        )
    } == {
        "SPU",
        "SPU评级",
        "最终评级",
        "上月销售额",
        "本月销量额",
        "本月评级达标进度",
        "本月时间达标进度",
    }


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
        "AS within_limit"
        in cardinality_result_set
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

    selected = {
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
    for name, x_axis in {
        "指标整体趋势-天": "sales_date",
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
        assert json.loads(params["echart_options"]) == {
            "legend": {"selected": selected}
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
        ("SKU销售比例", "sku", "scroll"),
        ("颜色销量分布", "color_code", "plain"),
    ):
        chart = charts[name]
        params = chart["params"]
        assert chart["viz_type"] == "pie"
        assert params["groupby"] == [groupby]
        assert params["legendType"] == legend_type
        assert params["row_limit"] == 1000
        assert params["threshold_for_other"] == 0
        assert params["sort_by_metric"] is True
        assert params["donut"] is True
        assert params["show_total"] is True
        assert params["total_label"] == "总销量"
        assert params["label_type"] == "key_percent"
        assert params["number_format"] == ",.0f"

        query = json.loads(chart["query_context"])["queries"]
        assert len(query) == 1
        assert query[0]["columns"] == [groupby]
        assert query[0]["metrics"] == ["sales_qty_total"]
        assert query[0]["orderby"] == [["sales_qty_total", False]]
        assert query[0]["post_processing"] == [
            {
                "operation": "contribution",
                "options": {
                    "columns": ["sales_qty_total"],
                    "rename_columns": ["sales_qty_total__contribution"],
                },
            }
        ]

    for name, x_axis in (("颜色销售比例-周", "yw"), ("颜色销售比例-月", "ym")):
        chart = charts[name]
        params = chart["params"]
        assert chart["viz_type"] == "echarts_timeseries_line"
        assert params["x_axis"] == x_axis
        assert params["groupby"] == ["color_code"]
        assert params["metrics"] == ["sales_qty_total"]
        assert params["show_value"] is True
        assert params["y_axis_format"] == ",.0f"
        assert params["series_limit"] == 1000
        assert params["row_limit"] == 100000
        query = json.loads(chart["query_context"])["queries"][0]
        assert query["columns"] == [x_axis, "color_code"]
        assert query["series_columns"] == ["color_code"]
        assert query["metrics"] == ["sales_qty_total"]
        assert [item["operation"] for item in query["post_processing"]] == [
            "pivot",
            "rename",
            "flatten",
        ]
        assert not any(
            item["operation"] == "resample" for item in query["post_processing"]
        )


def test_remaining_leaderboard_contract_and_conditional_formatting(
    tmp_path: Path,
) -> None:
    """The leaderboard exposes a stable, paged, non-negative color contract."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    leaderboard = assets_by_key(assets, "charts", "slice_name")["SPU销量排行榜"]
    params = leaderboard["params"]
    assert leaderboard["viz_type"] == "ag-grid-table-scheme"
    assert params["displayed_columns"] == [
        "spu",
        "spu_rating",
        "final_rating",
        "previous_month_sales_amount_usd",
        "current_month_sales_amount_usd",
        "rating_progress",
        "time_progress",
    ]
    assert params["server_page_length"] == 50
    assert params["server_pagination"] is True
    assert params["show_totals"] is False
    assert params["advanced_filter_enabled"] is False
    assert params["column_view_schemes_enabled"] is False
    assert params["include_search"] is False
    assert params["orderby"] == [
        ["current_month_sales_amount_usd", False],
        ["spu", True],
        ["final_rating", True],
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
    assert params["column_config"]["previous_month_sales_amount_usd"][
        "d3NumberFormat"
    ] == "$,.1~f"
    assert params["column_config"]["current_month_sales_amount_usd"][
        "d3NumberFormat"
    ] == "$,.1~f"
    assert params["column_config"]["rating_progress"]["d3NumberFormat"] == ".1~%"
    assert params["column_config"]["time_progress"]["d3NumberFormat"] == ".1~%"
    assert all(
        rule.get("targetValue", 0) >= 0
        and rule.get("targetValueLeft", 0) >= 0
        and rule.get("targetValueRight", 0) >= 0
        for rule in params["conditional_formatting"]
    )
