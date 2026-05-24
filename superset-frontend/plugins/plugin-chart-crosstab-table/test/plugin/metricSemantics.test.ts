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
  ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC,
  hasConfiguredSummarySemantics,
  resolveMetricSemantic,
  validateSummarySemantics,
} from '../../src/plugin/metricSemantics';

describe('crosstab metric semantics', () => {
  it('defaults metrics without semantics to unknown', () => {
    expect(
      resolveMetricSemantic({
        metric: '指标值',
        metricConfigs: [{ metric: '指标值' }],
      }),
    ).toBe('unknown');
  });

  it('uses the metric default semantic when no row override matches', () => {
    expect(
      resolveMetricSemantic({
        metric: 'amount',
        metricConfigs: [{ metric: 'amount', semantic: 'additive' }],
      }),
    ).toBe('additive');
  });

  it('uses row-value overrides for production metric rows', () => {
    expect(
      resolveMetricSemantic({
        metric: '指标值',
        row: { metric_name_with_unit: '毛利率（%）' },
        metricConfigs: [{ metric: '指标值', semantic: 'unknown' }],
        semanticOverrideField: 'metric_name_with_unit',
        semanticOverrides: [
          { value: '销售额（金额）', semantic: 'additive' },
          { value: '毛利率（%）', semantic: 'ratio' },
        ],
      }),
    ).toBe('ratio');
  });

  it('resolves row value summaries before legacy semantic overrides', () => {
    const semantic = resolveMetricSemantic({
      metric: '指标值',
      row: { metric_name_with_unit: '毛利率（%）' },
      metricConfigs: [{ metric: '指标值', semantic: 'additive' }],
      rowValueSummaries: {
        field: 'metric_name_with_unit',
        values: [{ value: '毛利率（%）', semantic: 'ratio' }],
      },
      semanticOverrideField: 'metric_name_with_unit',
      semanticOverrides: [{ value: '毛利率（%）', semantic: 'additive' }],
    });

    expect(semantic).toBe('ratio');
  });

  it('treats row value summaries as requiring SQL summaries even when additive', () => {
    expect(
      hasConfiguredSummarySemantics(
        [{ metric: '指标值', semantic: 'additive' }],
        [],
        {
          field: 'metric_name_with_unit',
          values: [{ value: '销量（件）', semantic: 'additive' }],
        },
      ),
    ).toBe(true);
  });

  it('fails fast when summaries include an unknown semantic', () => {
    expect(() =>
      validateSummarySemantics([
        { metric: '指标值', semantic: 'unknown', summaryLabel: 'row total' },
      ]),
    ).toThrow(ERR_CROSSTAB_UNKNOWN_METRIC_SEMANTIC);
  });
});
