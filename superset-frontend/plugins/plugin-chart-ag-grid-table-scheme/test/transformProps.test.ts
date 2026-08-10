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
import { Comparator } from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/common';
import officialTransformProps from '../src/table/transformProps';
import transformProps from '../src/transformProps';

jest.mock('../src/table/transformProps', () => jest.fn());

const mockedOfficialTransformProps = officialTransformProps as jest.Mock;

describe('ag grid table scheme transformProps', () => {
  beforeEach(() => {
    mockedOfficialTransformProps.mockReset();
    mockedOfficialTransformProps.mockReturnValue({
      height: 400,
      width: 600,
      data: [],
      columns: [
        {
          key: 'metric_name',
          label: 'Metric',
          dataType: GenericDataType.String,
          config: {},
        },
        {
          key: 'biz_date',
          label: 'Date',
          dataType: GenericDataType.String,
          config: {},
        },
        {
          key: 'value',
          label: 'Value',
          dataType: GenericDataType.Numeric,
          formatter: (value: number) => value.toFixed(2),
          config: {},
        },
        {
          key: 'unit',
          label: 'Unit',
          dataType: GenericDataType.String,
          config: {},
        },
      ],
      serverPagination: false,
      columnColorFormatters: [{ column: 'value' }],
    });
  });

  test('keeps official props unchanged when matrix mode is disabled', () => {
    const result = transformProps({
      rawFormData: {
        matrix_mode_enabled: false,
      },
      queriesData: [],
      hooks: {},
      filterState: { filters: {} },
    } as any);

    expect(result.columnColorFormatters).toEqual([{ column: 'value' }]);
    expect(result.additionalCellStyle).toBeUndefined();
  });

  test('keeps official props while matrix mode configuration is incomplete', () => {
    const result = transformProps({
      rawFormData: {
        query_mode: 'aggregate',
        matrix_mode_enabled: true,
        matrix_rows: [],
        matrix_columns: [],
        matrix_value: null,
      },
      queriesData: [
        {
          data: [
            {
              metric_name: 'Sales',
              biz_date: '2026-05-01',
              value: 15,
            },
          ],
        },
      ],
      hooks: {},
      filterState: { filters: {} },
    } as any);

    expect(result.columnColorFormatters).toEqual([{ column: 'value' }]);
    expect(result.additionalCellStyle).toBeUndefined();
    expect((result as any).metrics).toBeUndefined();
  });

  test('builds matrix cell coloring from chart-level threshold rules', () => {
    const result = transformProps({
      rawFormData: {
        query_mode: 'aggregate',
        matrix_mode_enabled: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
        matrix_unit_field: 'unit',
        matrix_show_total: true,
        matrix_cell_color_rules: [
          {
            column: 'matrix_value_cells',
            operator: Comparator.GreaterOrEqual,
            targetValue: 10,
            colorScheme: '#00aa00',
          },
        ],
      },
      queriesData: [
        {
          data: [
            {
              metric_name: 'Sales',
              biz_date: '2026-05-01',
              value: 15,
              unit: '件',
            },
          ],
        },
        {
          data: [
            {
              metric_name: 'Sales',
              value: 15,
              unit: '件',
            },
          ],
        },
      ],
      hooks: {},
      filterState: { filters: {} },
      theme: {},
    } as any);

    expect(result.columnColorFormatters).toEqual([]);
    expect(
      result.additionalCellStyle?.({
        colDef: { field: '__matrix_total' },
        value: '15.00',
        data: result.data[0],
      } as any),
    ).toEqual({
      backgroundColor: '#00aa00',
    });
    expect(
      result.additionalCellStyle?.({
        colDef: { field: '__matrix_col__2026-05-01' },
        value: '15.00',
        data: result.data[0],
      } as any),
    ).toEqual({
      backgroundColor: '#00aa00',
    });
  });

  test('passes a matrix cell callback formatter to the base AG Grid chart', () => {
    const result = transformProps({
      rawFormData: {
        query_mode: 'aggregate',
        matrix_mode_enabled: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
        matrix_show_total: false,
        matrix_cell_formatter_expression:
          '({ row, rawValue, value }) => row.metric_name === "Sales" ? { text: "¥" + rawValue } : { text: value }',
      },
      queriesData: [
        {
          data: [
            {
              metric_name: 'Sales',
              biz_date: '2026-05-01',
              value: 15,
            },
          ],
        },
      ],
      hooks: {},
      filterState: { filters: {} },
      theme: {},
    } as any);

    expect(
      result.additionalCellFormatter?.({
        colDef: { field: '__matrix_col__2026-05-01' },
        value: '15.00',
        data: result.data[0],
      } as any),
    ).toEqual({
      text: '¥15',
    });
  });
});
