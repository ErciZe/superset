import { GenericDataType } from '@superset-ui/core';
import {
  CROSSTAB_TOTAL_COLUMN_ID,
  ERR_DUPLICATE_FIELD,
  ERR_REQUIRED_FIELDS,
  ERR_RESERVED_FIELD,
  buildCrosstab,
} from '../../src/crosstab/engine';
import { ERR_COLUMN_LIMIT } from '../../src/crosstab/domain';
import { ERR_NON_NUMERIC_TOTAL } from '../../src/crosstab/totals';

function expectErrorMessage(callback: () => unknown, message: string) {
  try {
    callback();
    throw new Error('Expected callback to throw');
  } catch (error) {
    expect((error as Error).message).toBe(message);
  }
}

const records = [
  { contract_type: 'A', year: '2026', pay_type: 'Cash', amount: 10, profit: 3 },
  { contract_type: 'A', year: '2026', pay_type: 'Cash', amount: 5, profit: 2 },
  {
    contract_type: 'A',
    year: '2026',
    pay_type: 'Credit',
    amount: 7,
    profit: 1,
  },
  { contract_type: 'B', year: '2026', pay_type: 'Cash', amount: 4, profit: 1 },
];

describe('buildCrosstab', () => {
  it('generates row hierarchy, complete column tuples, and metric leaves', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type', 'year'],
      columnFields: ['pay_type'],
      metricFields: ['amount', 'profit'],
      showRowSubtotals: true,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 2,
    });

    expect(result.generatedColumnIds).toEqual([
      '__crosstab_col__string:4:Cash__metric__amount',
      '__crosstab_col__string:4:Cash__metric__profit',
      '__crosstab_col__string:6:Credit__metric__amount',
      '__crosstab_col__string:6:Credit__metric__profit',
    ]);
    expect(result.rowData[0]).toMatchObject({
      contract_type: 'A',
      year: '2026',
      __crosstab_row_key: 'string:1:A|string:4:2026',
      __crosstab_row_label: '2026',
      '__crosstab_col__string:4:Cash__metric__amount': 15,
      '__crosstab_col__string:4:Cash__metric__profit': 5,
      '__crosstab_col__string:6:Credit__metric__amount': 7,
      '__crosstab_col__string:6:Credit__metric__profit': 1,
      [CROSSTAB_TOTAL_COLUMN_ID]: 28,
    });
    expect(result.columns).toEqual([
      expect.objectContaining({
        key: 'contract_type',
        label: 'contract_type',
        dataType: GenericDataType.String,
        isMetric: false,
      }),
      expect.objectContaining({
        key: 'year',
        label: 'year',
        dataType: GenericDataType.String,
        isMetric: false,
      }),
      expect.objectContaining({
        key: '__crosstab_col__string:4:Cash__metric__amount',
        label: '__crosstab_col__string:4:Cash__metric__amount',
        dataType: GenericDataType.Numeric,
        isMetric: true,
        isNumeric: true,
      }),
      expect.objectContaining({
        key: '__crosstab_col__string:4:Cash__metric__profit',
        label: '__crosstab_col__string:4:Cash__metric__profit',
        dataType: GenericDataType.Numeric,
        isMetric: true,
        isNumeric: true,
      }),
      expect.objectContaining({
        key: '__crosstab_col__string:6:Credit__metric__amount',
        label: '__crosstab_col__string:6:Credit__metric__amount',
        dataType: GenericDataType.Numeric,
        isMetric: true,
        isNumeric: true,
      }),
      expect.objectContaining({
        key: '__crosstab_col__string:6:Credit__metric__profit',
        label: '__crosstab_col__string:6:Credit__metric__profit',
        dataType: GenericDataType.Numeric,
        isMetric: true,
        isNumeric: true,
      }),
      expect.objectContaining({
        key: CROSSTAB_TOTAL_COLUMN_ID,
        label: 'Total',
        dataType: GenericDataType.Numeric,
        isMetric: true,
        isNumeric: true,
      }),
    ]);
    expect(result.columnTree).toEqual([]);
  });

  it('keeps missing generated cells blank and excludes blanks from totals', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });

    expect(result.rowData[1]).toMatchObject({
      contract_type: 'B',
      '__crosstab_col__string:4:Cash__metric__amount': 4,
      '__crosstab_col__string:6:Credit__metric__amount': null,
      [CROSSTAB_TOTAL_COLUMN_ID]: 4,
    });
  });

  it('omits total columns when column totals are disabled', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: true,
      showColumnTotals: false,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });

    expect(result.rowData[0]).not.toHaveProperty(CROSSTAB_TOTAL_COLUMN_ID);
    expect(result.columns.map(column => column.key)).not.toContain(
      CROSSTAB_TOTAL_COLUMN_ID,
    );
  });

  it('fails for missing required fields and non-numeric totals', () => {
    expectErrorMessage(
      () =>
        buildCrosstab(records, {
          rowFields: [],
          columnFields: ['pay_type'],
          metricFields: ['amount'],
          showRowSubtotals: true,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
        }),
      ERR_REQUIRED_FIELDS,
    );

    expectErrorMessage(
      () =>
        buildCrosstab(
          [{ contract_type: 'A', pay_type: 'Cash', amount: 'bad' }],
          {
            rowFields: ['contract_type'],
            columnFields: ['pay_type'],
            metricFields: ['amount'],
            showRowSubtotals: false,
            showRowTotals: true,
            showColumnTotals: true,
            showColumnSubtotals: false,
            maxGeneratedColumns: 20,
            defaultRowExpandedDepth: 1,
          },
        ),
      ERR_NON_NUMERIC_TOTAL,
    );
  });

  it('fails for non-finite metric values', () => {
    expectErrorMessage(
      () =>
        buildCrosstab(
          [{ contract_type: 'A', pay_type: 'Cash', amount: Infinity }],
          {
            rowFields: ['contract_type'],
            columnFields: ['pay_type'],
            metricFields: ['amount'],
            showRowSubtotals: false,
            showRowTotals: true,
            showColumnTotals: true,
            showColumnSubtotals: false,
            maxGeneratedColumns: 20,
            defaultRowExpandedDepth: 1,
          },
        ),
      ERR_NON_NUMERIC_TOTAL,
    );
  });

  it('counts metric fan-out against the generated column limit', () => {
    expectErrorMessage(
      () =>
        buildCrosstab(records, {
          rowFields: ['contract_type'],
          columnFields: ['pay_type'],
          metricFields: ['amount', 'profit'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 3,
          defaultRowExpandedDepth: 1,
        }),
      ERR_COLUMN_LIMIT(4, 3),
    );
  });

  it('fails fast for invalid options and reserved generated field names', () => {
    expectErrorMessage(
      () =>
        buildCrosstab(records, {
          rowFields: ['contract_type'],
          columnFields: ['pay_type'],
          metricFields: ['amount'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: Number.NaN,
          defaultRowExpandedDepth: 1,
        }),
      ERR_COLUMN_LIMIT(1, Number.NaN),
    );

    expectErrorMessage(
      () =>
        buildCrosstab(records, {
          rowFields: ['contract_type', 'contract_type'],
          columnFields: ['pay_type'],
          metricFields: ['amount'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
        }),
      ERR_DUPLICATE_FIELD,
    );

    expectErrorMessage(
      () =>
        buildCrosstab(records, {
          rowFields: ['__crosstab_row_key'],
          columnFields: ['pay_type'],
          metricFields: ['amount'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
        }),
      ERR_RESERVED_FIELD,
    );

    expectErrorMessage(
      () =>
        buildCrosstab(records, {
          rowFields: ['__crosstab_col__string:4:Cash__metric__amount'],
          columnFields: ['pay_type'],
          metricFields: ['amount'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
        }),
      ERR_RESERVED_FIELD,
    );
  });
});
