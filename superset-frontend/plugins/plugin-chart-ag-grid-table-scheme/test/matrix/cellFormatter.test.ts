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
import { createMatrixCellFormatter } from '../../src/matrix/cellFormatter';

describe('matrix cell formatter', () => {
  it('formats matrix cells with whitelisted callback arguments', () => {
    const formatter = createMatrixCellFormatter(`
      row.metric_name === "Profit" && rawValue < 0
        ? {
            text: "(" + (rawValue * -1) + ")",
            style: { color: "#d33", fontWeight: "bold" },
            tooltip: column.label + " / " + rowIndex
          }
        : { text: cell.value }
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

  it('allows console without exposing browser globals', () => {
    const formatter = createMatrixCellFormatter(`
      (console.log(cell.field), { text: value })
    `);

    expect(formatter).toBeDefined();
    expect(() =>
      createMatrixCellFormatter('{ text: window.location.href }'),
    ).toThrow(/window/);
    expect(() =>
      createMatrixCellFormatter('{ text: document.cookie }'),
    ).toThrow(/document/);
  });

  it('blocks prototype escape properties', () => {
    expect(() =>
      createMatrixCellFormatter('{ text: row.constructor.name }'),
    ).toThrow(/constructor/);
    expect(() =>
      createMatrixCellFormatter('{ text: row["__proto__"] }'),
    ).toThrow(/__proto__/);
    expect(() =>
      createMatrixCellFormatter('{ text: console.log.bind(console) }'),
    ).toThrow(/bind/);
  });
});
