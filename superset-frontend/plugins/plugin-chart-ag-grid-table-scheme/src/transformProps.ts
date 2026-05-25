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
  ensureIsArray,
  GenericDataType,
  getMetricLabel,
  type DataRecordValue,
  type TimeFormatter,
} from '@superset-ui/core';
import officialTransformProps from './table/transformProps';
import type { TableChartProps } from './table/types';
import DateWithFormatter from './table/utils/DateWithFormatter';
import {
  createMatrixCellStyle,
  getMatrixCellColorFormatters,
} from './matrix/cellColorRules';
import { createMatrixCellFormatter } from './matrix/cellFormatter';
import { matrixTransform, MATRIX_TOTAL_COL_ID } from './matrix/matrixTransform';
import { shouldUseMatrixRawTotalSummary } from './matrix/summary';
import type { MatrixFormData, MatrixTransformConfig } from './matrix/types';

type ScopedFormData = TableChartProps['rawFormData'] &
  MatrixFormData & {
    dashboardId?: number | string | null;
    dashboard_id?: number | string | null;
  };

const optionalNumber = (
  value: number | string | null | undefined,
  fieldName: string,
) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }
  return parsedValue;
};

const firstValue = <T>(value: T | T[] | null | undefined) =>
  ensureIsArray(value)[0];

const toFieldName = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'label' in value) {
    return String((value as { label: string }).label);
  }
  return null;
};

const maxGeneratedColumns = (value: number | string | null | undefined) => {
  if (value === undefined || value === null || value === '') {
    return 200;
  }
  return Number(value);
};

const trimMidnightTime = (label: string) =>
  label.replace(/^(\d{4}-\d{2}-\d{2}) 00:00:00$/, '$1');

const buildMatrixConfig = (
  formData: ScopedFormData,
  officialColumns: ReturnType<typeof officialTransformProps>['columns'],
): MatrixTransformConfig => {
  const rows = ensureIsArray(formData.matrix_rows)
    .map(toFieldName)
    .filter((value): value is string => Boolean(value));
  const columns = ensureIsArray(formData.matrix_columns)
    .map(toFieldName)
    .filter((value): value is string => Boolean(value));
  const metric = firstValue(formData.matrix_value);
  const value = metric ? getMetricLabel(metric) : '';
  const rowSort =
    toFieldName(firstValue(formData.matrix_row_sort)) ?? undefined;
  const unitField =
    toFieldName(firstValue(formData.matrix_unit_field)) ?? undefined;
  const columnByKey = new Map(
    (officialColumns ?? []).map(column => [column.key, column]),
  );
  const matrixFields = [...rows, ...columns];
  const fieldLabels = Object.fromEntries(
    matrixFields.map(field => [field, columnByKey.get(field)?.label ?? field]),
  );
  const dimensionLabelFormatters = Object.fromEntries(
    matrixFields.flatMap(field => {
      const column = columnByKey.get(field);
      if (!column?.formatter) {
        return [];
      }
      return [
        [
          field,
          (value: DataRecordValue) =>
            column.dataType === GenericDataType.Temporal
              ? trimMidnightTime(
                  String(
                    new DateWithFormatter(value, {
                      formatter: column.formatter as TimeFormatter,
                    }),
                  ),
                )
              : String(column.formatter?.(value as number)),
        ],
      ];
    }),
  );
  const temporalFields = matrixFields.filter(
    field => columnByKey.get(field)?.dataType === GenericDataType.Temporal,
  );
  const valueColumn = columnByKey.get(value);

  return {
    rows,
    columns,
    value,
    fieldLabels,
    dimensionLabelFormatters,
    temporalFields,
    valueFormatter: valueColumn?.formatter,
    rowSort,
    rowSortDesc: Boolean(formData.matrix_row_sort_desc),
    unitField,
    showTotal: formData.matrix_show_total !== false,
    totalPosition: formData.matrix_total_position ?? 'left',
    calculation: formData.matrix_value_calculation ?? 'raw',
    maxGeneratedColumns: maxGeneratedColumns(
      formData.matrix_max_generated_columns,
    ),
  };
};

const hasCompleteMatrixConfig = (config: MatrixTransformConfig) =>
  Boolean(config.rows.length && config.columns.length && config.value);

export default function transformProps(chartProps: TableChartProps) {
  const formData = chartProps.rawFormData as ScopedFormData;
  const datasourceId =
    chartProps.rawDatasource?.id ?? chartProps.datasource?.id ?? null;
  const officialProps = officialTransformProps(chartProps);

  const scopedProps = {
    ...officialProps,
    dashboardId: optionalNumber(
      formData.dashboardId ?? formData.dashboard_id,
      'dashboardId',
    ),
    datasetId: optionalNumber(datasourceId, 'datasetId'),
    columnViewSchemesEnabled: formData.column_view_schemes_enabled !== false,
    columnSettingsEnabled: Boolean(formData.column_settings_enabled),
  };

  if (!formData.matrix_mode_enabled) {
    return scopedProps;
  }

  const matrixConfig = buildMatrixConfig(formData, officialProps.columns);
  if (!hasCompleteMatrixConfig(matrixConfig)) {
    return scopedProps;
  }

  if (officialProps.serverPagination) {
    throw new Error('Matrix mode does not support server pagination.');
  }

  const shouldUseSummaryRecords = shouldUseMatrixRawTotalSummary(formData);
  const summaryRecords = chartProps.queriesData?.[1]?.data;
  if (shouldUseSummaryRecords && !summaryRecords) {
    throw new Error('Matrix summary query result is required for raw totals.');
  }

  const matrixResult = matrixTransform(
    chartProps.queriesData?.[0]?.data ?? officialProps.data,
    {
      ...matrixConfig,
      summaryRecords: shouldUseSummaryRecords ? summaryRecords : undefined,
    },
  );
  const matrixCellColorFormatters = getMatrixCellColorFormatters({
    rules: formData.matrix_cell_color_rules,
    generatedColumnIds: matrixResult.columns
      .map(column => column.key)
      .filter(
        columnId =>
          columnId === MATRIX_TOTAL_COL_ID ||
          matrixResult.generatedColumnIds.includes(columnId),
      ),
    data: matrixResult.data,
    theme: chartProps.theme,
  });

  return {
    ...scopedProps,
    data: matrixResult.data,
    columns: matrixResult.columns,
    metrics: matrixResult.generatedColumnIds,
    percentMetrics: [],
    columnColorFormatters: [],
    additionalCellStyle: createMatrixCellStyle(matrixCellColorFormatters),
    additionalCellFormatter: createMatrixCellFormatter(
      formData.matrix_cell_formatter_expression,
    ),
  };
}
