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
  sharedControlComponents,
} from '@superset-ui/chart-controls';
import { t, validateInteger } from '@superset-ui/core';
import CrosstabCalculatedFieldsControl from './CrosstabCalculatedFieldsControl';
import CrosstabDynamicGroupByControl from './CrosstabDynamicGroupByControl';
import CrosstabDynamicMetricControl from './CrosstabDynamicMetricControl';
import CrosstabFieldConfigControl from './CrosstabFieldConfigControl';
import CrosstabParametersControl from './CrosstabParametersControl';

Object.assign(sharedControlComponents as Record<string, unknown>, {
  CrosstabCalculatedFieldsControl,
  CrosstabDynamicGroupByControl,
  CrosstabDynamicMetricControl,
  CrosstabParametersControl,
});

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'crosstabFieldConfig',
            config: {
              type: CrosstabFieldConfigControl,
              label: t('Fields'),
              description: t('Configure crosstab rows, columns, and metrics.'),
              renderTrigger: true,
              default: {
                rows: [],
                columns: [],
                metrics: [],
              },
              mapStateToProps: ({ datasource, form_data }) => ({
                columns: datasource?.columns ?? [],
                datasource,
                formData: form_data,
                savedMetrics:
                  datasource && 'metrics' in datasource
                    ? datasource.metrics
                    : [],
              }),
            },
          },
        ],
        [
          {
            name: 'groupbyRows',
            config: {
              ...sharedControls.groupby,
              label: t('Rows'),
              description: t('Dimensions to use as crosstab rows.'),
              multi: true,
              hidden: true,
            },
          },
        ],
        [
          {
            name: 'groupbyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t(
                'Dimensions to use as generated crosstab columns.',
              ),
              multi: true,
              hidden: true,
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
              hidden: true,
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
            name: 'dynamicGroupBy',
            config: {
              type: 'CrosstabDynamicGroupByControl',
              label: t('Dynamic group by'),
              default: { enabled: false, slots: [] },
              renderTrigger: true,
              description: t('Configure chart-local dynamic group-by slots.'),
              mapStateToProps: ({ datasource }) => ({
                columns: datasource?.columns ?? [],
              }),
            },
          },
        ],
        [
          {
            name: 'dynamicMetric',
            config: {
              type: 'CrosstabDynamicMetricControl',
              label: t('Dynamic metrics'),
              default: { enabled: false, slots: [] },
              renderTrigger: true,
              description: t('Configure chart-local dynamic metric slots.'),
              mapStateToProps: ({ datasource }) => ({
                columns: datasource?.columns ?? [],
                datasource,
                savedMetrics:
                  datasource && 'metrics' in datasource
                    ? datasource.metrics
                    : [],
              }),
            },
          },
        ],
        [
          {
            name: 'parameters',
            config: {
              type: 'CrosstabParametersControl',
              label: t('Parameters'),
              default: [],
              renderTrigger: true,
              description: t('Configure chart-local numeric parameters.'),
            },
          },
        ],
        [
          {
            name: 'calculatedFields',
            config: {
              type: 'CrosstabCalculatedFieldsControl',
              label: t('Calculated fields'),
              default: [],
              renderTrigger: true,
              description: t('Create SQL-backed crosstab calculated fields.'),
              mapStateToProps: ({ datasource, form_data }) => ({
                formData: form_data,
                savedMetrics:
                  datasource && 'metrics' in datasource
                    ? datasource.metrics
                    : [],
              }),
            },
          },
        ],
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
              default: 300,
              validators: [validateInteger],
            },
          },
        ],
        [
          {
            name: 'serverColumnPagination',
            config: {
              type: 'CheckboxControl',
              label: t('Server column pagination'),
              renderTrigger: true,
              default: false,
              description: t(
                'Query one page of generated crosstab columns at a time.',
              ),
            },
          },
        ],
        [
          {
            name: 'generatedColumnWidth',
            config: {
              type: 'TextControl',
              label: t('Generated column width'),
              renderTrigger: true,
              default: 120,
              validators: [validateInteger],
            },
          },
        ],
        [
          {
            name: 'columnPageSize',
            config: {
              type: 'TextControl',
              label: t('Column page size'),
              renderTrigger: true,
              default: 98,
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
              default: 1,
              validators: [validateInteger],
            },
          },
        ],
        [
          {
            name: 'numberFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Number format'),
            },
          },
        ],
        [
          {
            name: 'conditionalFormatting',
            config: {
              type: 'TextAreaControl',
              label: t('Conditional formatting'),
              default: '',
              language: 'json',
              renderTrigger: true,
              description: t(
                'JSON rules for crosstab numeric cell formatting.',
              ),
            },
          },
        ],
      ],
    },
    sections.titleControls,
  ],
};

export default config;
