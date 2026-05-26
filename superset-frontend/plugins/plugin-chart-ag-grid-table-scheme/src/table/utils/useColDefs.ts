/* eslint-disable camelcase */
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
import { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import { useCallback, useMemo } from 'react';
import { GenericDataType } from '@apache-superset/core/common';
import { DataRecord } from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import {
  AdditionalCellStyle,
  AdditionalCellFormatter,
  AdditionalCellFormatterParams,
  AdditionalCellFormatterResult,
  BasicColorFormatterType,
  CellRendererProps,
  InputColumn,
} from '../types';
import getCellClass from './getCellClass';
import filterValueGetter from './filterValueGetter';
import dateFilterComparator from './dateFilterComparator';
import { getAggFunc } from './getAggFunc';
import { TextCellRenderer } from '../renderers/TextCellRenderer';
import { NumericCellRenderer } from '../renderers/NumericCellRenderer';
import CustomHeader from '../AgGridTable/components/CustomHeader';
import { valueFormatter, valueGetter } from './formatValue';
import getCellStyle from './getCellStyle';

interface InputData {
  [key: string]: any;
}

type UseColDefsProps = {
  columns: InputColumn[];
  data: InputData[];
  serverPagination: boolean;
  isRawRecords: boolean;
  defaultAlignPN: boolean;
  showCellBars: boolean;
  colorPositiveNegative: boolean;
  totals: DataRecord | undefined;
  columnColorFormatters: ColorFormatters;
  allowRearrangeColumns?: boolean;
  basicColorFormatters?: { [Key: string]: BasicColorFormatterType }[];
  additionalCellStyle?: AdditionalCellStyle;
  additionalCellFormatter?: AdditionalCellFormatter;
  isUsingTimeComparison?: boolean;
  emitCrossFilters?: boolean;
  alignPositiveNegative: boolean;
  slice_id: number;
};

type ValueRange = [number, number];

const FORMATTER_CACHE_KEY_SEPARATOR = '\u001f';

const getFormatterCacheKey = (
  params: AdditionalCellFormatterParams,
  col: InputColumn,
) =>
  [
    params.node?.id ?? '',
    params.rowIndex ?? '',
    params.colDef?.field ?? col.key,
    String(params.value),
    String(params.valueFormatted),
  ].join(FORMATTER_CACHE_KEY_SEPARATOR);

const normalizeFormatterParams = (
  params: AdditionalCellFormatterParams,
  col: InputColumn,
): AdditionalCellFormatterParams => ({
  data: params.data,
  value: params.value,
  valueFormatted: params.valueFormatted,
  rowIndex: params.rowIndex,
  colDef: params.colDef,
  node: params.node,
  col,
});

const createCachedAdditionalCellFormatter = (
  additionalCellFormatter: AdditionalCellFormatter | undefined,
  col: InputColumn,
): AdditionalCellFormatter | undefined => {
  if (!additionalCellFormatter) {
    return undefined;
  }

  const rowCache = new WeakMap<
    object,
    Map<string, AdditionalCellFormatterResult | undefined>
  >();
  const fallbackCache = new Map<
    string,
    AdditionalCellFormatterResult | undefined
  >();

  return params => {
    const cacheKey = getFormatterCacheKey(params, col);
    const { data } = params;
    const cache =
      data && typeof data === 'object'
        ? (rowCache.get(data) ?? new Map())
        : fallbackCache;

    if (data && typeof data === 'object' && !rowCache.has(data)) {
      rowCache.set(data, cache);
    }

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const result = additionalCellFormatter(
      normalizeFormatterParams(params, col),
    );
    cache.set(cacheKey, result);
    return result;
  };
};

function getValueRange(
  key: string,
  alignPositiveNegative: boolean,
  data: InputData[],
) {
  if (typeof data?.[0]?.[key] === 'number') {
    const nums = data.map(row => row[key]) as number[];
    return (
      alignPositiveNegative ? [0, d3Max(nums.map(Math.abs))] : d3Extent(nums)
    ) as ValueRange;
  }
  return null;
}

const getCellDataType = (col: InputColumn) => {
  switch (col.dataType) {
    case GenericDataType.Numeric:
      return 'number';
    case GenericDataType.Temporal:
      return 'date';
    case GenericDataType.Boolean:
      return 'boolean';
    default:
      return 'text';
  }
};

const getFilterType = (col: InputColumn) => {
  switch (col.dataType) {
    case GenericDataType.Numeric:
      return 'agNumberColumnFilter';
    case GenericDataType.String:
      return 'agTextColumnFilter';
    case GenericDataType.Temporal:
      return 'agDateColumnFilter';
    default:
      return true;
  }
};

function getHeaderLabel(col: InputColumn) {
  let headerLabel: string | undefined;

  const hasOriginalLabel = !!col?.originalLabel;
  const isMain = col?.key?.includes('Main');
  const hasDisplayTypeIcon = col?.config?.displayTypeIcon !== false;
  const hasCustomColumnName = !!col?.config?.customColumnName;

  if (hasOriginalLabel && hasCustomColumnName) {
    if ('displayTypeIcon' in col.config) {
      headerLabel =
        hasDisplayTypeIcon && !isMain
          ? `${col.label} ${col.config.customColumnName}`
          : col.config.customColumnName;
    } else {
      headerLabel = col.config.customColumnName;
    }
  } else if (hasOriginalLabel && isMain) {
    headerLabel = col.originalLabel;
  } else if (hasOriginalLabel && !hasDisplayTypeIcon) {
    headerLabel = '';
  } else {
    headerLabel = col?.label;
  }
  return headerLabel || '';
}

export const useColDefs = ({
  columns,
  data,
  serverPagination,
  isRawRecords,
  defaultAlignPN,
  showCellBars,
  colorPositiveNegative,
  totals,
  columnColorFormatters,
  allowRearrangeColumns,
  basicColorFormatters,
  additionalCellStyle,
  additionalCellFormatter,
  isUsingTimeComparison,
  emitCrossFilters,
  alignPositiveNegative,
  slice_id,
}: UseColDefsProps) => {
  const getCommonColProps = useCallback(
    (
      col: InputColumn,
    ): ColDef & {
      isMain: boolean;
    } => {
      const {
        config,
        isMetric,
        isPercentMetric,
        isNumeric,
        key: originalKey,
        dataType,
        originalLabel,
      } = col;

      const alignPN =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;

      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;

      const isMain = originalKey?.includes('Main');
      const colId = isMain
        ? originalKey.replace('Main', '').trim()
        : originalKey;
      const isTextColumn =
        dataType === GenericDataType.String ||
        dataType === GenericDataType.Temporal;
      const cachedAdditionalCellFormatter = createCachedAdditionalCellFormatter(
        additionalCellFormatter,
        col,
      );

      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        showCellBars &&
        (config.showCellBars ?? true) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(originalKey, alignPN || alignPositiveNegative, data);

      const filter = getFilterType(col);

      return {
        field: colId,
        headerName: getHeaderLabel(col),
        valueFormatter: p => valueFormatter(p, col),
        valueGetter: p => valueGetter(p, col),
        cellStyle: p =>
          getCellStyle({
            ...p,
            ...(cachedAdditionalCellFormatter
              ? { valueFormatted: valueFormatter(p, col) }
              : {}),
            hasColumnColorFormatters,
            columnColorFormatters,
            hasBasicColorFormatters,
            basicColorFormatters,
            col,
            additionalCellStyle,
            additionalCellFormatter: cachedAdditionalCellFormatter,
          }),
        cellClass: p =>
          getCellClass({
            ...p,
            col,
            emitCrossFilters,
          }),
        minWidth: config?.columnWidth ?? 100,
        filter,
        ...(isPercentMetric && {
          filterValueGetter,
        }),
        ...(dataType === GenericDataType.Temporal && {
          filterParams: {
            comparator: dateFilterComparator,
          },
        }),
        cellDataType: getCellDataType(col),
        defaultAggFunc: getAggFunc(col),
        initialAggFunc: getAggFunc(col),
        ...(!(isMetric || isPercentMetric) && {
          allowedAggFuncs: [
            'sum',
            'min',
            'max',
            'count',
            'avg',
            'first',
            'last',
          ],
        }),
        cellRenderer: (p: CellRendererProps) =>
          isTextColumn ? TextCellRenderer(p) : NumericCellRenderer(p),
        cellRendererParams: {
          allowRenderHtml: true,
          columns,
          hasBasicColorFormatters,
          col,
          basicColorFormatters,
          valueRange,
          alignPositiveNegative: alignPN || alignPositiveNegative,
          colorPositiveNegative,
          additionalCellFormatter: cachedAdditionalCellFormatter,
        },
        context: {
          isMetric,
          isPercentMetric,
          isNumeric,
        },
        lockPinned: !allowRearrangeColumns,
        sortable: !serverPagination || !isPercentMetric,
        ...(serverPagination && {
          headerComponent: CustomHeader,
          comparator: () => 0,
          headerComponentParams: {
            slice_id,
          },
        }),
        isMain,
        ...(!isMain &&
          originalLabel && {
            columnGroupShow: 'open',
          }),
        ...(originalLabel && {
          timeComparisonKey: originalLabel,
        }),
        wrapText: !config?.truncateLongCells,
        autoHeight: !config?.truncateLongCells,
      };
    },
    [
      columns,
      data,
      defaultAlignPN,
      columnColorFormatters,
      basicColorFormatters,
      additionalCellStyle,
      additionalCellFormatter,
      showCellBars,
      colorPositiveNegative,
      isUsingTimeComparison,
      isRawRecords,
      emitCrossFilters,
      allowRearrangeColumns,
      serverPagination,
      alignPositiveNegative,
    ],
  );

  const stringifiedCols = JSON.stringify(columns);

  const colDefs = useMemo(() => {
    const groupIndexMap = new Map<string, number>();

    return columns.reduce<ColDef[]>((acc, col) => {
      const colDef = getCommonColProps(col);

      if (col?.originalLabel) {
        if (groupIndexMap.has(col.originalLabel)) {
          const groupIdx = groupIndexMap.get(col.originalLabel)!;
          (acc[groupIdx] as { children: ColDef[] }).children.push(colDef);
        } else {
          const group = {
            headerName: col.originalLabel,
            marryChildren: true,
            openByDefault: true,
            children: [colDef],
          };
          groupIndexMap.set(col.originalLabel, acc.length);
          acc.push(group);
        }
      } else {
        acc.push(colDef);
      }

      return acc;
    }, []);
  }, [stringifiedCols, getCommonColProps]);

  return colDefs;
};
