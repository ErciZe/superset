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
    assert "DAY(a.data_through_date) / DAY(LAST_DAY(a.data_through_date))" in sql

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
    for table_name, source_columns in (
        ("ads_pdm_lx_hot_product_index_sku_d", DAILY_SOURCE_COLUMNS),
        ("ads_pdm_lx_hot_product_index_sku_m", MONTHLY_SOURCE_COLUMNS),
    ):
        assert table_name in preflight
        assert all(f"'{column_name}'" in preflight for column_name, _ in source_columns)
