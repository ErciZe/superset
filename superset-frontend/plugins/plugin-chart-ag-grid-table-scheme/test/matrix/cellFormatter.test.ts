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

  it('formats dashboard threshold backgrounds from raw ratio values', () => {
    const formatter = createMatrixCellFormatter(`
      ({ row, rawValue, value: displayValue }) => {
        const metricName = String(
          row.metric_name_with_unit ?? row.metric_name ?? "",
        )
          .replace(/（/g, "(")
          .replace(/）/g, ")")
          .replace(/\\s+/g, "");
        const metricBaseName = metricName.replace(/\\([^)]*\\)$/, "");
        const rawInput = rawValue ?? displayValue;
        const rawNumber =
          typeof rawInput === "number"
            ? rawInput
            : Number(String(rawInput).replace(/[%，,]/g, ""));
        const value =
          Math.abs(rawNumber) > 1 ? Math.abs(rawNumber) / 100 : Math.abs(rawNumber);
        const redThresholds = {
          退款金额占比: 0.08,
          FBA发货费占比: 0.3,
          总仓储费占比: 0.02,
          广告花费占比: 0.23,
          采购成本占比: 0.17,
        };

        if (!Number.isFinite(rawNumber)) {
          return undefined;
        }

        if (
          metricBaseName === "广告花费占比" &&
          value >= 0 &&
          value < 0.18
        ) {
          return {
            style: {
              backgroundColor: "#52c41a",
              color: "#fff",
              fontWeight: "bold",
            },
            tooltip: "广告花费占比低于 18%",
          };
        }

        if (
          Object.prototype.hasOwnProperty.call(redThresholds, metricBaseName) &&
          value >= redThresholds[metricBaseName]
        ) {
          return {
            style: {
              backgroundColor: "#ff4d4f",
              color: "#fff",
              fontWeight: "bold",
            },
            tooltip: metricName + "超过阈值",
          };
        }

        return undefined;
      }
    `);

    const baseParams = {
      value: '10.00%',
      rowIndex: 0,
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
    };

    expect(
      formatter?.({
        ...baseParams,
        value: '-8.00%',
        data: {
          metric_name_with_unit: '退款金额占比（%）',
        },
      } as any),
    ).toEqual({
      style: {
        backgroundColor: '#ff4d4f',
        color: '#fff',
        fontWeight: 'bold',
      },
      tooltip: '退款金额占比(%)超过阈值',
    });

    expect(
      formatter?.({
        ...baseParams,
        data: {
          metric_name_with_unit: '广告花费占比（求和）',
          __matrix_raw_value____matrix_col__2026: -17,
        },
      } as any),
    ).toEqual({
      style: {
        backgroundColor: '#52c41a',
        color: '#fff',
        fontWeight: 'bold',
      },
      tooltip: '广告花费占比低于 18%',
    });

    expect(
      formatter?.({
        ...baseParams,
        data: {
          metric_name_with_unit: '广告花费占比(求和)',
          __matrix_raw_value____matrix_col__2026: 0.23,
        },
      } as any),
    ).toEqual({
      style: {
        backgroundColor: '#ff4d4f',
        color: '#fff',
        fontWeight: 'bold',
      },
      tooltip: '广告花费占比(求和)超过阈值',
    });

    expect(
      formatter?.({
        ...baseParams,
        data: {
          metric_name_with_unit: 'FBA发货费占比(求和)',
          __matrix_raw_value____matrix_col__2026: 0.299,
        },
      } as any),
    ).toBeUndefined();
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
    const formatted = await formatMatrixCellFormatterCallback(
      '({rawValue})=>({text:rawValue})',
    );

    expect(formatted).toBe(`({ rawValue }) => ({ text: rawValue });\n`);
    expect(validateMatrixCellFormatterCallback(formatted)).toBe(false);
    expect(
      createMatrixCellFormatter(formatted)?.({
        data: {
          __matrix_raw_value____matrix_col__sample: 12,
        },
        value: '12',
        rowIndex: 0,
        colDef: {
          field: '__matrix_col__sample',
          headerName: '示例列',
        },
        col: {
          key: '__matrix_col__sample',
          label: '示例列',
          dataType: 'STRING',
          config: {},
        },
      } as any),
    ).toEqual({ text: 12 });
  });

  it('validates callback source with a trailing semicolon', () => {
    expect(
      validateMatrixCellFormatterCallback(
        '({ rawValue }) => ({ text: rawValue });',
      ),
    ).toBe(false);
  });

  it('keeps formatted callback source stable when re-validating', async () => {
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
