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
import officialTransformProps from '@superset-ui/plugin-chart-ag-grid-table/src/transformProps';
import type { TableChartProps } from '@superset-ui/plugin-chart-ag-grid-table/src/types';
import {
  ensureIsArray,
  GenericDataType,
  getMetricLabel,
  type DataRecordValue,
  type TimeFormatter,
} from '@superset-ui/core';
import DateWithFormatter from '@superset-ui/plugin-chart-ag-grid-table/src/utils/DateWithFormatter';
import { matrixTransform } from './matrix/matrixTransform';
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
  if (officialProps.serverPagination) {
    throw new Error('Matrix mode does not support server pagination.');
  }

  const matrixResult = matrixTransform(
    chartProps.queriesData?.[0]?.data ?? officialProps.data,
    buildMatrixConfig(formData, officialProps.columns),
  );

  return {
    ...scopedProps,
    data: matrixResult.data,
    columns: matrixResult.columns,
    metrics: matrixResult.generatedColumnIds,
    percentMetrics: [],
  };
}
