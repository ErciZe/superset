import getCellStyle from '../../../src/table/utils/getCellStyle';

describe('getCellStyle', () => {
  it('merges additional cell styles with existing alignment', () => {
    const style = getCellStyle({
      value: 15,
      colDef: { field: 'value' },
      rowIndex: 0,
      hasColumnColorFormatters: false,
      columnColorFormatters: [],
      hasBasicColorFormatters: false,
      col: {
        key: 'value',
        label: 'Value',
        isNumeric: true,
        config: {},
      },
      node: {},
      additionalCellStyle: () => ({
        backgroundColor: '#00aa00',
      }),
    } as any);

    expect(style).toEqual({
      backgroundColor: '#00aa00',
      textAlign: 'right',
    });
  });

  it('merges additional formatter styles after color styles', () => {
    const style = getCellStyle({
      value: 15,
      colDef: { field: 'value' },
      rowIndex: 0,
      hasColumnColorFormatters: false,
      columnColorFormatters: [],
      hasBasicColorFormatters: false,
      col: {
        key: 'value',
        label: 'Value',
        isNumeric: true,
        config: {},
      },
      node: {},
      additionalCellStyle: () => ({
        backgroundColor: '#00aa00',
      }),
      additionalCellFormatter: () => ({
        style: {
          backgroundColor: '#aa0000',
          color: '#ffffff',
        },
      }),
    } as any);

    expect(style).toEqual({
      backgroundColor: '#aa0000',
      color: '#ffffff',
      textAlign: 'right',
    });
  });
});
