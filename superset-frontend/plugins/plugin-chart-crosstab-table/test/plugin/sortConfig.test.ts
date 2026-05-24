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
import type { DataRecord } from '@superset-ui/core';

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

test('sorts large bigint number values without losing precision', () => {
  const numberConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'asc', type: 'number' },
    },
  ];
  const lowerValue = BigInt('9007199254740992');
  const higherValue = BigInt('9007199254740993');
  const records = [
    { shop_name: 'B', shop_order: higherValue },
    { shop_name: 'A', shop_order: lowerValue },
  ];

  expect(
    [...records].sort(compareDataRecordsByDimensionSort(numberConfig)),
  ).toEqual([
    { shop_name: 'A', shop_order: lowerValue },
    { shop_name: 'B', shop_order: higherValue },
  ]);
});

test('throws when number sort compares bigint with number values', () => {
  const numberConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'asc', type: 'number' },
    },
  ];

  expect(() =>
    [
      { shop_name: 'A', shop_order: BigInt('9007199254740993') },
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

test('throws when sort direction has an invalid runtime value', () => {
  const invalidDirectionConfig = [
    {
      field: 'shop_name',
      sort: { by: 'self', direction: 'sideways' },
    },
  ] as unknown as DimensionFieldConfig[];

  expect(() => buildDimensionOrderBy(invalidDirectionConfig)).toThrow(
    'Crosstab sort direction must be "asc" or "desc".',
  );
});

test('throws when null placement has an invalid runtime value', () => {
  const invalidNullsConfig = [
    {
      field: 'shop_name',
      sort: {
        by: 'shop_order',
        direction: 'asc',
        type: 'number',
        nulls: 'middle',
      },
    },
  ] as unknown as DimensionFieldConfig[];

  expect(() =>
    [
      { shop_name: 'A', shop_order: null },
      { shop_name: 'B', shop_order: 1 },
    ].sort(compareDataRecordsByDimensionSort(invalidNullsConfig)),
  ).toThrow('Crosstab null placement must be "first" or "last".');
});

test('throws when sort type has an invalid runtime value', () => {
  const invalidTypeConfig = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'asc', type: 'boolean' },
    },
  ] as unknown as DimensionFieldConfig[];

  expect(() =>
    [
      { shop_name: 'A', shop_order: true },
      { shop_name: 'B', shop_order: false },
    ].sort(compareDataRecordsByDimensionSort(invalidTypeConfig)),
  ).toThrow('Crosstab sort type must be "string", "number", or "date".');
});

test('throws when a hidden sort field is missing from compared records', () => {
  const hiddenSortConfig: DimensionFieldConfig[] = [
    {
      field: 'shop_name',
      sort: { by: 'shop_order', direction: 'asc', type: 'number' },
    },
  ];
  const records: DataRecord[] = [
    { shop_name: 'A' },
    { shop_name: 'B', shop_order: 1 },
  ];

  expect(() =>
    records.sort(compareDataRecordsByDimensionSort(hiddenSortConfig)),
  ).toThrow('Crosstab sort field must resolve to a column label.');
});

test('throws when dimension or sort fields cannot resolve to labels', () => {
  const invalidFieldConfig = [
    {
      field: { expressionType: 'SQL', sqlExpression: '' },
    },
  ] as unknown as DimensionFieldConfig[];
  const invalidSortFieldConfig = [
    {
      field: 'shop_name',
      sort: {
        by: { expressionType: 'SQL', sqlExpression: '' },
        direction: 'asc',
      },
    },
  ] as unknown as DimensionFieldConfig[];

  expect(() => buildDimensionOrderBy(invalidFieldConfig)).toThrow(
    'Crosstab sort field must resolve to a column label.',
  );
  expect(() => getDimensionSortFields(invalidSortFieldConfig)).toThrow(
    'Crosstab sort field must resolve to a column label.',
  );
});

test('sorts strings deterministically by code unit order', () => {
  const stringConfig: DimensionFieldConfig[] = [
    { field: 'shop_name', sort: { by: 'self', direction: 'asc' } },
  ];
  const records = [
    { shop_name: 'a' },
    { shop_name: 'B' },
    { shop_name: '2' },
    { shop_name: '10' },
  ];

  expect(
    [...records].sort(compareDataRecordsByDimensionSort(stringConfig)),
  ).toEqual([
    { shop_name: '10' },
    { shop_name: '2' },
    { shop_name: 'B' },
    { shop_name: 'a' },
  ]);
});
