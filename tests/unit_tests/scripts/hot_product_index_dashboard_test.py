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
from pathlib import Path
from typing import Any
from uuid import UUID
from zipfile import ZipFile

import pytest

from scripts.hot_product_index_dashboard import (
    DEFAULT_DATABASE_UUID,
    validate_assets,
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


def test_write_bundle_produces_complete_deterministic_assets(tmp_path: Path) -> None:
    """A repeat build must be byte-identical and contain every import dependency."""
    first = tmp_path / "first.zip"
    second = tmp_path / "second.zip"

    assert write_bundle(first) == first
    write_bundle(second)

    assert first.read_bytes() == second.read_bytes()
    assets = read_bundle(first)
    assert assets["metadata.yaml"] == {"type": "assets", "version": "1.0.0"}
    assert not any(path.startswith("databases/") for path in assets)
    assert sum(path.startswith("datasets/") for path in assets) == 5
    assert sum(path.startswith("charts/") for path in assets) == 15
    assert sum(path.startswith("dashboards/") for path in assets) == 2

    datasets = assets_by_key(assets, "datasets", "table_name")
    charts = assets_by_key(assets, "charts", "slice_name")
    dashboards = assets_by_key(assets, "dashboards", "dashboard_title")
    assert set(datasets) == {
        "爆品指数-日明细",
        "爆品指数-月末在售",
        "爆品指数-数据状态",
        "爆品指数-SPU月度经营明细",
        "爆品指数-SKU月度经营明细",
    }
    assert set(dashboards) == {
        "拉杆箱在售产品爆品指数看板",
        "爆品指数说明文档",
    }

    uuids = [
        asset["uuid"]
        for asset in [*datasets.values(), *charts.values(), *dashboards.values()]
    ]
    assert len(uuids) == len(set(uuids)) == 22
    assert all(str(UUID(value)) == value for value in uuids)
    assert datasets["爆品指数-日明细"]["uuid"] == (
        "ea2025d6-91ac-502f-9238-9f21ca62b761"
    )
    assert all(
        dataset["database_uuid"] == DEFAULT_DATABASE_UUID
        for dataset in datasets.values()
    )
    for dataset in datasets.values():
        assert all(column["verbose_name"] for column in dataset["columns"])
        assert all(
            column["verbose_name"] != column["column_name"]
            for column in dataset["columns"]
        )
    daily_column_labels = {
        column["column_name"]: column["verbose_name"]
        for column in datasets["爆品指数-日明细"]["columns"]
    }
    assert daily_column_labels["channel"] == "渠道"
    assert daily_column_labels["product_level"] == "产品等级"
    assert daily_column_labels["spu_previous_month_sales_level"] == ("SPU上月销售等级")
    assert {chart["dataset_uuid"] for chart in charts.values()} <= {
        dataset["uuid"] for dataset in datasets.values()
    }
    for chart in charts.values():
        query_context = json.loads(chart["query_context"])
        assert query_context["datasource"] == {"id": 0, "type": "table"}
        assert query_context["form_data"]["datasource"] == "0__table"
        assert query_context["queries"]
        assert "datasource" not in query_context["queries"][0]
        if chart["viz_type"] in {"big_number_total", "funnel"}:
            assert query_context["queries"][0]["metrics"] == [chart["params"]["metric"]]
        elif chart["viz_type"] == "handlebars":
            assert (
                query_context["queries"][0]["columns"] == chart["params"]["all_columns"]
            )
        else:
            assert chart["viz_type"] == "ag-grid-table-scheme"
            assert query_context["queries"][0]["columns"] == chart["params"]["groupby"]
            assert query_context["queries"][0]["metrics"] == chart["params"]["metrics"]
        assert query_context["result_format"] == "json"
        assert query_context["result_type"] == "full"


def test_detail_datasets_expose_approved_leaf_fields_and_metrics(
    tmp_path: Path,
) -> None:
    """Detail datasets expose only the approved Chinese leaf-table fields."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")

    detail_datasets = {
        name: datasets[name]
        for name in (
            "爆品指数-SPU月度经营明细",
            "爆品指数-SKU月度经营明细",
        )
    }
    assert set(detail_datasets) == {
        "爆品指数-SPU月度经营明细",
        "爆品指数-SKU月度经营明细",
    }
    spu_labels = {
        column["column_name"]: column["verbose_name"]
        for column in detail_datasets["爆品指数-SPU月度经营明细"]["columns"]
        if column["column_name"]
        in {
            "spu",
            "ym",
            "spu_previous_month_sales_level",
            "sku_level",
            "hot_product_index",
            "score",
            "sales_amount_usd",
            "sales_qty",
            "avg_daily_sales_qty",
            "gross_profit_usd",
            "gross_margin",
            "return_goods_qty",
            "return_rate",
            "order_qty",
            "avg_sales_qty_7d",
            "avg_sales_qty_30d",
            "avg_sales_qty_90d",
        }
    }
    assert spu_labels == {
        "spu": "SPU",
        "ym": "年月",
        "spu_previous_month_sales_level": "SPU评级",
        "sku_level": "最终评级",
        "hot_product_index": "爆品指数",
        "score": "评分",
        "sales_amount_usd": "销售额",
        "sales_qty": "销量",
        "avg_daily_sales_qty": "日均销量",
        "gross_profit_usd": "毛利润",
        "gross_margin": "毛利率",
        "return_goods_qty": "退货量",
        "return_rate": "退货率",
        "order_qty": "订单量",
        "avg_sales_qty_7d": "近7天日均销量",
        "avg_sales_qty_30d": "近30天日均销量",
        "avg_sales_qty_90d": "近90天日均销量",
    }
    sku_labels = {
        column["column_name"]: column["verbose_name"]
        for column in detail_datasets["爆品指数-SKU月度经营明细"]["columns"]
        if column["column_name"]
        in {
            "company_sku",
            "sku",
            "ym",
            "product_level",
            "size",
            "color",
            "hot_product_index",
            "score",
            "sales_amount_usd",
            "sales_qty",
            "avg_daily_sales_qty",
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
        }
    }
    assert sku_labels == {
        "company_sku": "公司SKU",
        "sku": "SKU",
        "ym": "年月",
        "product_level": "产品等级",
        "size": "尺寸",
        "color": "颜色",
        "hot_product_index": "爆品指数",
        "score": "评分",
        "sales_amount_usd": "销售额",
        "sales_qty": "销量",
        "avg_daily_sales_qty": "日均销量",
        "gross_profit_usd": "毛利润",
        "gross_margin": "毛利率",
        "return_goods_qty": "退货量",
        "return_rate": "退货率",
        "order_qty": "订单量",
        "avg_sales_qty_7d": "近7天日均销量",
        "avg_sales_qty_30d": "近30天日均销量",
        "avg_sales_qty_90d": "近90天日均销量",
        "theoretical_stock_qty": "理论库存数",
        "actual_stock_qty": "实际库存数",
    }
    for dataset in detail_datasets.values():
        assert all(
            column["verbose_name"] != column["column_name"]
            for column in dataset["columns"]
        )
        assert dataset["main_dttm_col"] == "month_start_date"
        month_column = next(
            column
            for column in dataset["columns"]
            if column["column_name"] == "month_start_date"
        )
        assert month_column["type"] == "DATE"
        assert month_column["is_dttm"] is True
        assert month_column["verbose_name"] == "月份开始日期"
        metric_names = {metric["metric_name"] for metric in dataset["metrics"]}
        assert {
            "hot_product_index",
            "score",
            "sales_amount_usd",
            "sales_qty",
            "avg_daily_sales_qty",
            "gross_profit_usd",
            "gross_margin",
            "return_goods_qty",
            "return_rate",
            "order_qty",
            "avg_sales_qty_7d",
            "avg_sales_qty_30d",
            "avg_sales_qty_90d",
        } <= metric_names

        filter_columns = {
            "channel",
            "product_line",
            "spu",
            "country",
            "company_sku",
            "sku",
            "size",
            "color",
            "developer",
            "model",
            "sku_level",
            "product_level",
        }
        metadata_by_name = {
            column["column_name"]: column for column in dataset["columns"]
        }
        assert filter_columns <= metadata_by_name.keys()
        assert all(
            metadata_by_name[column]["verbose_name"]
            and metadata_by_name[column]["verbose_name"] != column
            for column in filter_columns
        )
        visible_filter_columns = {
            "spu",
            "ym",
            "spu_previous_month_sales_level",
            "sku_level",
        }
        if dataset["table_name"] == "爆品指数-SKU月度经营明细":
            visible_filter_columns = {
                "company_sku",
                "sku",
                "ym",
                "product_level",
                "size",
                "color",
            }
        assert all(
            metadata_by_name[column]["groupby"] is (column in visible_filter_columns)
            for column in filter_columns
        )


def test_detail_sql_has_exact_grains_filters_and_null_safe_metrics(
    tmp_path: Path,
) -> None:
    """Leaf SQL consumes filters before aggregation and avoids zero division."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    expected_filters = (
        "channel",
        "product_line",
        "spu",
        "country",
        "company_sku",
        "sku",
        "size",
        "color",
        "developer",
        "model",
        "sku_level",
        "product_level",
    )
    expected_fragments = (
        "get_time_filter(",
        "lookback_quality AS (",
        "COUNT(DISTINCT d.sales_date)",
        "expected_lookback_day_count",
        "DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)",
        "d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)",
        "d.sales_date < b.effective_end_exclusive_date",
        "p.sales_date >= b.selected_start_date",
        "p.sales_date < b.effective_end_exclusive_date",
        "WHERE b.coverage_complete = 1",
        "AND b.lookback_complete = 1",
        "AND d.is_eligible = 1",
        "COUNT(DISTINCT sales_date, sku)",
        "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)",
        "SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)",
        "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)",
        "MAX(theoretical_stock_qty)",
        "MAX(actual_stock_qty)",
        "AVG(score)",
        "SUM(order_qty)",
        "actual_stock_qty",
    )
    detail_specs = {
        "爆品指数-SPU月度经营明细": (
            "GROUP BY ym, spu, spu_previous_month_sales_level, sku_level",
        ),
        "爆品指数-SKU月度经营明细": (
            "GROUP BY ym, company_sku, sku, product_level, size, color",
        ),
    }
    for name, (grain_sql,) in detail_specs.items():
        sql = datasets[name]["sql"]
        assert 'default="Current month"' in sql
        assert 'target_type="DATE"' in sql
        assert "remove_filter=True" in sql
        assert all(fragment in sql for fragment in expected_fragments)
        assert all(
            f"get_filters('{column}', remove_filter=True)" in sql
            for column in expected_filters
        )
        assert grain_sql in sql
        assert "WHERE coverage_complete = 1" in sql
        assert "0 AS score" not in sql
        assert "0 AS order_qty" not in sql
        assert "0 AS actual_stock_qty" not in sql


def test_detail_charts_preserve_approved_fields_pagination_and_sorting(
    tmp_path: Path,
) -> None:
    """Detail charts use the approved groupings, visible field order and stable sort."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    spu = charts["SPU维度"]
    sku = charts["SKU维度"]

    assert spu["uuid"] == "4454d29b-3161-5d51-9e7b-7c1a9e96db06"
    assert sku["uuid"] == "76d38770-7b51-5f9e-b9df-d1b48113b8a3"
    assert spu["params"]["groupby"] == [
        "spu",
        "ym",
        "spu_previous_month_sales_level",
        "sku_level",
    ]
    assert spu["params"]["row_hierarchy_fields"] == spu["params"]["groupby"]
    assert sku["params"]["groupby"] == [
        "company_sku",
        "sku",
        "ym",
        "product_level",
        "size",
        "color",
    ]
    assert sku["params"]["row_hierarchy_fields"] == []

    assert spu["params"]["displayed_columns"] == [
        "spu",
        "ym",
        "spu_previous_month_sales_level",
        "sku_level",
        "hot_product_index",
        "score",
        "sales_amount_usd",
        "sales_qty",
        "avg_daily_sales_qty",
        "gross_profit_usd",
        "gross_margin",
        "return_goods_qty",
        "return_rate",
        "order_qty",
        "avg_sales_qty_7d",
        "avg_sales_qty_30d",
        "avg_sales_qty_90d",
    ]
    assert sku["params"]["displayed_columns"] == [
        "company_sku",
        "sku",
        "ym",
        "product_level",
        "size",
        "color",
        "hot_product_index",
        "score",
        "sales_amount_usd",
        "sales_qty",
        "avg_daily_sales_qty",
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
    ]

    for chart in (spu, sku):
        params = chart["params"]
        assert params["viz_type"] == "ag-grid-table-scheme"
        assert params["query_mode"] == "aggregate"
        assert params["server_pagination"] is True
        assert params["server_page_length"] == 50
        assert params["show_totals"] is True
        assert params["include_search"] is True
        assert params["allow_rearrange_columns"] is True
        assert params["emit_filter"] is False
        assert params["row_limit"] == 100000

    assert spu["params"]["orderby"] == [
        ["ym", False],
        ["sales_qty", False],
        ["spu", True],
    ]
    assert (
        spu["params"]["server_pagination_default_orderby"] == spu["params"]["orderby"]
    )
    assert sku["params"]["orderby"] == [
        ["ym", False],
        ["sales_qty", False],
        ["company_sku", True],
    ]
    assert (
        sku["params"]["server_pagination_default_orderby"] == sku["params"]["orderby"]
    )


def test_detail_charts_use_one_decimal_formats_and_fixed_index_boundaries(
    tmp_path: Path,
) -> None:
    """Detail table number formats and index colors stay deterministic."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    expected_rules = [
        {
            "column": "hot_product_index",
            "operator": "≤",
            "targetValue": 0,
            "colorScheme": "#DF7461",
            "useGradient": False,
        },
        {
            "column": "hot_product_index",
            "operator": "< x <",
            "targetValueLeft": 0,
            "targetValueRight": 5,
            "colorScheme": "#FFC947",
            "useGradient": False,
        },
        {
            "column": "hot_product_index",
            "operator": "≤ x <",
            "targetValueLeft": 5,
            "targetValueRight": 10,
            "colorScheme": "#B7D2B6",
            "useGradient": False,
        },
        {
            "column": "hot_product_index",
            "operator": "≥",
            "targetValue": 10,
            "colorScheme": "#2978B5",
            "useGradient": False,
        },
    ]
    for chart in (charts["SPU维度"], charts["SKU维度"]):
        config = chart["params"]["column_config"]
        assert config["hot_product_index"]["d3NumberFormat"] == ",.1~f"
        assert config["hot_product_index"]["nullValue"] == "-"
        assert config["gross_margin"]["d3NumberFormat"] == ".1~%"
        assert config["sales_amount_usd"]["currencyFormat"]["symbol"] == "USD"
        if chart["slice_name"] == "SPU维度":
            assert config["spu"]["pinned"] == "left"
        assert chart["params"]["conditional_formatting"] == expected_rules
        assert all(
            "NULL" not in str(rule)
            for rule in chart["params"]["conditional_formatting"]
        )


def test_detail_query_context_matches_table_server_query_order(
    tmp_path: Path,
) -> None:
    """Table query contexts contain base, row-count and totals queries only."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    for chart in (charts["SPU维度"], charts["SKU维度"]):
        params = chart["params"]
        context = json.loads(chart["query_context"])
        assert len(context["queries"]) == 3
        base, row_count, totals = context["queries"]
        assert context["datasource"] == {"id": 0, "type": "table"}
        assert context["form_data"]["datasource"] == "0__table"
        assert context["result_format"] == "json"
        assert context["result_type"] == "full"
        assert base["columns"] == params["groupby"]
        assert base["metrics"] == params["metrics"]
        assert base["row_limit"] == 50
        assert base["row_offset"] == 0
        assert base["orderby"] == params["orderby"]
        assert row_count["is_rowcount"] is True
        assert row_count["row_limit"] == params["row_limit"]
        assert row_count["row_offset"] == 0
        assert totals["columns"] == []
        assert totals["metrics"] == params["metrics"]
        assert totals["row_limit"] == 0
        assert totals["row_offset"] == 0
        assert "orderby" not in totals
        assert "order_desc" not in totals
        assert all("datasource" not in query for query in context["queries"])


def test_detail_sql_fails_closed_on_an_interior_lookback_date_gap(
    tmp_path: Path,
) -> None:
    """The 90-day gate is source-wide and runs before page filters."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    for dataset in (
        datasets["爆品指数-SPU月度经营明细"],
        datasets["爆品指数-SKU月度经营明细"],
    ):
        sql = dataset["sql"]
        lookback_start = sql.index("lookback_quality AS (")
        lookback_end = sql.index("daily_quality AS (")
        lookback_sql = sql[lookback_start:lookback_end]
        assert "get_filters(" not in lookback_sql
        assert "COUNT(DISTINCT d.sales_date)" in lookback_sql
        assert "DATEDIFF(" in lookback_sql
        assert "DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)" in (
            lookback_sql
        )
        assert sql.index("lookback_quality AS (") < sql.index("filtered_daily AS (")
        assert "lookback_complete" in sql
        assert "AND b.lookback_complete = 1" in sql
        assert "WHERE coverage_complete = 1\n  AND lookback_complete = 1" in sql


def test_detail_source_contract_fails_fast_when_required_ads_column_is_missing(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """A missing accepted ADS field stops generation instead of synthesizing a value."""
    from scripts import hot_product_index_dashboard as dashboard

    monkeypatch.setattr(
        dashboard,
        "DAILY_SOURCE_COLUMNS",
        tuple(
            column for column in dashboard.DAILY_SOURCE_COLUMNS if column[0] != "score"
        ),
    )
    with pytest.raises(
        ValueError,
        match="hot-product detail datasets require ADS columns: score",
    ):
        write_bundle(tmp_path / "assets.zip")


def test_virtual_datasets_fail_closed_on_incomplete_month_publication(
    tmp_path: Path,
) -> None:
    """Business rows must disappear unless daily and monthly targets cover the range."""
    bundle_path = write_bundle(tmp_path / "assets.zip")
    assets = read_bundle(bundle_path)
    datasets = assets_by_key(assets, "datasets", "table_name")
    daily = datasets["爆品指数-日明细"]
    monthly = datasets["爆品指数-月末在售"]
    status = datasets["爆品指数-数据状态"]

    assert daily["main_dttm_col"] == "sales_date"
    assert monthly["main_dttm_col"] == "month_start_date"
    for dataset in (daily, monthly):
        column_types = {
            column["column_name"]: column["type"] for column in dataset["columns"]
        }
        assert column_types["theoretical_stock_qty"] == "DECIMAL"
        assert column_types["eligibility_value"] == "DECIMAL"
        assert column_types["rating_complete"] == "TINYINT"
    status_columns = {column["column_name"] for column in status["columns"]}
    assert {
        "selected_start_ymd",
        "selected_end_ymd",
        "effective_end_ymd",
        "global_data_through_ymd",
        "daily_missing_rating_count",
        "monthly_missing_rating_count",
        "coverage_complete",
        "rating_complete",
        "rating_status_message",
    } <= status_columns
    for dataset in datasets.values():
        sql = dataset["sql"]
        assert "get_time_filter(" in sql
        assert 'default="Current month"' in sql
        assert 'target_type="DATE"' in sql
        assert "remove_filter=True" in sql
        assert "selected_end_exclusive_date" in sql
        assert "TIMESTAMPDIFF(MONTH" in sql
        assert "daily_quality AS (" in sql
        assert "monthly_quality AS (" in sql
        assert "COUNT(DISTINCT d.ym)" in sql
        assert "COUNT(DISTINCT m.ym)" in sql
        assert "daily_month_count = expected_month_count" in sql
        assert "monthly_month_count = expected_month_count" in sql
        assert "coverage_complete" in sql
        assert "ads.ads_pdm_lx_hot_product_index_sku_d" in sql
        assert "ads.ads_pdm_lx_hot_product_index_sku_m" in sql

    assert "WHERE v.coverage_complete = 1" in daily["sql"]
    assert "d.is_eligible = 1" in daily["sql"]
    assert "d.sales_date >= v.selected_start_date" in daily["sql"]
    assert "d.sales_date < v.effective_end_exclusive_date" in daily["sql"]
    assert "WHERE v.coverage_complete = 1" in monthly["sql"]
    assert "m.is_eligible = 1" in monthly["sql"]
    assert "DATE_TRUNC(v.selected_end_date, 'month')" in monthly["sql"]
    assert "is_stale" in status["sql"]
    assert "DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)" in status["sql"]
    assert (
        "DATE_FORMAT(global_data_through_date, '%Y-%m-%d') AS global_data_through_ymd"
    ) in status["sql"]

    daily_metrics = {
        metric["metric_name"]: metric["expression"] for metric in daily["metrics"]
    }
    assert daily_metrics == {
        "avg_daily_sales_qty": (
            "SUM(sales_qty) / NULLIF(MAX(selected_calendar_days), 0)"
        ),
        "gross_margin": ("SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)"),
        "gross_profit_usd_total": "SUM(gross_profit_usd)",
        "hot_product_index": (
            "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)"
        ),
        "return_rate": "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)",
        "sales_amount_usd_total": "SUM(sales_amount_usd)",
        "sales_amount_usd_funnel": (
            "CASE WHEN MIN(rating_complete) = 1 "
            "THEN SUM(sales_amount_usd) ELSE NULL END"
        ),
        "sales_qty_total": "SUM(sales_qty)",
        "spu_previous_month_sales_level_sort_metric": (
            "MIN(spu_previous_month_sales_level_sort)"
        ),
    }
    monthly_metrics = {
        metric["metric_name"]: metric["expression"] for metric in monthly["metrics"]
    }
    assert monthly_metrics == {
        "in_sale_spu_count_funnel": (
            "CASE WHEN MIN(rating_complete) = 1 THEN COUNT(DISTINCT spu) ELSE NULL END"
        ),
        "in_sale_sku_count": (
            "CASE WHEN COUNT(*) = 0 THEN NULL ELSE COUNT(DISTINCT sku) END"
        ),
        "in_sale_spu_count": (
            "CASE WHEN COUNT(*) = 0 THEN NULL ELSE COUNT(DISTINCT spu) END"
        ),
        "spu_previous_month_sales_level_sort_metric": (
            "MIN(spu_previous_month_sales_level_sort)"
        ),
    }


def test_funnels_stop_when_any_selected_eligible_rating_is_missing(
    tmp_path: Path,
) -> None:
    """A null source rating must blank both funnels without blanking KPI rows."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    charts = assets_by_key(assets, "charts", "slice_name")
    daily = datasets["爆品指数-日明细"]
    monthly = datasets["爆品指数-月末在售"]
    status = datasets["爆品指数-数据状态"]

    for dataset in (daily, monthly, status):
        assert "daily_missing_rating_count" in dataset["sql"]
        assert "monthly_missing_rating_count" in dataset["sql"]
        assert "rating_complete" in dataset["sql"]
    assert "spu_previous_month_sales_level IS NULL" in daily["sql"]
    assert "spu_previous_month_sales_level IS NULL" in monthly["sql"]
    assert "COALESCE(d.spu_previous_month_sales_level" not in daily["sql"]
    assert "COALESCE(m.spu_previous_month_sales_level" not in monthly["sql"]

    daily_metrics = {
        metric["metric_name"]: metric["expression"] for metric in daily["metrics"]
    }
    assert daily_metrics["sales_amount_usd_funnel"] == (
        "CASE WHEN MIN(rating_complete) = 1 THEN SUM(sales_amount_usd) ELSE NULL END"
    )
    assert daily_metrics["sales_qty_total"] == "SUM(sales_qty)"
    assert charts["SPU销售额漏斗"]["params"]["metric"] == ("sales_amount_usd_funnel")
    assert charts["SPU数漏斗"]["params"]["metric"] == ("in_sale_spu_count_funnel")
    assert "评级源不完整" in charts["爆品指数数据状态"]["params"]["handlebarsTemplate"]


def test_main_dashboard_matches_approved_scope_and_filters(tmp_path: Path) -> None:
    """The main canvas contains overview content followed by detail tabs."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    dashboards = assets_by_key(assets, "dashboards", "dashboard_title")
    main = dashboards["拉杆箱在售产品爆品指数看板"]

    main_chart_nodes = [
        node
        for node in main["position"].values()
        if isinstance(node, dict) and node.get("type") == "CHART"
    ]
    main_chart_uuids = {node["meta"]["uuid"] for node in main_chart_nodes}
    main_charts = [
        chart for chart in charts.values() if chart["uuid"] in main_chart_uuids
    ]
    assert len(main_charts) == 14
    assert sum(chart["viz_type"] == "big_number_total" for chart in main_charts) == 9
    assert sum(chart["viz_type"] == "funnel" for chart in main_charts) == 2
    assert sum(chart["viz_type"] == "handlebars" for chart in main_charts) == 1
    assert (
        sum(chart["viz_type"] == "ag-grid-table-scheme" for chart in main_charts) == 2
    )
    assert all(
        chart["params"].get("show_metric_name") is True
        for chart in main_charts
        if chart["viz_type"] == "big_number_total"
    )

    position = main["position"]
    assert position["GRID_ID"]["children"][-2:] == [
        "ROW-DETAIL-TITLE",
        "TABS-DETAIL",
    ]
    assert position["ROW-DETAIL-TITLE"]["children"] == ["MARKDOWN-DETAIL-TITLE"]
    assert "爆品指数&经营指标报表" in position["MARKDOWN-DETAIL-TITLE"]["meta"]["code"]
    assert position["TABS-DETAIL"]["children"] == [
        "TAB-SPU-DETAIL",
        "TAB-SKU-DETAIL",
    ]
    assert position["TAB-SPU-DETAIL"]["meta"]["text"] == "SPU维度"
    assert position["TAB-SKU-DETAIL"]["meta"]["text"] == "SKU维度"
    assert position["TAB-SPU-DETAIL"]["children"] == ["ROW-SPU-DETAIL"]
    assert position["TAB-SKU-DETAIL"]["children"] == ["ROW-SKU-DETAIL"]
    assert position["ROW-SPU-DETAIL"]["children"] == ["CHART-SPU-DETAIL"]
    assert position["ROW-SKU-DETAIL"]["children"] == ["CHART-SKU-DETAIL"]
    assert position["CHART-SPU-DETAIL"]["meta"]["uuid"] == (
        "4454d29b-3161-5d51-9e7b-7c1a9e96db06"
    )
    assert position["CHART-SKU-DETAIL"]["meta"]["uuid"] == (
        "76d38770-7b51-5f9e-b9df-d1b48113b8a3"
    )
    assert position["CHART-SPU-DETAIL"]["parents"][-2:] == [
        "TAB-SPU-DETAIL",
        "ROW-SPU-DETAIL",
    ]
    assert position["CHART-SKU-DETAIL"]["parents"][-2:] == [
        "TAB-SKU-DETAIL",
        "ROW-SKU-DETAIL",
    ]

    filters = main["metadata"]["native_filter_configuration"]
    assert [item["name"] for item in filters] == [
        "渠道",
        "品线",
        "SPU",
        "国家",
        "公司SKU",
        "SKU",
        "尺寸",
        "颜色",
        "年月",
        "开发经理",
        "型号",
        "SKU等级",
        "产品等级",
    ]
    assert all(
        "datasetUuid" in target and "datasetId" not in target
        for item in filters
        for target in item["targets"]
    )
    month_filter = next(item for item in filters if item["name"] == "年月")
    assert month_filter["filterType"] == "filter_month_range"
    assert month_filter["controlValues"]["monthSelectionMode"] == "range"
    assert month_filter["controlValues"]["monthTimeZone"] == "Asia/Shanghai"
    assert month_filter["defaultDataMask"]["extraFormData"] == {
        "time_range": "Current month"
    }
    assert month_filter["defaultDataMask"]["filterState"] == {"value": "Current month"}
    assert [
        (target["datasetUuid"], target["column"]["name"])
        for target in month_filter["targets"]
    ] == [
        ("ea2025d6-91ac-502f-9238-9f21ca62b761", "sales_date"),
        ("669d6bf7-779b-545b-9b9d-5b45a5d3842c", "month_start_date"),
        ("bd0d4806-9f13-59a0-be0b-4d7458f88e7f", "selected_start_date"),
        ("de2f3527-4fb7-51df-a1ef-067567348ee6", "month_start_date"),
        ("baea3900-76bf-5de9-8f10-aad2cc5e4b60", "month_start_date"),
    ]

    status_uuid = charts["爆品指数数据状态"]["uuid"]
    for item in filters:
        if item["filterType"] == "filter_select":
            assert status_uuid not in item["chartsInScope"]
            assert item["scope"]["excluded"] == [1000]
            assert item["chartsInScope"][-2:] == [
                "4454d29b-3161-5d51-9e7b-7c1a9e96db06",
                "76d38770-7b51-5f9e-b9df-d1b48113b8a3",
            ]
            assert [target["datasetUuid"] for target in item["targets"]] == [
                "ea2025d6-91ac-502f-9238-9f21ca62b761",
                "669d6bf7-779b-545b-9b9d-5b45a5d3842c",
                "de2f3527-4fb7-51df-a1ef-067567348ee6",
                "baea3900-76bf-5de9-8f10-aad2cc5e4b60",
            ]
            assert len({target["column"]["name"] for target in item["targets"]}) == 1
    assert status_uuid in month_filter["chartsInScope"]


def test_detail_css_is_scoped_to_table_components_and_tabs(tmp_path: Path) -> None:
    """FineBI table styling does not leak to unrelated dashboard components."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "拉杆箱在售产品爆品指数看板"
    ]
    css = main["css"]
    assert "#CHART-SPU-DETAIL .ag-header" in css
    assert "#CHART-SKU-DETAIL .ag-header" in css
    assert "#8AA964" in css
    assert "rgba(138,169,100,.05)" in css
    assert "rgba(138,169,100,.10)" in css
    assert ".ag-row-even:not(.ag-row-pinned)" in css
    assert ".ag-row-odd:not(.ag-row-pinned)" in css
    assert ".ag-row-pinned" in css
    assert "font-weight: 700" in css
    assert "#TABS-DETAIL .ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar" in css
    assert "#2978B5" in css
    assert ".ant-tabs-tab-active .ant-tabs-tab-btn" in css
    assert "#CHART-SPU-DETAIL .ag-header" in css
    assert "#CHART-SKU-DETAIL .ag-header" in css


def test_main_dashboard_rejects_missing_detail_chart_uuid(tmp_path: Path) -> None:
    """The 14-chart invariant fails when a detail node points to no chart asset."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    assets["dashboards/Hot_Product_Index.yaml"]["position"]["CHART-SPU-DETAIL"]["meta"][
        "uuid"
    ] = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(ValueError, match="unknown chart UUID"):
        validate_assets(assets, DEFAULT_DATABASE_UUID)


def test_funnels_keep_the_business_grade_order(tmp_path: Path) -> None:
    """Funnel geometry must follow Ps/S/A/B/C/- rather than metric magnitude."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    funnels = [chart for chart in charts.values() if chart["viz_type"] == "funnel"]

    assert len(funnels) == 2
    for funnel in funnels:
        params = funnel["params"]
        assert params["groupby"] == ["spu_previous_month_sales_level"]
        assert params["order_by_cols"] == [
            '["spu_previous_month_sales_level_sort_metric", true]'
        ]
        assert params["sort_by_metric"] is False
        assert params["sort"] == "none"
        assert params["label_type"] == 5
        assert params["tooltip_label_type"] == 5
        assert params["percent_calculation_type"] == "total"
        assert params["percent_format"] == ",.1~%"
        assert params["label_template"] == "{name}\\n{value} | {percent}"
        query_context = json.loads(funnel["query_context"])
        assert query_context["queries"][0]["orderby"] == [
            ["spu_previous_month_sales_level_sort_metric", True]
        ]

    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "拉杆箱在售产品爆品指数看板"
    ]
    assert main["metadata"]["label_colors"] == {
        "-": "#9CA3AF",
        "A": "#92D050",
        "B": "#FFE600",
        "C": "#FFC000",
        "Ps": "#E84A5F",
        "S": "#1677C8",
    }

    sales_funnel = charts["SPU销售额漏斗"]["params"]
    assert sales_funnel["label_value_divisor"] == 10000
    assert sales_funnel["label_value_suffix"] == "万"
    assert sales_funnel["number_format"] == "$,.1~f"
    spu_funnel = charts["SPU数漏斗"]["params"]
    assert spu_funnel["label_value_divisor"] == 1
    assert spu_funnel["label_value_suffix"] == ""


def test_visible_numbers_use_at_most_one_decimal_place(tmp_path: Path) -> None:
    """KPI, metric, funnel value, and funnel percent formats share the constraint."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    datasets = assets_by_key(assets, "datasets", "table_name")
    charts = assets_by_key(assets, "charts", "slice_name")

    assert {
        name: charts[name]["params"]["y_axis_format"]
        for name in (
            "销量",
            "日均销量",
            "销售额",
            "在售SPU数",
            "爆品指数",
            "在售SKU数",
            "毛利润",
            "毛利率",
            "退货率",
        )
    } == {
        "销量": ",.0f",
        "日均销量": ",.1~f",
        "销售额": "$,.0f",
        "在售SPU数": ",.0f",
        "爆品指数": ",.1~f",
        "在售SKU数": ",.0f",
        "毛利润": "$,.1~f",
        "毛利率": ".1~%",
        "退货率": ".1~%",
    }

    daily_metric_formats = {
        metric["metric_name"]: metric["d3format"]
        for metric in datasets["爆品指数-日明细"]["metrics"]
    }
    assert daily_metric_formats["avg_daily_sales_qty"] == ",.1~f"
    assert daily_metric_formats["hot_product_index"] == ",.1~f"
    assert daily_metric_formats["gross_profit_usd_total"] == "$,.1~f"
    assert daily_metric_formats["gross_margin"] == ".1~%"
    assert daily_metric_formats["return_rate"] == ".1~%"


def test_guide_link_is_a_header_layout_component(tmp_path: Path) -> None:
    """The guide entry belongs to the green title area, not the status row."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "拉杆箱在售产品爆品指数看板"
    ]

    status = charts["爆品指数数据状态"]
    assert "说明文档" not in status["params"]["handlebarsTemplate"]
    assert "hot-product-index-guide" not in status["params"]["handlebarsTemplate"]

    position = main["position"]
    assert position["GRID_ID"]["children"][0] == "ROW-DOC-LINK"
    assert position["ROW-DOC-LINK"]["children"] == ["MARKDOWN-DOC-LINK"]
    guide_link = position["MARKDOWN-DOC-LINK"]
    assert guide_link == {
        "children": [],
        "id": "MARKDOWN-DOC-LINK",
        "meta": {
            "code": "[说明文档](/dashboard/hot-product-index-guide/)",
            "height": 1,
            "openLinksInNewTab": True,
            "width": 12,
        },
        "parents": ["ROOT_ID", "GRID_ID", "ROW-DOC-LINK"],
        "type": "MARKDOWN",
    }
    assert "#MARKDOWN-DOC-LINK" in main["css"]
    assert "position: fixed" in main["css"]
    assert """#MARKDOWN-DOC-LINK > .resizable-container {
  height: 100% !important;
  max-height: 100% !important;
  max-width: 100% !important;
  min-height: 100% !important;
  min-width: 100% !important;
  width: 100% !important;
}""" in main["css"]


def test_status_banner_renders_without_sanitized_css_or_row_limit_warning(
    tmp_path: Path,
) -> None:
    """The compact banner must survive HTML sanitization and fit its grid row."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    main = assets_by_key(assets, "dashboards", "dashboard_title")[
        "拉杆箱在售产品爆品指数看板"
    ]

    params = charts["爆品指数数据状态"]["params"]
    assert params["row_limit"] == 2
    assert params["styleTemplate"] == ""
    assert "{{global_data_through_ymd}}" in params["handlebarsTemplate"]
    assert "{{effective_end_ymd}}" in params["handlebarsTemplate"]
    assert "dateFormat" not in params["handlebarsTemplate"]
    assert "\n" not in params["handlebarsTemplate"]

    assert main["position"]["CHART-STATUS"]["meta"]["height"] == 8
    css = main["css"]
    assert "#CHART-STATUS + .chart-slice [data-test='slice-header']" in css
    assert "[id^='CHART-KPI-'] + .chart-slice [data-test='slice-header']" in css
    assert ".dashboard-component-chart-holder:has(> #CHART-STATUS)" in css
    assert "right: 250px" in css


def test_guide_chart_keeps_styles_outside_sanitized_handlebars(
    tmp_path: Path,
) -> None:
    """Guide HTML must not expose its CSS or epoch-millisecond dates."""
    assets = read_bundle(write_bundle(tmp_path / "assets.zip"))
    charts = assets_by_key(assets, "charts", "slice_name")
    guide = assets_by_key(assets, "dashboards", "dashboard_title")["爆品指数说明文档"]

    params = charts["爆品指数说明"]["params"]
    assert params["row_limit"] == 2
    assert params["styleTemplate"] == ""
    assert "{{global_data_through_ymd}}" in params["handlebarsTemplate"]
    assert "{{selected_start_ymd}}" in params["handlebarsTemplate"]
    assert "{{selected_end_ymd}}" in params["handlebarsTemplate"]
    assert "dateFormat" not in params["handlebarsTemplate"]
    assert "product_level" not in params["handlebarsTemplate"]
    assert "SKU 行级产品等级" in params["handlebarsTemplate"]
    assert "#CHART-GUIDE + .chart-slice [data-test='slice-header']" in guide["css"]
    assert "#CHART-GUIDE + .chart-slice .handlebars article" in guide["css"]


def test_write_bundle_rejects_an_invalid_database_uuid(tmp_path: Path) -> None:
    """A typo in the production database identity must stop before ZIP creation."""
    output = tmp_path / "assets.zip"

    with pytest.raises(ValueError, match="database_uuid"):
        write_bundle(output, database_uuid="not-a-uuid")

    assert not output.exists()
