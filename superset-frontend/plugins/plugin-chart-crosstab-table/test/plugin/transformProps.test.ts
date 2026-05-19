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
import type { CrosstabFormData } from '../../src/types';
import transformProps from '../../src/plugin/transformProps';

describe('crosstab transformProps', () => {
  it('converts query data into renderer props', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '1__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['contract_type'],
        groupbyColumns: ['pay_type'],
        metrics: ['amount', 'profit'],
      },
      queriesData: [
        {
          data: [
            { contract_type: 'A', pay_type: 'Cash', amount: 10, profit: 2 },
            { contract_type: 'A', pay_type: 'Credit', amount: 4, profit: 1 },
          ],
        },
      ],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.rowData).toEqual([
      expect.objectContaining({
        contract_type: 'A',
        '__crosstab_col__string:4:Cash__metric__amount': 10,
        '__crosstab_col__string:4:Cash__metric__profit': 2,
        '__crosstab_col__string:6:Credit__metric__amount': 4,
        '__crosstab_col__string:6:Credit__metric__profit': 1,
      }),
    ]);
    expect(props.columns.map(column => column.key)).toContain('contract_type');
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: 'Cash',
        children: [
          expect.objectContaining({ label: 'amount' }),
          expect.objectContaining({ label: 'profit' }),
        ],
      }),
      expect.objectContaining({
        label: 'Credit',
      }),
    ]);
    expect(props.generatedColumnIds).toEqual([
      '__crosstab_col__string:4:Cash__metric__amount',
      '__crosstab_col__string:4:Cash__metric__profit',
      '__crosstab_col__string:6:Credit__metric__amount',
      '__crosstab_col__string:6:Credit__metric__profit',
    ]);
  });
});
