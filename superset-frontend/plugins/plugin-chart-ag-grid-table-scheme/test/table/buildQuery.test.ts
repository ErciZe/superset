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
import buildQuery from '../../src/table/buildQuery';
import { TableChartFormData } from '../../src/table/types';

const detailFormData: TableChartFormData = {
  viz_type: VizType.TableAgGridScheme,
  datasource: '0__table',
  query_mode: QueryMode.Aggregate,
  groupby: ['spu', 'ym'],
  metrics: ['hot_product_index', 'sales_qty'],
  orderby: [
    ['ym', false],
    ['sales_qty', false],
    ['spu', true],
  ],
  server_pagination: true,
  server_page_length: 50,
  row_limit: 100000,
  show_totals: true,
  server_pagination_default_orderby: [
    ['ym', false],
    ['sales_qty', false],
    ['spu', true],
  ],
};

test('uses the configured stable order for detail pagination and totals', () => {
  const [baseQuery, rowCountQuery, totalsQuery] =
    buildQuery(detailFormData).queries;
  const expectedOrder = [
    ['ym', false],
    ['sales_qty', false],
    ['spu', true],
  ];

  expect(baseQuery.orderby).toEqual(expectedOrder);
  expect(rowCountQuery.orderby).toEqual(expectedOrder);
  expect(totalsQuery.orderby).toBeUndefined();
  expect(totalsQuery.order_desc).toBeUndefined();
});

test('appends configured tie-breakers after a server pagination sort', () => {
  const [baseQuery] = buildQuery(detailFormData, {
    ownState: {
      sortBy: [{ id: 'sales_qty', key: 'sales_qty', desc: true }],
    },
  }).queries;

  expect(baseQuery.orderby).toEqual([
    ['sales_qty', false],
    ['ym', false],
    ['spu', true],
  ]);
});

test('keeps the legacy metric default unless stable pagination order is opted in', () => {
  const legacyFormData: TableChartFormData = {
    ...detailFormData,
    server_pagination_default_orderby: undefined,
  };
  const [baseQuery] = buildQuery(legacyFormData).queries;

  expect(baseQuery.orderby).toEqual([['hot_product_index', false]]);
});
