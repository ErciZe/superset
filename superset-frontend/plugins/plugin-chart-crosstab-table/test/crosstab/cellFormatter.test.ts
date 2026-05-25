/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { GenericDataType } from '@superset-ui/core';
import {
  CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT,
  createCrosstabCellFormatter,
  formatCrosstabCellFormatterCallback,
  validateCrosstabCellFormatterCallback,
  validateCrosstabCellFormatterExpression,
} from '../../src/crosstab/cellFormatter';

const columnInfo = {
  key: 'sales',
  label: 'Sales',
  metric: 'amount',
  dataType: GenericDataType.Numeric,
};

const params = {
  data: {
    region: 'East',
    sales: 1200,
  },
  value: 1200,
  valueFormatted: '1,200',
  rowIndex: 2,
  colDef: {
    field: 'sales',
    headerName: 'Sales',
  },
};

describe('crosstab cell formatter', () => {
  it('treats empty, blank, and comment-only expressions as disabled', () => {
    expect(createCrosstabCellFormatter(undefined)).toBeUndefined();
    expect(createCrosstabCellFormatter(null)).toBeUndefined();
    expect(createCrosstabCellFormatter('   \n\t  ')).toBeUndefined();
    expect(
      createCrosstabCellFormatter('// disabled\n/* also disabled */'),
    ).toBeUndefined();
    expect(validateCrosstabCellFormatterCallback('/* disabled */')).toBe(false);
  });

  it('ships a disabled Chinese default comment with an example marker', () => {
    expect(CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT).toContain('回调示例');
    expect(
      createCrosstabCellFormatter(CROSSTAB_CELL_FORMATTER_CALLBACK_DEFAULT),
    ).toBeUndefined();
  });

  it('compiles function callbacks with the expected runtime context', () => {
    const formatter = createCrosstabCellFormatter(`function formatter(ctx) {
      return ctx.row.region + ':' + ctx.cell.field + ':' + ctx.value + ':' + ctx.rawValue + ':' + ctx.column.label + ':' + ctx.column.metric + ':' + ctx.rowIndex + ':' + ctx.colDef.headerName;
    }`);

    expect(formatter?.(params, columnInfo)).toEqual({
      text: 'East:sales:1,200:1200:Sales:amount:2:Sales',
    });
  });

  it('compiles arrow callbacks with the expected runtime context', () => {
    const formatter = createCrosstabCellFormatter(
      '({ cell }) => ({ text: cell.formattedValue, tooltip: String(cell.rawValue) })',
    );

    expect(formatter?.(params, columnInfo)).toEqual({
      text: '1,200',
      tooltip: '1200',
    });
  });

  it('normalizes primitive callback returns to text', () => {
    expect(
      createCrosstabCellFormatter('() => "formatted"')?.(params, columnInfo),
    ).toEqual({ text: 'formatted' });
    expect(
      createCrosstabCellFormatter('() => 123')?.(params, columnInfo),
    ).toEqual({ text: 123 });
    expect(
      createCrosstabCellFormatter('() => false')?.(params, columnInfo),
    ).toEqual({ text: false });
    expect(
      createCrosstabCellFormatter('() => null')?.(params, columnInfo),
    ).toBeUndefined();
  });

  it('supports object results with text, html, tooltip, className, and whitelisted style', () => {
    const formatter = createCrosstabCellFormatter(`() => ({
      text: 'Revenue',
      html: '<strong>Revenue</strong>',
      tooltip: 'Revenue tooltip',
      className: 'is-strong',
      style: {
        backgroundColor: '#111',
        color: '#fff',
        fontWeight: 'bold',
        fontStyle: 'italic',
        textAlign: 'right',
        textDecoration: 'underline',
        opacity: 0.8,
      },
    })`);

    expect(formatter?.(params, columnInfo)).toEqual({
      text: 'Revenue',
      html: '<strong>Revenue</strong>',
      tooltip: 'Revenue tooltip',
      className: 'is-strong',
      style: {
        backgroundColor: '#111',
        color: '#fff',
        fontWeight: 'bold',
        fontStyle: 'italic',
        textAlign: 'right',
        textDecoration: 'underline',
        opacity: 0.8,
      },
    });
  });

  it('rejects unsupported result fields', () => {
    const formatter = createCrosstabCellFormatter(
      "() => ({ text: 'ok', onClick: () => {} })",
    );

    expect(() => formatter?.(params, columnInfo)).toThrow(
      'unsupported result field "onClick"',
    );
  });

  it('rejects invalid supported result field value types during validation', () => {
    expect(() =>
      validateCrosstabCellFormatterCallback('() => ({ text: { bad: true } })'),
    ).toThrow('text');
    expect(() =>
      validateCrosstabCellFormatterCallback('() => ({ html: 123 })'),
    ).toThrow('html');
    expect(() =>
      validateCrosstabCellFormatterCallback('() => ({ tooltip: false })'),
    ).toThrow('tooltip');
    expect(() =>
      validateCrosstabCellFormatterCallback('() => ({ className: [] })'),
    ).toThrow('className');
  });

  it('rejects unsupported style fields', () => {
    const formatter = createCrosstabCellFormatter(
      "() => ({ style: { color: 'red', position: 'absolute' } })",
    );

    expect(() => formatter?.(params, columnInfo)).toThrow(
      'unsupported style field "position"',
    );
  });

  it('rejects invalid style containers during validation', () => {
    expect(() =>
      validateCrosstabCellFormatterCallback('() => ({ style: "color: red" })'),
    ).toThrow('style must be an object');
    expect(() =>
      validateCrosstabCellFormatterCallback('() => ({ style: [] })'),
    ).toThrow('style must be an object');
  });

  it('rejects unsupported style value types during validation', () => {
    expect(() =>
      validateCrosstabCellFormatterCallback(
        '() => ({ style: { backgroundColor: { bad: true } } })',
      ),
    ).toThrow('unsupported style value for field "backgroundColor"');
  });

  it('validates callbacks that depend on representative Crosstab row fields', () => {
    expect(() =>
      validateCrosstabCellFormatterCallback(
        '({ row }) => row.metric_name === "Sales" ? { text: row.metric_name_with_unit } : undefined',
      ),
    ).not.toThrow();
    expect(() =>
      validateCrosstabCellFormatterCallback(
        '({ row, cell }) => row.contract_type && row.amount === cell.rawValue ? { text: row.amount } : undefined',
      ),
    ).not.toThrow();
    expect(() =>
      validateCrosstabCellFormatterCallback(
        '({ column }) => column.metric === "amount" ? { text: column.metric } : undefined',
      ),
    ).not.toThrow();
  });

  it('rejects source that does not produce a function', () => {
    expect(() => createCrosstabCellFormatter('({ text: "nope" })')).toThrow(
      'must be a function',
    );
    expect(() => validateCrosstabCellFormatterCallback('42')).toThrow(
      'must be a function',
    );
    expect(() => validateCrosstabCellFormatterExpression('42')).toThrow(
      'must be a function',
    );
  });

  it('formats valid formatter source with Prettier after validation', async () => {
    await expect(
      formatCrosstabCellFormatterCallback(
        "({value})=>({text:value,style:{color:'red'}})",
      ),
    ).resolves.toBe(`({ value }) => ({ text: value, style: { color: "red" } });
`);
  });
});
