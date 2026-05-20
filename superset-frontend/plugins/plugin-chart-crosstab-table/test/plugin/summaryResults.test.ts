/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  ERR_CROSSTAB_MISSING_SQL_SUMMARY,
  ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY,
  buildSummaryResultMap,
  getRequiredSummaryValue,
} from '../../src/plugin/summaryResults';

describe('crosstab summary results', () => {
  it('indexes row and column summary values with typed tuple keys', () => {
    const map = buildSummaryResultMap({
      records: [
        {
          metric_name_with_unit: '毛利率（%）',
          biz_date: '2025-01-01',
          指标值: -9.5145,
        },
      ],
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date'],
      metricFields: ['指标值'],
    });

    expect(
      getRequiredSummaryValue(map, {
        rowValues: ['毛利率（%）'],
        columnValues: ['2025-01-01'],
        metric: '指标值',
      }),
    ).toBe(-9.5145);
  });

  it('fails fast when a required summary value is missing', () => {
    const map = buildSummaryResultMap({
      records: [],
      rowFields: ['metric_name_with_unit'],
      columnFields: [],
      metricFields: ['指标值'],
    });

    expect(() =>
      getRequiredSummaryValue(map, {
        rowValues: ['毛利率（%）'],
        columnValues: [],
        metric: '指标值',
      }),
    ).toThrow(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  });

  it('fails fast when a SQL summary value is not numeric', () => {
    expect(() =>
      buildSummaryResultMap({
        records: [{ metric_name_with_unit: '毛利率（%）', 指标值: 'bad' }],
        rowFields: ['metric_name_with_unit'],
        columnFields: [],
        metricFields: ['指标值'],
      }),
    ).toThrow(ERR_CROSSTAB_NON_NUMERIC_SQL_SUMMARY);
  });

  it('fails fast when a SQL summary record is missing the metric field', () => {
    expect(() =>
      buildSummaryResultMap({
        records: [{ metric_name_with_unit: '毛利率（%）' }],
        rowFields: ['metric_name_with_unit'],
        columnFields: [],
        metricFields: ['指标值'],
      }),
    ).toThrow(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  });

  it('indexes null SQL summary values and returns null', () => {
    const map = buildSummaryResultMap({
      records: [{ metric_name_with_unit: '毛利率（%）', 指标值: null }],
      rowFields: ['metric_name_with_unit'],
      columnFields: [],
      metricFields: ['指标值'],
    });

    expect(
      getRequiredSummaryValue(map, {
        rowValues: ['毛利率（%）'],
        columnValues: [],
        metric: '指标值',
      }),
    ).toBeNull();
  });
});
