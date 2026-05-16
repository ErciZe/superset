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
import { ensureIsArray, getMetricLabel } from '@superset-ui/core';
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

const buildMatrixConfig = (formData: ScopedFormData): MatrixTransformConfig => {
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

  return {
    rows,
    columns,
    value,
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
    buildMatrixConfig(formData),
  );

  return {
    ...scopedProps,
    data: matrixResult.data,
    columns: matrixResult.columns,
    metrics: matrixResult.generatedColumnIds,
    percentMetrics: [],
  };
}
