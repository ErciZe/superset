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
import { QueryMode, VizType } from '@superset-ui/core';
import buildQuery from '../../src/matrix/buildQuery';

describe('ag grid table scheme matrix buildQuery', () => {
  test('preserves official query behavior when matrix mode is disabled', () => {
    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      groupby: ['category'],
      metrics: ['count'],
      matrix_mode_enabled: false,
    } as any).queries[0];

    expect(query.columns).toEqual(['category']);
    expect(query.metrics).toEqual(['count']);
  });

  test('injects matrix dimensions, unit, sort field, and selected metric', () => {
    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      groupby: ['ignored_group'],
      metrics: ['ignored_metric'],
      matrix_mode_enabled: true,
      matrix_rows: ['metric_name'],
      matrix_columns: ['biz_date'],
      matrix_value: 'value',
      matrix_row_sort: 'metric_order',
      matrix_unit_field: 'unit',
    } as any).queries[0];

    expect(query.columns).toEqual([
      'metric_name',
      'biz_date',
      'metric_order',
      'unit',
    ]);
    expect(query.metrics).toEqual(['value']);
  });

  test('adds a raw total summary query without matrix columns', () => {
    const queryContext = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      matrix_mode_enabled: true,
      matrix_rows: ['metric_name'],
      matrix_columns: ['biz_date'],
      matrix_value: 'value',
      matrix_row_sort: 'metric_order',
      matrix_unit_field: 'unit',
      matrix_show_total: true,
      matrix_value_calculation: 'raw',
      show_totals: true,
    } as any);

    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0].columns).toEqual([
      'metric_name',
      'biz_date',
      'metric_order',
      'unit',
    ]);
    expect(queryContext.queries[1]).toMatchObject({
      columns: ['metric_name', 'metric_order', 'unit'],
      metrics: ['value'],
      post_processing: [],
      row_limit: 0,
      row_offset: 0,
    });
  });

  test('passes adhoc dimensions and metrics through the official query builder', () => {
    const regionColumn = {
      expressionType: 'SQL',
      label: 'region_bucket',
      sqlExpression: "case when region is null then 'unknown' else region end",
    };
    const duplicateRegionColumn = {
      ...regionColumn,
    };
    const valueMetric = {
      expressionType: 'SQL',
      label: 'gross_value',
      sqlExpression: 'sum(gross_value)',
    };

    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      matrix_mode_enabled: true,
      matrix_rows: [regionColumn, duplicateRegionColumn],
      matrix_columns: ['biz_date'],
      matrix_value: valueMetric,
    } as any).queries[0];

    expect(query.columns).toEqual([regionColumn, 'biz_date']);
    expect(query.metrics).toEqual([valueMetric]);
  });

  test('fails fast when matrix mode is combined with server pagination', () => {
    expect(() =>
      buildQuery({
        viz_type: VizType.Table,
        datasource: '11__table',
        query_mode: QueryMode.Aggregate,
        matrix_mode_enabled: true,
        server_pagination: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
      } as any),
    ).toThrow('Matrix mode does not support server pagination.');
  });
});
