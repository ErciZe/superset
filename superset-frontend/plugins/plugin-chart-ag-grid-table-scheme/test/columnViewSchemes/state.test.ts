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
  buildColumnSettingItems,
  buildColumnStateFromSettings,
  buildColumnSignature,
  captureColumnViewState,
  reconcileColumnState,
} from '../../src/columnViewSchemes/state';
import type {
  ColumnViewColumnState,
  SchemeColDef,
} from '../../src/columnViewSchemes/types';

describe('column view scheme state utilities', () => {
  const colDefs: SchemeColDef[] = [
    { field: 'country', headerName: 'Country' },
    { colId: 'sales_total', field: 'sales', headerName: 'Sales' },
    { field: 'margin', headerName: 'Margin' },
  ];

  it('captures compact column state with scheme metadata and order', () => {
    const columnState: ColumnViewColumnState[] = [
      { colId: 'sales_total', hide: false, width: 180, sort: 'desc' },
      { colId: 'country', hide: true, width: 120 },
      { colId: 'margin', hide: false, pinned: 'left' },
    ];

    const state = captureColumnViewState(columnState, colDefs);

    expect(state).toMatchObject({
      state_version: 1,
      viz_type: 'ag-grid-table-scheme',
      state_type: 'column_view',
      column_signature: expect.stringMatching(/^hash:[0-9a-f]+$/),
      meta: {
        saved_at: expect.any(String),
      },
    });
    expect(new Date(state.meta.saved_at).toISOString()).toBe(
      state.meta.saved_at,
    );
    expect(state.columns).toEqual([
      {
        colId: 'sales_total',
        field: 'sales',
        headerName: 'Sales',
        hide: false,
        sort: 'desc',
        width: 180,
      },
      {
        colId: 'country',
        field: 'country',
        headerName: 'Country',
        hide: true,
        width: 120,
      },
      {
        colId: 'margin',
        field: 'margin',
        headerName: 'Margin',
        hide: false,
        pinned: 'left',
      },
    ]);
    expect(state.raw_column_state).toEqual(columnState);
    expect(state.raw_column_state).not.toBe(columnState);
  });

  it('omits sort state when sort replay is disabled', () => {
    const state = captureColumnViewState(
      [
        {
          colId: 'sales_total',
          hide: false,
          width: 180,
          sort: 'desc',
          sortIndex: 0,
          rowGroup: true,
        },
      ],
      colDefs,
      { includeSort: false },
    );

    expect(state.columns).toEqual([
      {
        colId: 'sales_total',
        field: 'sales',
        headerName: 'Sales',
        hide: false,
        width: 180,
      },
    ]);
    expect(state.raw_column_state).toEqual([
      { colId: 'sales_total', hide: false, width: 180 },
    ]);
    expect(
      reconcileColumnState(state, colDefs, { includeSort: false })[0],
    ).toEqual({ colId: 'sales_total', hide: false, width: 180 });
  });

  it('ignores removed columns and appends new columns', () => {
    const savedState = captureColumnViewState(
      [
        { colId: 'removed', hide: false, width: 80 },
        { colId: 'sales_total', hide: true, width: 180 },
        { colId: 'country', hide: false, width: 120 },
      ],
      [
        { field: 'removed', headerName: 'Removed' },
        { colId: 'sales_total', field: 'sales', headerName: 'Sales' },
        { field: 'country', headerName: 'Country' },
      ],
    );

    expect(reconcileColumnState(savedState, colDefs)).toEqual([
      { colId: 'sales_total', hide: true, width: 180 },
      { colId: 'country', hide: false, width: 120 },
      { colId: 'margin', hide: false },
    ]);
  });

  it('builds a stable signature regardless of column order', () => {
    expect(buildColumnSignature(colDefs)).toBe(
      buildColumnSignature([colDefs[2], colDefs[0], colDefs[1]]),
    );
  });

  it('builds editable setting items from current column state', () => {
    expect(
      buildColumnSettingItems(
        [
          { colId: 'country', hide: false, pinned: 'left' },
          { colId: 'sales_total', hide: true },
          { colId: 'removed', hide: false },
        ],
        colDefs,
      ),
    ).toEqual([
      {
        colId: 'country',
        group: '基础信息',
        label: 'Country',
        pinned: true,
        visible: true,
      },
      {
        colId: 'sales_total',
        group: '指标数据',
        label: 'Sales',
        pinned: false,
        visible: false,
      },
      {
        colId: 'margin',
        group: '其他',
        label: 'Margin',
        pinned: false,
        visible: true,
      },
    ]);
  });

  it('creates column state from hidden and reordered settings', () => {
    const nextState = buildColumnStateFromSettings(
      [
        { colId: 'country', hide: false, width: 120 },
        { colId: 'sales_total', hide: false, width: 180 },
        { colId: 'margin', hide: false, width: 100 },
      ],
      [
        {
          colId: 'margin',
          group: '其他',
          label: 'Margin',
          pinned: true,
          visible: true,
        },
        {
          colId: 'country',
          group: '基础信息',
          label: 'Country',
          pinned: false,
          visible: false,
        },
        {
          colId: 'sales_total',
          group: '指标数据',
          label: 'Sales',
          pinned: false,
          visible: true,
        },
      ],
      colDefs,
    );

    expect(nextState).toEqual([
      { colId: 'margin', hide: false, pinned: 'left', width: 100 },
      { colId: 'country', hide: true, pinned: null, width: 120 },
      { colId: 'sales_total', hide: false, pinned: null, width: 180 },
    ]);
  });

  it('appends newly configured columns when settings were based on older defs', () => {
    const nextState = buildColumnStateFromSettings(
      [{ colId: 'country', hide: false, width: 120 }],
      [
        {
          colId: 'country',
          group: '基础信息',
          label: 'Country',
          pinned: false,
          visible: true,
        },
      ],
      colDefs,
    );

    expect(nextState).toEqual([
      { colId: 'country', hide: false, pinned: null, width: 120 },
      { colId: 'sales_total', hide: false, pinned: null },
      { colId: 'margin', hide: false, pinned: null },
    ]);
  });

  it('keeps generated matrix columns in column signatures and reconciliation', () => {
    const matrixColDefs: SchemeColDef[] = [
      { field: 'metric_name', headerName: 'Metric' },
      {
        colId: '__matrix_total',
        field: '__matrix_total',
        headerName: 'Total',
      },
      {
        colId: '__matrix_col__2026-05-01',
        field: '__matrix_col__2026-05-01',
        headerName: '2026-05-01',
      },
    ];
    const savedState = captureColumnViewState(
      [
        { colId: '__matrix_total', hide: false, pinned: 'left', width: 140 },
        { colId: '__matrix_col__2026-05-01', hide: true, width: 120 },
      ],
      matrixColDefs,
    );

    expect(savedState.column_signature).toMatch(/^hash:[0-9a-f]+$/);
    expect(
      reconcileColumnState(savedState, [
        ...matrixColDefs,
        {
          colId: '__matrix_col__2026-05-02',
          field: '__matrix_col__2026-05-02',
          headerName: '2026-05-02',
        },
      ]),
    ).toEqual([
      { colId: '__matrix_total', hide: false, pinned: 'left', width: 140 },
      { colId: '__matrix_col__2026-05-01', hide: true, width: 120 },
      { colId: 'metric_name', hide: false },
      { colId: '__matrix_col__2026-05-02', hide: false },
    ]);
  });
});
