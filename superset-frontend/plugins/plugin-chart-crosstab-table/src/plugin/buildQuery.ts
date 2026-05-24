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
import { buildQueryContext, ensureIsArray } from '@superset-ui/core';
import type {
  BuildQuery,
  QueryFormColumn,
  QueryFormMetric,
  QueryObject,
} from '@superset-ui/core';
import type {
  CrosstabFormData,
  CrosstabOwnState as DynamicOwnState,
  CrosstabQueryPlanItem,
} from '../types';
import { resolveDynamicGroupByDimensions } from './dynamicGroupBy';
import { resolveDynamicMetricConfigs } from './dynamicMetric';
import {
  getCrosstabColumnColumns,
  getEffectiveCrosstabMetricConfigs,
  getCrosstabRowColumns,
  getCrosstabSemanticOverrides,
} from './fieldConfig';
import { hasSqlSummarySemanticConfig } from './metricSemantics';
import {
  assertServerColumnPaginationShape,
  buildColumnTupleWhereClause,
  getColumnPageSize,
  getCurrentColumnPage,
  getServerColumnPageTuples,
} from './serverColumnPagination';
import type { CrosstabOwnState as ServerColumnOwnState } from './serverColumnPagination';
import { buildCrosstabQueryPlan } from './summaryQueryPlan';
import {
  expandCalculatedFieldMetricConfigs,
  getCalculatedFields,
} from './calcFields';
import { resolveCrosstabParameters } from './parameters';

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const BUSINESS_MATRIX_ROW_FIELDS = new Set([
  'metric_name',
  'metric_name_with_unit',
]);

export const ERR_CROSSTAB_BUSINESS_MATRIX_CALCULATED_FIELD =
  'Crosstab calculated fields do not support business matrix row dimensions.';

function appendWhere(queryObject: QueryObject, whereClause: string) {
  const existingWhere = queryObject.extras?.where;

  return {
    ...queryObject.extras,
    where: [existingWhere, whereClause].filter(Boolean).join(' AND '),
  };
}

function assertNoBusinessMatrixCalculatedFields(
  formData: CrosstabFormData,
  rowDimensions: QueryFormColumn[],
) {
  if (
    !rowDimensions.some(
      dimension =>
        typeof dimension === 'string' &&
        BUSINESS_MATRIX_ROW_FIELDS.has(dimension),
    )
  ) {
    return;
  }

  if (getCalculatedFields(formData).length > 0) {
    throw new Error(ERR_CROSSTAB_BUSINESS_MATRIX_CALCULATED_FIELD);
  }
}

function buildSummaryQuery(
  baseQueryObject: QueryObject,
  queryPlanItem: CrosstabQueryPlanItem,
  rowDimensions: QueryFormColumn[],
  columnDimensions: QueryFormColumn[],
  metrics: QueryFormMetric[],
  rowLimit: unknown,
  pageWhereClause?: string,
): QueryObject {
  const summaryColumns = (() => {
    switch (queryPlanItem.summaryKind) {
      case 'row_total':
        return rowDimensions;
      case 'row_subtotal_cells':
        return unique([
          ...rowDimensions.slice(0, queryPlanItem.rowDepth),
          ...columnDimensions,
        ]);
      case 'row_subtotal_total':
        return rowDimensions.slice(0, queryPlanItem.rowDepth);
      case 'row_column_subtotal_cells':
        return unique([
          ...rowDimensions.slice(0, queryPlanItem.rowDepth),
          ...columnDimensions.slice(0, queryPlanItem.columnDepth),
        ]);
      case 'column_total':
        return columnDimensions;
      case 'column_subtotal_cells':
        return unique([
          ...rowDimensions,
          ...columnDimensions.slice(0, queryPlanItem.columnDepth),
        ]);
      case 'column_subtotal_total':
        return columnDimensions.slice(0, queryPlanItem.columnDepth);
      case 'grand_total':
        return [];
      default:
        throw new Error(
          `Unsupported crosstab summary query: ${queryPlanItem.queryId}`,
        );
    }
  })();

  return {
    ...baseQueryObject,
    columns: summaryColumns,
    metrics,
    is_timeseries: false,
    post_processing: [],
    row_limit: Number(rowLimit) || 10000,
    row_offset: 0,
    ...(pageWhereClause
      ? { extras: appendWhere(baseQueryObject, pageWhereClause) }
      : {}),
  };
}

const buildQuery: BuildQuery<CrosstabFormData> = (formData, options) => {
  if (formData.serverPagination) {
    throw new Error('Crosstab table does not support server pagination in v1.');
  }

  const persistedRowDimensions = ensureIsArray<QueryFormColumn>(
    getCrosstabRowColumns(formData),
  );
  const persistedColumnDimensions = ensureIsArray<QueryFormColumn>(
    getCrosstabColumnColumns(formData),
  );
  const { rowDimensions, columnDimensions } = resolveDynamicGroupByDimensions({
    formData,
    ownState: options?.ownState,
    rowDimensions: persistedRowDimensions,
    columnDimensions: persistedColumnDimensions,
  });
  const baseMetricConfigs = getEffectiveCrosstabMetricConfigs(formData);
  assertNoBusinessMatrixCalculatedFields(formData, rowDimensions);
  const resolvedParameters = resolveCrosstabParameters(
    formData,
    options?.ownState as DynamicOwnState | undefined,
  );
  const calculatedMetricResult = expandCalculatedFieldMetricConfigs({
    dialect: 'doris',
    formData,
    metricConfigs: baseMetricConfigs,
    parameterValues: resolvedParameters.values,
  });
  const dynamicMetricResult = resolveDynamicMetricConfigs({
    formData,
    metricConfigs: calculatedMetricResult.metricConfigs,
    ownState: options?.ownState as DynamicOwnState | undefined,
  });
  const effectiveMetricConfigs = dynamicMetricResult.metricConfigs;
  const metrics = effectiveMetricConfigs.map(config => config.metric);
  const hasNonAdditiveSummary = hasSqlSummarySemanticConfig(
    effectiveMetricConfigs,
    getCrosstabSemanticOverrides(formData),
  );

  return buildQueryContext(formData, baseQueryObject => [
    ...(formData.serverColumnPagination
      ? (() => {
          assertServerColumnPaginationShape(
            rowDimensions,
            columnDimensions,
            metrics.length,
          );

          const currentPage = getCurrentColumnPage(options?.ownState);
          const ownColumnPageSize = (
            options?.ownState as ServerColumnOwnState | undefined
          )?.currentColumnPageSize;
          const columnPageSize = getColumnPageSize(
            ownColumnPageSize ?? formData.columnPageSize,
          );
          const pageTuples = getServerColumnPageTuples(
            options?.ownState,
            currentPage,
            columnPageSize,
            columnDimensions as string[],
          );
          const domainQuery: QueryObject = {
            ...baseQueryObject,
            columns: columnDimensions,
            metrics: [],
            is_timeseries: false,
            post_processing: [],
            orderby: columnDimensions.map(column => [column, true]),
            row_limit: columnPageSize,
            row_offset: currentPage * columnPageSize,
          };
          const countQuery: QueryObject = {
            ...domainQuery,
            row_limit: 0,
            row_offset: 0,
            is_rowcount: true,
          };
          const columnTupleWhere = buildColumnTupleWhereClause(
            columnDimensions as string[],
            pageTuples,
          );
          const dataQuery: QueryObject = {
            ...baseQueryObject,
            columns: unique([...rowDimensions, ...columnDimensions]),
            metrics,
            is_timeseries: false,
            post_processing: [],
            extras: appendWhere(baseQueryObject, columnTupleWhere),
          };
          const rowTotalQuery: QueryObject = {
            ...baseQueryObject,
            columns: rowDimensions,
            metrics,
            is_timeseries: false,
            post_processing: [],
            row_limit: Number(formData.row_limit) || 10000,
            row_offset: 0,
          };
          const queryPlan = buildCrosstabQueryPlan({
            rowFields: rowDimensions as string[],
            columnFields: columnDimensions as string[],
            requiresSqlSummary: hasNonAdditiveSummary,
            showRowTotals: formData.showRowTotals ?? true,
            showRowSubtotals: formData.showRowSubtotals ?? true,
            showColumnTotals: formData.showColumnTotals ?? true,
            showColumnSubtotals: formData.showColumnSubtotals ?? false,
            serverColumnPagination: true,
            hasServerColumnPageTuples: pageTuples.length > 0,
          });
          const plannedQueries = queryPlan.map(queryPlanItem => {
            switch (queryPlanItem.role) {
              case 'server_column_domain':
                return domainQuery;
              case 'server_column_count':
                return countQuery;
              case 'leaf':
                return dataQuery;
              case 'summary':
                return buildSummaryQuery(
                  baseQueryObject,
                  queryPlanItem,
                  rowDimensions,
                  columnDimensions,
                  metrics,
                  formData.row_limit,
                  queryPlanItem.summaryKind?.startsWith('column_') ||
                    queryPlanItem.summaryKind === 'row_subtotal_cells' ||
                    queryPlanItem.summaryKind === 'row_column_subtotal_cells'
                    ? columnTupleWhere
                    : undefined,
                );
              default:
                throw new Error(
                  `Unsupported crosstab query role: ${
                    (queryPlanItem as CrosstabQueryPlanItem).role
                  }`,
                );
            }
          });

          if (!pageTuples.length) {
            return plannedQueries;
          }

          return hasNonAdditiveSummary
            ? plannedQueries
            : [
                ...plannedQueries,
                // Preserve the existing server-column row-total query once
                // page tuples are loaded for additive-only plans.
                rowTotalQuery,
              ];
        })()
      : (() => {
          const dataQuery: QueryObject = {
            ...baseQueryObject,
            columns: unique([...rowDimensions, ...columnDimensions]),
            metrics,
            is_timeseries: false,
            post_processing: [],
          };
          const queryPlan = buildCrosstabQueryPlan({
            rowFields: rowDimensions as string[],
            columnFields: columnDimensions as string[],
            requiresSqlSummary: hasNonAdditiveSummary,
            showRowTotals: formData.showRowTotals ?? true,
            showRowSubtotals: formData.showRowSubtotals ?? true,
            showColumnTotals: formData.showColumnTotals ?? true,
            showColumnSubtotals: formData.showColumnSubtotals ?? false,
            serverColumnPagination: false,
          });

          return queryPlan.map(queryPlanItem => {
            switch (queryPlanItem.role) {
              case 'leaf':
                return dataQuery;
              case 'summary':
                return buildSummaryQuery(
                  baseQueryObject,
                  queryPlanItem,
                  rowDimensions,
                  columnDimensions,
                  metrics,
                  formData.row_limit,
                );
              case 'server_column_domain':
              case 'server_column_count':
                throw new Error(
                  `Unexpected crosstab query in non-server plan: ${queryPlanItem.queryId}`,
                );
              default:
                throw new Error(
                  `Unsupported crosstab query role: ${
                    (queryPlanItem as CrosstabQueryPlanItem).role
                  }`,
                );
            }
          });
        })()),
  ]);
};

export default buildQuery;
