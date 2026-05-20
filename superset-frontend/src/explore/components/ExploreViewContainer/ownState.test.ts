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
import { getFilterOwnState } from './ownState';

test('filters crosstab chart-local ownState from extra form data', () => {
  expect(
    getFilterOwnState(
      { viz_type: 'crosstab-table' },
      {
        currentColumnPage: 2,
        currentColumnPageSize: 12,
        effectiveGroupBySignature: 'rows=metric|columns=date',
        expandedRowPaths: ['profit'],
        serverColumnPageColumnSignature: 'biz_date',
        serverColumnPageTuples: [['2026-05-20']],
        serverColumnPageTuplesPage: 1,
        serverColumnPageTuplesPageSize: 12,
        serverColumnTotalCount: 100,
        selectedDynamicGroupByColumn: 'shop_name',
        filterState: { value: ['kept'] },
      },
    ),
  ).toEqual({ filterState: { value: ['kept'] } });
});

test('keeps non-crosstab ownState unchanged', () => {
  const ownState = {
    currentColumnPage: 2,
    selectedDynamicGroupByColumn: 'shop_name',
  };

  expect(getFilterOwnState({ viz_type: 'table' }, ownState)).toBe(ownState);
});
