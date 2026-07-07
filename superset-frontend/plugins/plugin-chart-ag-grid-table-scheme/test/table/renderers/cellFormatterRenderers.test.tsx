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
import { GenericDataType } from '@apache-superset/core/common';
import { render, screen } from '@superset-ui/core/spec';
import { TextCellRenderer } from '../../../src/table/renderers/TextCellRenderer';
import { NumericCellRenderer } from '../../../src/table/renderers/NumericCellRenderer';

jest.mock('../../../src/table/utils/useTableTheme', () => ({
  useIsDark: () => false,
}));

const column = {
  key: 'value',
  label: 'Value',
  dataType: GenericDataType.String,
  isNumeric: false,
  isMetric: false,
  isPercentMetric: false,
  config: {},
};

const baseParams = {
  value: 'Default',
  valueFormatted: 'Default',
  node: {},
  api: {
    getAllGridColumns: () => [],
  },
  colDef: { field: 'value' },
  columns: [column],
  allowRenderHtml: true,
  col: column,
  hasBasicColorFormatters: false,
  basicColorFormatters: [],
  valueRange: null,
  alignPositiveNegative: false,
  colorPositiveNegative: false,
};

describe('cell formatter renderers', () => {
  test('applies formatter class and tooltip without replacing text cells', () => {
    render(
      <TextCellRenderer
        {...(baseParams as any)}
        additionalCellFormatter={() => ({
          className: 'matrix-cell-note',
          tooltip: 'Raw value',
        })}
      />,
    );

    const cell = screen.getByText('Default');
    expect(cell).toHaveClass('matrix-cell-note');
    expect(cell).toHaveAttribute('title', 'Raw value');
  });

  test('applies formatter class and tooltip without replacing numeric cells', () => {
    render(
      <NumericCellRenderer
        {...(baseParams as any)}
        value={42}
        valueFormatted="42"
        col={{
          ...column,
          dataType: GenericDataType.Numeric,
          isNumeric: true,
        }}
        additionalCellFormatter={() => ({
          className: 'matrix-cell-note',
          tooltip: 'Raw value',
        })}
      />,
    );

    const cell = screen.getByText('42').parentElement as HTMLElement;
    expect(cell).toHaveClass('matrix-cell-note');
    expect(cell).toHaveAttribute('title', 'Raw value');
  });
});
