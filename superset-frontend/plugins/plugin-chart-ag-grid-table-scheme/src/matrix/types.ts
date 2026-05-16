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
  DataRecord,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import type { DataColumnMeta } from '@superset-ui/plugin-chart-ag-grid-table/src/types';

export type MatrixCalculation =
  | 'raw'
  | 'contribution'
  | 'row_contribution'
  | 'row_rank';

export type MatrixTotalPosition = 'left' | 'right';

export type MatrixTransformConfig = {
  rows: string[];
  columns: string[];
  value: string;
  rowSort?: string;
  rowSortDesc?: boolean;
  unitField?: string;
  showTotal: boolean;
  totalPosition: MatrixTotalPosition;
  calculation: MatrixCalculation;
  maxGeneratedColumns: number;
};

export type MatrixTransformResult = {
  data: DataRecord[];
  columns: DataColumnMeta[];
  generatedColumnIds: string[];
};

export type MatrixFormData = {
  matrix_mode_enabled?: boolean;
  matrix_rows?: QueryFormColumn[];
  matrix_columns?: QueryFormColumn[];
  matrix_value?: QueryFormMetric | QueryFormMetric[] | null;
  matrix_row_sort?: QueryFormColumn | QueryFormColumn[] | null;
  matrix_row_sort_desc?: boolean;
  matrix_unit_field?: QueryFormColumn | QueryFormColumn[] | null;
  matrix_show_total?: boolean;
  matrix_total_position?: MatrixTotalPosition;
  matrix_value_calculation?: MatrixCalculation;
  matrix_max_generated_columns?: number;
  column_settings_enabled?: boolean;
};
