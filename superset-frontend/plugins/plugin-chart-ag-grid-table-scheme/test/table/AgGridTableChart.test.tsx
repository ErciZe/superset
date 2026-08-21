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
import { render } from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/common';
import TableChart from '../../src/table/AgGridTableChart';
import type { AgGridTableProps } from '../../src/table/AgGridTable';

jest.mock('../../src/table/AgGridTable', () => ({
  __esModule: true,
  default: ({
    handleCrossFilter,
  }: Pick<AgGridTableProps, 'handleCrossFilter'>) => (
    <div
      data-test="ag-grid-table"
      data-cross-filter-enabled={String(Boolean(handleCrossFilter))}
    />
  ),
}));

jest.mock('../../src/table/utils/useColDefs', () => ({
  useColDefs: () => [],
}));

const baseProps = {
  height: 400,
  width: 1000,
  columns: [
    {
      key: 'platform_order_name',
      label: '平台订单号',
      dataType: GenericDataType.String,
    },
  ],
  data: [],
  includeSearch: false,
  allowRearrangeColumns: false,
  pageSize: 10,
  serverPagination: true,
  rowCount: 0,
  setDataMask: jest.fn(),
  serverPaginationData: {},
  percentMetrics: [],
  hasServerPageLengthChanged: false,
  serverPageLength: 10,
  hasPageLength: false,
  timeGrain: undefined,
  emitCrossFilters: false,
  filters: {},
  isRawRecords: false,
  alignPositiveNegative: false,
  showCellBars: false,
  isUsingTimeComparison: false,
  colorPositiveNegative: false,
  totals: {},
  showTotals: false,
  columnColorFormatters: [],
  basicColorFormatters: [],
  formData: {
    datasource: '1__table',
    viz_type: 'ag_grid_table',
  },
};

test('marks only the WHM order detail chart for scoped advanced filter styles', () => {
  const { container: whmContainer } = render(
    <TableChart {...baseProps} slice_id={17} />,
  );
  const { container: otherContainer } = render(
    <TableChart {...baseProps} slice_id={130} />,
  );

  expect(whmContainer.firstChild).toHaveClass('whm-order-detail-chart');
  expect(otherContainer.firstChild).not.toHaveClass('whm-order-detail-chart');
});

test('disables cell click cross-filtering only for the WHM order detail chart', () => {
  const { container: whmContainer } = render(
    <TableChart {...baseProps} slice_id={17} />,
  );
  const { container: otherContainer } = render(
    <TableChart {...baseProps} slice_id={130} />,
  );
  const whmChart = whmContainer.querySelector('[data-test="ag-grid-table"]');
  const otherChart = otherContainer.querySelector(
    '[data-test="ag-grid-table"]',
  );

  expect(whmChart).toHaveAttribute('data-cross-filter-enabled', 'false');
  expect(otherChart).toHaveAttribute('data-cross-filter-enabled', 'true');
});
