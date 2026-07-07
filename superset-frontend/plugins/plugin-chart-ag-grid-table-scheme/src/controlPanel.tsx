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
  ControlPanelConfig,
  ControlPanelState,
  ControlPanelsContainerProps,
  ControlState,
  ControlStateMapping,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  getColumnLabel,
  QueryFormColumn,
  QueryMode,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import officialControlPanel from './table/controlPanel';
import { MATRIX_CELL_COLOR_RULE_COLUMN } from './matrix/cellColorRules';
import {
  MATRIX_CELL_FORMATTER_CALLBACK_DEFAULT,
  formatMatrixCellFormatterCallback,
  validateMatrixCellFormatterCallback,
} from './matrix/cellFormatter';

const getQueryMode = (controls: ControlStateMapping): QueryMode => {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode as QueryMode;
  }

  const rawColumns = controls?.all_columns?.value as
    QueryFormColumn[] | undefined;
  return rawColumns?.length ? QueryMode.Raw : QueryMode.Aggregate;
};

const isAggMode = ({
  controls,
}: Pick<ControlPanelsContainerProps, 'controls'>) =>
  getQueryMode(controls) === QueryMode.Aggregate;

const matrixVisibility = ({
  controls,
}: Pick<ControlPanelsContainerProps, 'controls'>) =>
  isAggMode({ controls }) && Boolean(controls?.matrix_mode_enabled?.value);

const validateMatrixCellFormatterCallbackControl = (value: string) => {
  try {
    validateMatrixCellFormatterCallback(value);
    return false;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const formatMatrixCellFormatterEditor = (editor: {
  getValue: () => string;
  setValue: (value: string, cursorPosition?: number) => void;
}) => {
  const source = editor.getValue();
  return formatMatrixCellFormatterCallback(source)
    .then(formattedValue => {
      if (editor.getValue() === source && formattedValue !== source) {
        editor.setValue(formattedValue, -1);
      }
    })
    .catch(() => {});
};

const getRowScopeOptions = (
  matrixRows: unknown,
  verboseMap?: Record<string, string>,
) =>
  ensureIsArray(matrixRows)
    .map(row => {
      if (!row) {
        return null;
      }
      const value = getColumnLabel(row as QueryFormColumn);
      if (!value) {
        return null;
      }
      return {
        value,
        label: verboseMap?.[value] ?? value,
      };
    })
    .filter((option): option is { value: string; label: string } =>
      Boolean(option),
    );

type ControlSetRows = NonNullable<
  ControlPanelConfig['controlPanelSections'][number]
>['controlSetRows'];

const matrixModeControlRows: ControlSetRows = [
  [
    {
      name: 'matrix_mode_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('启用矩阵模式'),
        default: false,
        renderTrigger: true,
        visibility: isAggMode,
        description: t('将聚合记录转换为行列矩阵。'),
      },
    },
  ],
];

const matrixDetailControlRows: ControlSetRows = [
  [
    {
      name: 'matrix_rows',
      config: {
        ...sharedControls.groupby,
        label: t('矩阵行维度'),
        multi: true,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_columns',
      config: {
        ...sharedControls.groupby,
        label: t('矩阵列维度'),
        multi: true,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_value',
      config: {
        ...sharedControls.metrics,
        label: t('矩阵指标值'),
        multi: false,
        resetOnHide: false,
        validators: [],
        visibility: matrixVisibility,
        mapStateToProps: (
          state: ControlPanelState,
          controlState: ControlState,
        ) => ({
          ...sharedControls.metrics.mapStateToProps?.(state, controlState),
          externalValidationErrors:
            matrixVisibility({ controls: state.controls }) &&
            ensureIsArray(controlState?.value).length === 0
              ? [t('不能为空')]
              : [],
        }),
      },
    },
  ],
  [
    {
      name: 'matrix_row_sort',
      config: {
        ...sharedControls.groupby,
        label: t('行排序字段'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
    {
      name: 'matrix_row_sort_desc',
      config: {
        type: 'CheckboxControl',
        label: t('降序排序'),
        default: false,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_unit_field',
      config: {
        ...sharedControls.groupby,
        label: t('单位字段'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_show_total',
      config: {
        type: 'CheckboxControl',
        label: t('显示合计列'),
        default: true,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
    {
      name: 'matrix_total_position',
      config: {
        type: 'SelectControl',
        label: t('合计列位置'),
        default: 'left',
        clearable: false,
        choices: [
          ['left', t('左侧')],
          ['right', t('右侧')],
        ],
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_value_calculation',
      config: {
        type: 'SelectControl',
        label: t('数值计算方式'),
        default: 'raw',
        clearable: false,
        choices: [
          ['raw', t('原始值')],
          ['contribution', t('整体占比')],
          ['row_contribution', t('行内占比')],
          ['row_rank', t('行内排名')],
        ],
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_max_generated_columns',
      config: {
        type: 'TextControl',
        label: t('矩阵最大生成列数'),
        default: 200,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
];

const columnViewControls: ControlSetRows = [
  [
    {
      name: 'column_view_schemes_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('启用列配置方案'),
        default: true,
        renderTrigger: true,
        description: t('显示用于切换、保存和重置列配置方案的工具栏。'),
      },
    },
  ],
  [
    {
      name: 'column_settings_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('显示列设置按钮'),
        default: false,
        renderTrigger: true,
        description: t('在图表工具栏中显示列设置按钮。'),
      },
    },
  ],
];

const matrixCellColorControls: ControlSetRows = [
  [
    {
      name: 'matrix_cell_color_rules',
      config: {
        type: 'ConditionalFormattingControl',
        renderTrigger: true,
        label: t('单元格条件着色'),
        description: t(
          '按数值阈值为矩阵值单元格设置背景色，可限定到指定矩阵行维度和值。',
        ),
        visibility: matrixVisibility,
        shouldMapStateToProps() {
          return true;
        },
        mapStateToProps(
          explore: ControlPanelState,
          _control: unknown,
          chart?: { chartStatus?: string },
        ) {
          const datasourceVerboseMap =
            explore.datasource && 'verbose_map' in explore.datasource
              ? explore.datasource.verbose_map
              : undefined;
          const rowScopeOptions = getRowScopeOptions(
            explore?.controls?.matrix_rows?.value,
            datasourceVerboseMap,
          );
          const rowScopeVerboseMap = Object.fromEntries(
            rowScopeOptions.map(option => [option.value, option.label]),
          );
          return {
            removeIrrelevantConditions: chart?.chartStatus === 'success',
            columnOptions: [
              {
                value: MATRIX_CELL_COLOR_RULE_COLUMN,
                label: t('矩阵值单元格'),
              },
            ],
            verboseMap: {
              [MATRIX_CELL_COLOR_RULE_COLUMN]: t('矩阵值单元格'),
            },
            rowScopeOptions,
            rowScopeVerboseMap,
            rowScopeLabel: t('适用行维度'),
            rowValueLabel: t('适用行值'),
          };
        },
      },
    },
  ],
  [
    {
      name: 'matrix_cell_formatter_expression',
      config: {
        type: 'TextAreaControl',
        label: t('单元格 JS 回调函数'),
        default: MATRIX_CELL_FORMATTER_CALLBACK_DEFAULT,
        renderTrigger: true,
        resetOnHide: false,
        language: 'javascript',
        validators: [validateMatrixCellFormatterCallbackControl],
        formatValue: formatMatrixCellFormatterCallback,
        visibility: matrixVisibility,
        description: t(
          '使用 JS 回调函数格式化矩阵单元格。参数：row 当前行，cell 当前单元格，value 展示值，rawValue 原始值，column 当前列，rowIndex 行索引，colDef AG Grid 列定义。返回 undefined/null 表示不处理；也可返回 text/html/tooltip/className/style。',
        ),
        aboveEditorSection: (
          <div>
            <p>
              {t(
                '回调签名建议写为：({ row, cell, value, rawValue, column, rowIndex, colDef }) => { ... }',
              )}
            </p>
            <p>
              {t(
                'style 支持字段：backgroundColor、color、fontWeight、fontStyle、textAlign、textDecoration、opacity。',
              )}
            </p>
          </div>
        ),
        tooltipOptions: {
          title: t(
            '参数：row/cell/value/rawValue/column/rowIndex/colDef。返回 undefined/null 不处理，返回对象可设置 style、text、html、tooltip、className。',
          ),
        },
        hotkeys: [
          {
            name: 'formatMatrixCellFormatterCallback',
            key: 'Ctrl-Shift-F',
            func: formatMatrixCellFormatterEditor,
          },
          {
            name: 'formatMatrixCellFormatterCallbackMac',
            key: 'Command-Shift-F',
            func: formatMatrixCellFormatterEditor,
          },
        ],
      },
    },
  ],
];

const findControlRowIndex = (rows: ControlSetRows, controlName: string) =>
  rows.findIndex(row =>
    row.some(
      control =>
        Boolean(control) &&
        typeof control === 'object' &&
        (control as { name?: string }).name === controlName,
    ),
  );

const insertRowsAfterControl = (
  rows: ControlSetRows,
  controlName: string,
  rowsToInsert: ControlSetRows,
) => {
  const rowIndex = findControlRowIndex(rows, controlName);
  if (rowIndex === -1) {
    throw new Error(`AG Grid table ${controlName} control is required`);
  }
  return [
    ...rows.slice(0, rowIndex + 1),
    ...rowsToInsert,
    ...rows.slice(rowIndex + 1),
  ];
};

const controlsHiddenInMatrixMode = new Set([
  'groupby',
  'time_grain_sqla',
  'metrics',
  'percent_metrics',
  'timeseries_limit_metric',
  'order_desc',
  'server_pagination',
  'server_page_length',
  'show_totals',
]);

type VisibilityConfig = {
  visibility?: (
    props: Pick<ControlPanelsContainerProps, 'controls'>,
  ) => boolean;
};

const withHiddenInMatrixVisibility =
  (
    visibility?: VisibilityConfig['visibility'],
  ): VisibilityConfig['visibility'] =>
  props =>
    !matrixVisibility(props) && (visibility ? visibility(props) : true);

const hideControlsInMatrixMode = (rows: ControlSetRows): ControlSetRows =>
  rows.map(row =>
    row.map(control => {
      if (
        !control ||
        typeof control !== 'object' ||
        !controlsHiddenInMatrixMode.has(
          (control as { name?: string }).name ?? '',
        )
      ) {
        return control;
      }

      const typedControl = control as {
        config?: VisibilityConfig;
        override?: VisibilityConfig;
      };

      if (typedControl.override) {
        return {
          ...control,
          override: {
            ...typedControl.override,
            visibility: withHiddenInMatrixVisibility(
              typedControl.override.visibility,
            ),
          },
        } as unknown as typeof control;
      }

      return {
        ...control,
        config: {
          ...(control as { config?: Record<string, unknown> }).config,
          visibility: withHiddenInMatrixVisibility(
            typedControl.config?.visibility,
          ),
        },
      } as unknown as typeof control;
    }),
  );

const hideOfficialConditionalFormattingInMatrix = (
  rows: ControlSetRows,
): ControlSetRows =>
  rows.map(row =>
    row.map(control => {
      if (
        !control ||
        typeof control !== 'object' ||
        (control as { name?: string }).name !== 'conditional_formatting'
      ) {
        return control;
      }

      const typedControl = control as {
        config?: VisibilityConfig;
      };

      return {
        ...control,
        config: {
          ...(control as { config?: Record<string, unknown> }).config,
          visibility: withHiddenInMatrixVisibility(
            typedControl.config?.visibility,
          ),
        },
      } as unknown as typeof control;
    }),
  );

const officialControlPanelSections =
  officialControlPanel.controlPanelSections.filter(
    (section): section is NonNullable<typeof section> => Boolean(section),
  );

const querySection = officialControlPanelSections[0];
const optionsSectionIndex = officialControlPanelSections.findIndex(section =>
  section.controlSetRows.some(row =>
    row.some(
      control =>
        Boolean(control) &&
        typeof control === 'object' &&
        (control as { name?: string }).name === 'column_config',
    ),
  ),
);
const conditionalFormattingSectionIndex =
  officialControlPanelSections.findIndex(section =>
    section.controlSetRows.some(row =>
      row.some(
        control =>
          Boolean(control) &&
          typeof control === 'object' &&
          (control as { name?: string }).name === 'conditional_formatting',
      ),
    ),
  );

if (!querySection) {
  throw new Error('AG Grid table Query control panel section is required');
}

if (optionsSectionIndex === -1) {
  throw new Error('AG Grid table Options control panel section is required');
}

if (conditionalFormattingSectionIndex === -1) {
  throw new Error('AG Grid table conditional formatting section is required');
}

const optionsSection = officialControlPanelSections[optionsSectionIndex];
const conditionalFormattingSection =
  officialControlPanelSections[conditionalFormattingSectionIndex];

if (!optionsSection) {
  throw new Error('AG Grid table Options control panel section is required');
}

if (!conditionalFormattingSection) {
  throw new Error('AG Grid table conditional formatting section is required');
}

const columnConfigRowIndex = findControlRowIndex(
  optionsSection.controlSetRows,
  'column_config',
);

const conditionalFormattingRowIndex = findControlRowIndex(
  conditionalFormattingSection.controlSetRows,
  'conditional_formatting',
);

if (columnConfigRowIndex === -1) {
  throw new Error('AG Grid table column configuration control is required');
}

if (conditionalFormattingRowIndex === -1) {
  throw new Error('AG Grid table conditional formatting control is required');
}

const controlPanel: ControlPanelConfig = {
  ...officialControlPanel,
  controlPanelSections: officialControlPanelSections.map((section, index) => {
    if (index === 0) {
      return {
        ...section,
        controlSetRows: [
          ...insertRowsAfterControl(
            hideControlsInMatrixMode(section.controlSetRows),
            'query_mode',
            matrixModeControlRows,
          ),
          ...matrixDetailControlRows,
        ],
      };
    }

    let { controlSetRows } = section;

    if (index === conditionalFormattingSectionIndex) {
      controlSetRows = insertRowsAfterControl(
        hideOfficialConditionalFormattingInMatrix(section.controlSetRows),
        'conditional_formatting',
        matrixCellColorControls,
      );
    }

    if (index === optionsSectionIndex) {
      controlSetRows = insertRowsAfterControl(
        controlSetRows,
        'column_config',
        columnViewControls,
      );
    }

    return {
      ...section,
      controlSetRows,
    };
  }),
};

export default controlPanel;
