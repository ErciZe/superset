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
import { ResolvedTimeRange, TimeRangeBounds } from '../types';

const toTimestamp = (value?: string) => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

export const mergeTimeRangeBounds = (
  ranges: ResolvedTimeRange[],
): TimeRangeBounds | undefined => {
  let min: string | undefined;
  let max: string | undefined;

  ranges.forEach(({ since, until }) => {
    const sinceTimestamp = toTimestamp(since);
    const minTimestamp = toTimestamp(min);
    if (
      since &&
      sinceTimestamp !== undefined &&
      (minTimestamp === undefined || sinceTimestamp < minTimestamp)
    ) {
      min = since;
    }

    const untilTimestamp = toTimestamp(until);
    const maxTimestamp = toTimestamp(max);
    if (
      until &&
      untilTimestamp !== undefined &&
      (maxTimestamp === undefined || untilTimestamp > maxTimestamp)
    ) {
      max = until;
    }
  });

  return min || max ? { min, max } : undefined;
};

export const isTimeRangeWithinBounds = (
  range: ResolvedTimeRange,
  bounds?: TimeRangeBounds,
) => {
  if (!bounds) return true;

  if (bounds.min) {
    const sinceTimestamp = toTimestamp(range.since);
    const minTimestamp = toTimestamp(bounds.min);
    if (
      sinceTimestamp === undefined ||
      (minTimestamp !== undefined && sinceTimestamp < minTimestamp)
    ) {
      return false;
    }
  }

  if (bounds.max) {
    const untilTimestamp = toTimestamp(range.until);
    const maxTimestamp = toTimestamp(bounds.max);
    if (
      untilTimestamp === undefined ||
      (maxTimestamp !== undefined && untilTimestamp > maxTimestamp)
    ) {
      return false;
    }
  }

  return true;
};

export const formatTimeRangeBounds = (bounds: TimeRangeBounds) =>
  `${bounds.min || '-∞'} : ${bounds.max || '∞'}`;
