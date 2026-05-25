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
import AgGridTableChart from './table/AgGridTableChart';
import type { AgGridTableChartTransformedProps } from './table/types';
import type {
  ColDef,
  GridReadyEvent,
} from '@superset-ui/core/components/ThemedAgGridReact';
import ColumnViewSchemeToolbar from './columnViewSchemes/ColumnViewSchemeToolbar';

const COLUMN_VIEW_TOOLBAR_HEIGHT = 48;

type SchemeChartProps = AgGridTableChartTransformedProps & {
  dashboardId?: number | null;
  datasetId?: number | null;
  columnViewSchemesEnabled?: boolean;
  columnSettingsEnabled?: boolean;
};

type RenderToolbarArgs = {
  gridApi?: GridReadyEvent['api'];
  colDefs: ColDef[];
};

export default function AgGridTableSchemeChart(props: SchemeChartProps) {
  const columnViewSchemesEnabled = props.columnViewSchemesEnabled !== false;

  return (
    <AgGridTableChart
      {...props}
      columnViewToolbarHeight={
        columnViewSchemesEnabled ? COLUMN_VIEW_TOOLBAR_HEIGHT : undefined
      }
      renderColumnViewToolbar={
        columnViewSchemesEnabled
          ? ({ gridApi, colDefs }: RenderToolbarArgs) => (
              <ColumnViewSchemeToolbar
                chartId={props.slice_id}
                dashboardId={props.dashboardId}
                datasetId={props.datasetId}
                gridApi={gridApi}
                colDefs={colDefs}
                includeSortState={!props.serverPagination}
                schemeManagementEnabled={columnViewSchemesEnabled}
                columnSettingsEnabled={Boolean(props.columnSettingsEnabled)}
              />
            )
          : undefined
      }
    />
  );
}
