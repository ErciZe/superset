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
  BuildQuery,
  buildQueryContext,
  ensureIsArray,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import type { CrosstabFormData } from '../types';

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const buildQuery: BuildQuery<CrosstabFormData> = formData => {
  if (formData.serverPagination) {
    throw new Error('Crosstab table does not support server pagination in v1.');
  }

  const rowDimensions = ensureIsArray<QueryFormColumn>(formData.groupbyRows);
  const columnDimensions = ensureIsArray<QueryFormColumn>(
    formData.groupbyColumns,
  );
  const metrics = ensureIsArray<QueryFormMetric>(formData.metrics);

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: unique([...rowDimensions, ...columnDimensions]),
      metrics,
      is_timeseries: false,
    },
  ]);
};

export default buildQuery;
