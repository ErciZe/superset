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
import type { CrosstabQueryPlanItem, CrosstabSummaryKind } from '../types';

type BuildCrosstabQueryPlanArgs = {
  rowFields: string[];
  columnFields: string[];
  hasNonAdditiveSummary: boolean;
  showRowTotals: boolean;
  showRowSubtotals: boolean;
  showColumnTotals: boolean;
  showColumnSubtotals: boolean;
  serverColumnPagination: boolean;
  hasServerColumnPageTuples?: boolean;
};

const serverColumnDomainQuery: CrosstabQueryPlanItem = {
  queryId: 'server_column_domain',
  role: 'server_column_domain',
};

const serverColumnCountQuery: CrosstabQueryPlanItem = {
  queryId: 'server_column_count',
  role: 'server_column_count',
};

const leafQuery: CrosstabQueryPlanItem = {
  queryId: 'leaf',
  role: 'leaf',
};

function summaryQuery(
  summaryKind: CrosstabSummaryKind,
  depth?: { rowDepth?: number; columnDepth?: number },
): CrosstabQueryPlanItem {
  const depthQueryId = [
    depth?.rowDepth !== undefined ? `rowDepth=${depth.rowDepth}` : undefined,
    depth?.columnDepth !== undefined
      ? `columnDepth=${depth.columnDepth}`
      : undefined,
  ]
    .filter(Boolean)
    .join(':');

  return {
    queryId: `summary:${summaryKind}${depthQueryId ? `:${depthQueryId}` : ''}`,
    role: 'summary',
    summaryKind,
    ...depth,
  };
}

export function buildCrosstabQueryPlan(
  args: BuildCrosstabQueryPlanArgs,
): CrosstabQueryPlanItem[] {
  if (args.serverColumnPagination && !args.hasServerColumnPageTuples) {
    return [serverColumnDomainQuery, serverColumnCountQuery];
  }

  const plan = args.serverColumnPagination
    ? [serverColumnDomainQuery, serverColumnCountQuery, leafQuery]
    : [leafQuery];

  if (!args.hasNonAdditiveSummary) {
    return plan;
  }

  if (args.showRowTotals) {
    plan.push(summaryQuery('row_total'));
  }

  if (args.rowFields.length > 1) {
    args.rowFields.slice(0, -1).forEach((_, index) => {
      const rowDepth = index + 1;

      plan.push(summaryQuery('row_subtotal_cells', { rowDepth }));

      if (args.showColumnTotals) {
        plan.push(summaryQuery('row_subtotal_total', { rowDepth }));
      }
    });
  }

  if (args.showColumnTotals) {
    plan.push(summaryQuery('column_total'));
  }

  if (args.showColumnSubtotals) {
    args.columnFields.slice(0, -1).forEach((_, index) => {
      const columnDepth = index + 1;

      plan.push(summaryQuery('column_subtotal_cells', { columnDepth }));
      plan.push(summaryQuery('column_subtotal_total', { columnDepth }));

      if (args.rowFields.length > 1) {
        args.rowFields.slice(0, -1).forEach((__, rowIndex) => {
          plan.push(
            summaryQuery('row_column_subtotal_cells', {
              rowDepth: rowIndex + 1,
              columnDepth,
            }),
          );
        });
      }
    });
  }

  if (args.showRowTotals || args.showColumnTotals) {
    plan.push(summaryQuery('grand_total'));
  }

  return plan;
}
