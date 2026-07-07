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
import getCellStyle from '../../../src/table/utils/getCellStyle';

describe('getCellStyle', () => {
  test('merges additional cell styles with existing alignment', () => {
    const style = getCellStyle({
      value: 15,
      colDef: { field: 'value' },
      rowIndex: 0,
      hasColumnColorFormatters: false,
      columnColorFormatters: [],
      hasBasicColorFormatters: false,
      col: {
        key: 'value',
        label: 'Value',
        isNumeric: true,
        config: {},
      },
      node: {},
      additionalCellStyle: () => ({
        backgroundColor: '#00aa00',
      }),
    } as any);

    expect(style).toEqual({
      backgroundColor: '#00aa00',
      textAlign: 'right',
    });
  });

  test('merges additional formatter styles after color styles', () => {
    const style = getCellStyle({
      value: 15,
      colDef: { field: 'value' },
      rowIndex: 0,
      hasColumnColorFormatters: false,
      columnColorFormatters: [],
      hasBasicColorFormatters: false,
      col: {
        key: 'value',
        label: 'Value',
        isNumeric: true,
        config: {},
      },
      node: {},
      additionalCellStyle: () => ({
        backgroundColor: '#00aa00',
      }),
      additionalCellFormatter: () => ({
        style: {
          backgroundColor: '#aa0000',
          color: '#ffffff',
        },
      }),
    } as any);

    expect(style).toEqual({
      backgroundColor: '#aa0000',
      color: '#ffffff',
      textAlign: 'right',
    });
  });
});
