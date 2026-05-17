import { Comparator } from '@superset-ui/chart-controls';
import { GenericDataType } from '@superset-ui/core';
import officialTransformProps from '../../plugin-chart-ag-grid-table/src/transformProps';
import transformProps from '../src/transformProps';

jest.mock('../../plugin-chart-ag-grid-table/src/transformProps', () =>
  jest.fn(),
);

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

  it('keeps official props unchanged when matrix mode is disabled', () => {
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

  it('keeps official props while matrix mode configuration is incomplete', () => {
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

  it('builds matrix cell coloring from chart-level threshold rules', () => {
    const result = transformProps({
      rawFormData: {
        query_mode: 'aggregate',
        matrix_mode_enabled: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
        matrix_unit_field: 'unit',
        matrix_show_total: false,
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
      ],
      hooks: {},
      filterState: { filters: {} },
      theme: {},
    } as any);

    expect(result.columnColorFormatters).toEqual([]);
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

  it('passes a safe matrix cell formatter to the base AG Grid chart', () => {
    const result = transformProps({
      rawFormData: {
        query_mode: 'aggregate',
        matrix_mode_enabled: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
        matrix_show_total: false,
        matrix_cell_formatter_expression:
          'row.metric_name === "Sales" ? { text: "¥" + rawValue } : { text: value }',
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
