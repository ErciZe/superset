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
import { AdhocFilter, NO_TIME_RANGE } from '@superset-ui/core';
import { ChartsState } from 'src/dashboard/types';

type TemporalRangeAdhocFilter = AdhocFilter & {
  comparator: string;
};

const isTemporalRangeFilter = (
  filter: AdhocFilter,
): filter is TemporalRangeAdhocFilter => {
  const candidate = filter as Partial<{
    operator: string;
    comparator: unknown;
  }>;
  return (
    candidate.operator === 'TEMPORAL_RANGE' &&
    typeof candidate.comparator === 'string' &&
    candidate.comparator !== NO_TIME_RANGE
  );
};

export const getChartTimeRangeSourceValues = (
  charts: ChartsState,
  chartIds?: number[],
) => {
  if (!chartIds?.length) {
    return [];
  }

  const values = chartIds.flatMap(chartId => {
    const formData = charts[chartId]?.form_data as
      | { adhoc_filters?: AdhocFilter[] }
      | undefined;
    const adhocFilters = formData?.adhoc_filters || [];
    return adhocFilters
      .filter(isTemporalRangeFilter)
      .map(filter => filter.comparator);
  });

  return Array.from(new Set(values));
};
