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
  buildHierarchyView,
  encodeHierarchyPath,
  HIERARCHY_META_KEY,
} from '../../src/table/hierarchy';

const hierarchyFields = ['spu', 'ym', 'spu_level', 'sku_level'];
const rows: DataRecord[] = [
  {
    spu: '8010S',
    ym: '2026-03',
    spu_level: 'S',
    sku_level: 'A',
    sales: 12,
  },
  {
    spu: '8010S',
    ym: '2026-03',
    spu_level: 'S',
    sku_level: 'B',
    sales: 8,
  },
  {
    spu: '8010S',
    ym: '2026-02',
    spu_level: 'A',
    sku_level: 'B',
    sales: 5,
  },
  {
    spu: '8012S',
    ym: '2026-03',
    spu_level: 'B',
    sku_level: 'C',
    sales: 3,
  },
];

test('builds a page-local hierarchy view with stable metadata', () => {
  const view = buildHierarchyView(rows, hierarchyFields, []);

  expect(view).toMatchObject({
    records: expect.any(Array),
    metadataKey: HIERARCHY_META_KEY,
  });
  expect(view.records).toHaveLength(rows.length);

  const firstRowMeta = view.records[0][HIERARCHY_META_KEY];
  expect(firstRowMeta).toMatchObject({
    spu: { depth: 0, firstInGroup: true, hasDescendants: true },
    ym: { depth: 1, firstInGroup: true, hasDescendants: true },
    spu_level: { depth: 2, firstInGroup: true, hasDescendants: true },
    sku_level: { depth: 3, firstInGroup: true, hasDescendants: false },
  });

  const secondRowMeta = view.records[1][HIERARCHY_META_KEY];
  expect(secondRowMeta).toMatchObject({
    spu: { firstInGroup: false },
    ym: { firstInGroup: false },
    spu_level: { firstInGroup: false },
    sku_level: { firstInGroup: true },
  });
  expect(view.records[1]).toMatchObject({
    spu: '8010S',
    ym: '2026-03',
    spu_level: 'S',
    sku_level: 'B',
  });
});

test('marks every ancestor as the first group on an arbitrary page', () => {
  const page = buildHierarchyView(rows.slice(1), hierarchyFields, []);
  const metadata = page.records[0][HIERARCHY_META_KEY];

  expect(metadata).toEqual(
    expect.objectContaining(
      Object.fromEntries(
        hierarchyFields.map(field => [
          field,
          expect.objectContaining({ firstInGroup: true }),
        ]),
      ),
    ),
  );
});

test('encodes null and the literal NULL as distinct path values', () => {
  expect(encodeHierarchyPath([null])).not.toBe(encodeHierarchyPath(['NULL']));
  expect(encodeHierarchyPath(['a/b', 'c|d'])).not.toBe(
    encodeHierarchyPath(['a', 'b/c|d']),
  );
});

test('keeps a collapsed group header and hides only later descendants', () => {
  const collapsed = buildHierarchyView(rows, hierarchyFields, [
    encodeHierarchyPath(['8010S', '2026-03']),
  ]);

  expect(collapsed.records).toHaveLength(3);
  expect(collapsed.records[0]).toMatchObject({
    spu: '8010S',
    ym: '2026-03',
    sku_level: 'A',
  });
  expect(
    collapsed.records.some(
      record =>
        record.spu === '8010S' && record.ym === '2026-03' && record.sales === 8,
    ),
  ).toBe(false);
  expect(collapsed.records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ spu: '8010S', ym: '2026-02' }),
      expect.objectContaining({ spu: '8012S', ym: '2026-03' }),
    ]),
  );
});

test('returns the original records when no hierarchy fields are configured', () => {
  const view = buildHierarchyView(rows, [], []);

  expect(view.records).toBe(rows);
  expect(view.metadataKey).toBe(HIERARCHY_META_KEY);
});

test('fails fast when a hierarchy field is absent from every record', () => {
  expect(() => buildHierarchyView(rows, ['missing'], [])).toThrow(
    'Missing hierarchy fields: missing',
  );
});
