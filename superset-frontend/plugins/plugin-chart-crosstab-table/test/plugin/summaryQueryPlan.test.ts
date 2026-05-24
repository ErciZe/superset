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
import { buildCrosstabQueryPlan } from '../../src/plugin/summaryQueryPlan';

describe('crosstab summary query plan', () => {
  it('keeps one leaf query when all summaries are additive-only', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      requiresSqlSummary: false,
      showRowTotals: true,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: true,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toEqual(['leaf']);
  });

  it('adds full SQL summary plan for non-additive summaries', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      requiresSqlSummary: true,
      showRowTotals: true,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: true,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'leaf',
      'summary:row_total',
      'summary:column_total',
      'summary:column_subtotal_cells:columnDepth=1',
      'summary:column_subtotal_total:columnDepth=1',
      'summary:grand_total',
    ]);
  });

  it('adds row subtotal summary queries for multi-level rows', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['category', 'metric_name_with_unit'],
      columnFields: ['biz_date'],
      requiresSqlSummary: true,
      showRowTotals: true,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'leaf',
      'summary:row_total',
      'summary:row_subtotal_cells:rowDepth=1',
      'summary:row_subtotal_total:rowDepth=1',
      'summary:column_total',
      'summary:grand_total',
    ]);
  });

  it('keeps row-total summaries for total columns when grand-total rows are disabled', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      requiresSqlSummary: true,
      showRowTotals: false,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      serverColumnPagination: true,
      hasServerColumnPageTuples: true,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'server_column_domain',
      'server_column_count',
      'leaf',
      'summary:row_total',
    ]);
  });

  it('adds row total summary when column totals are enabled for additive rows', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date'],
      requiresSqlSummary: true,
      showRowTotals: false,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      serverColumnPagination: true,
      hasServerColumnPageTuples: true,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'server_column_domain',
      'server_column_count',
      'leaf',
      'summary:row_total',
    ]);
  });

  it('keeps server column bootstrap to domain and count before page tuples exist', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date'],
      requiresSqlSummary: true,
      showRowTotals: false,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      serverColumnPagination: true,
      hasServerColumnPageTuples: false,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'server_column_domain',
      'server_column_count',
    ]);
  });

  it('adds row-column subtotal summary queries when both subtotal axes are enabled', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['category', 'metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      requiresSqlSummary: true,
      showRowTotals: false,
      showRowSubtotals: true,
      showColumnTotals: false,
      showColumnSubtotals: true,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toContain(
      'summary:row_column_subtotal_cells:rowDepth=1:columnDepth=1',
    );
  });

  it('keeps row prefix summary queries for grouped rows when explicit row subtotals are disabled', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['category', 'metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name'],
      requiresSqlSummary: true,
      showRowTotals: true,
      showRowSubtotals: false,
      showColumnTotals: true,
      showColumnSubtotals: true,
      serverColumnPagination: false,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'leaf',
      'summary:row_total',
      'summary:row_subtotal_cells:rowDepth=1',
      'summary:row_subtotal_total:rowDepth=1',
      'summary:column_total',
      'summary:column_subtotal_cells:columnDepth=1',
      'summary:column_subtotal_total:columnDepth=1',
      'summary:row_column_subtotal_cells:rowDepth=1:columnDepth=1',
      'summary:grand_total',
    ]);
  });

  it('preserves server column pagination bootstrap queries', () => {
    const plan = buildCrosstabQueryPlan({
      rowFields: ['metric_name_with_unit'],
      columnFields: ['biz_date', 'shop_name', 'country'],
      requiresSqlSummary: true,
      showRowTotals: true,
      showRowSubtotals: false,
      showColumnTotals: true,
      showColumnSubtotals: false,
      serverColumnPagination: true,
      hasServerColumnPageTuples: false,
    });

    expect(plan.map(item => item.queryId)).toEqual([
      'server_column_domain',
      'server_column_count',
    ]);
  });
});
