import { Comparator } from '@superset-ui/chart-controls';
import {
  getMatrixCellColorFormatters,
  MATRIX_CELL_COLOR_RULE_COLUMN,
} from '../../src/matrix/cellColorRules';
import { getMatrixRawValueField } from '../../src/matrix/matrixTransform';

describe('matrix cell color rules', () => {
  const columnId = '__matrix_col__2026-05-01';
  const rawValueField = getMatrixRawValueField(columnId);

  it('matches numeric threshold rules against raw matrix values', () => {
    const [formatter] = getMatrixCellColorFormatters({
      rules: [
        {
          column: MATRIX_CELL_COLOR_RULE_COLUMN,
          operator: Comparator.GreaterOrEqual,
          targetValue: 10,
          colorScheme: '#00aa00',
        },
      ],
      generatedColumnIds: [columnId],
      data: [
        { [rawValueField]: 9 },
        { [rawValueField]: 10 },
        { [rawValueField]: 20 },
      ],
    });

    expect(
      formatter.getColorFromValue(9, { data: { [rawValueField]: 9 } }),
    ).toBeUndefined();
    expect(
      formatter.getColorFromValue(10, { data: { [rawValueField]: 10 } }),
    ).toBe('#00aa00');
    expect(
      formatter.getColorFromValue(20, { data: { [rawValueField]: 20 } }),
    ).toBe('#00aa00');
  });

  it('does not match null, empty, or non-numeric values', () => {
    const [formatter] = getMatrixCellColorFormatters({
      rules: [
        {
          column: MATRIX_CELL_COLOR_RULE_COLUMN,
          operator: Comparator.LessThan,
          targetValue: 10,
          colorScheme: '#cc0000',
        },
      ],
      generatedColumnIds: [columnId],
      data: [
        { [rawValueField]: null },
        { [rawValueField]: '' },
        { [rawValueField]: '9' },
      ],
    });

    expect(
      formatter.getColorFromValue(null, { data: { [rawValueField]: null } }),
    ).toBeUndefined();
    expect(
      formatter.getColorFromValue('', { data: { [rawValueField]: '' } }),
    ).toBeUndefined();
    expect(
      formatter.getColorFromValue('9', { data: { [rawValueField]: '9' } }),
    ).toBeUndefined();
  });

  it('supports interval rules and lets later rules override earlier matches', () => {
    const [formatter] = getMatrixCellColorFormatters({
      rules: [
        {
          column: MATRIX_CELL_COLOR_RULE_COLUMN,
          operator: Comparator.BetweenOrEqual,
          targetValueLeft: 10,
          targetValueRight: 20,
          colorScheme: '#ffff00',
        },
        {
          column: MATRIX_CELL_COLOR_RULE_COLUMN,
          operator: Comparator.GreaterThan,
          targetValue: 15,
          colorScheme: '#ff0000',
        },
      ],
      generatedColumnIds: [columnId],
      data: [{ [rawValueField]: 12 }, { [rawValueField]: 18 }],
    });

    expect(
      formatter.getColorFromValue(12, { data: { [rawValueField]: 12 } }),
    ).toBe('#ffff00');
    expect(
      formatter.getColorFromValue(18, { data: { [rawValueField]: 18 } }),
    ).toBe('#ff0000');
  });

  it('only creates formatters for generated matrix value columns', () => {
    const formatters = getMatrixCellColorFormatters({
      rules: [
        {
          column: MATRIX_CELL_COLOR_RULE_COLUMN,
          operator: Comparator.GreaterThan,
          targetValue: 0,
          colorScheme: '#00aa00',
        },
      ],
      generatedColumnIds: [columnId],
      data: [{ [rawValueField]: 1 }],
    });

    expect(formatters.map(formatter => formatter.column)).toEqual([columnId]);
  });
});
