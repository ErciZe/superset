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
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Select,
  ThemedAgGridReact,
} from '@superset-ui/core/components';
import {
  t,
  useTheme,
  type DataRecord,
  type DataRecordValue,
} from '@superset-ui/core';
import {
  AgGridReact,
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  type CustomCellRendererProps,
  type ValueFormatterParams,
  ModuleRegistry,
} from '@superset-ui/core/components/ThemedAgGridReact';
import type {
  CrosstabChartProps,
  CrosstabColumnNode,
  CrosstabConditionalRule,
  CrosstabFormData,
  CrosstabOwnState,
  CrosstabParameter,
} from './types';
import {
  formatCrosstabValue,
  resolveConditionalStyle,
} from './crosstab/formatting';
import {
  CROSSTAB_ROW_LEVEL,
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
  CROSSTAB_ROW_LABEL,
  CROSSTAB_ROW_PATH,
  decodeCrosstabRowPath,
  encodeCrosstabRowPath,
} from './crosstab/engine';
import { getCrosstabParameters } from './plugin/parameters';
import { getGeneratedColumnWidth } from './plugin/serverColumnPagination';

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const FIRST_ROW_COLUMN_WIDTH = 180;
const EXTRA_ROW_COLUMN_WIDTH = 120;
const DYNAMIC_SELECTOR_MIN_WIDTH = 112;
const DYNAMIC_GROUP_BY_PLACEMENT_ORDER = {
  rows: 0,
  columns: 1,
};
const PRESERVE_SELECT_OPTION_ORDER = () => 0;

type MeasuredGridWidth = {
  includesRowColumns: boolean;
  width: number;
};

type DynamicGroupBySelector = {
  canClear: boolean;
  clearOptionId?: string;
  label: string;
  options: {
    disabled?: boolean;
    label: string;
    value: string;
  }[];
  slotId: string;
  value: string;
  valueSet: Set<string>;
};

type DynamicMetricSelector = {
  label: string;
  options: {
    label: string;
    value: string;
  }[];
  slotId: string;
  value: string;
  valueSet: Set<string>;
};

function getMetricFromColumnId(columnId: string) {
  return columnId.split('__metric__')[1] ?? columnId.split('__subtotal__')[1];
}

function renderFormattedCell(
  { value }: CustomCellRendererProps,
  rules: CrosstabConditionalRule[],
  numberFormat?: string,
) {
  const cellValue = value as DataRecordValue;
  const formattedValue = formatCrosstabValue(cellValue, numberFormat);
  const { arrow } = resolveConditionalStyle(cellValue, rules);

  if (!arrow || formattedValue === '') {
    return formattedValue;
  }

  return `${arrow === 'up' ? '↑' : '↓'} ${formattedValue}`;
}

function cellClassName(data?: DataRecord) {
  const rowType = data?.[CROSSTAB_ROW_TYPE];

  if (rowType === 'group') {
    return 'crosstab-group-row';
  }

  if (rowType === 'grand_total') {
    return 'crosstab-grand-total-row';
  }

  if (rowType === 'subtotal') {
    return 'crosstab-subtotal-row';
  }

  return undefined;
}

function buildLeafColumnDef(
  columnId: string,
  headerName: string,
  rules: CrosstabConditionalRule[],
  totalBackgroundColor: string,
  columnWidth: number,
  numberFormat?: string,
): ColDef {
  return {
    field: columnId,
    colId: columnId,
    headerName,
    width: columnWidth,
    minWidth: columnWidth,
    valueFormatter: ({ value }: ValueFormatterParams) =>
      formatCrosstabValue(value as DataRecordValue, numberFormat),
    cellRenderer: (params: CustomCellRendererProps) =>
      renderFormattedCell(params, rules, numberFormat),
    cellStyle: ({ value, data }) => {
      const style = resolveConditionalStyle(value as DataRecordValue, rules);
      const isTotalRow =
        data?.[CROSSTAB_ROW_TYPE] === 'subtotal' ||
        data?.[CROSSTAB_ROW_TYPE] === 'grand_total';

      return {
        color: style.color ?? '',
        backgroundColor:
          style.backgroundColor ?? (isTotalRow ? totalBackgroundColor : ''),
        ...(isTotalRow ? { fontWeight: 600 } : {}),
      };
    },
    cellClass: ({ data }) => cellClassName(data as DataRecord | undefined),
  };
}

function buildColumnDefsFromTree(
  nodes: CrosstabColumnNode[],
  rulesByMetric: (metric?: string) => CrosstabConditionalRule[],
  totalBackgroundColor: string,
  columnWidth: number,
  numberFormat?: string,
): ColDef[] {
  return nodes.map(node => {
    if (node.field) {
      return buildLeafColumnDef(
        node.field,
        node.label,
        rulesByMetric(node.metric),
        totalBackgroundColor,
        columnWidth,
        numberFormat,
      );
    }

    return {
      headerName: node.label,
      groupId: node.id,
      children: buildColumnDefsFromTree(
        node.children ?? [],
        rulesByMetric,
        totalBackgroundColor,
        columnWidth,
        numberFormat,
      ),
    } as ColDef;
  });
}

function collectLeafColumnIds(nodes: CrosstabColumnNode[]): string[] {
  return nodes.flatMap(node =>
    node.field ? [node.field] : collectLeafColumnIds(node.children ?? []),
  );
}

function filterColumnTreeByLeafIds(
  nodes: CrosstabColumnNode[],
  visibleLeafIds: Set<string>,
): CrosstabColumnNode[] {
  return nodes.flatMap(node => {
    if (node.field) {
      return visibleLeafIds.has(node.field) ? [node] : [];
    }

    const children = filterColumnTreeByLeafIds(
      node.children ?? [],
      visibleLeafIds,
    );

    return children.length ? [{ ...node, children }] : [];
  });
}

function buildRowColumnDefs(
  columns: CrosstabChartProps['columns'],
  totalBackgroundColor: string,
  expandedRowPaths: Set<string>,
  toggleRowPath: (row: DataRecord) => void,
): ColDef[] {
  return columns
    .filter(column => !column.isMetric)
    .map((column, index) => ({
      field: column.key,
      colId: column.key,
      headerName: column.label,
      pinned: 'left',
      lockPinned: true,
      width: index === 0 ? FIRST_ROW_COLUMN_WIDTH : EXTRA_ROW_COLUMN_WIDTH,
      minWidth: index === 0 ? FIRST_ROW_COLUMN_WIDTH : EXTRA_ROW_COLUMN_WIDTH,
      cellClass: ({ data }) => cellClassName(data as DataRecord | undefined),
      valueGetter: ({ data }) => {
        const row = data as DataRecord | undefined;
        const value = row?.[column.key];
        const rowLevel = Number(row?.[CROSSTAB_ROW_LEVEL] ?? 0);

        if (
          (value === undefined || value === null || value === '') &&
          (index === 0 || index === rowLevel)
        ) {
          return row?.[CROSSTAB_ROW_LABEL] ?? '';
        }

        return value ?? '';
      },
      cellRenderer:
        index === 0
          ? ({ data, value }: CustomCellRendererProps) => {
              const row = data as DataRecord | undefined;
              const rowType = row?.[CROSSTAB_ROW_TYPE];

              if (!row || rowType !== 'group') {
                return value ?? '';
              }

              const path = row[CROSSTAB_ROW_PATH] as string;
              const expanded = expandedRowPaths.has(path);
              const level = Number(row[CROSSTAB_ROW_LEVEL] ?? 0);
              const indent = '\u00a0'.repeat(level * 2);

              return `${indent}${expanded ? '▾' : '▸'} ${value ?? ''}`;
            }
          : undefined,
      onCellClicked:
        index === 0
          ? ({ data }) => {
              const row = data as DataRecord | undefined;

              if (row?.[CROSSTAB_ROW_TYPE] === 'group') {
                toggleRowPath(row);
              }
            }
          : undefined,
      cellStyle: ({ data }) => {
        const rowType = data?.[CROSSTAB_ROW_TYPE];
        const isTotalRow =
          rowType === 'group' ||
          rowType === 'subtotal' ||
          rowType === 'grand_total';

        return isTotalRow
          ? {
              backgroundColor: totalBackgroundColor,
              fontWeight: 600,
            }
          : undefined;
      },
    }));
}

function getDefaultExpandedRowPaths(
  rowData: DataRecord[],
  defaultRowExpandedDepth?: number,
) {
  const expandedDepth = Math.max(0, Number(defaultRowExpandedDepth ?? 1));

  return rowData
    .filter(
      row =>
        row[CROSSTAB_ROW_TYPE] === 'group' &&
        Number(row[CROSSTAB_ROW_LEVEL] ?? 0) < expandedDepth,
    )
    .map(row => row[CROSSTAB_ROW_PATH] as string);
}

function getParentRowPaths(row: DataRecord) {
  const rowType = row[CROSSTAB_ROW_TYPE];

  if (rowType === 'grand_total') {
    return [];
  }

  const path = decodeCrosstabRowPath(row[CROSSTAB_ROW_PATH]);
  const parentDepth =
    rowType === 'group' ? Math.max(0, path.length - 1) : path.length - 1;

  return Array.from({ length: parentDepth }, (_, index) =>
    encodeCrosstabRowPath(path.slice(0, index + 1)),
  );
}

function filterVisibleRows(
  rowData: DataRecord[],
  expandedRowPaths: Set<string>,
) {
  const groupRowPaths = new Set(
    rowData
      .filter(row => row[CROSSTAB_ROW_TYPE] === 'group')
      .map(row => row[CROSSTAB_ROW_PATH] as string),
  );

  return rowData.filter(row =>
    getParentRowPaths(row).every(
      path => !groupRowPaths.has(path) || expandedRowPaths.has(path),
    ),
  );
}

function getRowColumnsWidth(rowColumnCount: number): number {
  if (rowColumnCount < 1) {
    return 0;
  }

  return (
    FIRST_ROW_COLUMN_WIDTH +
    Math.max(0, rowColumnCount - 1) * EXTRA_ROW_COLUMN_WIDTH
  );
}

function getGeneratedColumnsPerPage(
  chartWidth: number | string | undefined,
  rowColumnCount: number,
  hasTotalColumn: boolean,
  generatedColumnWidth: number,
  measuredGridWidth?: MeasuredGridWidth,
): number {
  const resolvedChartWidth =
    typeof chartWidth === 'number' ? chartWidth : Number(chartWidth);
  const measuredAvailableWidth =
    measuredGridWidth && measuredGridWidth.width > 0
      ? measuredGridWidth.width -
        (measuredGridWidth.includesRowColumns
          ? getRowColumnsWidth(rowColumnCount)
          : 0) -
        (hasTotalColumn ? generatedColumnWidth : 0)
      : undefined;
  const availableWidth =
    measuredAvailableWidth !== undefined
      ? measuredAvailableWidth
      : Number.isFinite(resolvedChartWidth) && resolvedChartWidth > 0
        ? resolvedChartWidth -
          getRowColumnsWidth(rowColumnCount) -
          (hasTotalColumn ? generatedColumnWidth : 0)
        : generatedColumnWidth;

  const wholeColumns = Math.floor(availableWidth / generatedColumnWidth);
  const remainingWidth = availableWidth - wholeColumns * generatedColumnWidth;
  const shouldFillNearColumnGap = remainingWidth >= generatedColumnWidth / 2;

  return Math.max(1, wholeColumns + (shouldFillNearColumnGap ? 1 : 0));
}

function getMeasuredGridWidth(
  gridContainer: HTMLDivElement | null,
): MeasuredGridWidth | undefined {
  if (!gridContainer) {
    return undefined;
  }

  const centerViewport = gridContainer.querySelector<HTMLElement>(
    '.ag-center-cols-viewport',
  );

  if (centerViewport && centerViewport.clientWidth > 0) {
    return {
      includesRowColumns: false,
      width: centerViewport.clientWidth,
    };
  }

  if (gridContainer.clientWidth > 0) {
    return {
      includesRowColumns: true,
      width: gridContainer.clientWidth,
    };
  }

  return undefined;
}

function getPreservedDynamicGroupByOwnState(
  ownState: CrosstabChartProps['ownState'],
) {
  const preservedOwnState = {
    ...((ownState ?? {}) as CrosstabOwnState),
  };

  delete preservedOwnState.selectedDynamicGroupBy;
  delete preservedOwnState.selectedDynamicGroupByColumn;
  delete preservedOwnState.effectiveGroupBySignature;
  delete preservedOwnState.expandedRowPaths;
  delete preservedOwnState.serverColumnPageColumnSignature;
  delete preservedOwnState.serverColumnPageTuples;
  delete preservedOwnState.serverColumnPageTuplesPage;
  delete preservedOwnState.serverColumnPageTuplesPageSize;
  delete preservedOwnState.serverColumnTotalCount;
  delete (preservedOwnState as Record<string, unknown>).textParameters;

  return preservedOwnState;
}

function getPreservedDynamicMetricOwnState(
  ownState: CrosstabChartProps['ownState'],
) {
  const preservedOwnState = {
    ...((ownState ?? {}) as CrosstabOwnState),
  };

  delete preservedOwnState.currentColumnPage;
  delete preservedOwnState.effectiveMetricSignature;
  delete preservedOwnState.selectedDynamicMetric;
  delete preservedOwnState.serverColumnPageColumnSignature;
  delete preservedOwnState.serverColumnPageTuples;
  delete preservedOwnState.serverColumnPageTuplesPage;
  delete preservedOwnState.serverColumnPageTuplesPageSize;
  delete preservedOwnState.serverColumnTotalCount;
  delete (preservedOwnState as Record<string, unknown>).textParameters;

  return preservedOwnState;
}

function getPreservedRuntimeParameterOwnState(
  ownState: CrosstabChartProps['ownState'],
) {
  const preservedOwnState = {
    ...((ownState ?? {}) as CrosstabOwnState),
  };

  delete preservedOwnState.effectiveMetricSignature;
  delete preservedOwnState.serverColumnPageColumnSignature;
  delete preservedOwnState.serverColumnPageTuples;
  delete preservedOwnState.serverColumnPageTuplesPage;
  delete preservedOwnState.serverColumnPageTuplesPageSize;
  delete preservedOwnState.serverColumnTotalCount;
  delete (preservedOwnState as Record<string, unknown>).textParameters;

  return preservedOwnState;
}

function validateNumericParameterValue(
  parameter: CrosstabParameter,
  value: number,
) {
  if (!Number.isFinite(value)) {
    throw new Error('Crosstab numeric parameter value is invalid.');
  }

  if (
    (parameter.min !== undefined && value < parameter.min) ||
    (parameter.max !== undefined && value > parameter.max)
  ) {
    throw new Error('Crosstab numeric parameter value is invalid.');
  }

  if (parameter.step !== undefined) {
    const base = parameter.min ?? 0;
    const quotient = (value - base) / parameter.step;

    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      throw new Error('Crosstab numeric parameter value is invalid.');
    }
  }
}

export default function CrosstabTable({
  columnTree,
  columns,
  dynamicGroupByConfig,
  dynamicMetricConfig,
  formData,
  height,
  hooks: { setDataMask } = {},
  isServerColumnLoading,
  ownState,
  rowData,
  expandedRowPaths,
  numericParameters,
  selectedDynamicGroupBy,
  selectedDynamicMetric,
  serverColumnCurrentPage,
  serverColumnTotalCount,
  width,
}: CrosstabChartProps) {
  const gridRef = useRef<AgGridReact>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const totalBackgroundColor = theme.colorFillSecondary;
  const [measuredGridWidth, setMeasuredGridWidth] =
    useState<MeasuredGridWidth>();
  const { conditionalFormatting: conditionalFormattingConfig, numberFormat } =
    formData;
  const conditionalFormatting: CrosstabConditionalRule[] = useMemo(
    () =>
      Array.isArray(conditionalFormattingConfig)
        ? conditionalFormattingConfig
        : [],
    [conditionalFormattingConfig],
  );
  const rulesByMetric = useCallback(
    (metric?: string) =>
      conditionalFormatting.filter(
        rule =>
          !rule.metric || (metric !== undefined && rule.metric === metric),
      ),
    [conditionalFormatting],
  );
  const [columnPage, setColumnPage] = useState(0);
  const serverColumnPagination = Boolean(formData.serverColumnPagination);
  const generatedColumnWidth = getGeneratedColumnWidth(
    formData.generatedColumnWidth,
  );
  const rowColumnCount = useMemo(
    () => columns.filter(column => !column.isMetric).length,
    [columns],
  );
  const totalColumn = useMemo(
    () => columns.find(column => column.key === CROSSTAB_TOTAL_COLUMN_ID),
    [columns],
  );
  const treeLeafColumnIds = useMemo(
    () => collectLeafColumnIds(columnTree),
    [columnTree],
  );
  const defaultExpandedRowPaths = useMemo(
    () => getDefaultExpandedRowPaths(rowData, formData.defaultRowExpandedDepth),
    [formData.defaultRowExpandedDepth, rowData],
  );
  const effectiveExpandedRowPaths = useMemo(
    () => expandedRowPaths ?? defaultExpandedRowPaths,
    [defaultExpandedRowPaths, expandedRowPaths],
  );
  const expandedRowPathSet = useMemo(
    () => new Set(effectiveExpandedRowPaths),
    [effectiveExpandedRowPaths],
  );
  const visibleRowData = useMemo(
    () => filterVisibleRows(rowData, expandedRowPathSet),
    [expandedRowPathSet, rowData],
  );
  const updateMeasuredGridWidth = useCallback(() => {
    const nextMeasuredGridWidth = getMeasuredGridWidth(
      gridContainerRef.current,
    );

    setMeasuredGridWidth(currentGridWidth =>
      currentGridWidth?.width === nextMeasuredGridWidth?.width &&
      currentGridWidth?.includesRowColumns ===
        nextMeasuredGridWidth?.includesRowColumns
        ? currentGridWidth
        : nextMeasuredGridWidth,
    );
  }, []);
  const generatedColumnsPerPage = getGeneratedColumnsPerPage(
    width,
    rowColumnCount,
    Boolean(totalColumn),
    generatedColumnWidth,
    measuredGridWidth,
  );
  const effectiveColumnPage = serverColumnPagination
    ? (serverColumnCurrentPage ?? 0)
    : columnPage;
  const effectiveColumnsPerPage = generatedColumnsPerPage;
  const dynamicGroupBySelectors = useMemo<DynamicGroupBySelector[]>(() => {
    if (!dynamicGroupByConfig?.enabled) {
      return [];
    }

    const sortedSlots = [...dynamicGroupByConfig.slots].sort(
      (leftSlot, rightSlot) =>
        DYNAMIC_GROUP_BY_PLACEMENT_ORDER[leftSlot.placement] -
          DYNAMIC_GROUP_BY_PLACEMENT_ORDER[rightSlot.placement] ||
        leftSlot.slotIndex - rightSlot.slotIndex,
    );
    const clearOptionIdsBySlot = new Map(
      sortedSlots.map(slot => [
        slot.id,
        slot.options.find(option => option.columns.length === 0)?.id,
      ]),
    );
    const selectedOptionIdsBySlot = new Map<string, string>();
    const activeOptionCountsByPlacement = new Map<string, number>();

    sortedSlots.forEach(slot => {
      const valueSet = new Set(slot.options.map(option => option.id));
      const selectedOptionId = selectedDynamicGroupBy?.[slot.id];
      const value =
        selectedOptionId && valueSet.has(selectedOptionId)
          ? selectedOptionId
          : slot.defaultOptionId;
      const selectedOption = slot.options.find(option => option.id === value);

      selectedOptionIdsBySlot.set(slot.id, value);
      if (selectedOption && selectedOption.columns.length > 0) {
        activeOptionCountsByPlacement.set(
          slot.placement,
          (activeOptionCountsByPlacement.get(slot.placement) ?? 0) + 1,
        );
      }
    });

    return sortedSlots.map(slot => {
      const clearOptionId = clearOptionIdsBySlot.get(slot.id);
      const value =
        selectedOptionIdsBySlot.get(slot.id) ?? slot.defaultOptionId;
      const selectedOption = slot.options.find(option => option.id === value);
      const canClear =
        clearOptionId !== undefined &&
        (selectedOption?.columns.length ?? 0) === 0
          ? true
          : clearOptionId !== undefined &&
            (activeOptionCountsByPlacement.get(slot.placement) ?? 0) > 1;
      const selectedOptionIdsFromOtherSlots = new Set(
        [...selectedOptionIdsBySlot]
          .filter(([selectedSlotId]) => selectedSlotId !== slot.id)
          .filter(
            ([selectedSlotId, selectedOptionId]) =>
              selectedOptionId !== clearOptionIdsBySlot.get(selectedSlotId),
          )
          .map(([, selectedOptionId]) => selectedOptionId),
      );
      const options = slot.options.map(option => ({
        disabled:
          (option.id === clearOptionId && !canClear) ||
          (option.id !== clearOptionId &&
            option.id !== value &&
            selectedOptionIdsFromOtherSlots.has(option.id)),
        label: option.label,
        value: option.id,
      }));
      const valueSet = new Set(
        options.filter(option => !option.disabled).map(option => option.value),
      );

      return {
        canClear,
        clearOptionId,
        label: slot.label ?? t('Group dimension'),
        options,
        slotId: slot.id,
        value,
        valueSet,
      };
    });
  }, [dynamicGroupByConfig, selectedDynamicGroupBy]);
  const dynamicMetricSelectors = useMemo<DynamicMetricSelector[]>(() => {
    if (!dynamicMetricConfig?.enabled) {
      return [];
    }

    return [...dynamicMetricConfig.slots]
      .sort((leftSlot, rightSlot) => leftSlot.slotIndex - rightSlot.slotIndex)
      .map(slot => {
        const options = slot.options.map(option => ({
          label: option.label,
          value: option.id,
        }));
        const valueSet = new Set(options.map(option => option.value));
        const selectedOptionId = selectedDynamicMetric?.[slot.id];
        const value =
          selectedOptionId && valueSet.has(selectedOptionId)
            ? selectedOptionId
            : slot.defaultOptionId;

        return {
          label: slot.label ?? t('Metric'),
          options,
          slotId: slot.id,
          value,
          valueSet,
        };
      });
  }, [dynamicMetricConfig, selectedDynamicMetric]);
  const parameterControls = useMemo(
    () =>
      getCrosstabParameters(formData as CrosstabFormData).map(parameter => ({
        parameter,
        value: numericParameters?.[parameter.id] ?? parameter.defaultValue,
      })),
    [formData, numericParameters],
  );
  const totalGeneratedColumnCount = serverColumnPagination
    ? (serverColumnTotalCount ?? treeLeafColumnIds.length)
    : treeLeafColumnIds.length;
  const columnPageCount = Math.max(
    1,
    Math.ceil(totalGeneratedColumnCount / effectiveColumnsPerPage),
  );
  useLayoutEffect(() => {
    updateMeasuredGridWidth();

    const gridContainer = gridContainerRef.current;

    if (!gridContainer || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateMeasuredGridWidth);
    resizeObserver.observe(gridContainer);

    return () => resizeObserver.disconnect();
  }, [updateMeasuredGridWidth]);
  useLayoutEffect(() => {
    updateMeasuredGridWidth();
  }, [columnTree, height, updateMeasuredGridWidth, width]);
  useEffect(() => {
    if (!serverColumnPagination) {
      setColumnPage(currentPage => Math.min(currentPage, columnPageCount - 1));
    }
  }, [columnPageCount, serverColumnPagination]);
  useEffect(() => {
    if (!serverColumnPagination) {
      return;
    }

    if (
      (ownState as { currentColumnPageSize?: number } | undefined)
        ?.currentColumnPageSize === generatedColumnsPerPage
    ) {
      return;
    }

    setDataMask?.({
      ownState: {
        ...ownState,
        currentColumnPage: 0,
        currentColumnPageSize: generatedColumnsPerPage,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: generatedColumnsPerPage,
      },
    });
  }, [generatedColumnsPerPage, ownState, serverColumnPagination, setDataMask]);

  const pageStart = effectiveColumnPage * effectiveColumnsPerPage;
  const pageEnd = Math.min(
    pageStart +
      (serverColumnPagination && !isServerColumnLoading
        ? Math.min(effectiveColumnsPerPage, treeLeafColumnIds.length)
        : effectiveColumnsPerPage),
    totalGeneratedColumnCount,
  );
  const visibleColumnTree = useMemo(() => {
    const visibleLeafIds = new Set(
      serverColumnPagination
        ? treeLeafColumnIds.slice(0, effectiveColumnsPerPage)
        : treeLeafColumnIds.slice(pageStart, pageEnd),
    );

    return filterColumnTreeByLeafIds(columnTree, visibleLeafIds);
  }, [
    columnTree,
    effectiveColumnsPerPage,
    pageEnd,
    pageStart,
    serverColumnPagination,
    treeLeafColumnIds,
  ]);
  const setServerColumnPage = useCallback(
    (nextPage: number) => {
      setDataMask?.({
        ownState: {
          ...ownState,
          currentColumnPage: nextPage,
          currentColumnPageSize: effectiveColumnsPerPage,
          serverColumnPageTuples: [],
          serverColumnPageTuplesPage: nextPage,
          serverColumnPageTuplesPageSize: effectiveColumnsPerPage,
        },
      });
    },
    [effectiveColumnsPerPage, ownState, setDataMask],
  );
  const updateDynamicGroupByOption = useCallback(
    (slotId: string, nextOptionId: string) => {
      const selector = dynamicGroupBySelectors.find(
        candidate => candidate.slotId === slotId,
      );

      if (!selector?.valueSet.has(nextOptionId)) {
        return;
      }

      setDataMask?.({
        ownState: {
          ...getPreservedDynamicGroupByOwnState(ownState),
          selectedDynamicGroupBy: {
            ...(selectedDynamicGroupBy ?? {}),
            [slotId]: nextOptionId,
          },
          currentColumnPage: 0,
          currentColumnPageSize: effectiveColumnsPerPage,
          serverColumnPageTuples: [],
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: effectiveColumnsPerPage,
        },
      });
    },
    [
      dynamicGroupBySelectors,
      effectiveColumnsPerPage,
      ownState,
      selectedDynamicGroupBy,
      setDataMask,
    ],
  );
  const updateDynamicMetricOption = useCallback(
    (slotId: string, nextOptionId: string) => {
      const selector = dynamicMetricSelectors.find(
        candidate => candidate.slotId === slotId,
      );

      if (!selector?.valueSet.has(nextOptionId)) {
        return;
      }

      setDataMask?.({
        ownState: {
          ...getPreservedDynamicMetricOwnState(ownState),
          selectedDynamicMetric: {
            ...(selectedDynamicMetric ?? {}),
            [slotId]: nextOptionId,
          },
          currentColumnPage: 0,
          currentColumnPageSize: effectiveColumnsPerPage,
        },
      });
    },
    [
      dynamicMetricSelectors,
      effectiveColumnsPerPage,
      ownState,
      selectedDynamicMetric,
      setDataMask,
    ],
  );
  const updateNumericParameter = useCallback(
    (parameter: CrosstabParameter, value: number) => {
      validateNumericParameterValue(parameter, value);

      if (!serverColumnPagination) {
        setColumnPage(0);
      }

      setDataMask?.({
        ownState: {
          ...getPreservedRuntimeParameterOwnState(ownState),
          numericParameters: {
            ...(ownState?.numericParameters ?? {}),
            [parameter.id]: value,
          },
          currentColumnPage: 0,
          currentColumnPageSize: effectiveColumnsPerPage,
        },
      });
    },
    [
      effectiveColumnsPerPage,
      ownState,
      serverColumnPagination,
      setColumnPage,
      setDataMask,
    ],
  );
  const toggleRowPath = useCallback(
    (row: DataRecord) => {
      const path = row[CROSSTAB_ROW_PATH] as string;
      const nextExpandedRowPaths = new Set(expandedRowPathSet);

      if (nextExpandedRowPaths.has(path)) {
        nextExpandedRowPaths.delete(path);
      } else {
        nextExpandedRowPaths.add(path);
      }

      setDataMask?.({
        ownState: {
          ...ownState,
          expandedRowPaths: Array.from(nextExpandedRowPaths),
        },
      });
    },
    [expandedRowPathSet, ownState, setDataMask],
  );
  const previousColumnPage = useCallback(() => {
    const nextPage = Math.max(0, effectiveColumnPage - 1);

    if (serverColumnPagination) {
      setServerColumnPage(nextPage);
      return;
    }

    setColumnPage(nextPage);
  }, [
    effectiveColumnPage,
    serverColumnPagination,
    setServerColumnPage,
    setColumnPage,
  ]);
  const nextColumnPage = useCallback(() => {
    const nextPage = Math.min(columnPageCount - 1, effectiveColumnPage + 1);

    if (serverColumnPagination) {
      setServerColumnPage(nextPage);
      return;
    }

    setColumnPage(nextPage);
  }, [
    columnPageCount,
    effectiveColumnPage,
    serverColumnPagination,
    setServerColumnPage,
    setColumnPage,
  ]);
  const columnDefs = useMemo<ColDef[]>(() => {
    const rowColumnDefs = buildRowColumnDefs(
      columns,
      totalBackgroundColor,
      expandedRowPathSet,
      toggleRowPath,
    );
    const treeColumnDefs = buildColumnDefsFromTree(
      visibleColumnTree,
      rulesByMetric,
      totalBackgroundColor,
      generatedColumnWidth,
      numberFormat,
    );

    return [
      ...rowColumnDefs,
      ...treeColumnDefs,
      ...(totalColumn
        ? [
            buildLeafColumnDef(
              totalColumn.key,
              totalColumn.label,
              rulesByMetric(getMetricFromColumnId(totalColumn.key)),
              totalBackgroundColor,
              generatedColumnWidth,
              numberFormat,
            ),
          ]
        : []),
    ];
  }, [
    columns,
    expandedRowPathSet,
    generatedColumnWidth,
    numberFormat,
    rulesByMetric,
    totalBackgroundColor,
    totalColumn,
    toggleRowPath,
    visibleColumnTree,
  ]);
  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
    }),
    [],
  );
  const exportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      allColumns: false,
      skipColumnGroupHeaders: false,
    });
  }, []);
  const columnPagination =
    columnPageCount > 1 ? (
      <div
        data-test="crosstab-column-pagination"
        style={{
          alignItems: 'center',
          display: 'inline-flex',
          gap: theme.sizeUnit,
        }}
      >
        <Button
          buttonSize="small"
          disabled={effectiveColumnPage === 0 || isServerColumnLoading}
          onClick={previousColumnPage}
          htmlType="button"
          aria-label={t('Previous crosstab columns')}
        >
          {t('Previous')}
        </Button>
        <span>
          {t(
            'Columns %s-%s / %s',
            pageStart + 1,
            pageEnd,
            totalGeneratedColumnCount,
          )}
        </span>
        <Button
          buttonSize="small"
          disabled={
            effectiveColumnPage >= columnPageCount - 1 || isServerColumnLoading
          }
          onClick={nextColumnPage}
          htmlType="button"
          aria-label={t('Next crosstab columns')}
        >
          {t('Next')}
        </Button>
      </div>
    ) : null;
  const dynamicGroupBySelects = dynamicGroupBySelectors.map(selector => {
    const { clearOptionId } = selector;

    return (
      <div
        key={selector.slotId}
        data-test={`crosstab-dynamic-groupby-control--${selector.slotId}`}
        style={{
          alignItems: 'center',
          display: 'inline-flex',
          gap: theme.sizeUnit,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{selector.label}</span>
        <Select
          ariaLabel={t('Select crosstab group by dimension %s', selector.label)}
          allowSelectAll={false}
          css={{ minWidth: DYNAMIC_SELECTOR_MIN_WIDTH }}
          onChange={(nextOptionId: string) =>
            updateDynamicGroupByOption(selector.slotId, nextOptionId)
          }
          onClear={
            clearOptionId === undefined || !selector.canClear
              ? undefined
              : () => updateDynamicGroupByOption(selector.slotId, clearOptionId)
          }
          options={selector.options}
          allowClear={clearOptionId !== undefined && selector.canClear}
          sortComparator={PRESERVE_SELECT_OPTION_ORDER}
          value={selector.value}
        />
      </div>
    );
  });
  const dynamicMetricSelects = dynamicMetricSelectors.map(selector => (
    <div
      key={selector.slotId}
      data-test={`crosstab-dynamic-metric-control--${selector.slotId}`}
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        gap: theme.sizeUnit,
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>{selector.label}</span>
      <Select
        ariaLabel={t('Select crosstab metric %s', selector.label)}
        allowSelectAll={false}
        css={{ minWidth: DYNAMIC_SELECTOR_MIN_WIDTH }}
        onChange={(nextOptionId: string) =>
          updateDynamicMetricOption(selector.slotId, nextOptionId)
        }
        options={selector.options}
        value={selector.value}
      />
    </div>
  ));
  const runtimeParameterControls = parameterControls.map(
    ({ parameter, value }) => {
      const { label } = parameter;

      return (
        <div
          key={parameter.id}
          data-test={`crosstab-parameter-control--${parameter.id}`}
          style={{
            alignItems: 'center',
            display: 'inline-flex',
            gap: theme.sizeUnit,
          }}
        >
          <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
          <input
            aria-label={label}
            max={parameter.max}
            min={parameter.min}
            onChange={event =>
              updateNumericParameter(parameter, Number(event.target.value))
            }
            step={parameter.step}
            type="number"
            value={value}
          />
        </div>
      );
    },
  );

  return (
    <div
      data-test="crosstab-table"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height,
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        width,
      }}
    >
      <div
        data-test="crosstab-table-toolbar"
        style={{
          alignItems: 'center',
          display: 'flex',
          flex: '0 0 auto',
          flexWrap: 'wrap',
          gap: theme.sizeUnit,
        }}
      >
        <Button
          buttonSize="small"
          onClick={exportCsv}
          htmlType="button"
          aria-label={t('Export crosstab CSV')}
        >
          CSV
        </Button>
        {dynamicGroupBySelects}
        {dynamicMetricSelects}
        {runtimeParameterControls}
      </div>
      <div
        data-test="crosstab-grid-container"
        ref={gridContainerRef}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <ThemedAgGridReact
          ref={gridRef}
          rowData={visibleRowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowStyle={({ data }) => {
            const rowType = data?.[CROSSTAB_ROW_TYPE];

            if (rowType === 'grand_total' || rowType === 'subtotal') {
              return {
                backgroundColor: totalBackgroundColor,
                fontWeight: 600,
              };
            }

            return undefined;
          }}
          enableCellTextSelection
        />
      </div>
      {columnPagination && (
        <div
          data-test="crosstab-table-footer"
          style={{
            alignItems: 'center',
            display: 'flex',
            flex: '0 0 auto',
            justifyContent: 'flex-end',
            paddingTop: theme.sizeUnit,
          }}
        >
          {columnPagination}
        </div>
      )}
    </div>
  );
}
