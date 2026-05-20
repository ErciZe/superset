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
import {
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
} from '../../src/crosstab/engine';

const dynamicColumnGroupBy: Exclude<
  CrosstabFormData['dynamicGroupBy'],
  string | undefined
> = {
  enabled: true,
  placement: 'columns',
  slotIndex: 1,
  defaultColumn: 'shop_name',
  options: [
    { label: '店铺', column: 'shop_name' },
    { label: '国家', column: 'country' },
  ],
};

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
      datasource: {
        verboseMap: {
          contract_type: 'Contract type',
          amount: 'Amount',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.rowData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contract_type: 'A',
          '__crosstab_col__string:4:Cash__metric__amount': 10,
          '__crosstab_col__string:4:Cash__metric__profit': 2,
          '__crosstab_col__string:6:Credit__metric__amount': 4,
          '__crosstab_col__string:6:Credit__metric__profit': 1,
        }),
      ]),
    );
    expect(props.columns).toContainEqual(
      expect.objectContaining({
        key: 'contract_type',
        label: 'Contract type',
      }),
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: 'Cash',
        children: [
          expect.objectContaining({ label: 'Amount' }),
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

  it('builds fixed three-level column headers without a duplicate metric layer for one metric', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              shop_name: 'Shop A',
              country: 'US',
              指标值: 10,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          shop_name: '店铺',
          country: '国家',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.columns[0]).toEqual(
      expect.objectContaining({
        key: 'metric_name_with_unit',
        label: '指标项',
      }),
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        children: [
          expect.objectContaining({
            label: 'Shop A',
            children: [
              expect.objectContaining({
                label: 'US',
                field:
                  '__crosstab_col__string:10:2026-05-01|string:6:Shop A|string:2:US__metric__指标值',
                metric: '指标值',
              }),
            ],
          }),
        ],
      }),
    ]);
  });

  it('uses the selected dynamic group-by column for generated headers', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        dynamicGroupBy: dynamicColumnGroupBy,
      },
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              country: 'US',
              指标值: 10,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          country: '国家',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.dynamicGroupByConfig).toEqual(dynamicColumnGroupBy);
    expect(props.selectedDynamicGroupByColumn).toBe('country');
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        children: [
          expect.objectContaining({
            label: 'US',
            field:
              '__crosstab_col__string:10:2026-05-01|string:2:US__metric__指标值',
          }),
        ],
      }),
    ]);
    expect(props.generatedColumnIds).toEqual([
      '__crosstab_col__string:10:2026-05-01|string:2:US__metric__指标值',
    ]);
  });

  it('does not reset dynamic group-by own state when the signature is current', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        dynamicGroupBy: dynamicColumnGroupBy,
      },
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
      },
      hooks: {
        setDataMask,
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              country: 'US',
              指标值: 10,
            },
          ],
        },
      ],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(setDataMask).not.toHaveBeenCalled();
    expect(props.rowData).not.toEqual([]);
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
  });

  it('clears stale server column pagination own state when the dynamic signature changes', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        dynamicGroupBy: dynamicColumnGroupBy,
      },
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        currentColumnPage: 3,
        currentColumnPageSize: 5,
        expandedRowPaths: ['stale-row'],
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 5,
      },
      hooks: {
        setDataMask,
      },
      queriesData: [
        {
          data: [
            {
              biz_date: '2026-05-01',
              country: 'US',
            },
          ],
        },
        {
          data: [{ rowcount: 1 }],
        },
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              country: 'US',
              指标值: 10,
            },
          ],
        },
      ],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        selectedDynamicGroupByColumn: 'country',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    expect(props.rowData).toEqual([]);
    expect(props.isServerColumnLoading).toBe(true);
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
  });

  it('stores server column page tuples after loading the column domain query', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
      },
      ownState: {
        currentColumnPage: 1,
        currentColumnPageSize: 5,
      },
      hooks: {
        setDataMask,
      },
      queriesData: [
        {
          data: [
            {
              biz_date: '2026-05-02',
              shop_name: 'Shop B',
              country: 'US',
            },
          ],
        },
        {
          data: [{ rowcount: 4598 }],
        },
      ],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.isServerColumnLoading).toBe(true);
    expect(props.serverColumnCurrentPage).toBe(1);
    expect(props.serverColumnPageSize).toBe(5);
    expect(props.serverColumnTotalCount).toBe(4598);
    expect(props.rowData).toEqual([]);
    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        currentColumnPage: 1,
        currentColumnPageSize: 5,
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name\u001fcountry',
        serverColumnPageTuples: [['2026-05-02', 'Shop B', 'US']],
        serverColumnPageTuplesPage: 1,
        serverColumnPageTuplesPageSize: 5,
        serverColumnTotalCount: 4598,
      },
    });
  });

  it('bootstraps server column pagination without existing own state', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
      },
      hooks: {
        setDataMask,
      },
      queriesData: [
        {
          data: [
            {
              biz_date: '2026-05-02',
              shop_name: 'Shop B',
              country: 'US',
            },
          ],
        },
        {
          data: [{ rowcount: 4598 }],
        },
      ],
      theme: supersetTheme,
    });

    expect(() => transformProps(chartProps)).not.toThrow();

    const props = transformProps(chartProps);

    expect(props.isServerColumnLoading).toBe(true);
    expect(props.serverColumnCurrentPage).toBe(0);
    expect(props.serverColumnPageSize).toBe(98);
    expect(props.serverColumnTotalCount).toBe(4598);
    expect(props.rowData).toEqual([]);
    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        currentColumnPage: 0,
        currentColumnPageSize: 98,
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name\u001fcountry',
        serverColumnPageTuples: [['2026-05-02', 'Shop B', 'US']],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 98,
        serverColumnTotalCount: 4598,
      },
    });
  });

  it('uses server page data and full row totals for server column pagination', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        showColumnTotals: true,
      },
      ownState: {
        currentColumnPage: 0,
        currentColumnPageSize: 98,
        serverColumnPageTuples: [['2026-05-01', 'Shop A', 'US']],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 98,
      },
      queriesData: [
        {
          data: [
            {
              biz_date: '2026-05-01',
              shop_name: 'Shop A',
              country: 'US',
            },
          ],
        },
        {
          data: [{ rowcount: 4598 }],
        },
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              shop_name: 'Shop A',
              country: 'US',
              指标值: 10,
            },
          ],
          rowcount: 1,
        },
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              指标值: 1000,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          shop_name: '店铺',
          country: '国家',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.isServerColumnLoading).toBe(false);
    expect(props.serverColumnTotalCount).toBe(4598);
    expect(props.generatedColumnIds).toEqual([
      '__crosstab_col__string:10:2026-05-01|string:6:Shop A|string:2:US__metric__指标值',
    ]);
    expect(props.rowData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric_name_with_unit: '销售额',
          [CROSSTAB_TOTAL_COLUMN_ID]: 1000,
        }),
        expect.objectContaining({
          [CROSSTAB_TOTAL_COLUMN_ID]: 1000,
        }),
      ]),
    );
  });

  it('uses SQL row and grand totals for ratio rows resolved by row-value semantic overrides', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [{ metric: '指标值', semantic: 'unknown' }],
          semanticOverrideField: 'metric_name_with_unit',
          semanticOverrides: [
            { value: '销售额（金额）', semantic: 'additive' },
            { value: '毛利率（%）', semantic: 'ratio' },
          ],
        },
        showRowTotals: true,
        showColumnTotals: true,
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '毛利率（%）',
              biz_date: '2026-05-01',
              指标值: -4.1111,
            },
            {
              metric_name_with_unit: '毛利率（%）',
              biz_date: '2026-05-02',
              指标值: -5.2222,
            },
          ],
        },
        {
          data: [
            {
              metric_name_with_unit: '毛利率（%）',
              指标值: -9.5145,
            },
          ],
        },
        {
          data: [
            {
              biz_date: '2026-05-01',
              指标值: -4.1111,
            },
            {
              biz_date: '2026-05-02',
              指标值: -5.2222,
            },
          ],
        },
        {
          data: [
            {
              指标值: -9.5145,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);
    const ratioRow = props.rowData.find(
      row => row.metric_name_with_unit === '毛利率（%）',
    );
    const grandTotalRow = props.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'grand_total',
    );

    expect(ratioRow).toEqual(
      expect.objectContaining({
        [CROSSTAB_TOTAL_COLUMN_ID]: -9.5145,
      }),
    );
    expect(grandTotalRow).toEqual(
      expect.objectContaining({
        [CROSSTAB_TOTAL_COLUMN_ID]: -9.5145,
      }),
    );
  });
});
