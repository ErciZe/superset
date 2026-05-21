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
  CrosstabDynamicMetricConfig,
  CrosstabFormData,
  CrosstabOwnState,
  MetricFieldConfig,
} from '../../src/types';
import {
  ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG,
  ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE,
  ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS,
  ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT,
  ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION,
  getMetricConfigSignature,
  resolveDynamicMetricConfigs,
} from '../../src/plugin/dynamicMetric';

function createFormData(
  overrides: Partial<CrosstabFormData> = {},
): CrosstabFormData {
  return {
    datasource: '1__table',
    viz_type: 'crosstab_table',
    ...overrides,
  };
}

const persistedMetrics: MetricFieldConfig[] = [
  { metric: 'sales', label: 'Sales', semantic: 'additive' },
  { metric: 'placeholder', label: 'Placeholder', semantic: 'unknown' },
];

const dynamicMetricConfig: CrosstabDynamicMetricConfig = {
  enabled: true,
  slots: [
    {
      id: 'primary',
      label: 'Primary metric',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'margin',
      options: [
        {
          id: 'margin',
          label: 'Margin',
          metrics: [
            { metric: 'margin', label: 'Margin', semantic: 'additive' },
          ],
        },
        {
          id: 'profit_rate',
          label: 'Profit rate',
          metrics: [
            { metric: 'profit_rate', label: 'Profit Rate', semantic: 'ratio' },
          ],
        },
      ],
    },
  ],
};

function resolve(
  formData: CrosstabFormData,
  metricConfigs: MetricFieldConfig[] = persistedMetrics,
  ownState?: CrosstabOwnState,
) {
  return resolveDynamicMetricConfigs({
    formData,
    metricConfigs,
    ownState,
  });
}

describe('dynamic metric resolver', () => {
  it('returns persisted metrics and signature when config is disabled', () => {
    const result = resolve(
      createFormData({
        dynamicMetric: {
          enabled: false,
          slots: [],
        },
      }),
    );

    expect(result.metricConfigs).toBe(persistedMetrics);
    expect(result.config).toBeUndefined();
    expect(result.selectedDynamicMetric).toBeUndefined();
    expect(result.signature).toBe(getMetricConfigSignature(persistedMetrics));
  });

  it('uses default option selection', () => {
    const result = resolve(
      createFormData({
        dynamicMetric: dynamicMetricConfig,
      }),
    );

    expect(result.metricConfigs).toEqual([
      { metric: 'sales', label: 'Sales', semantic: 'additive' },
      { metric: 'margin', label: 'Margin', semantic: 'additive' },
    ]);
    expect(result.selectedDynamicMetric).toEqual({ primary: 'margin' });
    expect(result.signature).toBe(
      getMetricConfigSignature(result.metricConfigs),
    );
  });

  it('uses runtime selected option from ownState', () => {
    const result = resolve(
      createFormData({
        dynamicMetric: dynamicMetricConfig,
      }),
      persistedMetrics,
      {
        selectedDynamicMetric: {
          primary: 'profit_rate',
        },
      },
    );

    expect(result.metricConfigs).toEqual([
      { metric: 'sales', label: 'Sales', semantic: 'additive' },
      { metric: 'profit_rate', label: 'Profit Rate', semantic: 'ratio' },
    ]);
    expect(result.selectedDynamicMetric).toEqual({ primary: 'profit_rate' });
    expect(result.signature).toBe(
      getMetricConfigSignature(result.metricConfigs),
    );
  });

  it('parses string config', () => {
    const result = resolve(
      createFormData({
        dynamicMetric: JSON.stringify(dynamicMetricConfig),
      }),
    );

    expect(result.config).toEqual(dynamicMetricConfig);
    expect(result.selectedDynamicMetric).toEqual({ primary: 'margin' });
  });

  it('rejects enabled config with no slots', () => {
    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: {
            enabled: true,
            slots: [],
          },
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  });

  it('rejects invalid metric objects in dynamic metric options', () => {
    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: {
            enabled: true,
            slots: [
              {
                id: 'primary',
                slotIndex: 1,
                spliceCount: 1,
                defaultOptionId: 'broken',
                options: [
                  {
                    id: 'broken',
                    label: 'Broken',
                    metrics: [{ metric: {}, label: 'Broken' }],
                  },
                ],
              },
            ],
          } as unknown as CrosstabDynamicMetricConfig,
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  });

  it('rejects invalid metric semantic values', () => {
    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: {
            enabled: true,
            slots: [
              {
                id: 'primary',
                slotIndex: 1,
                spliceCount: 1,
                defaultOptionId: 'broken',
                options: [
                  {
                    id: 'broken',
                    label: 'Broken',
                    metrics: [
                      {
                        metric: 'broken',
                        label: 'Broken',
                        semantic: 'median',
                      },
                    ],
                  },
                ],
              },
            ],
          } as unknown as CrosstabDynamicMetricConfig,
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_CONFIG);
  });

  it('rejects splice count mismatches', () => {
    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: {
            enabled: true,
            slots: [
              {
                id: 'primary',
                slotIndex: 1,
                spliceCount: 1,
                defaultOptionId: 'wide',
                options: [
                  {
                    id: 'wide',
                    label: 'Wide',
                    metrics: [
                      { metric: 'margin', label: 'Margin' },
                      { metric: 'profit_rate', label: 'Profit Rate' },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_SPLICE_COUNT);
  });

  it('rejects duplicate effective metric labels', () => {
    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: dynamicMetricConfig,
        }),
        [
          { metric: 'sales', label: 'Sales' },
          { metric: 'placeholder', label: 'Placeholder' },
          { metric: 'other_sales', label: 'Margin' },
        ],
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_DUPLICATE);
  });

  it('changes signature for the same label with different metrics', () => {
    expect(
      getMetricConfigSignature([{ metric: 'sales', label: 'Value' }]),
    ).not.toBe(
      getMetricConfigSignature([{ metric: 'margin', label: 'Value' }]),
    );
  });

  it('changes signature for the same label with different semantics', () => {
    expect(
      getMetricConfigSignature([
        { metric: 'sales', label: 'Value', semantic: 'additive' },
      ]),
    ).not.toBe(
      getMetricConfigSignature([
        { metric: 'sales', label: 'Value', semantic: 'ratio' },
      ]),
    );
  });

  it('rejects effective metric count above the limit', () => {
    const tooManyMetrics = Array.from({ length: 9 }, (_, index) => ({
      metric: `metric_${index}`,
      label: `Metric ${index}`,
    }));

    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: {
            enabled: true,
            slots: [
              {
                id: 'primary',
                slotIndex: 0,
                spliceCount: 1,
                defaultOptionId: 'metric_0',
                options: [
                  {
                    id: 'metric_0',
                    label: 'Metric 0',
                    metrics: [{ metric: 'metric_0', label: 'Metric 0' }],
                  },
                ],
              },
            ],
          },
        }),
        tooManyMetrics,
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_MAX_METRICS);
  });

  it('rejects unknown selected options', () => {
    expect(() =>
      resolve(
        createFormData({
          dynamicMetric: dynamicMetricConfig,
        }),
        persistedMetrics,
        {
          selectedDynamicMetric: {
            primary: 'missing',
          },
        },
      ),
    ).toThrow(ERR_CROSSTAB_DYNAMIC_METRIC_UNKNOWN_OPTION);
  });
});
