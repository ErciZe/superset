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

from scripts.hot_product_index_dashboard import write_bundle


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
    assert columns["week_start_date"]["is_dttm"] is True
    assert columns["yw"]["verbose_name"] == "年周"
    assert columns["color_code"]["verbose_name"] == "颜色代码"
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
    new_metric_names = {
        "avg_daily_sales_qty_period",
        "return_goods_qty_total",
        "order_qty_total",
        "in_sale_sku_count_period",
        "in_sale_spu_count_period",
        "sales_amount_usd_wan",
        "gross_profit_usd_wan",
    }
    approved_formats = {",.0f", ",.1~f", ".1~%"}

    for name in new_metric_names:
        assert metrics[name]["verbose_name"]
        assert any(
            "\u4e00" <= char <= "\u9fff"
            for char in metrics[name]["verbose_name"]
        )
        assert metrics[name]["d3format"] in approved_formats
