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
import { sharedControlComponents } from '@superset-ui/chart-controls';
import type { QueryFormMetric } from '@superset-ui/core';
import {
  fireEvent,
  render,
  screen,
} from '../../../../spec/helpers/testing-library';
import controlPanel from '../../src/plugin/controlPanel';
import CrosstabCalculatedFieldsControl from '../../src/plugin/CrosstabCalculatedFieldsControl';
import CrosstabDynamicGroupByControl from '../../src/plugin/CrosstabDynamicGroupByControl';
import CrosstabDynamicMetricControl from '../../src/plugin/CrosstabDynamicMetricControl';
import CrosstabFieldConfigControl from '../../src/plugin/CrosstabFieldConfigControl';
import CrosstabParametersControl from '../../src/plugin/CrosstabParametersControl';

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

function getControlNamesForSection(label: string) {
  const section = controlPanel.controlPanelSections.find(
    section => section?.label === label,
  );
  const names: string[] = [];

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

  return names;
}

function getControlConfig(name: string) {
  const controls = controlPanel.controlPanelSections.flatMap(section =>
    section?.controlSetRows.flatMap(row =>
      row.flatMap(control =>
        typeof control === 'object' &&
        control !== null &&
        'name' in control &&
        control.name === name &&
        'config' in control
          ? [control.config]
          : [],
      ),
    ),
  );

  return controls[0];
}

function catchWindowErrors(callback: () => void) {
  const errors: Error[] = [];
  const handler = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };

  window.addEventListener('error', handler);
  callback();
  window.removeEventListener('error', handler);

  return errors;
}

function sqlMetric(label: string, sqlExpression: string): QueryFormMetric {
  return {
    expressionType: 'SQL',
    label,
    sqlExpression,
  };
}

describe('crosstab controlPanel', () => {
  it('exposes the crosstab field entry with totals, formatting, and display controls', () => {
    const controlNames = getControlNames();

    expect(controlNames).toEqual(
      expect.arrayContaining([
        'crosstabFieldConfig',
        'dynamicGroupBy',
        'dynamicMetric',
        'parameters',
        'calculatedFields',
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

  it('places dynamic slot controls before crosstab totals controls', () => {
    const crosstabControlNames = getControlNamesForSection('Crosstab');
    const dynamicGroupByIndex = crosstabControlNames.indexOf('dynamicGroupBy');
    const dynamicMetricIndex = crosstabControlNames.indexOf('dynamicMetric');
    const parametersIndex = crosstabControlNames.indexOf('parameters');
    const calculatedFieldsIndex =
      crosstabControlNames.indexOf('calculatedFields');

    expect(dynamicGroupByIndex).toBeGreaterThanOrEqual(0);
    expect(dynamicMetricIndex).toBeGreaterThan(dynamicGroupByIndex);
    expect(parametersIndex).toBeGreaterThan(dynamicMetricIndex);
    expect(calculatedFieldsIndex).toBeGreaterThan(parametersIndex);
    [
      'showRowTotals',
      'showColumnTotals',
      'showRowSubtotals',
      'showColumnSubtotals',
    ].forEach(controlName => {
      const controlIndex = crosstabControlNames.indexOf(controlName);

      expect(controlIndex).toBeGreaterThanOrEqual(0);
      expect(dynamicGroupByIndex).toBeLessThan(controlIndex);
      expect(dynamicMetricIndex).toBeLessThan(controlIndex);
      expect(parametersIndex).toBeLessThan(controlIndex);
      expect(calculatedFieldsIndex).toBeLessThan(controlIndex);
    });
  });

  it('keeps crosstab field config, dynamic slots, and server pagination in order', () => {
    const controlNames = getControlNames();
    const crosstabFieldConfigIndex = controlNames.indexOf(
      'crosstabFieldConfig',
    );
    const dynamicGroupByIndex = controlNames.indexOf('dynamicGroupBy');
    const dynamicMetricIndex = controlNames.indexOf('dynamicMetric');
    const parametersIndex = controlNames.indexOf('parameters');
    const calculatedFieldsIndex = controlNames.indexOf('calculatedFields');
    const serverColumnPaginationIndex = controlNames.indexOf(
      'serverColumnPagination',
    );

    expect(crosstabFieldConfigIndex).toBeGreaterThanOrEqual(0);
    expect(dynamicGroupByIndex).toBeGreaterThan(crosstabFieldConfigIndex);
    expect(dynamicMetricIndex).toBeGreaterThan(dynamicGroupByIndex);
    expect(parametersIndex).toBeGreaterThan(dynamicMetricIndex);
    expect(calculatedFieldsIndex).toBeGreaterThan(parametersIndex);
    expect(serverColumnPaginationIndex).toBeGreaterThan(calculatedFieldsIndex);
  });

  it('exposes dynamic group-by as a chart-local slot editor', () => {
    expect(getControlConfig('dynamicGroupBy')).toEqual(
      expect.objectContaining({
        type: 'CrosstabDynamicGroupByControl',
        label: 'Dynamic group by',
        default: { enabled: false, slots: [] },
        renderTrigger: true,
        description: 'Configure chart-local dynamic group-by slots.',
      }),
    );
  });

  it('exposes dynamic metrics as a chart-local slot editor', () => {
    expect(getControlConfig('dynamicMetric')).toEqual(
      expect.objectContaining({
        type: 'CrosstabDynamicMetricControl',
        label: 'Dynamic metrics',
        default: { enabled: false, slots: [] },
        renderTrigger: true,
        description: 'Configure chart-local dynamic metric slots.',
      }),
    );
  });

  it('exposes crosstab parameters and calculated fields as chart-local controls', () => {
    expect(getControlConfig('parameters')).toEqual(
      expect.objectContaining({
        type: 'CrosstabParametersControl',
        label: 'Parameters',
        default: [],
        renderTrigger: true,
      }),
    );
    expect(getControlConfig('calculatedFields')).toEqual(
      expect.objectContaining({
        type: 'CrosstabCalculatedFieldsControl',
        label: 'Calculated fields',
        default: [],
        renderTrigger: true,
      }),
    );
  });

  it('registers dynamic slot and v4 control component types', () => {
    expect(CrosstabDynamicGroupByControl).toBeDefined();
    expect(CrosstabDynamicMetricControl).toBeDefined();
    expect(CrosstabParametersControl).toBeDefined();
    expect(CrosstabCalculatedFieldsControl).toBeDefined();
  });

  it('registers string control types in the shared Explore control registry', () => {
    expect(
      (sharedControlComponents as Record<string, unknown>)
        .CrosstabParametersControl,
    ).toBe(CrosstabParametersControl);
    expect(
      (sharedControlComponents as Record<string, unknown>)
        .CrosstabCalculatedFieldsControl,
    ).toBe(CrosstabCalculatedFieldsControl);
  });

  it('renders the crosstab parameters control default number parameter', () => {
    render(
      createElement(CrosstabParametersControl, {
        name: 'parameters',
        onChange: jest.fn(),
        value: [],
      }),
    );

    expect(screen.getByText('Number parameter')).toBeInTheDocument();
    expect(screen.getByDisplayValue('adjustmentRate')).toBeInTheDocument();
  });

  it('rejects invalid crosstab parameter numeric input', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabParametersControl, {
        name: 'parameters',
        onChange,
        value: [],
      }),
    );

    const errors = catchWindowErrors(() =>
      fireEvent.change(screen.getByLabelText('Parameter default'), {
        target: { value: '' },
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Crosstab parameter numeric fields require finite numbers.',
        }),
      ]),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves calculated fields from selected crosstab metrics', () => {
    const onChange = jest.fn();
    const setControlValue = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');
    const profitMetric = sqlMetric('profit', 'SUM(gross_profit)');

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        actions: { setControlValue },
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: '销售额', semantic: 'additive' },
              { metric: profitMetric, label: '毛利', semantic: 'additive' },
            ],
          },
        },
        name: 'calculatedFields',
        onChange,
        savedMetrics: [{ metric_name: 'unselected_metric' }],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        label: '含参毛利率',
        inputs: expect.objectContaining({
          leftMetric: salesMetric,
          rightMetric: profitMetric,
          parameterName: 'adjustmentRate',
        }),
      }),
    ]);
    expect(setControlValue).toHaveBeenCalledWith(
      'crosstabFieldConfig',
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            metric: '含参毛利率',
            label: '含参毛利率',
            semantic: 'ratio',
            formatString: '.2%',
            calculatedFieldId: '含参毛利率',
          }),
        ]),
      }),
    );
  });

  it('rejects saving calculated fields without crosstab field config updates', () => {
    const onChange = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');
    const profitMetric = sqlMetric('profit', 'SUM(gross_profit)');

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: '销售额', semantic: 'additive' },
              { metric: profitMetric, label: '毛利', semantic: 'additive' },
            ],
          },
        },
        name: 'calculatedFields',
        onChange,
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));

    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save')),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Calculated fields require crosstab field config updates.',
        }),
      ]),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects non-SQL saved metrics for calculated fields', () => {
    const onChange = jest.fn();
    const setControlValue = jest.fn();

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        actions: { setControlValue },
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
        },
        name: 'calculatedFields',
        onChange,
        savedMetrics: [
          { metric_name: 'saved_sales' },
          { metric_name: 'saved_profit' },
        ],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));

    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save')),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Calculated fields require two saved metrics.',
        }),
      ]),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(setControlValue).not.toHaveBeenCalled();
  });

  it('resolves calculated field metrics after selected chart metrics load', () => {
    const onChange = jest.fn();
    const setControlValue = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');
    const profitMetric = sqlMetric('profit', 'SUM(gross_profit)');
    const { rerender } = render(
      createElement(CrosstabCalculatedFieldsControl, {
        actions: { setControlValue },
        name: 'calculatedFields',
        onChange,
        savedMetrics: [{ metric_name: 'unselected_metric' }],
        value: [],
      }),
    );

    rerender(
      createElement(CrosstabCalculatedFieldsControl, {
        actions: { setControlValue },
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: '销售额', semantic: 'additive' },
              { metric: profitMetric, label: '毛利', semantic: 'additive' },
            ],
          },
        },
        name: 'calculatedFields',
        onChange,
        savedMetrics: [{ metric_name: 'unselected_metric' }],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        inputs: expect.objectContaining({
          leftMetric: salesMetric,
          rightMetric: profitMetric,
        }),
      }),
    ]);
  });

  it('renders dynamic metric control when saved value omits slots', () => {
    render(
      createElement(CrosstabDynamicMetricControl, {
        name: 'dynamicMetric',
        onChange: jest.fn(),
        value: { enabled: false } as never,
      }),
    );

    expect(screen.getByText('Enable dynamic metrics')).toBeInTheDocument();
    expect(screen.getByText('Add slot')).toBeInTheDocument();
  });

  it('renders dynamic group-by control when saved value omits slots', () => {
    render(
      createElement(CrosstabDynamicGroupByControl, {
        name: 'dynamicGroupBy',
        onChange: jest.fn(),
        value: { enabled: false } as never,
      }),
    );

    expect(screen.getByText('Enable dynamic group by')).toBeInTheDocument();
    expect(screen.getByText('Add slot')).toBeInTheDocument();
  });

  it('keeps legacy field controls hidden for saved chart compatibility', () => {
    expect(getControlConfig('groupbyRows')).toEqual(
      expect.objectContaining({ hidden: true }),
    );
    expect(getControlConfig('groupbyColumns')).toEqual(
      expect.objectContaining({ hidden: true }),
    );
    expect(getControlConfig('metrics')).toEqual(
      expect.objectContaining({ hidden: true }),
    );
  });

  it('renders field options without alias or row-column transfer actions', () => {
    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange: jest.fn(),
        value: {
          rows: [{ field: 'country' }, { field: 'shop' }],
          columns: [{ field: 'biz_date' }],
        },
      }),
    );

    expect(screen.queryByLabelText('Field alias')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Metric alias')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Subtotal')).toBeInTheDocument();
    expect(screen.queryByText('To columns')).not.toBeInTheDocument();
    expect(screen.queryByText('To rows')).not.toBeInTheDocument();
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
