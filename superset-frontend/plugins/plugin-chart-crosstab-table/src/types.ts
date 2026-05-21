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

export type DynamicGroupByPlacement = 'rows' | 'columns';

export type LegacyCrosstabDynamicGroupByOption = {
  label: string;
  column: QueryFormColumn;
};

export type LegacyCrosstabDynamicGroupByConfig = {
  enabled: boolean;
  placement: DynamicGroupByPlacement;
  slotIndex: number;
  defaultColumn: QueryFormColumn;
  options: LegacyCrosstabDynamicGroupByOption[];
};

export type CrosstabDynamicGroupByOption = {
  id: string;
  label: string;
  columns: QueryFormColumn[];
};

export type CrosstabDynamicGroupBySlot = {
  id: string;
  label?: string;
  placement: DynamicGroupByPlacement;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: CrosstabDynamicGroupByOption[];
};

export type CrosstabDynamicGroupByConfig = {
  enabled: boolean;
  slots: CrosstabDynamicGroupBySlot[];
};

export type CrosstabDynamicMetricOption = {
  id: string;
  label: string;
  metrics: MetricFieldConfig[];
};

export type CrosstabDynamicMetricSlot = {
  id: string;
  label?: string;
  slotIndex: number;
  spliceCount?: number;
  defaultOptionId: string;
  options: CrosstabDynamicMetricOption[];
};

export type CrosstabDynamicMetricConfig = {
  enabled: boolean;
  slots: CrosstabDynamicMetricSlot[];
};

export type CrosstabDynamicGroupByInput =
  | CrosstabDynamicGroupByConfig
  | LegacyCrosstabDynamicGroupByConfig;

export interface CrosstabFormData extends QueryFormData {
  groupbyRows?: QueryFormColumn[];
  groupbyColumns?: QueryFormColumn[];
  metrics?: QueryFormMetric[];
  crosstabFieldConfig?: CrosstabFieldConfig;
  dynamicGroupBy?: CrosstabDynamicGroupByInput | string;
  dynamicMetric?: CrosstabDynamicMetricConfig | string;
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
    dynamicGroupByConfig?: CrosstabDynamicGroupByConfig;
    dynamicMetricConfig?: CrosstabDynamicMetricConfig;
    selectedDynamicGroupBy?: Record<string, string>;
    selectedDynamicMetric?: Record<string, string>;
    selectedDynamicGroupByColumn?: QueryFormColumn;
    effectiveGroupBySignature?: string;
    effectiveMetricSignature?: string;
    serverColumnTotalCount?: number;
    serverColumnCurrentPage?: number;
    serverColumnPageSize?: number;
    isServerColumnLoading?: boolean;
    expandedRowPaths?: string[];
  };

export type CrosstabOwnState = {
  currentColumnPage?: number;
  currentColumnPageSize?: number;
  selectedDynamicGroupBy?: Record<string, string>;
  selectedDynamicMetric?: Record<string, string>;
  selectedDynamicGroupByColumn?: QueryFormColumn;
  effectiveGroupBySignature?: string;
  effectiveMetricSignature?: string;
  expandedRowPaths?: string[];
  serverColumnPageColumnSignature?: string;
  serverColumnPageTuples?: DataRecordValue[][];
  serverColumnPageTuplesPage?: number;
  serverColumnPageTuplesPageSize?: number;
  serverColumnTotalCount?: number;
};
