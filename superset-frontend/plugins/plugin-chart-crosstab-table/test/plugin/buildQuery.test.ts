import buildQuery from '../../src/plugin/buildQuery';
import {
  ERR_SERVER_COLUMN_PAGINATION_COLUMNS,
  ERR_SERVER_COLUMN_PAGINATION_SHAPE,
} from '../../src/plugin/serverColumnPagination';

const dynamicColumnGroupBy = {
  enabled: true,
  placement: 'columns',
  slotIndex: 1,
  defaultColumn: 'shop_name',
  options: [
    { label: '店铺', column: 'shop_name' },
    { label: '国家', column: 'country' },
  ],
} as const;

const canonicalMultiSlotGroupBy = {
  enabled: true,
  slots: [
    {
      id: 'level2',
      label: '二级维度',
      placement: 'columns',
      slotIndex: 1,
      spliceCount: 1,
      defaultOptionId: 'shop',
      options: [
        { id: 'shop', label: '店铺', columns: ['shop_name'] },
        { id: 'country', label: '国家', columns: ['country'] },
      ],
    },
    {
      id: 'level3',
      label: '三级维度',
      placement: 'columns',
      slotIndex: 2,
      spliceCount: 1,
      defaultOptionId: 'none',
      options: [
        { id: 'none', label: '(无)', columns: [] },
        { id: 'msku', label: 'MSKU', columns: ['msku'] },
      ],
    },
  ],
} as const;

const dynamicMetric = {
  enabled: true,
  slots: [
    {
      id: 'primary_metric',
      label: '主指标',
      slotIndex: 0,
      spliceCount: 1,
      defaultOptionId: 'amount',
      options: [
        {
          id: 'amount',
          label: '销售额',
          metrics: [
            { metric: 'amount', label: '销售额', semantic: 'additive' },
          ],
        },
        {
          id: 'rate',
          label: '毛利率',
          metrics: [
            { metric: 'margin_rate', label: '毛利率', semantic: 'ratio' },
          ],
        },
        {
          id: 'profit',
          label: '利润',
          metrics: [{ metric: 'profit', label: '利润', semantic: 'additive' }],
        },
      ],
    },
  ],
} as const;

const dynamicMetricPair = {
  enabled: true,
  slots: [
    {
      id: 'metric_pair',
      label: '指标组合',
      slotIndex: 0,
      spliceCount: 2,
      defaultOptionId: 'amount_profit',
      options: [
        {
          id: 'amount_profit',
          label: '销售额和利润',
          metrics: [
            { metric: 'amount', label: '销售额', semantic: 'additive' },
            { metric: 'profit', label: '利润', semantic: 'additive' },
          ],
        },
        {
          id: 'amount_and_rate',
          label: '销售额和毛利率',
          metrics: [
            { metric: 'amount', label: '销售额', semantic: 'additive' },
            { metric: 'margin_rate', label: '毛利率', semantic: 'ratio' },
          ],
        },
      ],
    },
  ],
} as const;

describe('crosstab buildQuery', () => {
  it('includes calculated SQL metrics using runtime parameter values', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['category'],
        groupbyColumns: ['biz_date'],
        crosstabFieldConfig: {
          rows: [{ field: 'category' }],
          columns: [{ field: 'biz_date' }],
          metrics: [
            {
              metric: {
                expressionType: 'SQL',
                label: 'sales',
                sqlExpression: 'SUM(sales_amount)',
              },
              label: '销售额',
              semantic: 'additive',
            },
            {
              metric: {
                expressionType: 'SQL',
                label: 'profit',
                sqlExpression: 'SUM(gross_profit)',
              },
              label: '毛利',
              semantic: 'additive',
            },
          ],
        },
        parameters: [
          {
            kind: 'number',
            name: 'adjustmentRate',
            default: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
        calculatedFields: [
          {
            id: 'adjusted_margin',
            label: '含参毛利率',
            template: 'parameterized_ratio',
            inputs: {
              leftMetric: 'profit',
              rightMetric: 'sales',
              parameterName: 'adjustmentRate',
            },
            semantic: 'ratio',
            formatString: '.2%',
          },
        ],
      },
      {
        ownState: {
          numericParameters: { adjustmentRate: 1.25 },
        },
      },
    );

    expect(queryContext.queries[0].metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expressionType: 'SQL',
          label: '含参毛利率',
          sqlExpression:
            '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 1.25)',
        }),
      ]),
    );
  });

  it('uses the default dynamic group-by column in query dimensions', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['metric_name_with_unit'],
      groupbyColumns: ['biz_date', 'stale_dimension'],
      metrics: ['amount'],
      dynamicGroupBy: dynamicColumnGroupBy,
    } as never);

    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'shop_name',
    ]);
  });

  it('uses the runtime selected dynamic group-by column in non-server query dimensions', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['amount'],
        dynamicGroupBy: dynamicColumnGroupBy,
      } as never,
      {
        ownState: {
          selectedDynamicGroupByColumn: 'country',
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'country',
    ]);
  });

  it('uses the runtime selected dynamic group-by column in server column domain queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        row_limit: 10000,
        dynamicGroupBy: dynamicColumnGroupBy,
      } as never,
      {
        ownState: {
          currentColumnPage: 2,
          currentColumnPageSize: 5,
          selectedDynamicGroupByColumn: 'country',
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'country'],
        metrics: [],
        row_limit: 5,
        row_offset: 10,
      }),
    );
    expect(queryContext.queries[0].orderby).toEqual([
      ['biz_date', true],
      ['country', true],
    ]);
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'country'],
        is_rowcount: true,
        row_limit: 0,
        row_offset: 0,
      }),
    );
  });

  it('uses the runtime selected dynamic group-by column in non-additive summary queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'category' }, { field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值', semantic: 'ratio' }],
        },
        dynamicGroupBy: dynamicColumnGroupBy,
        showRowTotals: true,
        showRowSubtotals: true,
        showColumnTotals: true,
        showColumnSubtotals: true,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          selectedDynamicGroupByColumn: 'country',
        },
      } as never,
    );

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['category', 'metric_name_with_unit', 'biz_date', 'country'],
      ['category', 'metric_name_with_unit'],
      ['category', 'biz_date', 'country'],
      ['category'],
      ['biz_date', 'country'],
      ['category', 'metric_name_with_unit', 'biz_date'],
      ['biz_date'],
      ['category', 'biz_date'],
      [],
    ]);
  });

  it('uses canonical multi-slot dimensions in non-server query dimensions', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['amount'],
        dynamicGroupBy: canonicalMultiSlotGroupBy,
      } as never,
      {
        ownState: {
          selectedDynamicGroupBy: {
            level2: 'country',
            level3: 'msku',
          },
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'country',
      'msku',
    ]);
  });

  it('uses canonical multi-slot dimensions for pre-tuples server domain and count queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值', semantic: 'ratio' }],
        },
        dynamicGroupBy: canonicalMultiSlotGroupBy,
        serverColumnPagination: true,
        showRowTotals: true,
        showRowSubtotals: true,
        showColumnTotals: true,
        showColumnSubtotals: true,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          selectedDynamicGroupBy: {
            level2: 'country',
            level3: 'msku',
          },
        },
      } as never,
    );

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['biz_date', 'country', 'msku'],
      ['biz_date', 'country', 'msku'],
    ]);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        metrics: [],
        row_limit: 5,
        row_offset: 0,
      }),
    );
    expect(queryContext.queries[0].orderby).toEqual([
      ['biz_date', true],
      ['country', true],
      ['msku', true],
    ]);
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        is_rowcount: true,
        row_limit: 0,
        row_offset: 0,
      }),
    );
  });

  it('uses canonical multi-slot dimensions for cached-tuples server leaf and summary queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [{ metric: '指标值', semantic: 'ratio' }],
        },
        dynamicGroupBy: canonicalMultiSlotGroupBy,
        serverColumnPagination: true,
        showRowTotals: true,
        showRowSubtotals: true,
        showColumnTotals: true,
        showColumnSubtotals: true,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 5,
          serverColumnPageColumnSignature: 'biz_date\u001fcountry\u001fmsku',
          serverColumnTotalCount: 2,
          serverColumnPageTuples: [
            ['2026-05-01', 'US', 'SKU-1'],
            ['2026-05-01', 'CA', 'SKU-2'],
          ],
          selectedDynamicGroupBy: {
            level2: 'country',
            level3: 'msku',
          },
        },
      } as never,
    );

    const tupleWhere =
      "(biz_date = '2026-05-01' AND country = 'US' AND msku = 'SKU-1') OR " +
      "(biz_date = '2026-05-01' AND country = 'CA' AND msku = 'SKU-2')";

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['biz_date', 'country', 'msku'],
      ['biz_date', 'country', 'msku'],
      ['metric_name_with_unit', 'biz_date', 'country', 'msku'],
      ['metric_name_with_unit'],
      ['biz_date', 'country', 'msku'],
      ['metric_name_with_unit', 'biz_date'],
      ['biz_date'],
      ['metric_name_with_unit', 'biz_date', 'country'],
      ['biz_date', 'country'],
      [],
    ]);
    expect(queryContext.queries[0].orderby).toEqual([
      ['biz_date', true],
      ['country', true],
      ['msku', true],
    ]);
    expect(queryContext.queries[2].extras?.where).toBe(tupleWhere);
    expect(queryContext.queries[4].extras?.where).toBe(tupleWhere);
    expect(queryContext.queries[5].extras?.where).toBe(tupleWhere);
    expect(queryContext.queries[6].extras?.where).toBe(tupleWhere);
    expect(queryContext.queries[7].extras?.where).toBe(tupleWhere);
    expect(queryContext.queries[8].extras?.where).toBe(tupleWhere);
    expect(queryContext.queries[9].extras?.where ?? '').toBe('');
  });

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

  it('uses crosstabFieldConfig before legacy query controls', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['legacy_row'],
      groupbyColumns: ['legacy_column'],
      metrics: ['legacy_metric'],
      crosstabFieldConfig: {
        rows: [{ field: 'metric_name_with_unit' }],
        columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
        metrics: [{ metric: '指标值' }],
      },
    } as never);

    expect(queryContext.queries[0].columns).toEqual([
      'metric_name_with_unit',
      'biz_date',
      'shop_name',
    ]);
    expect(queryContext.queries[0].metrics).toEqual(['指标值']);
  });

  it('uses the selected dynamic metric in the leaf query metrics', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [
            { metric: 'amount', label: '销售额', semantic: 'additive' },
          ],
        },
        dynamicMetric,
      } as never,
      {
        ownState: {
          selectedDynamicMetric: {
            primary_metric: 'profit',
          },
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].metrics).toEqual(['profit']);
  });

  it('emits SQL summary queries for configured non-additive metric semantics', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      crosstabFieldConfig: {
        rows: [{ field: 'category' }, { field: 'metric_name_with_unit' }],
        columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
        metrics: [{ metric: '指标值', semantic: 'ratio' }],
      },
      showRowTotals: true,
      showRowSubtotals: true,
      showColumnTotals: true,
      showColumnSubtotals: true,
      row_limit: 10000,
    } as never);

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['category', 'metric_name_with_unit', 'biz_date', 'shop_name'],
      ['category', 'metric_name_with_unit'],
      ['category', 'biz_date', 'shop_name'],
      ['category'],
      ['biz_date', 'shop_name'],
      ['category', 'metric_name_with_unit', 'biz_date'],
      ['biz_date'],
      ['category', 'biz_date'],
      [],
    ]);
    queryContext.queries.forEach(query => {
      expect(query.metrics).toEqual(['指标值']);
      expect(query.is_timeseries).toBe(false);
      expect(query.post_processing).toEqual([]);
    });
  });

  it('plans summary queries from selected dynamic metric semantics', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'category' }, { field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [
            { metric: 'amount', label: '销售额', semantic: 'additive' },
          ],
        },
        dynamicMetric,
        showRowTotals: true,
        showRowSubtotals: true,
        showColumnTotals: true,
        showColumnSubtotals: true,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          selectedDynamicMetric: {
            primary_metric: 'rate',
          },
        },
      } as never,
    );

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['category', 'metric_name_with_unit', 'biz_date', 'shop_name'],
      ['category', 'metric_name_with_unit'],
      ['category', 'biz_date', 'shop_name'],
      ['category'],
      ['biz_date', 'shop_name'],
      ['category', 'metric_name_with_unit', 'biz_date'],
      ['biz_date'],
      ['category', 'biz_date'],
      [],
    ]);
    queryContext.queries.forEach(query => {
      expect(query.metrics).toEqual(['margin_rate']);
    });
  });

  it.each([
    ['missing dynamic metric config', undefined],
    [
      'disabled dynamic metric config',
      {
        enabled: false,
        slots: [],
      },
    ],
  ])(
    'preserves existing metrics behavior with %s',
    (_label, dynamicMetricConfig) => {
      const queryContext = buildQuery({
        datasource: '11__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['contract_type'],
        groupbyColumns: ['pay_type'],
        metrics: ['amount', 'profit'],
        ...(dynamicMetricConfig ? { dynamicMetric: dynamicMetricConfig } : {}),
      } as never);

      expect(queryContext.queries).toHaveLength(1);
      expect(queryContext.queries[0].metrics).toEqual(['amount', 'profit']);
    },
  );

  it.each([
    ['empty persisted metrics', { metrics: [] }],
    ['missing persisted metrics', {}],
  ])(
    'falls back to legacy metrics when crosstabFieldConfig has %s',
    (_label, crosstabFieldConfigMetrics) => {
      const queryContext = buildQuery({
        datasource: '11__table',
        viz_type: 'crosstab-table',
        metrics: ['legacy_amount'],
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          ...crosstabFieldConfigMetrics,
        },
        dynamicMetric: {
          enabled: false,
          slots: [],
        },
      } as never);

      expect(queryContext.queries).toHaveLength(1);
      expect(queryContext.queries[0]).toEqual(
        expect.objectContaining({
          columns: ['metric_name_with_unit', 'biz_date', 'shop_name'],
          metrics: ['legacy_amount'],
        }),
      );
    },
  );

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

  it('builds column domain and rowcount queries before server column page tuples are loaded', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 2,
          currentColumnPageSize: 5,
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name', 'country'],
        metrics: [],
        row_limit: 5,
        row_offset: 10,
      }),
    );
    expect(queryContext.queries[0].orderby).toEqual([
      ['biz_date', true],
      ['shop_name', true],
      ['country', true],
    ]);
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name', 'country'],
        is_rowcount: true,
        row_limit: 0,
        row_offset: 0,
      }),
    );
  });

  it('builds current page data and row total queries after server column page tuples are loaded', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        row_limit: 10000,
        adhoc_filters: [
          {
            clause: 'WHERE',
            subject: 'org_id',
            operator: '==',
            comparator: 1,
            expressionType: 'SIMPLE',
          },
        ],
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 5,
          serverColumnPageTuples: [
            ['2026-05-01', "Shop A's", 'US'],
            ['2026-05-01', 'Shop B', null],
          ],
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(4);
    queryContext.queries.forEach(query => {
      expect(query.filters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ col: 'org_id', op: '==', val: 1 }),
        ]),
      );
    });
    expect(queryContext.queries[2]).toEqual(
      expect.objectContaining({
        columns: ['metric_name_with_unit', 'biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
      }),
    );
    expect(queryContext.queries[2].extras?.where).toBe(
      "(biz_date = '2026-05-01' AND shop_name = 'Shop A''s' AND country = 'US') OR " +
        "(biz_date = '2026-05-01' AND shop_name = 'Shop B' AND country IS NULL)",
    );
    expect(queryContext.queries[3]).toEqual(
      expect.objectContaining({
        columns: ['metric_name_with_unit'],
        metrics: ['指标值'],
        row_limit: 10000,
        row_offset: 0,
      }),
    );
    expect(queryContext.queries[3].extras?.where ?? '').not.toContain('Shop A');
  });

  it('uses planned SQL summaries instead of the legacy row total query for non-additive server column pages', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [
            { field: 'biz_date' },
            { field: 'shop_name' },
            { field: 'country' },
          ],
          metrics: [{ metric: '指标值', semantic: 'ratio' }],
        },
        serverColumnPagination: true,
        showRowTotals: true,
        showColumnTotals: true,
        showRowSubtotals: false,
        showColumnSubtotals: false,
        columnPageSize: 98,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 5,
          serverColumnPageColumnSignature:
            'biz_date\u001fshop_name\u001fcountry',
          serverColumnTotalCount: 2,
          serverColumnPageTuples: [
            ['2026-05-01', 'Shop A', 'US'],
            ['2026-05-01', 'Shop B', null],
          ],
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(6);
    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['biz_date', 'shop_name', 'country'],
      ['biz_date', 'shop_name', 'country'],
      ['metric_name_with_unit', 'biz_date', 'shop_name', 'country'],
      ['metric_name_with_unit'],
      ['biz_date', 'shop_name', 'country'],
      [],
    ]);
    expect(queryContext.queries[4].extras?.where ?? '').toContain('Shop A');
    expect(queryContext.queries[5].extras?.where ?? '').toBe('');
  });

  it('reloads column domain when cached server column tuples no longer match selected columns', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 98,
          serverColumnPageTuples: [['2026-05-01', 'Shop A', 'US']],
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name'],
        metrics: [],
        row_limit: 5,
      }),
    );
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name'],
        is_rowcount: true,
      }),
    );
  });

  it('reloads column domain when cached server column tuples are for a stale page or page size', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 3,
          currentColumnPageSize: 8,
          serverColumnPageTuplesPage: 2,
          serverColumnPageTuplesPageSize: 5,
          serverColumnPageTuples: [['2026-05-01', 'Shop A', 'US']],
          serverColumnPageColumnSignature:
            'biz_date\u001fshop_name\u001fcountry',
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name', 'country'],
        metrics: [],
        row_limit: 8,
        row_offset: 24,
      }),
    );
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name', 'country'],
        is_rowcount: true,
      }),
    );
  });

  it('encodes Superset temporal column values from epoch milliseconds', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
        columnPageSize: 98,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuples: [[1735689600000, 'LX-GG-AE', '阿联酋']],
        },
      } as never,
    );

    expect(queryContext.queries[2].extras?.where).toBe(
      "(biz_date = '2025-01-01 00:00:00' AND shop_name = 'LX-GG-AE' AND country = '阿联酋')",
    );
  });

  it('rejects server column pagination for unsupported dimensions', () => {
    expect(() =>
      buildQuery({
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: [
          {
            expressionType: 'SQL',
            sqlExpression: 'lower(country)',
            label: 'country',
          },
        ],
        metrics: ['指标值'],
        serverColumnPagination: true,
      } as never),
    ).toThrow(ERR_SERVER_COLUMN_PAGINATION_COLUMNS);
  });

  it('rejects server column pagination outside the production v1 shape', () => {
    expect(() =>
      buildQuery({
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit', 'unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['指标值'],
        serverColumnPagination: true,
      } as never),
    ).toThrow(ERR_SERVER_COLUMN_PAGINATION_SHAPE);
  });

  it('rejects server column pagination when dynamic metric expands to multiple effective metrics', () => {
    expect(() =>
      buildQuery(
        {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          groupbyRows: ['metric_name_with_unit'],
          groupbyColumns: ['biz_date', 'shop_name', 'country'],
          metrics: ['amount', 'profit'],
          dynamicMetric: dynamicMetricPair,
          serverColumnPagination: true,
        } as never,
        {
          ownState: {
            selectedDynamicMetric: {
              metric_pair: 'amount_and_rate',
            },
          },
        } as never,
      ),
    ).toThrow(ERR_SERVER_COLUMN_PAGINATION_SHAPE);
  });
});
