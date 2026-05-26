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
import { renderHook } from '@testing-library/react';
import { GenericDataType } from '@apache-superset/core/common';
import { useColDefs } from '../../../src/table/utils/useColDefs';

const column = {
  key: 'value',
  label: 'Value',
  dataType: GenericDataType.String,
  isNumeric: false,
  isMetric: false,
  isPercentMetric: false,
  config: {},
};

const defaultProps = {
  columns: [column],
  data: [{ value: 'Default' }],
  serverPagination: false,
  isRawRecords: false,
  defaultAlignPN: false,
  showCellBars: false,
  colorPositiveNegative: false,
  totals: undefined,
  columnColorFormatters: [],
  basicColorFormatters: [],
  isUsingTimeComparison: false,
  emitCrossFilters: false,
  alignPositiveNegative: false,
  slice_id: 1,
};

describe('useColDefs', () => {
  it('reuses additional cell formatter results between style and renderer callbacks', () => {
    const additionalCellFormatter = jest.fn(() => ({
      className: 'matrix-cell-note',
      style: {
        color: '#d33',
      },
      tooltip: 'Raw value',
    }));
    const row = defaultProps.data[0];
    const { result } = renderHook(() =>
      useColDefs({
        ...defaultProps,
        additionalCellFormatter,
      } as any),
    );
    const colDef = result.current[0] as any;
    const params = {
      data: row,
      value: 'Default',
      valueFormatted: 'Default',
      rowIndex: 0,
      node: { id: '0' },
      colDef,
      api: {
        getAllGridColumns: () => [],
      },
      ...colDef.cellRendererParams,
    };

    expect(colDef.cellStyle(params)).toMatchObject({ color: '#d33' });
    expect(colDef.cellRenderer(params).props.title).toBe('Raw value');
    expect(additionalCellFormatter).toHaveBeenCalledTimes(1);
  });
});
