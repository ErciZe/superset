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
  buildDimensionOrderBy,
  compareDataRecordsByDimensionSort,
  getDimensionSortFields,
} from '../../src/plugin/sortConfig';
import type { DimensionFieldConfig } from '../../src/types';

const configs: DimensionFieldConfig[] = [
  {
    field: 'biz_date',
    sort: { by: 'biz_date', direction: 'asc', type: 'date', nulls: 'last' },
  },
  {
    field: 'shop_name',
    sort: { by: 'shop_order', direction: 'desc', type: 'number' },
  },
];

test('builds orderby entries from dimension sort configs', () => {
  expect(buildDimensionOrderBy(configs)).toEqual([
    ['biz_date', true],
    ['shop_order', false],
  ]);
});

test('returns hidden sort fields that are not visible dimensions', () => {
  expect(getDimensionSortFields(configs)).toEqual(['shop_order']);
});

test('sorts records by configured date and number fields', () => {
  const records = [
    { biz_date: '2025-01-02', shop_name: 'B', shop_order: 1 },
    { biz_date: '2025-01-01', shop_name: 'A', shop_order: 3 },
    { biz_date: '2025-01-01', shop_name: 'C', shop_order: 1 },
  ];

  expect([...records].sort(compareDataRecordsByDimensionSort(configs))).toEqual(
    [
      { biz_date: '2025-01-01', shop_name: 'A', shop_order: 3 },
      { biz_date: '2025-01-01', shop_name: 'C', shop_order: 1 },
      { biz_date: '2025-01-02', shop_name: 'B', shop_order: 1 },
    ],
  );
});

test('uses the dimension field as the default self sort', () => {
  const selfConfigs: DimensionFieldConfig[] = [
    { field: 'country' },
    { field: 'shop_name', sort: { by: 'self', direction: 'desc' } },
  ];

  expect(buildDimensionOrderBy(selfConfigs)).toEqual([
    ['country', true],
    ['shop_name', false],
  ]);
  expect(getDimensionSortFields(selfConfigs)).toEqual([]);
});

test('sorts nulls first or last per config with last as the default', () => {
  const nullsFirstConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: {
        by: 'shop_order',
        direction: 'asc',
        type: 'number',
        nulls: 'first',
      },
    },
  ];
  const nullsLastConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'asc', type: 'number' },
    },
  ];
  const records = [
    { shop_name: 'B', shop_order: 2 },
    { shop_name: 'A', shop_order: null },
    { shop_name: 'C', shop_order: 1 },
  ];

  expect(
    [...records].sort(compareDataRecordsByDimensionSort(nullsFirstConfig)),
  ).toEqual([
    { shop_name: 'A', shop_order: null },
    { shop_name: 'C', shop_order: 1 },
    { shop_name: 'B', shop_order: 2 },
  ]);
  expect(
    [...records].sort(compareDataRecordsByDimensionSort(nullsLastConfig)),
  ).toEqual([
    { shop_name: 'C', shop_order: 1 },
    { shop_name: 'B', shop_order: 2 },
    { shop_name: 'A', shop_order: null },
  ]);
});

test('keeps nulls last by default when sorting descending', () => {
  const nullsLastDescConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'desc', type: 'number' },
    },
  ];
  const records = [
    { shop_name: 'B', shop_order: 2 },
    { shop_name: 'A', shop_order: null },
    { shop_name: 'C', shop_order: 1 },
  ];

  expect(
    [...records].sort(compareDataRecordsByDimensionSort(nullsLastDescConfig)),
  ).toEqual([
    { shop_name: 'B', shop_order: 2 },
    { shop_name: 'C', shop_order: 1 },
    { shop_name: 'A', shop_order: null },
  ]);
});

test('keeps nulls first when sorting descending', () => {
  const nullsFirstDescConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: {
        by: 'shop_order',
        direction: 'desc',
        type: 'number',
        nulls: 'first',
      },
    },
  ];
  const records = [
    { shop_name: 'B', shop_order: 2 },
    { shop_name: 'A', shop_order: null },
    { shop_name: 'C', shop_order: 1 },
  ];

  expect(
    [...records].sort(compareDataRecordsByDimensionSort(nullsFirstDescConfig)),
  ).toEqual([
    { shop_name: 'A', shop_order: null },
    { shop_name: 'B', shop_order: 2 },
    { shop_name: 'C', shop_order: 1 },
  ]);
});

test('throws when a configured number sort value is invalid', () => {
  const numberConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'asc', type: 'number' },
    },
  ];

  expect(() =>
    [
      { shop_name: 'A', shop_order: 'bad-number' },
      { shop_name: 'B', shop_order: 1 },
    ].sort(compareDataRecordsByDimensionSort(numberConfig)),
  ).toThrow('Crosstab sort value must match its configured type.');
});

test('throws when a configured date sort value is invalid', () => {
  const dateConfig: DimensionFieldConfig[] = [
    {
      field: 'biz_date',
      sort: { by: 'self', direction: 'asc', type: 'date' },
    },
  ];

  expect(() =>
    [{ biz_date: 'not-a-date' }, { biz_date: '2025-01-01' }].sort(
      compareDataRecordsByDimensionSort(dateConfig),
    ),
  ).toThrow('Crosstab sort value must match its configured type.');
});
