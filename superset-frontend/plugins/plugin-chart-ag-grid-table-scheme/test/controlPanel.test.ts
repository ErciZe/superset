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
    default?: string;
    description?: string;
    label?: string;
    choices?: Array<[string, string]>;
    type?: string;
    validators?: Array<(value: string) => false | string>;
    visibility?: (args: {
      controls: Record<string, { value?: unknown }>;
    }) => boolean;
    mapStateToProps?: (...args: any[]) => Record<string, unknown>;
  };
  override?: {
    visibility?: (args: {
      controls: Record<string, { value?: unknown; options?: unknown }>;
    }) => boolean;
  };
  name: string;
};

const getControlNames = (rows: ControlSetRows) =>
  rows.flatMap(row =>
    row
      .map(control => {
        if (typeof control === 'string') {
          return control;
        }
        if (
          Boolean(control) &&
          typeof control === 'object' &&
          typeof (control as { name?: unknown }).name === 'string'
        ) {
          return (control as { name: string }).name;
        }
        return null;
      })
      .filter((name): name is string => Boolean(name)),
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

const getControlVisibility = (
  rows: ControlSetRows,
  name: string,
  controls: Record<string, { value?: unknown; options?: unknown }>,
) => {
  const control = getControl(rows, name);
  const visibility =
    control?.override?.visibility ?? control?.config?.visibility;
  return visibility ? visibility({ controls }) : true;
};

describe('AG Grid table scheme control panel', () => {
  test('keeps column view controls in Options after Customize columns', () => {
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

  test('puts the matrix mode switch before aggregate fields', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    const queryControlNames = getControlNames(querySection.controlSetRows);

    expect(queryControlNames.indexOf('matrix_mode_enabled')).toBe(
      queryControlNames.indexOf('query_mode') + 1,
    );
    expect(queryControlNames.indexOf('matrix_rows')).toBeGreaterThan(
      queryControlNames.indexOf('groupby'),
    );
    expect(queryControlNames.indexOf('matrix_rows')).toBeGreaterThan(
      queryControlNames.indexOf('metrics'),
    );
  });

  test('hides regular aggregate controls while matrix mode is enabled', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    const matrixControls = {
      query_mode: { value: 'aggregate' },
      matrix_mode_enabled: { value: true },
      timeseries_limit_metric: { value: 'metric_order' },
      server_pagination: { value: true },
      groupby: { value: ['biz_date'], options: [] },
    };

    [
      'groupby',
      'time_grain_sqla',
      'metrics',
      'percent_metrics',
      'timeseries_limit_metric',
      'order_desc',
      'show_totals',
      'server_pagination',
      'server_page_length',
    ].forEach(controlName => {
      expect(
        getControlVisibility(
          querySection.controlSetRows,
          controlName,
          matrixControls,
        ),
      ).toBe(false);
    });
  });

  test('restores regular aggregate controls when matrix mode is disabled', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    const aggregateControls = {
      query_mode: { value: 'aggregate' },
      matrix_mode_enabled: { value: false },
      timeseries_limit_metric: { value: 'metric_order' },
      server_pagination: { value: true },
      groupby: {
        value: ['biz_date'],
        options: [{ column_name: 'biz_date', is_dttm: true }],
      },
    };

    [
      'groupby',
      'time_grain_sqla',
      'metrics',
      'percent_metrics',
      'timeseries_limit_metric',
      'order_desc',
      'show_totals',
      'server_pagination',
      'server_page_length',
    ].forEach(controlName => {
      expect(
        getControlVisibility(
          querySection.controlSetRows,
          controlName,
          aggregateControls,
        ),
      ).toBe(true);
    });
  });

  test('keeps filters, row limit, and matrix details available in matrix mode', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    const queryControlNames = getControlNames(querySection.controlSetRows);
    const matrixControls = {
      query_mode: { value: 'aggregate' },
      matrix_mode_enabled: { value: true },
    };

    expect(queryControlNames).toEqual(
      expect.arrayContaining([
        'adhoc_filters',
        'row_limit',
        'export_row_limit',
      ]),
    );
    expect(queryControlNames.indexOf('export_row_limit')).toBe(
      queryControlNames.indexOf('row_limit') + 1,
    );
    ['matrix_rows', 'matrix_columns', 'matrix_value'].forEach(controlName => {
      expect(
        getControlVisibility(
          querySection.controlSetRows,
          controlName,
          matrixControls,
        ),
      ).toBe(true);
    });
  });

  test('does not require matrix value while raw records mode is active', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    const matrixValueControl = getControl(
      querySection.controlSetRows,
      'matrix_value',
    );
    const mappedState = matrixValueControl?.config?.mapStateToProps?.(
      {
        controls: {
          query_mode: { value: 'raw' },
          matrix_mode_enabled: { value: false },
        },
        datasource: { columns: [], metrics: [] },
        form_data: {},
      },
      { value: null },
    );

    expect(matrixValueControl?.config?.validators).toEqual([]);
    expect(mappedState?.externalValidationErrors).toEqual([]);
  });

  test('requires matrix value only while matrix mode is active', () => {
    const sections = controlPanel.controlPanelSections.filter(
      (section): section is NonNullable<typeof section> => Boolean(section),
    );
    const querySection = sections[0];

    expect(querySection).toBeDefined();
    if (!querySection) {
      throw new Error('Expected query section to be available');
    }

    const matrixValueControl = getControl(
      querySection.controlSetRows,
      'matrix_value',
    );
    const state = {
      controls: {
        query_mode: { value: 'aggregate' },
        matrix_mode_enabled: { value: true },
      },
      datasource: { columns: [], metrics: [] },
      form_data: {},
    };

    expect(
      matrixValueControl?.config?.mapStateToProps?.(state, { value: null })
        ?.externalValidationErrors,
    ).toEqual(['不能为空']);
    expect(
      matrixValueControl?.config?.mapStateToProps?.(state, { value: 'value' })
        ?.externalValidationErrors,
    ).toEqual([]);
  });

  test('uses Chinese labels for matrix-specific controls', () => {
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

  test('adds matrix cell conditional coloring with a matrix value target', () => {
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
      label: '单元格 JS 回调函数',
      language: 'javascript',
    });
    const formatterControl = getControl(
      controls,
      'matrix_cell_formatter_expression',
    )?.config;
    expect(formatterControl?.default).toContain('/*');
    expect(formatterControl?.default).toContain('示例：看板阈值背景色标记');
    expect(formatterControl?.default).toContain('FBA发货费占比');
    expect(formatterControl?.default).toContain('广告花费占比低于 18%');
    expect(formatterControl?.description).toContain('row');
    expect(
      formatterControl?.validators?.[0]('({ rawValue }) => rawValue'),
    ).toBe(false);
    expect(formatterControl?.validators?.[0]('{ text: value }')).toMatch(
      /must be a function/,
    );
  });

  test('hides official conditional formatting while matrix mode is enabled', () => {
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
