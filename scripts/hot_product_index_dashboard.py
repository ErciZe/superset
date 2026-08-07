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

# The generated SQL interpolates only module-owned column lists.
# ruff: noqa: S608
import argparse
import json
from pathlib import Path
from typing import Any, Final, Iterable, Sequence
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

Asset = dict[str, Any]
AssetBundle = dict[str, Asset]

DEFAULT_DATABASE_UUID: Final = "2f4b7c5a-35ab-4df1-870a-8157f2d3f621"
BUNDLE_ROOT: Final = "hot_product_index_assets"
ASSET_VERSION: Final = "1.0.0"
STATUS_PLACEHOLDER_CHART_ID: Final = 1000

UUIDS: Final = {
    "dataset_daily": "ea2025d6-91ac-502f-9238-9f21ca62b761",
    "dataset_monthly": "669d6bf7-779b-545b-9b9d-5b45a5d3842c",
    "dataset_status": "bd0d4806-9f13-59a0-be0b-4d7458f88e7f",
    "chart_kpi_sales_qty": "c5749623-be9e-5116-8c2f-de2b3e77e3a8",
    "chart_kpi_avg_daily_sales_qty": "aa2a07b5-35d7-581c-b8c2-c58918efd11f",
    "chart_kpi_sales_amount_usd": "b76f494e-2743-5215-b310-0d068ba44c8c",
    "chart_kpi_in_sale_spu": "7b4e4fa3-9c3a-5cf9-a9cb-e3f4c7fb4624",
    "chart_kpi_hot_product_index": "13bb0d3f-ff24-53c7-bb10-920cc8c32b0c",
    "chart_kpi_in_sale_sku": "d117bdb4-ca6a-5bbe-87a1-34eac8301c66",
    "chart_kpi_gross_profit_usd": "5511c4b9-ce65-57d2-a847-dc51a0ea4091",
    "chart_kpi_gross_margin": "66274a5e-9ef7-555c-9a62-ba33c21780f8",
    "chart_kpi_return_rate": "85045a88-fa32-5e03-995c-380c7a02b3c1",
    "chart_funnel_sales_amount": "dbf723fb-9eda-550e-be23-5b9d1776b88a",
    "chart_funnel_spu_count": "026df338-3eff-5f2f-8bc9-e9f8067832f0",
    "chart_status": "b6610031-d5ad-5e35-8219-faa765783c0f",
    "chart_guide": "5787bc53-1ed2-5143-8804-9431ade48135",
    "dashboard_main": "c0ee60ac-1686-568f-ac64-a6d7fe19dab0",
    "dashboard_guide": "a0877778-6fd7-5811-b071-24cdadb0cbb3",
}

DAILY_SOURCE_COLUMNS: Final[tuple[tuple[str, str], ...]] = (
    ("sales_date", "DATE"),
    ("sid", "STRING"),
    ("msku", "STRING"),
    ("ym", "STRING"),
    ("sku", "STRING"),
    ("spu", "STRING"),
    ("company_sku", "STRING"),
    ("channel", "STRING"),
    ("product_line", "STRING"),
    ("country", "STRING"),
    ("size", "STRING"),
    ("color", "STRING"),
    ("developer", "STRING"),
    ("model", "STRING"),
    ("sku_level", "STRING"),
    ("product_level", "STRING"),
    ("spu_previous_month_sales_amount_cny", "DECIMAL"),
    ("spu_previous_month_sales_level", "STRING"),
    ("sales_qty", "BIGINT"),
    ("sales_amount_usd", "DECIMAL"),
    ("gross_profit_usd", "DECIMAL"),
    ("return_goods_qty", "BIGINT"),
    ("sku_month_sales_qty", "BIGINT"),
    ("theoretical_stock_qty", "DECIMAL"),
    ("eligibility_value", "DECIMAL"),
    ("is_eligible", "TINYINT"),
    ("is_generated_zero", "TINYINT"),
    ("data_through_date", "DATE"),
    ("source_updated_at", "DATETIME"),
    ("etl_batch_id", "STRING"),
    ("etl_loaded_at", "DATETIME"),
)

MONTHLY_SOURCE_COLUMNS: Final[tuple[tuple[str, str], ...]] = (
    ("month_start_date", "DATE"),
    ("sid", "STRING"),
    ("msku", "STRING"),
    ("ym", "STRING"),
    ("sku", "STRING"),
    ("spu", "STRING"),
    ("company_sku", "STRING"),
    ("channel", "STRING"),
    ("product_line", "STRING"),
    ("country", "STRING"),
    ("size", "STRING"),
    ("color", "STRING"),
    ("developer", "STRING"),
    ("model", "STRING"),
    ("sku_level", "STRING"),
    ("product_level", "STRING"),
    ("spu_previous_month_sales_amount_cny", "DECIMAL"),
    ("spu_previous_month_sales_level", "STRING"),
    ("sales_qty", "BIGINT"),
    ("sales_amount_usd", "DECIMAL"),
    ("gross_profit_usd", "DECIMAL"),
    ("return_goods_qty", "BIGINT"),
    ("sku_month_sales_qty", "BIGINT"),
    ("theoretical_stock_qty", "DECIMAL"),
    ("eligibility_value", "DECIMAL"),
    ("is_eligible", "TINYINT"),
    ("data_through_date", "DATE"),
    ("source_updated_at", "DATETIME"),
    ("etl_batch_id", "STRING"),
    ("etl_loaded_at", "DATETIME"),
)

COVERAGE_COLUMNS: Final[tuple[tuple[str, str], ...]] = (
    ("selected_start_date", "DATE"),
    ("selected_end_date", "DATE"),
    ("selected_end_exclusive_date", "DATE"),
    ("effective_end_date", "DATE"),
    ("effective_end_exclusive_date", "DATE"),
    ("global_data_through_date", "DATE"),
    ("selected_calendar_days", "BIGINT"),
    ("expected_month_count", "BIGINT"),
    ("daily_month_count", "BIGINT"),
    ("monthly_month_count", "BIGINT"),
    ("daily_missing_rating_count", "BIGINT"),
    ("monthly_missing_rating_count", "BIGINT"),
    ("coverage_complete", "TINYINT"),
    ("rating_complete", "TINYINT"),
    ("is_stale", "TINYINT"),
)

FILTERS: Final[tuple[tuple[str, str], ...]] = (
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
    ("产品等级", "product_level"),
)

KPI_DEFINITIONS: Final[tuple[tuple[str, str, str, str], ...]] = (
    ("销量", "dataset_daily", "sales_qty_total", ",.0f"),
    ("日均销量", "dataset_daily", "avg_daily_sales_qty", ",.2f"),
    ("销售额", "dataset_daily", "sales_amount_usd_total", "$,.0f"),
    ("在售SPU数", "dataset_monthly", "in_sale_spu_count", ",.0f"),
    ("爆品指数", "dataset_daily", "hot_product_index", ",.2f"),
    ("在售SKU数", "dataset_monthly", "in_sale_sku_count", ",.0f"),
    ("毛利润", "dataset_daily", "gross_profit_usd_total", "$,.2f"),
    ("毛利率", "dataset_daily", "gross_margin", ".2%"),
    ("退货率", "dataset_daily", "return_rate", ".2%"),
)

KPI_UUID_KEYS: Final[tuple[str, ...]] = (
    "chart_kpi_sales_qty",
    "chart_kpi_avg_daily_sales_qty",
    "chart_kpi_sales_amount_usd",
    "chart_kpi_in_sale_spu",
    "chart_kpi_hot_product_index",
    "chart_kpi_in_sale_sku",
    "chart_kpi_gross_profit_usd",
    "chart_kpi_gross_margin",
    "chart_kpi_return_rate",
)

KPI_COMPONENT_IDS: Final[tuple[str, ...]] = (
    "CHART-KPI-SALES-QTY",
    "CHART-KPI-AVG-DAILY-SALES-QTY",
    "CHART-KPI-SALES-AMOUNT-USD",
    "CHART-KPI-IN-SALE-SPU",
    "CHART-KPI-HOT-PRODUCT-INDEX",
    "CHART-KPI-IN-SALE-SKU",
    "CHART-KPI-GROSS-PROFIT-USD",
    "CHART-KPI-GROSS-MARGIN",
    "CHART-KPI-RETURN-RATE",
)


def _column(
    name: str,
    type_: str,
    *,
    is_dttm: bool = False,
    expression: str | None = None,
    description: str | None = None,
) -> Asset:
    """Build one importable dataset column definition."""
    return {
        "advanced_data_type": None,
        "column_name": name,
        "datetime_format": None,
        "description": description,
        "expression": expression,
        "extra": None,
        "filterable": True,
        "groupby": True,
        "is_active": True,
        "is_dttm": is_dttm,
        "python_date_format": None,
        "type": type_,
        "verbose_name": None,
    }


def _metric(
    name: str,
    verbose_name: str,
    expression: str,
    d3format: str,
    description: str,
) -> Asset:
    """Build one importable semantic metric definition."""
    return {
        "currency": None,
        "d3format": d3format,
        "description": description,
        "expression": expression,
        "extra": None,
        "metric_name": name,
        "metric_type": None,
        "verbose_name": verbose_name,
        "warning_text": None,
    }


def _coverage_ctes(time_column: str) -> str:
    """Return shared, fail-closed month-bound and target-continuity CTEs."""
    template = """{% set time_filter = get_time_filter(
  "__TIME_COLUMN__", default="Current month", target_type="DATE",
  remove_filter=True
) %}
WITH watermark AS (
  SELECT MAX(data_through_date) AS global_data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
),
bounds AS (
  SELECT
    CAST({{ time_filter.from_expr }} AS DATE) AS selected_start_date,
    CAST({{ time_filter.to_expr }} AS DATE) AS selected_end_exclusive_date,
    w.global_data_through_date
  FROM watermark w
),
daily_quality AS (
  SELECT
    COUNT(DISTINCT d.ym) AS daily_month_count,
    COALESCE(SUM(
      CASE
        WHEN d.is_eligible = 1
          AND d.sales_date >= b.selected_start_date
          AND d.sales_date < b.selected_end_exclusive_date
          AND d.spu_previous_month_sales_level IS NULL
        THEN 1
        ELSE 0
      END
    ), 0) AS daily_missing_rating_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN bounds b
  WHERE d.ym >= DATE_FORMAT(b.selected_start_date, '%Y-%m')
    AND d.ym < DATE_FORMAT(b.selected_end_exclusive_date, '%Y-%m')
),
monthly_quality AS (
  SELECT
    COUNT(DISTINCT m.ym) AS monthly_month_count,
    COALESCE(SUM(
      CASE
        WHEN m.is_eligible = 1
          AND m.spu_previous_month_sales_level IS NULL
        THEN 1
        ELSE 0
      END
    ), 0) AS monthly_missing_rating_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN bounds b
  WHERE m.ym >= DATE_FORMAT(b.selected_start_date, '%Y-%m')
    AND m.ym < DATE_FORMAT(b.selected_end_exclusive_date, '%Y-%m')
),
coverage AS (
  SELECT
    b.*,
    LEAST(
      b.selected_end_exclusive_date,
      DATE_ADD(b.global_data_through_date, INTERVAL 1 DAY)
    ) AS effective_end_exclusive_date,
    TIMESTAMPDIFF(MONTH, b.selected_start_date, b.selected_end_exclusive_date)
      AS expected_month_count,
    d.daily_month_count,
    m.monthly_month_count,
    d.daily_missing_rating_count,
    m.monthly_missing_rating_count
  FROM bounds b
  CROSS JOIN daily_quality d
  CROSS JOIN monthly_quality m
),
valid AS (
  SELECT
    coverage.*,
    DATE_SUB(selected_end_exclusive_date, INTERVAL 1 DAY) AS selected_end_date,
    DATE_SUB(effective_end_exclusive_date, INTERVAL 1 DAY) AS effective_end_date,
    DATEDIFF(
      effective_end_exclusive_date,
      selected_start_date
    ) AS selected_calendar_days,
    CASE
      WHEN expected_month_count > 0
        AND DAY(selected_start_date) = 1
        AND DAY(selected_end_exclusive_date) = 1
        AND daily_month_count = expected_month_count
        AND monthly_month_count = expected_month_count
        AND effective_end_exclusive_date > selected_start_date
      THEN 1
      ELSE 0
    END AS coverage_complete,
    CASE
      WHEN daily_missing_rating_count = 0
        AND monthly_missing_rating_count = 0
      THEN 1
      ELSE 0
    END AS rating_complete,
    CASE
      WHEN global_data_through_date IS NULL
        OR global_data_through_date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      THEN 1
      ELSE 0
    END AS is_stale
  FROM coverage
)
"""
    return template.replace("__TIME_COLUMN__", time_column)


def _source_select_list(alias: str, columns: Sequence[tuple[str, str]]) -> list[str]:
    """Qualify target columns and add the fixed business-grade sort key."""
    selected: list[str] = []
    for name, _ in columns:
        selected.append(f"{alias}.{name}")
    selected.append(
        f"CASE {alias}.spu_previous_month_sales_level "
        "WHEN 'Ps' THEN 1 WHEN 'S' THEN 2 WHEN 'A' THEN 3 "
        "WHEN 'B' THEN 4 WHEN 'C' THEN 5 WHEN '-' THEN 6 ELSE 99 "
        "END AS spu_previous_month_sales_level_sort"
    )
    return selected


def _daily_sql() -> str:
    """Build the eligible daily serving query with a left-closed month range."""
    selected = _source_select_list("d", DAILY_SOURCE_COLUMNS)
    selected.extend(f"v.{name}" for name, _ in COVERAGE_COLUMNS)
    select_sql = ",\n  ".join(selected)
    return (
        _coverage_ctes("sales_date")
        + f"""SELECT
  {select_sql}
FROM ads.ads_pdm_lx_hot_product_index_sku_d d
CROSS JOIN valid v
WHERE v.coverage_complete = 1
  AND d.is_eligible = 1
  AND d.sales_date >= v.selected_start_date
  AND d.sales_date < v.effective_end_exclusive_date
"""
    )


def _monthly_sql() -> str:
    """Build the selected end-month serving query for eligible in-sale products."""
    selected = _source_select_list("m", MONTHLY_SOURCE_COLUMNS)
    selected.extend(f"v.{name}" for name, _ in COVERAGE_COLUMNS)
    select_sql = ",\n  ".join(selected)
    return (
        _coverage_ctes("month_start_date")
        + f"""SELECT
  {select_sql}
FROM ads.ads_pdm_lx_hot_product_index_sku_m m
CROSS JOIN valid v
WHERE v.coverage_complete = 1
  AND m.is_eligible = 1
  AND m.month_start_date = DATE_TRUNC(v.selected_end_date, 'month')
"""
    )


def _status_sql() -> str:
    """Build the single-row data freshness and coverage query."""
    return (
        _coverage_ctes("selected_start_date")
        + """SELECT
  selected_start_date,
  selected_end_date,
  selected_end_exclusive_date,
  effective_end_date,
  effective_end_exclusive_date,
  global_data_through_date,
  selected_calendar_days,
  expected_month_count,
  daily_month_count,
  monthly_month_count,
  daily_missing_rating_count,
  monthly_missing_rating_count,
  coverage_complete,
  rating_complete,
  is_stale,
  CASE
    WHEN coverage_complete = 0 THEN '所选范围存在数据缺口'
    WHEN is_stale = 1 THEN '数据更新延迟'
    ELSE '数据已就绪'
  END AS status_message,
  CASE
    WHEN rating_complete = 1 THEN '评级源完整'
    ELSE '评级源不完整，漏斗停算'
  END AS rating_status_message
FROM valid
"""
    )


def _dataset(
    *,
    table_name: str,
    uuid: str,
    main_dttm_col: str,
    description: str,
    sql: str,
    columns: Iterable[Asset],
    metrics: Iterable[Asset],
    database_uuid: str,
) -> Asset:
    """Build a virtual dataset asset."""
    return {
        "always_filter_main_dttm": False,
        "cache_timeout": None,
        "catalog": "internal",
        "columns": list(columns),
        "currency_code_column": None,
        "database_uuid": database_uuid,
        "default_endpoint": None,
        "description": description,
        "extra": None,
        "fetch_values_predicate": None,
        "filter_select_enabled": True,
        "folders": None,
        "main_dttm_col": main_dttm_col,
        "metrics": list(metrics),
        "normalize_columns": False,
        "offset": 0,
        "params": None,
        "schema": "ads",
        "sql": sql,
        "table_name": table_name,
        "template_params": None,
        "uuid": uuid,
        "version": ASSET_VERSION,
    }


def _datasets(database_uuid: str) -> AssetBundle:
    """Build the three virtual semantic datasets used by the dashboard."""
    common_business_columns = [
        _column(name, type_, is_dttm=type_ in {"DATE", "DATETIME"})
        for name, type_ in COVERAGE_COLUMNS
    ]
    daily_columns = [
        _column(name, type_, is_dttm=type_ in {"DATE", "DATETIME"})
        for name, type_ in DAILY_SOURCE_COLUMNS
    ]
    daily_columns.extend(
        [
            _column(
                "spu_previous_month_sales_level_sort",
                "BIGINT",
                description="固定产品等级顺序：Ps、S、A、B、C、-。",
            ),
            *common_business_columns,
        ]
    )
    monthly_columns = [
        _column(name, type_, is_dttm=type_ in {"DATE", "DATETIME"})
        for name, type_ in MONTHLY_SOURCE_COLUMNS
    ]
    monthly_columns.extend(
        [
            _column(
                "spu_previous_month_sales_level_sort",
                "BIGINT",
                description="固定产品等级顺序：Ps、S、A、B、C、-。",
            ),
            *common_business_columns,
        ]
    )
    status_columns = [
        *common_business_columns,
        _column("status_message", "STRING"),
        _column("rating_status_message", "STRING"),
    ]

    daily_metrics = (
        _metric(
            "sales_qty_total",
            "销量",
            "SUM(sales_qty)",
            ",.0f",
            "所选期间满足在售条件的销量合计。",
        ),
        _metric(
            "avg_daily_sales_qty",
            "日均销量",
            "SUM(sales_qty) / NULLIF(MAX(selected_calendar_days), 0)",
            ",.2f",
            "销量除以实际计算覆盖的自然日数。",
        ),
        _metric(
            "sales_amount_usd_total",
            "销售额",
            "SUM(sales_amount_usd)",
            "$,.0f",
            "所选期间销售额，币种为美元。",
        ),
        _metric(
            "sales_amount_usd_funnel",
            "评级完整销售额",
            (
                "CASE WHEN MIN(rating_complete) = 1 "
                "THEN SUM(sales_amount_usd) ELSE NULL END"
            ),
            "$,.0f",
            "评级源完整时按产品等级汇总美元销售额，否则漏斗停算。",
        ),
        _metric(
            "hot_product_index",
            "爆品指数",
            "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)",
            ",.2f",
            "销量除以有记录的日期-SKU组合数。",
        ),
        _metric(
            "gross_profit_usd_total",
            "毛利润",
            "SUM(gross_profit_usd)",
            "$,.2f",
            "所选期间毛利润，币种为美元。",
        ),
        _metric(
            "gross_margin",
            "毛利率",
            "SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)",
            ".2%",
            "毛利润除以销售额。",
        ),
        _metric(
            "return_rate",
            "退货率",
            "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)",
            ".2%",
            "退货数量除以销量。",
        ),
        _metric(
            "spu_previous_month_sales_level_sort_metric",
            "产品等级排序",
            "MIN(spu_previous_month_sales_level_sort)",
            ",.0f",
            "用于按 Ps、S、A、B、C、- 固定顺序排列漏斗。",
        ),
    )
    monthly_metrics = (
        _metric(
            "in_sale_spu_count",
            "在售SPU数",
            "CASE WHEN COUNT(*) = 0 THEN NULL ELSE COUNT(DISTINCT spu) END",
            ",.0f",
            "所选范围结束月份满足在售条件的SPU数。",
        ),
        _metric(
            "in_sale_spu_count_funnel",
            "评级完整在售SPU数",
            (
                "CASE WHEN MIN(rating_complete) = 1 "
                "THEN COUNT(DISTINCT spu) ELSE NULL END"
            ),
            ",.0f",
            "评级源完整时按产品等级统计在售SPU，否则漏斗停算。",
        ),
        _metric(
            "in_sale_sku_count",
            "在售SKU数",
            "CASE WHEN COUNT(*) = 0 THEN NULL ELSE COUNT(DISTINCT sku) END",
            ",.0f",
            "所选范围结束月份满足在售条件的SKU数。",
        ),
        _metric(
            "spu_previous_month_sales_level_sort_metric",
            "产品等级排序",
            "MIN(spu_previous_month_sales_level_sort)",
            ",.0f",
            "用于按 Ps、S、A、B、C、- 固定顺序排列漏斗。",
        ),
    )

    return {
        "datasets/Doris_ling_xing/Hot_Product_Index_Daily.yaml": _dataset(
            table_name="爆品指数-日明细",
            uuid=UUIDS["dataset_daily"],
            main_dttm_col="sales_date",
            description=(
                "爆品指数日粒度服务数据；仅返回日表与月表均完整发布且销量+库存>10的记录。"
            ),
            sql=_daily_sql(),
            columns=daily_columns,
            metrics=daily_metrics,
            database_uuid=database_uuid,
        ),
        "datasets/Doris_ling_xing/Hot_Product_Index_Monthly.yaml": _dataset(
            table_name="爆品指数-月末在售",
            uuid=UUIDS["dataset_monthly"],
            main_dttm_col="month_start_date",
            description=(
                "爆品指数月粒度服务数据；取所选范围结束月份并仅保留销量+库存>10的记录。"
            ),
            sql=_monthly_sql(),
            columns=monthly_columns,
            metrics=monthly_metrics,
            database_uuid=database_uuid,
        ),
        "datasets/Doris_ling_xing/Hot_Product_Index_Status.yaml": _dataset(
            table_name="爆品指数-数据状态",
            uuid=UUIDS["dataset_status"],
            main_dttm_col="selected_start_date",
            description="所选月份范围的目标表连续性与全局数据水位状态。",
            sql=_status_sql(),
            columns=status_columns,
            metrics=(),
            database_uuid=database_uuid,
        ),
    }


def _query_context(params: Asset) -> str:
    """Build a saved query context that the chart data endpoint can execute."""
    viz_type = str(params["viz_type"])
    if viz_type == "big_number_total":
        columns: list[str] = []
        metrics = [str(params["metric"])]
        row_limit = 1
        orderby: list[list[Any]] = []
    elif viz_type == "funnel":
        columns = list(params["groupby"])
        metrics = [str(params["metric"])]
        row_limit = int(params["row_limit"])
        orderby = [["spu_previous_month_sales_level_sort_metric", True]]
    elif viz_type == "handlebars":
        columns = list(params["all_columns"])
        metrics = []
        row_limit = int(params["row_limit"])
        orderby = []
    else:
        raise ValueError(f"unsupported chart type for query context: {viz_type}")

    datasource = {"id": 0, "type": "table"}
    query: Asset = {
        "annotation_layers": [],
        "applied_time_extras": {},
        "columns": columns,
        "custom_form_data": {},
        "custom_params": {},
        "datasource": datasource,
        "extras": {"having": "", "where": ""},
        "filters": [],
        "group_others_when_limit_reached": False,
        "is_timeseries": False,
        "metrics": metrics,
        "order_desc": False,
        "orderby": orderby,
        "row_limit": row_limit,
        "series_limit": 0,
        "time_range": str(params.get("time_range", "Current month")),
        "url_params": {},
    }
    form_data = {
        **params,
        "datasource": "0__table",
        "force": False,
        "result_format": "json",
        "result_type": "full",
    }
    context = {
        "datasource": datasource,
        "force": False,
        "form_data": form_data,
        "queries": [query],
        "result_format": "json",
        "result_type": "full",
    }
    return json.dumps(
        context, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )


def _chart(
    *,
    slice_name: str,
    uuid: str,
    viz_type: str,
    dataset_uuid: str,
    params: Asset,
    description: str,
) -> Asset:
    """Build one importable chart asset."""
    return {
        "cache_timeout": None,
        "certification_details": None,
        "certified_by": None,
        "dataset_uuid": dataset_uuid,
        "description": description,
        "params": params,
        "query_context": _query_context(params),
        "slice_name": slice_name,
        "uuid": uuid,
        "version": ASSET_VERSION,
        "viz_type": viz_type,
    }


def _big_number_params(metric: str, number_format: str) -> Asset:
    """Return the shared configuration for a KPI tile."""
    return {
        "adhoc_filters": [],
        "header_font_size": 0.35,
        "metric": metric,
        "show_metric_name": True,
        "show_trend_line": False,
        "start_y_axis_at_zero": True,
        "subheader": "",
        "time_range": "Current month",
        "viz_type": "big_number_total",
        "y_axis_format": number_format,
    }


def _funnel_params(
    metric: str,
    number_format: str,
    *,
    label_value_divisor: int = 1,
    label_value_suffix: str = "",
) -> Asset:
    """Return a funnel configuration that preserves the business grade order."""
    return {
        "adhoc_filters": [],
        "color_scheme": "supersetColors",
        "gap": 2,
        "groupby": ["spu_previous_month_sales_level"],
        "label_line": False,
        "label_template": "{name}\\n{value} | {percent}",
        "label_type": 5,
        "label_value_divisor": label_value_divisor,
        "label_value_suffix": label_value_suffix,
        "legendMargin": 0,
        "legendOrientation": "top",
        "metric": metric,
        "number_format": number_format,
        "order_by_cols": ['["spu_previous_month_sales_level_sort_metric", true]'],
        "orient": "vertical",
        "percent_calculation_type": "total",
        "row_limit": 10,
        "show_labels": True,
        "show_legend": False,
        "show_tooltip_labels": True,
        "sort": "none",
        "sort_by_metric": False,
        "time_range": "Current month",
        "tooltip_label_type": 5,
        "viz_type": "funnel",
    }


def _status_chart_params() -> Asset:
    """Return the compact main-canvas status banner configuration."""
    template = """<section>
  <strong>爆品指数总览</strong>
  {{#each data}}
    {{#if coverage_complete}}
      <span>
        数据更新至 {{global_data_through_date}} · 实际计算至 {{effective_end_date}}
        {{#if is_stale}} · 数据延迟{{/if}}
        {{#if rating_complete}}{{else}} · 评级源不完整，漏斗停算{{/if}}
      </span>
    {{else}}
      <span>
        所选范围存在数据缺口 · 日表 {{daily_month_count}}/{{expected_month_count}} 月
        · 月表 {{monthly_month_count}}/{{expected_month_count}} 月
      </span>
    {{/if}}
  {{/each}}
</section>"""
    style = """section {
  align-items: center;
  background: #d8edc8;
  color: #13213a;
  display: flex;
  font-size: 13px;
  gap: 20px;
  height: 100%;
  justify-content: space-between;
  padding: 0 16px;
}
section strong { font-size: 18px; }
section span { flex: 1; text-align: center; }
@media (max-width: 900px) {
  section {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
  }
  section span { text-align: left; }
}"""
    return {
        "adhoc_filters": [],
        "all_columns": [
            "selected_start_date",
            "selected_end_date",
            "effective_end_date",
            "global_data_through_date",
            "expected_month_count",
            "daily_month_count",
            "monthly_month_count",
            "coverage_complete",
            "rating_complete",
            "is_stale",
            "status_message",
            "rating_status_message",
        ],
        "handlebarsTemplate": template,
        "include_time": False,
        "order_by_cols": [],
        "query_mode": "raw",
        "row_limit": 1,
        "styleTemplate": style,
        "time_range": "Current month",
        "viz_type": "handlebars",
    }


def _guide_chart_params() -> Asset:
    """Return the separate metric and data-contract guide configuration."""
    template = """<article>
  <h1>爆品指数说明文档</h1>
  {{#each data}}
    <p>
      <strong>数据状态：</strong>{{status_message}}；{{rating_status_message}}。
      数据更新至 {{global_data_through_date}}，所选范围 {{selected_start_date}}
      至 {{selected_end_date}}。
    </p>
  {{/each}}
  <h2>在售范围</h2>
  <p>
    月内出现销量的商品均进入判断；最终仅展示月销量与理论库存之和大于 10 的
    SKU。日表和月表必须对所选全部自然月同时完成发布，否则主看板不返回业务数据。
  </p>
  <h2>时间口径</h2>
  <p>
    年月筛选采用左闭右开范围。当前月按全局数据水位截断；在售 SPU 数和在售
    SKU 数取所选范围结束月份。
  </p>
  <h2>指标口径</h2>
  <ul>
    <li><strong>销量：</strong>所选期间销量合计。</li>
    <li><strong>日均销量：</strong>销量除以实际计算覆盖的自然日数。</li>
    <li><strong>销售额：</strong>所选期间美元销售额合计。</li>
    <li><strong>爆品指数：</strong>销量除以有记录的日期-SKU 组合数。</li>
    <li><strong>毛利润：</strong>所选期间美元毛利润合计。</li>
    <li><strong>毛利率：</strong>毛利润除以销售额。</li>
    <li><strong>退货率：</strong>退货数量除以销量。</li>
  </ul>
  <h2>产品等级</h2>
  <p>
    筛选字段使用 SKU 行级 <code>product_level</code>。两个漏斗使用目标月 SPU
    的上一个自然月销售等级，固定顺序为 Ps、S、A、B、C、-。
  </p>
  <h2>数据来源</h2>
  <p>
    <code>ads.ads_pdm_lx_hot_product_index_sku_d</code> 与
    <code>ads.ads_pdm_lx_hot_product_index_sku_m</code>。
  </p>
</article>"""
    style = """article {
  color: #172033;
  font-size: 14px;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 960px;
  padding: 16px 24px 40px;
}
article h1 { border-bottom: 2px solid #91b276; font-size: 26px; padding-bottom: 10px; }
article h2 { font-size: 18px; margin-top: 24px; }
article code { background: #f3f4f6; color: #9f1239; padding: 2px 5px; }
article li { margin: 4px 0; }"""
    return {
        "adhoc_filters": [],
        "all_columns": [
            "selected_start_date",
            "selected_end_date",
            "global_data_through_date",
            "coverage_complete",
            "rating_complete",
            "status_message",
            "rating_status_message",
        ],
        "handlebarsTemplate": template,
        "include_time": False,
        "order_by_cols": [],
        "query_mode": "raw",
        "row_limit": 1,
        "styleTemplate": style,
        "time_range": "Current month",
        "viz_type": "handlebars",
    }


def _charts() -> AssetBundle:
    """Build all KPI, funnel, status, and guide chart assets."""
    charts: AssetBundle = {}
    dataset_uuids = {
        "dataset_daily": UUIDS["dataset_daily"],
        "dataset_monthly": UUIDS["dataset_monthly"],
        "dataset_status": UUIDS["dataset_status"],
    }
    if len(KPI_DEFINITIONS) != len(KPI_UUID_KEYS):
        raise ValueError("every KPI definition must have a fixed chart UUID")
    for index, definition in enumerate(KPI_DEFINITIONS, start=1):
        uuid_key = KPI_UUID_KEYS[index - 1]
        name, dataset_key, metric, number_format = definition
        charts[f"charts/Hot_Product_Index_KPI_{index:02d}.yaml"] = _chart(
            slice_name=name,
            uuid=UUIDS[uuid_key],
            viz_type="big_number_total",
            dataset_uuid=dataset_uuids[dataset_key],
            params=_big_number_params(metric, number_format),
            description=f"爆品指数总览指标：{name}。",
        )

    charts["charts/Hot_Product_Index_Sales_Funnel.yaml"] = _chart(
        slice_name="SPU销售额漏斗",
        uuid=UUIDS["chart_funnel_sales_amount"],
        viz_type="funnel",
        dataset_uuid=UUIDS["dataset_daily"],
        params=_funnel_params(
            "sales_amount_usd_funnel",
            "$,.1f",
            label_value_divisor=10000,
            label_value_suffix="万",
        ),
        description="按上一个自然月SPU销售等级汇总所选期间美元销售额。",
    )
    charts["charts/Hot_Product_Index_SPU_Funnel.yaml"] = _chart(
        slice_name="SPU数漏斗",
        uuid=UUIDS["chart_funnel_spu_count"],
        viz_type="funnel",
        dataset_uuid=UUIDS["dataset_monthly"],
        params=_funnel_params("in_sale_spu_count_funnel", ",.0f"),
        description="按上一个自然月SPU销售等级统计结束月份的在售SPU数。",
    )
    charts["charts/Hot_Product_Index_Status.yaml"] = _chart(
        slice_name="爆品指数数据状态",
        uuid=UUIDS["chart_status"],
        viz_type="handlebars",
        dataset_uuid=UUIDS["dataset_status"],
        params=_status_chart_params(),
        description="主看板的数据水位与目标表连续性。",
    )
    charts["charts/Hot_Product_Index_Guide.yaml"] = _chart(
        slice_name="爆品指数说明",
        uuid=UUIDS["chart_guide"],
        viz_type="handlebars",
        dataset_uuid=UUIDS["dataset_status"],
        params=_guide_chart_params(),
        description="爆品指数指标、时间、在售范围和产品等级口径。",
    )
    return charts


def _chart_node(
    *,
    component_id: str,
    chart_id: int,
    chart_uuid: str,
    slice_name: str,
    row_id: str,
    width: float,
    height: int,
) -> Asset:
    """Build one dashboard position chart node."""
    return {
        "children": [],
        "id": component_id,
        "meta": {
            "chartId": chart_id,
            "height": height,
            "sliceName": slice_name,
            "uuid": chart_uuid,
            "width": width,
        },
        "parents": ["ROOT_ID", "GRID_ID", row_id],
        "type": "CHART",
    }


def _row(row_id: str, children: Sequence[str]) -> Asset:
    """Build one transparent dashboard row."""
    return {
        "children": list(children),
        "id": row_id,
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
        "type": "ROW",
    }


def _main_position() -> Asset:
    """Build the approved main layout: status, nine KPIs, and two funnels."""
    position: Asset = {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": [
                "ROW-DOC-LINK",
                "ROW-STATUS",
                "ROW-KPIS",
                "ROW-FUNNELS",
            ],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "拉杆箱在售产品爆品指数看板"},
            "type": "HEADER",
        },
        "ROOT_ID": {
            "children": ["GRID_ID"],
            "id": "ROOT_ID",
            "type": "ROOT",
        },
        "ROW-DOC-LINK": _row("ROW-DOC-LINK", ["MARKDOWN-DOC-LINK"]),
        "MARKDOWN-DOC-LINK": {
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
        },
        "ROW-STATUS": _row("ROW-STATUS", ["CHART-STATUS"]),
        "ROW-KPIS": _row("ROW-KPIS", KPI_COMPONENT_IDS),
        "ROW-FUNNELS": _row(
            "ROW-FUNNELS",
            ["CHART-FUNNEL-SALES-AMOUNT", "CHART-FUNNEL-SPU-COUNT"],
        ),
        "CHART-STATUS": _chart_node(
            component_id="CHART-STATUS",
            chart_id=STATUS_PLACEHOLDER_CHART_ID,
            chart_uuid=UUIDS["chart_status"],
            slice_name="爆品指数数据状态",
            row_id="ROW-STATUS",
            width=12,
            height=6,
        ),
        "CHART-FUNNEL-SALES-AMOUNT": _chart_node(
            component_id="CHART-FUNNEL-SALES-AMOUNT",
            chart_id=1010,
            chart_uuid=UUIDS["chart_funnel_sales_amount"],
            slice_name="SPU销售额漏斗",
            row_id="ROW-FUNNELS",
            width=6,
            height=48,
        ),
        "CHART-FUNNEL-SPU-COUNT": _chart_node(
            component_id="CHART-FUNNEL-SPU-COUNT",
            chart_id=1011,
            chart_uuid=UUIDS["chart_funnel_spu_count"],
            slice_name="SPU数漏斗",
            row_id="ROW-FUNNELS",
            width=6,
            height=48,
        ),
    }
    if not len(KPI_COMPONENT_IDS) == len(KPI_UUID_KEYS) == len(KPI_DEFINITIONS):
        raise ValueError("every KPI must have a component ID and chart UUID")
    for index, definition in enumerate(KPI_DEFINITIONS, start=1):
        component_id = KPI_COMPONENT_IDS[index - 1]
        uuid_key = KPI_UUID_KEYS[index - 1]
        position[component_id] = _chart_node(
            component_id=component_id,
            chart_id=1000 + index,
            chart_uuid=UUIDS[uuid_key],
            slice_name=definition[0],
            row_id="ROW-KPIS",
            width=12 / 9,
            height=18,
        )
    return position


def _guide_position() -> Asset:
    """Build the single-chart explanation dashboard layout."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": ["ROW-GUIDE"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "爆品指数说明文档"},
            "type": "HEADER",
        },
        "ROOT_ID": {
            "children": ["GRID_ID"],
            "id": "ROOT_ID",
            "type": "ROOT",
        },
        "ROW-GUIDE": _row("ROW-GUIDE", ["CHART-GUIDE"]),
        "CHART-GUIDE": _chart_node(
            component_id="CHART-GUIDE",
            chart_id=2001,
            chart_uuid=UUIDS["chart_guide"],
            slice_name="爆品指数说明",
            row_id="ROW-GUIDE",
            width=12,
            height=90,
        ),
    }


def _select_filter(
    *,
    name: str,
    column: str,
    business_chart_uuids: Sequence[str],
) -> Asset:
    """Build a multi-target select filter shared by daily and monthly charts."""
    return {
        "cascadeParentIds": [],
        "chartsInScope": list(business_chart_uuids),
        "controlValues": {
            "defaultToFirstItem": False,
            "enableEmptyFilter": False,
            "inverseSelection": False,
            "multiSelect": True,
            "searchAllOptions": True,
        },
        "description": "",
        "filterType": "filter_select",
        "id": f"NATIVE_FILTER-{column.replace('_', '-')}",
        "name": name,
        "requiredFirst": False,
        "scope": {
            "excluded": [STATUS_PLACEHOLDER_CHART_ID],
            "rootPath": ["ROOT_ID"],
        },
        "tabsInScope": [],
        "targets": [
            {
                "column": {"name": column},
                "datasetUuid": UUIDS["dataset_daily"],
            },
            {
                "column": {"name": column},
                "datasetUuid": UUIDS["dataset_monthly"],
            },
        ],
        "type": "NATIVE_FILTER",
    }


def _month_filter(main_chart_uuids: Sequence[str]) -> Asset:
    """Build the left-closed/right-open month-range filter."""
    return {
        "cascadeParentIds": [],
        "chartsInScope": list(main_chart_uuids),
        "controlValues": {
            "enableEmptyFilter": False,
            "monthSelectionMode": "range",
            "monthTimeZone": "Asia/Shanghai",
        },
        "defaultDataMask": {
            "extraFormData": {"time_range": "Current month"},
            "filterState": {"value": "Current month"},
            "ownState": {},
        },
        "description": "",
        "filterType": "filter_month_range",
        "granularity_sqla": "sales_date",
        "id": "NATIVE_FILTER-month-range",
        "name": "年月",
        "requiredFirst": False,
        "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        "tabsInScope": [],
        "targets": [
            {
                "column": {"name": "sales_date"},
                "datasetUuid": UUIDS["dataset_daily"],
            },
            {
                "column": {"name": "month_start_date"},
                "datasetUuid": UUIDS["dataset_monthly"],
            },
            {
                "column": {"name": "selected_start_date"},
                "datasetUuid": UUIDS["dataset_status"],
            },
        ],
        "type": "NATIVE_FILTER",
    }


def _main_metadata() -> Asset:
    """Build native filters and color semantics for the main dashboard."""
    business_chart_uuids = [
        *(UUIDS[key] for key in KPI_UUID_KEYS),
        UUIDS["chart_funnel_sales_amount"],
        UUIDS["chart_funnel_spu_count"],
    ]
    main_chart_uuids = [UUIDS["chart_status"], *business_chart_uuids]
    select_filters = {
        column: _select_filter(
            name=name,
            column=column,
            business_chart_uuids=business_chart_uuids,
        )
        for name, column in FILTERS
    }
    native_filters = [
        *(select_filters[column] for _, column in FILTERS[:8]),
        _month_filter(main_chart_uuids),
        *(select_filters[column] for _, column in FILTERS[8:]),
    ]
    return {
        "chart_configuration": {},
        "chart_customization_config": [],
        "color_scheme": "supersetColors",
        "color_scheme_domain": [],
        "cross_filters_enabled": False,
        "default_filters": "{}",
        "expanded_slices": {},
        "filter_bar_orientation": "HORIZONTAL",
        "filter_scopes": {},
        "global_chart_configuration": {
            "chartsInScope": main_chart_uuids,
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]},
        },
        "label_colors": {
            "-": "#9CA3AF",
            "A": "#92D050",
            "B": "#FFE600",
            "C": "#FFC000",
            "Ps": "#E84A5F",
            "S": "#1677C8",
        },
        "map_label_colors": {},
        "native_filter_configuration": native_filters,
        "refresh_frequency": 0,
        "shared_label_colors": ["Ps", "S", "A", "B", "C", "-"],
        "timed_refresh_immune_slices": [],
    }


def _dashboard(
    *,
    title: str,
    slug: str,
    uuid: str,
    description: str,
    css: str,
    position: Asset,
    metadata: Asset,
) -> Asset:
    """Build one published dashboard asset."""
    return {
        "certification_details": None,
        "certified_by": None,
        "css": css,
        "dashboard_title": title,
        "description": description,
        "metadata": metadata,
        "position": position,
        "published": True,
        "slug": slug,
        "theme_uuid": None,
        "uuid": uuid,
        "version": ASSET_VERSION,
    }


def _dashboards() -> AssetBundle:
    """Build the main dashboard and its separate explanation dashboard."""
    main_css = """.dashboard-header,
.dashboard-header-container {
  background: #91ad75;
  color: #ffffff;
  min-height: 58px;
}
.dashboard-header .editable-title,
.dashboard-header .editable-title input,
.dashboard-header-container .editable-title,
.dashboard-header-container .editable-title input {
  color: #ffffff;
  font-size: 25px;
  font-weight: 700;
  text-align: center;
}
.grid-row:has(#MARKDOWN-DOC-LINK) {
  height: 0 !important;
  margin: 0 !important;
  min-height: 0 !important;
  overflow: visible;
}
.dragdroppable-column:has(#MARKDOWN-DOC-LINK) {
  backface-visibility: visible;
  transform: none;
}
#MARKDOWN-DOC-LINK {
  background: transparent;
  border: 0;
  height: 34px !important;
  min-height: 34px !important;
  position: fixed;
  right: 24px;
  top: 12px;
  width: 114px !important;
  z-index: 100;
}
body:has(#main-menu) #MARKDOWN-DOC-LINK { top: 65px; }
#MARKDOWN-DOC-LINK .dashboard-component-chart-holder {
  align-items: center;
  background: transparent;
  border: 0;
  display: flex;
  justify-content: center;
  overflow: visible;
}
#MARKDOWN-DOC-LINK p { margin: 0; }
#MARKDOWN-DOC-LINK a {
  background: #ffffff;
  border-radius: 6px;
  color: #1677c8;
  display: inline-block;
  font-weight: 600;
  min-width: 114px;
  padding: 6px 14px;
  text-align: center;
  text-decoration: none;
}
#CHART-STATUS .chart-header,
[id^='CHART-KPI-'] .chart-header { display: none; }
#CHART-STATUS { border: 0; }
[id^='CHART-KPI-'] {
  background: #ffffff;
  border: 1px solid #d8dee8;
  border-radius: 6px;
}
[id^='CHART-KPI-'] .superset-legacy-chart-big-number,
[id^='CHART-KPI-'] .text-container {
  align-items: center;
  justify-content: center;
  text-align: center;
}
#CHART-FUNNEL-SALES-AMOUNT,
#CHART-FUNNEL-SPU-COUNT {
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
}"""
    guide_metadata = {
        "chart_configuration": {},
        "chart_customization_config": [],
        "color_scheme": "supersetColors",
        "cross_filters_enabled": False,
        "expanded_slices": {},
        "filter_bar_orientation": "HORIZONTAL",
        "global_chart_configuration": {
            "scope": {"excluded": [], "rootPath": ["ROOT_ID"]}
        },
        "label_colors": {},
        "map_label_colors": {},
        "native_filter_configuration": [],
        "refresh_frequency": 0,
        "shared_label_colors": [],
        "timed_refresh_immune_slices": [],
    }
    return {
        "dashboards/Hot_Product_Index.yaml": _dashboard(
            title="拉杆箱在售产品爆品指数看板",
            slug="hot-product-index",
            uuid=UUIDS["dashboard_main"],
            description="拉杆箱在售商品的销量、效益、在售规模和SPU等级结构总览。",
            css=main_css,
            position=_main_position(),
            metadata=_main_metadata(),
        ),
        "dashboards/Hot_Product_Index_Guide.yaml": _dashboard(
            title="爆品指数说明文档",
            slug="hot-product-index-guide",
            uuid=UUIDS["dashboard_guide"],
            description="爆品指数看板的数据、时间、指标和等级口径。",
            css="#CHART-GUIDE .chart-header { display: none; }",
            position=_guide_position(),
            metadata=guide_metadata,
        ),
    }


def build_assets(database_uuid: str = DEFAULT_DATABASE_UUID) -> AssetBundle:
    """Build and validate all JSON-as-YAML assets for a sparse assets import."""
    try:
        canonical_database_uuid = str(UUID(database_uuid))
    except ValueError as ex:
        raise ValueError("database_uuid must be a valid UUID") from ex

    assets: AssetBundle = {
        "metadata.yaml": {"type": "assets", "version": ASSET_VERSION},
        **_datasets(canonical_database_uuid),
        **_charts(),
        **_dashboards(),
    }
    validate_assets(assets, canonical_database_uuid)
    return assets


def _asset_family(assets: AssetBundle, prefix: str) -> list[Asset]:
    """Return all assets under a bundle prefix."""
    return [asset for path, asset in assets.items() if path.startswith(prefix)]


def validate_assets(  # noqa: C901
    assets: AssetBundle, database_uuid: str
) -> None:
    """Fail fast when cross-asset identities or the approved scope drift."""
    datasets = _asset_family(assets, "datasets/")
    charts = _asset_family(assets, "charts/")
    dashboards = _asset_family(assets, "dashboards/")
    if assets.get("metadata.yaml") != {"type": "assets", "version": ASSET_VERSION}:
        raise ValueError("metadata.yaml must declare an assets v1 bundle")
    if (len(datasets), len(charts), len(dashboards)) != (3, 13, 2):
        raise ValueError("bundle must contain 3 datasets, 13 charts, and 2 dashboards")

    identified_assets = [*datasets, *charts, *dashboards]
    asset_uuids = [str(asset["uuid"]) for asset in identified_assets]
    if len(asset_uuids) != len(set(asset_uuids)):
        raise ValueError("asset UUIDs must be unique")
    for asset_uuid in asset_uuids:
        UUID(asset_uuid)

    dataset_uuids = {str(dataset["uuid"]) for dataset in datasets}
    if any(dataset["database_uuid"] != database_uuid for dataset in datasets):
        raise ValueError("all datasets must reference the requested database UUID")
    if any(str(chart["dataset_uuid"]) not in dataset_uuids for chart in charts):
        raise ValueError("every chart dataset UUID must be included in the bundle")
    for chart in charts:
        try:
            query_context = json.loads(chart["query_context"])
        except (TypeError, json.JSONDecodeError) as ex:
            raise ValueError(
                "every chart must contain valid query context JSON"
            ) from ex
        if not query_context.get("queries"):
            raise ValueError("every chart query context must contain a query")
        if query_context.get("datasource") != {"id": 0, "type": "table"}:
            raise ValueError("chart query contexts must use the remappable datasource")

    chart_uuids = {str(chart["uuid"]) for chart in charts}
    for dashboard in dashboards:
        position_chart_uuids = {
            str(node["meta"]["uuid"])
            for node in dashboard["position"].values()
            if isinstance(node, dict) and node.get("type") == "CHART"
        }
        if not position_chart_uuids <= chart_uuids:
            raise ValueError("dashboard position references an unknown chart UUID")

    main = next(
        dashboard
        for dashboard in dashboards
        if dashboard["uuid"] == UUIDS["dashboard_main"]
    )
    main_chart_count = sum(
        isinstance(node, dict) and node.get("type") == "CHART"
        for node in main["position"].values()
    )
    if main_chart_count != 12:
        raise ValueError("main dashboard scope is status, nine KPIs, and two funnels")
    filters = main["metadata"]["native_filter_configuration"]
    if len(filters) != 13:
        raise ValueError("main dashboard must contain exactly 13 native filters")
    month_filters = [
        item for item in filters if item["filterType"] == "filter_month_range"
    ]
    if len(month_filters) != 1:
        raise ValueError("main dashboard must contain exactly one month-range filter")
    if month_filters[0]["defaultDataMask"]["filterState"]["value"] != "Current month":
        raise ValueError("month-range filter must default to Current month")


def _json_bytes(asset: Asset) -> bytes:
    """Serialize an asset as deterministic JSON, which is valid YAML."""
    return (
        json.dumps(asset, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    ).encode()


def write_bundle(output: Path, database_uuid: str = DEFAULT_DATABASE_UUID) -> Path:
    """Write a deterministic ZIP for ``POST /api/v1/assets/import/``."""
    assets = build_assets(database_uuid)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w") as bundle:
        for path in sorted(assets):
            info = ZipInfo(f"{BUNDLE_ROOT}/{path}", date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o644 << 16
            bundle.writestr(info, _json_bytes(assets[path]))
    return output


def main() -> int:
    """Generate the hot-product assets bundle from the command line."""
    parser = argparse.ArgumentParser(
        description="Generate the hot-product-index Superset assets bundle."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("hot_product_index_assets.zip"),
        help="Destination ZIP path.",
    )
    parser.add_argument(
        "--database-uuid",
        default=DEFAULT_DATABASE_UUID,
        help="UUID of the existing Doris database connection.",
    )
    args = parser.parse_args()
    print(write_bundle(args.output, args.database_uuid))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
