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
import { render as renderTest } from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/common';
import TableChart from '../../src/table/AgGridTableChart';
import { validateRowHierarchyFields } from '../../src/table/controlPanel';
import type { AgGridTableProps } from '../../src/table/AgGridTable';
import type {
  AdvancedFilterState,
  AgGridTableChartTransformedProps,
} from '../../src/table/types';

type MockAgGridTableProps = Pick<
  AgGridTableProps,
  | 'onServerPaginationChange'
  | 'onServerPageSizeChange'
  | 'onSearchColChange'
  | 'onSearchChange'
  | 'onSortChange'
> & {
  gridHeight?: number;
};

type MockColDefsProps = {
  rowHierarchyFields?: string[];
  onToggleHierarchyPath?: (path: string) => void;
};

type MockAdvancedFilterProps = {
  onApply: (advancedFilter: AdvancedFilterState) => void;
  onClear: () => void;
};

let mockAgGridTableProps: MockAgGridTableProps;
let mockColDefsProps: MockColDefsProps;
let mockAdvancedFilterProps: MockAdvancedFilterProps;

jest.mock('../../src/table/AgGridTable', () => ({
  __esModule: true,
  default: (props: MockAgGridTableProps) => {
    mockAgGridTableProps = props;
    return <div data-test="ag-grid-table" />;
  },
}));

jest.mock('../../src/table/utils/useColDefs', () => ({
  useColDefs: (props: MockColDefsProps) => {
    mockColDefsProps = props;
    return [];
  },
}));

jest.mock('../../src/table/components/AdvancedFilterBar', () => ({
  __esModule: true,
  default: (props: MockAdvancedFilterProps) => {
    mockAdvancedFilterProps = props;
    return <div data-test="advanced-filter-bar" />;
  },
}));

const baseProps: AgGridTableChartTransformedProps = {
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
  slice_id: 17,
  totals: {},
  showTotals: false,
  columnColorFormatters: [],
  basicColorFormatters: [],
  formData: {
    datasource: '1__table',
    viz_type: 'ag_grid_table',
  },
};

const renderTable = (
  overrides: Partial<typeof baseProps> = {},
): ReturnType<typeof renderTest> =>
  renderTest(<TableChart {...baseProps} {...overrides} />);

test('renders advanced filters by default and hides them when disabled', () => {
  const { container: defaultContainer } = renderTable();
  const defaultGridHeight = mockAgGridTableProps.gridHeight;

  const { container: disabledContainer } = renderTable({
    formData: {
      ...baseProps.formData,
      advanced_filter_enabled: false,
    },
  });

  expect(
    defaultContainer.querySelector('[data-test="advanced-filter-bar"]'),
  ).not.toBeNull();
  expect(
    disabledContainer.querySelector('[data-test="advanced-filter-bar"]'),
  ).toBeNull();
  expect(mockAgGridTableProps.gridHeight).toBe((defaultGridHeight ?? 0) + 44);
});

test('marks only the WHM order detail chart for scoped advanced filter styles', () => {
  const { container: whmContainer } = renderTest(
    <TableChart {...baseProps} slice_id={17} />,
  );
  const { container: otherContainer } = renderTest(
    <TableChart {...baseProps} slice_id={130} />,
  );

  expect(whmContainer.firstChild).toHaveClass('whm-order-detail-chart');
  expect(otherContainer.firstChild).not.toHaveClass('whm-order-detail-chart');
});

test('toggles a hierarchy path in table own state', () => {
  const setDataMask = jest.fn();
  renderTable({
    setDataMask,
    data: [{ spu: '8010S' }],
    columns: [
      {
        key: 'spu',
        label: 'SPU',
        dataType: GenericDataType.String,
      },
    ],
    formData: {
      ...baseProps.formData,
      row_hierarchy_fields: ['spu'],
    },
  });

  mockColDefsProps.onToggleHierarchyPath?.('["8010S"]');

  expect(setDataMask).toHaveBeenCalledWith({
    ownState: expect.objectContaining({
      collapsedHierarchyPaths: ['["8010S"]'],
    }),
  });
});

test('passes ordered row hierarchy fields to the hierarchy view', () => {
  renderTable({
    data: [{ spu: '8010S', ym: '2026-03' }],
    columns: [
      {
        key: 'spu',
        label: 'SPU',
        dataType: GenericDataType.String,
      },
      {
        key: 'ym',
        label: '月份',
        dataType: GenericDataType.String,
      },
    ],
    formData: {
      ...baseProps.formData,
      row_hierarchy_fields: ['spu', 'ym'],
    },
  });

  expect(mockColDefsProps.rowHierarchyFields).toEqual(['spu', 'ym']);
});

test('rejects hierarchy fields that are absent from group-by', () => {
  expect(validateRowHierarchyFields(['spu', 'missing'], ['spu', 'ym'])).toEqual(
    expect.any(String),
  );
});

test('rejects invalid hierarchy sequences before runtime', () => {
  expect(validateRowHierarchyFields(['ym'], ['spu', 'ym'])).toEqual(
    expect.any(String),
  );
  expect(validateRowHierarchyFields(['spu', 'spu'], ['spu', 'ym'])).toEqual(
    expect.any(String),
  );
  expect(validateRowHierarchyFields(['spu'], undefined)).toEqual(
    expect.any(String),
  );
  expect(validateRowHierarchyFields([], ['spu', 'ym'])).toBe(false);
});

test('clears collapsed hierarchy state when the server result changes', () => {
  const setDataMask = jest.fn();
  renderTable({
    setDataMask,
    serverPaginationData: {
      currentPage: 2,
      pageSize: 10,
      searchColumn: 'platform_order_name',
      collapsedHierarchyPaths: ['["8010S"]'],
    },
  });

  mockAgGridTableProps.onServerPaginationChange?.(3, 10);
  mockAgGridTableProps.onServerPageSizeChange?.(20);
  mockAgGridTableProps.onSearchColChange?.('another_column');
  mockAgGridTableProps.onSearchChange?.('8010');
  mockAgGridTableProps.onSortChange?.([
    { id: 'platform_order_name', key: 'platform_order_name', desc: true },
  ]);
  mockAdvancedFilterProps.onApply({
    column: 'platform_order_name',
    operator: 'contains',
    value: '8010',
  });
  mockAdvancedFilterProps.onClear();

  expect(setDataMask).toHaveBeenCalledTimes(7);
  setDataMask.mock.calls.forEach(([dataMask]) => {
    expect(dataMask).toEqual({
      ownState: expect.objectContaining({
        collapsedHierarchyPaths: [],
      }),
    });
  });
});

test('clears collapsed hierarchy state when external filters change', () => {
  const setDataMask = jest.fn();
  const { rerender } = renderTable({
    setDataMask,
    filters: { spu: ['8010S'] },
    serverPaginationData: {
      currentPage: 2,
      collapsedHierarchyPaths: ['["8010S"]'],
    },
  });

  setDataMask.mockClear();
  rerender(
    <TableChart
      {...baseProps}
      setDataMask={setDataMask}
      filters={{ spu: ['8010T'] }}
      serverPaginationData={{
        currentPage: 2,
        collapsedHierarchyPaths: ['["8010S"]'],
      }}
    />,
  );

  expect(setDataMask).toHaveBeenCalledWith({
    ownState: expect.objectContaining({
      currentPage: 0,
      collapsedHierarchyPaths: [],
    }),
  });
});
