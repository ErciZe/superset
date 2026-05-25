import buildQuery, {
  ERR_CROSSTAB_BUSINESS_MATRIX_CALCULATED_FIELD,
  ERR_CROSSTAB_ROW_VALUE_SUMMARY_METRIC,
} from '../../src/plugin/buildQuery';
import type { CrosstabFormData } from '../../src/types';
import {
  ERR_SERVER_COLUMN_PAGINATION_COLUMNS,
  ERR_SERVER_COLUMN_PAGINATION_SHAPE,
  getServerColumnPageColumnSignature,
} from '../../src/plugin/serverColumnPagination';
import { ERR_CROSSTAB_V4_METRIC_CONFIG } from '../../src/plugin/fieldConfig';

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
                label: 'profit',
                sqlExpression: 'SUM(gross_profit)',
              },
              label: '毛利',
              semantic: 'additive',
            },
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
              metric: '含参毛利率',
              label: '含参毛利率',
              calculatedFieldId: 'calc_adjusted_margin',
            },
          ],
        },
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: '调整系数',
            defaultValue: 1,
            min: 0,
            max: 2,
            step: 0.01,
          },
        ],
        crosstabCalculatedFields: [
          {
            id: 'calc_adjusted_margin',
            name: '含参毛利率',
            resultType: 'percent',
            formatString: '.2%',
            ast: {
              kind: 'binary_op',
              op: '*',
              left: {
                kind: 'pct',
                numerator: { kind: 'metric_ref', metricId: 'profit' },
                denominator: { kind: 'metric_ref', metricId: 'sales' },
              },
              right: {
                kind: 'number_param',
                parameterId: 'param_adjustment',
              },
            },
          },
        ],
      },
      {
        ownState: {
          numericParameters: { param_adjustment: 1.25 },
        },
      },
    );

    expect(queryContext.queries[0].metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expressionType: 'SQL',
          label: '含参毛利率',
          sqlExpression:
            '(((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100) * 1.25)',
        }),
      ]),
    );
  });

  it('includes calculated SQL metrics from selected saved metric names', () => {
    const queryContext = buildQuery({
      datasource: '7__table',
      datasourceMetrics: [
        { metric_name: 'saved_sales', expression: 'SUM(sales_amount)' },
        { metric_name: 'saved_profit', expression: 'SUM(gross_profit)' },
      ],
      viz_type: 'crosstab-table',
      groupbyRows: ['category'],
      groupbyColumns: ['biz_date'],
      crosstabFieldConfig: {
        rows: [{ field: 'category' }],
        columns: [{ field: 'biz_date' }],
        metrics: [
          { metric: 'saved_sales', label: 'Saved sales' },
          { metric: 'saved_profit', label: 'Saved profit' },
          {
            metric: 'Profit rate',
            label: 'Profit rate',
            calculatedFieldId: 'profitRate',
          },
        ],
      },
      crosstabCalculatedFields: [
        {
          id: 'profitRate',
          name: 'Profit rate',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: { kind: 'metric_ref', metricId: 'saved_profit' },
            denominator: { kind: 'metric_ref', metricId: 'saved_sales' },
          },
        },
      ],
    } as never);

    expect(queryContext.queries[0].metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expressionType: 'SQL',
          label: 'Profit rate',
          sqlExpression:
            '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
        }),
      ]),
    );
  });

  it('includes a calculated SQL metric from hidden datasource saved metrics', () => {
    const queryContext = buildQuery({
      datasource: '7__table',
      datasourceMetrics: [
        {
          metric_name: 'v4_gross_profit_sum',
          verbose_name: 'V4毛利',
          expression: 'SUM(gross_profit)',
        },
        {
          metric_name: 'v4_sales_amount_sum',
          verbose_name: 'V4销售额',
          expression: 'SUM(sales_amount)',
        },
      ],
      viz_type: 'crosstab-table',
      groupbyRows: ['category'],
      groupbyColumns: ['biz_date'],
      crosstabFieldConfig: {
        rows: [{ field: 'category' }],
        columns: [{ field: 'biz_date' }],
        metrics: [
          {
            metric: 'V4示例毛利率',
            label: 'V4示例毛利率',
            calculatedFieldId: 'calc_margin_pct_v4',
          },
        ],
      },
      crosstabCalculatedFields: [
        {
          id: 'calc_margin_pct_v4',
          name: 'V4示例毛利率',
          resultType: 'percent',
          formatString: '.2%',
          ast: {
            kind: 'pct',
            numerator: {
              kind: 'metric_ref',
              metricId: 'v4_gross_profit_sum',
            },
            denominator: {
              kind: 'metric_ref',
              metricId: 'v4_sales_amount_sum',
            },
          },
        },
      ],
    } as never);

    expect(queryContext.queries[0].metrics).toEqual([
      {
        expressionType: 'SQL',
        label: 'V4示例毛利率',
        sqlExpression:
          '((CASE WHEN SUM(sales_amount) = 0 THEN NULL ELSE SUM(gross_profit) / SUM(sales_amount) END) * 100)',
      },
    ]);
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

  it('preserves configured sort metadata on dynamic server column dimensions', () => {
    const queryContext = buildQuery(
      {
        datasource: '11__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [
            {
              field: 'biz_date',
              sort: { by: 'biz_date', direction: 'desc', type: 'date' },
            },
            {
              field: 'shop_name',
              sort: { by: 'shop_order', direction: 'desc', type: 'number' },
            },
          ],
          metrics: [{ metric: '指标值', semantic: 'ratio' }],
        },
        dynamicGroupBy: canonicalMultiSlotGroupBy,
        serverColumnPagination: true,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 5,
          selectedDynamicGroupBy: {
            level2: 'country',
            level3: 'none',
          },
        },
      } as never,
    );

    expect(queryContext.queries[0].columns).toEqual([
      'biz_date',
      'country',
      'shop_order',
    ]);
    expect(queryContext.queries[0].orderby).toEqual([
      ['biz_date', false],
      ['shop_order', false],
    ]);
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

  it('ignores hidden chart-local time range so dashboard filters can control time', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type'],
      groupbyColumns: ['biz_date'],
      metrics: ['amount'],
      row_limit: 10000,
      time_range: '2025-01-01 : 2025-01-20',
    } as never);

    expect(queryContext.queries[0].time_range).toBeUndefined();
    expect(queryContext.form_data?.time_range).toBeUndefined();
  });

  it('preserves dashboard-provided time range from extra form data', () => {
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type'],
      groupbyColumns: ['biz_date'],
      metrics: ['amount'],
      row_limit: 10000,
      time_range: '2025-01-01 : 2025-01-20',
      extra_form_data: {
        time_range: '2026-05-01 : 2026-05-31',
      },
    } as never);

    expect(queryContext.queries[0].time_range).toBe('2026-05-01 : 2026-05-31');
  });

  it('keeps cell formatter expressions out of query payloads', () => {
    const formatterExpression =
      "({ value }) => (value == null ? 'formatterSentinelEmpty' : value)";
    const queryContext = buildQuery({
      datasource: '11__table',
      viz_type: 'crosstab-table',
      groupbyRows: ['contract_type'],
      groupbyColumns: ['pay_type'],
      metrics: ['amount'],
      crosstabCellFormatterExpression: formatterExpression,
    } as never);

    const queriesPayload = JSON.stringify(queryContext.queries);

    expect(queriesPayload).not.toContain('crosstabCellFormatterExpression');
    expect(queriesPayload).not.toContain(formatterExpression);
    expect(queriesPayload).not.toContain('formatterSentinelEmpty');
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

    expect(queryContext.queries).toHaveLength(4);
    expect(queryContext.queries[0].metrics).toEqual(['profit']);
    queryContext.queries.forEach(query => {
      expect(query.metrics).toEqual(['profit']);
    });
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

  it('rejects v4 charts when only legacy top-level metrics remain', () => {
    expect(() =>
      buildQuery({
        datasource: '11__table',
        viz_type: 'crosstab-table',
        metrics: ['legacy_amount'],
        crosstabParameters: [
          {
            id: 'param_adjustment',
            kind: 'number',
            name: 'adjustmentRate',
            label: 'Adjustment',
            defaultValue: 1,
          },
        ],
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [],
        },
        crosstabCalculatedFields: [
          {
            id: 'calc_margin_pct_v4',
            name: 'Margin rate',
            resultType: 'percent',
            ast: {
              kind: 'pct',
              numerator: { kind: 'metric_ref', metricId: 'profit' },
              denominator: { kind: 'metric_ref', metricId: 'sales' },
            },
          },
        ],
      } as never),
    ).toThrow(ERR_CROSSTAB_V4_METRIC_CONFIG);
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

  it('rejects server column pagination without an effective column dimension', () => {
    expect(() =>
      buildQuery(
        {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          groupbyRows: ['metric_name_with_unit'],
          groupbyColumns: ['biz_date', 'shop_name', 'country'],
          metrics: ['指标值'],
          serverColumnPagination: true,
          dynamicGroupBy: {
            enabled: true,
            slots: [
              {
                id: 'dimension1',
                placement: 'columns',
                slotIndex: 0,
                spliceCount: 1,
                defaultOptionId: 'none',
                options: [{ id: 'none', label: '无', columns: [] }],
              },
              {
                id: 'dimension2',
                placement: 'columns',
                slotIndex: 1,
                spliceCount: 1,
                defaultOptionId: 'none',
                options: [{ id: 'none', label: '无', columns: [] }],
              },
              {
                id: 'dimension3',
                placement: 'columns',
                slotIndex: 2,
                spliceCount: 1,
                defaultOptionId: 'none',
                options: [{ id: 'none', label: '无', columns: [] }],
              },
            ],
          },
        } as never,
        { ownState: {} },
      ),
    ).toThrow(ERR_SERVER_COLUMN_PAGINATION_SHAPE);
  });

  it('builds current page data without a legacy row total query after server column page tuples are loaded', () => {
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

    expect(queryContext.queries).toHaveLength(3);
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
  });

  it('uses configured column sort in server column domain queries', () => {
    const queryContext = buildQuery(
      {
        datasource: '1__table',
        viz_type: 'crosstab-table',
        serverColumnPagination: true,
        columnPageSize: 12,
        row_limit: 10000,
        showColumnTotals: true,
        crosstabFieldConfig: {
          rows: [
            {
              field: 'metric_name_with_unit',
              sort: { by: 'metric_order', direction: 'asc', type: 'number' },
            },
          ],
          columns: [
            {
              field: 'biz_date',
              sort: { by: 'biz_date', direction: 'desc', type: 'date' },
            },
          ],
          metrics: [{ metric: '指标值', semantic: 'additive' }],
          rowValueSummaries: {
            field: 'metric_name_with_unit',
            values: [{ value: '销量（件）', semantic: 'additive' }],
          },
        },
      } as CrosstabFormData,
      { ownState: { currentColumnPage: 0 } },
    );

    expect(queryContext.queries[0].orderby).toEqual([['biz_date', false]]);
  });

  it('changes server column page signature when sort direction changes', () => {
    const ascendingSignature = getServerColumnPageColumnSignature([
      {
        field: 'biz_date',
        sort: { by: 'biz_date', direction: 'asc', type: 'date' },
      },
    ] as never);
    const descendingSignature = getServerColumnPageColumnSignature([
      {
        field: 'biz_date',
        sort: { by: 'biz_date', direction: 'desc', type: 'date' },
      },
    ] as never);

    expect(ascendingSignature).not.toEqual(descendingSignature);
    expect(ascendingSignature).toContain('biz_date');
    expect(descendingSignature).toContain('biz_date');
  });

  it('keeps server row total summary full range while leaf query is page filtered', () => {
    const queryContext = buildQuery(
      {
        datasource: '1__table',
        viz_type: 'crosstab-table',
        serverColumnPagination: true,
        columnPageSize: 2,
        row_limit: 10000,
        showColumnTotals: true,
        crosstabFieldConfig: {
          rows: [
            {
              field: 'metric_name_with_unit',
              sort: { by: 'metric_order', direction: 'asc', type: 'number' },
            },
          ],
          columns: [{ field: 'biz_date' }],
          metrics: [{ metric: '指标值', semantic: 'additive' }],
          rowValueSummaries: {
            field: 'metric_name_with_unit',
            values: [{ value: '销量（件）', semantic: 'additive' }],
          },
        },
      } as CrosstabFormData,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 2,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 2,
          serverColumnPageTuples: [['2025-01-01'], ['2025-01-02']],
        },
      },
    );

    const leafQuery = queryContext.queries[2];
    const rowTotalQuery = queryContext.queries[3];

    expect(leafQuery.columns).toContain('metric_order');
    expect(leafQuery.extras?.where).toContain('biz_date');
    expect(rowTotalQuery.columns).toEqual(['metric_name_with_unit']);
    expect(rowTotalQuery.extras?.where ?? '').not.toContain('biz_date');
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

  it('plans SQL summaries for additive totals without row-value overrides', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [{ metric: '指标值', semantic: 'additive' }],
        },
        serverColumnPagination: true,
        showRowTotals: false,
        showColumnTotals: true,
        showRowSubtotals: false,
        showColumnSubtotals: false,
        columnPageSize: 98,
        row_limit: 10000,
      } as never,
      {
        ownState: {
          currentColumnPage: 0,
          currentColumnPageSize: 98,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuplesPageSize: 98,
          serverColumnPageColumnSignature: 'biz_date',
          serverColumnPageTuples: [['2026-05-01']],
        },
      } as never,
    );

    expect(queryContext.queries.map(query => query.columns)).toEqual([
      ['biz_date'],
      ['biz_date'],
      ['metric_name_with_unit', 'biz_date'],
      ['metric_name_with_unit'],
    ]);
  });

  it('rejects row value summary metrics that the current query path cannot represent', () => {
    expect(() =>
      buildQuery({
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }],
          metrics: [{ metric: '指标值', semantic: 'additive' }],
          rowValueSummaries: {
            field: 'metric_name_with_unit',
            values: [
              {
                value: '毛利率（%）',
                semantic: 'ratio',
                summaryMetric: '毛利率汇总',
              },
            ],
          },
        },
      } as never),
    ).toThrow(ERR_CROSSTAB_ROW_VALUE_SUMMARY_METRIC);
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

  it('uses server column pagination when dynamic metric expands to multiple effective metrics', () => {
    const queryContext = buildQuery(
      {
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: ['amount', 'profit'],
        dynamicMetric: dynamicMetricPair,
        serverColumnPagination: true,
        showRowTotals: false,
        showColumnTotals: false,
      } as never,
      {
        ownState: {
          selectedDynamicMetric: {
            metric_pair: 'amount_and_rate',
          },
          currentColumnPage: 0,
          serverColumnPageTuplesPage: 0,
          serverColumnPageTuples: [['2026-05-01', 'Shop A', 'US']],
          serverColumnPageColumnSignature:
            'biz_date\u001fshop_name\u001fcountry',
        },
      } as never,
    );

    expect(queryContext.queries).toHaveLength(3);
    expect(queryContext.queries[0]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name', 'country'],
        metrics: [],
      }),
    );
    expect(queryContext.queries[1]).toEqual(
      expect.objectContaining({
        columns: ['biz_date', 'shop_name', 'country'],
        is_rowcount: true,
      }),
    );
    expect(queryContext.queries[2]).toEqual(
      expect.objectContaining({
        columns: ['metric_name_with_unit', 'biz_date', 'shop_name', 'country'],
        metrics: ['amount', 'margin_rate'],
      }),
    );
    expect(queryContext.queries[2].extras?.where).toBe(
      "(biz_date = '2026-05-01' AND shop_name = 'Shop A' AND country = 'US')",
    );
  });

  it('rejects server column pagination without effective metrics', () => {
    expect(() =>
      buildQuery({
        datasource: '7__table',
        viz_type: 'crosstab-table',
        groupbyRows: ['metric_name_with_unit'],
        groupbyColumns: ['biz_date', 'shop_name', 'country'],
        metrics: [],
        serverColumnPagination: true,
      } as never),
    ).toThrow(ERR_SERVER_COLUMN_PAGINATION_SHAPE);
  });

  it('rejects calculated fields on business matrix row dimensions', () => {
    expect(() =>
      buildQuery({
        datasource: '7__table',
        viz_type: 'crosstab-table',
        crosstabFieldConfig: {
          rows: [{ field: 'metric_name_with_unit' }],
          columns: [{ field: 'biz_date' }, { field: 'shop_name' }],
          metrics: [
            {
              metric: 'V4示例毛利率',
              label: 'V4示例毛利率',
              calculatedFieldId: 'calc_margin_pct_v4',
              semantic: 'ratio',
            },
          ],
        },
        datasourceMetrics: [
          {
            metric_name: 'v4_gross_profit_sum',
            verbose_name: 'V4毛利',
            expression: 'SUM(gross_profit)',
          },
          {
            metric_name: 'v4_sales_amount_sum',
            verbose_name: 'V4销售额',
            expression: 'SUM(sales_amount)',
          },
        ],
        crosstabCalculatedFields: [
          {
            id: 'calc_margin_pct_v4',
            name: 'V4示例毛利率',
            resultType: 'percent',
            formatString: '.2%',
            ast: {
              kind: 'pct',
              numerator: {
                kind: 'metric_ref',
                metricId: 'v4_gross_profit_sum',
              },
              denominator: {
                kind: 'metric_ref',
                metricId: 'v4_sales_amount_sum',
              },
            },
          },
        ],
      } as never),
    ).toThrow(ERR_CROSSTAB_BUSINESS_MATRIX_CALCULATED_FIELD);
  });
});
