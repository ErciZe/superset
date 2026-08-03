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
import { render, userEvent } from '@superset-ui/core/spec';
import type { CustomHeaderParams } from '../../../src/table/types';
import CustomHeader from '../../../src/table/AgGridTable/components/CustomHeader';

test('anchors the native column filter to the filter icon', async () => {
  const column = {
    getColId: jest.fn().mockReturnValue('created_at'),
    getColDef: jest.fn().mockReturnValue({}),
    getUserProvidedColDef: jest.fn().mockReturnValue({}),
    isFilterActive: jest.fn().mockReturnValue(false),
  };
  const api = {
    showColumnFilter: jest.fn(),
  };
  const showFilter = jest.fn();
  const { container } = render(
    <CustomHeader
      {...({
        displayName: 'Created at',
        enableSorting: true,
        setSort: jest.fn(),
        context: {
          initialSortState: [],
          onColumnHeaderClicked: jest.fn(),
        },
        column,
        api,
        showFilter,
        slice_id: 130,
      } as unknown as CustomHeaderParams)}
    />,
  );
  const filterIcon = container.querySelector('.header-filter');

  if (!filterIcon) {
    throw new Error('filter icon not rendered');
  }

  await userEvent.click(filterIcon);

  expect(showFilter).toHaveBeenCalledWith(filterIcon);
  expect(api.showColumnFilter).not.toHaveBeenCalled();
});
