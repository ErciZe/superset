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
import type { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';

export type SchemeColDef = ColDef & {
  field?: string;
  colId?: string;
  headerName?: string;
};

export type ColumnViewColumnState = {
  colId: string;
  hide?: boolean | null;
  width?: number;
  flex?: number | null;
  pinned?: string | boolean | null;
  sort?: string | null;
  sortIndex?: number | null;
  aggFunc?: string | null;
  rowGroup?: boolean;
  rowGroupIndex?: number | null;
  pivot?: boolean;
  pivotIndex?: number | null;
};

export type ColumnViewSchemeColumn = {
  colId: string;
  field?: string;
  headerName?: string;
  hide?: boolean | null;
  width?: number;
  pinned?: string | boolean | null;
};

export type ColumnViewSchemeState = {
  state_version: 1;
  viz_type: 'ag-grid-table-scheme';
  state_type: 'column_view';
  column_signature: string;
  columns: ColumnViewSchemeColumn[];
  raw_column_state: ColumnViewColumnState[];
  meta: {
    saved_at: string;
  };
};

export type ColumnViewScheme = {
  id: number;
  uuid: string;
  chart_id: number;
  dashboard_id?: number | null;
  dataset_id?: number | null;
  name: string;
  description: string | null;
  is_default: boolean;
  state: ColumnViewSchemeState;
  column_signature: string;
};
