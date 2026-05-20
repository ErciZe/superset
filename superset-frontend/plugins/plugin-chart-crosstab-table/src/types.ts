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
import type {
  ChartProps,
  DataRecord,
  DataRecordValue,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';

export type CrosstabConditionalRule = {
  metric?: string;
  operator: '>' | '>=' | '<' | '<=' | '=' | '!=';
  value: number;
  color?: string;
  backgroundColor?: string;
  arrow?: 'up' | 'down';
};

export interface CrosstabFormData extends QueryFormData {
  groupbyRows?: QueryFormColumn[];
  groupbyColumns?: QueryFormColumn[];
  metrics?: QueryFormMetric[];
  crosstabFieldConfig?: CrosstabFieldConfig;
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  showRowSubtotals?: boolean;
  showColumnSubtotals?: boolean;
  maxGeneratedColumns?: number;
  serverColumnPagination?: boolean;
  columnPageSize?: number;
  generatedColumnWidth?: number;
  defaultRowExpandedDepth?: number;
  numberFormat?: string;
  conditionalFormatting?: CrosstabConditionalRule[] | string;
  serverPagination?: boolean;
}

export type CrosstabBuildOptions = {
  rowFields: string[];
  columnFields: string[];
  metricFields: string[];
  fieldLabels?: Record<string, string>;
  rowSubtotalDepths?: number[];
  totalLabel?: string;
  showRowSubtotals: boolean;
  showRowTotals: boolean;
  showColumnTotals: boolean;
  showColumnSubtotals: boolean;
  maxGeneratedColumns: number;
  defaultRowExpandedDepth: number;
  summaryValues?: CrosstabSummaryValues;
  resolveSemantic?: ResolveCrosstabMetricSemantic;
};

export type CrosstabQueryRole =
  | 'leaf'
  | 'server_column_domain'
  | 'server_column_count'
  | 'summary';

export type CrosstabSummaryKind =
  | 'row_total'
  | 'row_subtotal_cells'
  | 'row_subtotal_total'
  | 'row_column_subtotal_cells'
  | 'column_total'
  | 'column_subtotal_cells'
  | 'column_subtotal_total'
  | 'grand_total';

export type CrosstabQueryPlanItem = {
  queryId: string;
  role: CrosstabQueryRole;
  summaryKind?: CrosstabSummaryKind;
  rowDepth?: number;
  columnDepth?: number;
};

export type CrosstabColumnNode = {
  id: string;
  label: string;
  children?: CrosstabColumnNode[];
  metric?: string;
  field?: string;
};

export type CrosstabEngineResult = {
  rowData: DataRecord[];
  columns: DataColumnMeta[];
  columnTree: CrosstabColumnNode[];
  generatedColumnIds: string[];
};

export type DimensionFieldConfig = {
  field: QueryFormColumn;
  label?: string;
  showSubtotal?: boolean;
};

export type MetricSemantic =
  | 'unknown'
  | 'additive'
  | 'ratio'
  | 'average'
  | 'distinct';

export type CrosstabSummaryValues = {
  rowTotal?: Map<string, number | null>;
  rowSubtotalCells?: Map<string, number | null>;
  rowSubtotalTotal?: Map<string, number | null>;
  rowColumnSubtotalCells?: Map<string, number | null>;
  columnTotal?: Map<string, number | null>;
  columnSubtotalCells?: Map<string, number | null>;
  columnSubtotalTotal?: Map<string, number | null>;
  grandTotal?: Map<string, number | null>;
};

export type ResolveCrosstabMetricSemantic = (args: {
  row: DataRecord;
  metric: string;
}) => MetricSemantic;

export type MetricSemanticOverride = {
  value: DataRecordValue;
  semantic: MetricSemantic;
};

export type MetricFieldConfig = {
  metric: QueryFormMetric;
  label?: string;
  semantic?: MetricSemantic;
};

export type CrosstabFieldConfig = {
  rows?: DimensionFieldConfig[];
  columns?: DimensionFieldConfig[];
  metrics?: MetricFieldConfig[];
  semanticOverrideField?: QueryFormColumn;
  semanticOverrides?: MetricSemanticOverride[];
};

export type CrosstabChartProps = ChartProps<CrosstabFormData> &
  CrosstabEngineResult & {
    serverColumnTotalCount?: number;
    serverColumnCurrentPage?: number;
    serverColumnPageSize?: number;
    isServerColumnLoading?: boolean;
    expandedRowPaths?: string[];
  };

export type CrosstabOwnState = {
  currentColumnPage?: number;
  expandedRowPaths?: string[];
  serverColumnPageColumnSignature?: string;
  serverColumnPageTuples?: DataRecordValue[][];
  serverColumnPageTuplesPage?: number;
  serverColumnTotalCount?: number;
};
