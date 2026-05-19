import buildQuery from '../../src/plugin/buildQuery';

describe('crosstab buildQuery', () => {
  it('includes row dimensions, column dimensions, and metrics in one aggregate query', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type', 'year'],
      groupbyColumns: ['pay_type'],
      metrics: ['amount', 'profit'],
      adhoc_filters: [
        {
          clause: 'WHERE',
          subject: 'org_id',
          operator: '==',
          comparator: 1,
          expressionType: 'SIMPLE',
        },
      ],
      row_limit: 10000,
      time_range: 'No filter',
    } as never);

    expect(queryContext.queries[0].columns).toEqual([
      'contract_type',
      'year',
      'pay_type',
    ]);
    expect(queryContext.queries[0].metrics).toEqual(['amount', 'profit']);
    expect(queryContext.queries[0].filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 'org_id', op: '==', val: 1 }),
      ]),
    );
  });

  it('rejects server pagination', () => {
    expect(() =>
      buildQuery({
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['contract_type'],
        groupbyColumns: ['pay_type'],
        metrics: ['amount'],
        serverPagination: true,
      } as never),
    ).toThrow('Crosstab table does not support server pagination in v1.');
  });
});
