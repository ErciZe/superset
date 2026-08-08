-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements.  See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership.  The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License.  You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied.  See the License for the
-- specific language governing permissions and limitations
-- under the License.

-- 1. Missing required columns; release requires zero rows.
SELECT required.table_name, required.column_name
FROM (
  SELECT 'ads_pdm_lx_hot_product_index_sku_d' AS table_name, 'sales_date' AS column_name
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sid'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'msku'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'ym'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sku'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'company_sku'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'channel'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'product_line'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'country'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'size'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'color'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'developer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'model'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sku_level'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'product_level'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu_previous_month_sales_amount_cny'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu_previous_month_sales_level'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sales_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sales_amount_usd'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'gross_profit_usd'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'return_goods_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'score'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'order_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sku_month_sales_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'theoretical_stock_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'actual_stock_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'eligibility_value'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'is_eligible'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'is_generated_zero'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'data_through_date'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'source_updated_at'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'etl_batch_id'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'etl_loaded_at'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'month_start_date'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sid'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'msku'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'ym'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sku'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'company_sku'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'channel'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'product_line'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'country'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'size'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'color'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'developer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'model'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sku_level'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'product_level'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu_previous_month_sales_amount_cny'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu_previous_month_sales_level'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sales_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sales_amount_usd'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'gross_profit_usd'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'return_goods_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'score'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'order_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sku_month_sales_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'theoretical_stock_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'actual_stock_qty'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'eligibility_value'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'is_eligible'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'data_through_date'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'source_updated_at'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'etl_batch_id'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'etl_loaded_at'
) required
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'ads'
 AND actual.table_name = required.table_name
 AND actual.column_name = required.column_name
WHERE actual.column_name IS NULL;

-- 2. Full eligible-history category cardinality; every value must be <= 1000.
WITH eligible AS (
  SELECT ym, spu, sku,
         NULLIF(TRIM(SUBSTRING_INDEX(color, '-', -1)), '') AS color_code
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
  WHERE is_eligible = 1
),
monthly_category_distinct AS (
  SELECT ym, 'spu' AS dimension_name, spu AS dimension_value
  FROM eligible
  WHERE spu IS NOT NULL
  GROUP BY ym, spu
  UNION ALL
  SELECT ym, 'sku', sku
  FROM eligible
  WHERE sku IS NOT NULL
  GROUP BY ym, sku
  UNION ALL
  SELECT ym, 'color_code', color_code
  FROM eligible
  WHERE color_code IS NOT NULL
  GROUP BY ym, color_code
),
history_category_distinct AS (
  SELECT dimension_name, dimension_value
  FROM monthly_category_distinct
  GROUP BY dimension_name, dimension_value
),
dimension_seed AS (
  SELECT 'spu' AS dimension_name
  UNION ALL SELECT 'sku'
  UNION ALL SELECT 'color_code'
),
history_category_counts AS (
  SELECT dimension_name, COUNT(*) AS distinct_count
  FROM history_category_distinct
  GROUP BY dimension_name
)
SELECT
  s.dimension_name,
  COALESCE(h.distinct_count, 0) AS distinct_count,
  CASE WHEN COALESCE(h.distinct_count, 0) <= 1000 THEN 1 ELSE 0 END AS within_limit
FROM dimension_seed s
LEFT JOIN history_category_counts h
  ON h.dimension_name = s.dimension_name
ORDER BY CASE s.dimension_name
  WHEN 'spu' THEN 1
  WHEN 'sku' THEN 2
  ELSE 3
END;

-- 3. Watermark and current/previous month day coverage.
WITH watermark AS (
  SELECT MAX(data_through_date) AS data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
),
anchor AS (
  SELECT
    data_through_date,
    DATE_TRUNC(data_through_date, 'month') AS watermark_month_start_date,
    DATE_FORMAT(data_through_date, '%Y-%m') AS current_ym,
    DATE_FORMAT(
      DATE_SUB(DATE_TRUNC(data_through_date, 'month'), INTERVAL 1 MONTH),
      '%Y-%m'
    ) AS previous_ym
  FROM watermark
),
daily_quality AS (
  SELECT
    COUNT(DISTINCT CASE
      WHEN d.ym = a.current_ym THEN d.sales_date END
    ) AS current_day_count,
    COUNT(DISTINCT CASE
      WHEN d.ym = a.previous_ym THEN d.sales_date END
    ) AS previous_day_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN anchor a
  WHERE d.ym IN (a.current_ym, a.previous_ym)
),
monthly_quality AS (
  SELECT COUNT(DISTINCT m.ym) AS monthly_month_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN anchor a
  WHERE m.ym IN (a.current_ym, a.previous_ym)
)
SELECT
  a.data_through_date,
  a.current_ym,
  a.previous_ym,
  d.current_day_count,
  DAY(a.data_through_date) AS expected_current_days,
  d.previous_day_count,
  DAY(LAST_DAY(
    DATE_SUB(DATE_TRUNC(a.data_through_date, 'month'), INTERVAL 1 MONTH)
  )) AS expected_previous_days,
  m.monthly_month_count
FROM anchor a
CROSS JOIN daily_quality d
CROSS JOIN monthly_quality m;

-- 4. ISO week cross-year contract; release requires 2026W01, 2026W01, 2026W02.
SELECT
  DATE_FORMAT(CAST('2025-12-29' AS DATE), '%xW%v') AS monday_yw,
  DATE_FORMAT(CAST('2026-01-04' AS DATE), '%xW%v') AS sunday_yw,
  DATE_FORMAT(CAST('2026-01-05' AS DATE), '%xW%v') AS next_monday_yw;
