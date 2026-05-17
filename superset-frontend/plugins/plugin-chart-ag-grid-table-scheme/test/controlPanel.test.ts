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
import controlPanel from '../src/controlPanel';

type ControlSetRows = ReadonlyArray<ReadonlyArray<unknown>>;
type ControlConfig = {
  config?: {
    label?: string;
    choices?: Array<[string, string]>;
    type?: string;
    visibility?: (args: {
      controls: Record<string, { value?: unknown }>;
    }) => boolean;
    mapStateToProps?: (...args: any[]) => Record<string, unknown>;
  };
  name: string;
};

const getControlNames = (rows: ControlSetRows) =>
  rows.flatMap(row =>
    row
      .filter(
        (control): control is { name: string } =>
          Boolean(control) &&
          typeof control === 'object' &&
          typeof (control as { name?: unknown }).name === 'string',
      )
      .map(control => control.name),
  );

const getControl = (rows: ControlSetRows, name: string) =>
  rows
    .flatMap(row => row)
    .find(
      (control): control is ControlConfig =>
        Boolean(control) &&
        typeof control === 'object' &&
        (control as { name?: string }).name === name,
    );

describe('AG Grid table scheme control panel', () => {
  it('keeps column view controls in Options after Customize columns', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];
    const optionsSection = sections.find(section =>
      section.controlSetRows.some(row =>
        row.some(
          control =>
            Boolean(control) &&
            typeof control === 'object' &&
            (control as { name?: string }).name === 'column_config',
        ),
      ),
    );

    expect(querySection).toBeDefined();
    expect(optionsSection).toBeDefined();

    if (!querySection || !optionsSection) {
      throw new Error('Expected query and options sections to be available');
    }

    const queryControlNames = getControlNames(querySection.controlSetRows);
    const optionControlNames = getControlNames(optionsSection.controlSetRows);

    expect(queryControlNames).toContain('matrix_mode_enabled');
    expect(queryControlNames).not.toContain('column_view_schemes_enabled');
    expect(queryControlNames).not.toContain('column_settings_enabled');

    expect(optionControlNames).toEqual(
      expect.arrayContaining([
        'column_config',
        'column_view_schemes_enabled',
        'column_settings_enabled',
      ]),
    );
    expect(optionControlNames.indexOf('column_view_schemes_enabled')).toBe(
      optionControlNames.indexOf('column_config') + 1,
    );
    expect(optionControlNames.indexOf('column_settings_enabled')).toBe(
      optionControlNames.indexOf('column_view_schemes_enabled') + 1,
    );
  });

  it('uses Chinese labels for matrix-specific controls', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    expect(
      getControl(querySection.controlSetRows, 'matrix_mode_enabled')?.config
        ?.label,
    ).toBe('启用矩阵模式');
    expect(
      getControl(querySection.controlSetRows, 'matrix_rows')?.config?.label,
    ).toBe('矩阵行维度');
    expect(
      getControl(querySection.controlSetRows, 'matrix_columns')?.config?.label,
    ).toBe('矩阵列维度');
    expect(
      getControl(querySection.controlSetRows, 'matrix_value')?.config?.label,
    ).toBe('矩阵指标值');
    expect(
      getControl(querySection.controlSetRows, 'matrix_row_sort')?.config?.label,
    ).toBe('行排序字段');
    expect(
      getControl(querySection.controlSetRows, 'matrix_row_sort_desc')?.config
        ?.label,
    ).toBe('降序排序');
    expect(
      getControl(querySection.controlSetRows, 'matrix_unit_field')?.config
        ?.label,
    ).toBe('单位字段');
    expect(
      getControl(querySection.controlSetRows, 'matrix_show_total')?.config
        ?.label,
    ).toBe('显示合计列');
    expect(
      getControl(querySection.controlSetRows, 'matrix_total_position')?.config,
    ).toMatchObject({
      label: '合计列位置',
      choices: [
        ['left', '左侧'],
        ['right', '右侧'],
      ],
    });
    expect(
      getControl(querySection.controlSetRows, 'matrix_value_calculation')
        ?.config,
    ).toMatchObject({
      label: '数值计算方式',
      choices: [
        ['raw', '原始值'],
        ['contribution', '整体占比'],
        ['row_contribution', '行内占比'],
        ['row_rank', '行内排名'],
      ],
    });
    expect(
      getControl(querySection.controlSetRows, 'matrix_max_generated_columns')
        ?.config?.label,
    ).toBe('矩阵最大生成列数');
    expect(
      getControl(
        querySection.controlSetRows,
        'matrix_cell_formatter_expression',
      ),
    ).toBeUndefined();
  });

  it('adds matrix cell conditional coloring with a matrix value target', () => {
    const controls = controlPanel.controlPanelSections
      .filter((section): section is NonNullable<typeof section> =>
        Boolean(section),
      )
      .flatMap(section => section.controlSetRows);
    const cellColorControl = getControl(controls, 'matrix_cell_color_rules');

    expect(cellColorControl?.config).toMatchObject({
      type: 'ConditionalFormattingControl',
      label: '单元格条件着色',
    });
    expect(
      cellColorControl?.config?.visibility?.({
        controls: {
          query_mode: { value: 'aggregate' },
          matrix_mode_enabled: { value: true },
        },
      }),
    ).toBe(true);

    const mappedProps = cellColorControl?.config?.mapStateToProps?.(
      {
        controls: {
          matrix_rows: { value: ['metric_name_with_unit'] },
        },
        datasource: {
          verbose_map: {
            metric_name_with_unit: '指标（单位）',
          },
        },
      },
      {},
      { chartStatus: 'success' },
    );
    expect(mappedProps?.columnOptions).toEqual([
      {
        value: 'matrix_value_cells',
        label: '矩阵值单元格',
      },
    ]);
    expect(mappedProps?.rowScopeOptions).toEqual([
      {
        value: 'metric_name_with_unit',
        label: '指标（单位）',
      },
    ]);
    expect(mappedProps?.rowScopeLabel).toBe('适用行维度');
    expect(mappedProps?.rowValueLabel).toBe('适用行值');

    expect(
      getControl(controls, 'matrix_cell_formatter_expression')?.config,
    ).toMatchObject({
      type: 'TextAreaControl',
      label: '单元格展示表达式',
      language: 'javascript',
    });
  });

  it('hides official conditional formatting while matrix mode is enabled', () => {
    const controls = controlPanel.controlPanelSections
      .filter((section): section is NonNullable<typeof section> =>
        Boolean(section),
      )
      .flatMap(section => section.controlSetRows);
    const officialConditionalFormatting = getControl(
      controls,
      'conditional_formatting',
    );

    expect(
      officialConditionalFormatting?.config?.visibility?.({
        controls: {
          query_mode: { value: 'aggregate' },
          matrix_mode_enabled: { value: true },
        },
      }),
    ).toBe(false);
    expect(
      officialConditionalFormatting?.config?.visibility?.({
        controls: {
          query_mode: { value: 'aggregate' },
          matrix_mode_enabled: { value: false },
        },
      }),
    ).toBe(true);
  });
});
