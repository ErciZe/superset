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
  CategoricalColorNamespace,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  NumberFormats,
  tooltipHtml,
  ValueFormatter,
  VizType,
} from '@superset-ui/core';
import type { CustomSeriesOption, CustomSeriesRenderItem } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { EChartsCoreOption } from 'echarts/core';
import type { FunnelSeriesOption } from 'echarts/charts';
import {
  DEFAULT_FORM_DATA as DEFAULT_FUNNEL_FORM_DATA,
  EchartsFunnelChartProps,
  EchartsFunnelFormData,
  EchartsFunnelLabelType,
  FunnelChartTransformedProps,
  PercentCalcType,
} from './types';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from '../utils/series';
import { resolveLegendLayout } from '../utils/legendLayout';
import { defaultGrid } from '../defaults';
import { DEFAULT_LEGEND_FORM_DATA, OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';

const defaultPercentFormatter = getNumberFormatter(
  NumberFormats.PERCENT_2_POINT,
);

type FunnelDataItem = {
  value: number;
  name: string;
  itemStyle: { color: string; opacity: OpacityEnum };
  firstStepPercent: number;
  prevStepPercent: number;
};

type RectangularFunnelDataItem = Omit<FunnelDataItem, 'value'> & {
  value: [number, number, number, number];
  totalPercent: number;
};

type RectangularFunnelPadding = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

function getNumericFunnelValue(value: CallbackDataParams['value']): number {
  return (Array.isArray(value) ? value[0] : value) as number;
}

function sortFunnelData(
  data: FunnelDataItem[],
  sort: EchartsFunnelFormData['sort'],
): FunnelDataItem[] {
  if (sort === 'none') {
    return [...data];
  }
  return [...data].sort((a, b) =>
    sort === 'ascending' ? a.value - b.value : b.value - a.value,
  );
}

function createRectangularFunnelRenderItem({
  orient,
  gap,
  itemCount,
  maxValue,
  padding,
}: {
  orient: EchartsFunnelFormData['orient'];
  gap: number;
  itemCount: number;
  maxValue: number;
  padding: RectangularFunnelPadding;
}): CustomSeriesRenderItem {
  return (params, api) => {
    const value = Math.max(Number(api.value(0)), 0);
    const valueRatio = maxValue > 0 ? value / maxValue : 0;
    const chartWidth = api.getWidth();
    const chartHeight = api.getHeight();
    const contentWidth = Math.max(chartWidth - padding.left - padding.right, 0);
    const contentHeight = Math.max(
      chartHeight - padding.top - padding.bottom,
      0,
    );
    const segmentGap = Math.max(gap, 0);

    if (orient === 'horizontal') {
      const segmentWidth = Math.max(
        (contentWidth - segmentGap * (itemCount - 1)) / itemCount,
        0,
      );
      const segmentHeight = contentHeight * valueRatio;
      return {
        type: 'rect',
        transition: ['shape'],
        shape: {
          x: padding.left + params.dataIndex * (segmentWidth + segmentGap),
          y: padding.top + (contentHeight - segmentHeight) / 2,
          width: segmentWidth,
          height: segmentHeight,
        },
        style: api.style(),
      };
    }

    const segmentHeight = Math.max(
      (contentHeight - segmentGap * (itemCount - 1)) / itemCount,
      0,
    );
    const segmentWidth = contentWidth * valueRatio;
    return {
      type: 'rect',
      transition: ['shape'],
      shape: {
        x: padding.left + (contentWidth - segmentWidth) / 2,
        y: padding.top + params.dataIndex * (segmentHeight + segmentGap),
        width: segmentWidth,
        height: segmentHeight,
      },
      style: api.style(),
    };
  };
}

export function parseParams({
  params,
  numberFormatter,
  percentFormatter = defaultPercentFormatter,
  percentCalculationType = PercentCalcType.FirstStep,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent' | 'data'>;
  numberFormatter: ValueFormatter;
  percentFormatter?: ValueFormatter;
  percentCalculationType?: PercentCalcType;
  sanitizeName?: boolean;
}) {
  const { name: rawName = '', value, percent: rawTotalPercent, data } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(getNumericFunnelValue(value));
  const {
    firstStepPercent,
    prevStepPercent,
    totalPercent = rawTotalPercent,
  } = data as {
    firstStepPercent: number;
    prevStepPercent: number;
    totalPercent?: number;
  };
  let percent;

  if (percentCalculationType === PercentCalcType.Total) {
    percent = (totalPercent ?? 0) / 100;
  } else if (percentCalculationType === PercentCalcType.PreviousStep) {
    percent = prevStepPercent ?? 0;
  } else {
    percent = firstStepPercent ?? 0;
  }
  const formattedPercent = percentFormatter(percent);
  return [name, formattedValue, formattedPercent];
}

export default function transformProps(
  chartProps: EchartsFunnelChartProps,
): FunnelChartTransformedProps {
  const {
    formData,
    height,
    hooks,
    filterState,
    queriesData,
    width,
    theme,
    emitCrossFilters,
    datasource,
  } = chartProps;
  const data: DataRecord[] = queriesData[0].data || [];
  const detectedCurrency = queriesData[0]?.detected_currency;
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const {
    colorScheme,
    groupby,
    orient,
    sort,
    gap,
    labelLine,
    labelTemplate,
    labelType,
    labelValueDivisor,
    labelValueSuffix,
    tooltipLabelType,
    legendMargin,
    legendOrientation,
    legendType,
    legendSort,
    metric = '',
    numberFormat,
    percentFormat,
    currencyFormat,
    showLabels,
    inContextMenu,
    showTooltipLabels,
    showLegend,
    sliceId,
    percentCalculationType,
    rectangularSegments = false,
  }: EchartsFunnelFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_FUNNEL_FORM_DATA,
    ...formData,
  };
  const {
    currencyFormats = {},
    columnFormats = {},
    currencyCodeColumn,
  } = datasource;
  const refs: Refs = {};
  const metricLabel = getMetricLabel(metric);
  const groupbyLabels = groupby.map(getColumnLabel);
  const keys = data.map(datum =>
    extractGroupbyLabel({ datum, groupby: groupbyLabels, coltypeMapping: {} }),
  );
  const labelMap = data.reduce((acc: Record<string, string[]>, datum) => {
    const label = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping: {},
    });
    return {
      ...acc,
      [label]: groupbyLabels.map(col => datum[col] as string),
    };
  }, {});

  const { setDataMask = () => {}, onContextMenu } = hooks;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    numberFormat,
    currencyFormat,
    undefined,
    data,
    currencyCodeColumn,
    detectedCurrency,
  );
  const percentFormatter = getNumberFormatter(percentFormat);
  const metricDisplayName =
    datasource.metrics?.find(
      metricItem => metricItem.metric_name === metricLabel,
    )?.verbose_name || metricLabel;

  const transformedData: FunnelDataItem[] = data.map((datum, index) => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping: {},
    });
    const value = datum[metricLabel] as number;
    const isFiltered =
      filterState.selectedValues && !filterState.selectedValues.includes(name);
    const firstStepPercent = value / (data[0][metricLabel] as number);
    const prevStepPercent =
      index === 0 ? 1 : value / (data[index - 1][metricLabel] as number);
    return {
      value,
      name,
      itemStyle: {
        color: colorFn(name, sliceId),
        opacity: isFiltered
          ? OpacityEnum.SemiTransparent
          : OpacityEnum.NonTransparent,
      },
      firstStepPercent,
      prevStepPercent,
    };
  });

  const sortedRectangularData = rectangularSegments
    ? sortFunnelData(transformedData, sort)
    : [];
  const rectangularTotalValue = sortedRectangularData.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const rectangularData: RectangularFunnelDataItem[] =
    sortedRectangularData.map((datum, index) => ({
      ...datum,
      value: [
        datum.value,
        index,
        datum.firstStepPercent,
        datum.prevStepPercent,
      ],
      totalPercent: rectangularTotalValue
        ? (datum.value / rectangularTotalValue) * 100
        : 0,
    }));

  const selectionData = rectangularSegments ? rectangularData : transformedData;

  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = selectionData.findIndex(
        ({ name }) => name === selectedValue,
      );
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  const formatter = (params: CallbackDataParams) => {
    const [name, formattedValue, formattedPercent] = parseParams({
      params,
      numberFormatter,
      percentFormatter,
      percentCalculationType,
    });
    if (labelTemplate) {
      if (!Number.isFinite(labelValueDivisor) || labelValueDivisor <= 0) {
        throw new Error('Label value divisor must be greater than zero');
      }
      const templateValues = {
        '{name}': name,
        '{value}': `${numberFormatter(
          getNumericFunnelValue(params.value) / labelValueDivisor,
        )}${labelValueSuffix}`,
        '{percent}': formattedPercent,
        '\\n': '\n',
      };
      return Object.entries(templateValues).reduce(
        (label, [placeholder, value]) => label.replaceAll(placeholder, value),
        labelTemplate,
      );
    }
    switch (labelType) {
      case EchartsFunnelLabelType.Key:
        return name;
      case EchartsFunnelLabelType.Value:
        return formattedValue;
      case EchartsFunnelLabelType.Percent:
        return formattedPercent;
      case EchartsFunnelLabelType.KeyValue:
        return `${name}: ${formattedValue}`;
      case EchartsFunnelLabelType.KeyValuePercent:
        return `${name}: ${formattedValue} (${formattedPercent})`;
      case EchartsFunnelLabelType.KeyPercent:
        return `${name}: ${formattedPercent}`;
      case EchartsFunnelLabelType.ValuePercent:
        return `${formattedValue} (${formattedPercent})`;
      default:
        return name;
    }
  };

  const defaultLabel = {
    formatter,
    show: showLabels,
    color: theme.colorText,
  };
  const legendData = keys.sort((a: string, b: string) => {
    if (!legendSort) return 0;
    return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  });
  const { effectiveLegendMargin, effectiveLegendType } = resolveLegendLayout({
    chartHeight: height,
    chartWidth: width,
    legendItems: legendData,
    legendMargin,
    orientation: legendOrientation,
    show: showLegend,
    theme,
    type: legendType,
  });

  const chartPadding = getChartPadding(
    showLegend,
    legendOrientation,
    effectiveLegendMargin,
  );
  const series: Array<FunnelSeriesOption | CustomSeriesOption> = [
    rectangularSegments
      ? {
          type: 'custom',
          coordinateSystem: 'none',
          animation: true,
          progressive: 0,
          renderItem: createRectangularFunnelRenderItem({
            orient,
            gap,
            itemCount: rectangularData.length,
            maxValue: Math.max(
              ...rectangularData.map(item => item.value[0]),
              0,
            ),
            padding: chartPadding,
          }),
          label: {
            ...defaultLabel,
            position: labelLine
              ? orient === 'horizontal'
                ? 'bottom'
                : 'right'
              : 'inside',
          },
          emphasis: {
            label: {
              show: true,
              fontWeight: 'bold',
            },
          },
          data: rectangularData,
        }
      : {
          type: VizType.Funnel,
          ...chartPadding,
          animation: true,
          minSize: '0%',
          maxSize: '100%',
          sort,
          orient,
          gap,
          funnelAlign: 'center',
          labelLine: { show: !!labelLine },
          label: {
            ...defaultLabel,
            position: labelLine ? 'outer' : 'inner',
          },
          emphasis: {
            label: {
              show: true,
              fontWeight: 'bold',
            },
          },
          data: transformedData,
        },
  ];

  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu && showTooltipLabels,
      trigger: 'item',
      formatter: (params: CallbackDataParams) => {
        const [name, formattedValue, formattedPercent] = parseParams({
          params,
          numberFormatter,
          percentFormatter,
          percentCalculationType,
        });
        const row = [];
        const enumName = EchartsFunnelLabelType[tooltipLabelType];
        const title = enumName.includes('Key') ? name : undefined;
        if (enumName.includes('Value') || enumName.includes('Percent')) {
          row.push(metricDisplayName);
        }
        if (enumName.includes('Value')) {
          row.push(formattedValue);
        }
        if (enumName.includes('Percent')) {
          row.push(formattedPercent);
        }
        return tooltipHtml([row], title);
      },
    },
    legend: {
      ...getLegendProps(
        effectiveLegendType,
        legendOrientation,
        showLegend,
        theme,
      ),
      data: legendData,
    },
    series,
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitCrossFilters,
    labelMap,
    groupby,
    selectedValues,
    onContextMenu,
    refs,
    coltypeMapping,
  };
}
