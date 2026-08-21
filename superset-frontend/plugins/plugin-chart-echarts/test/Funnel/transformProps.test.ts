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
import { ChartProps, getNumberFormatter } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { FunnelSeriesOption } from 'echarts/charts';
import type {
  CallbackDataParams,
  LabelFormatterCallback,
} from 'echarts/types/src/util/types';
import transformProps, { parseParams } from '../../src/Funnel/transformProps';
import {
  EchartsFunnelChartProps,
  PercentCalcType,
} from '../../src/Funnel/types';

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  granularity_sqla: 'ds',
  metric: 'sum__num',
  groupby: ['foo', 'bar'],
};
const queriesData = [
  {
    data: [
      { foo: 'Sylvester', bar: 1, sum__num: 10 },
      { foo: 'Arnold', bar: 2, sum__num: 2.5 },
    ],
  },
];
const chartProps = new ChartProps({
  formData,
  width: 800,
  height: 600,
  queriesData,
  theme: supersetTheme,
});

const callbackParams = (
  overrides: Partial<CallbackDataParams> = {},
): CallbackDataParams => ({
  componentType: 'series',
  componentSubType: 'funnel',
  componentIndex: 0,
  seriesType: 'funnel',
  seriesIndex: 0,
  seriesId: '',
  seriesName: '',
  name: 'S',
  dataIndex: 0,
  data: { firstStepPercent: 1, prevStepPercent: 1 },
  dataType: undefined,
  value: 10,
  color: '#000000',
  borderColor: '',
  dimensionNames: [],
  encode: {},
  marker: '',
  status: 'normal',
  percent: 100,
  $vars: [],
  ...overrides,
});

describe('Funnel transformProps', () => {
  test('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsFunnelChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Arnold, 2',
                  value: 2.5,
                }),
                expect.objectContaining({
                  name: 'Sylvester, 1',
                  value: 10,
                }),
              ]),
            }),
          ],
        }),
      }),
    );
  });

  test('does not apply a text border to segment labels', () => {
    // A white textBorder washes out the dark text on light-colored segments.
    const result = transformProps(chartProps as EchartsFunnelChartProps);
    const { label } = (result.echartOptions.series as any)[0];
    expect(label.color).toBe(supersetTheme.colorText);
    expect(label.textBorderColor).toBeUndefined();
    expect(label.textBorderWidth).toBeUndefined();
  });

  test('formats a configured label template without changing funnel geometry', () => {
    const props = new ChartProps({
      ...chartProps,
      formData: {
        ...formData,
        groupby: ['foo'],
        label_template: '{name}\\n{value} | {percent}',
        label_value_divisor: 10,
        label_value_suffix: '万',
        number_format: '$,.1f',
        percent_format: ',.1~%',
        percent_calculation_type: PercentCalcType.Total,
        tooltip_label_type: 5,
      },
      datasource: {
        metrics: [
          {
            uuid: '90eadf6a-f870-4305-a33a-77f5ca39b968',
            metric_name: 'sum__num',
            verbose_name: '销售额',
          },
        ],
      },
      queriesData: [
        {
          data: [
            { foo: 'S', sum__num: 615 },
            { foo: 'A', sum__num: 390 },
          ],
        },
      ],
    });
    const result = transformProps(props as unknown as EchartsFunnelChartProps);
    const series = (result.echartOptions.series as FunnelSeriesOption[])[0]!;
    const formatter = series.label?.formatter as LabelFormatterCallback;
    const params = callbackParams({
      data: {
        firstStepPercent: 1,
        prevStepPercent: 1,
      },
      value: 615,
      percent: 61.25,
    });

    expect(series.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'S', value: 615 }),
      ]),
    );
    expect(formatter(params)).toBe('S\n$61.5万 | 61.3%');

    const tooltipFormatter = (
      result.echartOptions.tooltip as unknown as {
        formatter: (params: CallbackDataParams) => string;
      }
    ).formatter;
    const tooltip = tooltipFormatter(params);
    expect(tooltip).toContain('销售额');
    expect(tooltip).not.toContain('sum__num');
    expect(tooltip).toContain('61.3%');
  });

  test('keeps the existing label behavior when no template is configured', () => {
    const result = transformProps(chartProps as EchartsFunnelChartProps);
    const series = (result.echartOptions.series as FunnelSeriesOption[])[0]!;
    const formatter = series.label?.formatter as LabelFormatterCallback;

    expect(
      formatter(
        callbackParams({
          name: 'S',
          value: 10,
          percent: 80,
          data: { firstStepPercent: 0.8, prevStepPercent: 0.8 },
        }),
      ),
    ).toBe('S');
  });

  test('rejects a non-positive configured label value divisor', () => {
    const props = new ChartProps({
      ...chartProps,
      formData: {
        ...formData,
        groupby: ['foo'],
        label_template: '{value}',
        label_value_divisor: 0,
      },
      queriesData: [{ data: [{ foo: 'S', sum__num: 10 }] }],
    });
    const result = transformProps(props as unknown as EchartsFunnelChartProps);
    const series = (result.echartOptions.series as FunnelSeriesOption[])[0]!;
    const formatter = series.label?.formatter as LabelFormatterCallback;

    expect(() => formatter(callbackParams())).toThrow(
      'Label value divisor must be greater than zero',
    );
  });
});

describe('formatFunnelLabel', () => {
  test('should generate a valid funnel chart label', () => {
    const numberFormatter = getNumberFormatter();
    const params = {
      name: 'My Label',
      value: 1234,
      percent: 12.34,
      data: { firstStepPercent: 0.5, prevStepPercent: 0.85 },
    };
    expect(
      parseParams({
        params,
        numberFormatter,
        percentCalculationType: PercentCalcType.Total,
      }),
    ).toEqual(['My Label', '1.23k', '12.34%']);
    expect(
      parseParams({
        params,
        numberFormatter,
        percentCalculationType: PercentCalcType.FirstStep,
      }),
    ).toEqual(['My Label', '1.23k', '50.00%']);
    expect(
      parseParams({
        params,
        numberFormatter,
        percentCalculationType: PercentCalcType.PreviousStep,
      }),
    ).toEqual(['My Label', '1.23k', '85.00%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        percentCalculationType: PercentCalcType.Total,
      }),
    ).toEqual(['<NULL>', '1.23k', '12.34%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        percentCalculationType: PercentCalcType.Total,
        sanitizeName: true,
      }),
    ).toEqual(['&lt;NULL&gt;', '1.23k', '12.34%']);
  });
});

describe('legend sorting', () => {
  const legendQueriesData = [
    {
      data: [
        { foo: 'Sylvester', sum__num: 10 },
        { foo: 'Arnold', sum__num: 2.5 },
        { foo: 'Mark', sum__num: 13 },
      ],
    },
  ];
  const createChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartProps,
      formData: {
        ...formData,
        groupby: ['foo'],
        ...overrides,
      },
      queriesData: legendQueriesData,
    });

  test('preserves original data order when no sort specified', () => {
    const props = createChartProps({ legendSort: null });
    const result = transformProps(props as EchartsFunnelChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['Sylvester', 'Arnold', 'Mark']);
  });

  test('sorts alphabetically ascending when legendSort is "asc"', () => {
    const props = createChartProps({ legendSort: 'asc' });
    const result = transformProps(props as EchartsFunnelChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['Arnold', 'Mark', 'Sylvester']);
  });

  test('sorts alphabetically descending when legendSort is "desc"', () => {
    const props = createChartProps({ legendSort: 'desc' });
    const result = transformProps(props as EchartsFunnelChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual(['Sylvester', 'Mark', 'Arnold']);
  });
});
