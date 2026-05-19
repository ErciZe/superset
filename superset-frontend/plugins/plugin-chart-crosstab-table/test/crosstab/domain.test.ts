import {
  buildColumnDomains,
  buildColumnTuples,
} from '../../src/crosstab/domain';

function expectErrorMessage(callback: () => unknown, message: string) {
  try {
    callback();
    throw new Error('Expected callback to throw');
  } catch (error) {
    expect((error as Error).message).toBe(message);
  }
}

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
    expectErrorMessage(
      () => buildColumnTuples(records, ['biz_date', 'shop_name'], 3),
      'Crosstab generated 4 columns, which exceeds the limit of 3.',
    );
  });

  it('fails before materializing tuples when domain cardinality exceeds the limit', () => {
    const flatMap = jest.spyOn(Array.prototype, 'flatMap');
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

    try {
      expectErrorMessage(
        () => buildColumnTuples(highCardinalityRecords, ['month', 'shop'], 8),
        'Crosstab generated 9 columns, which exceeds the limit of 8.',
      );
      expect(flatMap).not.toHaveBeenCalled();
    } finally {
      flatMap.mockRestore();
    }
  });

  it('applies the generated column limit to the empty column tuple', () => {
    expectErrorMessage(
      () => buildColumnTuples(records, [], 0),
      'Crosstab generated 1 columns, which exceeds the limit of 0.',
    );
  });
});
