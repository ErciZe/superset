import {
  MATRIX_TOTAL_COL_ID,
  matrixTransform,
} from '../../src/matrix/matrixTransform';

const records = [
  {
    metric_name: 'Sales',
    metric_order: 2,
    biz_date: '2026-05-01',
    value: 10,
    unit: '件',
  },
  {
    metric_name: 'Sales',
    metric_order: 2,
    biz_date: '2026-05-01',
    value: 5,
    unit: '件',
  },
  {
    metric_name: 'Sales',
    metric_order: 2,
    biz_date: '2026-05-02',
    value: 15,
    unit: '件',
  },
  {
    metric_name: 'Profit %',
    metric_order: 1,
    biz_date: '2026-05-01',
    value: 9.79,
    unit: '%',
  },
  {
    metric_name: 'Profit %',
    metric_order: 1,
    biz_date: '2026-05-02',
    value: null,
    unit: '%',
  },
];

const getRow = (
  data: ReturnType<typeof matrixTransform>['data'],
  metricName: string,
) => {
  const row = data.find(item => item.metric_name === metricName);
  if (!row) {
    throw new Error(`Missing matrix row ${metricName}`);
  }
  return row;
};

describe('matrixTransform', () => {
  it('converts long records to wide matrix rows with left total', () => {
    const result = matrixTransform(records, {
      rows: ['metric_name'],
      columns: ['biz_date'],
      value: 'value',
      rowSort: 'metric_order',
      rowSortDesc: false,
      unitField: 'unit',
      showTotal: true,
      totalPosition: 'left',
      calculation: 'raw',
      maxGeneratedColumns: 10,
    });

    expect(result.generatedColumnIds).toEqual([
      '__matrix_col__2026-05-01',
      '__matrix_col__2026-05-02',
    ]);
    expect(result.columns.map(column => column.key)).toEqual([
      'metric_name',
      MATRIX_TOTAL_COL_ID,
      '__matrix_col__2026-05-01',
      '__matrix_col__2026-05-02',
    ]);
    expect(result.data).toEqual([
      {
        metric_name: 'Profit %',
        [MATRIX_TOTAL_COL_ID]: '9.79%',
        '__matrix_col__2026-05-01': '9.79%',
        '__matrix_col__2026-05-02': null,
      },
      {
        metric_name: 'Sales',
        [MATRIX_TOTAL_COL_ID]: '30 件',
        '__matrix_col__2026-05-01': '15 件',
        '__matrix_col__2026-05-02': '15 件',
      },
    ]);
  });

  it('supports contribution, row contribution, and dense row rank', () => {
    const base = {
      rows: ['metric_name'],
      columns: ['biz_date'],
      value: 'value',
      showTotal: false,
      totalPosition: 'right' as const,
      maxGeneratedColumns: 10,
    };

    const contributionData = matrixTransform(records, {
      ...base,
      calculation: 'contribution',
    }).data;
    const salesContributionRow = getRow(contributionData, 'Sales');
    expect(salesContributionRow['__matrix_col__2026-05-01']).toBeCloseTo(
      15 / 39.79,
    );
    expect(salesContributionRow['__matrix_col__2026-05-02']).toBeCloseTo(
      15 / 39.79,
    );
    const rowContributionData = matrixTransform(records, {
      ...base,
      calculation: 'row_contribution',
    }).data;
    const rowContributionRow = getRow(rowContributionData, 'Sales');
    expect(rowContributionRow).toMatchObject({
      '__matrix_col__2026-05-01': 0.5,
      '__matrix_col__2026-05-02': 0.5,
    });

    const rowRankData = matrixTransform(records, {
      ...base,
      calculation: 'row_rank',
    }).data;
    const rowRankRow = getRow(rowRankData, 'Sales');
    expect(rowRankRow).toMatchObject({
      '__matrix_col__2026-05-01': 1,
      '__matrix_col__2026-05-02': 1,
    });
  });

  it('uses non-colliding generated IDs for multi-column dimensions', () => {
    const result = matrixTransform(
      [
        { metric_name: 'Sales', first: 'a', second: 'b__c', value: 1 },
        { metric_name: 'Sales', first: 'a__b', second: 'c', value: 2 },
      ],
      {
        rows: ['metric_name'],
        columns: ['first', 'second'],
        value: 'value',
        showTotal: false,
        totalPosition: 'right',
        calculation: 'raw',
        maxGeneratedColumns: 10,
      },
    );

    expect(result.generatedColumnIds).toHaveLength(2);
    expect(new Set(result.generatedColumnIds).size).toBe(2);
    expect(result.generatedColumnIds).toEqual([
      '__matrix_col__s1:as4:b__c',
      '__matrix_col__s4:a__bs1:c',
    ]);
    expect(result.data[0]).toMatchObject({
      '__matrix_col__s1:as4:b__c': '1',
      '__matrix_col__s4:a__bs1:c': '2',
    });
  });

  it('distinguishes typed null and numeric column dimension values', () => {
    const result = matrixTransform(
      [
        { metric_name: 'Sales', dimension_value: null, value: 1 },
        { metric_name: 'Sales', dimension_value: 'null', value: 2 },
        { metric_name: 'Sales', dimension_value: 1, value: 3 },
        { metric_name: 'Sales', dimension_value: '1', value: 4 },
      ],
      {
        rows: ['metric_name'],
        columns: ['dimension_value'],
        value: 'value',
        showTotal: false,
        totalPosition: 'right',
        calculation: 'raw',
        maxGeneratedColumns: 10,
      },
    );

    expect(result.generatedColumnIds).toEqual([
      '__matrix_col__1',
      '__matrix_col__n1:1',
      '__matrix_col__null',
      '__matrix_col__z4:null',
    ]);
    expect(new Set(result.generatedColumnIds).size).toBe(4);
    expect(result.data[0]).toMatchObject({
      __matrix_col__1: '4',
      '__matrix_col__n1:1': '3',
      __matrix_col__null: '2',
      '__matrix_col__z4:null': '1',
    });
  });

  it('does not merge delimiter-like multi-field row dimensions', () => {
    const result = matrixTransform(
      [
        { row_a: 'a', row_b: 'b\u0001c', biz_date: '2026-05-01', value: 1 },
        { row_a: 'a\u0001b', row_b: 'c', biz_date: '2026-05-01', value: 2 },
      ],
      {
        rows: ['row_a', 'row_b'],
        columns: ['biz_date'],
        value: 'value',
        showTotal: false,
        totalPosition: 'right',
        calculation: 'raw',
        maxGeneratedColumns: 10,
      },
    );

    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual([
      {
        row_a: 'a',
        row_b: 'b\u0001c',
        '__matrix_col__2026-05-01': '1',
      },
      {
        row_a: 'a\u0001b',
        row_b: 'c',
        '__matrix_col__2026-05-01': '2',
      },
    ]);
  });

  it('keeps generated column labels human-readable', () => {
    const result = matrixTransform(
      [
        {
          metric_name: 'Sales',
          region: 'North / 华北',
          metric_type: 'Profit %',
          value: 1,
        },
        {
          metric_name: 'Sales',
          region: 'South Zone',
          metric_type: '销售额',
          value: 2,
        },
      ],
      {
        rows: ['metric_name'],
        columns: ['region', 'metric_type'],
        value: 'value',
        showTotal: false,
        totalPosition: 'right',
        calculation: 'raw',
        maxGeneratedColumns: 10,
      },
    );

    expect(
      result.columns
        .filter(column => column.key.startsWith('__matrix_col__'))
        .map(column => column.label)
        .sort(),
    ).toEqual(['North / 华北 / Profit %', 'South Zone / 销售额'].sort());
  });

  it('fails fast for inconsistent row sort or unit values within one row', () => {
    const base = {
      rows: ['metric_name'],
      columns: ['biz_date'],
      value: 'value',
      showTotal: false,
      totalPosition: 'right' as const,
      maxGeneratedColumns: 10,
    };

    expect(() =>
      matrixTransform(
        [
          {
            metric_name: 'Sales',
            metric_order: 1,
            biz_date: '2026-05-01',
            value: 1,
          },
          {
            metric_name: 'Sales',
            metric_order: 2,
            biz_date: '2026-05-02',
            value: 1,
          },
        ],
        {
          ...base,
          rowSort: 'metric_order',
          calculation: 'raw',
        },
      ),
    ).toThrow('Matrix rowSort value must be consistent within row Sales.');

    expect(() =>
      matrixTransform(
        [
          {
            metric_name: 'Sales',
            biz_date: '2026-05-01',
            value: 1,
            unit: '件',
          },
          {
            metric_name: 'Sales',
            biz_date: '2026-05-02',
            value: 1,
            unit: '箱',
          },
        ],
        {
          ...base,
          unitField: 'unit',
          calculation: 'raw',
        },
      ),
    ).toThrow('Matrix unitField value must be consistent within row Sales.');
  });

  it('fails fast for invalid config and excessive generated columns', () => {
    expect(() =>
      matrixTransform(records, {
        rows: [],
        columns: ['biz_date'],
        value: 'value',
        showTotal: true,
        totalPosition: 'left',
        calculation: 'raw',
        maxGeneratedColumns: 10,
      }),
    ).toThrow('Matrix rows, columns, and value are required.');

    expect(() =>
      matrixTransform(records, {
        rows: ['metric_name'],
        columns: ['biz_date'],
        value: 'value',
        showTotal: true,
        totalPosition: 'left',
        calculation: 'raw',
        maxGeneratedColumns: 1,
      }),
    ).toThrow('Matrix generated 2 columns, which exceeds the limit of 1.');
  });
});
