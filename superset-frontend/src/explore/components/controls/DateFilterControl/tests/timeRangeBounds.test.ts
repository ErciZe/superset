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
  isTimeRangeWithinBounds,
  mergeTimeRangeBounds,
} from '../utils/timeRangeBounds';

test('mergeTimeRangeBounds returns the union of chart time filters', () => {
  expect(
    mergeTimeRangeBounds([
      {
        since: '2024-02-01T00:00:00',
        until: '2024-03-01T00:00:00',
      },
      {
        since: '2024-01-01T00:00:00',
        until: '2024-04-01T00:00:00',
      },
    ]),
  ).toEqual({
    min: '2024-01-01T00:00:00',
    max: '2024-04-01T00:00:00',
  });
});

test('isTimeRangeWithinBounds rejects ranges outside chart filter bounds', () => {
  const bounds = {
    min: '2024-01-01T00:00:00',
    max: '2024-04-01T00:00:00',
  };

  expect(
    isTimeRangeWithinBounds(
      {
        since: '2024-01-15T00:00:00',
        until: '2024-02-01T00:00:00',
      },
      bounds,
    ),
  ).toBe(true);
  expect(
    isTimeRangeWithinBounds(
      {
        since: '2023-12-31T00:00:00',
        until: '2024-02-01T00:00:00',
      },
      bounds,
    ),
  ).toBe(false);
  expect(
    isTimeRangeWithinBounds(
      {
        since: '2024-03-01T00:00:00',
        until: '2024-04-02T00:00:00',
      },
      bounds,
    ),
  ).toBe(false);
});
