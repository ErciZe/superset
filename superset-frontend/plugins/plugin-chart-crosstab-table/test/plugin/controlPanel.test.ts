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
  () => {
    const { createElement } = jest.requireActual('react');

    return {
      DndColumnSelect: ({ label }: { label?: string }) =>
        label ? createElement('div', null, label) : null,
    };
  },
);

jest.mock(
  '../../../../src/explore/components/controls/DndColumnSelectControl',
  () => {
    const { createElement } = jest.requireActual('react');

    return {
      DndMetricSelect: ({ label }: { label?: string }) =>
        label ? createElement('div', null, label) : null,
    };
  },
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

const existingProfitRateField = {
  id: 'profitRate',
  name: 'Profit rate',
  resultType: 'percent' as const,
  formatString: '.2%',
  ast: {
    kind: 'pct' as const,
    numerator: { kind: 'metric_ref' as const, metricId: 'sales' },
    denominator: { kind: 'metric_ref' as const, metricId: 'profit' },
  },
};

describe('crosstab controlPanel', () => {
  it('exposes the crosstab field entry with totals, formatting, and display controls', () => {
    const controlNames = getControlNames();

    expect(controlNames).toEqual(
      expect.arrayContaining([
        'crosstabFieldConfig',
        'datasourceMetrics',
        'dynamicGroupBy',
        'dynamicMetric',
        'crosstabParameters',
        'crosstabCalculatedFields',
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

  it('keeps datasource saved metrics in hidden form data for calculated fields', () => {
    const config = getControlConfig('datasourceMetrics') as {
      hidden?: boolean;
      mapStateToProps?: (state: {
        datasource?: { metrics?: QueryFormMetric[] };
      }) => { value: QueryFormMetric[] };
      type?: string;
    };
    const metrics = [sqlMetric('sales', 'SUM(sales_amount)')];

    expect(config).toEqual(
      expect.objectContaining({
        type: 'HiddenControl',
        hidden: true,
        default: [],
      }),
    );
    expect(config.mapStateToProps?.({ datasource: { metrics } })).toEqual({
      value: metrics,
    });
  });

  it('places dynamic slot controls before crosstab totals controls', () => {
    const crosstabControlNames = getControlNamesForSection('Crosstab');
    const dynamicGroupByIndex = crosstabControlNames.indexOf('dynamicGroupBy');
    const dynamicMetricIndex = crosstabControlNames.indexOf('dynamicMetric');
    const parametersIndex = crosstabControlNames.indexOf('crosstabParameters');
    const calculatedFieldsIndex = crosstabControlNames.indexOf(
      'crosstabCalculatedFields',
    );

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
    const parametersIndex = controlNames.indexOf('crosstabParameters');
    const calculatedFieldsIndex = controlNames.indexOf(
      'crosstabCalculatedFields',
    );
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
    expect(getControlConfig('crosstabParameters')).toEqual(
      expect.objectContaining({
        type: 'CrosstabParametersControl',
        label: 'Parameters',
        default: [],
        renderTrigger: true,
      }),
    );
    expect(getControlConfig('crosstabCalculatedFields')).toEqual(
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

  it('creates canonical numeric crosstab parameters and clears legacy parameters', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const { rerender } = render(
      createElement(CrosstabParametersControl, {
        name: 'crosstabParameters',
        onControlChange,
        onChange,
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('Add number parameter'));
    fireEvent.change(screen.getByLabelText('Parameter id'), {
      target: { value: 'adjustmentRate' },
    });
    fireEvent.change(screen.getByLabelText('Parameter name'), {
      target: { value: 'adjustmentRate' },
    });
    fireEvent.change(screen.getByLabelText('Parameter label'), {
      target: { value: 'Adjustment rate' },
    });
    fireEvent.change(screen.getByLabelText('Parameter default'), {
      target: { value: '1.25' },
    });
    fireEvent.change(screen.getByLabelText('Parameter min'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('Parameter max'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Parameter step'), {
      target: { value: '0.25' },
    });
    fireEvent.change(screen.getByLabelText('Parameter unit'), {
      target: { value: '%' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenLastCalledWith([
      {
        id: 'adjustmentRate',
        kind: 'number',
        name: 'adjustmentRate',
        label: 'Adjustment rate',
        defaultValue: 1.25,
        min: 0,
        max: 2,
        step: 0.25,
        unit: '%',
      },
    ]);
    expect(onControlChange).toHaveBeenCalledWith('parameters', undefined);

    rerender(
      createElement(CrosstabParametersControl, {
        name: 'crosstabParameters',
        onControlChange,
        onChange,
        value: onChange.mock.calls[0][0],
      }),
    );

    fireEvent.click(screen.getByText('Add number parameter'));
    fireEvent.change(screen.getByLabelText('Parameter id'), {
      target: { value: 'taxRate' },
    });
    fireEvent.change(screen.getByLabelText('Parameter name'), {
      target: { value: 'taxRate' },
    });
    fireEvent.change(screen.getByLabelText('Parameter label'), {
      target: { value: 'Tax rate' },
    });
    fireEvent.change(screen.getByLabelText('Parameter default'), {
      target: { value: '0.5' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenLastCalledWith([
      {
        id: 'adjustmentRate',
        kind: 'number',
        name: 'adjustmentRate',
        label: 'Adjustment rate',
        defaultValue: 1.25,
        min: 0,
        max: 2,
        step: 0.25,
        unit: '%',
      },
      {
        id: 'taxRate',
        kind: 'number',
        name: 'taxRate',
        label: 'Tax rate',
        defaultValue: 0.5,
      },
    ]);
  });

  it('rejects invalid crosstab parameter numeric input', () => {
    const onChange = jest.fn();

    render(
      createElement(CrosstabParametersControl, {
        name: 'crosstabParameters',
        onChange,
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('Add number parameter'));
    fireEvent.change(screen.getByLabelText('Parameter default'), {
      target: { value: '' },
    });
    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save')),
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

  it('keeps parameter edit targets stable when another parameter is deleted', () => {
    const onChange = jest.fn();
    const value = [
      {
        id: 'rate',
        kind: 'number' as const,
        name: 'rate',
        label: 'Rate',
        defaultValue: 1,
      },
      {
        id: 'tax',
        kind: 'number' as const,
        name: 'tax',
        label: 'Tax',
        defaultValue: 0.5,
      },
    ];
    const { rerender } = render(
      createElement(CrosstabParametersControl, {
        name: 'crosstabParameters',
        onChange,
        value,
      }),
    );

    fireEvent.click(screen.getAllByText('Edit')[1]);
    fireEvent.change(screen.getByLabelText('Parameter label'), {
      target: { value: 'Market code' },
    });
    fireEvent.click(screen.getAllByText('Delete')[0]);

    rerender(
      createElement(CrosstabParametersControl, {
        name: 'crosstabParameters',
        onChange,
        value: onChange.mock.calls[0][0],
      }),
    );

    fireEvent.click(screen.getByText('Update'));

    expect(onChange).toHaveBeenLastCalledWith([
      {
        id: 'tax',
        kind: 'number',
        name: 'tax',
        label: 'Market code',
        defaultValue: 0.5,
      },
    ]);
  });

  it('saves a pct calculated field and appends crosstab metric config', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
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
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        savedMetrics: [{ metric_name: 'unselected_metric' }],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.change(screen.getByLabelText('Calculated field id'), {
      target: { value: 'profitRate' },
    });
    fireEvent.change(screen.getByLabelText('Calculated field name'), {
      target: { value: 'Profit rate' },
    });
    expect(screen.getAllByLabelText('Numerator metric')).not.toHaveLength(0);
    expect(screen.getAllByLabelText('Denominator metric')).not.toHaveLength(0);
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'profitRate',
        name: 'Profit rate',
        resultType: 'percent',
        formatString: '.2%',
        ast: {
          kind: 'pct',
          numerator: { kind: 'metric_ref', metricId: 'sales' },
          denominator: { kind: 'metric_ref', metricId: 'profit' },
        },
      },
    ]);
    expect(onControlChange).toHaveBeenCalledWith(
      'crosstabFieldConfig',
      expect.objectContaining({
        metrics: expect.arrayContaining([
          expect.objectContaining({
            metric: 'Profit rate',
            label: 'Profit rate',
            semantic: 'ratio',
            formatString: '.2%',
            calculatedFieldId: 'profitRate',
          }),
        ]),
      }),
    );
  });

  it('shows a structured preview and validation summary for calculated-field drafts', () => {
    render(
      createElement(CrosstabCalculatedFieldsControl, {
        actions: { setControlValue: jest.fn() },
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: 'sales', label: 'Sales', semantic: 'additive' },
              { metric: 'profit', label: 'Profit', semantic: 'additive' },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onChange: jest.fn(),
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));

    expect(screen.getByText('Expression preview')).toBeInTheDocument();
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByText('Ready to save.')).toBeInTheDocument();
  });

  it('duplicates a calculated field and clears legacy v4 write-through controls', () => {
    const onChange = jest.fn();
    const actions = { setControlValue: jest.fn() };

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        actions,
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabParameters: [
            {
              id: 'param_adjustment',
              kind: 'number',
              name: 'adjustmentRate',
              label: 'Adjustment',
              defaultValue: 1,
            },
          ],
          crosstabFieldConfig: {
            metrics: [
              {
                metric: 'Margin rate',
                label: 'Margin rate',
                calculatedFieldId: 'marginRate',
                semantic: 'ratio',
                formatString: '.2%',
              },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onChange,
        savedMetrics: [
          { metric_name: 'profit', expression: 'SUM(gross_profit)' },
          { metric_name: 'sales', expression: 'SUM(sales_amount)' },
        ],
        value: [
          {
            id: 'marginRate',
            name: 'Margin rate',
            resultType: 'percent',
            formatString: '.2%',
            ast: {
              kind: 'pct',
              numerator: { kind: 'metric_ref', metricId: 'profit' },
              denominator: { kind: 'metric_ref', metricId: 'sales' },
            },
          },
        ],
      }),
    );

    fireEvent.click(screen.getByText('Duplicate'));
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(actions.setControlValue).toHaveBeenCalledWith(
      'calculatedFields',
      [],
    );
    expect(actions.setControlValue).toHaveBeenCalledWith('metrics', []);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'marginRate', name: 'Margin rate' }),
      expect.objectContaining({
        id: 'marginRate_copy',
        name: 'Margin rate Copy',
      }),
    ]);
  });

  it('creates pct fields from saved metric names and datasource metric records', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [{ metric: 'saved_sales' }, { metric: 'saved_profit' }],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        savedMetrics: [
          { metric_name: 'saved_sales', expression: 'SUM(sales_amount)' },
          {
            metric_name: 'saved_profit',
            verbose_name: 'Saved profit',
            expression: 'SUM(gross_profit)',
          },
        ],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        ast: {
          kind: 'pct',
          numerator: { kind: 'metric_ref', metricId: 'saved_sales' },
          denominator: { kind: 'metric_ref', metricId: 'saved_profit' },
        },
      }),
    ]);
  });

  it('edits calculated field refs from saved metrics when only placeholder is selected', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const field = {
      id: 'calc_margin_pct_v4',
      name: 'V4示例毛利率',
      resultType: 'percent' as const,
      formatString: '.2%',
      ast: {
        kind: 'pct' as const,
        numerator: {
          kind: 'metric_ref' as const,
          metricId: 'v4_gross_profit_sum',
        },
        denominator: {
          kind: 'metric_ref' as const,
          metricId: 'v4_sales_amount_sum',
        },
      },
    };

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              {
                metric: 'V4示例毛利率',
                label: 'V4示例毛利率',
                calculatedFieldId: 'calc_margin_pct_v4',
                semantic: 'ratio',
                formatString: '.2%',
              },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        savedMetrics: [
          {
            metric_name: 'v4_gross_profit_sum',
            verbose_name: 'V4毛利',
            expression: 'SUM(gross_profit)',
          },
          {
            metric_name: 'v4_sales_amount_sum',
            verbose_name: 'V4销售额',
            expression: 'SUM(sales_amount)',
          },
        ],
        value: [field],
      }),
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'calc_margin_pct_v4',
        name: 'V4示例毛利率',
        ast: {
          kind: 'pct',
          numerator: {
            kind: 'metric_ref',
            metricId: 'v4_gross_profit_sum',
          },
          denominator: {
            kind: 'metric_ref',
            metricId: 'v4_sales_amount_sum',
          },
        },
      }),
    ]);
  });

  it('resolves verbose-name metric refs to the correct saved metrics when editing', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const field = {
      id: 'calc_margin_pct_v4',
      name: 'V4示例毛利率',
      resultType: 'percent' as const,
      formatString: '.2%',
      ast: {
        kind: 'pct' as const,
        numerator: {
          kind: 'metric_ref' as const,
          metricId: 'V4毛利',
        },
        denominator: {
          kind: 'metric_ref' as const,
          metricId: 'V4销售额',
        },
      },
    };

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              {
                metric: 'V4示例毛利率',
                label: 'V4示例毛利率',
                calculatedFieldId: 'calc_margin_pct_v4',
                semantic: 'ratio',
                formatString: '.2%',
              },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        savedMetrics: [
          {
            metric_name: 'v4_sales_amount_sum',
            verbose_name: 'V4销售额',
            expression: 'SUM(sales_amount)',
          },
          {
            metric_name: 'v4_gross_profit_sum',
            verbose_name: 'V4毛利',
            expression: 'SUM(gross_profit)',
          },
        ],
        value: [field],
      }),
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'calc_margin_pct_v4',
        name: 'V4示例毛利率',
        ast: {
          kind: 'pct',
          numerator: {
            kind: 'metric_ref',
            metricId: 'v4_gross_profit_sum',
          },
          denominator: {
            kind: 'metric_ref',
            metricId: 'v4_sales_amount_sum',
          },
        },
      }),
    ]);
  });

  it('preserves alias-based visible metric selections when editing calculated fields', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const field = {
      id: 'calc_margin_pct_v4',
      name: 'V4示例毛利率',
      resultType: 'percent' as const,
      formatString: '.2%',
      ast: {
        kind: 'pct' as const,
        numerator: {
          kind: 'metric_ref' as const,
          metricId: 'v4_gross_profit_sum',
        },
        denominator: {
          kind: 'metric_ref' as const,
          metricId: 'v4_sales_amount_sum',
        },
      },
    };

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: 'V4销售额', label: '销售额', semantic: 'additive' },
              { metric: 'V4毛利', label: '毛利', semantic: 'additive' },
              {
                metric: 'V4示例毛利率',
                label: 'V4示例毛利率',
                calculatedFieldId: 'calc_margin_pct_v4',
                semantic: 'ratio',
                formatString: '.2%',
              },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        savedMetrics: [
          {
            metric_name: 'v4_sales_amount_sum',
            verbose_name: 'V4销售额',
            expression: 'SUM(sales_amount)',
          },
          {
            metric_name: 'v4_gross_profit_sum',
            verbose_name: 'V4毛利',
            expression: 'SUM(gross_profit)',
          },
        ],
        value: [field],
      }),
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'calc_margin_pct_v4',
        name: 'V4示例毛利率',
        ast: {
          kind: 'pct',
          numerator: {
            kind: 'metric_ref',
            metricId: 'V4毛利',
          },
          denominator: {
            kind: 'metric_ref',
            metricId: 'V4销售额',
          },
        },
      }),
    ]);
  });

  it('updates an existing calculated field and metric config without duplicates', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');
    const costMetric = sqlMetric('cost', 'SUM(cost_amount)');

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: 'Sales', semantic: 'additive' },
              { metric: costMetric, label: 'Cost', semantic: 'additive' },
              {
                metric: 'Profit rate',
                label: 'Profit rate',
                semantic: 'ratio',
                formatString: '.2%',
                calculatedFieldId: 'profitRate',
              },
              {
                metric: 'Profit rate duplicate',
                label: 'Profit rate duplicate',
                semantic: 'ratio',
                formatString: '.2%',
                calculatedFieldId: 'profitRate',
              },
              {
                metric: 'Other calc',
                label: 'Other calc',
                semantic: 'ratio',
                calculatedFieldId: 'otherCalc',
              },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        value: [existingProfitRateField],
      }),
    );

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Calculated field name'), {
      target: { value: 'Profit percent' },
    });
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'profitRate',
        name: 'Profit percent',
      }),
    ]);
    expect(onControlChange).toHaveBeenCalledWith(
      'crosstabFieldConfig',
      expect.objectContaining({
        metrics: [
          { metric: salesMetric, label: 'Sales', semantic: 'additive' },
          { metric: costMetric, label: 'Cost', semantic: 'additive' },
          {
            metric: 'Profit percent',
            label: 'Profit percent',
            calculatedFieldId: 'profitRate',
            semantic: 'ratio',
            formatString: '.2%',
          },
          {
            metric: 'Other calc',
            label: 'Other calc',
            semantic: 'ratio',
            calculatedFieldId: 'otherCalc',
          },
        ],
      }),
    );
  });

  it('rejects new calculated fields that duplicate an existing id', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');
    const profitMetric = sqlMetric('profit', 'SUM(gross_profit)');

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: 'Sales', semantic: 'additive' },
              { metric: profitMetric, label: 'Profit', semantic: 'additive' },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        value: [existingProfitRateField],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.change(screen.getByLabelText('Calculated field id'), {
      target: { value: 'profitRate' },
    });
    fireEvent.change(screen.getByLabelText('Calculated field name'), {
      target: { value: 'Another profit rate' },
    });

    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save calculated field')),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Calculated field ids and names must be unique.',
        }),
      ]),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(onControlChange).not.toHaveBeenCalled();
  });

  it('rejects new calculated fields that duplicate ids or metric labels', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');
    const profitMetric = sqlMetric('profit', 'SUM(gross_profit)');

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: 'Sales', semantic: 'additive' },
              { metric: profitMetric, label: 'Profit', semantic: 'additive' },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        value: [existingProfitRateField],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.change(screen.getByLabelText('Calculated field id'), {
      target: { value: 'newField' },
    });
    fireEvent.change(screen.getByLabelText('Calculated field name'), {
      target: { value: 'Sales' },
    });

    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save calculated field')),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Calculated field ids and names must be unique.',
        }),
      ]),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(onControlChange).not.toHaveBeenCalled();
  });

  it('deletes calculated fields and only their matching metric config', () => {
    const onChange = jest.fn();
    const onControlChange = jest.fn();
    const salesMetric = sqlMetric('sales', 'SUM(sales_amount)');

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabFieldConfig: {
            metrics: [
              { metric: salesMetric, label: 'Sales', semantic: 'additive' },
              {
                metric: 'Profit rate',
                label: 'Profit rate',
                semantic: 'ratio',
                formatString: '.2%',
                calculatedFieldId: 'profitRate',
              },
              {
                metric: 'Other calc',
                label: 'Other calc',
                semantic: 'ratio',
                calculatedFieldId: 'otherCalc',
              },
            ],
          },
        },
        name: 'crosstabCalculatedFields',
        onControlChange,
        onChange,
        value: [
          existingProfitRateField,
          {
            ...existingProfitRateField,
            id: 'otherCalc',
            name: 'Other calc',
          },
        ],
      }),
    );

    fireEvent.click(screen.getAllByText('Delete')[0]);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'otherCalc', name: 'Other calc' }),
    ]);
    expect(onControlChange).toHaveBeenCalledWith(
      'crosstabFieldConfig',
      expect.objectContaining({
        metrics: [
          { metric: salesMetric, label: 'Sales', semantic: 'additive' },
          {
            metric: 'Other calc',
            label: 'Other calc',
            semantic: 'ratio',
            calculatedFieldId: 'otherCalc',
          },
        ],
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
        name: 'crosstabCalculatedFields',
        onChange,
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));

    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save calculated field')),
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
        name: 'crosstabCalculatedFields',
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
      fireEvent.click(screen.getByText('Save calculated field')),
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

  it('rejects saved metric records that only expose non-SQL metric objects', () => {
    const onChange = jest.fn();
    const setControlValue = jest.fn();

    render(
      createElement(CrosstabCalculatedFieldsControl, {
        actions: { setControlValue },
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
        },
        name: 'crosstabCalculatedFields',
        onChange,
        savedMetrics: [
          {
            metric_name: 'saved_sales',
            metric: {
              expressionType: 'SIMPLE',
              label: 'saved_sales',
            } as QueryFormMetric,
          },
          {
            metric_name: 'saved_profit',
            metric: {
              expressionType: 'SIMPLE',
              label: 'saved_profit',
            } as QueryFormMetric,
          },
        ],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));

    const errors = catchWindowErrors(() =>
      fireEvent.click(screen.getByText('Save calculated field')),
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
        name: 'crosstabCalculatedFields',
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
        name: 'crosstabCalculatedFields',
        onChange,
        savedMetrics: [{ metric_name: 'unselected_metric' }],
        value: [],
      }),
    );

    fireEvent.click(screen.getByText('New calculated field'));
    fireEvent.click(screen.getByText('Save calculated field'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        ast: expect.objectContaining({
          numerator: { kind: 'metric_ref', metricId: 'sales' },
          denominator: { kind: 'metric_ref', metricId: 'profit' },
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

  it('renders one visible field-zone heading per zone', () => {
    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange: jest.fn(),
        value: {
          rows: [{ field: 'country' }],
          columns: [{ field: 'biz_date' }],
          metrics: [{ metric: 'amount', label: 'Amount' }],
        },
      }),
    );

    expect(screen.getAllByText('Rows')).toHaveLength(1);
    expect(screen.getAllByText('Columns')).toHaveLength(1);
    expect(screen.getAllByText('Metrics')).toHaveLength(1);
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

  it('clears hidden metrics when canonical v4 metric selection is edited', () => {
    const onChange = jest.fn();
    const actions = { setControlValue: jest.fn() };

    render(
      createElement(CrosstabFieldConfigControl, {
        actions,
        columns: [],
        datasource: {},
        formData: {
          datasource: '7__table',
          viz_type: 'crosstab-table',
          crosstabParameters: [
            {
              id: 'param_adjustment',
              kind: 'number',
              name: 'adjustmentRate',
              label: 'Adjustment',
              defaultValue: 1,
            },
          ],
        },
        name: 'crosstabFieldConfig',
        onChange,
        value: {
          metrics: [{ metric: 'amount', label: 'Amount' }],
        },
      }),
    );

    fireEvent.change(screen.getByLabelText('Metric semantic'), {
      target: { value: 'additive' },
    });

    expect(actions.setControlValue).toHaveBeenCalledWith('metrics', []);
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

  it('renders calculated field metrics as local removable chips', () => {
    render(
      createElement(CrosstabFieldConfigControl, {
        name: 'crosstabFieldConfig',
        onChange: jest.fn(),
        savedMetrics: [],
        value: {
          metrics: [
            {
              calculatedFieldId: 'calc_margin_pct_v4',
              label: 'V4验收毛利率',
              metric: 'V4验收毛利率',
              semantic: 'ratio',
            },
          ],
        },
      }),
    );

    expect(screen.getByLabelText('Remove V4验收毛利率')).toBeInTheDocument();
    expect(screen.queryByLabelText('显示信息提示')).not.toBeInTheDocument();
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
