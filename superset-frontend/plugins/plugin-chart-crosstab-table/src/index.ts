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
import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import buildQuery from './plugin/buildQuery';
import controlPanel from './plugin/controlPanel';
import transformProps from './plugin/transformProps';
import thumbnail from '../../plugin-chart-ag-grid-table/src/images/thumbnail.png';
import type { CrosstabChartProps, CrosstabFormData } from './types';

export * from './types';

const metadata = new ChartMetadata({
  behaviors: [
    Behavior.InteractiveChart,
    Behavior.DrillToDetail,
    Behavior.DrillBy,
  ],
  category: t('Table'),
  description: t('Crosstab table chart.'),
  name: t('Crosstab Table'),
  tags: [t('Tabular'), t('Business'), t('Report')],
  thumbnail,
});

export default class CrosstabTableChartPlugin extends ChartPlugin<
  CrosstabFormData,
  CrosstabChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./CrosstabTable'),
      metadata,
      transformProps,
    });
  }
}
