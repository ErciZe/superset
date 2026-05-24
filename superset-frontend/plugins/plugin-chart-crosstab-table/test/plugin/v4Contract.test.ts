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
import type { CrosstabFormData } from '../../src/types';
import {
  ERR_CROSSTAB_V4_LEGACY_INPUT,
  assertNoLegacyV4Inputs,
  hasCanonicalV4Definitions,
} from '../../src/plugin/v4Contract';

function formData(overrides: Partial<CrosstabFormData> = {}): CrosstabFormData {
  return {
    datasource: '7__table',
    viz_type: 'crosstab-table',
    ...overrides,
  };
}

test('rejects legacy V4 parameters and calculatedFields surfaces', () => {
  expect(() =>
    assertNoLegacyV4Inputs(
      formData({
        parameters: [{ kind: 'number', name: 'legacyRate', default: 1 }],
        calculatedFields: [{ id: 'legacy_calc' }],
      } as never),
    ),
  ).toThrow(ERR_CROSSTAB_V4_LEGACY_INPUT);
});

test('detects canonical V4 usage from canonical definitions and metric chips', () => {
  expect(
    hasCanonicalV4Definitions(
      formData({
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
      }),
    ),
  ).toBe(true);

  expect(
    hasCanonicalV4Definitions(
      formData({
        crosstabFieldConfig: {
          metrics: [
            {
              metric: 'Margin rate',
              label: 'Margin rate',
              calculatedFieldId: 'calc_margin_pct_v4',
            },
          ],
        },
      }),
    ),
  ).toBe(true);
});

test('does not mark plain legacy charts as canonical V4 usage', () => {
  expect(
    hasCanonicalV4Definitions(
      formData({
        metrics: ['sales'],
        crosstabFieldConfig: {
          metrics: [{ metric: 'sales', label: 'Sales' }],
        },
      }),
    ),
  ).toBe(false);
});

test('treats empty canonical and legacy arrays as cleared state', () => {
  const clearedFormData = formData({
    crosstabParameters: [],
    crosstabCalculatedFields: [],
    parameters: [],
    calculatedFields: [],
  });

  expect(hasCanonicalV4Definitions(clearedFormData)).toBe(false);
  expect(() => assertNoLegacyV4Inputs(clearedFormData)).not.toThrow();
});
