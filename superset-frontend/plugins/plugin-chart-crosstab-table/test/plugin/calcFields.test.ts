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
  ERR_CROSSTAB_CALC_FIELD,
  expandCalculatedFieldMetricConfigs,
  getCalculatedFields,
  getCalculatedFieldsSignature,
} from '../../src/plugin/calcFields';
import { ERR_CROSSTAB_CALC_METRIC } from '../../src/plugin/calc/expr';
import type {
  CrosstabCalculatedField,
  CrosstabFormData,
  CrosstabV4CalculatedField,
  MetricFieldConfig,
} from '../../src/types';

const metricConfigs: MetricFieldConfig[] = [
  {
    metric: {
      expressionType: 'SQL',
      label: 'sales',
      sqlExpression: 'SUM(sales_amount)',
    },
    label: '销售额',
    semantic: 'additive',
  },
  {
    metric: {
      expressionType: 'SQL',
      label: 'profit',
      sqlExpression: 'SUM(gross_profit)',
    },
    label: '毛利',
    semantic: 'additive',
  },
];

const calculatedField: CrosstabV4CalculatedField = {
  id: 'calc_margin_pct',
  name: '毛利率调整',
  resultType: 'percent',
  formatString: '.2%',
  ast: {
    kind: 'pct',
    numerator: { kind: 'metric_ref', metricId: 'profit' },
    denominator: { kind: 'metric_ref', metricId: 'sales' },
  },
};

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  crosstabCalculatedFields: [calculatedField],
};

test('expands canonical AST calculated fields into SQL metric configs', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs: [
      ...metricConfigs,
      {
        metric: '毛利率调整',
        label: '毛利率调整',
        calculatedFieldId: 'calc_margin_pct',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs).toHaveLength(3);
  expect(result.metricConfigs[2]).toEqual({
    metric: {
      expressionType: 'SQL',
      label: '毛利率调整',
      sqlExpression:
        '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
    },
    label: '毛利率调整',
    semantic: 'ratio',
    formatString: '.2%',
  });
});

test('removes calculated field placeholders that use canonical ids', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs: [
      ...metricConfigs,
      {
        metric: 'calc_margin_pct',
        label: 'calc_margin_pct',
        calculatedFieldId: 'calc_margin_pct',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs).toHaveLength(3);
  expect(result.metricConfigs[2].label).toBe('毛利率调整');
  expect(result.metricConfigs[2].metric).toMatchObject({
    expressionType: 'SQL',
    label: '毛利率调整',
  });
});

test('expands calculated fields that reference selected saved metric names', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData: {
      ...formData,
      datasource: {
        metrics: [
          { metric_name: 'saved_sales', expression: 'SUM(sales_amount)' },
          { metric_name: 'saved_profit', expression: 'SUM(gross_profit)' },
        ],
      },
      crosstabCalculatedFields: [
        {
          ...calculatedField,
          ast: {
            kind: 'pct',
            numerator: { kind: 'metric_ref', metricId: 'saved_profit' },
            denominator: { kind: 'metric_ref', metricId: 'saved_sales' },
          },
        },
      ],
    } as unknown as CrosstabFormData,
    metricConfigs: [
      { metric: 'saved_sales', label: 'Saved sales' },
      { metric: 'saved_profit', label: 'Saved profit' },
      {
        metric: '毛利率调整',
        label: '毛利率调整',
        calculatedFieldId: 'calc_margin_pct',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs[2].metric).toEqual({
    expressionType: 'SQL',
    label: '毛利率调整',
    sqlExpression:
      '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
  });
});

test('expands calculated fields that reference hidden datasource saved metrics', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData: {
      ...formData,
      datasourceMetrics: [
        {
          metric_name: 'v4_gross_profit_sum',
          verbose_name: 'V4毛利',
          expression: 'SUM(gross_profit)',
        },
        {
          metric_name: 'v4_sales_amount_sum',
          verbose_name: 'V4销售额',
          expression: 'SUM(sales_amount)',
        },
      ],
      crosstabCalculatedFields: [
        {
          id: 'calc_margin_pct_v4',
          name: 'V4示例毛利率',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: {
              kind: 'metric_ref',
              metricId: 'v4_gross_profit_sum',
            },
            denominator: {
              kind: 'metric_ref',
              metricId: 'v4_sales_amount_sum',
            },
          },
        },
      ],
    } as unknown as CrosstabFormData,
    metricConfigs: [
      {
        metric: 'V4示例毛利率',
        label: 'V4示例毛利率',
        calculatedFieldId: 'calc_margin_pct_v4',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs).toEqual([
    {
      metric: {
        expressionType: 'SQL',
        label: 'V4示例毛利率',
        sqlExpression:
          '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
      },
      label: 'V4示例毛利率',
      semantic: 'ratio',
      formatString: '.2%',
    },
  ]);
});

test('prefers legacy SQL metrics over datasource saved metrics for hidden calculated dependencies', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData: {
      ...formData,
      metrics: [
        {
          expressionType: 'SQL',
          label: 'v4_gross_profit_sum',
          sqlExpression: 'SUM(legacy_gross_profit)',
        },
        {
          expressionType: 'SQL',
          label: 'v4_sales_amount_sum',
          sqlExpression: 'SUM(legacy_sales_amount)',
        },
      ],
      datasourceMetrics: [
        {
          metric_name: 'v4_gross_profit_sum',
          verbose_name: 'V4毛利',
          expression: 'SUM(datasource_gross_profit)',
        },
        {
          metric_name: 'v4_sales_amount_sum',
          verbose_name: 'V4销售额',
          expression: 'SUM(datasource_sales_amount)',
        },
      ],
      crosstabCalculatedFields: [
        {
          id: 'calc_margin_pct_v4',
          name: 'V4示例毛利率',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: {
              kind: 'metric_ref',
              metricId: 'v4_gross_profit_sum',
            },
            denominator: {
              kind: 'metric_ref',
              metricId: 'v4_sales_amount_sum',
            },
          },
        },
      ],
    } as unknown as CrosstabFormData,
    metricConfigs: [
      {
        metric: 'V4示例毛利率',
        label: 'V4示例毛利率',
        calculatedFieldId: 'calc_margin_pct_v4',
      },
    ],
    parameterValues: { number: {}, text: {} },
  });

  expect(result.metricConfigs).toEqual([
    {
      metric: {
        expressionType: 'SQL',
        label: 'V4示例毛利率',
        sqlExpression:
          '((CASE WHEN SUM(legacy_sales_amount) = 0 THEN NULL ELSE SUM(legacy_gross_profit) / SUM(legacy_sales_amount) END) * 100)',
      },
      label: 'V4示例毛利率',
      semantic: 'ratio',
      formatString: '.2%',
    },
  ]);
});

test('rejects conflicting datasource saved metric aliases for calculated dependencies', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        datasourceMetrics: [
          {
            metric_name: 'v4_gross_profit_sum',
            verbose_name: 'V4毛利',
            expression: 'SUM(datasource_gross_profit)',
          },
          {
            label: 'v4_gross_profit_sum',
            verbose_name: 'V4毛利冲突',
            expression: 'SUM(conflicting_gross_profit)',
          },
          {
            metric_name: 'v4_sales_amount_sum',
            verbose_name: 'V4销售额',
            expression: 'SUM(datasource_sales_amount)',
          },
        ],
        crosstabCalculatedFields: [
          {
            id: 'calc_margin_pct_v4',
            name: 'V4示例毛利率',
            resultType: 'percent',
            formatString: '.2%',
            ast: {
              kind: 'pct',
              numerator: {
                kind: 'metric_ref',
                metricId: 'v4_gross_profit_sum',
              },
              denominator: {
                kind: 'metric_ref',
                metricId: 'v4_sales_amount_sum',
              },
            },
          },
        ],
      } as unknown as CrosstabFormData,
      metricConfigs: [
        {
          metric: 'V4示例毛利率',
          label: 'V4示例毛利率',
          calculatedFieldId: 'calc_margin_pct_v4',
        },
      ],
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test('fails fast when saved metric SQL cannot be resolved', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData,
      metricConfigs: [
        { metric: 'saved_sales' },
        { metric: 'saved_profit' },
        {
          metric: '毛利率调整',
          label: '毛利率调整',
          calculatedFieldId: 'calc_margin_pct',
        },
      ],
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow('ERR_CROSSTAB_CALC_METRIC');
});

test('rejects duplicate calculated field ids', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: [
          calculatedField,
          {
            ...calculatedField,
            name: '另一个毛利率调整',
          },
        ],
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects duplicate calculated field names', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: [
          calculatedField,
          {
            ...calculatedField,
            id: 'calc_margin_pct_copy',
          },
        ],
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects cross collisions between calculated field ids and names', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: [
          {
            id: 'calc_a',
            name: 'calc_b_name',
            resultType: 'number',
            ast: { kind: 'metric_ref', metricId: 'profit' },
          },
          {
            id: 'calc_b',
            name: 'calc_a',
            resultType: 'number',
            ast: { kind: 'metric_ref', metricId: 'sales' },
          },
        ],
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects recursive calculated field references', () => {
  const recursiveFields: CrosstabV4CalculatedField[] = [
    {
      id: 'calc_a',
      name: '计算A',
      resultType: 'number',
      ast: { kind: 'metric_ref', metricId: 'calc_b' },
    },
    {
      id: 'calc_b',
      name: '计算B',
      resultType: 'number',
      ast: { kind: 'metric_ref', metricId: 'calc_a' },
    },
  ];

  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: recursiveFields,
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects malformed canonical field shapes', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: [
          {
            id: 'calc_bad',
            name: '畸形字段',
            resultType: 'currency',
            ast: { kind: 'metric_ref', metricId: 'sales' },
          },
        ] as unknown as CrosstabV4CalculatedField[],
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects malformed calculated field AST during normalization', () => {
  const malformedAstFormData = {
    ...formData,
    crosstabCalculatedFields: [
      {
        ...calculatedField,
        ast: { kind: 'metric_ref' },
      },
    ],
  } as unknown as CrosstabFormData;

  expect(() => getCalculatedFields(malformedAstFormData)).toThrow(
    ERR_CROSSTAB_CALC_FIELD,
  );
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: malformedAstFormData,
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects calculated field ids that collide with base metric labels', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: [
          {
            ...calculatedField,
            id: 'sales',
            resultType: 'number',
            ast: { kind: 'metric_ref', metricId: 'profit' },
          },
        ],
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('changes signature when number or text parameter values change', () => {
  const baseSignature = getCalculatedFieldsSignature([calculatedField], {
    number: { adjustmentRate: 1.25 },
    text: { scenario: 'base' },
  });

  expect(
    getCalculatedFieldsSignature([calculatedField], {
      number: { adjustmentRate: 1.5 },
      text: { scenario: 'base' },
    }),
  ).not.toBe(baseSignature);
  expect(
    getCalculatedFieldsSignature([calculatedField], {
      number: { adjustmentRate: 1.25 },
      text: { scenario: 'stress' },
    }),
  ).not.toBe(baseSignature);
});

test('creates deterministic signatures for reordered parameter keys', () => {
  const signature = getCalculatedFieldsSignature([calculatedField], {
    number: {
      secondaryRate: 0.8,
      adjustmentRate: 1.25,
    },
    text: {
      scenario: 'base',
      region: '华东',
    },
  });
  const reorderedSignature = getCalculatedFieldsSignature([calculatedField], {
    number: {
      adjustmentRate: 1.25,
      secondaryRate: 0.8,
    },
    text: {
      region: '华东',
      scenario: 'base',
    },
  });

  expect(reorderedSignature).toBe(signature);
});

test('rejects legacy calculatedFields on the strict canonical path', () => {
  const legacyField: CrosstabCalculatedField = {
    id: 'adjusted_margin',
    label: '含参毛利率',
    template: 'parameterized_ratio',
    inputs: {
      leftMetric: 'profit',
      rightMetric: 'sales',
      parameterName: 'adjustmentRate',
    },
    semantic: 'ratio',
    formatString: '.2%',
  };

  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: undefined,
        calculatedFields: [legacyField],
      },
      metricConfigs,
      parameterValues: { number: { adjustmentRate: 1.25 }, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects V4-shaped data under legacy calculatedFields', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        crosstabCalculatedFields: undefined,
        calculatedFields: [
          calculatedField,
        ] as unknown as CrosstabCalculatedField[],
      },
      metricConfigs,
      parameterValues: { number: {}, text: {} },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});
