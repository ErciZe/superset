import {
  buildColumnDomains,
  buildColumnTuples,
} from '../../src/crosstab/domain';

const records = [
  { biz_date: '2026-05-01', shop_name: 'A', amount: 10 },
  { biz_date: '2026-05-01', shop_name: 'B', amount: 20 },
  { biz_date: '2026-05-02', shop_name: 'A', amount: 30 },
];

describe('crosstab domain', () => {
  it('derives one domain per column dimension from query results', () => {
    expect(buildColumnDomains(records, ['biz_date', 'shop_name'])).toEqual([
      ['2026-05-01', '2026-05-02'],
      ['A', 'B'],
    ]);
  });

  it('generates Cartesian column tuples from derived domains', () => {
    expect(buildColumnTuples(records, ['biz_date', 'shop_name'], 10)).toEqual([
      ['2026-05-01', 'A'],
      ['2026-05-01', 'B'],
      ['2026-05-02', 'A'],
      ['2026-05-02', 'B'],
    ]);
  });

  it('fails when generated tuples exceed the configured limit', () => {
    expect(() => buildColumnTuples(records, ['biz_date', 'shop_name'], 3))
      .toThrow('Crosstab generated 4 columns, which exceeds the limit of 3.');
  });

  it('fails before materializing tuples when domain cardinality exceeds the limit', () => {
    const highCardinalityRecords = [
      { month: '2026-05', shop: 'A' },
      { month: '2026-05', shop: 'B' },
      { month: '2026-05', shop: 'C' },
      { month: '2026-06', shop: 'A' },
      { month: '2026-06', shop: 'B' },
      { month: '2026-06', shop: 'C' },
      { month: '2026-07', shop: 'A' },
      { month: '2026-07', shop: 'B' },
      { month: '2026-07', shop: 'C' },
    ];

    expect(() => buildColumnTuples(
      highCardinalityRecords,
      ['month', 'shop'],
      8,
    )).toThrow('Crosstab generated 9 columns, which exceeds the limit of 8.');
  });
});
