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

const basicFormData: TableChartFormData = {
  viz_type: VizType.TableAgGridScheme,
  datasource: '11__table',
  query_mode: QueryMode.Raw,
  all_columns: ['platform_order_name', 'msku'],
  server_pagination: true,
  server_page_length: 50,
};

test('adds advanced equality filter to server pagination data and rowcount queries', () => {
  const queryContext = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'platform_order_name',
        operator: 'equals',
        value: '#5578',
      },
    },
  });

  expect(queryContext.queries[0].filters).toContainEqual({
    col: 'platform_order_name',
    op: '==',
    val: '#5578',
  });
  expect(queryContext.queries[1].filters).toContainEqual({
    col: 'platform_order_name',
    op: '==',
    val: '#5578',
  });
});

test('maps multi-value equality and inequality filters to IN and NOT IN', () => {
  const [inQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'platform_order_name',
        operator: 'equals',
        value: '#5578\n#5579，#5580;#5581',
      },
    },
  }).queries;

  expect(inQuery.filters).toContainEqual({
    col: 'platform_order_name',
    op: 'IN',
    val: ['#5578', '#5579', '#5580', '#5581'],
  });

  const [notInQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'platform_order_name',
        operator: 'notEqual',
        value: '#5578 #5579',
      },
    },
  }).queries;

  expect(notInQuery.filters).toContainEqual({
    col: 'platform_order_name',
    op: 'NOT IN',
    val: ['#5578', '#5579'],
  });
});

test('maps text pattern and blank filters', () => {
  const [containsQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'msku',
        operator: 'contains',
        value: 'BK24',
      },
    },
  }).queries;

  expect(containsQuery.filters).toContainEqual({
    col: 'msku',
    op: 'ILIKE',
    val: '%BK24%',
  });

  const [blankQuery] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'msku',
        operator: 'blank',
        value: '',
      },
    },
  }).queries;

  expect(blankQuery.filters).toContainEqual({
    col: 'msku',
    op: 'IS NULL',
    val: null,
  });
});

test('ignores incomplete value-based advanced filters', () => {
  const [query] = buildQuery(basicFormData, {
    ownState: {
      advancedFilter: {
        column: 'msku',
        operator: 'notEqual',
        value: '',
      },
    },
  }).queries;

  expect(query.filters || []).toEqual([]);
});
