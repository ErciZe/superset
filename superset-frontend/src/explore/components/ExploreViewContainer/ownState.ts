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
import { omit } from 'lodash';

const CROSSTAB_OWN_STATE_KEYS = [
  'currentColumnPage',
  'currentColumnPageSize',
  'effectiveMetricSignature',
  'effectiveGroupBySignature',
  'expandedRowPaths',
  'numericParameters',
  'textParameters',
  'serverColumnPageColumnSignature',
  'serverColumnPageTuples',
  'serverColumnPageTuplesPage',
  'serverColumnPageTuplesPageSize',
  'serverColumnTotalCount',
  'selectedDynamicGroupBy',
  'selectedDynamicGroupByColumn',
  'selectedDynamicMetric',
];

type FormDataWithVizType = {
  viz_type?: string;
};

type OwnState = Record<string, unknown>;

export function getFilterOwnState(
  formData: FormDataWithVizType,
  ownState?: OwnState,
): OwnState | undefined {
  if (formData.viz_type !== 'crosstab-table' || ownState === undefined) {
    return ownState;
  }

  return omit(ownState, CROSSTAB_OWN_STATE_KEYS);
}
