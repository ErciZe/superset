import { GenericDataType } from '@superset-ui/core';
import { render, screen } from '@superset-ui/core/spec';
import { TextCellRenderer } from '../../../src/table/renderers/TextCellRenderer';
import { NumericCellRenderer } from '../../../src/table/renderers/NumericCellRenderer';

jest.mock('../../../src/table/utils/useTableTheme', () => ({
  useIsDark: () => false,
}));

const column = {
  key: 'value',
  label: 'Value',
  dataType: GenericDataType.String,
  isNumeric: false,
  isMetric: false,
  isPercentMetric: false,
  config: {},
};

const baseParams = {
  value: 'Default',
  valueFormatted: 'Default',
  node: {},
  api: {
    getAllGridColumns: () => [],
  },
  colDef: { field: 'value' },
  columns: [column],
  allowRenderHtml: true,
  col: column,
  hasBasicColorFormatters: false,
  basicColorFormatters: [],
  valueRange: null,
  alignPositiveNegative: false,
  colorPositiveNegative: false,
};

describe('cell formatter renderers', () => {
  it('applies formatter class and tooltip without replacing text cells', () => {
    render(
      <TextCellRenderer
        {...(baseParams as any)}
        additionalCellFormatter={() => ({
          className: 'matrix-cell-note',
          tooltip: 'Raw value',
        })}
      />,
    );

    const cell = screen.getByText('Default');
    expect(cell).toHaveClass('matrix-cell-note');
    expect(cell).toHaveAttribute('title', 'Raw value');
  });

  it('applies formatter class and tooltip without replacing numeric cells', () => {
    render(
      <NumericCellRenderer
        {...(baseParams as any)}
        value={42}
        valueFormatted="42"
        col={{
          ...column,
          dataType: GenericDataType.Numeric,
          isNumeric: true,
        }}
        additionalCellFormatter={() => ({
          className: 'matrix-cell-note',
          tooltip: 'Raw value',
        })}
      />,
    );

    const cell = screen.getByText('42').parentElement as HTMLElement;
    expect(cell).toHaveClass('matrix-cell-note');
    expect(cell).toHaveAttribute('title', 'Raw value');
  });
});
