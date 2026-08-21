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

-- Result set 1: every required field must be present with a compatible type.
WITH expected_columns AS (
  SELECT 'ads_pdm_lx_hot_product_index_sku_d' AS table_name, 'sales_date' AS column_name, 'date' AS type_family
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sid', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'msku', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'ym', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sku', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'company_sku', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'channel', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'product_line', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'country', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'size', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'color', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'developer', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'model', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sku_level', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'product_level', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu_previous_month_sales_amount_cny', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu_previous_month_sales_amount_usd', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'spu_previous_month_sales_level', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sales_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sales_amount_usd', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'gross_profit_usd', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'return_goods_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'score', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'order_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'sku_month_sales_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'theoretical_stock_qty', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'actual_stock_qty', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'eligibility_value', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'is_eligible', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'is_generated_zero', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'data_through_date', 'date'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'source_updated_at', 'date_time'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'etl_batch_id', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_d', 'etl_loaded_at', 'date_time'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'month_start_date', 'date'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sid', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'msku', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'ym', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sku', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'company_sku', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'channel', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'product_line', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'country', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'size', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'color', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'developer', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'model', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sku_level', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'product_level', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu_previous_month_sales_amount_cny', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu_previous_month_sales_amount_usd', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'spu_previous_month_sales_level', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sales_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sales_amount_usd', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'gross_profit_usd', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'return_goods_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'score', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'order_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'sku_month_sales_qty', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'theoretical_stock_qty', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'actual_stock_qty', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'eligibility_value', 'decimal'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'is_eligible', 'integer'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'data_through_date', 'date'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'source_updated_at', 'date_time'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'etl_batch_id', 'text'
  UNION ALL SELECT 'ads_pdm_lx_hot_product_index_sku_m', 'etl_loaded_at', 'date_time'
), actual_columns AS (
  SELECT
    table_name,
    column_name,
    UPPER(data_type) AS data_type
  FROM information_schema.columns
  WHERE table_schema = 'ads'
    AND table_name IN (
      'ads_pdm_lx_hot_product_index_sku_d',
      'ads_pdm_lx_hot_product_index_sku_m'
    )
)
SELECT
  e.table_name,
  e.column_name,
  e.type_family,
  a.data_type AS actual_data_type,
  CASE WHEN a.column_name IS NOT NULL THEN 1 ELSE 0 END AS column_present,
  CASE
    WHEN a.column_name IS NULL THEN 0
    WHEN e.type_family IN ('date', 'date_time')
      AND a.data_type IN ('DATE', 'DATETIME') THEN 1
    WHEN e.type_family = 'text' AND (
      a.data_type LIKE '%CHAR%' OR a.data_type IN ('STRING', 'TEXT')
    ) THEN 1
    WHEN e.type_family = 'decimal' AND a.data_type LIKE '%DECIMAL%' THEN 1
    WHEN e.type_family = 'integer' AND (
      a.data_type LIKE '%INT%' OR a.data_type = 'TINYINT'
    ) THEN 1
    ELSE 0
  END AS type_compatible,
  CASE
    WHEN a.column_name IS NOT NULL
      AND (
        (e.type_family IN ('date', 'date_time')
          AND a.data_type IN ('DATE', 'DATETIME'))
        OR (e.type_family = 'text' AND (
          a.data_type LIKE '%CHAR%' OR a.data_type IN ('STRING', 'TEXT')
        ))
        OR (e.type_family = 'decimal' AND a.data_type LIKE '%DECIMAL%')
        OR (e.type_family = 'integer' AND (
          a.data_type LIKE '%INT%' OR a.data_type = 'TINYINT'
        ))
      )
    THEN 1
    ELSE 0
  END AS check_pass
FROM expected_columns e
LEFT JOIN actual_columns a
  ON a.table_name = e.table_name
 AND a.column_name = e.column_name
ORDER BY e.table_name, e.column_name;

-- Result set 2: selected month and date coverage through the ADS watermark.
WITH watermark AS (
  SELECT MAX(data_through_date) AS global_data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
), selected_range AS (
  SELECT
    DATE_TRUNC(global_data_through_date, 'month') AS selected_start_date,
    DATE_ADD(
      DATE_TRUNC(global_data_through_date, 'month'),
      INTERVAL 1 MONTH
    ) AS selected_end_exclusive_date,
    global_data_through_date
  FROM watermark
), daily_by_month AS (
  SELECT
    d.ym,
    COUNT(DISTINCT d.sales_date) AS actual_day_count,
    CASE
      WHEN d.ym = DATE_FORMAT(r.global_data_through_date, '%Y-%m')
      THEN DATEDIFF(
        r.global_data_through_date,
        DATE_TRUNC(r.global_data_through_date, 'month')
      ) + 1
      ELSE DAY(LAST_DAY(CAST(CONCAT(d.ym, '-01') AS DATE)))
    END AS expected_day_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_range r
  WHERE d.sales_date >= r.selected_start_date
    AND d.sales_date < r.selected_end_exclusive_date
    AND d.sales_date <= r.global_data_through_date
  GROUP BY d.ym, r.global_data_through_date
), monthly_by_month AS (
  SELECT
    m.ym,
    COUNT(*) AS monthly_row_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.month_start_date >= r.selected_start_date
    AND m.month_start_date < r.selected_end_exclusive_date
  GROUP BY m.ym
), daily_quality AS (
  SELECT
    COUNT(DISTINCT ym) AS daily_month_count,
    COALESCE(SUM(actual_day_count), 0) AS daily_day_count,
    COALESCE(SUM(expected_day_count), 0) AS expected_daily_day_count
  FROM daily_by_month
), monthly_quality AS (
  SELECT
    COUNT(DISTINCT ym) AS monthly_month_count,
    COALESCE(SUM(monthly_row_count), 0) AS monthly_row_count
  FROM monthly_by_month
), quality AS (
  SELECT
    r.selected_start_date,
    r.selected_end_exclusive_date,
    r.global_data_through_date,
    LEAST(
      DATE_SUB(r.selected_end_exclusive_date, INTERVAL 1 DAY),
      r.global_data_through_date
    ) AS effective_end_date,
    DATE_FORMAT(
      LEAST(
        DATE_SUB(r.selected_end_exclusive_date, INTERVAL 1 DAY),
        r.global_data_through_date
      ),
      '%Y-%m'
    ) AS effective_end_ym,
    TIMESTAMPDIFF(
      MONTH,
      r.selected_start_date,
      r.selected_end_exclusive_date
    ) AS expected_month_count,
    d.daily_month_count,
    m.monthly_month_count,
    d.daily_day_count,
    d.expected_daily_day_count,
    m.monthly_row_count
  FROM selected_range r
  CROSS JOIN daily_quality d
  CROSS JOIN monthly_quality m
)
SELECT
  'selected_range_coverage' AS check_name,
  selected_start_date,
  selected_end_exclusive_date,
  global_data_through_date,
  effective_end_date,
  effective_end_ym,
  expected_month_count,
  daily_month_count,
  monthly_month_count,
  daily_day_count,
  expected_daily_day_count,
  monthly_row_count,
  CASE
    WHEN global_data_through_date IS NOT NULL
      AND expected_month_count > 0
      AND daily_month_count = expected_month_count
      AND monthly_month_count = expected_month_count
      AND daily_day_count = expected_daily_day_count
    THEN 1
    ELSE 0
  END AS coverage_complete,
  CASE
    WHEN global_data_through_date IS NOT NULL
      AND expected_month_count > 0
      AND daily_month_count = expected_month_count
      AND monthly_month_count = expected_month_count
      AND daily_day_count = expected_daily_day_count
    THEN 1
    ELSE 0
  END AS check_pass
FROM quality;

-- Result set 3: dimension cardinality and NULL/empty samples for the selected range.
WITH watermark AS (
  SELECT MAX(data_through_date) AS global_data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
), selected_range AS (
  SELECT
    DATE_TRUNC(global_data_through_date, 'month') AS selected_start_date,
    DATE_ADD(
      DATE_TRUNC(global_data_through_date, 'month'),
      INTERVAL 1 MONTH
    ) AS selected_end_exclusive_date
  FROM watermark
), dimension_rows AS (
  SELECT
    'daily' AS source_table,
    'country' AS dimension_name,
    CAST(d.country AS VARCHAR(255)) AS dimension_value,
    d.ym,
    d.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_range r
  WHERE d.is_eligible = 1
    AND d.sales_date >= r.selected_start_date
    AND d.sales_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'daily', 'developer', CAST(d.developer AS VARCHAR(255)), d.ym, d.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_range r
  WHERE d.is_eligible = 1
    AND d.sales_date >= r.selected_start_date
    AND d.sales_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'daily', 'spu', CAST(d.spu AS VARCHAR(255)), d.ym, d.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_range r
  WHERE d.is_eligible = 1
    AND d.sales_date >= r.selected_start_date
    AND d.sales_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'daily', 'model', CAST(d.model AS VARCHAR(255)), d.ym, d.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_range r
  WHERE d.is_eligible = 1
    AND d.sales_date >= r.selected_start_date
    AND d.sales_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'daily', 'sku', CAST(d.sku AS VARCHAR(255)), d.ym, d.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_d d
  CROSS JOIN selected_range r
  WHERE d.is_eligible = 1
    AND d.sales_date >= r.selected_start_date
    AND d.sales_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'monthly', 'country', CAST(m.country AS VARCHAR(255)), m.ym, m.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.is_eligible = 1
    AND m.month_start_date >= r.selected_start_date
    AND m.month_start_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'monthly', 'spu', CAST(m.spu AS VARCHAR(255)), m.ym, m.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.is_eligible = 1
    AND m.month_start_date >= r.selected_start_date
    AND m.month_start_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'monthly', 'developer', CAST(m.developer AS VARCHAR(255)), m.ym, m.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.is_eligible = 1
    AND m.month_start_date >= r.selected_start_date
    AND m.month_start_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'monthly', 'sku', CAST(m.sku AS VARCHAR(255)), m.ym, m.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.is_eligible = 1
    AND m.month_start_date >= r.selected_start_date
    AND m.month_start_date < r.selected_end_exclusive_date
  UNION ALL
  SELECT
    'monthly', 'model', CAST(m.model AS VARCHAR(255)), m.ym, m.sku
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.is_eligible = 1
    AND m.month_start_date >= r.selected_start_date
    AND m.month_start_date < r.selected_end_exclusive_date
), dimension_seed AS (
  SELECT 'daily' AS source_table, 'country' AS dimension_name
  UNION ALL SELECT 'daily', 'developer'
  UNION ALL SELECT 'daily', 'spu'
  UNION ALL SELECT 'daily', 'model'
  UNION ALL SELECT 'daily', 'sku'
  UNION ALL SELECT 'monthly', 'country'
  UNION ALL SELECT 'monthly', 'developer'
  UNION ALL SELECT 'monthly', 'spu'
  UNION ALL SELECT 'monthly', 'model'
  UNION ALL SELECT 'monthly', 'sku'
), quality AS (
  SELECT
    source_table,
    dimension_name,
    COUNT(*) AS row_count,
    COUNT(DISTINCT NULLIF(TRIM(dimension_value), '')) AS distinct_count,
    SUM(CASE WHEN dimension_value IS NULL THEN 1 ELSE 0 END) AS null_count,
    SUM(CASE
      WHEN dimension_value IS NOT NULL AND TRIM(dimension_value) = ''
      THEN 1 ELSE 0 END
    ) AS empty_count,
    MIN(CASE
      WHEN dimension_value IS NULL OR TRIM(dimension_value) = ''
      THEN CONCAT(ym, ':', COALESCE(sku, '<NULL>'))
    END) AS null_sample,
    MIN(NULLIF(TRIM(dimension_value), '')) AS first_non_null_value
  FROM dimension_rows
  GROUP BY source_table, dimension_name
)
SELECT
  s.source_table,
  s.dimension_name,
  COALESCE(q.row_count, 0) AS row_count,
  COALESCE(q.distinct_count, 0) AS distinct_count,
  COALESCE(q.null_count, 0) AS null_count,
  COALESCE(q.empty_count, 0) AS empty_count,
  q.null_sample,
  q.first_non_null_value,
  CASE WHEN COALESCE(q.row_count, 0) > 0 THEN 1 ELSE 0 END AS within_contract,
  CASE WHEN COALESCE(q.row_count, 0) > 0 THEN 1 ELSE 0 END AS check_pass
FROM dimension_seed s
LEFT JOIN quality q
  ON q.source_table = s.source_table
 AND q.dimension_name = s.dimension_name
ORDER BY s.source_table, s.dimension_name;

-- Result set 4: ending-month ym + SKU stock values must be consistent.
WITH watermark AS (
  SELECT MAX(data_through_date) AS global_data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
), selected_range AS (
  SELECT
    DATE_FORMAT(global_data_through_date, '%Y-%m') AS effective_end_ym,
    global_data_through_date
  FROM watermark
), stock_rows AS (
  SELECT
    m.ym,
    m.sku,
    m.theoretical_stock_qty,
    m.actual_stock_qty,
    m.sid,
    m.msku,
    m.country
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.ym = r.effective_end_ym
    AND m.is_eligible = 1
), stock_quality AS (
  SELECT
    ym,
    sku,
    COUNT(*) AS row_count,
    COUNT(DISTINCT theoretical_stock_qty) AS distinct_theoretical_stock_count,
    COUNT(DISTINCT actual_stock_qty) AS distinct_actual_stock_count,
    COUNT(DISTINCT CONCAT(
      COALESCE(CAST(theoretical_stock_qty AS VARCHAR(64)), '<NULL>'),
      '|',
      COALESCE(CAST(actual_stock_qty AS VARCHAR(64)), '<NULL>')
    )) AS distinct_stock_pair_count,
    SUM(CASE WHEN theoretical_stock_qty IS NULL THEN 1 ELSE 0 END) AS null_theoretical_count,
    SUM(CASE WHEN actual_stock_qty IS NULL THEN 1 ELSE 0 END) AS null_actual_count
  FROM stock_rows
  GROUP BY ym, sku
), summary AS (
  SELECT
    r.effective_end_ym,
    r.global_data_through_date,
    COUNT(DISTINCT q.sku) AS sku_count,
    COALESCE(SUM(CASE WHEN q.sku IS NULL THEN q.row_count ELSE 0 END), 0) AS null_sku_count,
    COALESCE(SUM(CASE
      WHEN q.sku IS NOT NULL
        AND (q.distinct_theoretical_stock_count > 1
        OR q.distinct_actual_stock_count > 1
        OR q.distinct_stock_pair_count > 1)
      THEN 1 ELSE 0 END
    ), 0) AS conflicting_sku_count,
    COALESCE(SUM(q.null_theoretical_count), 0) AS null_theoretical_count,
    COALESCE(SUM(q.null_actual_count), 0) AS null_actual_count
  FROM selected_range r
  LEFT JOIN stock_quality q ON 1 = 1
  GROUP BY r.effective_end_ym, r.global_data_through_date
)
SELECT *
FROM (
SELECT
  'ym_sku_stock_summary' AS check_name,
  effective_end_ym,
  global_data_through_date,
  CAST(NULL AS VARCHAR(255)) AS sku,
  sku_count,
  null_sku_count,
  conflicting_sku_count,
  null_theoretical_count,
  null_actual_count,
  CASE
    WHEN sku_count > 0
      AND null_sku_count = 0
      AND conflicting_sku_count = 0
      AND null_theoretical_count = 0
      AND null_actual_count = 0
    THEN 1
    ELSE 0
  END AS within_contract,
  CASE
    WHEN sku_count > 0
      AND null_sku_count = 0
      AND conflicting_sku_count = 0
      AND null_theoretical_count = 0
      AND null_actual_count = 0
    THEN 1
    ELSE 0
  END AS check_pass
FROM summary
UNION ALL
SELECT
  'ym_sku_stock_conflict',
  q.ym,
  r.global_data_through_date,
  q.sku,
  q.row_count,
  0,
  q.distinct_theoretical_stock_count,
  q.distinct_actual_stock_count,
  q.distinct_stock_pair_count,
  0,
  0
FROM stock_quality q
CROSS JOIN selected_range r
WHERE q.sku IS NOT NULL
  AND (q.distinct_theoretical_stock_count > 1
   OR q.distinct_actual_stock_count > 1
   OR q.distinct_stock_pair_count > 1)
  ) stock_checks
ORDER BY stock_checks.check_name, stock_checks.sku;

-- Result set 5: a representative eligible SKU must be present in multiple countries.
WITH watermark AS (
  SELECT MAX(data_through_date) AS global_data_through_date
  FROM ads.ads_pdm_lx_hot_product_index_sku_d
), selected_range AS (
  SELECT
    DATE_FORMAT(global_data_through_date, '%Y-%m') AS effective_end_ym,
    global_data_through_date
  FROM watermark
), country_membership AS (
  SELECT
    m.sku,
    m.country,
    COUNT(*) AS membership_row_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.ym = r.effective_end_ym
    AND m.is_eligible = 1
    AND m.sku IS NOT NULL
    AND m.country IS NOT NULL
    AND TRIM(m.country) <> ''
  GROUP BY m.sku, m.country
), ranked_skus AS (
  SELECT
    sku,
    COUNT(DISTINCT country) AS country_count,
    ROW_NUMBER() OVER (
      ORDER BY COUNT(DISTINCT country) DESC, sku
    ) AS row_number
  FROM country_membership
  GROUP BY sku
), representative AS (
  SELECT sku, country_count
  FROM ranked_skus
  WHERE row_number = 1
), stock_observed AS (
  SELECT
    m.sku,
    COUNT(DISTINCT CONCAT(
      COALESCE(CAST(m.theoretical_stock_qty AS VARCHAR(64)), '<NULL>'),
      '|',
      COALESCE(CAST(m.actual_stock_qty AS VARCHAR(64)), '<NULL>')
    )) AS stock_pair_count,
    SUM(CASE WHEN m.theoretical_stock_qty IS NULL THEN 1 ELSE 0 END) AS null_theoretical_count,
    SUM(CASE WHEN m.actual_stock_qty IS NULL THEN 1 ELSE 0 END) AS null_actual_count
  FROM ads.ads_pdm_lx_hot_product_index_sku_m m
  CROSS JOIN selected_range r
  WHERE m.ym = r.effective_end_ym
    AND m.is_eligible = 1
    AND m.sku IS NOT NULL
  GROUP BY m.sku
), stock_quality AS (
  SELECT
    sku,
    stock_pair_count,
    CASE
      WHEN stock_pair_count = 1
        AND null_theoretical_count = 0
        AND null_actual_count = 0
      THEN 1
      ELSE 0
    END AS stock_consistent
  FROM stock_observed
), summary AS (
  SELECT
    r.effective_end_ym,
    r.global_data_through_date,
    COALESCE(MAX(c.sku), CAST(NULL AS VARCHAR(255))) AS representative_sku,
    COALESCE(MAX(c.country_count), 0) AS country_count,
    COALESCE(MAX(s.stock_pair_count), 0) AS stock_pair_count,
    COALESCE(MAX(s.stock_consistent), 0) AS stock_consistent
  FROM selected_range r
  LEFT JOIN representative c ON 1 = 1
  LEFT JOIN stock_quality s ON s.sku = c.sku
  GROUP BY r.effective_end_ym, r.global_data_through_date
)
SELECT *
FROM (
SELECT
  'representative_cross_country_sku' AS check_name,
  effective_end_ym,
  global_data_through_date,
  representative_sku AS sku,
  CAST(NULL AS VARCHAR(255)) AS country,
  country_count,
  CAST(NULL AS BIGINT) AS membership_row_count,
  stock_pair_count,
  stock_consistent,
  CASE
    WHEN country_count >= 2 AND stock_consistent = 1 THEN 1
    ELSE 0
  END AS within_contract,
  CASE
    WHEN country_count >= 2 AND stock_consistent = 1 THEN 1
    ELSE 0
  END AS check_pass
FROM summary
UNION ALL
SELECT
  'representative_country_membership',
  r.effective_end_ym,
  r.global_data_through_date,
  c.sku,
  c.country,
  p.country_count,
  c.membership_row_count,
  COALESCE(s.stock_pair_count, 0),
  COALESCE(s.stock_consistent, 0),
  CASE
    WHEN p.country_count >= 2 AND COALESCE(s.stock_consistent, 0) = 1 THEN 1
    ELSE 0
  END,
  CASE
    WHEN p.country_count >= 2 AND COALESCE(s.stock_consistent, 0) = 1 THEN 1
    ELSE 0
  END
FROM country_membership c
JOIN representative p ON p.sku = c.sku
LEFT JOIN stock_quality s ON s.sku = c.sku
CROSS JOIN selected_range r
  ) country_checks
ORDER BY country_checks.check_name, country_checks.sku, country_checks.country;
