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
  AdhocColumn,
  buildQueryContext,
  ensureIsArray,
  getMetricLabel,
  isPhysicalColumn,
  QueryFormOrderBy,
  QueryMode,
  QueryObject,
  QueryObjectFilterClause,
  removeDuplicates,
  PostProcessingRule,
  BuildQuery,
} from '@superset-ui/core';
import {
  isTimeComparison,
  timeCompareOperator,
} from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import {
  AdvancedFilterOperator,
  AdvancedFilterState,
  TableChartFormData,
} from './types';
import { updateTableOwnState } from './utils/externalAPIs';

/**
 * Infer query mode from form data. If `all_columns` is set, then raw records mode,
 * otherwise defaults to aggregation mode.
 *
 * The same logic is used in `controlPanel` with control values as well.
 */
export function getQueryMode(formData: TableChartFormData) {
  const { query_mode: mode } = formData;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode;
  }
  const rawColumns = formData?.all_columns;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.Raw : QueryMode.Aggregate;
}

const splitAdvancedFilterValues = (value: string): string[] => [
  ...new Set(
    value
      .split(/[\s,;\uFF0C\uFF1B]+/)
      .map(part => part.trim())
      .filter(Boolean),
  ),
];

const wrapAdvancedFilterValue = (
  operator: AdvancedFilterOperator,
  value: string,
) => {
  if (operator === 'contains' || operator === 'notContains') {
    return `%${value}%`;
  }
  if (operator === 'startsWith') {
    return `${value}%`;
  }
  if (operator === 'endsWith') {
    return `%${value}`;
  }
  return value;
};

const getAdvancedFilterOp = (operator: AdvancedFilterOperator) => {
  const opMap: Record<AdvancedFilterOperator, string> = {
    equals: '==',
    notEqual: '!=',
    contains: 'ILIKE',
    notContains: 'NOT ILIKE',
    startsWith: 'ILIKE',
    endsWith: 'ILIKE',
    lessThan: '<',
    lessThanOrEqual: '<=',
    greaterThan: '>',
    greaterThanOrEqual: '>=',
    blank: 'IS NULL',
    notBlank: 'IS NOT NULL',
  };
  return opMap[operator];
};

const buildAdvancedFilter = (
  advancedFilter?: AdvancedFilterState,
): QueryObjectFilterClause | null => {
  const column = advancedFilter?.column;
  const operator = advancedFilter?.operator;
  if (!column || !operator) {
    return null;
  }

  if (operator === 'blank' || operator === 'notBlank') {
    return {
      col: column,
      op: getAdvancedFilterOp(operator),
      val: null,
    } as QueryObjectFilterClause;
  }

  const value = String(advancedFilter.value || '').trim();
  if (!value) {
    return null;
  }

  const values = splitAdvancedFilterValues(value);
  if (values.length > 1 && operator === 'equals') {
    return {
      col: column,
      op: 'IN',
      val: values,
    } as QueryObjectFilterClause;
  }
  if (values.length > 1 && operator === 'notEqual') {
    return {
      col: column,
      op: 'NOT IN',
      val: values,
    } as QueryObjectFilterClause;
  }

  return {
    col: column,
    op: getAdvancedFilterOp(operator),
    val: wrapAdvancedFilterValue(operator, value),
  } as QueryObjectFilterClause;
};

const buildQuery: BuildQuery<TableChartFormData> = (
  formData: TableChartFormData,
  options,
) => {
  const {
    percent_metrics: percentMetrics,
    order_desc: orderDesc = false,
    extra_form_data,
  } = formData;
  const queryMode = getQueryMode(formData);
  const [sortByMetric] = ensureIsArray(formData.timeseries_limit_metric);
  const time_grain_sqla =
    extra_form_data?.time_grain_sqla || formData.time_grain_sqla;
  let formDataCopy = formData;
  // never include time in raw records mode
  if (queryMode === QueryMode.Raw) {
    formDataCopy = {
      ...formData,
      include_time: false,
    };
  }

  const addComparisonPercentMetrics = (metrics: string[], suffixes: string[]) =>
    metrics.reduce<string[]>((acc, metric) => {
      const newMetrics = suffixes.map(suffix => `${metric}__${suffix}`);
      return acc.concat([metric, ...newMetrics]);
    }, []);

  return buildQueryContext(formDataCopy, baseQueryObject => {
    let { metrics, orderby = [], columns = [] } = baseQueryObject;
    const { extras = {} } = baseQueryObject;
    const stablePaginationOrderby =
      formData.server_pagination_default_orderby ?? [];
    let postProcessing: PostProcessingRule[] = [];
    const nonCustomNorInheritShifts = ensureIsArray(
      formData.time_compare,
    ).filter((shift: string) => shift !== 'custom' && shift !== 'inherit');
    const customOrInheritShifts = ensureIsArray(formData.time_compare).filter(
      (shift: string) => shift === 'custom' || shift === 'inherit',
    );

    let timeOffsets: string[] = [];

    // Shifts for non-custom or non inherit time comparison
    if (
      isTimeComparison(formData, baseQueryObject) &&
      !isEmpty(nonCustomNorInheritShifts)
    ) {
      timeOffsets = nonCustomNorInheritShifts;
    }

    // Shifts for custom or inherit time comparison
    if (
      isTimeComparison(formData, baseQueryObject) &&
      !isEmpty(customOrInheritShifts)
    ) {
      if (customOrInheritShifts.includes('custom')) {
        timeOffsets = timeOffsets.concat([formData.start_date_offset]);
      }
      if (customOrInheritShifts.includes('inherit')) {
        timeOffsets = timeOffsets.concat(['inherit']);
      }
    }

    let temporalColumnAdded = false;
    let temporalColumn = null;

    if (queryMode === QueryMode.Aggregate) {
      metrics = metrics || [];
      // override orderby with timeseries metric when in aggregation mode
      if (sortByMetric) {
        orderby = [[sortByMetric, !orderDesc]];
      } else if (
        formData.server_pagination &&
        stablePaginationOrderby.length > 0
      ) {
        orderby = stablePaginationOrderby;
      } else if (metrics?.length > 0) {
        // default to ordering by first metric in descending order
        // when no "sort by" metric is set (regardless if "SORT DESC" is set to true)
        orderby = [[metrics[0], false]];
      }
      // add postprocessing for percent metrics only when in aggregation mode
      if (percentMetrics && percentMetrics.length > 0) {
        const percentMetricsLabelsWithTimeComparison = isTimeComparison(
          formData,
          baseQueryObject,
        )
          ? addComparisonPercentMetrics(
              percentMetrics.map(getMetricLabel),
              timeOffsets,
            )
          : percentMetrics.map(getMetricLabel);
        const percentMetricLabels = removeDuplicates(
          percentMetricsLabelsWithTimeComparison,
        );
        metrics = removeDuplicates(
          metrics.concat(percentMetrics),
          getMetricLabel,
        );
        postProcessing = [
          {
            operation: 'contribution',
            options: {
              columns: percentMetricLabels,
              rename_columns: percentMetricLabels.map(x => `%${x}`),
            },
          },
        ];
      }
      // Add the operator for the time comparison if some is selected
      if (!isEmpty(timeOffsets)) {
        postProcessing.push(timeCompareOperator(formData, baseQueryObject));
      }

      const temporalColumnsLookup = formData?.temporal_columns_lookup;
      // Filter out the column if needed and prepare the temporal column object

      columns = columns.filter(col => {
        const shouldBeAdded =
          isPhysicalColumn(col) &&
          time_grain_sqla &&
          temporalColumnsLookup?.[col];

        if (shouldBeAdded && !temporalColumnAdded) {
          temporalColumn = {
            timeGrain: time_grain_sqla,
            columnType: 'BASE_AXIS',
            sqlExpression: col,
            label: col,
            expressionType: 'SQL',
          } as AdhocColumn;
          temporalColumnAdded = true;
          return false; // Do not include this in the output; it's added separately
        }
        return true;
      });

      // So we ensure the temporal column is added first
      if (temporalColumn) {
        columns = [temporalColumn, ...columns];
      }
    }

    const moreProps: Partial<QueryObject> = {};
    const ownState = options?.ownState ?? {};
    // Build Query flag to check if its for either download as csv, excel or json
    const isDownloadQuery =
      ['csv', 'xlsx'].includes(formData?.result_format || '') ||
      (formData?.result_format === 'json' &&
        formData?.result_type === 'results');

    if (isDownloadQuery) {
      moreProps.row_limit = Number(formDataCopy.row_limit) || 0;
      moreProps.row_offset = 0;
    }

    if (!isDownloadQuery && formDataCopy.server_pagination) {
      const pageSize = ownState.pageSize ?? formDataCopy.server_page_length;
      const currentPage = ownState.currentPage ?? 0;

      moreProps.row_limit = pageSize;
      moreProps.row_offset = currentPage * pageSize;
    }

    // getting sort by in case of server pagination from own state
    let sortByFromOwnState: QueryFormOrderBy[] | undefined;
    if (Array.isArray(ownState?.sortBy) && ownState?.sortBy.length > 0) {
      sortByFromOwnState = ownState.sortBy
        .map(sortByItem => {
          if (!sortByItem?.key) {
            return null;
          }
          return [sortByItem.key, !sortByItem.desc] as QueryFormOrderBy;
        })
        .filter((item): item is QueryFormOrderBy => item !== null);

      // Keep pagination deterministic when a user changes the primary sort.
      // The configured order supplies the stable tie-breakers for equal values.
      stablePaginationOrderby.forEach(orderItem => {
        const orderKey = String(orderItem[0]);
        if (
          !sortByFromOwnState?.some(
            currentItem => String(currentItem[0]) === orderKey,
          )
        ) {
          sortByFromOwnState?.push(orderItem);
        }
      });
    }

    let queryObject = {
      ...baseQueryObject,
      columns,
      extras,
      orderby:
        formData.server_pagination && sortByFromOwnState?.length
          ? sortByFromOwnState
          : orderby,
      metrics,
      post_processing: postProcessing,
      time_offsets: timeOffsets,
      ...moreProps,
    };

    if (
      formData.server_pagination &&
      options?.extras?.cachedChanges?.[formData.slice_id] &&
      JSON.stringify(options?.extras?.cachedChanges?.[formData.slice_id]) !==
        JSON.stringify(queryObject.filters)
    ) {
      queryObject = { ...queryObject, row_offset: 0 };
      const modifiedOwnState = {
        ...options?.ownState,
        currentPage: 0,
        pageSize: queryObject.row_limit ?? 0,
      };
      updateTableOwnState(options?.hooks?.setDataMask, modifiedOwnState);
    }
    // Because we use same buildQuery for all table on the page we need split them by id
    options?.hooks?.setCachedChanges({
      [formData.slice_id]: queryObject.filters,
    });

    const extraQueries: QueryObject[] = [];
    if (
      metrics?.length &&
      formData.show_totals &&
      queryMode === QueryMode.Aggregate
    ) {
      extraQueries.push({
        ...queryObject,
        columns: [],
        row_limit: 0,
        row_offset: 0,
        post_processing: [],
        order_desc: undefined, // we don't need orderby stuff here,
        orderby: undefined, // because this query will be used for get total aggregation.
      });
    }

    const interactiveGroupBy = formData.extra_form_data?.interactive_groupby;
    if (interactiveGroupBy && queryObject.columns) {
      queryObject.columns = [
        ...new Set([...queryObject.columns, ...interactiveGroupBy]),
      ];
    }

    if (formData.server_pagination) {
      // Add search filter if search text exists
      if (
        formData.include_search !== false &&
        ownState.searchText &&
        ownState?.searchColumn
      ) {
        queryObject = {
          ...queryObject,
          filters: [
            ...(queryObject.filters || []),
            {
              col: ownState?.searchColumn,
              op: 'ILIKE',
              val: `${ownState.searchText}%`,
            },
          ],
        };
      }

      const advancedFilter =
        formData.advanced_filter_enabled === false
          ? null
          : buildAdvancedFilter(
              ownState.advancedFilter as AdvancedFilterState | undefined,
            );
      if (advancedFilter) {
        queryObject = {
          ...queryObject,
          filters: [...(queryObject.filters || []), advancedFilter],
        };
      }
    }

    // Now since row limit control is always visible even
    // in case of server pagination
    // we must use row limit from form data
    if (formData.server_pagination && !isDownloadQuery) {
      return [
        { ...queryObject },
        {
          ...queryObject,
          time_offsets: [],
          row_limit: Number(formData?.row_limit ?? 0),
          row_offset: 0,
          post_processing: [],
          is_rowcount: true,
        },
        ...extraQueries,
      ];
    }

    return [queryObject, ...extraQueries];
  });
};

// Use this closure to cache changing of external filters, if we have server pagination we need reset page to 0, after
// external filter changed
export const cachedBuildQuery = (): BuildQuery<TableChartFormData> => {
  let cachedChanges: any = {};
  const setCachedChanges = (newChanges: any) => {
    cachedChanges = { ...cachedChanges, ...newChanges };
  };

  return (formData, options) =>
    buildQuery(
      { ...formData },
      {
        extras: { cachedChanges },
        ownState: options?.ownState ?? {},
        hooks: {
          ...options?.hooks,
          setDataMask: () => {},
          setCachedChanges,
        },
      },
    );
};

export default cachedBuildQuery();
