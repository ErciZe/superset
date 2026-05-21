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
  getCalculatedFieldsSignature,
} from '../../src/plugin/calcFields';
import type {
  CrosstabCalculatedField,
  CrosstabFormData,
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

const calculatedField: CrosstabCalculatedField = {
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

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  calculatedFields: [calculatedField],
};

test('expands calculated fields into SQL metric configs', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs,
    parameterValues: { adjustmentRate: 1.25 },
  });

  expect(result.metricConfigs).toHaveLength(3);
  expect(result.metricConfigs[2]).toEqual({
    metric: {
      expressionType: 'SQL',
      label: '含参毛利率',
      sqlExpression:
        '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
    },
    label: '含参毛利率',
    semantic: 'ratio',
    formatString: '.2%',
  });
});

test('replaces calculated field metric placeholders with generated SQL metrics', () => {
  const result = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs: [
      ...metricConfigs,
      {
        metric: '含参毛利率',
        label: '含参毛利率',
        semantic: 'ratio',
        formatString: '.2%',
        calculatedFieldId: 'adjusted_margin',
      },
    ],
    parameterValues: { adjustmentRate: 1.25 },
  });

  expect(result.metricConfigs).toHaveLength(3);
  expect(result.metricConfigs[2]).toEqual({
    metric: {
      expressionType: 'SQL',
      label: '含参毛利率',
      sqlExpression:
        '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
    },
    label: '含参毛利率',
    semantic: 'ratio',
    formatString: '.2%',
  });
});

test('rejects real string metric labels that duplicate calculated fields', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData,
      metricConfigs: [
        ...metricConfigs,
        {
          metric: '含参毛利率',
          label: '含参毛利率',
          semantic: 'ratio',
          formatString: '.2%',
        },
      ],
      parameterValues: { adjustmentRate: 1.25 },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('creates stable signatures including parameter value', () => {
  const signature = getCalculatedFieldsSignature([calculatedField], {
    adjustmentRate: 1.25,
  });

  expect(signature).toContain('adjusted_margin');
  expect(signature).toContain('adjustmentRate=1.25');
});

test('rejects duplicate calculated field labels', () => {
  expect(() =>
    expandCalculatedFieldMetricConfigs({
      dialect: 'doris',
      formData: {
        ...formData,
        calculatedFields: [{ ...calculatedField, label: '销售额' }],
      },
      metricConfigs,
      parameterValues: { adjustmentRate: 1.25 },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});
