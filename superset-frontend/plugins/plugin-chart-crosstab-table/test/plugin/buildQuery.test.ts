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

    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].columns).toEqual([
      'contract_type',
      'year',
      'pay_type',
    ]);
    expect(queryContext.queries[0].row_limit).toBe(10000);
    expect(queryContext.queries[0].metrics).toEqual(['amount', 'profit']);
    expect(queryContext.queries[0].is_timeseries).toBe(false);
    expect(queryContext.queries[0].post_processing).toEqual([]);
    expect(queryContext.queries[0].filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 'org_id', op: '==', val: 1 }),
      ]),
    );
  });

  it('de-duplicates overlapping row and column dimensions while preserving order', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type', 'year'],
      groupbyColumns: ['year', 'pay_type'],
      metrics: ['amount'],
    } as never);

    expect(queryContext.queries[0].columns).toEqual([
      'contract_type',
      'year',
      'pay_type',
    ]);
  });

  it('normalizes scalar metrics to an array', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type'],
      groupbyColumns: ['pay_type'],
      metrics: 'amount',
    } as never);

    expect(queryContext.queries[0].metrics).toEqual(['amount']);
  });

  it('rejects server pagination', () => {
    try {
      buildQuery({
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['contract_type'],
        groupbyColumns: ['pay_type'],
        metrics: ['amount'],
        serverPagination: true,
      } as never);
      throw new Error('Expected buildQuery to throw');
    } catch (error) {
      expect((error as Error).message).toBe(
        'Crosstab table does not support server pagination in v1.',
      );
    }
  });
});
