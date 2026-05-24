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
  ERR_CROSSTAB_PARAMETER_CONFIG,
  ERR_CROSSTAB_PARAMETER_VALUE,
  getCrosstabParameters,
  getParameterSignature,
  resolveCrosstabParameters,
} from '../../src/plugin/parameters';
import type {
  CrosstabFormData,
  CrosstabOwnState,
  CrosstabParameter,
} from '../../src/types';

const crosstabParameters: CrosstabParameter[] = [
  {
    id: 'param_adjustment',
    kind: 'number',
    name: 'adjustmentRate',
    label: 'Adjustment',
    defaultValue: 1,
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    id: 'param_margin%rate',
    kind: 'number',
    name: 'marginRate',
    label: 'Margin rate',
    defaultValue: 0.25,
  },
];

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  crosstabParameters,
};

test('normalizes canonical numeric parameter config', () => {
  expect(getCrosstabParameters(formData)).toEqual(crosstabParameters);
});

test('uses default canonical parameter values when own-state is empty', () => {
  const resolved = resolveCrosstabParameters(formData, undefined);

  expect(resolved.config).toEqual(crosstabParameters);
  expect(resolved.values).toEqual({
    param_adjustment: 1,
    'param_margin%rate': 0.25,
  });
});

test('uses runtime canonical parameter values from own-state by id', () => {
  const ownState: CrosstabOwnState = {
    numericParameters: {
      param_adjustment: 1.25,
      'param_margin%rate': 0.5,
    },
  };

  expect(resolveCrosstabParameters(formData, ownState).values).toEqual({
    param_adjustment: 1.25,
    'param_margin%rate': 0.5,
  });
});

test('rejects duplicate canonical ids', () => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: [
        ...crosstabParameters,
        { ...crosstabParameters[1], name: 'otherName' },
      ],
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('rejects duplicate canonical names', () => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: [
        ...crosstabParameters,
        { ...crosstabParameters[1], id: 'param_other' },
      ],
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('rejects numeric values outside min and max', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { param_adjustment: 3 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects numeric values that do not align to step', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { param_adjustment: 1.234 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects malformed canonical JSON parameter config with config error', () => {
  expect(() =>
    resolveCrosstabParameters(
      {
        ...formData,
        crosstabParameters: '[{"kind":"number"',
      },
      undefined,
    ),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test.each([
  [
    'valid JSON object instead of array',
    '{"id":"param_adjustment","kind":"number","name":"adjustmentRate","label":"Adjustment","defaultValue":1}',
  ],
  [
    'missing id',
    [
      {
        kind: 'number',
        name: 'adjustmentRate',
        label: 'Adjustment',
        defaultValue: 1,
      },
    ],
  ],
  [
    'missing label',
    [
      {
        id: 'param_adjustment',
        kind: 'number',
        name: 'adjustmentRate',
        defaultValue: 1,
      },
    ],
  ],
  [
    'string default',
    [
      {
        id: 'param_adjustment',
        kind: 'number',
        name: 'adjustmentRate',
        label: 'Adjustment',
        defaultValue: '1',
      },
    ],
  ],
  [
    'min greater than max',
    [
      {
        id: 'param_adjustment',
        kind: 'number',
        name: 'adjustmentRate',
        label: 'Adjustment',
        defaultValue: 1,
        min: 2,
        max: 1,
      },
    ],
  ],
  [
    'non-positive step',
    [
      {
        id: 'param_adjustment',
        kind: 'number',
        name: 'adjustmentRate',
        label: 'Adjustment',
        defaultValue: 1,
        step: 0,
      },
    ],
  ],
  [
    'text parameter kind',
    [
      {
        id: 'param_country',
        kind: 'text',
        name: 'countryFilter',
        label: 'Country',
        defaultValue: 'DE',
      },
    ],
  ],
])('rejects invalid canonical numeric parameter config: %s', (_, value) => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: value as never,
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('rejects legacy top-level parameters input', () => {
  expect(() =>
    getCrosstabParameters({
      ...formData,
      crosstabParameters: undefined,
      parameters: [{ kind: 'number', name: 'legacyRate', default: 1 }],
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('builds a stable numeric-only parameter signature', () => {
  const resolved = resolveCrosstabParameters(
    {
      ...formData,
      crosstabParameters: [...crosstabParameters].reverse(),
    },
    {
      numericParameters: {
        param_adjustment: 1.5,
        'param_margin%rate': 0.5,
      },
    },
  );

  expect(getParameterSignature(resolved)).toBe(
    'number:param_adjustment=1.5|number:param_margin%25rate=0.5',
  );
});
