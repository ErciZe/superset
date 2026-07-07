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
  ERR_CONDITIONAL_FORMATTING,
  formatCrosstabValue,
  parseConditionalFormatting,
  resolveConditionalStyle,
} from '../../src/crosstab/formatting';

describe('crosstab formatting', () => {
  test('formats missing values as blank strings', () => {
    expect(formatCrosstabValue(null, ',.2f')).toBe('');
    expect(formatCrosstabValue(undefined, ',.2f')).toBe('');
  });

  test('formats numbers with the configured number format', () => {
    expect(formatCrosstabValue(1234.56, ',.1f')).toBe('1,234.6');
  });

  test('stringifies non-numeric values', () => {
    expect(formatCrosstabValue('North', ',.1f')).toBe('North');
  });

  test('resolves the first matching numeric conditional style', () => {
    expect(
      resolveConditionalStyle(10, [
        {
          operator: '>',
          value: 20,
          color: 'red',
        },
        {
          operator: '>=',
          value: 10,
          color: 'green',
          backgroundColor: 'white',
          arrow: 'up',
        },
      ]),
    ).toEqual({
      color: 'green',
      backgroundColor: 'white',
      arrow: 'up',
    });
  });

  test('supports all conditional operators and ignores non-numeric values', () => {
    expect(
      resolveConditionalStyle(9, [
        { operator: '<', value: 10, color: 'green' },
      ]),
    ).toEqual({ color: 'green' });
    expect(
      resolveConditionalStyle(10, [
        { operator: '<=', value: 10, color: 'green' },
      ]),
    ).toEqual({ color: 'green' });
    expect(
      resolveConditionalStyle(10, [
        { operator: '=', value: 10, color: 'green' },
      ]),
    ).toEqual({ color: 'green' });
    expect(
      resolveConditionalStyle(10, [
        { operator: '!=', value: 11, color: 'green' },
      ]),
    ).toEqual({ color: 'green' });
    expect(
      resolveConditionalStyle('10', [
        { operator: '>', value: 1, color: 'green' },
      ]),
    ).toEqual({});
  });

  test('parses declarative JSON conditional formatting rules', () => {
    expect(
      parseConditionalFormatting(
        '[{"metric":"amount","operator":">","value":0,"color":"#137333","backgroundColor":"#e6f4ea","arrow":"up"}]',
      ),
    ).toEqual([
      {
        metric: 'amount',
        operator: '>',
        value: 0,
        color: '#137333',
        backgroundColor: '#e6f4ea',
        arrow: 'up',
      },
    ]);
  });

  test('rejects invalid conditional formatting rules without evaluation', () => {
    expect(() => parseConditionalFormatting('not json')).toThrow(
      ERR_CONDITIONAL_FORMATTING,
    );
    expect(() =>
      parseConditionalFormatting([{ operator: '>', value: Number.NaN }]),
    ).toThrow(ERR_CONDITIONAL_FORMATTING);
    expect(() =>
      parseConditionalFormatting([
        { operator: '>', value: 1, arrow: 'sideways' } as never,
      ]),
    ).toThrow(ERR_CONDITIONAL_FORMATTING);
  });
});
