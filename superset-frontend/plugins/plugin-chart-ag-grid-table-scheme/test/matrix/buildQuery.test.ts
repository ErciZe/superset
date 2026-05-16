import { QueryMode, VizType } from '@superset-ui/core';
import buildQuery from '../../src/matrix/buildQuery';

describe('ag grid table scheme matrix buildQuery', () => {
  it('preserves official query behavior when matrix mode is disabled', () => {
    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      groupby: ['category'],
      metrics: ['count'],
      matrix_mode_enabled: false,
    } as any).queries[0];

    expect(query.columns).toEqual(['category']);
    expect(query.metrics).toEqual(['count']);
  });

  it('injects matrix dimensions, unit, sort field, and selected metric', () => {
    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      groupby: ['ignored_group'],
      metrics: ['ignored_metric'],
      matrix_mode_enabled: true,
      matrix_rows: ['metric_name'],
      matrix_columns: ['biz_date'],
      matrix_value: 'value',
      matrix_row_sort: 'metric_order',
      matrix_unit_field: 'unit',
    } as any).queries[0];

    expect(query.columns).toEqual([
      'metric_name',
      'biz_date',
      'metric_order',
      'unit',
    ]);
    expect(query.metrics).toEqual(['value']);
  });

  it('passes adhoc dimensions and metrics through the official query builder', () => {
    const regionColumn = {
      expressionType: 'SQL',
      label: 'region_bucket',
      sqlExpression: "case when region is null then 'unknown' else region end",
    };
    const duplicateRegionColumn = {
      ...regionColumn,
    };
    const valueMetric = {
      expressionType: 'SQL',
      label: 'gross_value',
      sqlExpression: 'sum(gross_value)',
    };

    const query = buildQuery({
      viz_type: VizType.Table,
      datasource: '11__table',
      query_mode: QueryMode.Aggregate,
      matrix_mode_enabled: true,
      matrix_rows: [regionColumn, duplicateRegionColumn],
      matrix_columns: ['biz_date'],
      matrix_value: valueMetric,
    } as any).queries[0];

    expect(query.columns).toEqual([regionColumn, 'biz_date']);
    expect(query.metrics).toEqual([valueMetric]);
  });

  it('fails fast when matrix mode is combined with server pagination', () => {
    expect(() =>
      buildQuery({
        viz_type: VizType.Table,
        datasource: '11__table',
        query_mode: QueryMode.Aggregate,
        matrix_mode_enabled: true,
        server_pagination: true,
        matrix_rows: ['metric_name'],
        matrix_columns: ['biz_date'],
        matrix_value: 'value',
      } as any),
    ).toThrow('Matrix mode does not support server pagination.');
  });
});
