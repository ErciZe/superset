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
import { ChartProps, supersetTheme } from '@superset-ui/core';
import { ERR_CONDITIONAL_FORMATTING } from '../../src/crosstab/formatting';
import transformProps from '../../src/plugin/transformProps';
import type { CrosstabFormData } from '../../src/types';

describe('crosstab transformProps errors', () => {
  test('fails fast for malformed metric entries', () => {
    expect(() =>
      transformProps(
        new ChartProps<CrosstabFormData>({
          width: 800,
          height: 400,
          formData: {
            datasource: '1__table',
            viz_type: 'crosstab_table',
            groupbyRows: ['contract_type'],
            groupbyColumns: ['pay_type'],
            metrics: [null],
          } as never,
          queriesData: [{ data: [] }],
          theme: supersetTheme,
        }),
      ),
    ).toThrow('Unsupported crosstab metric field.');
  });

  test('fails fast for invalid conditional formatting JSON', () => {
    expect(() =>
      transformProps(
        new ChartProps<CrosstabFormData>({
          width: 800,
          height: 400,
          formData: {
            datasource: '1__table',
            viz_type: 'crosstab_table',
            groupbyRows: ['contract_type'],
            groupbyColumns: ['pay_type'],
            metrics: ['amount'],
            conditionalFormatting: '[{"operator":"contains","value":1}]',
          },
          queriesData: [{ data: [] }],
          theme: supersetTheme,
        }),
      ),
    ).toThrow(ERR_CONDITIONAL_FORMATTING);
  });
});
