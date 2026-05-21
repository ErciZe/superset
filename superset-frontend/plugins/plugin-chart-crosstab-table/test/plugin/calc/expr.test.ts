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
  ERR_CROSSTAB_CALC_DIALECT,
  ERR_CROSSTAB_CALC_FIELD,
  ERR_CROSSTAB_CALC_METRIC,
  emitCalculatedFieldSql,
} from '../../../src/plugin/calc/expr';
import type { CrosstabCalculatedField } from '../../../src/types';

const metricSql = {
  sales: 'SUM(sales_amount)',
  profit: 'SUM(gross_profit)',
};

const ratioField: CrosstabCalculatedField = {
  id: 'gross_margin_rate',
  label: '毛利率',
  template: 'ratio',
  inputs: { leftMetric: 'profit', rightMetric: 'sales' },
  semantic: 'ratio',
  formatString: '.2%',
};

test('emits Doris safe division for ratio', () => {
  expect(
    emitCalculatedFieldSql(ratioField, {
      dialect: 'doris',
      metricSql,
      parameterValues: {},
    }),
  ).toBe(
    '(CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END)',
  );
});

test('rejects quoted string literals in metric SQL', () => {
  expect(() =>
    emitCalculatedFieldSql(ratioField, {
      dialect: 'doris',
      metricSql: {
        sales: metricSql.sales,
        profit: "SUM(CASE WHEN state = 'CA' THEN gross_profit ELSE 0 END)",
      },
      parameterValues: {},
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test('emits difference', () => {
  expect(
    emitCalculatedFieldSql(
      {
        ...ratioField,
        id: 'gross_profit_delta',
        label: '毛利差',
        template: 'difference',
        semantic: 'additive',
      },
      {
        dialect: 'doris',
        metricSql,
        parameterValues: {},
      },
    ),
  ).toBe('(SUM(gross_profit) - SUM(sales_amount))');
});

test('emits parameterized ratio', () => {
  expect(
    emitCalculatedFieldSql(
      {
        ...ratioField,
        template: 'parameterized_ratio',
        inputs: {
          ...ratioField.inputs,
          parameterName: 'adjustmentRate',
        },
      },
      {
        dialect: 'doris',
        metricSql,
        parameterValues: { adjustmentRate: 1.25 },
      },
    ),
  ).toBe(
    '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
  );
});

test('rejects unsupported dialects', () => {
  expect(() =>
    emitCalculatedFieldSql(ratioField, {
      dialect: 'postgresql',
      metricSql,
      parameterValues: {},
    }),
  ).toThrow(ERR_CROSSTAB_CALC_DIALECT);
});

test('rejects missing metric references', () => {
  expect(() =>
    emitCalculatedFieldSql(ratioField, {
      dialect: 'doris',
      metricSql: { sales: metricSql.sales },
      parameterValues: {},
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test('rejects parameterized ratio without parameter name', () => {
  expect(() =>
    emitCalculatedFieldSql(
      {
        ...ratioField,
        template: 'parameterized_ratio',
      },
      {
        dialect: 'doris',
        metricSql,
        parameterValues: { adjustmentRate: 1.25 },
      },
    ),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects unsafe SQL metric expressions', () => {
  expect(() =>
    emitCalculatedFieldSql(ratioField, {
      dialect: 'doris',
      metricSql: {
        ...metricSql,
        profit: 'SUM(profit); DROP TABLE chart',
      },
      parameterValues: {},
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});
