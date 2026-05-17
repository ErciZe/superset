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
  ControlPanelsContainerProps,
  ControlStateMapping,
  sharedControls,
} from '@superset-ui/chart-controls';
import { QueryFormColumn, QueryMode, t } from '@superset-ui/core';
import officialControlPanel from '@superset-ui/plugin-chart-ag-grid-table/src/controlPanel';

const getQueryMode = (controls: ControlStateMapping): QueryMode => {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.Aggregate || mode === QueryMode.Raw) {
    return mode as QueryMode;
  }

  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
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

const matrixControls = [
  [
    {
      name: 'matrix_mode_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('Enable matrix mode'),
        default: false,
        renderTrigger: true,
        visibility: isAggMode,
        description: t(
          'Transform aggregate records into a row-by-column matrix.',
        ),
      },
    },
  ],
  [
    {
      name: 'matrix_rows',
      config: {
        ...sharedControls.groupby,
        label: t('Matrix rows'),
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
        label: t('Matrix columns'),
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
        label: t('Matrix value'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'matrix_row_sort',
      config: {
        ...sharedControls.groupby,
        label: t('Row sort'),
        multi: false,
        resetOnHide: false,
        visibility: matrixVisibility,
      },
    },
    {
      name: 'matrix_row_sort_desc',
      config: {
        type: 'CheckboxControl',
        label: t('Sort descending'),
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
        label: t('Unit field'),
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
        label: t('Show total column'),
        default: true,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
    {
      name: 'matrix_total_position',
      config: {
        type: 'SelectControl',
        label: t('Total position'),
        default: 'left',
        clearable: false,
        choices: [
          ['left', t('Left')],
          ['right', t('Right')],
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
        label: t('Value calculation'),
        default: 'raw',
        clearable: false,
        choices: [
          ['raw', t('Raw value')],
          ['contribution', t('Contribution')],
          ['row_contribution', t('Row contribution')],
          ['row_rank', t('Row rank')],
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
        label: t('Matrix max generated columns'),
        default: 200,
        renderTrigger: true,
        visibility: matrixVisibility,
      },
    },
  ],
  [
    {
      name: 'column_view_schemes_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('Column view schemes enabled'),
        default: true,
        renderTrigger: true,
        description: t(
          'Show the column view toolbar for switching, saving, and resetting column views.',
        ),
      },
    },
  ],
  [
    {
      name: 'column_settings_enabled',
      config: {
        type: 'CheckboxControl',
        label: t('Column settings enabled'),
        default: false,
        renderTrigger: true,
        description: t(
          'Show the column settings entry point in the chart toolbar.',
        ),
      },
    },
  ],
];

const querySection = officialControlPanel.controlPanelSections[0];

if (!querySection) {
  throw new Error('AG Grid table Query control panel section is required');
}

const controlPanel: ControlPanelConfig = {
  ...officialControlPanel,
  controlPanelSections: [
    {
      ...querySection,
      controlSetRows: [...querySection.controlSetRows, ...matrixControls],
    },
    ...officialControlPanel.controlPanelSections.slice(1),
  ],
};

export default controlPanel;
