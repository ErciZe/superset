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
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import { t, validateInteger } from '@superset-ui/core';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupbyRows',
            config: {
              ...sharedControls.groupby,
              label: t('Rows'),
              description: t('Dimensions to use as crosstab rows.'),
              multi: true,
            },
          },
        ],
        [
          {
            name: 'groupbyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Dimensions to use as generated crosstab columns.'),
              multi: true,
            },
          },
        ],
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              label: t('Metrics'),
              validators: [],
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Crosstab'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'showRowTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Row totals'),
              renderTrigger: true,
              default: true,
            },
          },
        ],
        [
          {
            name: 'showColumnTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Column totals'),
              renderTrigger: true,
              default: true,
            },
          },
        ],
        [
          {
            name: 'showRowSubtotals',
            config: {
              type: 'CheckboxControl',
              label: t('Row subtotals'),
              renderTrigger: true,
              default: true,
            },
          },
        ],
        [
          {
            name: 'showColumnSubtotals',
            config: {
              type: 'CheckboxControl',
              label: t('Column subtotals'),
              renderTrigger: true,
              default: false,
            },
          },
        ],
        [
          {
            name: 'maxGeneratedColumns',
            config: {
              type: 'TextControl',
              label: t('Max generated columns'),
              renderTrigger: true,
              default: '300',
              validators: [validateInteger],
            },
          },
        ],
        [
          {
            name: 'defaultRowExpandedDepth',
            config: {
              type: 'TextControl',
              label: t('Default row expanded depth'),
              renderTrigger: true,
              default: '1',
              validators: [validateInteger],
            },
          },
        ],
      ],
    },
    sections.titleControls,
  ],
};

export default config;
