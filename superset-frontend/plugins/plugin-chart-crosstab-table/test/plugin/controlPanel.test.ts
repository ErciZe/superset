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
import { createElement } from 'react';
import {
  fireEvent,
  render,
  screen,
} from '../../../../spec/helpers/testing-library';
import controlPanel from '../../src/plugin/controlPanel';
import CrosstabFieldConfigControl from '../../src/plugin/CrosstabFieldConfigControl';

jest.mock(
  '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect',
  () => ({
    DndColumnSelect: () => null,
  }),
);

jest.mock(
  '../../../../src/explore/components/controls/DndColumnSelectControl',
  () => ({
    DndMetricSelect: () => null,
  }),
);

function getControlNames() {
  const names: string[] = [];

  controlPanel.controlPanelSections.forEach(section => {
    section?.controlSetRows.forEach(row => {
      row.forEach(control => {
        if (
          typeof control === 'object' &&
          control !== null &&
          'name' in control &&
          typeof control.name === 'string'
        ) {
          names.push(control.name);
        }
      });
    });
  });

  return names;
}

describe('crosstab controlPanel', () => {
  it('exposes v1 crosstab query, totals, formatting, and display controls', () => {
    expect(getControlNames()).toEqual(
      expect.arrayContaining([
        'crosstabFieldConfig',
        'groupbyRows',
        'groupbyColumns',
        'metrics',
        'showRowTotals',
        'showColumnTotals',
        'showRowSubtotals',
        'showColumnSubtotals',
        'maxGeneratedColumns',
        'serverColumnPagination',
        'generatedColumnWidth',
        'columnPageSize',
        'defaultRowExpandedDepth',
        'numberFormat',
        'conditionalFormatting',
      ]),
    );
  });

  it('updates only the selected metric semantic', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange,
        value: {
          metrics: [
            { metric: 'amount', label: 'Amount' },
            { metric: 'margin_rate', label: 'Margin %', semantic: 'ratio' },
          ],
        },
      }),
    );

    fireEvent.change(screen.getAllByLabelText('Metric semantic')[0], {
      target: { value: 'additive' },
    });

    expect(onChange).toHaveBeenCalledWith({
      rows: [],
      columns: [],
      metrics: [
        { metric: 'amount', label: 'Amount', semantic: 'additive' },
        { metric: 'margin_rate', label: 'Margin %', semantic: 'ratio' },
      ],
      semanticOverrideField: undefined,
      semanticOverrides: [],
    });
  });

  it('ignores invalid metric semantic values', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange,
        value: {
          metrics: [{ metric: 'amount', label: 'Amount' }],
        },
      }),
    );

    fireEvent.change(screen.getByLabelText('Metric semantic'), {
      target: { value: 'not-a-semantic' },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects invalid semantic override JSON without emitting changes', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange,
        value: {
          rows: [{ field: 'metric_name_with_unit' }],
          semanticOverrideField: 'metric_name_with_unit',
          semanticOverrides: [],
        },
      }),
    );

    fireEvent.change(screen.getByLabelText('Semantic overrides'), {
      target: { value: '[invalid' },
    });

    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('parses valid semantic override JSON', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange,
        value: {
          rows: [{ field: 'metric_name_with_unit' }],
          semanticOverrideField: 'metric_name_with_unit',
          semanticOverrides: [],
        },
      }),
    );

    fireEvent.change(screen.getByLabelText('Semantic overrides'), {
      target: {
        value: JSON.stringify([
          { value: '销售额（金额）', semantic: 'additive', label: 'Sales' },
          { value: '毛利率（%）', semantic: 'ratio', hidden: true },
        ]),
      },
    });

    expect(onChange).toHaveBeenCalledWith({
      rows: [{ field: 'metric_name_with_unit' }],
      columns: [],
      metrics: [],
      semanticOverrideField: 'metric_name_with_unit',
      semanticOverrides: [
        { value: '销售额（金额）', semantic: 'additive' },
        { value: '毛利率（%）', semantic: 'ratio' },
      ],
    });
  });

  it('accepts non-string semantic override values from JSON', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange,
        value: {
          rows: [{ field: 'metric_code' }],
          semanticOverrideField: 'metric_code',
          semanticOverrides: [],
        },
      }),
    );

    fireEvent.change(screen.getByLabelText('Semantic overrides'), {
      target: {
        value: JSON.stringify([
          { value: 101, semantic: 'ratio' },
          { value: true, semantic: 'distinct' },
          { value: null, semantic: 'unknown' },
        ]),
      },
    });

    expect(onChange).toHaveBeenCalledWith({
      rows: [{ field: 'metric_code' }],
      columns: [],
      metrics: [],
      semanticOverrideField: 'metric_code',
      semanticOverrides: [
        { value: 101, semantic: 'ratio' },
        { value: true, semantic: 'distinct' },
        { value: null, semantic: 'unknown' },
      ],
    });
  });
});
