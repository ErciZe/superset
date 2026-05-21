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
  getParameterSignature,
  resolveCrosstabParameters,
} from '../../src/plugin/parameters';
import type { CrosstabFormData, CrosstabOwnState } from '../../src/types';

const formData: CrosstabFormData = {
  viz_type: 'crosstab-table',
  datasource: '7__table',
  parameters: [
    {
      kind: 'number',
      name: 'adjustmentRate',
      label: '调整系数',
      default: 1,
      min: 0,
      max: 2,
      step: 0.01,
    },
  ],
};

test('uses the default number parameter when own-state is empty', () => {
  expect(resolveCrosstabParameters(formData, undefined)).toEqual({
    config: formData.parameters,
    values: { adjustmentRate: 1 },
  });
});

test('uses runtime number parameter from own-state', () => {
  const ownState: CrosstabOwnState = {
    numericParameters: { adjustmentRate: 1.25 },
  };

  expect(resolveCrosstabParameters(formData, ownState).values).toEqual({
    adjustmentRate: 1.25,
  });
});

test('rejects values outside min and max', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { adjustmentRate: 3 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects values that do not align to step', () => {
  expect(() =>
    resolveCrosstabParameters(formData, {
      numericParameters: { adjustmentRate: 1.234 },
    }),
  ).toThrow(ERR_CROSSTAB_PARAMETER_VALUE);
});

test('rejects more than one number parameter in v4 core', () => {
  expect(() =>
    resolveCrosstabParameters(
      {
        ...formData,
        parameters: [
          ...(formData.parameters as never[]),
          { kind: 'number', name: 'otherRate', default: 1 },
        ],
      },
      undefined,
    ),
  ).toThrow(ERR_CROSSTAB_PARAMETER_CONFIG);
});

test('creates stable signatures from resolved parameter values', () => {
  const resolved = resolveCrosstabParameters(formData, {
    numericParameters: { adjustmentRate: 1.25 },
  });

  expect(getParameterSignature(resolved)).toBe('adjustmentRate=1.25');
});
