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
    "dataset_spu_detail": "de2f3527-4fb7-51df-a1ef-067567348ee6",
    "dataset_sku_detail": "baea3900-76bf-5de9-8f10-aad2cc5e4b60",
    "dataset_spu_leaderboard": "2b5c33b2-2af6-5436-8b3d-e7292e5a64ae",
    "chart_trend_day": "582d0460-8034-5a12-9f27-4de03b050cd4",
    "chart_trend_week": "d3504cb6-8abf-5d22-807b-326948e6b79b",
    "chart_trend_month": "8f36f17e-c95c-5076-9090-24652b22bb00",
    "chart_spu_share": "a5fc632c-e635-5cf0-8270-f9a1d135c664",
    "chart_sku_share": "7dbc534e-5c09-52e5-8dfa-0d42ddb44576",
    "chart_spu_leaderboard": "d35f4185-5103-5e75-85c7-2cfa7ae83731",
    "chart_color_trend_week": "90eed32b-5a2c-5cd5-8d6e-b38d98c720b8",
    "chart_color_trend_month": "267d5d23-3a69-5f8a-aca0-15b0020c9599",
    "chart_color_distribution": "e77069a0-1a40-583b-bae5-5ccba309c34b",
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
    "chart_spu_detail": "4454d29b-3161-5d51-9e7b-7c1a9e96db06",
    "chart_sku_detail": "76d38770-7b51-5f9e-b9df-d1b48113b8a3",
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
    ("score", "DECIMAL"),
    ("order_qty", "BIGINT"),
    ("sku_month_sales_qty", "BIGINT"),
    ("theoretical_stock_qty", "DECIMAL"),
    ("actual_stock_qty", "DECIMAL"),
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
    ("score", "DECIMAL"),
    ("order_qty", "BIGINT"),
    ("sku_month_sales_qty", "BIGINT"),
    ("theoretical_stock_qty", "DECIMAL"),
    ("actual_stock_qty", "DECIMAL"),
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

STATUS_DISPLAY_COLUMNS: Final[tuple[tuple[str, str], ...]] = (
    ("selected_start_ymd", "STRING"),
    ("selected_end_ymd", "STRING"),
    ("effective_end_ymd", "STRING"),
    ("global_data_through_ymd", "STRING"),
)

COLUMN_VERBOSE_NAMES: Final = {
    "sales_date": "销售日期",
    "week_start_date": "周一日期",
    "month_start_date": "月份开始日期",
    "sid": "店铺标识",
    "msku": "平台MSKU",
    "ym": "年月",
    "yw": "年周",
    "sku": "SKU",
    "spu": "SPU",
    "company_sku": "公司SKU",
    "channel": "渠道",
    "product_line": "品线",
    "country": "国家",
    "size": "尺寸",
    "color": "颜色",
    "color_code": "颜色代码",
    "developer": "开发经理",
    "model": "型号",
    "sku_level": "SKU等级",
    "product_level": "产品等级",
    "spu_previous_month_sales_amount_cny": "SPU上月销售额（人民币）",
    "spu_previous_month_sales_level": "SPU上月销售等级",
    "sales_qty": "销量",
    "sales_amount_usd": "销售额（美元）",
    "gross_profit_usd": "毛利润（美元）",
    "return_goods_qty": "退货数量",
    "score": "评分",
    "order_qty": "订单量",
    "sku_month_sales_qty": "SKU月销量",
    "theoretical_stock_qty": "理论库存",
    "actual_stock_qty": "实际库存",
    "eligibility_value": "销量与库存之和",
    "is_eligible": "是否在售",
    "is_generated_zero": "是否补零记录",
    "data_through_date": "数据水位日期",
    "source_updated_at": "源数据更新时间",
    "etl_batch_id": "ETL批次标识",
    "etl_loaded_at": "ETL加载时间",
    "selected_start_date": "筛选开始日期",
    "selected_end_date": "筛选结束日期",
    "selected_end_exclusive_date": "筛选结束日期（不含）",
    "effective_end_date": "实际计算结束日期",
    "effective_end_exclusive_date": "实际计算结束日期（不含）",
    "global_data_through_date": "全局数据水位日期",
    "selected_calendar_days": "实际计算自然日数",
    "expected_month_count": "应覆盖月份数",
    "daily_month_count": "日表已覆盖月份数",
    "monthly_month_count": "月表已覆盖月份数",
    "daily_missing_rating_count": "日表缺失评级记录数",
    "monthly_missing_rating_count": "月表缺失评级记录数",
    "coverage_complete": "数据覆盖是否完整",
    "rating_complete": "评级是否完整",
    "is_stale": "数据是否延迟",
    "selected_start_ymd": "筛选开始日期",
    "selected_end_ymd": "筛选结束日期",
    "effective_end_ymd": "实际计算结束日期",
    "global_data_through_ymd": "全局数据水位日期",
    "spu_previous_month_sales_level_sort": "SPU上月销售等级排序值",
    "status_message": "数据状态",
    "rating_status_message": "评级状态",
    "hot_product_index": "爆品指数",
    "watermark_month_start_date": "水位月份开始日期",
    "spu_rating": "SPU评级",
    "final_rating": "最终评级",
    "previous_month_sales_amount_usd": "上月销售额",
    "current_month_sales_amount_usd": "本月销量额",
    "rating_progress": "本月评级达标进度",
    "time_progress": "本月时间达标进度",
    "avg_daily_sales_qty": "日均销量",
    "gross_margin": "毛利率",
    "return_rate": "退货率",
    "avg_sales_qty_7d": "近7天日均销量",
    "avg_sales_qty_30d": "近30天日均销量",
    "avg_sales_qty_90d": "近90天日均销量",
}

DETAIL_REQUIRED_COLUMNS: Final[frozenset[str]] = frozenset(
    {"score", "order_qty", "actual_stock_qty"}
)

DETAIL_METRICS: Final[dict[str, str]] = {
    "hot_product_index": "AVG(hot_product_index)",
    "score": "AVG(score)",
    "sales_amount_usd": "SUM(sales_amount_usd)",
    "sales_qty": "SUM(sales_qty)",
    "avg_daily_sales_qty": "SUM(sales_qty) / NULLIF(SUM(effective_sku_days), 0)",
    "gross_profit_usd": "SUM(gross_profit_usd)",
    "gross_margin": "SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)",
    "return_goods_qty": "SUM(return_goods_qty)",
    "return_rate": "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)",
    "order_qty": "SUM(order_qty)",
    "avg_sales_qty_7d": "SUM(sales_qty_7d) / NULLIF(MAX(days_7d), 0)",
    "avg_sales_qty_30d": "SUM(sales_qty_30d) / NULLIF(MAX(days_30d), 0)",
    "avg_sales_qty_90d": "SUM(sales_qty_90d) / NULLIF(MAX(days_90d), 0)",
    "theoretical_stock_qty": "SUM(theoretical_stock_qty)",
    "actual_stock_qty": "SUM(actual_stock_qty)",
}

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
    ("日均销量", "dataset_daily", "avg_daily_sales_qty", ",.1~f"),
    ("销售额", "dataset_daily", "sales_amount_usd_total", "$,.0f"),
    ("在售SPU数", "dataset_monthly", "in_sale_spu_count", ",.0f"),
    ("爆品指数", "dataset_daily", "hot_product_index", ",.1~f"),
    ("在售SKU数", "dataset_monthly", "in_sale_sku_count", ",.0f"),
    ("毛利润", "dataset_daily", "gross_profit_usd_total", "$,.1~f"),
    ("毛利率", "dataset_daily", "gross_margin", ".1~%"),
    ("退货率", "dataset_daily", "return_rate", ".1~%"),
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

TREND_PRIMARY_METRICS: Final[tuple[str, ...]] = (
    "hot_product_index",
    "sales_qty_total",
    "avg_daily_sales_qty_period",
    "return_goods_qty_total",
    "order_qty_total",
    "in_sale_sku_count_period",
    "in_sale_spu_count_period",
    "return_rate",
    "gross_margin",
)

TREND_SECONDARY_METRICS: Final[tuple[str, ...]] = (
    "sales_amount_usd_wan",
    "gross_profit_usd_wan",
)


def _dataset_column(
    name: str,
    type_: str,
    *,
    is_dttm: bool = False,
    expression: str | None = None,
    description: str | None = None,
    display_name: str | None = None,
    filterable: bool = True,
    groupby: bool = True,
) -> Asset:
    """Build one importable dataset column definition."""
    try:
        verbose_name = COLUMN_VERBOSE_NAMES[name]
    except KeyError as ex:
        raise ValueError(f"missing Chinese column label: {name}") from ex
    return {
        "advanced_data_type": None,
        "column_name": name,
        "datetime_format": None,
        "description": description,
        "expression": expression,
        "extra": None,
        "filterable": filterable,
        "groupby": groupby,
        "is_active": True,
        "is_dttm": is_dttm,
        "python_date_format": None,
        "type": type_,
        "verbose_name": display_name or verbose_name,
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
    w.global_data_through_date,
    LEAST(
      CAST({{ time_filter.to_expr }} AS DATE),
      DATE_ADD(w.global_data_through_date, INTERVAL 1 DAY)
    ) AS effective_end_exclusive_date
  FROM watermark w
),
daily_quality AS (
  SELECT
    COUNT(DISTINCT d.ym) AS daily_month_count,
    COUNT(DISTINCT d.sales_date) AS daily_calendar_day_count,
    COALESCE(SUM(
      CASE
        WHEN d.is_eligible = 1
          AND d.spu_previous_month_sales_level IS NULL
        THEN 1
        ELSE 0
      END
    ), 0) AS daily_missing_rating_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN bounds b
  WHERE d.ym >= DATE_FORMAT(b.selected_start_date, '%Y-%m')
    AND d.ym < DATE_FORMAT(b.selected_end_exclusive_date, '%Y-%m')
    AND d.sales_date >= b.selected_start_date
    AND d.sales_date < b.effective_end_exclusive_date
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
    TIMESTAMPDIFF(MONTH, b.selected_start_date, b.selected_end_exclusive_date)
      AS expected_month_count,
    DATEDIFF(
      b.effective_end_exclusive_date,
      b.selected_start_date
    ) AS expected_daily_day_count,
    d.daily_month_count,
    d.daily_calendar_day_count,
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
        AND daily_calendar_day_count = expected_daily_day_count
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
    selected.extend(
        (
            "DATE_SUB(d.sales_date, INTERVAL WEEKDAY(d.sales_date) DAY) "
            "AS week_start_date",
            "DATE_FORMAT(d.sales_date, '%xW%v') AS yw",
            "NULLIF(TRIM(SUBSTRING_INDEX(d.color, '-', -1)), '') AS color_code",
        )
    )
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
  DATE_FORMAT(selected_start_date, '%Y-%m-%d') AS selected_start_ymd,
  DATE_FORMAT(selected_end_date, '%Y-%m-%d') AS selected_end_ymd,
  DATE_FORMAT(effective_end_date, '%Y-%m-%d') AS effective_end_ymd,
  DATE_FORMAT(global_data_through_date, '%Y-%m-%d') AS global_data_through_ymd,
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


def _validate_detail_source_columns() -> None:
    """Fail before asset generation when either accepted ADS table is incomplete."""
    daily_columns = {name for name, _ in DAILY_SOURCE_COLUMNS}
    monthly_columns = {name for name, _ in MONTHLY_SOURCE_COLUMNS}
    missing_columns = (DETAIL_REQUIRED_COLUMNS - daily_columns) | (
        DETAIL_REQUIRED_COLUMNS - monthly_columns
    )
    if missing_columns:
        raise ValueError(
            "hot-product detail datasets require ADS columns: "
            + ", ".join(sorted(missing_columns))
        )


def _native_filter_fragment(
    alias: str,
    columns: Sequence[str] | None = None,
) -> str:
    """Render fail-fast IN/NOT IN predicates consumed inside virtual SQL."""
    filter_columns = columns or tuple(name for _, name in FILTERS)
    fragments: list[str] = []
    for column in filter_columns:
        fragments.append(
            "\n".join(
                (
                    "{% for filter in get_filters("
                    f"'{column}', remove_filter=True) %}}",
                    "  {% if filter.get('op') == 'IN' %}",
                    f"    AND {alias}.{column} IN "
                    "{{ filter.get('val') | where_in }}",
                    "  {% elif filter.get('op') == 'NOT IN' %}",
                    f"    AND {alias}.{column} NOT IN "
                    "{{ filter.get('val') | where_in }}",
                    "  {% else %}",
                    "    {{ raise('Unsupported "
                    + column
                    + " filter operator: ' ~ filter.get('op')) }}",
                    "  {% endif %}",
                    "{% endfor %}",
                )
            )
        )
    return "\n".join(fragments)


def _leaderboard_sql() -> str:
    """Build the watermark-anchored SPU leaderboard query."""
    current_filter_sql = _native_filter_fragment("m")
    previous_filter_sql = _native_filter_fragment("m")
    return f"""WITH watermark AS (
  SELECT MAX(data_through_date) AS data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
),
anchor AS (
  SELECT data_through_date,
         DATE_TRUNC(data_through_date, 'month') AS watermark_month_start_date,
         DATE_FORMAT(data_through_date, '%Y-%m') AS current_ym,
         DATE_FORMAT(
           DATE_SUB(
             DATE_TRUNC(data_through_date, 'month'), INTERVAL 1 MONTH
           ), '%Y-%m'
         ) AS previous_ym
  FROM watermark
),
daily_quality AS (
  SELECT
    COUNT(DISTINCT CASE WHEN d.ym = a.current_ym THEN d.sales_date END) AS current_days,
    COUNT(DISTINCT CASE
      WHEN d.ym = a.previous_ym THEN d.sales_date
    END) AS previous_days
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d CROSS JOIN anchor a
  WHERE d.ym IN (a.current_ym, a.previous_ym)
),
monthly_quality AS (
  SELECT COUNT(DISTINCT m.ym) AS monthly_months
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m CROSS JOIN anchor a
  WHERE m.ym IN (a.current_ym, a.previous_ym)
),
quality AS (
  SELECT a.*,
    CASE WHEN q.current_days = DAY(a.data_through_date)
      AND q.previous_days = DAY(LAST_DAY(DATE_SUB(
        a.watermark_month_start_date, INTERVAL 1 MONTH
      )))
      AND m.monthly_months = 2 THEN 1 ELSE 0 END AS coverage_complete
  FROM anchor a CROSS JOIN daily_quality q CROSS JOIN monthly_quality m
),
current_filtered AS (
  SELECT m.*
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN quality q
  WHERE q.coverage_complete = 1
    AND m.ym = q.current_ym
    AND m.is_eligible = 1
{current_filter_sql}
),
previous_filtered AS (
  SELECT m.*
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN quality q
  WHERE q.coverage_complete = 1
    AND m.ym = q.previous_ym
    AND m.is_eligible = 1
{previous_filter_sql}
),
current_rows AS (
  SELECT m.spu,
         m.spu_previous_month_sales_level AS spu_rating,
         m.sku_level AS final_rating,
         SUM(m.sales_amount_usd) AS current_month_sales_amount_usd
  FROM current_filtered m
  GROUP BY m.spu, m.spu_previous_month_sales_level, m.sku_level
),
previous_rows AS (
  SELECT m.spu, SUM(m.sales_amount_usd) AS previous_month_sales_amount_usd
  FROM previous_filtered m GROUP BY m.spu
)
SELECT
  q.watermark_month_start_date,
  q.current_ym AS ym,
  c.spu,
  c.spu_rating,
  c.final_rating,
  p.previous_month_sales_amount_usd,
  c.current_month_sales_amount_usd,
  c.current_month_sales_amount_usd /
    NULLIF(p.previous_month_sales_amount_usd, 0) AS rating_progress,
  (c.current_month_sales_amount_usd /
    NULLIF(p.previous_month_sales_amount_usd, 0)) /
    NULLIF(DAY(q.data_through_date) / DAY(LAST_DAY(q.data_through_date)), 0)
    AS time_progress,
  q.coverage_complete
FROM current_rows c
LEFT JOIN previous_rows p ON c.spu <=> p.spu
CROSS JOIN quality q
WHERE q.coverage_complete = 1
"""


def _detail_sql(*, grain: str) -> str:
    """Build one month-range leaf query for the SPU or SKU detail table."""
    dimensions: tuple[str, ...]
    if grain == "spu":
        dimensions = (
            "ym",
            "spu",
            "spu_previous_month_sales_level",
            "sku_level",
        )
    elif grain == "sku":
        dimensions = ("ym", "company_sku", "sku", "product_level", "size", "color")
    else:
        raise ValueError(f"unsupported hot-product detail grain: {grain}")

    dimension_list = ", ".join(dimensions)
    dimension_select = ",\n      ".join(dimensions)
    stock_dimension_join = " AND ".join(
        f"a.{column} <=> stock_leaf.{column}" for column in dimensions
    )
    rolling_dimension_join = " AND ".join(
        f"a.{column} <=> r.{column}" for column in dimensions
    )
    stock_dimensions = dimensions if "sku" in dimensions else (*dimensions, "sku")
    stock_leaf_dimensions = ", ".join(
        f"p.{column} AS {column}" for column in dimensions
    )
    stock_leaf_group_dimensions = ", ".join(f"p.{column}" for column in dimensions)
    stock_group_dimensions = ", ".join(stock_dimensions)
    filter_sql = _native_filter_fragment("d")
    return f"""{{% set time_filter = get_time_filter(
  "sales_date", default="Current month", target_type="DATE",
  remove_filter=True
) %}}
WITH selected_bounds AS (
  SELECT
    CAST({{{{ time_filter.from_expr }}}} AS DATE) AS selected_start_date,
    CAST({{{{ time_filter.to_expr }}}} AS DATE) AS selected_end_exclusive_date,
    w.global_data_through_date,
    LEAST(
      CAST({{{{ time_filter.to_expr }}}} AS DATE),
      DATE_ADD(w.global_data_through_date, INTERVAL 1 DAY)
    ) AS effective_end_exclusive_date,
    TIMESTAMPDIFF(MONTH, {{{{ time_filter.from_expr }}}},
      {{{{ time_filter.to_expr }}}}) AS expected_month_count
  FROM (
    SELECT MAX(data_through_date) AS global_data_through_date
    FROM ads.ads_pdm_lx_hot_product_index_sku_d
  ) w
),
lookback_quality AS (
  SELECT
    COUNT(DISTINCT d.sales_date) AS lookback_calendar_day_count,
    MAX(DATEDIFF(
      b.effective_end_exclusive_date,
      DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)
    )) AS expected_lookback_day_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_bounds b
  WHERE d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)
    AND d.sales_date < b.effective_end_exclusive_date
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
  CROSS JOIN selected_bounds b
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
  CROSS JOIN selected_bounds b
  WHERE m.ym >= DATE_FORMAT(b.selected_start_date, '%Y-%m')
    AND m.ym < DATE_FORMAT(b.selected_end_exclusive_date, '%Y-%m')
),
quality AS (
  SELECT
    b.*,
    DATE_SUB(b.selected_end_exclusive_date, INTERVAL 1 DAY) AS selected_end_date,
    DATE_SUB(b.effective_end_exclusive_date, INTERVAL 1 DAY) AS effective_end_date,
    d.daily_month_count,
    m.monthly_month_count,
    d.daily_missing_rating_count,
    m.monthly_missing_rating_count,
    l.lookback_calendar_day_count,
    l.expected_lookback_day_count,
    CASE
      WHEN b.expected_month_count > 0
        AND DAY(b.selected_start_date) = 1
        AND DAY(b.selected_end_exclusive_date) = 1
        AND d.daily_month_count = expected_month_count
        AND m.monthly_month_count = expected_month_count
        AND b.effective_end_exclusive_date > b.selected_start_date
      THEN 1
      ELSE 0
    END AS coverage_complete,
    CASE
      WHEN d.daily_missing_rating_count = 0
        AND m.monthly_missing_rating_count = 0
      THEN 1
      ELSE 0
    END AS rating_complete,
    CASE
      WHEN l.lookback_calendar_day_count = l.expected_lookback_day_count
      THEN 1
      ELSE 0
    END AS lookback_complete,
    CASE
      WHEN b.global_data_through_date IS NULL
        OR b.global_data_through_date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      THEN 1
      ELSE 0
    END AS is_stale
  FROM selected_bounds b
  CROSS JOIN lookback_quality l
  CROSS JOIN daily_quality d
  CROSS JOIN monthly_quality m
),
filtered_daily AS (
  SELECT d.*
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN quality b
  WHERE b.coverage_complete = 1
    AND b.lookback_complete = 1
    AND d.is_eligible = 1
    AND d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)
    AND d.sales_date < b.effective_end_exclusive_date
{filter_sql}
),
selected_period AS (
  SELECT p.*
  FROM filtered_daily p
  CROSS JOIN quality b
  WHERE p.sales_date >= b.selected_start_date
    AND p.sales_date < b.effective_end_exclusive_date
),
leaf_additive AS (
  SELECT
      {dimension_select},
      AVG(score) AS score,
      SUM(sales_amount_usd) AS sales_amount_usd,
      SUM(sales_qty) AS sales_qty,
      COUNT(DISTINCT sales_date, sku) AS effective_sku_days,
      SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)
        AS hot_product_index,
      SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date, sku), 0)
        AS avg_daily_sales_qty,
      SUM(gross_profit_usd) AS gross_profit_usd,
      SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)
        AS gross_margin,
      SUM(return_goods_qty) AS return_goods_qty,
      SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0) AS return_rate,
      SUM(order_qty) AS order_qty
  FROM selected_period
  GROUP BY {dimension_list}
),
rolling AS (
  SELECT
      {dimension_select},
      SUM(CASE
        WHEN d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 7 DAY)
        THEN d.sales_qty ELSE 0 END) AS sales_qty_7d,
      SUM(CASE
        WHEN d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 30 DAY)
        THEN d.sales_qty ELSE 0 END) AS sales_qty_30d,
      SUM(CASE
        WHEN d.sales_date >= DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)
        THEN d.sales_qty ELSE 0 END) AS sales_qty_90d,
      MAX(DATEDIFF(
        b.effective_end_exclusive_date,
        DATE_SUB(b.effective_end_exclusive_date, INTERVAL 7 DAY)
      )) AS days_7d,
      MAX(DATEDIFF(
        b.effective_end_exclusive_date,
        DATE_SUB(b.effective_end_exclusive_date, INTERVAL 30 DAY)
      )) AS days_30d,
      MAX(DATEDIFF(
        b.effective_end_exclusive_date,
        DATE_SUB(b.effective_end_exclusive_date, INTERVAL 90 DAY)
      )) AS days_90d
  FROM filtered_daily d
  CROSS JOIN quality b
  GROUP BY {dimension_list}, b.effective_end_exclusive_date
),
stock_by_sku AS (
  SELECT
    ym,
    sku,
    MAX(theoretical_stock_qty) AS theoretical_stock_qty,
    MAX(actual_stock_qty) AS actual_stock_qty
  FROM selected_period
  GROUP BY ym, sku
),
leaf_rows AS (
  SELECT
      a.*,
      r.sales_qty_7d,
      r.sales_qty_30d,
      r.sales_qty_90d,
      r.days_7d,
      r.days_30d,
      r.days_90d,
      stock_leaf.theoretical_stock_qty,
      stock_leaf.actual_stock_qty,
      b.coverage_complete,
      b.lookback_complete
  FROM leaf_additive a
  LEFT JOIN rolling r
    ON {rolling_dimension_join}
  LEFT JOIN (
    SELECT
      {stock_leaf_dimensions},
      SUM(stock_by_sku.theoretical_stock_qty) AS theoretical_stock_qty,
      SUM(stock_by_sku.actual_stock_qty) AS actual_stock_qty
    FROM (
      SELECT DISTINCT {stock_group_dimensions}
      FROM selected_period
    ) p
    LEFT JOIN stock_by_sku
      ON p.ym <=> stock_by_sku.ym
      AND p.sku <=> stock_by_sku.sku
    GROUP BY {stock_leaf_group_dimensions}
  ) stock_leaf
    ON {stock_dimension_join}
  CROSS JOIN quality b
)
SELECT
    {dimension_select},
    hot_product_index,
    score,
    sales_amount_usd,
    sales_qty,
    avg_daily_sales_qty,
    gross_profit_usd,
    gross_margin,
    return_goods_qty,
    return_rate,
    order_qty,
    sales_qty_7d,
    sales_qty_7d / NULLIF(days_7d, 0) AS avg_sales_qty_7d,
    sales_qty_30d,
    sales_qty_30d / NULLIF(days_30d, 0) AS avg_sales_qty_30d,
    sales_qty_90d,
    sales_qty_90d / NULLIF(days_90d, 0) AS avg_sales_qty_90d,
    effective_sku_days,
    days_7d,
    days_30d,
    days_90d,
    theoretical_stock_qty,
    actual_stock_qty,
    CAST(CONCAT(ym, '-01') AS DATE) AS month_start_date,
    coverage_complete,
    lookback_complete
FROM leaf_rows
WHERE coverage_complete = 1
  AND lookback_complete = 1
"""


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


DETAIL_LABELS: Final[dict[str, str]] = {
    "spu": "SPU",
    "company_sku": "公司SKU",
    "sku": "SKU",
    "ym": "年月",
    "spu_previous_month_sales_level": "SPU评级",
    "sku_level": "最终评级",
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

DETAIL_DISPLAYED_COLUMNS: Final[dict[str, tuple[str, ...]]] = {
    "spu": (
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
    ),
    "sku": (
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
    ),
}

DETAIL_COLUMN_TYPES: Final[dict[str, str]] = {
    "spu": "STRING",
    "company_sku": "STRING",
    "sku": "STRING",
    "ym": "STRING",
    "spu_previous_month_sales_level": "STRING",
    "sku_level": "STRING",
    "product_level": "STRING",
    "size": "STRING",
    "color": "STRING",
    "hot_product_index": "DECIMAL",
    "score": "DECIMAL",
    "sales_amount_usd": "DECIMAL",
    "sales_qty": "BIGINT",
    "avg_daily_sales_qty": "DECIMAL",
    "gross_profit_usd": "DECIMAL",
    "gross_margin": "DECIMAL",
    "return_goods_qty": "BIGINT",
    "return_rate": "DECIMAL",
    "order_qty": "BIGINT",
    "avg_sales_qty_7d": "DECIMAL",
    "avg_sales_qty_30d": "DECIMAL",
    "avg_sales_qty_90d": "DECIMAL",
    "theoretical_stock_qty": "DECIMAL",
    "actual_stock_qty": "DECIMAL",
}


def _leaderboard_columns() -> list[Asset]:
    """Build the SPU leaderboard output and native-filter column contract."""
    output_columns: tuple[tuple[str, str, bool], ...] = (
        ("watermark_month_start_date", "DATE", True),
        ("ym", "STRING", False),
        ("spu", "STRING", False),
        ("spu_rating", "STRING", False),
        ("final_rating", "STRING", False),
        ("previous_month_sales_amount_usd", "DECIMAL", False),
        ("current_month_sales_amount_usd", "DECIMAL", False),
        ("rating_progress", "DECIMAL", False),
        ("time_progress", "DECIMAL", False),
        ("coverage_complete", "TINYINT", False),
    )
    columns = [
        _dataset_column(name, type_, is_dttm=is_dttm)
        for name, type_, is_dttm in output_columns
    ]
    visible_names = {name for name, _, _ in output_columns}
    source_types = dict(MONTHLY_SOURCE_COLUMNS)
    for _, filter_column in FILTERS:
        if filter_column in visible_names:
            continue
        columns.append(
            _dataset_column(
                filter_column,
                source_types[filter_column],
                description="仅作为原生筛选目标，不参与排行榜展示或聚合。",
                groupby=False,
            )
        )
    return columns


def _leaderboard_metrics() -> Sequence[Asset]:
    """Build saved metrics that aggregate one SPU leaderboard row."""
    return (
        _metric(
            "previous_month_sales_amount_usd",
            "上月销售额",
            "MAX(previous_month_sales_amount_usd)",
            "$,.1~f",
            "上一完整月美元销售额。",
        ),
        _metric(
            "current_month_sales_amount_usd",
            "本月销量额",
            "MAX(current_month_sales_amount_usd)",
            "$,.1~f",
            "水位月MTD美元销售额。",
        ),
        _metric(
            "rating_progress",
            "本月评级达标进度",
            "MAX(rating_progress)",
            ".1~%",
            "本月销售额除以上月销售额。",
        ),
        _metric(
            "time_progress",
            "本月时间达标进度",
            "MAX(time_progress)",
            ".1~%",
            "评级进度除以水位月时间进度。",
        ),
    )


def _detail_columns(grain: str) -> list[Asset]:
    """Build the exact visible column contract for one detail dataset."""
    try:
        names = DETAIL_DISPLAYED_COLUMNS[grain]
    except KeyError as ex:
        raise ValueError(f"unsupported hot-product detail grain: {grain}") from ex
    columns = [
        _dataset_column(
            name,
            DETAIL_COLUMN_TYPES[name],
            display_name=DETAIL_LABELS[name],
        )
        for name in names
    ]
    columns.append(
        _dataset_column(
            "month_start_date",
            "DATE",
            is_dttm=True,
            description="由年月字段推导的月份起始日期，仅用于月份筛选。",
        )
    )
    visible_names = {*names, "month_start_date"}
    source_types = dict(DAILY_SOURCE_COLUMNS)
    for _, filter_column in FILTERS:
        if filter_column in visible_names:
            continue
        columns.append(
            _dataset_column(
                filter_column,
                source_types[filter_column],
                description="仅作为原生筛选目标，不参与明细表展示或聚合。",
                groupby=False,
            )
        )
    return columns


def _detail_metrics(*, include_stock: bool) -> tuple[Asset, ...]:
    """Build metrics that aggregate already unique leaf rows."""
    labels = DETAIL_LABELS
    formats = {
        "hot_product_index": ",.1~f",
        "score": ",.1~f",
        "sales_amount_usd": "$,.1~f",
        "sales_qty": ",.0f",
        "avg_daily_sales_qty": ",.1~f",
        "gross_profit_usd": "$,.1~f",
        "gross_margin": ".1~%",
        "return_goods_qty": ",.0f",
        "return_rate": ".1~%",
        "order_qty": ",.0f",
        "avg_sales_qty_7d": ",.1~f",
        "avg_sales_qty_30d": ",.1~f",
        "avg_sales_qty_90d": ",.1~f",
        "theoretical_stock_qty": ",.1~f",
        "actual_stock_qty": ",.1~f",
    }
    metric_names = list(DETAIL_METRICS)
    if not include_stock:
        metric_names = [
            name
            for name in metric_names
            if name not in {"theoretical_stock_qty", "actual_stock_qty"}
        ]
    return tuple(
        _metric(
            name,
            labels[name],
            DETAIL_METRICS[name],
            formats[name],
            f"爆品指数明细指标：{labels[name]}。",
        )
        for name in metric_names
    )


DETAIL_NUMERIC_COLUMNS: Final[frozenset[str]] = frozenset(
    {
        "hot_product_index",
        "score",
        "sales_amount_usd",
        "sales_qty",
        "avg_daily_sales_qty",
        "gross_profit_usd",
        "return_goods_qty",
        "order_qty",
        "avg_sales_qty_7d",
        "avg_sales_qty_30d",
        "avg_sales_qty_90d",
        "theoretical_stock_qty",
        "actual_stock_qty",
    }
)
DETAIL_RATE_COLUMNS: Final[frozenset[str]] = frozenset({"gross_margin", "return_rate"})
DETAIL_MONEY_COLUMNS: Final[frozenset[str]] = frozenset(
    {"sales_amount_usd", "gross_profit_usd"}
)
DETAIL_IDENTIFIER_COLUMNS: Final[dict[str, tuple[str, ...]]] = {
    "spu": ("spu", "ym", "spu_previous_month_sales_level", "sku_level"),
    "sku": ("company_sku", "sku"),
}
DETAIL_GROUPBY: Final[dict[str, tuple[str, ...]]] = {
    "spu": ("spu", "ym", "spu_previous_month_sales_level", "sku_level"),
    "sku": ("company_sku", "sku", "ym", "product_level", "size", "color"),
}
DETAIL_SORT: Final[dict[str, tuple[tuple[str, bool], ...]]] = {
    "spu": (("ym", False), ("sales_qty", False), ("spu", True)),
    "sku": (("ym", False), ("sales_qty", False), ("company_sku", True)),
}


def _detail_column_config(grain: str) -> Asset:
    """Build fixed widths, alignment, formats, and pinned detail columns."""
    try:
        names = DETAIL_DISPLAYED_COLUMNS[grain]
        dimensions = set(DETAIL_GROUPBY[grain])
        pinned_columns = set(DETAIL_IDENTIFIER_COLUMNS[grain])
    except KeyError as ex:
        raise ValueError(f"unsupported hot-product detail grain: {grain}") from ex

    config: Asset = {}
    dimension_width = 112 if grain == "spu" else 120
    metric_width = 104 if grain == "spu" else 112
    for name in names:
        column_config: Asset = {
            "columnWidth": dimension_width if name in dimensions else metric_width,
            "horizontalAlign": "left" if name in dimensions else "right",
            "nullValue": "-",
            "truncateLongCells": True,
        }
        if name in DETAIL_NUMERIC_COLUMNS:
            column_config["d3NumberFormat"] = ",.1~f"
        if name in DETAIL_RATE_COLUMNS:
            column_config["d3NumberFormat"] = ".1~%"
        if name in DETAIL_MONEY_COLUMNS:
            column_config["currencyFormat"] = {
                "symbol": "USD",
                "symbolPosition": "prefix",
            }
        if name in pinned_columns:
            column_config["pinned"] = "left"
        config[name] = column_config
    return config


def _detail_conditional_formatting() -> list[Asset]:
    """Return the four fixed solid fills for the hot-product index."""
    return [
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


def _detail_chart_params(grain: str) -> Asset:
    """Build one stable AG Grid detail chart form-data contract."""
    try:
        groupby = list(DETAIL_GROUPBY[grain])
        metric_names = list(DETAIL_METRICS)
        if grain == "spu":
            metric_names = [
                name
                for name in metric_names
                if name not in {"theoretical_stock_qty", "actual_stock_qty"}
            ]
        displayed_columns = list(DETAIL_DISPLAYED_COLUMNS[grain])
        orderby = [list(item) for item in DETAIL_SORT[grain]]
    except KeyError as ex:
        raise ValueError(f"unsupported hot-product detail grain: {grain}") from ex

    return {
        "adhoc_filters": [],
        "allow_rearrange_columns": True,
        "advanced_filter_enabled": False,
        "column_config": _detail_column_config(grain),
        "column_view_schemes_enabled": False,
        "conditional_formatting": _detail_conditional_formatting(),
        "displayed_columns": displayed_columns,
        "emit_filter": False,
        "groupby": groupby,
        "include_search": False,
        "metrics": metric_names,
        "order_desc": False,
        "orderby": orderby,
        "query_mode": "aggregate",
        "row_hierarchy_fields": groupby if grain == "spu" else [],
        "row_limit": 100000,
        "server_pagination_default_orderby": orderby,
        "server_page_length": 50,
        "server_pagination": True,
        "show_totals": True,
        "time_range": "Current month",
        "viz_type": "ag-grid-table-scheme",
    }


def _datasets(database_uuid: str) -> AssetBundle:
    """Build the existing semantic datasets and the two detail datasets."""
    _validate_detail_source_columns()
    common_business_columns = [
        _dataset_column(name, type_, is_dttm=type_ in {"DATE", "DATETIME"})
        for name, type_ in COVERAGE_COLUMNS
    ]
    daily_columns = [
        _dataset_column(name, type_, is_dttm=type_ in {"DATE", "DATETIME"})
        for name, type_ in DAILY_SOURCE_COLUMNS
    ]
    daily_columns.extend(
        [
            _dataset_column("week_start_date", "DATE", is_dttm=True),
            _dataset_column("yw", "STRING"),
            _dataset_column("color_code", "STRING"),
            _dataset_column(
                "spu_previous_month_sales_level_sort",
                "BIGINT",
                description="固定产品等级顺序：Ps、S、A、B、C、-。",
            ),
            *common_business_columns,
        ]
    )
    monthly_columns = [
        _dataset_column(name, type_, is_dttm=type_ in {"DATE", "DATETIME"})
        for name, type_ in MONTHLY_SOURCE_COLUMNS
    ]
    monthly_columns.extend(
        [
            _dataset_column(
                "spu_previous_month_sales_level_sort",
                "BIGINT",
                description="固定产品等级顺序：Ps、S、A、B、C、-。",
            ),
            *common_business_columns,
        ]
    )
    status_columns = [
        *common_business_columns,
        *(_dataset_column(name, type_) for name, type_ in STATUS_DISPLAY_COLUMNS),
        _dataset_column("status_message", "STRING"),
        _dataset_column("rating_status_message", "STRING"),
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
            ",.1~f",
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
            "SUM(sales_qty) / NULLIF("
            "COUNT(DISTINCT CONCAT("
            "DATE_FORMAT(sales_date, '%Y-%m-%d'), '#', HEX(sku))), 0)",
            ",.1~f",
            "销量除以有记录的日期-SKU组合数（按日期和SKU的可逆编码精确去重）。",
        ),
        _metric(
            "gross_profit_usd_total",
            "毛利润",
            "SUM(gross_profit_usd)",
            "$,.1~f",
            "所选期间毛利润，币种为美元。",
        ),
        _metric(
            "gross_margin",
            "毛利率",
            "SUM(gross_profit_usd) / NULLIF(SUM(sales_amount_usd), 0)",
            ".1~%",
            "毛利润除以销售额。",
        ),
        _metric(
            "return_rate",
            "退货率",
            "SUM(return_goods_qty) / NULLIF(SUM(sales_qty), 0)",
            ".1~%",
            "退货数量除以销量。",
        ),
        _metric(
            "spu_previous_month_sales_level_sort_metric",
            "产品等级排序",
            "MIN(spu_previous_month_sales_level_sort)",
            ",.0f",
            "用于按 Ps、S、A、B、C、- 固定顺序排列漏斗。",
        ),
        _metric(
            "avg_daily_sales_qty_period",
            "日均销量",
            "SUM(sales_qty) / NULLIF(COUNT(DISTINCT sales_date), 0)",
            ",.1~f",
            "时间桶销量除以时间桶内有效自然日数。",
        ),
        _metric(
            "return_goods_qty_total",
            "退货量",
            "SUM(return_goods_qty)",
            ",.0f",
            "时间桶内退货数量。",
        ),
        _metric(
            "order_qty_total",
            "订单量",
            "SUM(order_qty)",
            ",.0f",
            "时间桶内订单数量。",
        ),
        _metric(
            "in_sale_sku_count_period",
            "在售SKU数",
            "COUNT(DISTINCT sku)",
            ",.0f",
            "时间桶内满足资格的SKU去重数。",
        ),
        _metric(
            "in_sale_spu_count_period",
            "在售SPU数",
            "COUNT(DISTINCT spu)",
            ",.0f",
            "时间桶内满足资格的SPU去重数。",
        ),
        _metric(
            "sales_amount_usd_wan",
            "销售额",
            "SUM(sales_amount_usd) / 10000.0",
            ",.1~f",
            "美元销售额按万美元显示，底层事实不降精度。",
        ),
        _metric(
            "gross_profit_usd_wan",
            "毛利润",
            "SUM(gross_profit_usd) / 10000.0",
            ",.1~f",
            "美元毛利润按万美元显示，底层事实不降精度。",
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

    datasets = {
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
        "datasets/Doris_ling_xing/Hot_Product_Index_SPU_Detail.yaml": _dataset(
            table_name="爆品指数-SPU月度经营明细",
            uuid=UUIDS["dataset_spu_detail"],
            main_dttm_col="month_start_date",
            description=(
                "爆品指数SPU月度叶子明细；按SPU、年月、SPU评级和最终评级聚合。"
            ),
            sql=_detail_sql(grain="spu"),
            columns=_detail_columns("spu"),
            metrics=_detail_metrics(include_stock=False),
            database_uuid=database_uuid,
        ),
        "datasets/Doris_ling_xing/Hot_Product_Index_SKU_Detail.yaml": _dataset(
            table_name="爆品指数-SKU月度经营明细",
            uuid=UUIDS["dataset_sku_detail"],
            main_dttm_col="month_start_date",
            description=(
                "爆品指数SKU月度叶子明细；按公司SKU、SKU、年月、产品等级、尺寸和颜色聚合。"
            ),
            sql=_detail_sql(grain="sku"),
            columns=_detail_columns("sku"),
            metrics=_detail_metrics(include_stock=True),
            database_uuid=database_uuid,
        ),
        "datasets/Doris_ling_xing/Hot_Product_Index_SPU_Leaderboard.yaml": _dataset(
            table_name="爆品指数-SPU销量排行榜",
            uuid=UUIDS["dataset_spu_leaderboard"],
            main_dttm_col="watermark_month_start_date",
            description=(
                "爆品指数SPU销量排行榜；以日表数据水位锚定本月与上一完整月，"
                "两期覆盖不完整时不返回业务数据。"
            ),
            sql=_leaderboard_sql(),
            columns=_leaderboard_columns(),
            metrics=_leaderboard_metrics(),
            database_uuid=database_uuid,
        ),
    }
    return datasets


def _table_query_context(params: Asset) -> str:
    """Build AG Grid base, row-count, and totals queries in plugin order."""
    columns = list(params["groupby"])
    metrics = list(params["metrics"])
    orderby = [list(item) for item in params["orderby"]]
    query: Asset = {
        "annotation_layers": [],
        "applied_time_extras": {},
        "columns": columns,
        "custom_form_data": {},
        "custom_params": {},
        "extras": {"having": "", "where": ""},
        "filters": [],
        "group_others_when_limit_reached": False,
        "metrics": metrics,
        "order_desc": bool(params.get("order_desc", False)),
        "orderby": orderby,
        "post_processing": [],
        "row_limit": int(params["server_page_length"]),
        "row_offset": 0,
        "series_limit": 0,
        "time_offsets": [],
        "time_range": str(params.get("time_range", "Current month")),
        "url_params": {},
    }
    row_count_query = {
        **query,
        "is_rowcount": True,
        "row_limit": int(params["row_limit"]),
        "row_offset": 0,
        "time_offsets": [],
    }
    totals_query = {
        **query,
        "columns": [],
        "post_processing": [],
        "row_limit": 0,
        "row_offset": 0,
        "time_offsets": [],
    }
    totals_query.pop("order_desc")
    totals_query.pop("orderby")

    datasource = {"id": 0, "type": "table"}
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
        "queries": [query, row_count_query, totals_query],
        "result_format": "json",
        "result_type": "full",
    }
    return json.dumps(
        context, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )


CHART_METRIC_LABELS: Final[dict[str, str]] = {
    "hot_product_index": "爆品指数",
    "sales_qty_total": "销量",
    "avg_daily_sales_qty_period": "日均销量",
    "return_goods_qty_total": "退货量",
    "order_qty_total": "订单量",
    "in_sale_sku_count_period": "在售SKU数",
    "in_sale_spu_count_period": "在售SPU数",
    "return_rate": "退货率",
    "gross_margin": "毛利率",
    "sales_amount_usd_wan": "销售额",
    "gross_profit_usd_wan": "毛利润",
}


def _echarts_query(
    *,
    columns: Sequence[str],
    metrics: Sequence[str],
    series_columns: Sequence[str],
    row_limit: int,
    time_range: str,
    series_limit: int = 0,
    orderby: Sequence[Sequence[Any]] | None = None,
    order_desc: bool = False,
    post_processing: Sequence[Asset] = (),
) -> Asset:
    """Build a standard ECharts query object without datasource coupling."""
    metric_names = list(metrics)
    return {
        "annotation_layers": [],
        "applied_time_extras": {},
        "columns": list(columns),
        "custom_form_data": {},
        "custom_params": {},
        "extras": {"having": "", "where": ""},
        "filters": [],
        "group_others_when_limit_reached": False,
        "metrics": metric_names,
        "order_desc": order_desc,
        "orderby": [list(item) for item in (orderby or [])],
        "post_processing": list(post_processing),
        "row_limit": row_limit,
        "row_offset": 0,
        "series_columns": list(series_columns),
        "series_limit": series_limit,
        "series_limit_metric": metric_names[0] if series_limit else None,
        "time_offsets": [],
        "time_range": time_range,
        "url_params": {},
    }


def _echarts_envelope(params: Asset, queries: Sequence[Asset]) -> str:
    """Wrap executable ECharts queries in Superset's remappable envelope."""
    datasource = {"id": 0, "type": "table"}
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
        "queries": list(queries),
        "result_format": "json",
        "result_type": "full",
    }
    return json.dumps(
        context, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )


def _pivot_post_processing(
    x_axis: str, metrics: Sequence[str], series_columns: Sequence[str]
) -> Asset:
    """Build the ECharts pivot operation used by mixed and regular lines."""
    return {
        "operation": "pivot",
        "options": {
            "aggregates": {metric: {"operator": "mean"} for metric in metrics},
            "columns": list(series_columns),
            "drop_missing_columns": True,
            "index": [x_axis],
        },
    }


def _rename_post_processing(metrics: Sequence[str]) -> Asset:
    """Rename metric levels to the approved Chinese labels before flattening."""
    return {
        "operation": "rename",
        "options": {
            "columns": {
                metric: CHART_METRIC_LABELS.get(metric, metric) for metric in metrics
            },
            "inplace": True,
            "level": 0,
        },
    }


def _line_post_processing(
    x_axis: str, metrics: Sequence[str], series_columns: Sequence[str]
) -> list[Asset]:
    """Return the executable pivot/rename/flatten pipeline for line charts."""
    return [
        _pivot_post_processing(x_axis, metrics, series_columns),
        _rename_post_processing(metrics),
        {"operation": "flatten"},
    ]


def _mixed_timeseries_query_context(params: Asset) -> str:
    """Build both standard Mixed Timeseries query branches."""
    x_axis = str(params["x_axis"])
    time_range = str(params.get("time_range", "Current month"))
    query_a = _echarts_query(
        columns=[x_axis],
        metrics=[str(metric) for metric in params["metrics"]],
        series_columns=[str(column) for column in params.get("groupby", [])],
        row_limit=int(params["row_limit"]),
        series_limit=int(params.get("series_limit", 0)),
        orderby=[[str(params["metrics"][0]), False]],
        time_range=time_range,
        post_processing=_line_post_processing(
            x_axis,
            [str(metric) for metric in params["metrics"]],
            [str(column) for column in params.get("groupby", [])],
        ),
    )
    query_b = _echarts_query(
        columns=[x_axis],
        metrics=[str(metric) for metric in params["metrics_b"]],
        series_columns=[str(column) for column in params.get("groupby_b", [])],
        row_limit=int(params["row_limit_b"]),
        series_limit=int(params.get("series_limit_b", 0)),
        orderby=[[str(params["metrics_b"][0]), False]],
        time_range=time_range,
        post_processing=_line_post_processing(
            x_axis,
            [str(metric) for metric in params["metrics_b"]],
            [str(column) for column in params.get("groupby_b", [])],
        ),
    )
    return _echarts_envelope(params, [query_a, query_b])


def _timeseries_query_context(params: Asset) -> str:
    """Build a standard ECharts color-series query context."""
    x_axis = str(params["x_axis"])
    groupby = [str(column) for column in params.get("groupby", [])]
    metrics = [str(params["metrics"][0])]
    query = _echarts_query(
        columns=[x_axis, *groupby],
        metrics=metrics,
        series_columns=groupby,
        row_limit=int(params["row_limit"]),
        series_limit=int(params.get("series_limit", 0)),
        orderby=[[metrics[0], False]],
        time_range=str(params.get("time_range", "Current month")),
        post_processing=_line_post_processing(x_axis, metrics, groupby),
    )
    return _echarts_envelope(params, [query])


def _pie_query_context(params: Asset) -> str:
    """Build the standard Pie query with descending metric contribution."""
    groupby = [str(column) for column in params["groupby"]]
    metric = str(params["metric"])
    query = _echarts_query(
        columns=groupby,
        metrics=[metric],
        series_columns=[],
        row_limit=int(params["row_limit"]),
        orderby=[[metric, False]],
        time_range=str(params.get("time_range", "Current month")),
        post_processing=[
            {
                "operation": "contribution",
                "options": {
                    "columns": [metric],
                    "rename_columns": [f"{metric}__contribution"],
                },
            }
        ],
    )
    return _echarts_envelope(params, [query])


def _query_context(params: Asset) -> str:
    """Build a saved query context that the chart data endpoint can execute."""
    viz_type = str(params["viz_type"])
    if viz_type == "ag-grid-table-scheme":
        return _table_query_context(params)
    if viz_type == "mixed_timeseries":
        return _mixed_timeseries_query_context(params)
    if viz_type == "echarts_timeseries_line":
        return _timeseries_query_context(params)
    if viz_type == "pie":
        return _pie_query_context(params)
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
        "percent_format": ",.1~%",
        "rectangular_segments": True,
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
    template = (
        "<section><strong>爆品指数总览</strong>{{#each data}}"
        "{{#if coverage_complete}}<span>数据更新至 "
        "{{global_data_through_ymd}}"
        " · 实际计算至 "
        "{{effective_end_ymd}}"
        "{{#if is_stale}} · 数据延迟{{/if}}"
        "{{#if rating_complete}}{{else}} · 评级源不完整，漏斗停算{{/if}}"
        "</span>{{else}}<span>所选范围存在数据缺口 · 日表 "
        "{{daily_month_count}}/{{expected_month_count}} 月 · 月表 "
        "{{monthly_month_count}}/{{expected_month_count}} 月</span>"
        "{{/if}}{{/each}}</section>"
    )
    return {
        "adhoc_filters": [],
        "all_columns": [
            "selected_start_date",
            "selected_end_date",
            "effective_end_date",
            "global_data_through_date",
            "effective_end_ymd",
            "global_data_through_ymd",
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
        "row_limit": 2,
        "styleTemplate": "",
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
      数据更新至 {{global_data_through_ymd}}，
      所选范围 {{selected_start_ymd}} 至 {{selected_end_ymd}}。
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
  <h2>趋势指标</h2>
  <p>
    趋势图包含 11 项指标：爆品指数、销量、日均销量、销售额、退货量、订单量、
    在售 SKU 数、在售 SPU 数、退货率、毛利率和毛利润。天按自然日，周按周一开始的
    ISO 周，月按自然月；三种粒度均只计算所选范围内的记录。
  </p>
  <h2>SPU 销量排行榜</h2>
  <p>
    排行榜以全局数据水位所在月份作为水位月 MTD，并与上一完整月比较；两期统一使用
    美元销售额。评级达标进度为本月销售额相对上月销售额的进度，时间达标进度再按水位
    月已过天数折算；缺少完整月份或上月销售额为零时显示为未计算。
  </p>
  <h2>销量占比</h2>
  <p>
    SPU 和 SKU 环图按筛选后销量分别计算全量分类占比，中心显示总销量，不合并其他分类。
  </p>
  <h2>颜色口径</h2>
  <p>
    颜色趋势和分布使用颜色代码：颜色文本含连字符时取最后一个连字符后的文本，
    不含连字符时保留原值；空颜色不生成分类。
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
    筛选字段使用 SKU 行级产品等级。两个漏斗使用目标月 SPU
    的上一个自然月销售等级，固定顺序为 Ps、S、A、B、C、-。
  </p>
  <h2>数据来源</h2>
  <p>
    <code>ads.ads_pdm_lx_hot_product_index_sku_d</code> 与
    <code>ads.ads_pdm_lx_hot_product_index_sku_m</code>。
  </p>
</article>"""
    return {
        "adhoc_filters": [],
        "all_columns": [
            "selected_start_date",
            "selected_end_date",
            "global_data_through_date",
            "selected_start_ymd",
            "selected_end_ymd",
            "global_data_through_ymd",
            "coverage_complete",
            "rating_complete",
            "status_message",
            "rating_status_message",
        ],
        "handlebarsTemplate": template,
        "include_time": False,
        "order_by_cols": [],
        "query_mode": "raw",
        "row_limit": 2,
        "styleTemplate": "",
        "time_range": "Current month",
        "viz_type": "handlebars",
    }


TREND_X_AXES: Final[dict[str, str]] = {
    "day": "sales_date",
    "week": "yw",
    "month": "ym",
}
TREND_TIME_FORMATS: Final[dict[str, str]] = {
    "day": "%Y-%m-%d",
    "week": "%YW%V",
    "month": "%Y-%m",
}
TREND_GRAIN_LABELS: Final[dict[str, str]] = {"day": "天", "week": "周", "month": "月"}


def _trend_params(grain: str) -> Asset:
    """Build one metric trend form-data contract for a fixed time grain."""
    try:
        x_axis = TREND_X_AXES[grain]
        x_axis_time_format = TREND_TIME_FORMATS[grain]
    except KeyError as ex:
        raise ValueError(f"unsupported hot-product trend grain: {grain}") from ex
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
    return {
        "adhoc_filters": [],
        "color_scheme": "supersetColors",
        "echart_options": json.dumps(
            {"legend": {"selected": selected}}, ensure_ascii=False
        ),
        "groupby": [],
        "groupby_b": [],
        "metrics": list(TREND_PRIMARY_METRICS),
        "metrics_b": list(TREND_SECONDARY_METRICS),
        "order_desc": False,
        "order_desc_b": False,
        "row_limit": 100000,
        "row_limit_b": 100000,
        "series_limit": 0,
        "series_limit_b": 0,
        "seriesType": "line",
        "seriesTypeB": "line",
        "show_value": True,
        "show_valueB": True,
        "time_range": "Current month",
        "viz_type": "mixed_timeseries",
        "x_axis": x_axis,
        "x_axis_time_format": x_axis_time_format,
        "yAxisIndex": 0,
        "yAxisIndexB": 1,
        "yAxisTitleSecondary": "金额（万美元）",
        "y_axis_format": ",.1~f",
        "y_axis_format_secondary": ",.1~f",
    }


def _pie_params(groupby: str, *, legend_type: str) -> Asset:
    """Build the shared complete-category Pie form-data contract."""
    return {
        "adhoc_filters": [],
        "color_scheme": "supersetColors",
        "donut": True,
        "groupby": [groupby],
        "innerRadius": 48,
        "label_line": True,
        "label_type": "key_percent",
        "labels_outside": True,
        "legendOrientation": "bottom",
        "legendType": legend_type,
        "metric": "sales_qty_total",
        "number_format": ",.0f",
        "outerRadius": 74,
        "row_limit": 1000,
        "show_labels": True,
        "show_labels_threshold": 3,
        "show_legend": True,
        "show_total": True,
        "total_label": "总销量",
        "sort_by_metric": True,
        "threshold_for_other": 0,
        "time_range": "Current month",
        "viz_type": "pie",
    }


def _color_trend_params(grain: str) -> Asset:
    """Build one color-series trend form-data contract."""
    try:
        x_axis = TREND_X_AXES[grain]
    except KeyError as ex:
        raise ValueError(f"unsupported hot-product color trend grain: {grain}") from ex
    if grain == "day":
        raise ValueError("color trend supports only week or month grain")
    return {
        "adhoc_filters": [],
        "color_scheme": "supersetColors",
        "groupby": ["color_code"],
        "metrics": ["sales_qty_total"],
        "order_desc": False,
        "row_limit": 100000,
        "series_limit": 1000,
        "series_limit_metric": "sales_qty_total",
        "show_value": True,
        "time_range": "Current month",
        "viz_type": "echarts_timeseries_line",
        "x_axis": x_axis,
        "y_axis_format": ",.0f",
    }


LEADERBOARD_GROUPBY: Final[tuple[str, ...]] = (
    "spu",
    "spu_rating",
    "final_rating",
)
LEADERBOARD_METRICS: Final[tuple[str, ...]] = (
    "previous_month_sales_amount_usd",
    "current_month_sales_amount_usd",
    "rating_progress",
    "time_progress",
)
LEADERBOARD_ORDERBY: Final[tuple[tuple[str, bool], ...]] = (
    ("current_month_sales_amount_usd", False),
    ("spu", True),
    ("final_rating", True),
)


def _leaderboard_column_config() -> Asset:
    """Build stable widths, null display and formats for leaderboard columns."""
    config: Asset = {}
    groupby_widths = {
        "spu": 64,
        "spu_rating": 80,
        "final_rating": 80,
    }
    for name in LEADERBOARD_GROUPBY:
        config[name] = {
            "columnWidth": groupby_widths[name],
            "horizontalAlign": "left",
            "nullValue": "-",
            "truncateLongCells": True,
        }
    metric_widths = {
        "previous_month_sales_amount_usd": 112,
        "current_month_sales_amount_usd": 112,
        "rating_progress": 104,
        "time_progress": 104,
    }
    for name in LEADERBOARD_METRICS:
        config[name] = {
            "columnWidth": metric_widths[name],
            "d3NumberFormat": ("$,.1~f" if "amount" in name else ".1~%"),
            "horizontalAlign": "right",
            "nullValue": "-",
            "truncateLongCells": True,
        }
    config["spu"]["pinned"] = "left"
    return config


def _leaderboard_conditional_formatting() -> list[Asset]:
    """Return the five non-negative rating progress fills."""
    return [
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


def _leaderboard_chart_params() -> Asset:
    """Build the stable, server-paged SPU leaderboard table contract."""
    groupby = list(LEADERBOARD_GROUPBY)
    metrics = list(LEADERBOARD_METRICS)
    orderby = [list(item) for item in LEADERBOARD_ORDERBY]
    return {
        "adhoc_filters": [],
        "advanced_filter_enabled": False,
        "allow_rearrange_columns": False,
        "column_config": _leaderboard_column_config(),
        "column_view_schemes_enabled": False,
        "conditional_formatting": _leaderboard_conditional_formatting(),
        "displayed_columns": [*groupby, *metrics],
        "emit_filter": False,
        "groupby": groupby,
        "include_search": False,
        "metrics": metrics,
        "order_desc": False,
        "orderby": orderby,
        "query_mode": "aggregate",
        "row_hierarchy_fields": [],
        "row_limit": 100000,
        "server_page_length": 50,
        "server_pagination": True,
        "server_pagination_default_orderby": orderby,
        "show_totals": False,
        "time_range": "No filter",
        "viz_type": "ag-grid-table-scheme",
    }


def _charts() -> AssetBundle:
    """Build all overview and detail chart assets."""
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
            "$,.1~f",
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
    charts["charts/Hot_Product_Index_SPU_Detail.yaml"] = _chart(
        slice_name="SPU维度",
        uuid=UUIDS["chart_spu_detail"],
        viz_type="ag-grid-table-scheme",
        dataset_uuid=UUIDS["dataset_spu_detail"],
        params=_detail_chart_params("spu"),
        description="按SPU、年月、SPU评级和最终评级展示经营明细。",
    )
    charts["charts/Hot_Product_Index_SKU_Detail.yaml"] = _chart(
        slice_name="SKU维度",
        uuid=UUIDS["chart_sku_detail"],
        viz_type="ag-grid-table-scheme",
        dataset_uuid=UUIDS["dataset_sku_detail"],
        params=_detail_chart_params("sku"),
        description="按公司SKU、SKU、年月、产品等级、尺寸和颜色展示经营明细。",
    )
    trend_charts = (
        ("day", "指标整体趋势-天", "chart_trend_day"),
        ("week", "指标整体趋势-周", "chart_trend_week"),
        ("month", "指标整体趋势-月", "chart_trend_month"),
    )
    for grain, slice_name, uuid_key in trend_charts:
        charts[f"charts/Hot_Product_Index_Trend_{grain.title()}.yaml"] = _chart(
            slice_name=slice_name,
            uuid=UUIDS[uuid_key],
            viz_type="mixed_timeseries",
            dataset_uuid=UUIDS["dataset_daily"],
            params=_trend_params(grain),
            description=f"按{TREND_GRAIN_LABELS[grain]}粒度展示爆品指数与经营指标趋势。",
        )
    charts["charts/Hot_Product_Index_SPU_Sales_Ratio.yaml"] = _chart(
        slice_name="SPU销售比例",
        uuid=UUIDS["chart_spu_share"],
        viz_type="pie",
        dataset_uuid=UUIDS["dataset_daily"],
        params=_pie_params("spu", legend_type="plain"),
        description="按SPU展示所选范围销量比例。",
    )
    charts["charts/Hot_Product_Index_SKU_Sales_Ratio.yaml"] = _chart(
        slice_name="SKU销售比例",
        uuid=UUIDS["chart_sku_share"],
        viz_type="pie",
        dataset_uuid=UUIDS["dataset_daily"],
        params=_pie_params("sku", legend_type="scroll"),
        description="按SKU展示所选范围销量比例。",
    )
    charts["charts/Hot_Product_Index_SPU_Leaderboard.yaml"] = _chart(
        slice_name="SPU销量排行榜",
        uuid=UUIDS["chart_spu_leaderboard"],
        viz_type="ag-grid-table-scheme",
        dataset_uuid=UUIDS["dataset_spu_leaderboard"],
        params=_leaderboard_chart_params(),
        description="按本月销售额展示水位月SPU销量排行榜。",
    )
    color_trend_charts = (
        ("week", "颜色销售比例-周", "chart_color_trend_week"),
        ("month", "颜色销售比例-月", "chart_color_trend_month"),
    )
    for grain, slice_name, uuid_key in color_trend_charts:
        charts[f"charts/Hot_Product_Index_Color_Sales_Ratio_{grain.title()}.yaml"] = (
            _chart(
                slice_name=slice_name,
                uuid=UUIDS[uuid_key],
                viz_type="echarts_timeseries_line",
                dataset_uuid=UUIDS["dataset_daily"],
                params=_color_trend_params(grain),
                description=f"按{TREND_GRAIN_LABELS[grain]}粒度展示颜色代码销量趋势。",
            )
        )
    charts["charts/Hot_Product_Index_Color_Sales_Distribution.yaml"] = _chart(
        slice_name="颜色销量分布",
        uuid=UUIDS["chart_color_distribution"],
        viz_type="pie",
        dataset_uuid=UUIDS["dataset_daily"],
        params=_pie_params("color_code", legend_type="plain"),
        description="按颜色代码展示所选范围销量分布。",
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
    parent_ids: Sequence[str] | None = None,
) -> Asset:
    """Build one dashboard position chart node."""
    parents = list(parent_ids or ("ROOT_ID", "GRID_ID"))
    parents.append(row_id)
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
        "parents": parents,
        "type": "CHART",
    }


def _row(
    row_id: str,
    children: Sequence[str],
    *,
    parent_ids: Sequence[str] | None = None,
) -> Asset:
    """Build one transparent dashboard row."""
    parents = list(parent_ids or ("ROOT_ID", "GRID_ID"))
    return {
        "children": list(children),
        "id": row_id,
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": parents,
        "type": "ROW",
    }


def _column(
    column_id: str,
    children: Sequence[str],
    *,
    width: float,
    parent_ids: Sequence[str],
) -> Asset:
    """Build one transparent dashboard column with an explicit grid width."""
    return {
        "children": list(children),
        "id": column_id,
        "meta": {"background": "BACKGROUND_TRANSPARENT", "width": width},
        "parents": list(parent_ids),
        "type": "COLUMN",
    }


def _tab(
    tab_id: str,
    text: str,
    children: Sequence[str],
    *,
    tabs_id: str,
    parent_ids: Sequence[str] | None = None,
) -> Asset:
    """Build a dashboard tab with the same editable-title metadata as Superset."""
    parents = list(parent_ids or ("ROOT_ID", "GRID_ID"))
    parents.append(tabs_id)
    return {
        "children": list(children),
        "id": tab_id,
        "meta": {
            "defaultText": "Tab title",
            "placeholder": "Tab title",
            "text": text,
        },
        "parents": parents,
        "type": "TAB",
    }


def _main_position() -> Asset:
    """Build the overview layout followed by the SPU/SKU detail tabs."""
    position: Asset = {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": [
                "ROW-DOC-LINK",
                "ROW-STATUS",
                "ROW-KPIS",
                "ROW-FUNNELS",
                "ROW-DETAIL-TITLE",
                "TABS-DETAIL",
                "ROW-ANALYSIS-PRIMARY",
                "ROW-ANALYSIS-SHARES",
            ],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"height": 44, "text": "拉杆箱在售产品爆品指数看板"},
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
        "ROW-DETAIL-TITLE": _row("ROW-DETAIL-TITLE", ["MARKDOWN-DETAIL-TITLE"]),
        "MARKDOWN-DETAIL-TITLE": {
            "children": [],
            "id": "MARKDOWN-DETAIL-TITLE",
            "meta": {
                "code": "爆品指数&经营指标报表",
                "height": 8,
                "openLinksInNewTab": False,
                "width": 12,
            },
            "parents": ["ROOT_ID", "GRID_ID", "ROW-DETAIL-TITLE"],
            "type": "MARKDOWN",
        },
        "TABS-DETAIL": {
            "children": ["TAB-SPU-DETAIL", "TAB-SKU-DETAIL"],
            "id": "TABS-DETAIL",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "TABS",
        },
        "TAB-SPU-DETAIL": _tab(
            "TAB-SPU-DETAIL",
            "SPU维度",
            ["ROW-SPU-DETAIL"],
            tabs_id="TABS-DETAIL",
        ),
        "TAB-SKU-DETAIL": _tab(
            "TAB-SKU-DETAIL",
            "SKU维度",
            ["ROW-SKU-DETAIL"],
            tabs_id="TABS-DETAIL",
        ),
        "ROW-SPU-DETAIL": _row(
            "ROW-SPU-DETAIL",
            ["CHART-SPU-DETAIL"],
            parent_ids=["ROOT_ID", "GRID_ID", "TABS-DETAIL", "TAB-SPU-DETAIL"],
        ),
        "ROW-SKU-DETAIL": _row(
            "ROW-SKU-DETAIL",
            ["CHART-SKU-DETAIL"],
            parent_ids=["ROOT_ID", "GRID_ID", "TABS-DETAIL", "TAB-SKU-DETAIL"],
        ),
        "CHART-SPU-DETAIL": _chart_node(
            component_id="CHART-SPU-DETAIL",
            chart_id=1012,
            chart_uuid=UUIDS["chart_spu_detail"],
            slice_name="SPU维度",
            row_id="ROW-SPU-DETAIL",
            width=12,
            height=72,
            parent_ids=["ROOT_ID", "GRID_ID", "TABS-DETAIL", "TAB-SPU-DETAIL"],
        ),
        "CHART-SKU-DETAIL": _chart_node(
            component_id="CHART-SKU-DETAIL",
            chart_id=1013,
            chart_uuid=UUIDS["chart_sku_detail"],
            slice_name="SKU维度",
            row_id="ROW-SKU-DETAIL",
            width=12,
            height=72,
            parent_ids=["ROOT_ID", "GRID_ID", "TABS-DETAIL", "TAB-SKU-DETAIL"],
        ),
        "ROW-ANALYSIS-PRIMARY": _row(
            "ROW-ANALYSIS-PRIMARY",
            ["COLUMN-TREND", "COLUMN-LEADERBOARD"],
        ),
        "COLUMN-TREND": _column(
            "COLUMN-TREND",
            ["TABS-TREND"],
            width=7.25,
            parent_ids=["ROOT_ID", "GRID_ID", "ROW-ANALYSIS-PRIMARY"],
        ),
        "COLUMN-LEADERBOARD": _column(
            "COLUMN-LEADERBOARD",
            ["CHART-SPU-LEADERBOARD"],
            width=4.75,
            parent_ids=["ROOT_ID", "GRID_ID", "ROW-ANALYSIS-PRIMARY"],
        ),
        "TABS-TREND": {
            "children": [
                "TAB-TREND-DAY",
                "TAB-TREND-WEEK",
                "TAB-TREND-MONTH",
            ],
            "id": "TABS-TREND",
            "meta": {},
            "parents": [
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
            ],
            "type": "TABS",
        },
        "TAB-TREND-DAY": _tab(
            "TAB-TREND-DAY",
            "天",
            ["ROW-TREND-DAY"],
            tabs_id="TABS-TREND",
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
            ],
        ),
        "TAB-TREND-WEEK": _tab(
            "TAB-TREND-WEEK",
            "周",
            ["ROW-TREND-WEEK"],
            tabs_id="TABS-TREND",
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
            ],
        ),
        "TAB-TREND-MONTH": _tab(
            "TAB-TREND-MONTH",
            "月",
            ["ROW-TREND-MONTH"],
            tabs_id="TABS-TREND",
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
            ],
        ),
        "ROW-TREND-DAY": _row(
            "ROW-TREND-DAY",
            ["CHART-TREND-DAY"],
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
                "TABS-TREND",
                "TAB-TREND-DAY",
            ],
        ),
        "ROW-TREND-WEEK": _row(
            "ROW-TREND-WEEK",
            ["CHART-TREND-WEEK"],
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
                "TABS-TREND",
                "TAB-TREND-WEEK",
            ],
        ),
        "ROW-TREND-MONTH": _row(
            "ROW-TREND-MONTH",
            ["CHART-TREND-MONTH"],
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
                "TABS-TREND",
                "TAB-TREND-MONTH",
            ],
        ),
        "CHART-TREND-DAY": _chart_node(
            component_id="CHART-TREND-DAY",
            chart_id=1014,
            chart_uuid=UUIDS["chart_trend_day"],
            slice_name="指标整体趋势-天",
            row_id="ROW-TREND-DAY",
            width=12,
            height=38,
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
                "TABS-TREND",
                "TAB-TREND-DAY",
            ],
        ),
        "CHART-TREND-WEEK": _chart_node(
            component_id="CHART-TREND-WEEK",
            chart_id=1015,
            chart_uuid=UUIDS["chart_trend_week"],
            slice_name="指标整体趋势-周",
            row_id="ROW-TREND-WEEK",
            width=12,
            height=38,
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
                "TABS-TREND",
                "TAB-TREND-WEEK",
            ],
        ),
        "CHART-TREND-MONTH": _chart_node(
            component_id="CHART-TREND-MONTH",
            chart_id=1016,
            chart_uuid=UUIDS["chart_trend_month"],
            slice_name="指标整体趋势-月",
            row_id="ROW-TREND-MONTH",
            width=12,
            height=38,
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
                "COLUMN-TREND",
                "TABS-TREND",
                "TAB-TREND-MONTH",
            ],
        ),
        "CHART-SPU-LEADERBOARD": _chart_node(
            component_id="CHART-SPU-LEADERBOARD",
            chart_id=1019,
            chart_uuid=UUIDS["chart_spu_leaderboard"],
            slice_name="SPU销量排行榜",
            row_id="COLUMN-LEADERBOARD",
            width=12,
            height=38,
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-PRIMARY",
            ],
        ),
        "ROW-ANALYSIS-SHARES": _row(
            "ROW-ANALYSIS-SHARES",
            [
                "CHART-SPU-SHARE",
                "CHART-SKU-SHARE",
                "COLUMN-COLOR-TREND",
                "CHART-COLOR-DISTRIBUTION",
            ],
        ),
        "CHART-SPU-SHARE": _chart_node(
            component_id="CHART-SPU-SHARE",
            chart_id=1017,
            chart_uuid=UUIDS["chart_spu_share"],
            slice_name="SPU销售比例",
            row_id="ROW-ANALYSIS-SHARES",
            width=3,
            height=38,
        ),
        "CHART-SKU-SHARE": _chart_node(
            component_id="CHART-SKU-SHARE",
            chart_id=1018,
            chart_uuid=UUIDS["chart_sku_share"],
            slice_name="SKU销售比例",
            row_id="ROW-ANALYSIS-SHARES",
            width=3,
            height=38,
        ),
        "COLUMN-COLOR-TREND": _column(
            "COLUMN-COLOR-TREND",
            ["TABS-COLOR-TREND"],
            width=3,
            parent_ids=["ROOT_ID", "GRID_ID", "ROW-ANALYSIS-SHARES"],
        ),
        "TABS-COLOR-TREND": {
            "children": ["TAB-COLOR-WEEK", "TAB-COLOR-MONTH"],
            "id": "TABS-COLOR-TREND",
            "meta": {},
            "parents": [
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
            ],
            "type": "TABS",
        },
        "TAB-COLOR-WEEK": _tab(
            "TAB-COLOR-WEEK",
            "周",
            ["ROW-COLOR-WEEK"],
            tabs_id="TABS-COLOR-TREND",
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
            ],
        ),
        "TAB-COLOR-MONTH": _tab(
            "TAB-COLOR-MONTH",
            "月",
            ["ROW-COLOR-MONTH"],
            tabs_id="TABS-COLOR-TREND",
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
            ],
        ),
        "ROW-COLOR-WEEK": _row(
            "ROW-COLOR-WEEK",
            ["CHART-COLOR-WEEK"],
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
                "TABS-COLOR-TREND",
                "TAB-COLOR-WEEK",
            ],
        ),
        "ROW-COLOR-MONTH": _row(
            "ROW-COLOR-MONTH",
            ["CHART-COLOR-MONTH"],
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
                "TABS-COLOR-TREND",
                "TAB-COLOR-MONTH",
            ],
        ),
        "CHART-COLOR-WEEK": _chart_node(
            component_id="CHART-COLOR-WEEK",
            chart_id=1020,
            chart_uuid=UUIDS["chart_color_trend_week"],
            slice_name="颜色销售比例-周",
            row_id="ROW-COLOR-WEEK",
            width=12,
            height=38,
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
                "TABS-COLOR-TREND",
                "TAB-COLOR-WEEK",
            ],
        ),
        "CHART-COLOR-MONTH": _chart_node(
            component_id="CHART-COLOR-MONTH",
            chart_id=1021,
            chart_uuid=UUIDS["chart_color_trend_month"],
            slice_name="颜色销售比例-月",
            row_id="ROW-COLOR-MONTH",
            width=12,
            height=38,
            parent_ids=[
                "ROOT_ID",
                "GRID_ID",
                "ROW-ANALYSIS-SHARES",
                "COLUMN-COLOR-TREND",
                "TABS-COLOR-TREND",
                "TAB-COLOR-MONTH",
            ],
        ),
        "CHART-COLOR-DISTRIBUTION": _chart_node(
            component_id="CHART-COLOR-DISTRIBUTION",
            chart_id=1022,
            chart_uuid=UUIDS["chart_color_distribution"],
            slice_name="颜色销量分布",
            row_id="ROW-ANALYSIS-SHARES",
            width=3,
            height=38,
        ),
        "CHART-STATUS": _chart_node(
            component_id="CHART-STATUS",
            chart_id=STATUS_PLACEHOLDER_CHART_ID,
            chart_uuid=UUIDS["chart_status"],
            slice_name="爆品指数数据状态",
            row_id="ROW-STATUS",
            width=12,
            height=8,
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
    """Build a multi-target select filter shared by overview and detail charts."""
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
            {
                "column": {"name": column},
                "datasetUuid": UUIDS["dataset_spu_detail"],
            },
            {
                "column": {"name": column},
                "datasetUuid": UUIDS["dataset_sku_detail"],
            },
            {
                "column": {"name": column},
                "datasetUuid": UUIDS["dataset_spu_leaderboard"],
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
            {
                "column": {"name": "month_start_date"},
                "datasetUuid": UUIDS["dataset_spu_detail"],
            },
            {
                "column": {"name": "month_start_date"},
                "datasetUuid": UUIDS["dataset_sku_detail"],
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
        UUIDS["chart_spu_detail"],
        UUIDS["chart_sku_detail"],
        UUIDS["chart_trend_day"],
        UUIDS["chart_trend_week"],
        UUIDS["chart_trend_month"],
        UUIDS["chart_spu_share"],
        UUIDS["chart_sku_share"],
        UUIDS["chart_spu_leaderboard"],
        UUIDS["chart_color_trend_week"],
        UUIDS["chart_color_trend_month"],
        UUIDS["chart_color_distribution"],
    ]
    leaderboard_uuid = UUIDS["chart_spu_leaderboard"]
    main_chart_uuids = [UUIDS["chart_status"], *business_chart_uuids]
    month_scoped_chart_uuids = [
        UUIDS["chart_status"],
        *(uuid for uuid in business_chart_uuids if uuid != leaderboard_uuid),
    ]
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
        _month_filter(month_scoped_chart_uuids),
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
        "horizontal_filter_bar_two_rows": True,
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
  background: #90AD71;
  color: #ffffff;
  height: 44px !important;
  min-height: 44px !important;
  padding: 0;
}
.dashboard-header .editable-title,
.dashboard-header .editable-title input,
.dashboard-header-container .editable-title,
.dashboard-header-container .editable-title input {
  color: #ffffff;
  font-size: 26px;
  font-weight: 700;
  line-height: 44px;
  text-align: center;
}
.dashboard-header-container .header-with-actions {
  align-items: center;
  background: #90AD71;
  height: 44px !important;
  justify-content: center;
  min-height: 44px !important;
  padding: 0 16px;
  position: relative;
}
.dashboard-header-container .header-with-actions .title-panel {
  justify-content: center;
  margin-right: 0;
  width: 100%;
}
.dashboard-header-container .header-with-actions .right-button-panel {
  min-width: 100px;
  position: absolute;
  right: 16px;
}
body:not(:has(.dashboard--editing))
  .dashboard-header-container .dynamic-title-input {
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  color: #ffffff !important;
  font-size: 26px !important;
  font-weight: 700 !important;
  height: 44px !important;
  line-height: 44px !important;
  max-width: min(360px, calc(100vw - 520px));
  min-width: 360px;
  padding: 0 !important;
  text-align: center;
  width: 360px !important;
  -webkit-text-fill-color: #ffffff;
}
body:not(:has(.dashboard--editing))
  [data-test='dashboard-header-wrapper'] {
  position: relative !important;
  top: auto !important;
}
body:has(#main-menu) #main-menu {
  display: none !important;
}
.grid-row:has(#MARKDOWN-DOC-LINK) {
  height: 0 !important;
  margin: 0 !important;
  min-height: 0 !important;
  overflow: visible;
}
.grid-row {
  gap: 4px;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.grid-column {
  padding-left: 2px !important;
  padding-right: 2px !important;
}
.dashboard-component-chart-holder {
  border-radius: 0;
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
  right: 140px;
  top: 5px;
  width: 114px !important;
  z-index: 100;
}
#MARKDOWN-DOC-LINK > .resizable-container {
  height: 100% !important;
  max-height: 100% !important;
  max-width: 100% !important;
  min-height: 100% !important;
  min-width: 100% !important;
  width: 100% !important;
}
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
  background: #e8f2e5;
  border: 1px solid rgba(255,255,255,.65);
  border-radius: 2px;
  color: #0f5132;
  display: inline-block;
  font-weight: 600;
  min-width: 108px;
  padding: 5px 12px;
  text-align: center;
  text-decoration: none;
}
.dashboard:not(.dashboard--editing) #CHART-STATUS + .chart-slice
  [data-test='slice-header'],
.dashboard:not(.dashboard--editing) [id^='CHART-KPI-'] + .chart-slice
  [data-test='slice-header'] {
  display: none;
}
.dashboard:not(.dashboard--editing) [id^='CHART-'] + .chart-slice
  [data-test='slice-header'] {
  min-height: 0;
  padding: 0;
}
.dashboard:not(.dashboard--editing) #CHART-TREND-DAY + .chart-slice
  [data-test='slice-header'] .header-title,
.dashboard:not(.dashboard--editing) #CHART-TREND-WEEK + .chart-slice
  [data-test='slice-header'] .header-title,
.dashboard:not(.dashboard--editing) #CHART-TREND-MONTH + .chart-slice
  [data-test='slice-header'] .header-title,
.dashboard:not(.dashboard--editing) #CHART-COLOR-WEEK + .chart-slice
  [data-test='slice-header'] .header-title,
.dashboard:not(.dashboard--editing) #CHART-COLOR-MONTH + .chart-slice
  [data-test='slice-header'] .header-title {
  display: none;
}
.dashboard:not(.dashboard--editing) [id^='CHART-'] + .chart-slice
  [data-test='slice-header'] .filter-counts,
.dashboard:not(.dashboard--editing) [id^='CHART-'] + .chart-slice
  [data-test='slice-header']
  [aria-label='More Options'] {
  display: none;
}
[id^='CHART-'] + .chart-slice [data-test='slice-header'] .header-controls {
  pointer-events: auto;
}
.dashboard-component-chart-holder:has(> #CHART-STATUS) { border: 0; }
#CHART-STATUS + .chart-slice .handlebars > div {
  overflow: hidden;
  padding: 0;
}
#CHART-STATUS + .chart-slice .handlebars section {
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
#CHART-STATUS + .chart-slice .handlebars section strong {
  color: #13213a;
  font-size: 22px;
  font-weight: 700;
}
#CHART-STATUS + .chart-slice .handlebars section span {
  flex: 1;
  text-align: center;
}
#ROW-KPIS,
#ROW-ANALYSIS-SHARES {
  gap: 4px;
}
.dashboard-component-chart-holder:has(> [id^='CHART-KPI-']) {
  background: #ffffff;
  border: 1px solid #d8dee8;
  border-radius: 0;
}
[id^='CHART-KPI-'] + .chart-slice .metric-name {
  color: #13213a;
  font-style: normal;
  font-weight: 400;
}
[id^='CHART-KPI-'] + .chart-slice .header-line {
  color: #13213a;
  font-style: italic;
  font-weight: 700;
}
[id^='CHART-KPI-'] + .chart-slice .superset-legacy-chart-big-number,
[id^='CHART-KPI-'] + .chart-slice .text-container {
  align-items: center;
  justify-content: center;
  text-align: center;
}
#ROW-ANALYSIS-SHARES .dashboard-component-chart-holder {
  border-radius: 0;
}
.dashboard-component-chart-holder:has(> #CHART-FUNNEL-SALES-AMOUNT),
.dashboard-component-chart-holder:has(> #CHART-FUNNEL-SPU-COUNT) {
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
}
#MARKDOWN-DETAIL-TITLE .dashboard-component-chart-holder {
  align-items: center;
  background: #d8edc8;
  border: 0;
  display: flex;
  justify-content: center;
  min-height: 52px;
  overflow: hidden;
}
#MARKDOWN-DETAIL-TITLE .markdown-content,
#MARKDOWN-DETAIL-TITLE p {
  color: #13213a;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  text-align: center;
}
#TABS-DETAIL .dashboard-component-tabs-content {
  min-height: 640px;
  overflow: visible;
}
#CHART-SPU-DETAIL,
#CHART-SKU-DETAIL {
  min-height: 640px;
}
#CHART-SPU-DETAIL .ag-header,
#CHART-SKU-DETAIL .ag-header {
  background: #d8edc8;
  color: #13213a;
  height: auto;
  min-height: 44px;
}
#CHART-SPU-DETAIL .ag-header-cell-label,
#CHART-SKU-DETAIL .ag-header-cell-label,
#CHART-SPU-DETAIL .ag-header-cell-text,
#CHART-SKU-DETAIL .ag-header-cell-text {
  line-height: 1.2;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}
#CHART-SPU-DETAIL .ag-header-cell-menu-button,
#CHART-SPU-DETAIL .ag-header-cell-filter-button,
#CHART-SKU-DETAIL .ag-header-cell-menu-button,
#CHART-SKU-DETAIL .ag-header-cell-filter-button,
#CHART-SPU-LEADERBOARD .ag-header-cell-menu-button,
#CHART-SPU-LEADERBOARD .ag-header-cell-filter-button {
  display: none !important;
}
#CHART-SPU-DETAIL .header-filter,
#CHART-SPU-DETAIL .three-dots-menu,
#CHART-SKU-DETAIL .header-filter,
#CHART-SKU-DETAIL .three-dots-menu,
#CHART-SPU-LEADERBOARD .header-filter,
#CHART-SPU-LEADERBOARD .three-dots-menu {
  display: none !important;
}
#CHART-SPU-DETAIL .custom-header,
#CHART-SKU-DETAIL .custom-header,
#CHART-SPU-LEADERBOARD .custom-header {
  min-width: 0;
  overflow: visible !important;
  padding: 0 !important;
  text-overflow: clip !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
}
#CHART-SPU-DETAIL .custom-header > span,
#CHART-SKU-DETAIL .custom-header > span,
#CHART-SPU-LEADERBOARD .custom-header > span {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: visible !important;
  overflow-wrap: anywhere;
  text-overflow: clip !important;
  white-space: normal !important;
}
#CHART-SPU-DETAIL .ag-header-cell-comp-wrapper,
#CHART-SPU-DETAIL .ag-header-cell-label,
#CHART-SKU-DETAIL .ag-header-cell-comp-wrapper,
#CHART-SKU-DETAIL .ag-header-cell-label,
#CHART-SPU-LEADERBOARD .ag-header-cell-comp-wrapper,
#CHART-SPU-LEADERBOARD .ag-header-cell-label {
  min-width: 0;
}
#CHART-SPU-DETAIL .ag-header-cell-text,
#CHART-SKU-DETAIL .ag-header-cell-text,
#CHART-SPU-LEADERBOARD .ag-header-cell-text {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
}
#CHART-SPU-DETAIL .ag-header-row,
#CHART-SPU-DETAIL .ag-header-cell,
#CHART-SKU-DETAIL .ag-header-row,
#CHART-SKU-DETAIL .ag-header-cell,
#CHART-SPU-LEADERBOARD .ag-header-row,
#CHART-SPU-LEADERBOARD .ag-header-cell {
  min-height: 44px;
}
#CHART-SPU-DETAIL .ag-row-even:not(.ag-row-pinned),
#CHART-SKU-DETAIL .ag-row-even:not(.ag-row-pinned) {
  background: #ffffff;
}
#CHART-SPU-DETAIL .ag-row-odd:not(.ag-row-pinned),
#CHART-SKU-DETAIL .ag-row-odd:not(.ag-row-pinned) {
  background: #ffffff;
}
#CHART-SPU-DETAIL .ag-row-pinned,
#CHART-SKU-DETAIL .ag-row-pinned {
  background: #eaf3e4;
  color: #13213a;
  font-weight: 700;
}
#CHART-SPU-DETAIL .ag-pinned-left-cols-container,
#CHART-SKU-DETAIL .ag-pinned-left-cols-container {
  border-right: 1px solid rgba(41,120,181,.25);
}
#TABS-DETAIL .ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar {
  background: #2978B5;
}
#TABS-DETAIL .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn {
  color: #2978B5;
}
#TABS-TREND .ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar,
#TABS-COLOR-TREND .ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar {
  background: #2978B5;
}
#TABS-TREND .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn,
#TABS-COLOR-TREND .ant-tabs-card > .ant-tabs-nav
  .ant-tabs-tab-active .ant-tabs-tab-btn {
  color: #2978B5;
}
#CHART-SPU-LEADERBOARD .ag-header {
  background: #d8edc8;
  color: #13213a;
  height: auto;
  min-height: 44px;
}
#CHART-SPU-LEADERBOARD .ag-header-cell-label,
#CHART-SPU-LEADERBOARD .ag-header-cell-text {
  line-height: 1.2;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}
#CHART-SPU-LEADERBOARD .ag-row-even:not(.ag-row-pinned) {
  background: #ffffff;
}
#CHART-SPU-LEADERBOARD .ag-row-odd:not(.ag-row-pinned) {
  background: #ffffff;
}
#CHART-SPU-LEADERBOARD .ag-row-pinned {
  background: #eaf3e4;
  color: #13213a;
  font-weight: 700;
}
@media (max-width: 900px) {
  #CHART-STATUS + .chart-slice .handlebars section {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    padding: 4px 12px;
  }
  #CHART-STATUS + .chart-slice .handlebars section span { text-align: left; }
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
            css="""#CHART-GUIDE + .chart-slice [data-test='slice-header'] {
  display: none;
}
#CHART-GUIDE + .chart-slice .handlebars > div {
  overflow: auto;
  padding: 0;
}
#CHART-GUIDE + .chart-slice .handlebars article {
  color: #172033;
  font-size: 14px;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 960px;
  padding: 16px 24px 40px;
}
#CHART-GUIDE + .chart-slice .handlebars article h1 {
  border-bottom: 2px solid #91b276;
  font-size: 26px;
  padding-bottom: 10px;
}
#CHART-GUIDE + .chart-slice .handlebars article h2 {
  font-size: 18px;
  margin-top: 24px;
}
#CHART-GUIDE + .chart-slice .handlebars article code {
  background: #f3f4f6;
  color: #9f1239;
  padding: 2px 5px;
}
#CHART-GUIDE + .chart-slice .handlebars article li { margin: 4px 0; }""",
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


def _validate_approved_tabs(
    position: Asset,
    expected_tabs: dict[str, tuple[str, ...]],
    dashboard_label: str,
) -> None:
    """Reject tabs outside the dashboard's explicitly approved layout."""
    expected_containers = set(expected_tabs)
    expected_children = {
        child for children in expected_tabs.values() for child in children
    }
    actual_containers = {
        key
        for key, node in position.items()
        if isinstance(node, dict) and node.get("type") == "TABS"
    }
    actual_children = {
        key
        for key, node in position.items()
        if isinstance(node, dict) and node.get("type") == "TAB"
    }
    if actual_containers != expected_containers or actual_children != expected_children:
        raise ValueError(
            f"{dashboard_label} position contains only approved Tabs and Tab nodes"
        )

    for tabs_id, children in expected_tabs.items():
        tabs_node = position[tabs_id]
        if tabs_node.get("children") != list(children):
            raise ValueError(
                f"{dashboard_label} approved Tabs {tabs_id} must contain "
                "its approved tabs"
            )
        if (
            tabs_node.get("meta", {}).get("hidden") is True
            or tabs_node.get("meta", {}).get("visible") is False
        ):
            raise ValueError(f"{dashboard_label} approved Tabs cannot be hidden")
        for tab_id in children:
            tab_node = position[tab_id]
            if (
                tab_node.get("meta", {}).get("hidden") is True
                or tab_node.get("meta", {}).get("visible") is False
            ):
                raise ValueError(
                    f"{dashboard_label} approved Tab {tab_id} cannot be hidden"
                )


def _validate_position_graph(  # noqa: C901
    position: Asset, dashboard_label: str
) -> list[str]:
    """Validate a dashboard position graph and return its chart UUIDs."""
    metadata_keys = {"DASHBOARD_VERSION_KEY", "HEADER_ID"}
    if position.get("DASHBOARD_VERSION_KEY") != "v2":
        raise ValueError(f"{dashboard_label} position graph metadata is invalid")
    header = position.get("HEADER_ID")
    if (
        not isinstance(header, dict)
        or header.get("id") != "HEADER_ID"
        or header.get("type") != "HEADER"
        or header.get("children", []) not in ([], None)
        or header.get("parents", []) not in ([], None)
    ):
        raise ValueError(f"{dashboard_label} position graph header is invalid")
    graph_nodes: dict[str, Asset] = {}
    for key, node in position.items():
        if key in metadata_keys:
            continue
        if not isinstance(node, dict):
            raise ValueError(
                f"{dashboard_label} position graph contains a non-node entry"
            )
        if node.get("id") != key:
            raise ValueError(
                f"{dashboard_label} position graph node IDs must match their keys"
            )
        graph_nodes[key] = node

    root = graph_nodes.get("ROOT_ID")
    if root is None or root.get("type") != "ROOT":
        raise ValueError(f"{dashboard_label} position graph must define ROOT_ID")

    for key, node in graph_nodes.items():
        children = node.get("children")
        if not isinstance(children, list) or len(children) != len(set(children)):
            raise ValueError(
                f"{dashboard_label} position graph children must be unique lists"
            )
        if key == "ROOT_ID":
            parents = node.get("parents", [])
            if parents not in ([], None):
                raise ValueError(f"{dashboard_label} ROOT_ID must not have parents")
            continue
        parents = node.get("parents")
        if not isinstance(parents, list) or not parents:
            raise ValueError(
                f"{dashboard_label} position graph nodes must have parents"
            )
        if parents[0] != "ROOT_ID" or len(parents) != len(set(parents)):
            raise ValueError(
                f"{dashboard_label} position graph parent paths are invalid"
            )
        for index, parent_id in enumerate(parents):
            parent = graph_nodes.get(parent_id)
            if parent is None:
                raise ValueError(
                    f"{dashboard_label} position graph references an unknown "
                    f"parent {parent_id}"
                )
            expected_parent_path = parents[:index]
            if parent_id == "ROOT_ID":
                parent_path = parent.get("parents", [])
            else:
                parent_path = parent.get("parents")
            if parent_path != expected_parent_path:
                raise ValueError(
                    f"{dashboard_label} position graph parent paths are inconsistent"
                )
        direct_parent = graph_nodes[parents[-1]]
        if key not in direct_parent["children"]:
            raise ValueError(
                f"{dashboard_label} position graph children and parents disagree "
                f"for {key}"
            )

        for child_id in children:
            child = graph_nodes.get(child_id)
            if child is None:
                raise ValueError(
                    f"{dashboard_label} position graph references an unknown "
                    f"child {child_id}"
                )
            if child_id == "ROOT_ID":
                raise ValueError(
                    f"{dashboard_label} position graph cannot point to ROOT_ID"
                )
            child_parents = child.get("parents")
            if (
                not isinstance(child_parents, list)
                or not child_parents
                or child_parents[-1] != key
            ):
                raise ValueError(
                    f"{dashboard_label} position graph children and parents disagree "
                    f"for {key}"
                )

    reachable: set[str] = set()
    visiting: set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            raise ValueError(f"{dashboard_label} position graph contains a cycle")
        if node_id in reachable:
            return
        visiting.add(node_id)
        reachable.add(node_id)
        for child_id in graph_nodes[node_id]["children"]:
            visit(child_id)
        visiting.remove(node_id)

    visit("ROOT_ID")
    if reachable != set(graph_nodes):
        disconnected = sorted(set(graph_nodes) - reachable)
        raise ValueError(
            f"{dashboard_label} position graph must be fully reachable from ROOT_ID: "
            f"{disconnected}"
        )

    chart_uuids: list[str] = []
    for node in graph_nodes.values():
        if node.get("type") != "CHART":
            continue
        meta = node.get("meta")
        if not isinstance(meta, dict) or not meta.get("uuid"):
            raise ValueError(f"{dashboard_label} chart nodes must contain a UUID")
        chart_uuids.append(str(meta["uuid"]))
    return chart_uuids


def validate_assets(  # noqa: C901
    assets: AssetBundle, database_uuid: str
) -> None:
    """Fail fast when cross-asset identities or the approved scope drift."""
    datasets = _asset_family(assets, "datasets/")
    charts = _asset_family(assets, "charts/")
    dashboards = _asset_family(assets, "dashboards/")
    if assets.get("metadata.yaml") != {"type": "assets", "version": ASSET_VERSION}:
        raise ValueError("metadata.yaml must declare an assets v1 bundle")
    if (len(datasets), len(charts), len(dashboards)) != (6, 24, 2):
        raise ValueError(
            "hot-product bundle must contain 6 datasets, 24 charts, and 2 dashboards "
            "(9 KPI, 2 funnels, 1 status, 1 guide, 2 detail, and 9 analysis charts)"
        )

    identified_assets = [*datasets, *charts, *dashboards]
    asset_uuids = [str(asset["uuid"]) for asset in identified_assets]
    if len(asset_uuids) != len(set(asset_uuids)):
        raise ValueError("asset UUIDs must be unique")
    if len(asset_uuids) != 32:
        raise ValueError("hot-product bundle must contain 32 published asset UUIDs")
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
    dashboard_by_uuid = {str(dashboard["uuid"]): dashboard for dashboard in dashboards}
    main = dashboard_by_uuid.get(UUIDS["dashboard_main"])
    if main is None:
        raise ValueError(
            f"main dashboard with UUID {UUIDS['dashboard_main']} is missing "
            "from the bundle"
        )
    guide = dashboard_by_uuid.get(UUIDS["dashboard_guide"])
    if guide is None:
        raise ValueError(
            f"guide dashboard with UUID {UUIDS['dashboard_guide']} is missing "
            "from the bundle"
        )
    if len(dashboard_by_uuid) != len(dashboards):
        raise ValueError("dashboard UUIDs must be unique")

    approved_tabs = {
        UUIDS["dashboard_main"]: {
            "TABS-DETAIL": ("TAB-SPU-DETAIL", "TAB-SKU-DETAIL"),
            "TABS-TREND": (
                "TAB-TREND-DAY",
                "TAB-TREND-WEEK",
                "TAB-TREND-MONTH",
            ),
            "TABS-COLOR-TREND": ("TAB-COLOR-WEEK", "TAB-COLOR-MONTH"),
        },
        UUIDS["dashboard_guide"]: {},
    }
    position_chart_uuids: dict[str, list[str]] = {}
    for dashboard in dashboards:
        dashboard_uuid = str(dashboard["uuid"])
        expected_tabs = approved_tabs.get(dashboard_uuid)
        if expected_tabs is None:
            raise ValueError(f"dashboard UUID {dashboard_uuid} is not approved")
        dashboard_label = f"dashboard {dashboard_uuid}"
        _validate_approved_tabs(dashboard["position"], expected_tabs, dashboard_label)
        chart_nodes = _validate_position_graph(dashboard["position"], dashboard_label)
        if not set(chart_nodes) <= chart_uuids:
            raise ValueError("dashboard position references an unknown chart UUID")
        position_chart_uuids[dashboard_uuid] = chart_nodes

    all_position_chart_uuids = [
        chart_uuid
        for chart_nodes in position_chart_uuids.values()
        for chart_uuid in chart_nodes
    ]
    if (
        len(all_position_chart_uuids) != len(chart_uuids)
        or set(all_position_chart_uuids) != chart_uuids
        or len(all_position_chart_uuids) != 24
    ):
        positioned_chart_uuids = set(all_position_chart_uuids)
        missing_chart_keys = sorted(
            key
            for key, chart_uuid in UUIDS.items()
            if key.startswith("chart_") and chart_uuid not in positioned_chart_uuids
        )
        raise ValueError(
            "dashboard chart UUID positions must reference each of the 24 chart "
            "UUIDs exactly once"
            + (f"; missing {missing_chart_keys}" if missing_chart_keys else "")
        )

    main_chart_uuids = position_chart_uuids[UUIDS["dashboard_main"]]
    guide_chart_uuids = position_chart_uuids[UUIDS["dashboard_guide"]]
    expected_main_chart_uuids = chart_uuids - {UUIDS["chart_guide"]}
    if (
        len(main_chart_uuids) != 23
        or set(main_chart_uuids) != expected_main_chart_uuids
    ):
        raise ValueError(
            "main dashboard chart UUID position must contain exactly the 23 "
            "business charts"
        )
    if guide_chart_uuids != [UUIDS["chart_guide"]]:
        raise ValueError(
            "guide dashboard chart UUID position must contain only the guide chart"
        )

    main_chart_count = len(main_chart_uuids)
    if main_chart_count != 23:
        raise ValueError(
            "main dashboard scope must contain exactly 23 approved chart nodes "
            "(9 KPI, 2 funnels, 1 status, 2 detail, and 9 analysis charts)"
        )
    new_chart_keys = (
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
    main_chart_node_uuids = main_chart_uuids
    for chart_key in new_chart_keys:
        chart_uuid = UUIDS[chart_key]
        if chart_uuid not in chart_uuids:
            raise ValueError(f"new chart asset {chart_key} is missing")
        if main_chart_node_uuids.count(chart_uuid) != 1:
            raise ValueError(
                f"main dashboard must contain exactly one {chart_key} chart node"
            )
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
    month_filter = month_filters[0]
    month_scope = [str(uuid) for uuid in month_filter["chartsInScope"]]
    leaderboard_uuid = UUIDS["chart_spu_leaderboard"]
    expected_month_scope = set(main_chart_node_uuids) - {leaderboard_uuid}
    if (
        len(month_scope) != len(set(month_scope))
        or set(month_scope) != expected_month_scope
    ):
        raise ValueError(
            "month-range filter scope must exclude only the SPU leaderboard chart"
        )
    if UUIDS["dataset_spu_leaderboard"] in {
        str(target["datasetUuid"]) for target in month_filter["targets"]
    }:
        raise ValueError(
            "month-range filter must not target the SPU leaderboard dataset"
        )


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
