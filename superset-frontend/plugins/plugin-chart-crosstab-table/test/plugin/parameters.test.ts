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
  getCrosstabNumberParameters,
  getCrosstabParameters,
  getParameterSignature,
  resolveCrosstabParameters,
} from '../../src/plugin/parameters';
import type {
  CrosstabFormData,
  CrosstabNumberParameter,
  CrosstabParameter,
  CrosstabOwnState,
} from '../../src/types';

const crosstabParameters: CrosstabParameter[] = [
  {
    id: 'param_adjustment',
    kind: 'number',
    name: 'adjustmentRate',
    label: '调整系数',
    defaultValue: 1,
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    id: 'param_country',
    kind: 'text',
    name: 'countryFilter',
    label: '国家',
    defaultValue: 'DE',
    allowedValues: ['DE', 'FR'],
  },
];

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  crosstabParameters,
};

test('normalizes canonical number and text parameter config', () => {
  expect(getCrosstabParameters(formData)).toEqual(crosstabParameters);
});

test('uses default canonical parameter values when own-state is empty', () => {
  const resolved = resolveCrosstabParameters(formData, undefined);

  expect(resolved.config).toEqual(crosstabParameters);
  expect(resolved.values.number).toEqual({ param_adjustment: 1 });
  expect(resolved.values.text).toEqual({ param_country: 'DE' });
  expect(resolved.values.param_adjustment).toBe(1);
});

test('uses runtime canonical parameter values from own-state by id', () => {
  const ownState: CrosstabOwnState = {
    numericParameters: { param_adjustment: 1.25 },
    textParameters: { param_country: 'FR' },
  };

  const values = resolveCrosstabParameters(formData, ownState).values;

  expect(values.number).toEqual({ param_adjustment: 1.25 });
  expect(values.text).toEqual({ param_country: 'FR' });
  expect(values.param_adjustment).toBe(1.25);
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

test('rejects text values outside allowed values', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      textParameters: { param_country: 'US' },
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
    'valid JSON object',
    '{"id":"param_adjustment","kind":"number","name":"adjustmentRate","label":"调整系数","defaultValue":1}',
  ],
  [
    'missing id',
    [
      {
        kind: 'number',
        name: 'adjustmentRate',
        label: '调整系数',
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
        label: '调整系数',
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
        label: '调整系数',
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
        label: '调整系数',
        defaultValue: 1,
        step: 0,
      },
    ],
  ],
  [
    'text default outside allowed values',
    [
      {
        id: 'param_country',
        kind: 'text',
        name: 'countryFilter',
        label: '国家',
        defaultValue: 'US',
        allowedValues: ['DE', 'FR'],
      },
    ],
  ],
])('rejects invalid parameter shape: %s', (_description, parameters) => {
  expect(() =>
    resolveCrosstabParameters(
      {
        ...formData,
        crosstabParameters:
          parameters as CrosstabFormData['crosstabParameters'],
      },
      undefined,
    ),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('creates stable signatures from resolved parameter values', () => {
  const resolved = resolveCrosstabParameters(formData, undefined);

  expect(getParameterSignature(resolved)).toBe(
    'number:param_adjustment=1|text:param_country=DE',
  );
});

test('sorts parameter signatures globally by id across number and text kinds', () => {
  const resolved = resolveCrosstabParameters({
    ...formData,
    crosstabParameters: [
      {
        id: 'param_z',
        kind: 'number',
        name: 'zRate',
        label: 'Z rate',
        defaultValue: 2,
      },
      {
        id: 'param_a',
        kind: 'text',
        name: 'aFilter',
        label: 'A filter',
        defaultValue: 'DE',
      },
    ],
  });

  expect(getParameterSignature(resolved)).toBe(
    'text:param_a=DE|number:param_z=2',
  );
});

test('escapes signature delimiters in ids and text values', () => {
  const resolved = resolveCrosstabParameters({
    ...formData,
    crosstabParameters: [
      {
        id: 'param|text=country:%',
        kind: 'text',
        name: 'countryFilter',
        label: 'Country',
        defaultValue: 'DE|FR=EU:%',
      },
    ],
  });

  expect(getParameterSignature(resolved)).toBe(
    'text:param%7Ctext%3Dcountry%3A%25=DE%7CFR%3DEU%3A%25',
  );
});

test('rejects non-string runtime text values without allowed values', () => {
  expect(() =>
    resolveCrosstabParameters(
      {
        ...formData,
        crosstabParameters: [
          {
            id: 'param_country',
            kind: 'text',
            name: 'countryFilter',
            label: 'Country',
            defaultValue: 'DE',
          },
        ],
      },
      {
        textParameters: {
          param_country: 1,
        } as unknown as Record<string, string>,
      },
    ),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('keeps nested parameter values non-enumerable while exposing flat numeric values', () => {
  const resolved = resolveCrosstabParameters(formData, {
    numericParameters: { param_adjustment: 1.25 },
    textParameters: { param_country: 'FR' },
  });

  expect(resolved.values.number).toEqual({ param_adjustment: 1.25 });
  expect(resolved.values.text).toEqual({ param_country: 'FR' });
  expect(Object.keys(resolved.values)).toEqual(['param_adjustment']);
  expect(resolved.values.param_adjustment).toBe(1.25);
});

test('preserves strict legacy number helper for formData.parameters only', () => {
  const legacyParameters: CrosstabNumberParameter[] = [
    {
      kind: 'number',
      name: 'adjustmentRate',
      label: '调整系数',
      default: 1,
      min: 0,
      max: 2,
      step: 0.01,
    },
  ];

  expect(
    getCrosstabNumberParameters({
      ...formData,
      parameters: legacyParameters,
    }),
  ).toEqual(legacyParameters);
});

test('canonical config takes precedence over legacy parameters', () => {
  expect(
    getCrosstabParameters({
      ...formData,
      parameters: [
        { kind: 'number', name: 'legacyAdjustmentRate', default: 9 },
      ],
    }),
  ).toEqual(crosstabParameters);
});
