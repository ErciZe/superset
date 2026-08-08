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
  DataRecord,
  DataRecordValue,
  getTimeFormatterForGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { t } from '@apache-superset/core/translation';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { isEqual } from 'lodash';

import {
  CellClickedEvent,
  IMenuActionParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import {
  AgGridTableChartTransformedProps,
  AdvancedFilterState,
  InputColumn,
  SearchOption,
  SortByItem,
} from './types';
import AgGridDataTable, { type AgGridTableProps } from './AgGridTable';
import { updateTableOwnState } from './utils/externalAPIs';
import TimeComparisonVisibility from './AgGridTable/components/TimeComparisonVisibility';
import AdvancedFilterBar from './components/AdvancedFilterBar';
import { useColDefs } from './utils/useColDefs';
import { getCrossFilterDataMask } from './utils/getCrossFilterDataMask';
import { StyledChartContainer } from './styles';
import { buildHierarchyView } from './hierarchy';

const getGridHeight = (
  height: number,
  includeSearch: boolean | undefined,
  includeAdvancedFilter: boolean,
  columnViewToolbarHeight: number,
) => {
  let calculatedGridHeight = height;
  if (includeSearch) {
    calculatedGridHeight -= 16;
  }
  if (includeAdvancedFilter) {
    calculatedGridHeight -= 44;
  }
  return calculatedGridHeight - 80 - columnViewToolbarHeight;
};

export default function TableChart<D extends DataRecord = DataRecord>(
  props: AgGridTableChartTransformedProps<D> &
    Pick<AgGridTableProps, 'onGridReady' | 'renderColumnViewToolbar'> & {
      columnViewToolbarHeight?: number;
    },
) {
  const {
    height,
    columns,
    data,
    includeSearch,
    allowRearrangeColumns,
    pageSize,
    serverPagination,
    rowCount,
    setDataMask,
    serverPaginationData,
    slice_id,
    percentMetrics,
    hasServerPageLengthChanged,
    serverPageLength,
    emitCrossFilters,
    filters,
    timeGrain,
    isRawRecords,
    alignPositiveNegative,
    showCellBars,
    isUsingTimeComparison,
    colorPositiveNegative,
    totals,
    showTotals,
    columnColorFormatters,
    basicColorFormatters,
    additionalCellStyle,
    additionalCellFormatter,
    width,
    onGridReady,
    renderColumnViewToolbar,
    columnViewToolbarHeight,
  } = props;

  let effectiveColumnViewToolbarHeight = 0;
  if (renderColumnViewToolbar) {
    if (
      typeof columnViewToolbarHeight !== 'number' ||
      !Number.isFinite(columnViewToolbarHeight) ||
      columnViewToolbarHeight <= 0
    ) {
      throw new Error(
        'columnViewToolbarHeight must be a positive finite number when renderColumnViewToolbar is provided.',
      );
    }
    effectiveColumnViewToolbarHeight = columnViewToolbarHeight;
  }

  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);

  const rowHierarchyFields = props.formData.row_hierarchy_fields ?? [];
  const collapsedHierarchyPaths =
    serverPaginationData.collapsedHierarchyPaths ?? [];
  const hierarchyView = useMemo(
    () => buildHierarchyView(data, rowHierarchyFields, collapsedHierarchyPaths),
    [collapsedHierarchyPaths, data, rowHierarchyFields],
  );
  const previousFilters = useRef(filters);

  useEffect(() => {
    if (isEqual(previousFilters.current, filters)) {
      return;
    }
    previousFilters.current = filters;
    if (!serverPagination) {
      return;
    }
    const modifiedOwnState = {
      ...serverPaginationData,
      currentPage: 0,
      collapsedHierarchyPaths: [],
    };
    updateTableOwnState(setDataMask, modifiedOwnState);
  }, [filters, serverPagination, serverPaginationData, setDataMask]);

  const handleToggleHierarchyPath = useCallback(
    (path: string) => {
      const next = collapsedHierarchyPaths.includes(path)
        ? collapsedHierarchyPaths.filter(item => item !== path)
        : [...collapsedHierarchyPaths, path];
      const modifiedOwnState = {
        ...serverPaginationData,
        collapsedHierarchyPaths: next,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [collapsedHierarchyPaths, serverPaginationData, setDataMask],
  );

  useEffect(() => {
    const options = columns
      .filter(col => col?.dataType === GenericDataType.String)
      .map(column => ({
        value: column.key,
        label: column.label,
      }));

    setSearchOptions(currentOptions =>
      isEqual(options, currentOptions) ? currentOptions : options || [],
    );
  }, [columns]);

  const advancedFilterOptions = useMemo(
    () =>
      columns
        .filter(column => column?.key)
        .map(column => ({
          value: column.key,
          label: column.label,
        })),
    [columns],
  );

  const comparisonColumns = [
    { key: 'all', label: t('Display all') },
    { key: '#', label: '#' },
    { key: '△', label: '△' },
    { key: '%', label: '%' },
  ];

  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns?.[0]?.key,
  ]);

  const filteredColumns = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columns;
    }
    if (
      selectedComparisonColumns.length === 0 ||
      selectedComparisonColumns.includes('all')
    ) {
      return columns?.filter(col => col?.config?.visible !== false);
    }

    return columns
      .filter(
        col =>
          !col.originalLabel ||
          (col?.label || '').includes('Main') ||
          selectedComparisonColumns.includes(col.label),
      )
      .filter(col => col?.config?.visible !== false);
  }, [columns, isUsingTimeComparison, selectedComparisonColumns]);

  const colDefs = useColDefs({
    columns: isUsingTimeComparison
      ? (filteredColumns as InputColumn[])
      : (columns as InputColumn[]),
    data: hierarchyView.records,
    serverPagination,
    isRawRecords,
    defaultAlignPN: alignPositiveNegative,
    showCellBars,
    colorPositiveNegative,
    totals,
    columnColorFormatters,
    additionalCellStyle,
    additionalCellFormatter,
    allowRearrangeColumns,
    basicColorFormatters,
    isUsingTimeComparison,
    emitCrossFilters,
    alignPositiveNegative,
    slice_id,
    rowHierarchyFields,
    onToggleHierarchyPath: handleToggleHierarchyPath,
  });

  const showAdvancedFilter = Boolean(
    props.formData.advanced_filter_enabled !== false &&
    serverPagination &&
    advancedFilterOptions.length,
  );
  const isWhmOrderDetailChart = slice_id === 17;

  const gridHeight = getGridHeight(
    height,
    includeSearch,
    showAdvancedFilter,
    effectiveColumnViewToolbarHeight,
  );

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  const timestampFormatter = useCallback(
    (value: DataRecordValue) =>
      getTimeFormatterForGranularity(timeGrain)(
        typeof value === 'bigint'
          ? Number(value)
          : typeof value === 'boolean'
            ? String(value)
            : value,
      ),
    [timeGrain],
  );

  const toggleFilter = useCallback(
    (event: CellClickedEvent | IMenuActionParams) => {
      if (
        emitCrossFilters &&
        event.column &&
        !(
          event.column.getColDef().context?.isMetric ||
          event.column.getColDef().context?.isPercentMetric
        )
      ) {
        const crossFilterProps = {
          key: event.column.getColId(),
          value: event.value,
          filters,
          timeGrain,
          isActiveFilterValue,
          timestampFormatter,
        };
        setDataMask(getCrossFilterDataMask(crossFilterProps).dataMask);
      }
    },
    [
      emitCrossFilters,
      filters,
      isActiveFilterValue,
      setDataMask,
      timeGrain,
      timestampFormatter,
    ],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
        collapsedHierarchyPaths: [],
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [serverPaginationData, setDataMask],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: 0,
        pageSize,
        collapsedHierarchyPaths: [],
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [serverPaginationData, setDataMask],
  );

  const handleChangeSearchCol = (searchCol: string) => {
    if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
      const modifiedOwnState = {
        ...serverPaginationData,
        searchColumn: searchCol,
        searchText: '',
        currentPage: 0,
        collapsedHierarchyPaths: [],
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  };

  const handleSearch = useCallback(
    (searchText: string) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        searchColumn:
          serverPaginationData?.searchColumn || searchOptions[0]?.value,
        searchText,
        currentPage: 0, // Reset to first page when searching
        collapsedHierarchyPaths: [],
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [searchOptions, serverPaginationData, setDataMask],
  );

  const handleAdvancedFilterApply = useCallback(
    (advancedFilter: AdvancedFilterState) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        advancedFilter,
        currentPage: 0,
        collapsedHierarchyPaths: [],
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [serverPaginationData, setDataMask],
  );

  const handleAdvancedFilterClear = useCallback(() => {
    const restState = { ...serverPaginationData };
    delete restState.advancedFilter;
    const modifiedOwnState = {
      ...restState,
      currentPage: 0,
      collapsedHierarchyPaths: [],
    };
    updateTableOwnState(setDataMask, modifiedOwnState);
  }, [serverPaginationData, setDataMask]);

  const handleSortByChange = useCallback(
    (sortBy: SortByItem[]) => {
      if (!serverPagination) return;
      const modifiedOwnState = {
        ...serverPaginationData,
        sortBy,
        currentPage: 0,
        collapsedHierarchyPaths: [],
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [serverPagination, serverPaginationData, setDataMask],
  );

  const renderTimeComparisonVisibility = (): JSX.Element => (
    <TimeComparisonVisibility
      comparisonColumns={comparisonColumns}
      selectedComparisonColumns={selectedComparisonColumns}
      onSelectionChange={setSelectedComparisonColumns}
    />
  );

  return (
    <StyledChartContainer
      height={height}
      $isWhmOrderDetailChart={isWhmOrderDetailChart}
      className={isWhmOrderDetailChart ? 'whm-order-detail-chart' : undefined}
    >
      {showAdvancedFilter && (
        <AdvancedFilterBar
          searchOptions={advancedFilterOptions}
          value={serverPaginationData?.advancedFilter}
          onApply={handleAdvancedFilterApply}
          onClear={handleAdvancedFilterClear}
        />
      )}
      <AgGridDataTable
        gridHeight={gridHeight}
        data={hierarchyView.records}
        colDefsFromProps={colDefs}
        includeSearch={!!includeSearch}
        allowRearrangeColumns={!!allowRearrangeColumns}
        pagination={!!pageSize && !serverPagination}
        pageSize={pageSize || 0}
        serverPagination={serverPagination}
        rowCount={rowCount}
        onServerPaginationChange={handleServerPaginationChange}
        onServerPageSizeChange={handlePageSizeChange}
        serverPaginationData={serverPaginationData}
        searchOptions={searchOptions}
        onSearchColChange={handleChangeSearchCol}
        onSearchChange={handleSearch}
        onSortChange={handleSortByChange}
        id={slice_id}
        handleCrossFilter={toggleFilter}
        percentMetrics={percentMetrics}
        serverPageLength={serverPageLength}
        hasServerPageLengthChanged={hasServerPageLengthChanged}
        isActiveFilterValue={isActiveFilterValue}
        renderTimeComparisonDropdown={
          isUsingTimeComparison ? renderTimeComparisonVisibility : () => null
        }
        cleanedTotals={totals || {}}
        showTotals={showTotals}
        width={width}
        onGridReady={onGridReady}
        renderColumnViewToolbar={renderColumnViewToolbar}
      />
    </StyledChartContainer>
  );
}
