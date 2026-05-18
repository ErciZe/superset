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
import {
  MATRIX_CELL_FORMATTER_CALLBACK_DEFAULT,
  createMatrixCellFormatter,
  formatMatrixCellFormatterCallback,
  validateMatrixCellFormatterCallback,
} from '../../src/matrix/cellFormatter';

describe('matrix cell formatter', () => {
  it('formats matrix cells with a JavaScript callback', () => {
    const formatter = createMatrixCellFormatter(`
      ({ row, rawValue, cell, column, rowIndex }) => {
        if (row.metric_name === "Profit" && rawValue < 0) {
          return {
            text: "(" + (rawValue * -1) + ")",
            style: { color: "#d33", fontWeight: "bold" },
            tooltip: column.label + " / " + rowIndex
          };
        }
        return { text: cell.value };
      }
    `);

    expect(
      formatter?.({
        data: {
          metric_name: 'Profit',
          __matrix_raw_value____matrix_col__2026: -12,
        },
        value: '-12',
        rowIndex: 2,
        colDef: {
          field: '__matrix_col__2026',
          headerName: '2026',
        },
        col: {
          key: '__matrix_col__2026',
          label: '2026',
          dataType: 'STRING',
          config: {},
        },
      } as any),
    ).toEqual({
      text: '(12)',
      style: { color: '#d33', fontWeight: 'bold' },
      tooltip: '2026 / 2',
    });
  });

  it('uses the default commented example as documentation only', () => {
    expect(validateMatrixCellFormatterCallback('')).toBe(false);
    expect(
      validateMatrixCellFormatterCallback(
        MATRIX_CELL_FORMATTER_CALLBACK_DEFAULT,
      ),
    ).toBe(false);
    expect(
      createMatrixCellFormatter(MATRIX_CELL_FORMATTER_CALLBACK_DEFAULT),
    ).toBeUndefined();
  });

  it('supports Math.abs threshold formatting for refund ratio rows', () => {
    const formatter = createMatrixCellFormatter(`
      ({ row, rawValue }) => {
        if (
          row.metric_name_with_unit === "退款金额占比（%）" &&
          Math.abs(rawValue) > 8
        ) {
          return {
            style: {
              backgroundColor: "#ff4d4f",
              color: "#fff",
              fontWeight: "bold"
            },
            tooltip: "退款金额占比超过 8%"
          };
        }
        return undefined;
      }
    `);

    expect(
      formatter?.({
        data: {
          metric_name_with_unit: '退款金额占比（%）',
          __matrix_raw_value____matrix_total__: -10.12,
        },
        value: '-10.12%',
        rowIndex: 1,
        colDef: {
          field: '__matrix_total__',
          headerName: 'Total',
        },
        col: {
          key: '__matrix_total__',
          label: 'Total',
          dataType: 'STRING',
          config: {},
        },
      } as any),
    ).toEqual({
      style: {
        backgroundColor: '#ff4d4f',
        color: '#fff',
        fontWeight: 'bold',
      },
      tooltip: '退款金额占比超过 8%',
    });
  });

  it('validates callback source and returned fields', () => {
    expect(() =>
      validateMatrixCellFormatterCallback('{ text: value }'),
    ).toThrow(/must be a function/);
    expect(() =>
      validateMatrixCellFormatterCallback(
        '({ value }) => missingGlobal + value',
      ),
    ).toThrow(/missingGlobal/);
    expect(() =>
      validateMatrixCellFormatterCallback('() => ({ onclick: "x" })'),
    ).toThrow(/unsupported result field/);
    expect(() =>
      validateMatrixCellFormatterCallback(
        '() => ({ style: { position: "fixed" } })',
      ),
    ).toThrow(/unsupported style field/);
  });

  it('formats callback source with prettier', async () => {
    await expect(
      formatMatrixCellFormatterCallback('({rawValue})=>({text:rawValue})'),
    ).resolves.toBe(`({ rawValue }) => ({ text: rawValue });\n`);
  });

  it('preserves string literal values while formatting callback source', async () => {
    await expect(
      formatMatrixCellFormatterCallback('()=>({text:"a=>b"})'),
    ).resolves.toBe(`() => ({ text: "a=>b" });\n`);
  });

  it('rejects invalid callback source while formatting', async () => {
    await expect(
      formatMatrixCellFormatterCallback('{ text: value }'),
    ).rejects.toThrow(/must be a function/);
  });
});
