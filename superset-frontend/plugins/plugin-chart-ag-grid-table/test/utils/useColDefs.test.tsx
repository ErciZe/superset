import { GenericDataType } from '@superset-ui/core';
import { renderHook } from '@testing-library/react-hooks';
import { useColDefs } from '../../src/utils/useColDefs';

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
