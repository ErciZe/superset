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
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  t,
  type ChartProps,
  type DataRecord,
  type DataRecordValue,
  type QueryFormColumn,
  type QueryFormMetric,
} from '@superset-ui/core';
import {
  buildCrosstab,
  CROSSTAB_ROW_KEY,
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
} from '../crosstab/engine';
import { parseConditionalFormatting } from '../crosstab/formatting';
import type {
  CrosstabChartProps,
  CrosstabFormData,
  CrosstabOwnState,
  CrosstabQueryPlanItem,
  CrosstabSummaryKind,
  CrosstabSummaryValues,
} from '../types';
import { encodeTuple } from '../crosstab/keys';
import { addNumeric } from '../crosstab/totals';
import {
  areColumnTuplesEqual,
  ERR_SERVER_COLUMN_PAGINATION_ROW_LIMIT,
  getColumnPageSize,
  getCurrentColumnPage,
  getServerColumnPageColumnSignature,
  recordsToColumnTuples,
} from './serverColumnPagination';
import type { CrosstabOwnState as ServerColumnOwnState } from './serverColumnPagination';
import {
  getCrosstabColumnColumns,
  getCrosstabFieldLabels,
  getCrosstabMetrics,
  getPersistedCrosstabMetricConfigs,
  getCrosstabRowColumns,
  getCrosstabRowSubtotalDepths,
  getCrosstabSemanticOverrideField,
  getCrosstabSemanticOverrides,
} from './fieldConfig';
import {
  hasSqlSummarySemanticConfig,
  resolveMetricSemantic,
} from './metricSemantics';
import { buildCrosstabQueryPlan } from './summaryQueryPlan';
import { buildSummaryResultMap } from './summaryResults';
import { resolveDynamicGroupByDimensions } from './dynamicGroupBy';
import { resolveDynamicMetricConfigs } from './dynamicMetric';
import { expandCalculatedFieldMetricConfigs } from './calcFields';
import { resolveCrosstabParameters } from './parameters';

type CrosstabQueryData = ChartProps<CrosstabFormData>['queriesData'][number];

function normalizeColumn(value: QueryFormColumn): string {
  if (value === null || value === undefined) {
    throw new Error('Unsupported crosstab column field.');
  }

  const label = getColumnLabel(value);
  if (!label) {
    throw new Error('Unsupported crosstab column field.');
  }

  return label;
}

function normalizeMetric(value: QueryFormMetric): string {
  if (value === null || value === undefined) {
    throw new Error('Unsupported crosstab metric field.');
  }

  const label = getMetricLabel(value);
  if (!label) {
    throw new Error('Unsupported crosstab metric field.');
  }

  return label;
}

function rowKey(record: DataRecord, rowFields: string[]) {
  return encodeTuple(rowFields.map(field => record[field]));
}

function metricTotal(record: DataRecord, metricFields: string[]) {
  return metricFields.reduce<number | null>(
    (total, metric) => addNumeric(total, record[metric]),
    null,
  );
}

function applyRowTotals(
  rowData: DataRecord[],
  rowTotalRecords: DataRecord[],
  rowFields: string[],
  metricFields: string[],
): DataRecord[] {
  if (!rowTotalRecords.length) {
    return rowData;
  }

  const totalsByRowKey = new Map(
    rowTotalRecords.map(record => [
      rowKey(record, rowFields),
      metricTotal(record, metricFields),
    ]),
  );
  const withLeafTotals = rowData.map(row => {
    if (row[CROSSTAB_ROW_TYPE] !== 'leaf') {
      return row;
    }

    const total = totalsByRowKey.get(String(row[CROSSTAB_ROW_KEY]));

    return total === undefined
      ? row
      : { ...row, [CROSSTAB_TOTAL_COLUMN_ID]: total };
  });
  const grandTotal = withLeafTotals.reduce<number | null>(
    (total, row) =>
      row[CROSSTAB_ROW_TYPE] === 'leaf'
        ? addNumeric(total, row[CROSSTAB_TOTAL_COLUMN_ID])
        : total,
    null,
  );

  return withLeafTotals.map(row =>
    row[CROSSTAB_ROW_TYPE] === 'grand_total'
      ? { ...row, [CROSSTAB_TOTAL_COLUMN_ID]: grandTotal }
      : row,
  );
}

function updateServerColumnOwnState(
  ownState: ServerColumnOwnState,
  setDataMask: CrosstabChartProps['hooks']['setDataMask'] | undefined,
  currentPage: number,
  currentPageSize: number,
  columnFields: string[],
  columnTuples: DataRecordValue[][],
  totalCount: number,
) {
  const columnSignature = getServerColumnPageColumnSignature(columnFields);

  if (
    ownState.serverColumnPageTuplesPage === currentPage &&
    ownState.serverColumnPageTuplesPageSize === currentPageSize &&
    ownState.serverColumnPageColumnSignature === columnSignature &&
    ownState.serverColumnTotalCount === totalCount &&
    areColumnTuplesEqual(ownState.serverColumnPageTuples ?? [], columnTuples)
  ) {
    return;
  }

  setDataMask?.({
    ownState: {
      ...ownState,
      currentColumnPage: currentPage,
      currentColumnPageSize: currentPageSize,
      serverColumnPageColumnSignature: columnSignature,
      serverColumnPageTuples: columnTuples,
      serverColumnPageTuplesPage: currentPage,
      serverColumnPageTuplesPageSize: currentPageSize,
      serverColumnTotalCount: totalCount,
    },
  });
}

function getPreservedDynamicGroupByOwnState(
  ownState: CrosstabOwnState,
): Record<string, unknown> {
  const preservedOwnState: Record<string, unknown> = { ...ownState };

  delete preservedOwnState.effectiveGroupBySignature;
  delete preservedOwnState.expandedRowPaths;
  delete preservedOwnState.selectedDynamicGroupBy;
  delete preservedOwnState.selectedDynamicGroupByColumn;
  delete preservedOwnState.serverColumnPageColumnSignature;
  delete preservedOwnState.serverColumnPageTuples;
  delete preservedOwnState.serverColumnPageTuplesPage;
  delete preservedOwnState.serverColumnPageTuplesPageSize;
  delete preservedOwnState.serverColumnTotalCount;

  return preservedOwnState;
}

function getPreservedDynamicMetricOwnState(
  ownState: CrosstabOwnState,
): Record<string, unknown> {
  const preservedOwnState: Record<string, unknown> = { ...ownState };

  delete preservedOwnState.currentColumnPage;
  delete preservedOwnState.effectiveMetricSignature;
  delete preservedOwnState.selectedDynamicMetric;
  delete preservedOwnState.serverColumnPageColumnSignature;
  delete preservedOwnState.serverColumnPageTuples;
  delete preservedOwnState.serverColumnPageTuplesPage;
  delete preservedOwnState.serverColumnPageTuplesPageSize;
  delete preservedOwnState.serverColumnTotalCount;

  return preservedOwnState;
}

function assertServerColumnRowLimit(
  rowcount: number | undefined,
  rowLimit: unknown,
) {
  const limit = typeof rowLimit === 'number' ? rowLimit : Number(rowLimit);

  if (Number.isFinite(limit) && limit > 0 && rowcount !== undefined) {
    if (rowcount >= limit) {
      throw new Error(ERR_SERVER_COLUMN_PAGINATION_ROW_LIMIT);
    }
  }
}

function queryDataByPlan(
  queryPlan: CrosstabQueryPlanItem[],
  queriesData: ChartProps<CrosstabFormData>['queriesData'],
) {
  return new Map(
    queryPlan.map((queryPlanItem, index) => [
      queryPlanItem.queryId,
      queriesData[index],
    ]),
  );
}

function findPlannedQuery(
  queryPlan: CrosstabQueryPlanItem[],
  queriesByPlan: Map<string, CrosstabQueryData>,
  predicate: (queryPlanItem: CrosstabQueryPlanItem) => boolean,
) {
  const queryPlanItem = queryPlan.find(predicate);

  return queryPlanItem ? queriesByPlan.get(queryPlanItem.queryId) : undefined;
}

function findSummaryQuery(
  queryPlan: CrosstabQueryPlanItem[],
  queriesByPlan: Map<string, CrosstabQueryData>,
  summaryKind: CrosstabSummaryKind,
) {
  return findPlannedQuery(
    queryPlan,
    queriesByPlan,
    queryPlanItem =>
      queryPlanItem.role === 'summary' &&
      queryPlanItem.summaryKind === summaryKind,
  );
}

function buildMergedSummaryResultMap({
  queryPlan,
  queriesByPlan,
  summaryKind,
  rowFields,
  columnFields,
  metricFields,
}: {
  queryPlan: CrosstabQueryPlanItem[];
  queriesByPlan: Map<string, CrosstabQueryData>;
  summaryKind: CrosstabSummaryKind;
  rowFields: (queryPlanItem: CrosstabQueryPlanItem) => string[];
  columnFields: (queryPlanItem: CrosstabQueryPlanItem) => string[];
  metricFields: string[];
}) {
  const maps = queryPlan
    .filter(
      queryPlanItem =>
        queryPlanItem.role === 'summary' &&
        queryPlanItem.summaryKind === summaryKind,
    )
    .flatMap(queryPlanItem => {
      const queryData = queriesByPlan.get(queryPlanItem.queryId);

      return queryData?.data
        ? [
            buildSummaryResultMap({
              records: queryData.data as DataRecord[],
              rowFields: rowFields(queryPlanItem),
              columnFields: columnFields(queryPlanItem),
              metricFields,
            }),
          ]
        : [];
    });

  if (!maps.length) {
    return undefined;
  }

  return maps.reduce((mergedMap, map) => {
    map.forEach((value, key) => {
      mergedMap.set(key, value);
    });

    return mergedMap;
  }, new Map<string, number | null>());
}

export default function transformProps(
  chartProps: ChartProps<CrosstabFormData>,
): CrosstabChartProps {
  const {
    datasource: { verboseMap = {} } = {},
    formData,
    hooks: { setDataMask } = {},
    ownState,
    queriesData,
  } = chartProps;
  const conditionalFormatting = parseConditionalFormatting(
    formData.conditionalFormatting,
  );
  const crosstabFormData = formData as CrosstabFormData;
  const persistedRowDimensions = ensureIsArray<QueryFormColumn>(
    getCrosstabRowColumns(crosstabFormData),
  );
  const persistedColumnDimensions = ensureIsArray<QueryFormColumn>(
    getCrosstabColumnColumns(crosstabFormData),
  );
  const metrics = getCrosstabMetrics(crosstabFormData);
  const crosstabOwnState = (ownState ?? {}) as CrosstabOwnState;
  const dynamicGroupBy = resolveDynamicGroupByDimensions({
    formData: crosstabFormData,
    ownState: crosstabOwnState,
    rowDimensions: persistedRowDimensions,
    columnDimensions: persistedColumnDimensions,
  });
  const rowFields = dynamicGroupBy.rowDimensions.map(normalizeColumn);
  const columnFields = dynamicGroupBy.columnDimensions.map(normalizeColumn);
  const persistedMetricConfigs =
    getPersistedCrosstabMetricConfigs(crosstabFormData);
  const baseMetricConfigs = persistedMetricConfigs.length
    ? persistedMetricConfigs
    : ensureIsArray<QueryFormMetric>(metrics).map(metric => ({ metric }));
  const resolvedParameters = resolveCrosstabParameters(
    crosstabFormData,
    crosstabOwnState,
  );
  const calculatedMetricResult = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData: crosstabFormData,
    metricConfigs: baseMetricConfigs,
    parameterValues: resolvedParameters.values,
  });
  const dynamicMetricResult = resolveDynamicMetricConfigs({
    formData: crosstabFormData,
    metricConfigs: calculatedMetricResult.metricConfigs,
    ownState: crosstabOwnState,
  });
  const effectiveMetricConfigs = dynamicMetricResult.metricConfigs;
  const metricFields = effectiveMetricConfigs.map(config =>
    normalizeMetric(config.metric),
  );
  const serverColumnPagination = Boolean(formData.serverColumnPagination);
  const currentPage = getCurrentColumnPage(crosstabOwnState);
  const columnPageSize = getColumnPageSize(
    crosstabOwnState.currentColumnPageSize ?? formData.columnPageSize,
  );
  const resetDynamicGroupByOwnState =
    dynamicGroupBy.config !== undefined &&
    crosstabOwnState.effectiveGroupBySignature !== dynamicGroupBy.signature;
  const resetDynamicMetricOwnState =
    calculatedMetricResult.metricConfigs !== baseMetricConfigs &&
    crosstabOwnState.effectiveMetricSignature !== dynamicMetricResult.signature;
  const resetDynamicMetricConfigOwnState =
    dynamicMetricResult.config !== undefined &&
    crosstabOwnState.effectiveMetricSignature !== dynamicMetricResult.signature;
  const hasEffectiveMetricSignature =
    dynamicMetricResult.config !== undefined ||
    calculatedMetricResult.metricConfigs !== baseMetricConfigs;

  if (resetDynamicGroupByOwnState) {
    setDataMask?.({
      ownState: {
        ...getPreservedDynamicGroupByOwnState(crosstabOwnState),
        selectedDynamicGroupBy: dynamicGroupBy.selectedDynamicGroupBy,
        ...(dynamicMetricResult.selectedDynamicMetric
          ? { selectedDynamicMetric: dynamicMetricResult.selectedDynamicMetric }
          : {}),
        effectiveGroupBySignature: dynamicGroupBy.signature,
        ...(hasEffectiveMetricSignature
          ? { effectiveMetricSignature: dynamicMetricResult.signature }
          : {}),
        currentColumnPage: 0,
        currentColumnPageSize: columnPageSize,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: columnPageSize,
      },
    });
  } else if (resetDynamicMetricOwnState || resetDynamicMetricConfigOwnState) {
    setDataMask?.({
      ownState: {
        ...getPreservedDynamicMetricOwnState(crosstabOwnState),
        ...(dynamicMetricResult.selectedDynamicMetric
          ? { selectedDynamicMetric: dynamicMetricResult.selectedDynamicMetric }
          : {}),
        effectiveMetricSignature: dynamicMetricResult.signature,
        currentColumnPage: 0,
        currentColumnPageSize: columnPageSize,
        serverColumnPageTuples: [],
        serverColumnPageTuplesPage: 0,
        serverColumnPageTuplesPageSize: columnPageSize,
      },
    });
  }

  const semanticOverrideField =
    getCrosstabSemanticOverrideField(crosstabFormData);
  const semanticOverrides = getCrosstabSemanticOverrides(crosstabFormData);
  const hasNonAdditiveSummary = hasSqlSummarySemanticConfig(
    effectiveMetricConfigs,
    semanticOverrides,
  );
  const queryPlan = buildCrosstabQueryPlan({
    rowFields,
    columnFields,
    hasNonAdditiveSummary,
    showRowTotals: formData.showRowTotals ?? true,
    showRowSubtotals: formData.showRowSubtotals ?? true,
    showColumnTotals: formData.showColumnTotals ?? true,
    showColumnSubtotals: formData.showColumnSubtotals ?? false,
    serverColumnPagination,
    hasServerColumnPageTuples: serverColumnPagination
      ? !resetDynamicGroupByOwnState &&
        !resetDynamicMetricOwnState &&
        !resetDynamicMetricConfigOwnState &&
        ((crosstabOwnState.serverColumnPageTuples?.length ?? 0) > 0 ||
          queriesData.length > 2)
      : undefined,
  });
  const queriesByPlan = queryDataByPlan(queryPlan, queriesData);
  const domainQuery = serverColumnPagination
    ? findPlannedQuery(
        queryPlan,
        queriesByPlan,
        queryPlanItem => queryPlanItem.role === 'server_column_domain',
      )
    : undefined;
  const countQuery = serverColumnPagination
    ? findPlannedQuery(
        queryPlan,
        queriesByPlan,
        queryPlanItem => queryPlanItem.role === 'server_column_count',
      )
    : undefined;
  const dataQuery = findPlannedQuery(
    queryPlan,
    queriesByPlan,
    queryPlanItem => queryPlanItem.role === 'leaf',
  );
  const rowTotalSummaryQuery = findSummaryQuery(
    queryPlan,
    queriesByPlan,
    'row_total',
  );
  const columnTotalSummaryQuery = findSummaryQuery(
    queryPlan,
    queriesByPlan,
    'column_total',
  );
  const grandTotalSummaryQuery = findSummaryQuery(
    queryPlan,
    queriesByPlan,
    'grand_total',
  );
  const legacyServerRowTotalQuery =
    serverColumnPagination && !hasNonAdditiveSummary
      ? queriesData[queryPlan.length]
      : undefined;
  const totalCount =
    serverColumnPagination &&
    typeof countQuery?.data?.[0]?.rowcount === 'number'
      ? (countQuery.data[0].rowcount as number)
      : undefined;
  const rowSubtotalCells = buildMergedSummaryResultMap({
    queryPlan,
    queriesByPlan,
    summaryKind: 'row_subtotal_cells',
    rowFields: queryPlanItem =>
      rowFields.slice(0, queryPlanItem.rowDepth ?? rowFields.length),
    columnFields: () => columnFields,
    metricFields,
  });
  const rowSubtotalTotal = buildMergedSummaryResultMap({
    queryPlan,
    queriesByPlan,
    summaryKind: 'row_subtotal_total',
    rowFields: queryPlanItem =>
      rowFields.slice(0, queryPlanItem.rowDepth ?? rowFields.length),
    columnFields: () => [],
    metricFields,
  });
  const columnSubtotalCells = buildMergedSummaryResultMap({
    queryPlan,
    queriesByPlan,
    summaryKind: 'column_subtotal_cells',
    rowFields: () => rowFields,
    columnFields: queryPlanItem =>
      columnFields.slice(0, queryPlanItem.columnDepth ?? columnFields.length),
    metricFields,
  });
  const columnSubtotalTotal = buildMergedSummaryResultMap({
    queryPlan,
    queriesByPlan,
    summaryKind: 'column_subtotal_total',
    rowFields: () => [],
    columnFields: queryPlanItem =>
      columnFields.slice(0, queryPlanItem.columnDepth ?? columnFields.length),
    metricFields,
  });
  const rowColumnSubtotalCells = buildMergedSummaryResultMap({
    queryPlan,
    queriesByPlan,
    summaryKind: 'row_column_subtotal_cells',
    rowFields: queryPlanItem =>
      rowFields.slice(0, queryPlanItem.rowDepth ?? rowFields.length),
    columnFields: queryPlanItem =>
      columnFields.slice(0, queryPlanItem.columnDepth ?? columnFields.length),
    metricFields,
  });
  const summaryValues: CrosstabSummaryValues = {
    ...(rowTotalSummaryQuery?.data
      ? {
          rowTotal: buildSummaryResultMap({
            records: rowTotalSummaryQuery.data as DataRecord[],
            rowFields,
            columnFields: [],
            metricFields,
          }),
        }
      : {}),
    ...(rowSubtotalCells ? { rowSubtotalCells } : {}),
    ...(rowSubtotalTotal ? { rowSubtotalTotal } : {}),
    ...(rowColumnSubtotalCells ? { rowColumnSubtotalCells } : {}),
    ...(columnTotalSummaryQuery?.data
      ? {
          columnTotal: buildSummaryResultMap({
            records: columnTotalSummaryQuery.data as DataRecord[],
            rowFields: [],
            columnFields,
            metricFields,
          }),
        }
      : {}),
    ...(columnSubtotalCells ? { columnSubtotalCells } : {}),
    ...(columnSubtotalTotal ? { columnSubtotalTotal } : {}),
    ...(grandTotalSummaryQuery?.data
      ? {
          grandTotal: buildSummaryResultMap({
            records: grandTotalSummaryQuery.data as DataRecord[],
            rowFields: [],
            columnFields: [],
            metricFields,
          }),
        }
      : {}),
  };

  if (
    serverColumnPagination &&
    !resetDynamicGroupByOwnState &&
    !resetDynamicMetricOwnState &&
    !resetDynamicMetricConfigOwnState
  ) {
    const columnTuples = recordsToColumnTuples(
      (domainQuery?.data ?? []) as DataRecord[],
      columnFields,
    );

    updateServerColumnOwnState(
      crosstabOwnState as ServerColumnOwnState,
      setDataMask,
      currentPage,
      columnPageSize,
      columnFields,
      columnTuples,
      totalCount ?? columnTuples.length,
    );

    if (dataQuery) {
      assertServerColumnRowLimit(dataQuery.rowcount, formData.row_limit);
    }
  }

  const result = buildCrosstab((dataQuery?.data ?? []) as DataRecord[], {
    rowFields,
    columnFields,
    metricFields,
    fieldLabels: {
      ...verboseMap,
      ...getCrosstabFieldLabels(crosstabFormData),
    },
    rowSubtotalDepths: getCrosstabRowSubtotalDepths(crosstabFormData),
    totalLabel: t('Total'),
    showRowSubtotals: formData.showRowSubtotals ?? true,
    showRowTotals: formData.showRowTotals ?? true,
    showColumnTotals: formData.showColumnTotals ?? true,
    showColumnSubtotals: formData.showColumnSubtotals ?? false,
    maxGeneratedColumns: formData.maxGeneratedColumns ?? 300,
    defaultRowExpandedDepth: formData.defaultRowExpandedDepth ?? 1,
    summaryValues,
    resolveSemantic: ({ row, metric }) =>
      resolveMetricSemantic({
        metric,
        row,
        metricConfigs: effectiveMetricConfigs,
        semanticOverrideField,
        semanticOverrides,
      }),
  });
  const rowData =
    serverColumnPagination &&
    (resetDynamicGroupByOwnState ||
      resetDynamicMetricOwnState ||
      resetDynamicMetricConfigOwnState ||
      !dataQuery)
      ? []
      : serverColumnPagination && legacyServerRowTotalQuery?.data
        ? applyRowTotals(
            result.rowData,
            legacyServerRowTotalQuery.data as DataRecord[],
            rowFields,
            metricFields,
          )
        : result.rowData;

  return {
    ...chartProps,
    formData: {
      ...formData,
      conditionalFormatting,
    },
    rowData,
    columns: result.columns,
    columnTree: result.columnTree,
    generatedColumnIds: result.generatedColumnIds,
    serverColumnCurrentPage: currentPage,
    serverColumnPageSize: columnPageSize,
    serverColumnTotalCount: totalCount,
    numericParameters: resolvedParameters.values,
    isServerColumnLoading:
      serverColumnPagination &&
      (resetDynamicGroupByOwnState ||
        resetDynamicMetricOwnState ||
        resetDynamicMetricConfigOwnState ||
        !dataQuery),
    expandedRowPaths: crosstabOwnState.expandedRowPaths,
    ...(dynamicGroupBy.config
      ? {
          dynamicGroupByConfig: dynamicGroupBy.config,
          selectedDynamicGroupBy: dynamicGroupBy.selectedDynamicGroupBy,
          selectedDynamicGroupByColumn: dynamicGroupBy.selectedColumn,
          effectiveGroupBySignature: dynamicGroupBy.signature,
        }
      : {}),
    ...(hasEffectiveMetricSignature
      ? {
          ...(dynamicMetricResult.config
            ? {
                dynamicMetricConfig: dynamicMetricResult.config,
                selectedDynamicMetric:
                  dynamicMetricResult.selectedDynamicMetric,
              }
            : {}),
          effectiveMetricSignature: dynamicMetricResult.signature,
        }
      : {}),
  };
}
