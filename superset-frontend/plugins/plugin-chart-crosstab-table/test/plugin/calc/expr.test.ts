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
  emitCalculatedFieldAstSql,
  emitCalculatedFieldSql,
  validateCalculatedFieldAst,
} from '../../../src/plugin/calc/expr';
import type {
  CrosstabCalculatedField,
  CrosstabExpressionNode,
  CrosstabV4CalculatedField,
} from '../../../src/types';

const metricSql = {
  sales: 'SUM(sales_amount)',
  profit: 'SUM(gross_profit)',
  orders: 'COUNT(order_id)',
};

const parameterValues = {
  number: {
    multiplier: 1.25,
    offset: 10,
  },
  text: {
    region: 'west',
  },
};

function field(
  ast: CrosstabExpressionNode,
  resultType: CrosstabV4CalculatedField['resultType'] = 'number',
): CrosstabV4CalculatedField {
  return {
    id: 'gross_margin_rate',
    name: '毛利率',
    resultType,
    ast,
  };
}

function emit(ast: CrosstabExpressionNode): string {
  return emitCalculatedFieldAstSql(field(ast), {
    dialect: 'doris',
    metricSql,
    parameterValues,
  });
}

test('safe_div metric refs emits Doris safe division', () => {
  expect(
    emit({
      kind: 'safe_div',
      numerator: { kind: 'metric_ref', metricId: 'profit' },
      denominator: { kind: 'metric_ref', metricId: 'sales' },
    }),
  ).toBe(
    '(CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END)',
  );
});

test('pct emits safe division times 100', () => {
  expect(
    emit({
      kind: 'pct',
      numerator: { kind: 'metric_ref', metricId: 'profit' },
      denominator: { kind: 'metric_ref', metricId: 'sales' },
    }),
  ).toBe(
    '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
  );
});

test('ratio behaves as safe division', () => {
  expect(
    emit({
      kind: 'ratio',
      numerator: { kind: 'metric_ref', metricId: 'profit' },
      denominator: { kind: 'metric_ref', metricId: 'orders' },
    }),
  ).toBe(
    '(CASE WHEN COUNT(order_id) = 0 THEN NULL ELSE SUM(gross_profit) / COUNT(order_id) END)',
  );
});

test('emits binary arithmetic with number params', () => {
  expect(
    emit({
      kind: 'binary_op',
      op: '+',
      left: {
        kind: 'binary_op',
        op: '*',
        left: { kind: 'metric_ref', metricId: 'profit' },
        right: { kind: 'number_param', parameterId: 'multiplier' },
      },
      right: { kind: 'number_param', parameterId: 'offset' },
    }),
  ).toBe('((SUM(gross_profit) * 1.25) + 10)');
});

test('rejects missing metrics', () => {
  expect(() =>
    emit({
      kind: 'safe_div',
      numerator: { kind: 'metric_ref', metricId: 'missing_metric' },
      denominator: { kind: 'metric_ref', metricId: 'sales' },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test.each([
  ['semicolon', 'SUM(profit); DROP TABLE chart'],
  ['line comment', 'SUM(profit) -- comment'],
  ['block comment start', 'SUM(/* profit)'],
  ['block comment end', 'SUM(profit */)'],
  ['single quote', "SUM(CASE WHEN state = 'CA' THEN profit ELSE 0 END)"],
  ['template start', 'SUM({{ profit)'],
  ['template end', 'SUM(profit }})'],
  ['template expression', 'SUM(profit ${ multiplier)'],
])('rejects unsafe metric SQL containing %s', (_label, profitSql) => {
  expect(() =>
    emitCalculatedFieldAstSql(
      field({ kind: 'metric_ref', metricId: 'profit' }),
      {
        dialect: 'doris',
        metricSql: {
          ...metricSql,
          profit: profitSql,
        },
        parameterValues,
      },
    ),
  ).toThrow(ERR_CROSSTAB_CALC_METRIC);
});

test('rejects text params inside numeric expressions', () => {
  expect(() =>
    emit({
      kind: 'binary_op',
      op: '+',
      left: { kind: 'metric_ref', metricId: 'profit' },
      right: { kind: 'text_param', parameterId: 'region' },
    }),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test('rejects text AST for number result fields', () => {
  expect(() =>
    emitCalculatedFieldAstSql(
      field({ kind: 'literal_text', value: 'not numeric' }, 'number'),
      {
        dialect: 'doris',
        metricSql,
        parameterValues,
      },
    ),
  ).toThrow(ERR_CROSSTAB_CALC_FIELD);
});

test.each([
  ['literal_number', { kind: 'literal_number', value: 1 }],
  ['metric_ref', { kind: 'metric_ref', metricId: 'profit' }],
] satisfies Array<[string, CrosstabExpressionNode]>)(
  'rejects %s AST for text result fields',
  (_label, ast) => {
    expect(() =>
      emitCalculatedFieldAstSql(field(ast, 'text'), {
        dialect: 'doris',
        metricSql,
        parameterValues,
      }),
    ).toThrow(ERR_CROSSTAB_CALC_FIELD);
  },
);

test.each(['safe_div', 'pct', 'ratio'] as const)(
  'rejects literal zero denominator in %s during validation',
  kind => {
    expect(() =>
      validateCalculatedFieldAst({
        kind,
        numerator: { kind: 'metric_ref', metricId: 'profit' },
        denominator: { kind: 'literal_number', value: 0 },
      }),
    ).toThrow(ERR_CROSSTAB_CALC_FIELD);
  },
);

test('rejects unsupported dialects', () => {
  expect(() =>
    emitCalculatedFieldAstSql(
      field({
        kind: 'safe_div',
        numerator: { kind: 'metric_ref', metricId: 'profit' },
        denominator: { kind: 'metric_ref', metricId: 'sales' },
      }),
      {
        dialect: 'postgresql',
        metricSql,
        parameterValues,
      },
    ),
  ).toThrow(ERR_CROSSTAB_CALC_DIALECT);
});

test('preserves legacy ratio compiler API', () => {
  const legacyField: CrosstabCalculatedField = {
    id: 'gross_margin_rate',
    label: '毛利率',
    template: 'ratio',
    inputs: { leftMetric: 'profit', rightMetric: 'sales' },
    semantic: 'ratio',
    formatString: '.2%',
  };

  expect(
    emitCalculatedFieldSql(legacyField, {
      dialect: 'doris',
      metricSql,
      parameterValues: {},
    }),
  ).toBe(
    '(CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END)',
  );
});
