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
  getColumnLabel,
  getMetricLabel,
  type ChartProps,
  type DataRecord,
  type QueryFormColumn,
  type QueryFormMetric,
} from '@superset-ui/core';
import { buildCrosstab } from '../crosstab/engine';
import type { CrosstabChartProps, CrosstabFormData } from '../types';

function normalizeColumn(value: QueryFormColumn): string {
  if (value === null || value === undefined) {
    throw new Error('Unsupported crosstab column field.');
  }

  const label = getColumnLabel(value);
  if (!label) {
    throw new Error('Unsupported crosstab column field.');
  }

  return label;
}

function normalizeMetric(value: QueryFormMetric): string {
  if (value === null || value === undefined) {
    throw new Error('Unsupported crosstab metric field.');
  }

  const label = getMetricLabel(value);
  if (!label) {
    throw new Error('Unsupported crosstab metric field.');
  }

  return label;
}

export default function transformProps(
  chartProps: ChartProps<CrosstabFormData>,
): CrosstabChartProps {
  const { formData, queriesData } = chartProps;
  const result = buildCrosstab((queriesData[0]?.data ?? []) as DataRecord[], {
    rowFields: ensureIsArray<QueryFormColumn>(formData.groupbyRows).map(
      normalizeColumn,
    ),
    columnFields: ensureIsArray<QueryFormColumn>(formData.groupbyColumns).map(
      normalizeColumn,
    ),
    metricFields: ensureIsArray<QueryFormMetric>(formData.metrics).map(
      normalizeMetric,
    ),
    showRowSubtotals: formData.showRowSubtotals ?? true,
    showRowTotals: formData.showRowTotals ?? true,
    showColumnTotals: formData.showColumnTotals ?? true,
    showColumnSubtotals: formData.showColumnSubtotals ?? false,
    maxGeneratedColumns: formData.maxGeneratedColumns ?? 300,
    defaultRowExpandedDepth: formData.defaultRowExpandedDepth ?? 1,
  });

  return {
    ...chartProps,
    rowData: result.rowData,
    columns: result.columns,
    columnTree: result.columnTree,
    generatedColumnIds: result.generatedColumnIds,
  };
}
