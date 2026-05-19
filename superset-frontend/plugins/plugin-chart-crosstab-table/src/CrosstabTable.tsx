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
import { useMemo } from 'react';
import { ThemedAgGridReact } from '@superset-ui/core/components';
import type { DataRecordValue } from '@superset-ui/core';
import {
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  type ValueFormatterParams,
  ModuleRegistry,
} from '@superset-ui/core/components/ThemedAgGridReact';
import type { CrosstabChartProps, CrosstabConditionalRule } from './types';
import {
  formatCrosstabValue,
  resolveConditionalStyle,
} from './crosstab/formatting';

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

function getMetricFromColumnId(columnId: string) {
  return columnId.split('__metric__')[1];
}

export default function CrosstabTable({
  columns,
  formData,
  height,
  rowData,
  width,
}: CrosstabChartProps) {
  const numberFormat = formData.numberFormat;
  const conditionalFormatting: CrosstabConditionalRule[] =
    formData.conditionalFormatting ?? [];
  const columnDefs = useMemo<ColDef[]>(
    () =>
      columns.map(column => {
        const metric = getMetricFromColumnId(column.key);
        const rules = conditionalFormatting.filter(
          rule => !rule.metric || rule.metric === metric,
        );

        return {
          field: column.key,
          colId: column.key,
          headerName: column.label,
          valueFormatter: ({ value }: ValueFormatterParams) =>
            formatCrosstabValue(value as DataRecordValue, numberFormat),
          cellStyle: ({ value }) => {
            const { arrow, ...style } = resolveConditionalStyle(
              value as DataRecordValue,
              rules,
            );
            return style;
          },
        };
      }),
    [columns, conditionalFormatting, numberFormat],
  );

  return (
    <div data-test="crosstab-table" style={{ height, width }}>
      <ThemedAgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        enableCellTextSelection
      />
    </div>
  );
}
