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
import { getChartTimeRangeSourceValues } from './timeRangeBounds';

test('getChartTimeRangeSourceValues extracts temporal filters from scoped charts', () => {
  expect(
    getChartTimeRangeSourceValues(
      {
        1: {
          form_data: {
            adhoc_filters: [
              {
                expressionType: 'SIMPLE',
                subject: '__time_range',
                operator: 'TEMPORAL_RANGE',
                comparator: '2024-01-01 : 2024-02-01',
              },
              {
                expressionType: 'SIMPLE',
                subject: 'country',
                operator: 'IN',
                comparator: ['US'],
              },
            ],
          },
        },
        2: {
          form_data: {
            adhoc_filters: [
              {
                expressionType: 'SIMPLE',
                subject: '__time_range',
                operator: 'TEMPORAL_RANGE',
                comparator: 'No filter',
              },
            ],
          },
        },
        3: {
          form_data: {
            adhoc_filters: [
              {
                expressionType: 'SIMPLE',
                subject: '__time_range',
                operator: 'TEMPORAL_RANGE',
                comparator: '2024-03-01 : 2024-04-01',
              },
            ],
          },
        },
      } as any,
      [1, 2],
    ),
  ).toEqual(['2024-01-01 : 2024-02-01']);
});
