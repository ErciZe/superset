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
  ChartProps,
  supersetTheme,
  type ChartPropsConfig,
} from '@superset-ui/core';
import type {
  CrosstabDynamicGroupByConfig,
  CrosstabDynamicMetricConfig,
  CrosstabFormData,
} from '../../src/types';
import transformProps from '../../src/plugin/transformProps';
import {
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
} from '../../src/crosstab/engine';
import { getMetricConfigSignature } from '../../src/plugin/dynamicMetric';
import { ERR_CROSSTAB_V4_METRIC_CONFIG } from '../../src/plugin/fieldConfig';

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

const normalizedDynamicColumnGroupBy: CrosstabDynamicGroupByConfig = {
  enabled: true,
  slots: [
    {
      id: '__legacy__',
      label: 'Group dimension',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop_name',
      options: [
        { id: 'shop_name', label: '店铺', columns: ['shop_name'] },
        { id: 'country', label: '国家', columns: ['country'] },
      ],
    },
  ],
};

const canonicalMultiSlotGroupBy: CrosstabDynamicGroupByConfig = {
  enabled: true,
  slots: [
    {
      id: 'level2',
      label: '二级维度',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop',
      options: [
        { id: 'shop', label: '店铺', columns: ['shop_name'] },
        { id: 'country', label: '国家', columns: ['country'] },
      ],
    },
    {
      id: 'level3',
      label: '三级维度',
      placement: 'columns',
      slotIndex: 2,
      spliceCount: 1,
      defaultOptionId: 'none',
      options: [
        { id: 'none', label: '(无)', columns: [] },
        { id: 'msku', label: 'MSKU', columns: ['msku'] },
      ],
    },
  ],
};

const dynamicMetric: CrosstabDynamicMetricConfig = {
  enabled: true,
  slots: [
    {
      id: 'primary_metric',
      label: 'Primary metric',
      slotIndex: 0,
      spliceCount: 1,
      defaultOptionId: 'amount',
      options: [
        {
          id: 'amount',
          label: 'Amount',
          metrics: [
            { metric: 'amount', label: 'Amount', semantic: 'additive' },
          ],
        },
        {
          id: 'profit',
          label: 'Profit',
          metrics: [
            { metric: 'profit', label: 'Profit', semantic: 'additive' },
          ],
        },
        {
          id: 'margin_rate',
          label: 'Margin rate',
          metrics: [
            {
              metric: 'margin_rate',
              label: 'Margin Rate',
              semantic: 'ratio',
            },
          ],
        },
      ],
    },
  ],
};

const canonicalParameterizedCalculatedFormData: CrosstabFormData = {
  datasource: '7__table',
  viz_type: 'crosstab-table',
  groupbyRows: ['category'],
  groupbyColumns: ['biz_date'],
  crosstabFieldConfig: {
    rows: [{ field: 'category' }],
    columns: [{ field: 'biz_date' }],
    metrics: [
      {
        metric: {
          expressionType: 'SQL',
          label: 'profit',
          sqlExpression: 'SUM(gross_profit)',
        },
        semantic: 'additive',
      },
      {
        metric: {
          expressionType: 'SQL',
          label: 'sales',
          sqlExpression: 'SUM(sales_amount)',
        },
        semantic: 'additive',
      },
      {
        metric: '含参毛利率',
        label: '含参毛利率',
        calculatedFieldId: 'calc_adjusted_margin',
      },
    ],
  },
  crosstabParameters: [
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
  ],
  crosstabCalculatedFields: [
    {
      id: 'calc_adjusted_margin',
      name: '含参毛利率',
      resultType: 'percent',
      ast: {
        kind: 'binary_op',
        op: '*',
        left: {
          kind: 'pct',
          numerator: { kind: 'metric_ref', metricId: 'profit' },
          denominator: { kind: 'metric_ref', metricId: 'sales' },
        },
        right: { kind: 'number_param', parameterId: 'param_adjustment' },
      },
    },
  ],
};

type CrosstabChartPropsConfig = Omit<ChartPropsConfig, 'theme'> & {
  formData?: CrosstabFormData;
  theme?: ChartPropsConfig['theme'];
};

function createProps(props: CrosstabChartPropsConfig) {
  const { theme = supersetTheme, ...restProps } = props;

  return new ChartProps<CrosstabFormData>({
    width: 800,
    height: 400,
    ...restProps,
    theme,
  });
}

describe('crosstab transformProps', () => {
  it('includes numeric parameter values in effective metric signature', () => {
    const baseProps = createProps({
      formData: canonicalParameterizedCalculatedFormData,
      queriesData: [
        {
          data: [],
          colnames: [],
          coltypes: [],
        },
      ],
    });

    const signatureA = transformProps({
      ...baseProps,
      ownState: { numericParameters: { param_adjustment: 1 } },
    }).effectiveMetricSignature;
    const signatureB = transformProps({
      ...baseProps,
      ownState: { numericParameters: { param_adjustment: 1.25 } },
    }).effectiveMetricSignature;

    expect(signatureA).not.toBe(signatureB);
  });

  it('includes every numeric parameter value in effective metric signature', () => {
    const baseProps = createProps({
      formData: {
        ...canonicalParameterizedCalculatedFormData,
        crosstabParameters: [
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
            id: 'param_secondary',
            kind: 'number',
            name: 'secondaryRate',
            label: '次级系数',
            defaultValue: 1,
          },
        ],
      },
      queriesData: [
        {
          data: [],
          colnames: [],
          coltypes: [],
        },
      ],
    });

    const signatureA = transformProps({
      ...baseProps,
      ownState: { numericParameters: { param_secondary: 1 } },
    }).effectiveMetricSignature;
    const signatureB = transformProps({
      ...baseProps,
      ownState: { numericParameters: { param_secondary: 1.5 } },
    }).effectiveMetricSignature;

    expect(signatureA).not.toBe(signatureB);
  });

  it('passes resolved runtime parameter values to renderer props', () => {
    const props = transformProps(
      createProps({
        formData: {
          ...canonicalParameterizedCalculatedFormData,
          crosstabParameters: [
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
              id: 'param_secondary',
              kind: 'number',
              name: 'secondaryRate',
              label: '次级系数',
              defaultValue: 1,
            },
          ],
        },
        ownState: {
          numericParameters: { param_adjustment: 1.25 },
          currentColumnPage: 0,
        },
        queriesData: [
          {
            data: [],
            colnames: [],
            coltypes: [],
          },
        ],
      }),
    );

    expect(props.numericParameters).toEqual({
      param_adjustment: 1.25,
      param_secondary: 1,
    });
  });

  it('rejects v4 charts when render-time metrics only exist under legacy formData.metrics', () => {
    expect(() =>
      transformProps(
        createProps({
          formData: {
            datasource: '11__table',
            viz_type: 'crosstab-table',
            metrics: ['legacy_amount'],
            crosstabParameters: [
              {
                id: 'param_adjustment',
                kind: 'number',
                name: 'adjustmentRate',
                label: 'Adjustment',
                defaultValue: 1,
              },
            ],
            crosstabFieldConfig: {
              rows: [{ field: 'metric_name_with_unit' }],
              columns: [{ field: 'biz_date' }],
              metrics: [],
            },
          },
          queriesData: [{ data: [], colnames: [], coltypes: [] }],
        }),
      ),
    ).toThrow(ERR_CROSSTAB_V4_METRIC_CONFIG);
  });

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

    expect(props.dynamicGroupByConfig).toEqual(normalizedDynamicColumnGroupBy);
    expect(props.selectedDynamicGroupBy).toEqual({ __legacy__: 'country' });
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

  it('passes canonical multi-slot dynamic group-by state to renderer props', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        dynamicGroupBy: canonicalMultiSlotGroupBy,
      },
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              country: 'US',
              msku: 'A-001',
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
          msku: 'MSKU',
          指标值: '指标值',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.selectedDynamicGroupBy).toEqual({
      level2: 'country',
      level3: 'msku',
    });
    expect(props.dynamicGroupByConfig).toEqual(canonicalMultiSlotGroupBy);
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        children: [
          expect.objectContaining({
            label: 'US',
            children: [
              expect.objectContaining({
                label: 'A-001',
                field:
                  '__crosstab_col__string:10:2026-05-01|string:2:US|string:5:A-001__metric__指标值',
                metric: '指标值',
              }),
            ],
          }),
        ],
      }),
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
        unrelatedOwnStateField: 'preserved',
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name',
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 5,
        serverColumnTotalCount: 999,
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
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: { __legacy__: 'country' },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    const resetOwnState = setDataMask.mock.calls[0][0].ownState;
    expect(resetOwnState).not.toHaveProperty('selectedDynamicGroupByColumn');
    expect(resetOwnState).not.toHaveProperty('expandedRowPaths');
    expect(resetOwnState).not.toHaveProperty('serverColumnPageColumnSignature');
    expect(resetOwnState).not.toHaveProperty('serverColumnTotalCount');
    expect(props.rowData).toEqual([]);
    expect(props.isServerColumnLoading).toBe(true);
    expect(props.effectiveGroupBySignature).toBe(
      'rows=metric_name_with_unit|columns=biz_date\u001fcountry',
    );
  });

  it('resets stale server column pagination own state for canonical dynamic group-by slots', () => {
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
        dynamicGroupBy: canonicalMultiSlotGroupBy,
      },
      ownState: {
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
        selectedDynamicGroupByColumn: 'shop_name',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        currentColumnPage: 3,
        currentColumnPageSize: 5,
        expandedRowPaths: ['stale-row'],
        unrelatedOwnStateField: 'preserved',
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name',
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 5,
        serverColumnTotalCount: 999,
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
              msku: 'A-001',
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
              msku: 'A-001',
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
        unrelatedOwnStateField: 'preserved',
        selectedDynamicGroupBy: {
          level2: 'country',
          level3: 'msku',
        },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fcountry\u001fmsku',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    const resetOwnState = setDataMask.mock.calls[0][0].ownState;
    expect(resetOwnState).not.toHaveProperty('selectedDynamicGroupByColumn');
    expect(resetOwnState).not.toHaveProperty('expandedRowPaths');
    expect(resetOwnState).not.toHaveProperty('serverColumnPageColumnSignature');
    expect(resetOwnState).not.toHaveProperty('serverColumnTotalCount');
    expect(props.rowData).toEqual([]);
    expect(props.isServerColumnLoading).toBe(true);
  });

  it('stores the default dynamic group-by column when resetting stale own state', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'stale_dimension'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        dynamicGroupBy: dynamicColumnGroupBy,
      },
      ownState: {
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fstale_dimension',
        currentColumnPage: 2,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [['2026-05-01', 'Stale']],
        serverColumnPageTuplesPage: 2,
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
              shop_name: 'Shop A',
            },
          ],
        },
        {
          data: [{ rowcount: 1 }],
        },
      ],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        selectedDynamicGroupBy: { __legacy__: 'shop_name' },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        currentColumnPage: 0,
        currentColumnPageSize: 5,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    expect(props.rowData).toEqual([]);
    expect(props.isServerColumnLoading).toBe(true);
    expect(props.selectedDynamicGroupByColumn).toBe('shop_name');
  });

  it('passes dynamic metric state to renderer props and renders the selected metric', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date'],
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [
            { metric: 'amount', label: 'Amount', semantic: 'additive' },
          ],
        },
        dynamicMetric,
      },
      ownState: {
        selectedDynamicMetric: {
          primary_metric: 'profit',
        },
        effectiveMetricSignature: getMetricConfigSignature([
          { metric: 'profit', label: 'Profit', semantic: 'additive' },
        ]),
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '销售额',
              biz_date: '2026-05-01',
              profit: 7,
            },
          ],
        },
      ],
      datasource: {
        verboseMap: {
          metric_name_with_unit: '指标项',
          biz_date: '日期',
          profit: 'Profit',
        },
      },
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(props.dynamicMetricConfig).toEqual(dynamicMetric);
    expect(props.selectedDynamicMetric).toEqual({ primary_metric: 'profit' });
    expect(props.effectiveMetricSignature).toBe(
      getMetricConfigSignature([
        { metric: 'profit', label: 'Profit', semantic: 'additive' },
      ]),
    );
    expect(props.generatedColumnIds).toEqual([
      '__crosstab_col__string:10:2026-05-01__metric__profit',
    ]);
    expect(props.rowData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric_name_with_unit: '销售额',
          '__crosstab_col__string:10:2026-05-01__metric__profit': 7,
        }),
      ]),
    );
    expect(props.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        field: '__crosstab_col__string:10:2026-05-01__metric__profit',
        metric: 'profit',
      }),
    ]);
  });

  it('uses selected dynamic metric semantics for SQL summary values', () => {
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [
            { metric: 'amount', label: 'Amount', semantic: 'additive' },
          ],
        },
        dynamicMetric,
        showRowTotals: true,
        showColumnTotals: true,
      },
      ownState: {
        selectedDynamicMetric: {
          primary_metric: 'margin_rate',
        },
        effectiveMetricSignature: getMetricConfigSignature([
          { metric: 'margin_rate', label: 'Margin Rate', semantic: 'ratio' },
        ]),
      },
      queriesData: [
        {
          data: [
            {
              metric_name_with_unit: '毛利率（%）',
              biz_date: '2026-05-01',
              margin_rate: -4.1111,
            },
            {
              metric_name_with_unit: '毛利率（%）',
              biz_date: '2026-05-02',
              margin_rate: -5.2222,
            },
          ],
        },
        {
          data: [
            {
              metric_name_with_unit: '毛利率（%）',
              margin_rate: -9.5145,
            },
          ],
        },
        {
          data: [
            {
              biz_date: '2026-05-01',
              margin_rate: -4.1111,
            },
            {
              biz_date: '2026-05-02',
              margin_rate: -5.2222,
            },
          ],
        },
        {
          data: [
            {
              margin_rate: -9.5145,
            },
          ],
        },
      ],
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

  it('clears stale metric server column caches and preserves expanded rows', () => {
    const setDataMask = jest.fn();
    const chartProps = new ChartProps<CrosstabFormData>({
      width: 800,
      height: 400,
      formData: {
        datasource: '7__table',
        viz_type: 'crosstab_table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [
            { metric: 'amount', label: 'Amount', semantic: 'additive' },
          ],
        },
        serverColumnPagination: true,
        columnPageSize: 98,
        dynamicMetric,
      },
      ownState: {
        selectedDynamicMetric: {
          primary_metric: 'profit',
        },
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        effectiveMetricSignature: getMetricConfigSignature([
          { metric: 'amount', label: 'Amount', semantic: 'additive' },
        ]),
        currentColumnPage: 3,
        currentColumnPageSize: 5,
        expandedRowPaths: ['kept-row'],
        unrelatedOwnStateField: 'preserved',
        serverColumnPageColumnSignature: 'biz_date\u001fshop_name',
        serverColumnPageTuples: [['2026-05-01', 'Shop A']],
        serverColumnPageTuplesPage: 3,
        serverColumnPageTuplesPageSize: 5,
        serverColumnTotalCount: 999,
      },
      hooks: {
        setDataMask,
      },
      queriesData: [
        {
          data: [
            {
              biz_date: '2026-05-01',
              shop_name: 'Shop A',
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
              shop_name: 'Shop A',
              profit: 10,
            },
          ],
        },
      ],
      theme: supersetTheme,
    });

    const props = transformProps(chartProps);

    expect(setDataMask).toHaveBeenCalledWith({
      ownState: {
        currentColumnPageSize: 5,
        expandedRowPaths: ['kept-row'],
        unrelatedOwnStateField: 'preserved',
        effectiveGroupBySignature:
          'rows=metric_name_with_unit|columns=biz_date\u001fshop_name',
        selectedDynamicMetric: { primary_metric: 'profit' },
        effectiveMetricSignature: getMetricConfigSignature([
          { metric: 'profit', label: 'Profit', semantic: 'additive' },
        ]),
        currentColumnPage: 0,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: 5,
      },
    });
    const resetOwnState = setDataMask.mock.calls[0][0].ownState;
    expect(resetOwnState).not.toHaveProperty('serverColumnPageColumnSignature');
    expect(resetOwnState).not.toHaveProperty('serverColumnTotalCount');
    expect(props.rowData).toEqual([]);
    expect(props.isServerColumnLoading).toBe(true);
    expect(props.expandedRowPaths).toEqual(['kept-row']);
    expect(props.effectiveMetricSignature).toBe(
      getMetricConfigSignature([
        { metric: 'profit', label: 'Profit', semantic: 'additive' },
      ]),
    );
  });

  it.each([
    ['missing dynamic metric config', undefined],
    [
      'disabled dynamic metric config',
      {
        enabled: false,
        slots: [],
      },
    ],
  ])(
    'preserves existing metric behavior with %s',
    (_label, dynamicMetricConfig) => {
      const chartProps = new ChartProps<CrosstabFormData>({
        width: 800,
        height: 400,
        formData: {
          datasource: '1__table',
          viz_type: 'crosstab_table',
          groupbyRows: ['contract_type'],
          groupbyColumns: ['pay_type'],
          metrics: ['amount', 'profit'],
          ...(dynamicMetricConfig
            ? {
                dynamicMetric:
                  dynamicMetricConfig as CrosstabDynamicMetricConfig,
              }
            : {}),
        },
        queriesData: [
          {
            data: [
              { contract_type: 'A', pay_type: 'Cash', amount: 10, profit: 2 },
            ],
          },
        ],
        theme: supersetTheme,
      });

      const props = transformProps(chartProps);

      expect(props.dynamicMetricConfig).toBeUndefined();
      expect(props.selectedDynamicMetric).toBeUndefined();
      expect(props.effectiveMetricSignature).toBeUndefined();
      expect(props.generatedColumnIds).toEqual([
        '__crosstab_col__string:4:Cash__metric__amount',
        '__crosstab_col__string:4:Cash__metric__profit',
      ]);
    },
  );

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
