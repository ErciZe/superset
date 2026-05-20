import { GenericDataType } from '@superset-ui/core';
import {
  CROSSTAB_ROW_PATH,
  CROSSTAB_ROW_TYPE,
  CROSSTAB_TOTAL_COLUMN_ID,
  ERR_CROSSTAB_MIXED_GRAND_TOTAL_SEMANTICS,
  ERR_DUPLICATE_FIELD,
  ERR_REQUIRED_FIELDS,
  ERR_RESERVED_FIELD,
  buildCrosstab,
  encodeCrosstabRowPath,
} from '../../src/crosstab/engine';
import { ERR_COLUMN_LIMIT } from '../../src/crosstab/domain';
import { ERR_NON_NUMERIC_TOTAL } from '../../src/crosstab/totals';
import {
  ERR_CROSSTAB_MISSING_SQL_SUMMARY,
  buildSummaryResultMap,
} from '../../src/plugin/summaryResults';

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
      totalLabel: 'Grand sum',
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
      year: null,
      __crosstab_row_key: 'string:1:A',
      [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A']),
      [CROSSTAB_ROW_TYPE]: 'group',
      __crosstab_row_label: 'A',
      '__crosstab_col__string:4:Cash__metric__amount': 15,
      '__crosstab_col__string:4:Cash__metric__profit': 5,
      '__crosstab_col__string:6:Credit__metric__amount': 7,
      '__crosstab_col__string:6:Credit__metric__profit': 1,
      [CROSSTAB_TOTAL_COLUMN_ID]: 28,
    });
    expect(result.rowData[1]).toMatchObject({
      contract_type: 'A',
      year: '2026',
      __crosstab_row_key: 'string:1:A|string:4:2026',
      [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A', '2026']),
      [CROSSTAB_ROW_TYPE]: 'leaf',
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
        label: 'Grand sum',
        dataType: GenericDataType.Numeric,
        isMetric: true,
        isNumeric: true,
      }),
    ]);
    expect(result.columnTree).toEqual([
      expect.objectContaining({
        id: 'string:4:Cash',
        label: 'Cash',
        children: [
          expect.objectContaining({
            id: '__crosstab_col__string:4:Cash__metric__amount',
            label: 'amount',
            field: '__crosstab_col__string:4:Cash__metric__amount',
            metric: 'amount',
          }),
          expect.objectContaining({
            id: '__crosstab_col__string:4:Cash__metric__profit',
            label: 'profit',
            field: '__crosstab_col__string:4:Cash__metric__profit',
            metric: 'profit',
          }),
        ],
      }),
      expect.objectContaining({
        id: 'string:6:Credit',
        label: 'Credit',
      }),
    ]);
  });

  it('generates deterministic subtotal rows and one grand total row', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type', 'year'],
      columnFields: ['pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: true,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 2,
    });
    const subtotalRows = result.rowData.filter(
      row => row[CROSSTAB_ROW_TYPE] === 'subtotal',
    );
    const grandTotalRows = result.rowData.filter(
      row => row[CROSSTAB_ROW_TYPE] === 'grand_total',
    );

    expect(subtotalRows).toEqual([
      expect.objectContaining({
        contract_type: 'A',
        year: null,
        [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['A', 'Subtotal']),
        '__crosstab_col__string:4:Cash__metric__amount': 15,
        '__crosstab_col__string:6:Credit__metric__amount': 7,
        [CROSSTAB_TOTAL_COLUMN_ID]: 22,
      }),
      expect.objectContaining({
        contract_type: 'B',
        year: null,
        [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['B', 'Subtotal']),
        '__crosstab_col__string:4:Cash__metric__amount': 4,
        '__crosstab_col__string:6:Credit__metric__amount': null,
        [CROSSTAB_TOTAL_COLUMN_ID]: 4,
      }),
    ]);
    expect(grandTotalRows).toEqual([
      expect.objectContaining({
        [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['Grand total']),
        '__crosstab_col__string:4:Cash__metric__amount': 19,
        '__crosstab_col__string:6:Credit__metric__amount': 7,
        [CROSSTAB_TOTAL_COLUMN_ID]: 26,
      }),
    ]);
  });

  it('makes the additive multi-metric total baseline explicit', () => {
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
    const subtotalRow = result.rowData.find(
      row =>
        row[CROSSTAB_ROW_TYPE] === 'subtotal' &&
        row[CROSSTAB_ROW_PATH] === encodeCrosstabRowPath(['A', 'Subtotal']),
    );
    const grandTotalRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'grand_total',
    );

    expect(subtotalRow).toMatchObject({
      '__crosstab_col__string:4:Cash__metric__amount': 15,
      '__crosstab_col__string:4:Cash__metric__profit': 5,
      '__crosstab_col__string:6:Credit__metric__amount': 7,
      '__crosstab_col__string:6:Credit__metric__profit': 1,
      [CROSSTAB_TOTAL_COLUMN_ID]: 28,
    });
    expect(grandTotalRow).toMatchObject({
      '__crosstab_col__string:4:Cash__metric__amount': 19,
      '__crosstab_col__string:4:Cash__metric__profit': 6,
      '__crosstab_col__string:6:Credit__metric__amount': 7,
      '__crosstab_col__string:6:Credit__metric__profit': 1,
      [CROSSTAB_TOTAL_COLUMN_ID]: 33,
    });
  });

  it('uses injected SQL values for non-additive row and grand totals', () => {
    const rowTotal = buildSummaryResultMap({
      records: [{ metric_name_with_unit: '毛利率（%）', 指标值: -9.5145 }],
      rowFields: ['metric_name_with_unit'],
      columnFields: [],
      metricFields: ['指标值'],
    });
    const grandTotal = buildSummaryResultMap({
      records: [{ 指标值: -9.5145 }],
      rowFields: [],
      columnFields: [],
      metricFields: ['指标值'],
    });
    const columnTotal = buildSummaryResultMap({
      records: [
        { stat_date: '2026-05-01', 指标值: 12 },
        { stat_date: '2026-05-02', 指标值: -2.0255 },
      ],
      rowFields: [],
      columnFields: ['stat_date'],
      metricFields: ['指标值'],
    });
    const result = buildCrosstab(
      [
        {
          metric_name_with_unit: '毛利率（%）',
          stat_date: '2026-05-01',
          指标值: 12,
        },
        {
          metric_name_with_unit: '毛利率（%）',
          stat_date: '2026-05-02',
          指标值: -2.0255,
        },
      ],
      {
        rowFields: ['metric_name_with_unit'],
        columnFields: ['stat_date'],
        metricFields: ['指标值'],
        showRowSubtotals: false,
        showRowTotals: true,
        showColumnTotals: true,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 1,
        summaryValues: { rowTotal, columnTotal, grandTotal },
        resolveSemantic: ({ row }) =>
          row.metric_name_with_unit === '毛利率（%）' ? 'ratio' : 'unknown',
      },
    );
    const leafRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'leaf',
    );
    const grandTotalRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'grand_total',
    );

    expect(leafRow).toMatchObject({
      [CROSSTAB_TOTAL_COLUMN_ID]: -9.5145,
    });
    expect(grandTotalRow).toMatchObject({
      [CROSSTAB_TOTAL_COLUMN_ID]: -9.5145,
    });
  });

  it('uses SQL summaries for non-additive subtotal and column-total surfaces', () => {
    const rowTotal = buildSummaryResultMap({
      records: [
        {
          category: 'A',
          metric_name_with_unit: '毛利率（%）',
          rate: 15,
        },
      ],
      rowFields: ['category', 'metric_name_with_unit'],
      columnFields: [],
      metricFields: ['rate'],
    });
    const rowSubtotalCells = buildSummaryResultMap({
      records: [
        { category: 'A', stat_date: '2026-05-01', shop: 'S1', rate: 11 },
        { category: 'A', stat_date: '2026-05-01', shop: 'S2', rate: 22 },
      ],
      rowFields: ['category'],
      columnFields: ['stat_date', 'shop'],
      metricFields: ['rate'],
    });
    const rowSubtotalTotal = buildSummaryResultMap({
      records: [{ category: 'A', rate: 16 }],
      rowFields: ['category'],
      columnFields: [],
      metricFields: ['rate'],
    });
    const rowColumnSubtotalCells = buildSummaryResultMap({
      records: [{ category: 'A', stat_date: '2026-05-01', rate: 12 }],
      rowFields: ['category'],
      columnFields: ['stat_date'],
      metricFields: ['rate'],
    });
    const columnSubtotalCells = buildSummaryResultMap({
      records: [
        {
          category: 'A',
          metric_name_with_unit: '毛利率（%）',
          stat_date: '2026-05-01',
          rate: 13,
        },
      ],
      rowFields: ['category', 'metric_name_with_unit'],
      columnFields: ['stat_date'],
      metricFields: ['rate'],
    });
    const columnTotal = buildSummaryResultMap({
      records: [
        { stat_date: '2026-05-01', shop: 'S1', rate: 101 },
        { stat_date: '2026-05-01', shop: 'S2', rate: 202 },
      ],
      rowFields: [],
      columnFields: ['stat_date', 'shop'],
      metricFields: ['rate'],
    });
    const columnSubtotalTotal = buildSummaryResultMap({
      records: [{ stat_date: '2026-05-01', rate: 303 }],
      rowFields: [],
      columnFields: ['stat_date'],
      metricFields: ['rate'],
    });
    const grandTotal = buildSummaryResultMap({
      records: [{ rate: 999 }],
      rowFields: [],
      columnFields: [],
      metricFields: ['rate'],
    });
    const result = buildCrosstab(
      [
        {
          category: 'A',
          metric_name_with_unit: '毛利率（%）',
          stat_date: '2026-05-01',
          shop: 'S1',
          rate: 1,
        },
        {
          category: 'A',
          metric_name_with_unit: '毛利率（%）',
          stat_date: '2026-05-01',
          shop: 'S2',
          rate: 2,
        },
      ],
      {
        rowFields: ['category', 'metric_name_with_unit'],
        columnFields: ['stat_date', 'shop'],
        metricFields: ['rate'],
        showRowSubtotals: true,
        showRowTotals: true,
        showColumnTotals: true,
        showColumnSubtotals: true,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 2,
        summaryValues: {
          rowTotal,
          rowSubtotalCells,
          rowSubtotalTotal,
          rowColumnSubtotalCells,
          columnSubtotalCells,
          columnTotal,
          columnSubtotalTotal,
          grandTotal,
        },
        resolveSemantic: () => 'ratio',
      },
    );
    const groupRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'group',
    );
    const leafRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'leaf',
    );
    const subtotalRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'subtotal',
    );
    const grandTotalRow = result.rowData.find(
      row => row[CROSSTAB_ROW_TYPE] === 'grand_total',
    );

    expect(groupRow).toMatchObject({
      '__crosstab_col__string:10:2026-05-01|string:2:S1__metric__rate': 11,
      '__crosstab_col__string:10:2026-05-01|string:2:S2__metric__rate': 22,
      '__crosstab_col__string:10:2026-05-01__subtotal__rate': 12,
      [CROSSTAB_TOTAL_COLUMN_ID]: 16,
    });
    expect(leafRow).toMatchObject({
      '__crosstab_col__string:10:2026-05-01__subtotal__rate': 13,
    });
    expect(subtotalRow).toMatchObject({
      '__crosstab_col__string:10:2026-05-01__subtotal__rate': 12,
      [CROSSTAB_TOTAL_COLUMN_ID]: 16,
    });
    expect(grandTotalRow).toMatchObject({
      '__crosstab_col__string:10:2026-05-01|string:2:S1__metric__rate': 101,
      '__crosstab_col__string:10:2026-05-01|string:2:S2__metric__rate': 202,
      '__crosstab_col__string:10:2026-05-01__subtotal__rate': 303,
      [CROSSTAB_TOTAL_COLUMN_ID]: 999,
    });
  });

  it('fails fast when a SQL row total map is missing', () => {
    const grandTotal = buildSummaryResultMap({
      records: [{ 指标值: -9.5145 }],
      rowFields: [],
      columnFields: [],
      metricFields: ['指标值'],
    });

    expect(() =>
      buildCrosstab(
        [
          {
            metric_name_with_unit: '毛利率（%）',
            stat_date: '2026-05-01',
            指标值: 12,
          },
        ],
        {
          rowFields: ['metric_name_with_unit'],
          columnFields: ['stat_date'],
          metricFields: ['指标值'],
          showRowSubtotals: false,
          showRowTotals: false,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
          summaryValues: { grandTotal },
          resolveSemantic: ({ row }) =>
            row.metric_name_with_unit === '毛利率（%）' ? 'ratio' : 'unknown',
        },
      ),
    ).toThrow(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  });

  it('fails fast when a SQL grand total map is missing', () => {
    const rowTotal = buildSummaryResultMap({
      records: [{ metric_name_with_unit: '毛利率（%）', 指标值: -9.5145 }],
      rowFields: ['metric_name_with_unit'],
      columnFields: [],
      metricFields: ['指标值'],
    });

    expect(() =>
      buildCrosstab(
        [
          {
            metric_name_with_unit: '毛利率（%）',
            stat_date: '2026-05-01',
            指标值: 12,
          },
        ],
        {
          rowFields: ['metric_name_with_unit'],
          columnFields: ['stat_date'],
          metricFields: ['指标值'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
          summaryValues: { rowTotal },
          resolveSemantic: ({ row }) =>
            row.metric_name_with_unit === '毛利率（%）' ? 'ratio' : 'unknown',
        },
      ),
    ).toThrow(ERR_CROSSTAB_MISSING_SQL_SUMMARY);
  });

  it('fails fast for mixed grand total semantics', () => {
    const rowTotal = buildSummaryResultMap({
      records: [{ metric_name_with_unit: '毛利率（%）', 指标值: -9.5145 }],
      rowFields: ['metric_name_with_unit'],
      columnFields: [],
      metricFields: ['指标值'],
    });
    const grandTotal = buildSummaryResultMap({
      records: [{ 指标值: -9.5145 }],
      rowFields: [],
      columnFields: [],
      metricFields: ['指标值'],
    });

    expect(() =>
      buildCrosstab(
        [
          {
            metric_name_with_unit: '毛利率（%）',
            stat_date: '2026-05-01',
            指标值: 12,
          },
          {
            metric_name_with_unit: '销售额',
            stat_date: '2026-05-01',
            指标值: 100,
          },
        ],
        {
          rowFields: ['metric_name_with_unit'],
          columnFields: ['stat_date'],
          metricFields: ['指标值'],
          showRowSubtotals: false,
          showRowTotals: true,
          showColumnTotals: true,
          showColumnSubtotals: false,
          maxGeneratedColumns: 20,
          defaultRowExpandedDepth: 1,
          summaryValues: { rowTotal, grandTotal },
          resolveSemantic: ({ row }) =>
            row.metric_name_with_unit === '毛利率（%）' ? 'ratio' : 'additive',
        },
      ),
    ).toThrow(ERR_CROSSTAB_MIXED_GRAND_TOTAL_SEMANTICS);
  });

  it('honors configured row subtotal depths', () => {
    const result = buildCrosstab(
      [
        {
          country: 'US',
          shop: 'A',
          sku: 'S1',
          channel: 'Online',
          amount: 10,
        },
        {
          country: 'US',
          shop: 'A',
          sku: 'S2',
          channel: 'Online',
          amount: 5,
        },
      ],
      {
        rowFields: ['country', 'shop', 'sku'],
        columnFields: ['channel'],
        metricFields: ['amount'],
        showRowSubtotals: true,
        rowSubtotalDepths: [2],
        showRowTotals: false,
        showColumnTotals: true,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 2,
      },
    );
    const subtotalRows = result.rowData.filter(
      row => row[CROSSTAB_ROW_TYPE] === 'subtotal',
    );

    expect(subtotalRows).toEqual([
      expect.objectContaining({
        country: 'US',
        shop: 'A',
        sku: null,
        [CROSSTAB_ROW_PATH]: encodeCrosstabRowPath(['US', 'A', 'Subtotal']),
        '__crosstab_col__string:6:Online__metric__amount': 15,
        [CROSSTAB_TOTAL_COLUMN_ID]: 15,
      }),
    ]);
  });

  it('removes subtotal and grand total rows when disabled', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type', 'year'],
      columnFields: ['pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: false,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 2,
    });

    expect(
      result.rowData.some(
        row =>
          row[CROSSTAB_ROW_TYPE] === 'subtotal' ||
          row[CROSSTAB_ROW_TYPE] === 'grand_total',
      ),
    ).toBe(false);
  });

  it('adds stable column subtotal nodes only when enabled', () => {
    const disabled = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['year', 'pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: false,
      showColumnTotals: false,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });
    const enabled = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['year', 'pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: false,
      showColumnTotals: false,
      showColumnSubtotals: true,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });

    expect(JSON.stringify(disabled.columnTree)).not.toContain('__subtotal');
    expect(enabled.columnTree).toEqual([
      expect.objectContaining({
        id: 'string:4:2026',
        children: expect.arrayContaining([
          expect.objectContaining({
            id: 'string:4:2026__subtotal',
            label: 'Subtotal',
            field: '__crosstab_col__string:4:2026__subtotal__amount',
          }),
        ]),
      }),
    ]);
    expect(enabled.rowData[0]).toMatchObject({
      '__crosstab_col__string:4:2026__subtotal__amount': 22,
    });
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

  it('builds nested column tree nodes for multiple column dimensions', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['year', 'pay_type'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: true,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });

    expect(result.columnTree).toEqual([
      expect.objectContaining({
        id: 'string:4:2026',
        label: '2026',
        children: [
          expect.objectContaining({
            id: 'string:4:2026|string:4:Cash',
            label: 'Cash',
            field:
              '__crosstab_col__string:4:2026|string:4:Cash__metric__amount',
            metric: 'amount',
          }),
          expect.objectContaining({
            id: 'string:4:2026|string:6:Credit',
            label: 'Credit',
          }),
        ],
      }),
    ]);
  });

  it('uses field labels for row and metric display headers', () => {
    const result = buildCrosstab(records, {
      rowFields: ['contract_type'],
      columnFields: ['pay_type'],
      metricFields: ['amount', 'profit'],
      fieldLabels: {
        contract_type: 'Contract type',
        amount: 'Amount',
        profit: 'Profit',
      },
      showRowSubtotals: false,
      showRowTotals: false,
      showColumnTotals: false,
      showColumnSubtotals: false,
      maxGeneratedColumns: 20,
      defaultRowExpandedDepth: 1,
    });

    expect(result.columns[0]).toEqual(
      expect.objectContaining({
        key: 'contract_type',
        label: 'Contract type',
      }),
    );
    expect(result.columnTree[0].children).toEqual([
      expect.objectContaining({ label: 'Amount' }),
      expect.objectContaining({ label: 'Profit' }),
    ]);
  });

  it('formats date-like column headers instead of exposing timestamps', () => {
    const result = buildCrosstab(
      [{ metric_name: '利润', biz_date: 1736812800000, amount: 10 }],
      {
        rowFields: ['metric_name'],
        columnFields: ['biz_date'],
        metricFields: ['amount'],
        showRowSubtotals: false,
        showRowTotals: false,
        showColumnTotals: false,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 1,
      },
    );

    expect(result.columnTree).toEqual([
      expect.objectContaining({
        label: '2025-01-14',
        field: '__crosstab_col__number:13:1736812800000__metric__amount',
      }),
    ]);
  });

  it('fails for missing required fields and non-numeric totals', () => {
    expect(() =>
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
    ).toThrow(ERR_REQUIRED_FIELDS);

    expect(() =>
      buildCrosstab([{ contract_type: 'A', pay_type: 'Cash', amount: 'bad' }], {
        rowFields: ['contract_type'],
        columnFields: ['pay_type'],
        metricFields: ['amount'],
        showRowSubtotals: false,
        showRowTotals: true,
        showColumnTotals: true,
        showColumnSubtotals: false,
        maxGeneratedColumns: 20,
        defaultRowExpandedDepth: 1,
      }),
    ).toThrow(ERR_NON_NUMERIC_TOTAL);
  });

  it('fails for non-finite metric values', () => {
    expect(() =>
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
    ).toThrow(ERR_NON_NUMERIC_TOTAL);
  });

  it('counts metric fan-out against the generated column limit', () => {
    expect(() =>
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
    ).toThrow(ERR_COLUMN_LIMIT(4, 3));
  });

  it('keeps generated columns over the visible page size when under the configured limit', () => {
    const wideRecords = Array.from({ length: 101 }, (_, index) => ({
      metric_name: '指标项',
      biz_date: '2026-05-01',
      shop_name: 'Shop A',
      country: `Country ${index + 1}`,
      amount: index + 1,
    }));
    const result = buildCrosstab(wideRecords, {
      rowFields: ['metric_name'],
      columnFields: ['biz_date', 'shop_name', 'country'],
      metricFields: ['amount'],
      showRowSubtotals: false,
      showRowTotals: false,
      showColumnTotals: true,
      showColumnSubtotals: false,
      maxGeneratedColumns: 200,
      defaultRowExpandedDepth: 1,
    });

    expect(result.generatedColumnIds).toHaveLength(101);
    expect(result.columnTree).toEqual([
      expect.objectContaining({
        label: '2026-05-01',
        children: [
          expect.objectContaining({
            label: 'Shop A',
            children: expect.arrayContaining([
              expect.objectContaining({ label: 'Country 1' }),
              expect.objectContaining({ label: 'Country 101' }),
            ]),
          }),
        ],
      }),
    ]);
  });

  it('fails fast for invalid options and reserved generated field names', () => {
    expect(() =>
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
    ).toThrow(ERR_COLUMN_LIMIT(1, Number.NaN));

    expect(() =>
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
    ).toThrow(ERR_DUPLICATE_FIELD);

    expect(() =>
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
    ).toThrow(ERR_RESERVED_FIELD);

    expect(() =>
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
    ).toThrow(ERR_RESERVED_FIELD);
  });
});
