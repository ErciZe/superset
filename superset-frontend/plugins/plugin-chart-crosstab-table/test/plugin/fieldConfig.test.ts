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
import type {
  CrosstabFormData,
  MetricFieldConfig,
  MetricSemanticOverride,
} from '../../src/types';
import {
  getCrosstabColumnColumns,
  getCrosstabColumnConfigs,
  getCrosstabFieldLabels,
  getCrosstabMetricConfigs,
  getCrosstabMetrics,
  getPersistedCrosstabMetricConfigs,
  getEffectiveCrosstabMetricConfigs,
  getCrosstabRowColumns,
  getCrosstabRowConfigs,
  getCrosstabRowSubtotalDepths,
  getCrosstabRowValueSummaries,
  getCrosstabSemanticOverrideField,
  getCrosstabSemanticOverrides,
  ERR_CROSSTAB_V4_METRIC_CONFIG,
} from '../../src/plugin/fieldConfig';

function createFormData(
  overrides: Partial<CrosstabFormData> = {},
): CrosstabFormData {
  return {
    datasource: '1__table',
    viz_type: 'crosstab_table',
    ...overrides,
  };
}

describe('crosstab field config', () => {
  test('uses crosstabFieldConfig before legacy controls', () => {
    const formData = createFormData({
      groupbyRows: ['legacy_row'],
      groupbyColumns: ['legacy_column'],
      metrics: ['legacy_metric'],
      crosstabFieldConfig: {
        rows: [{ field: 'row_a', label: 'Row A' }],
        columns: [{ field: 'column_a', label: 'Column A' }],
        metrics: [{ metric: 'metric_a', label: 'Metric A' }],
      },
    });

    expect(getCrosstabRowColumns(formData)).toEqual(['row_a']);
    expect(getCrosstabColumnColumns(formData)).toEqual(['column_a']);
    expect(getCrosstabMetrics(formData)).toEqual(['metric_a']);
    expect(getCrosstabFieldLabels(formData)).toEqual({
      row_a: 'Row A',
      column_a: 'Column A',
      metric_a: 'Metric A',
    });
  });

  test('falls back to legacy controls when canonical config is empty', () => {
    const formData = createFormData({
      groupbyRows: ['legacy_row'],
      groupbyColumns: ['legacy_column'],
      metrics: ['legacy_metric'],
      crosstabFieldConfig: {
        rows: [],
        columns: [],
        metrics: [],
      },
    });

    expect(getCrosstabRowColumns(formData)).toEqual(['legacy_row']);
    expect(getCrosstabColumnColumns(formData)).toEqual(['legacy_column']);
    expect(getCrosstabMetrics(formData)).toEqual(['legacy_metric']);
    expect(getCrosstabFieldLabels(formData)).toEqual({});
  });

  test('derives row subtotal depths from row field switches', () => {
    const formData = createFormData({
      crosstabFieldConfig: {
        rows: [
          { field: 'country', showSubtotal: true },
          { field: 'shop', showSubtotal: false },
          { field: 'sku', showSubtotal: true },
        ],
      },
    });

    expect(getCrosstabRowSubtotalDepths(formData)).toEqual([1]);
  });

  test('extracts metric semantic config without falling back to legacy metrics', () => {
    const metricConfigs: MetricFieldConfig[] = [
      { metric: 'amount', semantic: 'additive' },
      { metric: 'margin_rate', semantic: 'ratio' },
    ];
    const formData = createFormData({
      metrics: ['legacy_metric'],
      crosstabFieldConfig: {
        metrics: metricConfigs,
      },
    });

    expect(getCrosstabMetricConfigs(formData)).toEqual(metricConfigs);
  });

  test('returns persisted metric configs unchanged', () => {
    const metricConfigs: MetricFieldConfig[] = [
      {
        metric: 'amount',
        label: 'Amount',
        semantic: 'additive',
      },
      {
        metric: {
          expressionType: 'SIMPLE',
          column: {
            column_name: 'margin_rate',
            type: 'DOUBLE',
          },
          aggregate: 'AVG',
          label: 'Margin Rate',
        },
        label: 'Margin Rate %',
        semantic: 'average',
      },
    ];
    const formData = createFormData({
      crosstabFieldConfig: {
        metrics: metricConfigs,
      },
    });

    expect(getPersistedCrosstabMetricConfigs(formData)).toBe(metricConfigs);
    expect(getPersistedCrosstabMetricConfigs(formData)).toEqual([
      expect.objectContaining({
        metric: 'amount',
        label: 'Amount',
        semantic: 'additive',
      }),
      expect.objectContaining({
        metric: expect.objectContaining({
          label: 'Margin Rate',
        }),
        label: 'Margin Rate %',
        semantic: 'average',
      }),
    ]);
  });

  test('requires persisted metric configs for canonical v4 charts', () => {
    expect(() =>
      getEffectiveCrosstabMetricConfigs(
        createFormData({
          crosstabParameters: [
            {
              id: 'param_adjustment',
              kind: 'number',
              name: 'adjustmentRate',
              label: 'Adjustment',
              defaultValue: 1,
            },
          ],
          crosstabFieldConfig: {
            rows: [{ field: 'metric_name_with_unit' }],
            columns: [{ field: 'biz_date' }],
            metrics: [],
          },
        }),
      ),
    ).toThrow(ERR_CROSSTAB_V4_METRIC_CONFIG);
  });

  test('keeps legacy metric fallback when canonical v4 arrays are cleared', () => {
    expect(
      getEffectiveCrosstabMetricConfigs(
        createFormData({
          metrics: ['legacy_amount'],
          crosstabParameters: [],
          crosstabCalculatedFields: [],
          crosstabFieldConfig: {
            rows: [{ field: 'metric_name_with_unit' }],
            columns: [{ field: 'biz_date' }],
            metrics: [],
          },
        }),
      ),
    ).toEqual([{ metric: 'legacy_amount' }]);
  });

  test('extracts semantic override config with empty defaults', () => {
    const semanticOverrides: MetricSemanticOverride[] = [
      { value: '销售额（金额）', semantic: 'additive' },
      { value: '毛利率（%）', semantic: 'ratio' },
    ];
    const formData = createFormData({
      crosstabFieldConfig: {
        semanticOverrideField: 'metric_name_with_unit',
        semanticOverrides,
      },
    });

    expect(getCrosstabSemanticOverrideField(formData)).toBe(
      'metric_name_with_unit',
    );
    expect(getCrosstabSemanticOverrides(formData)).toEqual(semanticOverrides);
    expect(getCrosstabSemanticOverrideField(createFormData())).toBeUndefined();
    expect(getCrosstabSemanticOverrides(createFormData())).toEqual([]);
  });

  test('returns configured row and column dimension configs with sort metadata', () => {
    const formData = {
      crosstabFieldConfig: {
        rows: [
          {
            field: 'metric_name_with_unit',
            label: '指标',
            sort: {
              by: 'metric_order',
              direction: 'asc',
              type: 'number',
              nulls: 'last',
            },
          },
        ],
        columns: [
          {
            field: 'biz_date',
            label: '日期',
            sort: {
              by: 'biz_date',
              direction: 'desc',
              type: 'date',
              nulls: 'last',
            },
          },
        ],
        metrics: [{ metric: '指标值', semantic: 'additive' }],
      },
    } as CrosstabFormData;

    expect(getCrosstabRowConfigs(formData)).toEqual([
      {
        field: 'metric_name_with_unit',
        label: '指标',
        sort: {
          by: 'metric_order',
          direction: 'asc',
          type: 'number',
          nulls: 'last',
        },
      },
    ]);
    expect(getCrosstabColumnConfigs(formData)).toEqual([
      {
        field: 'biz_date',
        label: '日期',
        sort: {
          by: 'biz_date',
          direction: 'desc',
          type: 'date',
          nulls: 'last',
        },
      },
    ]);
  });

  test('returns configured row value summaries before legacy semantic overrides', () => {
    const formData = {
      crosstabFieldConfig: {
        rowValueSummaries: {
          field: 'metric_name_with_unit',
          values: [
            { value: '销量（件）', semantic: 'additive' },
            { value: '毛利率（%）', semantic: 'ratio', formatString: '.2%' },
          ],
        },
        semanticOverrideField: 'metric_name_with_unit',
        semanticOverrides: [{ value: '毛利率（%）', semantic: 'additive' }],
      },
    } as CrosstabFormData;

    expect(getCrosstabRowValueSummaries(formData)).toEqual({
      field: 'metric_name_with_unit',
      values: [
        { value: '销量（件）', semantic: 'additive' },
        { value: '毛利率（%）', semantic: 'ratio', formatString: '.2%' },
      ],
    });
  });
});
