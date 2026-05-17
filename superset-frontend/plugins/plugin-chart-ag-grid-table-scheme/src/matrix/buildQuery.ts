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
  type BuildQuery,
  type QueryObject,
  type QueryFormColumn,
  type QueryFormMetric,
} from '@superset-ui/core';
import officialBuildQuery from '../../../plugin-chart-ag-grid-table/src/buildQuery';
import type { TableChartFormData } from '../../../plugin-chart-ag-grid-table/src/types';
import { shouldUseMatrixRawTotalSummary } from './summary';
import type { MatrixFormData } from './types';

type MatrixTableFormData = TableChartFormData & MatrixFormData;

const compactArray = <T>(value: T | T[] | null | undefined): T[] =>
  ensureIsArray(value).filter(Boolean);

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const getMatrixValue = (
  value: MatrixFormData['matrix_value'],
): QueryFormMetric | undefined => compactArray(value)[0];

const buildSummaryQuery = (
  query: QueryObject,
  summaryColumns: QueryFormColumn[],
): QueryObject => ({
  ...query,
  columns: summaryColumns,
  row_limit: 0,
  row_offset: 0,
  post_processing: [],
});

const buildQuery: BuildQuery<MatrixTableFormData> = (formData, options) => {
  if (!formData.matrix_mode_enabled) {
    return officialBuildQuery(formData, options);
  }

  if (formData.server_pagination) {
    throw new Error('Matrix mode does not support server pagination.');
  }

  const matrixRows = compactArray<QueryFormColumn>(formData.matrix_rows);
  const matrixColumns = compactArray<QueryFormColumn>(formData.matrix_columns);
  const rowSort = compactArray<QueryFormColumn>(formData.matrix_row_sort);
  const unitField = compactArray<QueryFormColumn>(formData.matrix_unit_field);
  const matrixValue = getMatrixValue(formData.matrix_value);

  if (!matrixRows.length || !matrixColumns.length || !matrixValue) {
    throw new Error('Matrix rows, columns, and value are required.');
  }

  const queryContext = officialBuildQuery(
    {
      ...formData,
      groupby: unique([
        ...matrixRows,
        ...matrixColumns,
        ...rowSort,
        ...unitField,
      ]),
      metrics: [matrixValue],
      percent_metrics: [],
      show_totals: false,
      timeseries_limit_metric: rowSort[0] ?? null,
      order_desc: Boolean(formData.matrix_row_sort_desc),
      server_pagination: false,
    },
    options,
  );

  if (shouldUseMatrixRawTotalSummary(formData)) {
    queryContext.queries.push(
      buildSummaryQuery(
        queryContext.queries[0],
        unique([...matrixRows, ...rowSort, ...unitField]),
      ),
    );
  }

  return queryContext;
};

export default buildQuery;
